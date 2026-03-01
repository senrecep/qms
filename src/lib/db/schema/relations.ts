import { relations } from "drizzle-orm";
import { users } from "./users";
import { departments } from "./departments";
import { departmentMembers } from "./department-members";
import { documents } from "./documents";
import { documentRevisions } from "./document-revisions";
import { approvals } from "./approvals";
import { distributionLists } from "./distribution-lists";
import { distributionUsers } from "./distribution-users";
import { readConfirmations } from "./read-confirmations";
import { notifications } from "./notifications";
import { activityLogs } from "./activity-logs";
import { systemSettings } from "./system-settings";

// Users relations
export const usersRelations = relations(users, ({ many }) => ({
  departmentMemberships: many(departmentMembers),
  preparedRevisions: many(documentRevisions, { relationName: "preparer" }),
  approvedRevisions: many(documentRevisions, { relationName: "approver" }),
  createdRevisions: many(documentRevisions, { relationName: "createdBy" }),
  approvals: many(approvals),
  readConfirmations: many(readConfirmations),
  notifications: many(notifications),
  activityLogs: many(activityLogs),
  updatedSettings: many(systemSettings),
  distributionUsers: many(distributionUsers),
}));

// Departments relations
export const departmentsRelations = relations(departments, ({ many }) => ({
  departmentMemberships: many(departmentMembers),
  revisions: many(documentRevisions, { relationName: "department" }),
  preparerRevisions: many(documentRevisions, { relationName: "preparerDepartment" }),
  distributionLists: many(distributionLists),
}));

// Department Members relations (junction table)
export const departmentMembersRelations = relations(
  departmentMembers,
  ({ one }) => ({
    user: one(users, {
      fields: [departmentMembers.userId],
      references: [users.id],
    }),
    department: one(departments, {
      fields: [departmentMembers.departmentId],
      references: [departments.id],
    }),
  }),
);

// Documents relations (simplified master table)
export const documentsRelations = relations(documents, ({ one, many }) => ({
  currentRevision: one(documentRevisions, {
    fields: [documents.currentRevisionId],
    references: [documentRevisions.id],
    relationName: "currentRevision",
  }),
  revisions: many(documentRevisions, { relationName: "documentRevisions" }),
  notifications: many(notifications),
  activityLogs: many(activityLogs),
}));

// Document Revisions relations (enhanced with all mutable data)
export const documentRevisionsRelations = relations(
  documentRevisions,
  ({ one, many }) => ({
    document: one(documents, {
      fields: [documentRevisions.documentId],
      references: [documents.id],
      relationName: "documentRevisions",
    }),
    department: one(departments, {
      fields: [documentRevisions.departmentId],
      references: [departments.id],
      relationName: "department",
    }),
    preparerDepartment: one(departments, {
      fields: [documentRevisions.preparerDepartmentId],
      references: [departments.id],
      relationName: "preparerDepartment",
    }),
    preparer: one(users, {
      fields: [documentRevisions.preparerId],
      references: [users.id],
      relationName: "preparer",
    }),
    approver: one(users, {
      fields: [documentRevisions.approverId],
      references: [users.id],
      relationName: "approver",
    }),
    createdBy: one(users, {
      fields: [documentRevisions.createdById],
      references: [users.id],
      relationName: "createdBy",
    }),
    approvals: many(approvals),
    distributionLists: many(distributionLists),
    distributionUsers: many(distributionUsers),
    readConfirmations: many(readConfirmations),
  }),
);

// Approvals relations
export const approvalsRelations = relations(approvals, ({ one }) => ({
  revision: one(documentRevisions, {
    fields: [approvals.revisionId],
    references: [documentRevisions.id],
  }),
  approver: one(users, {
    fields: [approvals.approverId],
    references: [users.id],
  }),
}));

// Distribution Lists relations
export const distributionListsRelations = relations(
  distributionLists,
  ({ one }) => ({
    revision: one(documentRevisions, {
      fields: [distributionLists.revisionId],
      references: [documentRevisions.id],
    }),
    department: one(departments, {
      fields: [distributionLists.departmentId],
      references: [departments.id],
    }),
  }),
);

// Distribution Users relations
export const distributionUsersRelations = relations(
  distributionUsers,
  ({ one }) => ({
    revision: one(documentRevisions, {
      fields: [distributionUsers.revisionId],
      references: [documentRevisions.id],
    }),
    user: one(users, {
      fields: [distributionUsers.userId],
      references: [users.id],
    }),
  }),
);

// Read Confirmations relations
export const readConfirmationsRelations = relations(
  readConfirmations,
  ({ one }) => ({
    revision: one(documentRevisions, {
      fields: [readConfirmations.revisionId],
      references: [documentRevisions.id],
    }),
    user: one(users, {
      fields: [readConfirmations.userId],
      references: [users.id],
    }),
  }),
);

// Notifications relations
export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  relatedDocument: one(documents, {
    fields: [notifications.relatedDocumentId],
    references: [documents.id],
  }),
  relatedRevision: one(documentRevisions, {
    fields: [notifications.relatedRevisionId],
    references: [documentRevisions.id],
  }),
}));

// Activity Logs relations
export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  document: one(documents, {
    fields: [activityLogs.documentId],
    references: [documents.id],
  }),
  revision: one(documentRevisions, {
    fields: [activityLogs.revisionId],
    references: [documentRevisions.id],
  }),
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}));

// System Settings relations
export const systemSettingsRelations = relations(
  systemSettings,
  ({ one }) => ({
    updatedBy: one(users, {
      fields: [systemSettings.updatedById],
      references: [users.id],
    }),
  }),
);
