"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { updateUser, getDepartmentsList } from "@/actions/users";
import { Pencil } from "lucide-react";

type User = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MANAGER" | "USER";
  departmentIds: string[];
  isActive: boolean;
};

const ERROR_CODE_MAP: Record<string, string> = {
  EMAIL_EXISTS: "emailExists",
  MANAGER_NEEDS_DEPARTMENT: "managerNeedsDepartment",
  USER_NEEDS_ONE_DEPARTMENT: "userNeedsOneDepartment",
  UNAUTHORIZED: "unauthorized",
  FORBIDDEN: "forbidden",
  DUPLICATE_ENTRY: "duplicateEntry",
  REFERENCE_ERROR: "referenceError",
  UNEXPECTED_ERROR: "unexpectedError",
};

export function EditUserDialog({ user }: { user: User }) {
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

  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState(user.role);
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>(user.departmentIds);
  const [isActive, setIsActive] = useState(user.isActive);

  useEffect(() => {
    if (open) {
      getDepartmentsList().then(setDepartments);
    }
  }, [open]);

  function handleRoleChange(newRole: "ADMIN" | "MANAGER" | "USER") {
    setRole(newRole);
    // Reset department selection when role changes
    setSelectedDepartmentIds([]);
  }

  function toggleDepartment(deptId: string) {
    if (role === "USER") {
      setSelectedDepartmentIds([deptId]);
    } else {
      setSelectedDepartmentIds((prev) =>
        prev.includes(deptId)
          ? prev.filter((id) => id !== deptId)
          : [...prev, deptId]
      );
    }
  }

  function resetForm() {
    setName(user.name);
    setEmail(user.email);
    setRole(user.role);
    setSelectedDepartmentIds(user.departmentIds);
    setIsActive(user.isActive);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await updateUser(user.id, {
        name,
        email,
        role,
        departmentIds: selectedDepartmentIds,
        isActive,
      });

      if (!result.success) {
        const key = ERROR_CODE_MAP[result.errorCode] ?? "unexpectedError";
        setError(tErrors(key));
      } else {
        setOpen(false);
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
        <Button variant="ghost" size="icon">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {tCommon("actions.edit")} - {user.name}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`edit-name-${user.id}`}>
              {tCommon("labels.name")}
            </Label>
            <Input
              id={`edit-name-${user.id}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`edit-email-${user.id}`}>
              {tCommon("labels.email")}
            </Label>
            <Input
              id={`edit-email-${user.id}`}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>{t("roles")}</Label>
            <Select value={role} onValueChange={(v) => handleRoleChange(v as "ADMIN" | "MANAGER" | "USER")}>
              <SelectTrigger>
                <SelectValue placeholder="-" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USER">{t("roleUser")}</SelectItem>
                <SelectItem value="MANAGER">{t("roleManager")}</SelectItem>
                <SelectItem value="ADMIN">{t("roleAdmin")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Department selection - conditional on role */}
          {role !== "ADMIN" && (
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

          <div className="flex items-center justify-between">
            <Label htmlFor={`edit-active-${user.id}`}>
              {tCommon("labels.status")}
            </Label>
            <Switch
              id={`edit-active-${user.id}`}
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>

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
              {loading ? tCommon("status.loading") : tCommon("actions.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
