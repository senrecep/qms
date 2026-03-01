"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  documents,
  documentRevisions,
  approvals,
  readConfirmations,
  users,
  activityLogs,
} from "@/lib/db/schema";
import { eq, and, count, isNull, desc, inArray } from "drizzle-orm";
import { headers } from "next/headers";

const ACTIVE_PENDING_REVISION_STATUSES = ["PENDING_APPROVAL", "PREPARER_APPROVED"] as const;

export async function getDashboardStats() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const [totalDocumentsResult] = await db
    .select({ count: count() })
    .from(documents)
    .where(eq(documents.isDeleted, false));

  const [pendingApprovalsResult] = await db
    .select({ count: count() })
    .from(approvals)
    .innerJoin(documentRevisions, eq(approvals.revisionId, documentRevisions.id))
    .where(
      and(
        eq(approvals.status, "PENDING"),
        eq(approvals.approverId, session.user.id),
        inArray(documentRevisions.status, ACTIVE_PENDING_REVISION_STATUSES),
      ),
    );

  const [unreadDocumentsResult] = await db
    .select({ count: count() })
    .from(readConfirmations)
    .where(
      and(
        eq(readConfirmations.userId, session.user.id),
        isNull(readConfirmations.confirmedAt),
      ),
    );

  const [activeUsersResult] = await db
    .select({ count: count() })
    .from(users)
    .where(eq(users.isActive, true));

  return {
    totalDocuments: totalDocumentsResult.count,
    pendingApprovals: pendingApprovalsResult.count,
    unreadDocuments: unreadDocumentsResult.count,
    activeUsers: activeUsersResult.count,
  };
}

export async function getPendingTasks() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const pendingApprovalsList = await db
    .select({
      id: approvals.id,
      documentId: documentRevisions.documentId,
      documentTitle: documentRevisions.title,
      documentCode: documents.documentCode,
      createdAt: approvals.createdAt,
    })
    .from(approvals)
    .innerJoin(documentRevisions, eq(approvals.revisionId, documentRevisions.id))
    .innerJoin(documents, eq(documentRevisions.documentId, documents.id))
    .where(
      and(
        eq(approvals.status, "PENDING"),
        eq(approvals.approverId, session.user.id),
        inArray(documentRevisions.status, ACTIVE_PENDING_REVISION_STATUSES),
      ),
    )
    .orderBy(desc(approvals.createdAt))
    .limit(5);

  const unreadDocumentsList = await db
    .select({
      id: readConfirmations.id,
      documentId: documentRevisions.documentId,
      documentTitle: documentRevisions.title,
      documentCode: documents.documentCode,
      createdAt: readConfirmations.createdAt,
    })
    .from(readConfirmations)
    .innerJoin(documentRevisions, eq(readConfirmations.revisionId, documentRevisions.id))
    .innerJoin(documents, eq(documentRevisions.documentId, documents.id))
    .where(
      and(
        eq(readConfirmations.userId, session.user.id),
        isNull(readConfirmations.confirmedAt),
      ),
    )
    .orderBy(desc(readConfirmations.createdAt))
    .limit(5);

  return { pendingApprovals: pendingApprovalsList, unreadDocuments: unreadDocumentsList };
}

export async function getRecentActivity(limit: number = 10) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const activities = await db
    .select({
      id: activityLogs.id,
      action: activityLogs.action,
      createdAt: activityLogs.createdAt,
      userName: users.name,
      documentCode: documents.documentCode,
      documentTitle: documentRevisions.title,
    })
    .from(activityLogs)
    .innerJoin(users, eq(activityLogs.userId, users.id))
    .innerJoin(documents, eq(activityLogs.documentId, documents.id))
    .leftJoin(documentRevisions, eq(activityLogs.revisionId, documentRevisions.id))
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit);

  return activities;
}
