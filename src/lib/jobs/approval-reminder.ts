import { db } from "@/lib/db";
import { approvals, users, documentRevisions, systemSettings } from "@/lib/db/schema";
import { eq, and, lt, isNull, or, inArray } from "drizzle-orm";
import { enqueueEmail, enqueueNotification } from "@/lib/queue";
import { env } from "@/lib/env";

const ACTIVE_PENDING_REVISION_STATUSES = ["PENDING_APPROVAL", "PREPARER_APPROVED"] as const;

export async function runApprovalReminders() {
  const results = {
    processed: 0,
    sent: 0,
    errors: 0,
  };

  try {
    // 1. Get reminder days from system settings or env
    const reminderDaysSetting = await db.query.systemSettings.findFirst({
      where: eq(systemSettings.key, "default_reminder_days"),
    });
    const reminderDays =
      parseInt(reminderDaysSetting?.value || "") || env.DEFAULT_REMINDER_DAYS;

    // 2. Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - reminderDays);

    // Don't spam: only send if reminderSentAt is null OR was sent more than 1 day ago
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    // 3. Find pending approvals that need reminders
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
          or(
            isNull(approvals.reminderSentAt),
            lt(approvals.reminderSentAt, oneDayAgo),
          ),
        ),
      );

    console.log(
      `[ApprovalReminder] Found ${pendingApprovals.length} approvals needing reminders`,
    );

    // 4. Process each approval
    for (const { approval, approver, revision } of pendingApprovals) {
      results.processed++;

      try {
        // Calculate days pending
        const daysPending = Math.floor(
          (Date.now() - new Date(approval.createdAt).getTime()) /
            (1000 * 60 * 60 * 24),
        );

        const approvalUrl = `${env.NEXT_PUBLIC_APP_URL}/approvals/${approval.id}`;

        // Get document code from revision
        const docCode = `${revision.title}-Rev${revision.revisionNo}`;

        // Enqueue email
        await enqueueEmail({
          to: approver.email,
          subjectKey: "approvalReminder",
          subjectParams: { title: revision.title },
          templateName: "approval-reminder",
          templateProps: {
            approverName: approver.name,
            documentTitle: revision.title,
            documentCode: docCode,
            daysPending,
            approvalUrl,
          },
        });

        // Enqueue notification
        await enqueueNotification({
          userId: approver.id,
          type: "REMINDER",
          titleKey: "approvalReminder",
          messageParams: { docTitle: revision.title, docCode, days: daysPending },
          relatedDocumentId: revision.documentId,
          relatedRevisionId: revision.id,
        });

        // Update reminderSentAt
        await db
          .update(approvals)
          .set({ reminderSentAt: new Date() })
          .where(eq(approvals.id, approval.id));

        results.sent++;
        console.log(
          `[ApprovalReminder] Enqueued reminder for ${approver.email} (approval ${approval.id})`,
        );
      } catch (error) {
        console.error(
          `[ApprovalReminder] Error processing approval ${approval.id}:`,
          error,
        );
        results.errors++;
      }
    }

    console.log("[ApprovalReminder] Job completed:", results);
    return results;
  } catch (error) {
    console.error("[ApprovalReminder] Job failed:", error);
    throw error;
  }
}
