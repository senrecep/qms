import { db } from "@/lib/db";
import {
  approvals,
  users,
  documentRevisions,
  departmentMembers,
  systemSettings,
} from "@/lib/db/schema";
import { eq, and, lt, isNull, inArray, ne } from "drizzle-orm";
import { enqueueEmail, enqueueNotification } from "@/lib/queue";
import { env } from "@/lib/env";

const ACTIVE_PENDING_REVISION_STATUSES = ["PENDING_APPROVAL", "PREPARER_APPROVED"] as const;

export async function runApprovalEscalations() {
  const results = {
    processed: 0,
    escalated: 0,
    errors: 0,
  };

  try {
    // 1. Get escalation days from system settings or env
    const escalationDaysSetting = await db.query.systemSettings.findFirst({
      where: eq(systemSettings.key, "default_escalation_days"),
    });
    const escalationDays =
      parseInt(escalationDaysSetting?.value || "") ||
      env.DEFAULT_ESCALATION_DAYS;

    // 2. Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - escalationDays);

    // 3. Find pending approvals that need escalation
    const pendingApprovals = await db
      .select({
        approval: approvals,
        approver: users,
        revision: documentRevisions,
      })
      .from(approvals)
      .innerJoin(users, eq(approvals.approverId, users.id))
      .innerJoin(documentRevisions, eq(approvals.revisionId, documentRevisions.id))
      .where(
        and(
          eq(approvals.status, "PENDING"),
          inArray(documentRevisions.status, ACTIVE_PENDING_REVISION_STATUSES),
          lt(approvals.createdAt, cutoffDate),
          isNull(approvals.escalatedAt),
        ),
      );

    console.log(
      `[ApprovalEscalation] Found ${pendingApprovals.length} approvals needing escalation`,
    );

    // 4. Process each approval
    for (const { approval, approver, revision } of pendingApprovals) {
      results.processed++;

      try {
        // Find escalation target: department manager or admin
        let escalationTarget = null;

        // First try to find a department manager from approver's departments
        const approverMemberships = await db
          .select({ departmentId: departmentMembers.departmentId })
          .from(departmentMembers)
          .where(eq(departmentMembers.userId, approver.id));

        if (approverMemberships.length > 0) {
          const deptIds = approverMemberships.map((m) => m.departmentId);
          const managerResult = await db
            .select({ user: users })
            .from(departmentMembers)
            .innerJoin(users, eq(departmentMembers.userId, users.id))
            .where(
              and(
                inArray(departmentMembers.departmentId, deptIds),
                eq(departmentMembers.role, "MANAGER"),
                eq(users.isActive, true),
                ne(users.id, approver.id),
              ),
            )
            .limit(1);

          if (managerResult.length > 0) {
            escalationTarget = managerResult[0].user;
          }
        }

        // If no department manager, find any admin
        if (!escalationTarget) {
          const admin = await db.query.users.findFirst({
            where: and(eq(users.role, "ADMIN"), eq(users.isActive, true)),
          });
          escalationTarget = admin;
        }

        if (!escalationTarget) {
          console.error(
            `[ApprovalEscalation] No escalation target found for approval ${approval.id}`,
          );
          results.errors++;
          continue;
        }

        // Calculate days pending
        const daysPending = Math.floor(
          (Date.now() - new Date(approval.createdAt).getTime()) /
            (1000 * 60 * 60 * 24),
        );

        const approvalUrl = `${env.NEXT_PUBLIC_APP_URL}/approvals/${approval.id}`;
        const docCode = `${revision.title}-Rev${revision.revisionNo}`;

        // Enqueue escalation email
        await enqueueEmail({
          to: escalationTarget.email,
          subjectKey: "escalation",
          subjectParams: { title: revision.title },
          templateName: "escalation-notice",
          templateProps: {
            managerName: escalationTarget.name,
            documentTitle: revision.title,
            documentCode: docCode,
            originalApprover: approver.name,
            daysPending,
            approvalUrl,
          },
        });

        // Enqueue notification for manager
        await enqueueNotification({
          userId: escalationTarget.id,
          type: "ESCALATION",
          titleKey: "escalationNotice",
          messageParams: { docTitle: revision.title, docCode, approverName: approver.name, days: daysPending },
          relatedDocumentId: revision.documentId,
          relatedRevisionId: revision.id,
        });

        // Notify original approver about escalation
        await enqueueNotification({
          userId: approver.id,
          type: "ESCALATION",
          titleKey: "approvalEscalated",
          messageParams: { docTitle: revision.title, docCode, days: daysPending },
          relatedDocumentId: revision.documentId,
          relatedRevisionId: revision.id,
        });

        // Notify document uploader about escalation
        if (revision.createdById && revision.createdById !== escalationTarget.id) {
          await enqueueNotification({
            userId: revision.createdById,
            type: "ESCALATION",
            titleKey: "documentEscalated",
            messageParams: { docTitle: revision.title, docCode, escalationTarget: escalationTarget.name },
            relatedDocumentId: revision.documentId,
            relatedRevisionId: revision.id,
          });
        }

        // Update escalatedAt
        await db
          .update(approvals)
          .set({ escalatedAt: new Date() })
          .where(eq(approvals.id, approval.id));

        results.escalated++;
        console.log(
          `[ApprovalEscalation] Escalated approval ${approval.id} to ${escalationTarget.email}`,
        );
      } catch (error) {
        console.error(
          `[ApprovalEscalation] Error processing approval ${approval.id}:`,
          error,
        );
        results.errors++;
      }
    }

    console.log("[ApprovalEscalation] Job completed:", results);
    return results;
  } catch (error) {
    console.error("[ApprovalEscalation] Job failed:", error);
    throw error;
  }
}
