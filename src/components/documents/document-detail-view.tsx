"use client";

import type { DocumentDetail } from "@/actions/documents";
import { cancelDocument, publishDocument, submitForApproval } from "@/actions/documents";
import { StatusBadge } from "./status-badge";
import { ReadStatusIndicator } from "./read-status-indicator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { useState } from "react";
import {
  FileText,
  User,
  Building2,
  Calendar,
  ArrowLeft,
  Ban,
  Send,
  Pencil,
  Download,
  BookOpenCheck,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";

type Props = {
  document: DocumentDetail;
};

const statusTimelineColors: Record<string, string> = {
  DRAFT: "bg-gray-400",
  PENDING_APPROVAL: "bg-amber-400",
  PREPARER_APPROVED: "bg-indigo-400",
  APPROVED: "bg-green-400",
  PUBLISHED: "bg-primary",
  PREPARER_REJECTED: "bg-red-400",
  APPROVER_REJECTED: "bg-red-400",
  CANCELLED: "bg-red-400",
};

const ACTION_KEY_MAP: Record<string, string> = {
  UPLOADED: "uploaded",
  SUBMITTED: "submitted",
  APPROVED: "approved",
  PREPARER_APPROVED: "preparerApproved",
  PREPARER_REJECTED: "preparerRejected",
  APPROVER_REJECTED: "approverRejected",
  REJECTED: "rejected",
  READ: "read",
  REVISED: "revised",
  PUBLISHED: "published",
  CANCELLED: "cancelled",
};

export function DocumentDetailView({ document: doc }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  // Current revision is the first in the list (ordered by revisionNo DESC)
  const currentRevision = doc.revisions[0];

  const handleCancel = async () => {
    setIsLoading(true);
    try {
      await cancelDocument(doc.id);
      toast.success(t("documents.toast.cancelled"));
      router.refresh();
    } catch {
      toast.error(t("documents.toast.cancelFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!currentRevision) return;
    setIsLoading(true);
    try {
      await publishDocument(currentRevision.id);
      toast.success(t("documents.toast.published"));
      router.refresh();
    } catch {
      toast.error(t("documents.toast.publishFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitForApproval = async () => {
    if (!currentRevision) return;
    setIsLoading(true);
    try {
      await submitForApproval(currentRevision.id);
      toast.success(t("documents.form.submitForApproval"));
      router.refresh();
    } catch {
      toast.error(t("documents.toast.revisionFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  // Derive current revision data
  const title = currentRevision?.title ?? "";
  const status = currentRevision?.status ?? "DRAFT";
  const description = currentRevision?.description;
  const departmentName = currentRevision?.department?.name ?? "";
  const preparerName = currentRevision?.preparer?.name ?? "";
  const approverName = currentRevision?.approver?.name ?? "";

  // Read confirmations from current revision
  const readConfirmations = currentRevision?.readConfirmations ?? [];
  const readConfirmed = readConfirmations.filter((rc) => rc.confirmedAt !== null).length;
  const readTotal = readConfirmations.length;

  // Current distribution
  const currentDistLists = currentRevision?.distributionLists ?? [];
  const currentDistUsers = currentRevision?.distributionUsers ?? [];

  // Find rejection reason from current revision approvals
  const rejectedApproval = currentRevision?.approvals?.find((a) => a.status === "REJECTED");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="size-4" />
            </Button>
            <h2 className="text-xl font-semibold truncate max-w-[200px] sm:max-w-[400px]">{title}</h2>
            <StatusBadge status={status} />
          </div>
          <p className="text-muted-foreground ml-10 text-sm">
            {doc.documentCode} &middot; Rev.{String(doc.currentRevisionNo).padStart(2, "0")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {currentRevision && (
            <Button asChild size="sm" variant="outline" className="gap-1">
              <a
                href={`/api/files/${currentRevision.filePath}`}
                download={currentRevision.fileName}
              >
                <Download className="size-4" />
                {t("common.actions.download")}
              </a>
            </Button>
          )}

          {/* DRAFT: Submit + Edit */}
          {status === "DRAFT" && (
            <>
              <Button
                size="sm"
                onClick={handleSubmitForApproval}
                disabled={isLoading}
                className="gap-1"
              >
                <Send className="size-4" />
                {t("documents.form.submitForApproval")}
              </Button>
              <Button asChild size="sm" variant="outline" className="gap-1">
                <Link href={`/documents/${doc.id}/revise`}>
                  <Pencil className="size-4" />
                  {t("common.actions.edit")}
                </Link>
              </Button>
            </>
          )}

          {/* APPROVED: Publish + Revise */}
          {status === "APPROVED" && (
            <>
              <Button size="sm" onClick={handlePublish} disabled={isLoading} className="gap-1">
                <Send className="size-4" />
                {t("documents.actions.publish")}
              </Button>
              <Button asChild size="sm" variant="outline" className="gap-1">
                <Link href={`/documents/${doc.id}/revise`}>
                  <Pencil className="size-4" />
                  {t("documents.actions.revise")}
                </Link>
              </Button>
            </>
          )}

          {/* PUBLISHED: Revise only */}
          {status === "PUBLISHED" && (
            <Button asChild size="sm" variant="outline" className="gap-1">
              <Link href={`/documents/${doc.id}/revise`}>
                <Pencil className="size-4" />
                {t("documents.actions.revise")}
              </Link>
            </Button>
          )}

          {/* REJECTED statuses: New Revision */}
          {(status === "PREPARER_REJECTED" || status === "APPROVER_REJECTED") && (
            <Button asChild size="sm" className="gap-1">
              <Link href={`/documents/${doc.id}/revise`}>
                <Pencil className="size-4" />
                {t("documents.detail.newRevision")}
              </Link>
            </Button>
          )}

          {/* Cancel button for non-terminal statuses */}
          {status !== "CANCELLED" && status !== "PUBLISHED" && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleCancel}
              disabled={isLoading}
              className="gap-1"
            >
              <Ban className="size-4" />
              {t("documents.actions.cancel")}
            </Button>
          )}
        </div>
      </div>

      {/* Status info banners */}
      {status === "PENDING_APPROVAL" && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-center gap-3 p-4">
            <Clock className="size-5 text-amber-600" />
            <p className="text-sm text-amber-800">
              {currentRevision?.approvals?.some((a) => a.approvalType === "PREPARER" && a.status === "PENDING")
                ? t("documents.detail.waitingForPreparer")
                : t("documents.detail.waitingForApprover")}
              {" - "}
              {currentRevision?.approvals
                ?.filter((a) => a.status === "PENDING")
                .map((a) => a.approver?.name)
                .join(", ")}
            </p>
          </CardContent>
        </Card>
      )}

      {status === "PREPARER_APPROVED" && (
        <Card className="border-indigo-200 bg-indigo-50">
          <CardContent className="flex items-center gap-3 p-4">
            <Clock className="size-5 text-indigo-600" />
            <p className="text-sm text-indigo-800">
              {t("documents.detail.waitingForApprover")}
              {approverName && ` - ${approverName}`}
            </p>
          </CardContent>
        </Card>
      )}

      {(status === "PREPARER_REJECTED" || status === "APPROVER_REJECTED") && rejectedApproval && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 p-4">
            <XCircle className="size-5 text-red-600" />
            <div>
              <p className="text-sm font-medium text-red-800">
                {t("documents.detail.rejectionReason")}
              </p>
              <p className="text-sm text-red-700">{rejectedApproval.comment}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info cards */}
      <div className={`grid gap-4 sm:grid-cols-2 ${status === "PUBLISHED" && readTotal > 0 ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Building2 className="text-muted-foreground size-5" />
            <div>
              <p className="text-muted-foreground text-xs">{t("common.labels.department")}</p>
              <p className="text-sm font-medium">{departmentName}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <User className="text-muted-foreground size-5" />
            <div>
              <p className="text-muted-foreground text-xs">{t("documents.detail.preparer")}</p>
              <p className="text-sm font-medium">{preparerName}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <User className="text-muted-foreground size-5" />
            <div>
              <p className="text-muted-foreground text-xs">{t("documents.detail.approver")}</p>
              <p className="text-sm font-medium">{approverName || "-"}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Calendar className="text-muted-foreground size-5" />
            <div>
              <p className="text-muted-foreground text-xs">{t("common.labels.createdAt")}</p>
              <p className="text-sm font-medium">{format(doc.createdAt, "dd.MM.yyyy HH:mm")}</p>
            </div>
          </CardContent>
        </Card>
        {status === "PUBLISHED" && readTotal > 0 && (
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <BookOpenCheck className={`size-5 ${readConfirmed === readTotal ? "text-green-600" : readConfirmed > 0 ? "text-amber-500" : "text-red-500"}`} />
              <div>
                <p className="text-muted-foreground text-xs">{t("common.labels.readStatus")}</p>
                <p className={`text-sm font-medium ${readConfirmed === readTotal ? "text-green-600" : readConfirmed > 0 ? "text-amber-500" : "text-red-500"}`}>
                  {readConfirmed}/{readTotal}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {description && (
        <Card>
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs mb-1">{t("common.labels.description")}</p>
            <p className="text-sm">{description}</p>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="revisions">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="revisions">{t("documents.detail.revisionHistory")}</TabsTrigger>
          <TabsTrigger value="distribution">{t("documents.detail.distributionStatus")}</TabsTrigger>
          <TabsTrigger value="activity">{t("documents.detail.activityLog")}</TabsTrigger>
        </TabsList>

        {/* Revisions Tab - Accordion + Timeline */}
        <TabsContent value="revisions">
          <Card>
            <CardContent className="pt-6">
              {doc.revisions.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t("documents.detail.noRevisions")}</p>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-border" />

                  <Accordion type="single" collapsible defaultValue={currentRevision?.id}>
                    {doc.revisions.map((rev) => (
                      <AccordionItem key={rev.id} value={rev.id} className="border-0">
                        <div className="relative flex items-start gap-4">
                          {/* Timeline dot */}
                          <div className={`relative z-10 mt-4 size-6 shrink-0 rounded-full border-2 border-background ${statusTimelineColors[rev.status] ?? "bg-gray-400"}`} />

                          <div className="flex-1 min-w-0">
                            <AccordionTrigger className="py-3 hover:no-underline">
                              <div className="flex flex-1 flex-wrap items-center gap-2 text-left sm:gap-3">
                                <span className="text-sm font-medium truncate max-w-[180px] sm:max-w-none">
                                  Rev.{String(rev.revisionNo).padStart(2, "0")} &mdash; {rev.title}
                                </span>
                                <StatusBadge status={rev.status} />
                                <span className="text-muted-foreground text-xs hidden sm:inline">
                                  {format(rev.createdAt, "dd.MM.yyyy HH:mm")}
                                </span>
                              </div>
                            </AccordionTrigger>

                            <AccordionContent>
                              <div className="space-y-4 pb-4">
                                {/* People info */}
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <div className="flex items-center gap-2 text-sm">
                                    <User className="text-muted-foreground size-4" />
                                    <span className="text-muted-foreground">{t("documents.detail.preparer")}:</span>
                                    <span className="font-medium">{rev.preparer?.name ?? "-"}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-sm">
                                    <User className="text-muted-foreground size-4" />
                                    <span className="text-muted-foreground">{t("documents.detail.approver")}:</span>
                                    <span className="font-medium">{rev.approver?.name ?? "-"}</span>
                                  </div>
                                </div>

                                {/* File info + download */}
                                <div className="flex items-center gap-3">
                                  <FileText className="text-muted-foreground size-4" />
                                  <span className="text-sm truncate max-w-[150px] sm:max-w-[300px]">{rev.fileName}</span>
                                  {rev.fileSize && (
                                    <span className="text-muted-foreground text-xs">
                                      ({(rev.fileSize / 1024).toFixed(1)} KB)
                                    </span>
                                  )}
                                  <a
                                    href={`/api/files/${rev.filePath}`}
                                    download={rev.fileName}
                                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted transition-colors"
                                  >
                                    <Download className="size-3" />
                                    {t("common.actions.download")}
                                  </a>
                                </div>

                                {/* Description */}
                                {rev.description && (
                                  <div>
                                    <p className="text-muted-foreground text-xs mb-1">{t("common.labels.description")}</p>
                                    <p className="text-sm">{rev.description}</p>
                                  </div>
                                )}

                                {/* Changes/notes */}
                                {rev.changes && (
                                  <div>
                                    <p className="text-muted-foreground text-xs mb-1">{t("documents.form.changes")}</p>
                                    <p className="text-sm">{rev.changes}</p>
                                  </div>
                                )}

                                {/* Approval history for this revision */}
                                {rev.approvals && rev.approvals.length > 0 && (
                                  <div>
                                    <Separator className="my-2" />
                                    <p className="text-sm font-medium mb-2">{t("documents.detail.approvalHistory")}</p>
                                    <div className="space-y-2">
                                      {rev.approvals.map((appr) => (
                                        <div key={appr.id} className="flex items-center gap-3 rounded border px-3 py-2">
                                          {appr.status === "APPROVED" ? (
                                            <CheckCircle2 className="size-4 text-green-600" />
                                          ) : appr.status === "REJECTED" ? (
                                            <XCircle className="size-4 text-red-600" />
                                          ) : (
                                            <AlertCircle className="size-4 text-amber-500" />
                                          )}
                                          <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                              <span className="text-sm font-medium">{appr.approver?.name ?? ""}</span>
                                              <Badge
                                                variant={
                                                  appr.status === "APPROVED"
                                                    ? "default"
                                                    : appr.status === "REJECTED"
                                                      ? "destructive"
                                                      : "secondary"
                                                }
                                                className="text-xs"
                                              >
                                                {t(`approvals.type.${appr.approvalType.toLowerCase()}`)} - {t(`approvals.status.${appr.status.toLowerCase()}`)}
                                              </Badge>
                                            </div>
                                            {appr.comment && <p className="text-muted-foreground text-xs mt-1">{appr.comment}</p>}
                                            {appr.respondedAt && (
                                              <p className="text-muted-foreground text-xs">
                                                {format(appr.respondedAt, "dd.MM.yyyy HH:mm")}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Read confirmations for PUBLISHED revision */}
                                {rev.status === "PUBLISHED" && rev.readConfirmations && rev.readConfirmations.length > 0 && (
                                  <div>
                                    <Separator className="my-2" />
                                    <p className="text-sm font-medium mb-2">{t("documents.detail.readConfirmations")}</p>
                                    <div className="space-y-1">
                                      {rev.readConfirmations.map((rc) => (
                                        <div key={rc.id} className="flex items-center justify-between rounded border px-3 py-2">
                                          <span className="text-sm">{rc.user?.name ?? ""}</span>
                                          {rc.confirmedAt ? (
                                            <span className="text-xs text-green-600">
                                              {t("readTasks.readAt")}: {format(rc.confirmedAt, "dd.MM.yyyy HH:mm")}
                                            </span>
                                          ) : (
                                            <span className="text-muted-foreground text-xs">{t("common.labels.notRead")}</span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Distribution for this revision */}
                                {(rev.distributionLists.length > 0 || rev.distributionUsers.length > 0) && (
                                  <div>
                                    <Separator className="my-2" />
                                    <p className="text-sm font-medium mb-2">{t("documents.detail.distributionStatus")}</p>
                                    <div className="flex flex-wrap gap-2">
                                      {rev.distributionLists.map((dl) => (
                                        <Badge key={dl.id} variant="outline">
                                          <Building2 className="mr-1 size-3" />
                                          {dl.department?.name ?? ""}
                                        </Badge>
                                      ))}
                                      {rev.distributionUsers.map((du) => (
                                        <Badge key={du.id} variant="outline">
                                          <User className="mr-1 size-3" />
                                          {du.user?.name ?? ""}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </AccordionContent>
                          </div>
                        </div>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Distribution Tab */}
        <TabsContent value="distribution">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{t("common.labels.readStatus")}:</span>
                  <ReadStatusIndicator confirmed={readConfirmed} total={readTotal} status={status} />
                </div>
                <Separator />
                <div>
                  <p className="mb-2 text-sm font-medium">{t("documents.detail.distributionDepartments")}</p>
                  {currentDistLists.length === 0 ? (
                    <p className="text-muted-foreground text-sm">{t("documents.detail.noDistribution")}</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {currentDistLists.map((dl) => (
                        <Badge key={dl.id} variant="outline">
                          <Building2 className="mr-1 size-3" />
                          {dl.department?.name ?? ""}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                {currentDistUsers.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <p className="mb-2 text-sm font-medium">{t("documents.detail.distributionUsers")}</p>
                      <div className="flex flex-wrap gap-2">
                        {currentDistUsers.map((du) => (
                          <Badge key={du.id} variant="outline">
                            <User className="mr-1 size-3" />
                            {du.user?.name ?? ""}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                {readConfirmations.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <p className="mb-2 text-sm font-medium">{t("documents.detail.readConfirmations")}</p>
                      <div className="space-y-2">
                        {readConfirmations.map((rc) => (
                          <div key={rc.id} className="flex items-center justify-between rounded border px-3 py-2">
                            <span className="text-sm">{rc.user?.name ?? ""}</span>
                            {rc.confirmedAt ? (
                              <span className="text-xs text-green-600">
                                {t("readTasks.readAt")}: {format(rc.confirmedAt, "dd.MM.yyyy HH:mm")}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">{t("common.labels.notRead")}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Log Tab */}
        <TabsContent value="activity">
          <Card>
            <CardContent className="pt-6">
              {doc.activityLogs.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t("documents.detail.noActivity")}</p>
              ) : (
                <div className="space-y-3">
                  {doc.activityLogs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 border-l-2 border-l-primary/20 pl-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {t(`documents.activity.${ACTION_KEY_MAP[log.action] ?? log.action.toLowerCase()}`)}
                          </Badge>
                          <span className="text-muted-foreground text-xs">
                            {format(log.createdAt, "dd.MM.yyyy HH:mm")}
                          </span>
                        </div>
                        <p className="text-muted-foreground mt-1 text-sm">
                          {t("common.labels.uploadedBy")}: {log.user?.name ?? ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
