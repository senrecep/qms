import type { notifications } from "@/lib/db/schema";

// Template names matching src/lib/email/templates/*.tsx
export type EmailTemplateName =
  | "approval-request"
  | "approval-reminder"
  | "preparer-approved"
  | "document-rejected"
  | "document-approved"
  | "document-revised"
  | "document-cancelled"
  | "read-assignment"
  | "document-distributed"
  | "read-reminder"
  | "escalation-notice"
  | "welcome";

// --- Job Payloads ---

export type SendEmailPayload = {
  to: string | string[];
  subject: string;
  templateName: EmailTemplateName;
  templateProps: Record<string, unknown>;
};

export type SendBulkEmailPayload = {
  emails: Array<{
    to: string | string[];
    subject: string;
    templateName: EmailTemplateName;
    templateProps: Record<string, unknown>;
  }>;
};

export type CreateNotificationPayload = {
  userId: string;
  type: (typeof notifications.$inferInsert)["type"];
  titleKey: string;
  messageParams?: Record<string, string | number>;
  relatedDocumentId?: string;
  relatedRevisionId?: string;
};

export type CreateBulkNotificationsPayload = {
  notifications: Array<{
    userId: string;
    type: (typeof notifications.$inferInsert)["type"];
    titleKey: string;
    messageParams?: Record<string, string | number>;
    relatedDocumentId?: string;
    relatedRevisionId?: string;
  }>;
};

// --- Job Map (name → payload) ---

export type JobMap = {
  "send-email": SendEmailPayload;
  "send-bulk-email": SendBulkEmailPayload;
  "create-notification": CreateNotificationPayload;
  "create-bulk-notifications": CreateBulkNotificationsPayload;
};

export type JobName = keyof JobMap;
