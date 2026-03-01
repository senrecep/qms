"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  documents,
  documentRevisions,
  distributionLists,
  distributionUsers,
  readConfirmations,
  activityLogs,
  approvals,
  users,
  departments,
  departmentMembers,
} from "@/lib/db/schema";
import { nanoid } from "nanoid";
import { saveFile } from "@/lib/storage";
import { and, eq, or, ilike, inArray, sql, desc, count, asc, ne } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod/v4";
import { revalidatePath } from "next/cache";
import {
  enqueueEmail,
  enqueueBulkEmail,
  enqueueNotification,
  enqueueBulkNotifications,
} from "@/lib/queue";
import { env } from "@/lib/env";
import { classifyError } from "@/lib/errors";

// --- Types ---

export type DocumentFilters = {
  search?: string;
  departmentId?: string;
  documentType?: string;
  status?: string;
  page?: number;
  pageSize?: number;
};

export type DocumentListItem = {
  id: string;
  documentCode: string;
  title: string;
  currentRevisionNo: number;
  status: string;
  documentType: string;
  publishedAt: Date | null;
  createdAt: Date;
  departmentName: string;
  preparerName: string;
  approverName: string;
  uploaderName: string;
  previousRevisionStatus: string | null;
  readConfirmed: number;
  readTotal: number;
};

export type DocumentDetail = Awaited<ReturnType<typeof getDocumentById>>;

// --- Helpers ---

/** Escape LIKE pattern special characters to prevent wildcard injection */
function escapeLikePattern(input: string): string {
  return input.replace(/[%_\\]/g, "\\$&");
}

async function getSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");
  return session;
}


// --- Queries ---

export async function getDocuments(filters: DocumentFilters = {}) {
  const session = await getSession();
  const { search, departmentId, documentType, status, page = 1, pageSize = 20 } = filters;

  // Alias for current revision join
  const rev = documentRevisions;

  const conditions = [eq(documents.isDeleted, false)];

  if (search) {
    const escaped = escapeLikePattern(search);
    conditions.push(
      or(
        ilike(rev.title, `%${escaped}%`),
        ilike(documents.documentCode, `%${escaped}%`),
      )!,
    );
  }

  if (documentType) {
    conditions.push(eq(rev.documentType, documentType as "PROCEDURE" | "INSTRUCTION" | "FORM"));
  }

  if (status) {
    conditions.push(
      eq(
        rev.status,
        status as "DRAFT" | "PENDING_APPROVAL" | "PREPARER_APPROVED" | "PREPARER_REJECTED" | "APPROVED" | "APPROVER_REJECTED" | "PUBLISHED" | "CANCELLED",
      ),
    );
  }

  if (departmentId) {
    const distributedRevisionDocIds = db
      .select({ documentId: rev.documentId })
      .from(distributionLists)
      .innerJoin(rev, eq(distributionLists.revisionId, rev.id))
      .where(eq(distributionLists.departmentId, departmentId));

    conditions.push(
      or(
        eq(rev.departmentId, departmentId),
        inArray(documents.id, distributedRevisionDocIds),
      )!,
    );
  }

  const where = and(...conditions);

  // Aliases for preparer and approver
  const preparerUser = users;

  const [docsResult, totalResult] = await Promise.all([
    db
      .select({
        id: documents.id,
        documentCode: documents.documentCode,
        title: rev.title,
        currentRevisionNo: documents.currentRevisionNo,
        status: rev.status,
        documentType: rev.documentType,
        publishedAt: rev.publishedAt,
        createdAt: documents.createdAt,
        departmentName: departments.name,
        preparerName: sql<string>`preparer.name`.as("preparer_name"),
        approverName: sql<string>`approver_user.name`.as("approver_name"),
        uploaderName: sql<string>`creator.name`.as("uploader_name"),
        revisionId: rev.id,
      })
      .from(documents)
      .innerJoin(rev, eq(documents.currentRevisionId, rev.id))
      .leftJoin(departments, eq(rev.departmentId, departments.id))
      .leftJoin(
        sql`"user" as preparer`,
        sql`preparer.id = ${rev.preparerId}`,
      )
      .leftJoin(
        sql`"user" as approver_user`,
        sql`approver_user.id = ${rev.approverId}`,
      )
      .leftJoin(
        sql`"user" as creator`,
        sql`creator.id = ${rev.createdById}`,
      )
      .where(where)
      .orderBy(desc(documents.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: count() })
      .from(documents)
      .innerJoin(rev, eq(documents.currentRevisionId, rev.id))
      .leftJoin(departments, eq(rev.departmentId, departments.id))
      .where(where),
  ]);

  // Get read confirmation stats for current revisions
  const revisionIds = docsResult.map((d) => d.revisionId).filter(Boolean) as string[];
  let readStats: Record<string, { confirmed: number; total: number }> = {};

  if (revisionIds.length > 0) {
    const stats = await db
      .select({
        revisionId: readConfirmations.revisionId,
        total: count(),
        confirmed: count(readConfirmations.confirmedAt),
      })
      .from(readConfirmations)
      .where(inArray(readConfirmations.revisionId, revisionIds))
      .groupBy(readConfirmations.revisionId);

    readStats = Object.fromEntries(
      stats.map((s) => [s.revisionId, { confirmed: s.confirmed, total: s.total }]),
    );
  }

  // Get previous revision status for each document
  const docIds = docsResult.map((d) => d.id);
  let prevStatuses: Record<string, string | null> = {};

  if (docIds.length > 0) {
    // For each document, get the revision before the current one
    const prevRevisions = await db
      .select({
        documentId: documentRevisions.documentId,
        status: documentRevisions.status,
        revisionNo: documentRevisions.revisionNo,
      })
      .from(documentRevisions)
      .where(inArray(documentRevisions.documentId, docIds))
      .orderBy(documentRevisions.documentId, desc(documentRevisions.revisionNo));

    // Group by documentId and pick the second one (previous)
    const grouped: Record<string, Array<{ status: string; revisionNo: number }>> = {};
    for (const r of prevRevisions) {
      if (!grouped[r.documentId]) grouped[r.documentId] = [];
      grouped[r.documentId].push({ status: r.status, revisionNo: r.revisionNo });
    }
    for (const [docId, revs] of Object.entries(grouped)) {
      prevStatuses[docId] = revs.length > 1 ? revs[1].status : null;
    }
  }

  const data: DocumentListItem[] = docsResult.map((doc) => ({
    id: doc.id,
    documentCode: doc.documentCode,
    title: doc.title,
    currentRevisionNo: doc.currentRevisionNo,
    status: doc.status,
    documentType: doc.documentType,
    publishedAt: doc.publishedAt,
    createdAt: doc.createdAt,
    departmentName: doc.departmentName ?? "",
    preparerName: doc.preparerName ?? "",
    approverName: doc.approverName ?? "",
    uploaderName: doc.uploaderName ?? "",
    previousRevisionStatus: prevStatuses[doc.id] ?? null,
    readConfirmed: readStats[doc.revisionId]?.confirmed ?? 0,
    readTotal: readStats[doc.revisionId]?.total ?? 0,
  }));

  return {
    data,
    total: totalResult[0]?.count ?? 0,
    page,
    pageSize,
  };
}

export async function getDocumentById(id: string) {
  const session = await getSession();

  const doc = await db.query.documents.findFirst({
    where: and(eq(documents.id, id), eq(documents.isDeleted, false)),
    with: {
      revisions: {
        orderBy: (rev, { desc }) => [desc(rev.revisionNo)],
        with: {
          preparer: { columns: { id: true, name: true, email: true } },
          approver: { columns: { id: true, name: true, email: true } },
          createdBy: { columns: { id: true, name: true, email: true } },
          department: { columns: { id: true, name: true } },
          preparerDepartment: { columns: { id: true, name: true } },
          approvals: {
            orderBy: (appr, { desc }) => [desc(appr.createdAt)],
            with: { approver: { columns: { id: true, name: true, email: true } } },
          },
          distributionLists: {
            with: { department: { columns: { id: true, name: true } } },
          },
          distributionUsers: {
            with: { user: { columns: { id: true, name: true, email: true } } },
          },
          readConfirmations: {
            with: { user: { columns: { id: true, name: true, email: true } } },
          },
        },
      },
      activityLogs: {
        orderBy: (log, { desc }) => [desc(log.createdAt)],
        with: { user: { columns: { id: true, name: true } } },
      },
    },
  });

  if (!doc) throw new Error("Document not found");

  return doc;
}

// --- Mutations ---

const createDocumentSchema = z.object({
  documentCode: z.string().min(1, "Document code is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  documentType: z.enum(["PROCEDURE", "INSTRUCTION", "FORM"]),
  departmentId: z.string().min(1, "Department is required"),
  preparerDepartmentId: z.string().optional(),
  preparerId: z.string().min(1, "Preparer is required"),
  approverId: z.string().optional(),
  distributionDepartmentIds: z.string().optional(), // comma-separated
  distributionUserIds: z.string().optional(), // comma-separated
  startingRevisionNo: z.coerce.number().int().min(0).optional(),
  action: z.enum(["save", "submit"]).optional(),
});

export async function createDocument(formData: FormData) {
  try {
  const session = await getSession();

  const raw = {
    documentCode: formData.get("documentCode") as string,
    title: formData.get("title") as string,
    description: (formData.get("description") as string) || undefined,
    documentType: formData.get("documentType") as string,
    departmentId: formData.get("departmentId") as string,
    preparerDepartmentId: (formData.get("preparerDepartmentId") as string) || undefined,
    preparerId: (formData.get("preparerId") as string) || session.user.id,
    approverId: (formData.get("approverId") as string) || undefined,
    distributionDepartmentIds: (formData.get("distributionDepartmentIds") as string) || undefined,
    distributionUserIds: (formData.get("distributionUserIds") as string) || undefined,
    startingRevisionNo: (formData.get("startingRevisionNo") as string) || "0",
    action: (formData.get("action") as string) || "save",
  };

  const parsed = createDocumentSchema.parse(raw);
  const file = formData.get("file") as File | null;

  if (!file || file.size === 0) {
    return { success: false, error: "File is required", errorCode: "FILE_REQUIRED" };
  }

  const maxSizeBytes = env.MAX_FILE_SIZE_MB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return { success: false, error: `File exceeds ${env.MAX_FILE_SIZE_MB} MB limit`, errorCode: "FILE_TOO_LARGE", maxSize: env.MAX_FILE_SIZE_MB };
  }

  const startingRevNo = parsed.startingRevisionNo ?? 0;
  const actionType = parsed.action ?? "save";
  const initialStatus = actionType === "submit" ? "PENDING_APPROVAL" : "DRAFT";

  // 1. Pre-generate document ID and save file (outside transaction — FS can't rollback)
  const docId = nanoid();
  const fileMeta = await saveFile(file, docId);

  // 2. Wrap all DB operations in a transaction for atomicity
  const revision = await db.transaction(async (tx) => {
    const [doc] = await tx
      .insert(documents)
      .values({ id: docId, documentCode: parsed.documentCode })
      .returning();

    const [rev] = await tx
      .insert(documentRevisions)
      .values({
        documentId: doc.id,
        revisionNo: startingRevNo,
        title: parsed.title,
        description: parsed.description,
        documentType: parsed.documentType as "PROCEDURE" | "INSTRUCTION" | "FORM",
        status: initialStatus,
        departmentId: parsed.departmentId,
        preparerDepartmentId: parsed.preparerDepartmentId || null,
        preparerId: parsed.preparerId,
        approverId: parsed.approverId || null,
        createdById: session.user.id,
        filePath: fileMeta.path,
        fileName: fileMeta.fileName,
        fileSize: fileMeta.size,
        mimeType: fileMeta.mimeType,
        changes: "Initial upload",
      })
      .returning();

    await tx
      .update(documents)
      .set({ currentRevisionId: rev.id, currentRevisionNo: startingRevNo })
      .where(eq(documents.id, doc.id));

    if (parsed.distributionDepartmentIds) {
      const deptIds = parsed.distributionDepartmentIds.split(",").filter(Boolean);
      if (deptIds.length > 0) {
        await tx.insert(distributionLists).values(
          deptIds.map((deptId) => ({ revisionId: rev.id, departmentId: deptId })),
        );
      }
    }

    if (parsed.distributionUserIds) {
      const userIds = parsed.distributionUserIds.split(",").filter(Boolean);
      if (userIds.length > 0) {
        await tx.insert(distributionUsers).values(
          userIds.map((userId) => ({ revisionId: rev.id, userId })),
        );
      }
    }

    await tx.insert(activityLogs).values({
      documentId: doc.id,
      revisionId: rev.id,
      userId: session.user.id,
      action: "UPLOADED",
      details: { title: parsed.title, documentCode: parsed.documentCode, revisionNo: startingRevNo },
    });

    return rev;
  });

  // 3. Handle approval flow outside transaction (includes async notifications)
  if (actionType === "submit") {
    await createApprovalFlow(revision.id, parsed.preparerId, parsed.approverId || null, docId, parsed.title, parsed.documentCode, session.user.name, session.user.id);
  }

  revalidatePath("/documents");

  return { success: true, id: docId };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues.map((i) => i.message).join(", "), errorCode: "VALIDATION_ERROR" };
    }
    return classifyError(error);
  }
}

// Helper: create approval flow based on preparer/approver logic
async function createApprovalFlow(
  revisionId: string,
  preparerId: string,
  approverId: string | null,
  documentId: string,
  title: string,
  documentCode: string,
  uploaderName: string,
  createdById: string,
) {
  if (!approverId) return;

  if (preparerId === approverId) {
    // Single step: preparerId === approverId, skip preparer step
    await db.insert(approvals).values({
      revisionId,
      approverId,
      approvalType: "APPROVER",
      status: "PENDING",
    });

    // Notify approver
    try {
      const approver = await db.query.users.findFirst({
        where: eq(users.id, approverId),
        columns: { name: true, email: true },
      });

      if (approver) {
        await Promise.allSettled([
          enqueueNotification({
            userId: approverId,
            type: "APPROVAL_REQUEST",
            titleKey: "newApprovalRequest",
            messageParams: { docTitle: title, docCode: documentCode },
            relatedDocumentId: documentId,
            relatedRevisionId: revisionId,
          }),
          enqueueEmail({
            to: approver.email,
            subjectKey: "approvalRequest",
            subjectParams: { title },
            templateName: "approval-request",
            templateProps: {
              approverName: approver.name,
              documentTitle: title,
              documentCode,
              uploaderName,
              approvalUrl: `${env.NEXT_PUBLIC_APP_URL}/documents/${documentId}`,
            },
          }),
        ]);
      }
    } catch (error) {
      console.error("[createApprovalFlow] Failed to notify approver:", error);
    }
  } else if (createdById === preparerId) {
    // Auto-skip preparer: uploader IS the preparer, skip to approver directly
    await db.insert(approvals).values({
      revisionId,
      approverId: preparerId,
      approvalType: "PREPARER",
      status: "APPROVED",
      comment: "Auto-approved: uploader is the preparer",
      respondedAt: new Date(),
    });

    // Update revision status to PREPARER_APPROVED
    await db
      .update(documentRevisions)
      .set({ status: "PREPARER_APPROVED" })
      .where(eq(documentRevisions.id, revisionId));

    // Create APPROVER approval
    await db.insert(approvals).values({
      revisionId,
      approverId,
      approvalType: "APPROVER",
      status: "PENDING",
    });

    // Log auto-approval activity
    await db.insert(activityLogs).values({
      documentId,
      revisionId,
      userId: createdById,
      action: "PREPARER_APPROVED",
      details: { autoApproved: true, reason: "Uploader is the preparer" },
    });

    // Notify approver (not preparer since they uploaded it themselves)
    try {
      const approver = await db.query.users.findFirst({
        where: eq(users.id, approverId),
        columns: { name: true, email: true },
      });

      if (approver) {
        await Promise.allSettled([
          enqueueNotification({
            userId: approverId,
            type: "APPROVAL_REQUEST",
            titleKey: "newApprovalRequest",
            messageParams: { docTitle: title, docCode: documentCode },
            relatedDocumentId: documentId,
            relatedRevisionId: revisionId,
          }),
          enqueueEmail({
            to: approver.email,
            subjectKey: "approvalRequest",
            subjectParams: { title },
            templateName: "approval-request",
            templateProps: {
              approverName: approver.name,
              documentTitle: title,
              documentCode,
              uploaderName,
              approvalUrl: `${env.NEXT_PUBLIC_APP_URL}/documents/${documentId}`,
            },
          }),
        ]);
      }
    } catch (error) {
      console.error("[createApprovalFlow] Failed to notify approver (auto-skip):", error);
    }
  } else {
    // Two-step: PREPARER first, then APPROVER
    await db.insert(approvals).values({
      revisionId,
      approverId: preparerId,
      approvalType: "PREPARER",
      status: "PENDING",
    });

    // Notify preparer
    try {
      const preparer = await db.query.users.findFirst({
        where: eq(users.id, preparerId),
        columns: { name: true, email: true },
      });

      if (preparer) {
        await Promise.allSettled([
          enqueueNotification({
            userId: preparerId,
            type: "APPROVAL_REQUEST",
            titleKey: "newApprovalRequest",
            messageParams: { docTitle: title, docCode: documentCode },
            relatedDocumentId: documentId,
            relatedRevisionId: revisionId,
          }),
          enqueueEmail({
            to: preparer.email,
            subjectKey: "approvalRequest",
            subjectParams: { title },
            templateName: "approval-request",
            templateProps: {
              approverName: preparer.name,
              documentTitle: title,
              documentCode,
              uploaderName,
              approvalUrl: `${env.NEXT_PUBLIC_APP_URL}/documents/${documentId}`,
            },
          }),
        ]);
      }
    } catch (error) {
      console.error("[createApprovalFlow] Failed to notify preparer:", error);
    }
  }
}

// --- submitForApproval (NEW) ---

export async function submitForApproval(revisionId: string) {
  const session = await getSession();

  const revision = await db.query.documentRevisions.findFirst({
    where: eq(documentRevisions.id, revisionId),
    with: {
      document: { columns: { id: true, documentCode: true } },
    },
  });

  if (!revision) throw new Error("Revision not found");
  if (revision.status !== "DRAFT") throw new Error("Only DRAFT revisions can be submitted");

  // Update status to PENDING_APPROVAL
  await db
    .update(documentRevisions)
    .set({ status: "PENDING_APPROVAL" })
    .where(eq(documentRevisions.id, revisionId));

  // Create approval flow
  await createApprovalFlow(
    revisionId,
    revision.preparerId,
    revision.approverId,
    revision.documentId,
    revision.title,
    revision.document.documentCode,
    session.user.name,
    session.user.id,
  );

  // Log activity
  await db.insert(activityLogs).values({
    documentId: revision.documentId,
    revisionId,
    userId: session.user.id,
    action: "SUBMITTED",
    details: { title: revision.title, revisionNo: revision.revisionNo },
  });

  revalidatePath("/documents");
  revalidatePath(`/documents/${revision.documentId}`);

  return { success: true };
}

// --- publishDocument (REWRITE) ---

export async function publishDocument(revisionId: string) {
  const session = await getSession();

  // Get revision with document info
  const revision = await db.query.documentRevisions.findFirst({
    where: eq(documentRevisions.id, revisionId),
    with: {
      document: { columns: { id: true, documentCode: true } },
      distributionLists: { with: { department: true } },
      distributionUsers: true,
    },
  });

  if (!revision) throw new Error("Revision not found");
  if (revision.status !== "APPROVED") throw new Error("Only APPROVED revisions can be published");

  // Verify caller is approver or ADMIN
  if (revision.approverId !== session.user.id && session.user.role !== "ADMIN") {
    throw new Error("Only the approver or an admin can publish");
  }

  const now = new Date();

  // Update revision status
  await db
    .update(documentRevisions)
    .set({ status: "PUBLISHED", publishedAt: now })
    .where(eq(documentRevisions.id, revisionId));

  // --- Department distribution: read confirmations for managers ---
  const readConfirmationUserIds = new Set<string>();

  if (revision.distributionLists.length > 0) {
    const deptIds = revision.distributionLists.map((d) => d.departmentId);
    const deptManagers = await db
      .select({ id: users.id })
      .from(departmentMembers)
      .innerJoin(users, eq(departmentMembers.userId, users.id))
      .where(
        and(
          inArray(departmentMembers.departmentId, deptIds),
          eq(departmentMembers.role, "MANAGER"),
          eq(users.isActive, true),
        ),
      );
    deptManagers.forEach((u) => readConfirmationUserIds.add(u.id));
  }

  // --- Individual user distribution: informational only (no read confirmation) ---
  const infoOnlyUserIds = new Set<string>();

  if (revision.distributionUsers.length > 0) {
    const indivUserIds = revision.distributionUsers.map((u) => u.userId);
    const indivUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(and(inArray(users.id, indivUserIds), eq(users.isActive, true)));
    indivUsers.forEach((u) => {
      // Don't add to info-only if already getting a read confirmation from department
      if (!readConfirmationUserIds.has(u.id)) {
        infoOnlyUserIds.add(u.id);
      }
    });
  }

  const targetUserIds = Array.from(readConfirmationUserIds);

  // Create read confirmations ONLY for department managers
  if (targetUserIds.length > 0) {
    await db.insert(readConfirmations).values(
      targetUserIds.map((uid) => ({
        revisionId,
        userId: uid,
      })),
    );
  }

  // Log activity
  await db.insert(activityLogs).values({
    documentId: revision.documentId,
    revisionId,
    userId: session.user.id,
    action: "PUBLISHED",
    details: { title: revision.title, revisionNo: revision.revisionNo },
  });

  revalidatePath("/documents");
  revalidatePath(`/documents/${revision.documentId}`);

  // Async notifications
  try {
    const jobs: Promise<unknown>[] = [];

    // --- Read assignment notifications for department managers ---
    if (targetUserIds.length > 0) {
      jobs.push(enqueueBulkNotifications({
        notifications: targetUserIds.map((uid) => ({
          userId: uid,
          type: "READ_ASSIGNMENT" as const,
          titleKey: "newReadAssignment",
          messageParams: { docTitle: revision.title, docCode: revision.document.documentCode },
          relatedDocumentId: revision.documentId,
          relatedRevisionId: revisionId,
        })),
      }));

      const usersForReadEmail = await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(inArray(users.id, targetUserIds));

      if (usersForReadEmail.length > 0) {
        jobs.push(enqueueBulkEmail({
          emails: usersForReadEmail.map((u) => ({
            to: u.email,
            subjectKey: "readAssignment",
            subjectParams: { title: revision.title },
            templateName: "read-assignment" as const,
            templateProps: {
              userName: u.name,
              documentTitle: revision.title,
              documentCode: revision.document.documentCode,
              publishedBy: session.user.name,
              readUrl: `${env.NEXT_PUBLIC_APP_URL}/documents/${revision.documentId}`,
            },
          })),
        }));
      }
    }

    // --- Informational notifications for individual distribution users ---
    const infoUserIdArray = Array.from(infoOnlyUserIds);
    if (infoUserIdArray.length > 0) {
      jobs.push(enqueueBulkNotifications({
        notifications: infoUserIdArray.map((uid) => ({
          userId: uid,
          type: "DOCUMENT_DISTRIBUTED" as const,
          titleKey: "documentDistributed",
          messageParams: { docTitle: revision.title, docCode: revision.document.documentCode },
          relatedDocumentId: revision.documentId,
          relatedRevisionId: revisionId,
        })),
      }));

      const usersForInfoEmail = await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(inArray(users.id, infoUserIdArray));

      if (usersForInfoEmail.length > 0) {
        jobs.push(enqueueBulkEmail({
          emails: usersForInfoEmail.map((u) => ({
            to: u.email,
            subjectKey: "documentDistributed",
            subjectParams: { title: revision.title },
            templateName: "document-distributed" as const,
            templateProps: {
              userName: u.name,
              documentTitle: revision.title,
              documentCode: revision.document.documentCode,
              publishedBy: session.user.name,
              documentUrl: `${env.NEXT_PUBLIC_APP_URL}/documents/${revision.documentId}`,
            },
          })),
        }));
      }
    }

    if (jobs.length > 0) {
      await Promise.allSettled(jobs);
    }

    // Notify uploader if different from publisher
    if (revision.createdById !== session.user.id) {
      await enqueueNotification({
        userId: revision.createdById,
        type: "READ_ASSIGNMENT",
        titleKey: "documentPublished",
        messageParams: { docTitle: revision.title, docCode: revision.document.documentCode },
        relatedDocumentId: revision.documentId,
        relatedRevisionId: revisionId,
      });
    }
  } catch (error) {
    console.error("[publishDocument] Failed to enqueue notifications:", error);
  }

  return { success: true };
}

// --- reviseDocument (REWRITE) ---

const reviseDocumentSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  documentType: z.enum(["PROCEDURE", "INSTRUCTION", "FORM"]).optional(),
  departmentId: z.string().optional(),
  preparerDepartmentId: z.string().optional(),
  preparerId: z.string().optional(),
  approverId: z.string().optional(),
  changes: z.string().optional(),
  distributionDepartmentIds: z.string().optional(),
  distributionUserIds: z.string().optional(),
  action: z.enum(["save", "submit"]).optional(),
});

export async function reviseDocument(formData: FormData) {
  try {
  const session = await getSession();
  const documentId = formData.get("documentId") as string;
  const file = formData.get("file") as File | null;

  if (!documentId) {
    return { success: false, error: "Document ID is required", errorCode: "VALIDATION_ERROR" };
  }
  if (!file || file.size === 0) {
    return { success: false, error: "File is required for revision", errorCode: "FILE_REQUIRED" };
  }

  const maxSizeBytes = env.MAX_FILE_SIZE_MB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return { success: false, error: `File exceeds ${env.MAX_FILE_SIZE_MB} MB limit`, errorCode: "FILE_TOO_LARGE", maxSize: env.MAX_FILE_SIZE_MB };
  }

  const raw = {
    title: (formData.get("title") as string) || undefined,
    description: (formData.get("description") as string) || undefined,
    documentType: (formData.get("documentType") as string) || undefined,
    departmentId: (formData.get("departmentId") as string) || undefined,
    preparerDepartmentId: (formData.get("preparerDepartmentId") as string) || undefined,
    preparerId: (formData.get("preparerId") as string) || undefined,
    approverId: (formData.get("approverId") as string) || undefined,
    changes: (formData.get("changes") as string) || undefined,
    distributionDepartmentIds: (formData.get("distributionDepartmentIds") as string) || undefined,
    distributionUserIds: (formData.get("distributionUserIds") as string) || undefined,
    action: (formData.get("action") as string) || "save",
  };

  const parsed = reviseDocumentSchema.parse(raw);

  // Get document with current revision
  const doc = await db.query.documents.findFirst({
    where: and(eq(documents.id, documentId), eq(documents.isDeleted, false)),
    with: {
      currentRevision: true,
    },
  });

  if (!doc) throw new Error("Document not found");
  if (!doc.currentRevision) throw new Error("No current revision found");

  const currentRevision = doc.currentRevision;
  const fileMeta = await saveFile(file, documentId);
  const actionType = parsed.action ?? "save";

  if (currentRevision.status === "DRAFT") {
    // OVERWRITE existing draft revision
    const updateData: Record<string, unknown> = {
      filePath: fileMeta.path,
      fileName: fileMeta.fileName,
      fileSize: fileMeta.size,
      mimeType: fileMeta.mimeType,
      updatedAt: new Date(),
    };

    if (parsed.title) updateData.title = parsed.title;
    if (parsed.description !== undefined) updateData.description = parsed.description;
    if (parsed.documentType) updateData.documentType = parsed.documentType;
    if (parsed.departmentId) updateData.departmentId = parsed.departmentId;
    if (parsed.preparerDepartmentId !== undefined) updateData.preparerDepartmentId = parsed.preparerDepartmentId || null;
    if (parsed.preparerId) updateData.preparerId = parsed.preparerId;
    if (parsed.approverId !== undefined) updateData.approverId = parsed.approverId || null;
    if (parsed.changes !== undefined) updateData.changes = parsed.changes;

    if (actionType === "submit") {
      updateData.status = "PENDING_APPROVAL";
    }

    // Wrap DB operations in a transaction for atomicity
    await db.transaction(async (tx) => {
      await tx
        .update(documentRevisions)
        .set(updateData)
        .where(eq(documentRevisions.id, currentRevision.id));

      if (parsed.distributionDepartmentIds !== undefined) {
        await tx.delete(distributionLists).where(eq(distributionLists.revisionId, currentRevision.id));
        const deptIds = (parsed.distributionDepartmentIds || "").split(",").filter(Boolean);
        if (deptIds.length > 0) {
          await tx.insert(distributionLists).values(
            deptIds.map((deptId) => ({ revisionId: currentRevision.id, departmentId: deptId })),
          );
        }
      }

      if (parsed.distributionUserIds !== undefined) {
        await tx.delete(distributionUsers).where(eq(distributionUsers.revisionId, currentRevision.id));
        const userIds = (parsed.distributionUserIds || "").split(",").filter(Boolean);
        if (userIds.length > 0) {
          await tx.insert(distributionUsers).values(
            userIds.map((userId) => ({ revisionId: currentRevision.id, userId })),
          );
        }
      }

      await tx.insert(activityLogs).values({
        documentId,
        revisionId: currentRevision.id,
        userId: session.user.id,
        action: "REVISED",
        details: { revisionNo: currentRevision.revisionNo, changes: parsed.changes, overwrite: true },
      });
    });

    // Approval flow outside transaction (includes async notifications)
    if (actionType === "submit") {
      const effectivePreparerId = parsed.preparerId || currentRevision.preparerId;
      const effectiveApproverId = parsed.approverId !== undefined ? (parsed.approverId || null) : currentRevision.approverId;
      const effectiveTitle = parsed.title || currentRevision.title;

      await createApprovalFlow(
        currentRevision.id,
        effectivePreparerId,
        effectiveApproverId,
        documentId,
        effectiveTitle,
        doc.documentCode,
        session.user.name,
        session.user.id,
      );
    }

    revalidatePath("/documents");
    revalidatePath(`/documents/${documentId}`);
    return { success: true, revisionNo: currentRevision.revisionNo };
  } else {
    // Create NEW revision — wrap DB operations in a transaction
    const newRevisionNo = doc.currentRevisionNo + 1;
    const newStatus = actionType === "submit" ? "PENDING_APPROVAL" : "DRAFT";

    const newRevision = await db.transaction(async (tx) => {
      const [rev] = await tx
        .insert(documentRevisions)
        .values({
          documentId,
          revisionNo: newRevisionNo,
          title: parsed.title || currentRevision.title,
          description: parsed.description !== undefined ? parsed.description : currentRevision.description,
          documentType: (parsed.documentType || currentRevision.documentType) as "PROCEDURE" | "INSTRUCTION" | "FORM",
          status: newStatus,
          departmentId: parsed.departmentId || currentRevision.departmentId,
          preparerDepartmentId: parsed.preparerDepartmentId !== undefined
            ? (parsed.preparerDepartmentId || null)
            : currentRevision.preparerDepartmentId,
          preparerId: parsed.preparerId || currentRevision.preparerId,
          approverId: parsed.approverId !== undefined
            ? (parsed.approverId || null)
            : currentRevision.approverId,
          createdById: session.user.id,
          filePath: fileMeta.path,
          fileName: fileMeta.fileName,
          fileSize: fileMeta.size,
          mimeType: fileMeta.mimeType,
          changes: parsed.changes,
        })
        .returning();

      await tx
        .update(documents)
        .set({ currentRevisionId: rev.id, currentRevisionNo: newRevisionNo })
        .where(eq(documents.id, documentId));

      if (parsed.distributionDepartmentIds !== undefined) {
        const deptIds = (parsed.distributionDepartmentIds || "").split(",").filter(Boolean);
        if (deptIds.length > 0) {
          await tx.insert(distributionLists).values(
            deptIds.map((deptId) => ({ revisionId: rev.id, departmentId: deptId })),
          );
        }
      } else {
        const prevDists = await tx
          .select({ departmentId: distributionLists.departmentId })
          .from(distributionLists)
          .where(eq(distributionLists.revisionId, currentRevision.id));
        if (prevDists.length > 0) {
          await tx.insert(distributionLists).values(
            prevDists.map((d) => ({ revisionId: rev.id, departmentId: d.departmentId })),
          );
        }
      }

      if (parsed.distributionUserIds !== undefined) {
        const userIds = (parsed.distributionUserIds || "").split(",").filter(Boolean);
        if (userIds.length > 0) {
          await tx.insert(distributionUsers).values(
            userIds.map((userId) => ({ revisionId: rev.id, userId })),
          );
        }
      } else {
        const prevUsers = await tx
          .select({ userId: distributionUsers.userId })
          .from(distributionUsers)
          .where(eq(distributionUsers.revisionId, currentRevision.id));
        if (prevUsers.length > 0) {
          await tx.insert(distributionUsers).values(
            prevUsers.map((u) => ({ revisionId: rev.id, userId: u.userId })),
          );
        }
      }

      await tx.insert(activityLogs).values({
        documentId,
        revisionId: rev.id,
        userId: session.user.id,
        action: "REVISED",
        details: { revisionNo: newRevisionNo, changes: parsed.changes },
      });

      return rev;
    });

    // Approval flow outside transaction (includes async notifications)
    if (actionType === "submit") {
      const effectivePreparerId = parsed.preparerId || currentRevision.preparerId;
      const effectiveApproverId = parsed.approverId !== undefined ? (parsed.approverId || null) : currentRevision.approverId;
      const effectiveTitle = parsed.title || currentRevision.title;

      await createApprovalFlow(
        newRevision.id,
        effectivePreparerId,
        effectiveApproverId,
        documentId,
        effectiveTitle,
        doc.documentCode,
        session.user.name,
        session.user.id,
      );
    }

    revalidatePath("/documents");
    revalidatePath(`/documents/${documentId}`);
    return { success: true, revisionNo: newRevisionNo };
  }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues.map((i) => i.message).join(", "), errorCode: "VALIDATION_ERROR" };
    }
    return classifyError(error);
  }
}

// --- cancelDocument (UPDATE) ---

export async function cancelDocument(documentId: string) {
  const session = await getSession();

  const doc = await db.query.documents.findFirst({
    where: and(eq(documents.id, documentId), eq(documents.isDeleted, false)),
    with: {
      currentRevision: {
        with: {
          approver: { columns: { id: true, name: true, email: true } },
          distributionLists: { with: { department: true } },
        },
      },
    },
  });

  if (!doc) throw new Error("Document not found");
  if (!doc.currentRevision) throw new Error("No current revision found");

  const revision = doc.currentRevision;

  // Cancel the current revision
  await db
    .update(documentRevisions)
    .set({ status: "CANCELLED" })
    .where(eq(documentRevisions.id, revision.id));

  // Log activity with revisionId
  await db.insert(activityLogs).values({
    documentId,
    revisionId: revision.id,
    userId: session.user.id,
    action: "CANCELLED",
    details: { title: revision.title, revisionNo: revision.revisionNo },
  });

  revalidatePath("/documents");
  revalidatePath(`/documents/${documentId}`);

  // Async notifications
  try {
    if (revision.approverId && revision.status === "PENDING_APPROVAL" && revision.approver) {
      const pendingApproval = await db.query.approvals.findFirst({
        where: and(
          eq(approvals.revisionId, revision.id),
          eq(approvals.status, "PENDING"),
        ),
      });

      if (pendingApproval) {
        await Promise.allSettled([
          enqueueNotification({
            userId: revision.approverId,
            type: "APPROVAL_REQUEST",
            titleKey: "documentCancelled",
            messageParams: { docTitle: revision.title, docCode: doc.documentCode },
            relatedDocumentId: documentId,
            relatedRevisionId: revision.id,
          }),
          enqueueEmail({
            to: revision.approver.email,
            subjectKey: "documentCancelled",
            subjectParams: { title: revision.title },
            templateName: "document-cancelled",
            templateProps: {
              recipientName: revision.approver.name,
              documentTitle: revision.title,
              documentCode: doc.documentCode,
              cancelledBy: session.user.name,
            },
          }),
        ]);
      }
    }

    if (revision.status === "PUBLISHED") {
      const allCancelUserIds = new Set<string>();

      if (revision.distributionLists.length > 0) {
        const deptIds = revision.distributionLists.map((d) => d.departmentId);
        const deptUsers = await db
          .select({ id: users.id })
          .from(departmentMembers)
          .innerJoin(users, eq(departmentMembers.userId, users.id))
          .where(
            and(
              inArray(departmentMembers.departmentId, deptIds),
              eq(users.isActive, true),
            ),
          );
        deptUsers.forEach((u) => allCancelUserIds.add(u.id));
      }

      const indivUsers = await db
        .select({ userId: distributionUsers.userId })
        .from(distributionUsers)
        .where(eq(distributionUsers.revisionId, revision.id));
      indivUsers.forEach((u) => allCancelUserIds.add(u.userId));

      const cancelUserIds = Array.from(allCancelUserIds);

      if (cancelUserIds.length > 0) {
        const targetUsers = await db
          .select({ id: users.id, name: users.name, email: users.email })
          .from(users)
          .where(inArray(users.id, cancelUserIds));

        await Promise.allSettled([
          enqueueBulkNotifications({
            notifications: targetUsers.map((u) => ({
              userId: u.id,
              type: "READ_ASSIGNMENT" as const,
              titleKey: "documentCancelled",
              messageParams: { docTitle: revision.title, docCode: doc.documentCode },
              relatedDocumentId: documentId,
              relatedRevisionId: revision.id,
            })),
          }),
          enqueueBulkEmail({
            emails: targetUsers.map((u) => ({
              to: u.email,
              subjectKey: "documentCancelled",
              subjectParams: { title: revision.title },
              templateName: "document-cancelled" as const,
              templateProps: {
                recipientName: u.name,
                documentTitle: revision.title,
                documentCode: doc.documentCode,
                cancelledBy: session.user.name,
              },
            })),
          }),
        ]);
      }
    }
  } catch (error) {
    console.error("[cancelDocument] Failed to enqueue notifications:", error);
  }

  return { success: true };
}

// --- exportDocumentsToExcel (UPDATE) ---

export async function exportDocumentsToExcel(filters: DocumentFilters = {}) {
  const session = await getSession();

  // Reuse getDocuments logic
  const result = await getDocuments(filters);

  // Return data suitable for Excel export with new columns
  return result.data.map((doc) => ({
    documentCode: doc.documentCode,
    title: doc.title,
    revisionNo: doc.currentRevisionNo,
    status: doc.status,
    documentType: doc.documentType,
    departmentName: doc.departmentName,
    preparerName: doc.preparerName,
    approverName: doc.approverName,
    publishedAt: doc.publishedAt?.toISOString() ?? "",
    readConfirmed: doc.readConfirmed,
    readTotal: doc.readTotal,
  }));
}

// --- Data loaders for forms ---

export async function getDepartments() {
  return db
    .select({ id: departments.id, name: departments.name })
    .from(departments)
    .where(and(eq(departments.isActive, true), eq(departments.isDeleted, false)));
}

export async function getApprovers() {
  // Get ADMIN + MANAGER users with their department names via junction table
  const approverUsers = await db
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
    })
    .from(users)
    .where(
      and(
        eq(users.isActive, true),
        or(eq(users.role, "MANAGER"), eq(users.role, "ADMIN")),
      ),
    );

  // Get department names for each approver
  const approverIds = approverUsers.map((u) => u.id);
  const memberships = approverIds.length > 0
    ? await db
        .select({
          userId: departmentMembers.userId,
          departmentName: departments.name,
        })
        .from(departmentMembers)
        .innerJoin(departments, eq(departmentMembers.departmentId, departments.id))
        .where(inArray(departmentMembers.userId, approverIds))
    : [];

  // Build map: userId -> department names
  const deptMap = new Map<string, string[]>();
  for (const m of memberships) {
    const existing = deptMap.get(m.userId) || [];
    existing.push(m.departmentName);
    deptMap.set(m.userId, existing);
  }

  return approverUsers.map((u) => ({
    ...u,
    departmentName: deptMap.get(u.id)?.join(", ") ?? null,
  }));
}

export async function getAllActiveUsers() {
  const activeUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
    })
    .from(users)
    .where(eq(users.isActive, true));

  // Get department memberships for all active users
  const userIds = activeUsers.map((u) => u.id);
  const memberships = userIds.length > 0
    ? await db
        .select({
          userId: departmentMembers.userId,
          departmentId: departmentMembers.departmentId,
          departmentName: departments.name,
        })
        .from(departmentMembers)
        .innerJoin(departments, eq(departmentMembers.departmentId, departments.id))
        .where(inArray(departmentMembers.userId, userIds))
    : [];

  // Build map: userId -> departments
  const deptMap = new Map<string, { departmentId: string; departmentName: string }[]>();
  for (const m of memberships) {
    const existing = deptMap.get(m.userId) || [];
    existing.push({ departmentId: m.departmentId, departmentName: m.departmentName });
    deptMap.set(m.userId, existing);
  }

  return activeUsers.map((u) => ({
    ...u,
    departmentId: deptMap.get(u.id)?.[0]?.departmentId ?? null,
    departmentName: deptMap.get(u.id)?.map((d) => d.departmentName).join(", ") ?? null,
  }));
}
