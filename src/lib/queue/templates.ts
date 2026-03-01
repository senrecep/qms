import type { ReactElement } from "react";
import type { EmailTemplateName } from "./types";

import { ApprovalRequestEmail } from "@/lib/email/templates/approval-request";
import { ApprovalReminderEmail } from "@/lib/email/templates/approval-reminder";
import { PreparerApprovedEmail } from "@/lib/email/templates/preparer-approved";
import { DocumentRejectedEmail } from "@/lib/email/templates/document-rejected";
import { DocumentApprovedEmail } from "@/lib/email/templates/document-approved";
import { DocumentRevisedEmail } from "@/lib/email/templates/document-revised";
import { DocumentCancelledEmail } from "@/lib/email/templates/document-cancelled";
import { ReadAssignmentEmail } from "@/lib/email/templates/read-assignment";
import { DocumentDistributedEmail } from "@/lib/email/templates/document-distributed";
import { ReadReminderEmail } from "@/lib/email/templates/read-reminder";
import { EscalationNoticeEmail } from "@/lib/email/templates/escalation-notice";
import { WelcomeEmail } from "@/lib/email/templates/welcome";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProps = any;

// Registry: templateName → component factory
// Props are serialized as plain objects in the queue and reconstructed here.
const templateRegistry: Record<
  EmailTemplateName,
  (props: AnyProps) => ReactElement
> = {
  "approval-request": (props) => ApprovalRequestEmail(props),
  "approval-reminder": (props) => ApprovalReminderEmail(props),
  "preparer-approved": (props) => PreparerApprovedEmail(props),
  "document-rejected": (props) => DocumentRejectedEmail(props),
  "document-approved": (props) => DocumentApprovedEmail(props),
  "document-revised": (props) => DocumentRevisedEmail(props),
  "document-cancelled": (props) => DocumentCancelledEmail(props),
  "read-assignment": (props) => ReadAssignmentEmail(props),
  "document-distributed": (props) => DocumentDistributedEmail(props),
  "read-reminder": (props) => ReadReminderEmail(props),
  "escalation-notice": (props) => EscalationNoticeEmail(props),
  welcome: (props) => WelcomeEmail(props),
};

export function resolveTemplate(
  name: EmailTemplateName,
  props: Record<string, unknown>,
): ReactElement {
  const factory = templateRegistry[name];
  return factory(props);
}
