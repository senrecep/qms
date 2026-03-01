"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod/v4";
import { zodResolver } from "@hookform/resolvers/zod";
import { reviseDocument } from "@/actions/documents";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { StatusBadge } from "./status-badge";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, FileText, X, Save, Send, AlertTriangle } from "lucide-react";

type Department = { id: string; name: string };
type Approver = { id: string; name: string; role: string; departmentName: string | null };
type UserItem = { id: string; name: string; email: string; role: string; departmentId: string | null; departmentName: string | null };

type CurrentRevision = {
  id: string;
  revisionNo: number;
  title: string;
  description: string | null;
  documentType: string;
  status: string;
  departmentId: string;
  preparerId: string;
  approverId: string | null;
  fileName: string;
  distributionDepartmentIds: string[];
  distributionUserIds: string[];
};

type RevisionFormProps = {
  documentId: string;
  currentRevision: CurrentRevision;
  departments: Department[];
  approvers: Approver[];
  allUsers: UserItem[];
  currentUserId: string;
};

const revisionSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  documentType: z.enum(["PROCEDURE", "INSTRUCTION", "FORM"]),
  departmentId: z.string().min(1, "Department is required"),
  preparerId: z.string().min(1, "Preparer is required"),
  approverId: z.string().optional(),
  distributionDepartmentIds: z.array(z.string()).optional(),
  distributionUserIds: z.array(z.string()).optional(),
  changes: z.string().optional(),
});

type RevisionFormValues = z.infer<typeof revisionSchema>;

const ERROR_CODE_MAP: Record<string, string> = {
  DOCUMENT_CODE_EXISTS: "documents.upload.errors.documentCodeExists",
  FILE_TOO_LARGE: "documents.upload.errors.fileTooLarge",
  FILE_REQUIRED: "documents.upload.errors.fileRequired",
  FILE_SYSTEM_ERROR: "documents.upload.errors.fileSystemError",
  DISK_FULL: "documents.upload.errors.diskFull",
  DOCUMENT_NOT_FOUND: "documents.upload.errors.documentNotFound",
  REVISION_NOT_DRAFT: "documents.upload.errors.revisionNotDraft",
};

function getRevisionErrorMessage(
  t: ReturnType<typeof useTranslations>,
  errorCode?: string,
  maxSize?: number,
): string {
  if (errorCode && ERROR_CODE_MAP[errorCode]) {
    return t(ERROR_CODE_MAP[errorCode] as never, { maxSize: maxSize ?? 500 } as never);
  }
  return t("documents.upload.errors.unexpectedError");
}

export function RevisionForm({
  documentId,
  currentRevision,
  departments,
  approvers,
  allUsers,
  currentUserId,
}: RevisionFormProps) {
  const t = useTranslations();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDraftOverwrite = currentRevision.status === "DRAFT";

  const form = useForm<RevisionFormValues>({
    resolver: zodResolver(revisionSchema) as never,
    defaultValues: {
      title: currentRevision.title,
      description: currentRevision.description ?? "",
      documentType: currentRevision.documentType as "PROCEDURE" | "INSTRUCTION" | "FORM",
      departmentId: currentRevision.departmentId,
      preparerId: currentRevision.preparerId,
      approverId: currentRevision.approverId ?? "",
      distributionDepartmentIds: currentRevision.distributionDepartmentIds,
      distributionUserIds: currentRevision.distributionUserIds,
      changes: "",
    },
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const doSubmit = async (values: RevisionFormValues, action: "save" | "submit") => {
    if (!file) {
      toast.error(t("documents.toast.fileRequired"));
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("documentId", documentId);
      formData.set("title", values.title);
      if (values.description) formData.set("description", values.description);
      formData.set("documentType", values.documentType);
      formData.set("departmentId", values.departmentId);
      formData.set("preparerId", values.preparerId);
      if (values.approverId) formData.set("approverId", values.approverId);
      if (values.distributionDepartmentIds?.length) {
        formData.set("distributionDepartmentIds", values.distributionDepartmentIds.join(","));
      }
      if (values.distributionUserIds?.length) {
        formData.set("distributionUserIds", values.distributionUserIds.join(","));
      }
      if (values.changes) formData.set("changes", values.changes);
      formData.set("action", action);
      formData.set("file", file);

      const result = await reviseDocument(formData);
      if (result.success && "revisionNo" in result) {
        toast.success(t("documents.toast.revisionCreated", { revNo: result.revisionNo as number }));
        router.push(`/documents/${documentId}`);
      } else {
        const errorCode = "errorCode" in result ? (result as { errorCode?: string }).errorCode : undefined;
        const maxSize = "maxSize" in result ? (result as { maxSize?: number }).maxSize : undefined;
        toast.error(getRevisionErrorMessage(t, errorCode, maxSize));
      }
    } catch {
      toast.error(t("documents.upload.errors.unexpectedError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSave = form.handleSubmit((values) => doSubmit(values, "save"));
  const handleSubmitForApproval = form.handleSubmit((values) => doSubmit(values, "submit"));

  const toggleDistributionDept = (deptId: string) => {
    const current = form.getValues("distributionDepartmentIds") ?? [];
    if (current.includes(deptId)) {
      form.setValue("distributionDepartmentIds", current.filter((id) => id !== deptId));
    } else {
      form.setValue("distributionDepartmentIds", [...current, deptId]);
    }
  };

  const selectedDistDepts = form.watch("distributionDepartmentIds") ?? [];

  const toggleDistributionUser = (userId: string) => {
    const current = form.getValues("distributionUserIds") ?? [];
    if (current.includes(userId)) {
      form.setValue("distributionUserIds", current.filter((id) => id !== userId));
    } else {
      form.setValue("distributionUserIds", [...current, userId]);
    }
  };

  const selectedDistUsers = form.watch("distributionUserIds") ?? [];
  const [userSearch, setUserSearch] = useState("");

  const roleOrder: Record<string, number> = { ADMIN: 0, MANAGER: 1, USER: 2 };

  const filteredUsers = allUsers
    .filter(
      (u) =>
        u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(userSearch.toLowerCase()),
    )
    .sort((a, b) => (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9));

  return (
    <Form {...form}>
      <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
        {/* Current revision info */}
        <div className="rounded-lg border p-3 sm:p-4">
          <div className="flex items-center gap-3">
            <p className="text-sm">
              {t("documents.detail.currentRevision")}:{" "}
              <span className="font-medium">
                Rev.{String(currentRevision.revisionNo).padStart(2, "0")}
              </span>
            </p>
            <StatusBadge status={currentRevision.status} />
          </div>
          {!isDraftOverwrite && (
            <p className="text-muted-foreground mt-1 text-sm">
              {t("documents.detail.newRevision")}:{" "}
              <span className="font-medium">
                Rev.{String(currentRevision.revisionNo + 1).padStart(2, "0")}
              </span>
            </p>
          )}
        </div>

        {isDraftOverwrite && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertDescription>
              {t("documents.form.overwriteWarning")}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("documents.form.documentName")}</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="documentType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("documents.form.selectType")}</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("documents.form.selectType")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="PROCEDURE">{t("documents.type.procedure")}</SelectItem>
                    <SelectItem value="INSTRUCTION">{t("documents.type.instruction")}</SelectItem>
                    <SelectItem value="FORM">{t("documents.type.form")}</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>{t("common.labels.description")}</FormLabel>
                <FormControl>
                  <Textarea {...field} rows={3} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="departmentId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("documents.form.selectDepartment")}</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("documents.form.selectDepartment")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="preparerId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("documents.form.preparer")}</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("documents.form.selectPreparer")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {allUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}{user.departmentName ? ` - ${user.departmentName}` : ""} ({user.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="approverId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("documents.form.selectApprover")}</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("documents.form.selectApprover")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {approvers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}{user.departmentName ? ` - ${user.departmentName}` : ""} ({user.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Distribution List - Multi-select using buttons */}
        <div className="space-y-2">
          <label className="text-sm font-medium">{t("documents.form.distributionList")}</label>
          <div className="flex flex-wrap gap-2">
            {departments.map((dept) => (
              <Button
                key={dept.id}
                type="button"
                variant={selectedDistDepts.includes(dept.id) ? "default" : "outline"}
                size="sm"
                onClick={() => toggleDistributionDept(dept.id)}
              >
                {dept.name}
                {selectedDistDepts.includes(dept.id) && <X className="ml-1 size-3" />}
              </Button>
            ))}
          </div>
        </div>

        {/* Distribution Users */}
        <div className="space-y-2">
          <label className="text-sm font-medium">{t("documents.form.distributionUsers")}</label>
          <Input
            placeholder={t("documents.form.searchUsers")}
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            className="mb-2"
          />
          {selectedDistUsers.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {selectedDistUsers.map((uid) => {
                const user = allUsers.find((u) => u.id === uid);
                return user ? (
                  <Button
                    key={uid}
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={() => toggleDistributionUser(uid)}
                  >
                    {user.name} <X className="ml-1 size-3" />
                  </Button>
                ) : null;
              })}
            </div>
          )}
          <div className="max-h-48 overflow-y-auto rounded-md border">
            {filteredUsers.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">{t("common.labels.noResults")}</p>
            ) : (
              filteredUsers.map((user, idx) => (
                <div key={user.id}>
                  {(idx === 0 || filteredUsers[idx - 1].role !== user.role) && (
                    <div className="sticky top-0 bg-muted/80 px-3 py-1.5 text-xs font-semibold text-muted-foreground backdrop-blur-sm">
                      {user.role}
                    </div>
                  )}
                  <button
                    type="button"
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
                      selectedDistUsers.includes(user.id) ? "bg-primary/10" : ""
                    }`}
                    onClick={() => toggleDistributionUser(user.id)}
                  >
                    <div>
                      <span className="font-medium">{user.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {user.email}{user.departmentName ? ` · ${user.departmentName}` : ""}
                      </span>
                    </div>
                    {selectedDistUsers.includes(user.id) && (
                      <span className="text-xs text-primary">&#10003;</span>
                    )}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* File Upload */}
        <div className="space-y-2">
          <label className="text-sm font-medium">{t("documents.form.uploadFile")}</label>
          <div
            className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 sm:p-8 transition-colors ${
              dragActive
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            {file ? (
              <div className="flex items-center gap-2">
                <FileText className="text-primary size-6" />
                <span className="text-sm font-medium">{file.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="size-6 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ) : (
              <>
                <Upload className="text-muted-foreground mb-2 size-8" />
                <p className="text-muted-foreground text-sm">{t("documents.upload.dragDrop")}</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {t("documents.detail.currentRevision")}: {currentRevision.fileName}
                </p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) setFile(e.target.files[0]);
              }}
            />
          </div>
        </div>

        {/* Revision Notes */}
        <FormField
          control={form.control}
          name="changes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("documents.form.changes")}</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  rows={3}
                  placeholder={t("documents.detail.revisionChangesPlaceholder")}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            {t("common.actions.cancel")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={isSubmitting || !file}
            onClick={handleSave}
            className="gap-1"
          >
            <Save className="size-4" />
            {t("documents.form.saveAsDraft")}
          </Button>
          <Button
            type="button"
            disabled={isSubmitting || !file}
            onClick={handleSubmitForApproval}
            className="gap-1"
          >
            <Send className="size-4" />
            {t("documents.form.submitForApproval")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
