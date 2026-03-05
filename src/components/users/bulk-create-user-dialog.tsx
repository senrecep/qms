"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { bulkCreateUsers, getDepartmentsList } from "@/actions/users";
import { Plus, Trash2, Users, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "MANAGER" | "USER";
  departmentIds: string[];
  result?: { success: boolean; error?: string };
};

function createEmptyRow(): UserRow {
  return {
    id: crypto.randomUUID(),
    name: "",
    email: "",
    role: "USER",
    departmentIds: [],
  };
}

export function BulkCreateUserDialog() {
  const t = useTranslations("settings.users");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [rows, setRows] = useState<UserRow[]>([createEmptyRow(), createEmptyRow(), createEmptyRow()]);

  useEffect(() => {
    if (open) {
      getDepartmentsList().then(setDepartments);
    }
  }, [open]);

  function addRow() {
    setRows((prev) => [...prev, createEmptyRow()]);
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function updateRow(id: string, field: keyof UserRow, value: string | string[]) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        if (field === "role") {
          return { ...r, role: value as "MANAGER" | "USER", departmentIds: [] };
        }
        return { ...r, [field]: value };
      })
    );
  }

  function toggleDepartment(rowId: string, deptId: string, role: "MANAGER" | "USER") {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        if (role === "USER") {
          return { ...r, departmentIds: [deptId] };
        }
        const newIds = r.departmentIds.includes(deptId)
          ? r.departmentIds.filter((id) => id !== deptId)
          : [...r.departmentIds, deptId];
        return { ...r, departmentIds: newIds };
      })
    );
  }

  function resetForm() {
    setRows([createEmptyRow(), createEmptyRow(), createEmptyRow()]);
    setSubmitted(false);
  }

  async function handleSubmit() {
    const validRows = rows.filter((r) => r.name.trim() && r.email.trim());
    if (validRows.length === 0) {
      toast.error(t("bulk.emptyRows"));
      return;
    }

    setLoading(true);
    try {
      const result = await bulkCreateUsers(
        validRows.map((r) => ({
          name: r.name.trim(),
          email: r.email.trim(),
          role: r.role,
          departmentIds: r.departmentIds.length > 0 ? r.departmentIds : undefined,
        }))
      );

      setRows((prev) =>
        prev.map((row) => {
          const res = result.results.find((r) => r.email === row.email.trim());
          if (res) {
            return { ...row, result: { success: res.success, error: res.error } };
          }
          return row;
        })
      );

      setSubmitted(true);

      const successCount = result.results.filter((r) => r.success).length;
      const failedCount = result.results.filter((r) => !r.success).length;

      if (failedCount === 0) {
        toast.success(t("bulk.resultSuccess", { count: successCount }));
      } else if (successCount > 0) {
        toast.warning(t("bulk.resultPartial", { success: successCount, failed: failedCount }));
      } else {
        toast.error(t("bulk.resultFailed"));
      }

      router.refresh();
    } catch {
      toast.error(tErrors("unexpectedError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetForm();
      }}
    >
      <SheetTrigger asChild>
        <Button variant="outline">
          <Users className="mr-2 h-4 w-4" />
          {t("bulkAdd")}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[85dvh] flex flex-col px-4 md:px-6">
        <SheetHeader>
          <SheetTitle>{t("bulk.title")}</SheetTitle>
          <SheetDescription>{t("bulk.subtitle")}</SheetDescription>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1 mt-2 md:mt-4">
          <div className="space-y-2 md:space-y-3 px-1 pb-2">
            {rows.map((row, idx) => (
              <div
                key={row.id}
                className={`flex flex-col gap-1.5 p-2.5 rounded-lg border md:grid md:grid-cols-[1fr_1.5fr_120px_1fr_40px] md:gap-3 md:p-3 md:items-start ${
                  row.result
                    ? row.result.success
                      ? "border-green-200 bg-green-50"
                      : "border-red-200 bg-red-50"
                    : "border-border"
                }`}
              >
                {/* Name */}
                <div>
                  {idx === 0 && (
                    <Label className="mb-1 block text-xs text-muted-foreground">
                      {t("bulk.name")}
                    </Label>
                  )}
                  <Input
                    placeholder={t("bulk.name")}
                    value={row.name}
                    onChange={(e) => updateRow(row.id, "name", e.target.value)}
                    disabled={loading || (submitted && row.result?.success)}
                  />
                </div>

                {/* Email */}
                <div>
                  {idx === 0 && (
                    <Label className="mb-1 block text-xs text-muted-foreground">
                      {t("bulk.email")}
                    </Label>
                  )}
                  <Input
                    type="email"
                    placeholder={t("bulk.email")}
                    value={row.email}
                    onChange={(e) => updateRow(row.id, "email", e.target.value)}
                    disabled={loading || (submitted && row.result?.success)}
                  />
                </div>

                {/* Role + Department + Delete: row on mobile, grid cells on desktop */}
                <div className="flex items-end gap-2 md:contents">
                  {/* Role */}
                  <div className="w-[120px] shrink-0 md:w-auto">
                    {idx === 0 && (
                      <Label className="mb-1 block text-xs text-muted-foreground">
                        {t("bulk.role")}
                      </Label>
                    )}
                    <Select
                      value={row.role}
                      onValueChange={(v) => updateRow(row.id, "role", v)}
                      disabled={loading || (submitted && row.result?.success)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USER">{t("roleUser")}</SelectItem>
                        <SelectItem value="MANAGER">{t("roleManager")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Department */}
                  <div className="min-w-0 flex-1 md:flex-none">
                    {idx === 0 && (
                      <Label className="mb-1 block text-xs text-muted-foreground">
                        {t("bulk.department")}
                      </Label>
                    )}
                    {row.role === "USER" ? (
                      <Select
                        value={row.departmentIds[0] ?? ""}
                        onValueChange={(v) => updateRow(row.id, "departmentIds", [v])}
                        disabled={loading || (submitted && row.result?.success)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t("bulk.selectDepartment")} />
                        </SelectTrigger>
                        <SelectContent>
                          {departments.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="space-y-1">
                        {row.departmentIds.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-1">
                            {row.departmentIds.map((id) => (
                              <Badge key={id} variant="secondary" className="text-xs">
                                {departments.find((d) => d.id === id)?.name}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <Select
                          value=""
                          onValueChange={(v) => toggleDepartment(row.id, v, row.role)}
                          disabled={loading || (submitted && row.result?.success)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t("bulk.selectDepartments")} />
                          </SelectTrigger>
                          <SelectContent>
                            {departments.map((d) => (
                              <SelectItem key={d.id} value={d.id}>
                                <span className="flex items-center gap-2">
                                  {row.departmentIds.includes(d.id) && (
                                    <CheckCircle2 className="size-3 text-green-500" />
                                  )}
                                  {d.name}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  {/* Actions / Status */}
                  <div className="flex shrink-0 items-center justify-center self-end pb-0.5 md:self-auto md:pb-0 md:pt-0.5">
                    {idx === 0 && <div className="hidden h-5 md:block" />}
                    {row.result ? (
                      row.result.success ? (
                        <CheckCircle2 className="size-5 text-green-600" />
                      ) : (
                        <div className="group relative">
                          <XCircle className="size-5 text-red-600" />
                          {row.result.error && (
                            <div className="absolute right-0 top-6 z-10 hidden group-hover:block w-48 p-2 text-xs bg-popover border rounded-md shadow-md">
                              {row.result.error}
                            </div>
                          )}
                        </div>
                      )
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeRow(row.id)}
                        disabled={loading || rows.length <= 1}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t mt-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addRow}
            disabled={loading || submitted}
          >
            <Plus className="mr-1 h-4 w-4" />
            {t("bulk.addRow")}
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              {tCommon("actions.cancel")}
            </Button>
            {submitted ? (
              <Button onClick={() => { resetForm(); }}>
                {tCommon("actions.create")}
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={loading || rows.every((r) => !r.name.trim() || !r.email.trim())}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("bulk.processing")}
                  </>
                ) : (
                  t("bulk.submit")
                )}
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
