"use server";

import { db } from "@/lib/db";
import {
  approvals,
  documentRevisions,
  documents,
  activityLogs,
  users,
} from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod/v4";
import { enqueueEmail, enqueueNotification } from "@/lib/queue";
import { publish, CHANNELS } from "@/lib/redis/pubsub";
import { revalidatePath } from "next/cache";
import { env } from "@/lib/env";
import { classifyError, type ActionResult } from "@/lib/errors";
import { publishDocument } from "@/actions/documents";

// --- Queries ---

export async function getPendingApprovals() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const items = await db.query.approvals.findMany({
    where: and(
      eq(approvals.approverId, session.user.id),
      eq(approvals.status, "PENDING"),
    ),
    with: {
      revision: {
        columns: {
          id: true,
          title: true,
          documentType: true,
          createdById: true,
          createdAt: true,
          documentId: true,
        },
        with: {
          document: {
            columns: {
              id: true,
              documentCode: true,
            },
          },
          createdBy: {
            columns: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
    orderBy: (approvals, { desc }) => [desc(approvals.createdAt)],
  });

  return items;
}

export async function getCompletedApprovals() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const items = await db.query.approvals.findMany({
    where: and(
      eq(approvals.approverId, session.user.id),
      inArray(approvals.status, ["APPROVED", "REJECTED"]),
    ),
    with: {
      revision: {
        columns: {
          id: true,
          title: true,
          documentType: true,
          createdById: true,
          createdAt: true,
          documentId: true,
        },
        with: {
          document: {
            columns: {
              id: true,
              documentCode: true,
            },
          },
          createdBy: {
            columns: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
    orderBy: (approvals, { desc }) => [desc(approvals.respondedAt)],
  });

  return items;
}

// --- Mutations ---

export async function approveDocument(approvalId: string, comment?: string): Promise<ActionResult> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new Error("Unauthorized");

    const approval = await db.query.approvals.findFirst({
      where: and(
        eq(approvals.id, approvalId),
        eq(approvals.approverId, session.user.id),
        eq(approvals.status, "PENDING"),
      ),
      with: {
        revision: {
          with: {
            document: {
              columns: {
                id: true,
                documentCode: true,
              },
            },
            createdBy: {
              columns: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!approval) {
      return { success: false, error: "Approval not found or already processed", errorCode: "APPROVAL_NOT_FOUND" };
    }

    // Prevent self-approval: the document creator cannot approve their own document
    if (approval.revision.createdBy.id === session.user.id) {
      return { success: false, error: "You cannot approve your own document", errorCode: "SELF_APPROVAL" };
    }

    const revision = approval.revision;
    const documentId = revision.documentId;
    const documentCode = revision.document.documentCode;

    // Update approval status
    await db
      .update(approvals)
      .set({
        status: "APPROVED",
        comment: comment ?? null,
        respondedAt: new Date(),
      })
      .where(eq(approvals.id, approvalId));

    if (approval.approvalType === "PREPARER") {
      // PREPARER approved -> update revision to PREPARER_APPROVED
      await db
        .update(documentRevisions)
        .set({ status: "PREPARER_APPROVED" })
        .where(eq(documentRevisions.id, revision.id));

      // Create APPROVER approval for revision.approverId
      let finalApprover: { name: string; email: string } | null = null;

      if (revision.approverId) {
        await db.insert(approvals).values({
          revisionId: revision.id,
          approverId: revision.approverId,
          approvalType: "APPROVER",
          status: "PENDING",
        });

        finalApprover = await db.query.users.findFirst({
          where: eq(users.id, revision.approverId),
          columns: { name: true, email: true },
        }) ?? null;
      }

      // Log activity
      await db.insert(activityLogs).values({
        documentId,
        revisionId: revision.id,
        userId: session.user.id,
        action: "PREPARER_APPROVED",
        details: { comment, approvalType: "PREPARER" },
      });

      // Real-time & cache
      await publish(CHANNELS.approvals, {
        targetUserId: revision.createdById,
        data: {
          documentId,
          revisionId: revision.id,
          status: "PREPARER_APPROVED",
          approvalType: "PREPARER",
        },
      });

      revalidatePath("/approvals");
      revalidatePath("/documents");

      // Async notifications
      try {
        const jobs: Promise<unknown>[] = [];

        // Notify uploader about preparer approval
        jobs.push(enqueueNotification({
          userId: revision.createdById,
          type: "APPROVAL_REQUEST",
          titleKey: "documentPreparerApproved",
          messageParams: { docTitle: revision.title, docCode: documentCode },
          relatedDocumentId: documentId,
          relatedRevisionId: revision.id,
        }));

        // Notify final approver
        if (revision.approverId && finalApprover) {
          jobs.push(enqueueNotification({
            userId: revision.approverId,
            type: "APPROVAL_REQUEST",
            titleKey: "newApprovalRequest",
            messageParams: { docTitle: revision.title, docCode: documentCode },
            relatedDocumentId: documentId,
            relatedRevisionId: revision.id,
          }));

          jobs.push(enqueueEmail({
            to: finalApprover.email,
            subjectKey: "approvalRequest",
            subjectParams: { title: revision.title },
            templateName: "approval-request",
            templateProps: {
              approverName: finalApprover.name,
              documentTitle: revision.title,
              documentCode,
              uploaderName: revision.createdBy.name,
              approvalUrl: `${env.NEXT_PUBLIC_APP_URL}/documents/${documentId}`,
            },
          }));
        }

        await Promise.allSettled(jobs);
      } catch (error) {
        console.error("[approveDocument:PREPARER] Failed to enqueue notifications:", error);
      }
    } else {
      // APPROVER approved -> update revision to APPROVED
      await db
        .update(documentRevisions)
        .set({ status: "APPROVED" })
        .where(eq(documentRevisions.id, revision.id));

      // Log activity
      await db.insert(activityLogs).values({
        documentId,
        revisionId: revision.id,
        userId: session.user.id,
        action: "APPROVED",
        details: { comment, approvalType: "APPROVER" },
      });

      // Real-time & cache
      await publish(CHANNELS.approvals, {
        targetUserId: revision.createdById,
        data: {
          documentId,
          revisionId: revision.id,
          status: "APPROVED",
          approvalType: "APPROVER",
        },
      });

      revalidatePath("/approvals");
      revalidatePath("/documents");

      // Async notifications
      try {
        const jobs: Promise<unknown>[] = [];

        // Notify uploader
        jobs.push(enqueueNotification({
          userId: revision.createdById,
          type: "APPROVAL_REQUEST",
          titleKey: "documentApproved",
          messageParams: { docTitle: revision.title, docCode: documentCode },
          relatedDocumentId: documentId,
          relatedRevisionId: revision.id,
        }));

        jobs.push(enqueueEmail({
          to: revision.createdBy.email,
          subjectKey: "documentApproved",
          subjectParams: { title: revision.title },
          templateName: "document-approved",
          templateProps: {
            uploaderName: revision.createdBy.name,
            documentTitle: revision.title,
            documentCode,
            approvedBy: session.user.name,
            publishUrl: `${env.NEXT_PUBLIC_APP_URL}/documents/${documentId}`,
          },
        }));

        await Promise.allSettled(jobs);
      } catch (error) {
        console.error("[approveDocument:APPROVER] Failed to enqueue notifications:", error);
      }

      // Auto-publish after final approval
      try {
        await publishDocument(revision.id);
      } catch (autoPublishError) {
        console.error("[approveDocument:APPROVER] Auto-publish failed, document remains in APPROVED state:", autoPublishError);
      }
    }

    return { success: true };
  } catch (error) {
    return classifyError(error);
  }
}

// --- rejectDocument (REWRITE) ---

const rejectSchema = z.object({
  comment: z.string().min(10, "Rejection reason must be at least 10 characters"),
});

export async function rejectDocument(approvalId: string, comment: string): Promise<ActionResult> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new Error("Unauthorized");

    const parsed = rejectSchema.safeParse({ comment });
    if (!parsed.success) {
      return { success: false, error: "Rejection reason must be at least 10 characters", errorCode: "REJECTION_TOO_SHORT" };
    }

    const approval = await db.query.approvals.findFirst({
      where: and(
        eq(approvals.id, approvalId),
        eq(approvals.approverId, session.user.id),
        eq(approvals.status, "PENDING"),
      ),
      with: {
        revision: {
          with: {
            document: {
              columns: {
                id: true,
                documentCode: true,
              },
            },
            createdBy: {
              columns: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!approval) {
      return { success: false, error: "Approval not found or already processed", errorCode: "APPROVAL_NOT_FOUND" };
    }

    const revision = approval.revision;
    const documentId = revision.documentId;
    const documentCode = revision.document.documentCode;

    // Update approval status
    await db
      .update(approvals)
      .set({
        status: "REJECTED",
        comment: parsed.data.comment,
        respondedAt: new Date(),
      })
      .where(eq(approvals.id, approvalId));

    if (approval.approvalType === "PREPARER") {
      // PREPARER rejected -> LOCKED (PREPARER_REJECTED, no return to draft)
      await db
        .update(documentRevisions)
        .set({ status: "PREPARER_REJECTED" })
        .where(eq(documentRevisions.id, revision.id));

      // Log activity
      await db.insert(activityLogs).values({
        documentId,
        revisionId: revision.id,
        userId: session.user.id,
        action: "PREPARER_REJECTED",
        details: { comment: parsed.data.comment, approvalType: "PREPARER" },
      });
    } else {
      // APPROVER rejected -> LOCKED (APPROVER_REJECTED)
      await db
        .update(documentRevisions)
        .set({ status: "APPROVER_REJECTED" })
        .where(eq(documentRevisions.id, revision.id));

      // Log activity
      await db.insert(activityLogs).values({
        documentId,
        revisionId: revision.id,
        userId: session.user.id,
        action: "APPROVER_REJECTED",
        details: { comment: parsed.data.comment, approvalType: "APPROVER" },
      });
    }

    // Real-time
    await publish(CHANNELS.approvals, {
      targetUserId: revision.createdById,
      data: {
        documentId,
        revisionId: revision.id,
        status: approval.approvalType === "PREPARER" ? "PREPARER_REJECTED" : "APPROVER_REJECTED",
        comment: parsed.data.comment,
      },
    });

    revalidatePath("/approvals");
    revalidatePath("/documents");

    // Async notifications
    try {
      await Promise.allSettled([
        enqueueNotification({
          userId: revision.createdById,
          type: "DOCUMENT_REJECTED",
          titleKey: approval.approvalType === "PREPARER" ? "documentPreparerRejected" : "documentApproverRejected",
          messageParams: {
            docTitle: revision.title,
            docCode: documentCode,
            reason: parsed.data.comment,
          },
          relatedDocumentId: documentId,
          relatedRevisionId: revision.id,
        }),
        enqueueEmail({
          to: revision.createdBy.email,
          subjectKey: "documentRejected",
          subjectParams: { title: revision.title },
          templateName: "document-rejected",
          templateProps: {
            uploaderName: revision.createdBy.name,
            documentTitle: revision.title,
            documentCode,
            rejectedBy: session.user.name,
            rejectionReason: parsed.data.comment,
            editUrl: `${env.NEXT_PUBLIC_APP_URL}/documents/${documentId}`,
          },
        }),
      ]);
    } catch (error) {
      console.error("[rejectDocument] Failed to enqueue notifications:", error);
    }

    return { success: true };
  } catch (error) {
    return classifyError(error);
  }
}
