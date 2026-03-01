import { pgEnum } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", [
  "ADMIN",
  "MANAGER",
  "USER",
]);

export const documentStatusEnum = pgEnum("document_status", [
  "DRAFT",
  "PENDING_APPROVAL",
  "PREPARER_APPROVED",
  "PREPARER_REJECTED",
  "APPROVED",
  "APPROVER_REJECTED",
  "PUBLISHED",
  "CANCELLED",
]);

export const approvalStatusEnum = pgEnum("approval_status", [
  "PENDING",
  "APPROVED",
  "REJECTED",
]);

export const departmentMemberRoleEnum = pgEnum("department_member_role", [
  "MEMBER",
  "MANAGER",
]);

export const documentTypeEnum = pgEnum("document_type", [
  "PROCEDURE",
  "INSTRUCTION",
  "FORM",
]);
