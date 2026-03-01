"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { createUser, getDepartmentsList } from "@/actions/users";
import { Plus } from "lucide-react";

const ERROR_CODE_MAP: Record<string, string> = {
  EMAIL_EXISTS: "emailExists",
  USER_CREATE_FAILED: "userCreateFailed",
  MANAGER_NEEDS_DEPARTMENT: "managerNeedsDepartment",
  USER_NEEDS_ONE_DEPARTMENT: "userNeedsOneDepartment",
  UNAUTHORIZED: "unauthorized",
  FORBIDDEN: "forbidden",
  DUPLICATE_ENTRY: "duplicateEntry",
  REFERENCE_ERROR: "referenceError",
  UNEXPECTED_ERROR: "unexpectedError",
};

const ROLE_LABEL_MAP: Record<"ADMIN" | "MANAGER" | "USER", "roleAdmin" | "roleManager" | "roleUser"> = {
  ADMIN: "roleAdmin",
  MANAGER: "roleManager",
  USER: "roleUser",
};

type CreateUserDialogProps = {
  presetDepartmentId?: string;
  presetDepartmentName?: string;
  allowedRoles?: Array<"ADMIN" | "MANAGER" | "USER">;
  triggerLabel?: string;
};

export function CreateUserDialog({
  presetDepartmentId,
  presetDepartmentName,
  allowedRoles = ["USER", "MANAGER", "ADMIN"],
  triggerLabel,
}: CreateUserDialogProps) {
  const t = useTranslations("settings.users");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [departments, setDepartments] = useState<
    { id: string; name: string }[]
  >([]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const resolvedRoles = (allowedRoles.length > 0 ? allowedRoles : ["USER"]) as Array<
    "ADMIN" | "MANAGER" | "USER"
  >;
  const [role, setRole] = useState<"ADMIN" | "MANAGER" | "USER">(
    resolvedRoles.includes("USER") ? "USER" : resolvedRoles[0],
  );
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>(
    presetDepartmentId ? [presetDepartmentId] : [],
  );

  useEffect(() => {
    if (open) {
      if (!presetDepartmentId) {
        getDepartmentsList().then(setDepartments);
      }
    }
  }, [open, presetDepartmentId]);

  function handleRoleChange(newRole: "ADMIN" | "MANAGER" | "USER") {
    setRole(newRole);
    // Reset department selection when role changes
    setSelectedDepartmentIds(presetDepartmentId ? [presetDepartmentId] : []);
  }

  function toggleDepartment(deptId: string) {
    if (role === "USER") {
      // USER can only have one department - replace selection
      setSelectedDepartmentIds([deptId]);
    } else {
      // MANAGER can have multiple
      setSelectedDepartmentIds((prev) =>
        prev.includes(deptId)
          ? prev.filter((id) => id !== deptId)
          : [...prev, deptId]
      );
    }
  }

  function resetForm() {
    setName("");
    setEmail("");
    setRole(resolvedRoles.includes("USER") ? "USER" : resolvedRoles[0]);
    setSelectedDepartmentIds(presetDepartmentId ? [presetDepartmentId] : []);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const finalDepartmentIds = presetDepartmentId
        ? [presetDepartmentId]
        : selectedDepartmentIds;

      const result = await createUser({
        name,
        email,
        role,
        departmentIds: finalDepartmentIds.length > 0 ? finalDepartmentIds : undefined,
      });

      if (!result.success) {
        const key = ERROR_CODE_MAP[result.errorCode] ?? "unexpectedError";
        setError(tErrors(key));
      } else {
        setOpen(false);
        resetForm();
        router.refresh();
      }
    } catch {
      setError(tErrors("unexpectedError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {triggerLabel ?? t("addUser")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("addUser")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="user-name">{tCommon("labels.name")}</Label>
            <Input
              id="user-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-email">{tCommon("labels.email")}</Label>
            <Input
              id="user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              {t("passwordResetNote")}
            </p>
          </div>
          {resolvedRoles.length > 1 ? (
            <div className="space-y-2">
              <Label>{t("roles")}</Label>
              <Select
                value={role}
                onValueChange={(v) => handleRoleChange(v as "ADMIN" | "MANAGER" | "USER")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {resolvedRoles.includes("USER") && (
                    <SelectItem value="USER">{t("roleUser")}</SelectItem>
                  )}
                  {resolvedRoles.includes("MANAGER") && (
                    <SelectItem value="MANAGER">{t("roleManager")}</SelectItem>
                  )}
                  {resolvedRoles.includes("ADMIN") && (
                    <SelectItem value="ADMIN">{t("roleAdmin")}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>{t("roles")}</Label>
              <div className="text-sm text-muted-foreground">
                {t(ROLE_LABEL_MAP[resolvedRoles[0]])}
              </div>
            </div>
          )}

          {/* Department selection - conditional on role */}
          {role !== "ADMIN" && !presetDepartmentId && (
            <div className="space-y-2">
              <Label>
                {tCommon("labels.department")}
                {role === "MANAGER" && (
                  <span className="text-xs text-muted-foreground ml-1">
                    ({t("multiSelect")})
                  </span>
                )}
              </Label>
              {role === "USER" ? (
                <Select
                  value={selectedDepartmentIds[0] ?? ""}
                  onValueChange={(v) => setSelectedDepartmentIds([v])}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="-" />
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
                <div className="max-h-40 overflow-y-auto rounded-md border p-2 space-y-2">
                  {departments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">-</p>
                  ) : (
                    departments.map((d) => (
                      <label
                        key={d.id}
                        className="flex items-center gap-2 cursor-pointer text-sm"
                      >
                        <Checkbox
                          checked={selectedDepartmentIds.includes(d.id)}
                          onCheckedChange={() => toggleDepartment(d.id)}
                        />
                        {d.name}
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
          {presetDepartmentId && (
            <div className="space-y-2">
              <Label>{tCommon("labels.department")}</Label>
              <div className="text-sm text-muted-foreground">
                {presetDepartmentName ?? "-"}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              {tCommon("actions.cancel")}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? tCommon("status.loading") : tCommon("actions.create")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
