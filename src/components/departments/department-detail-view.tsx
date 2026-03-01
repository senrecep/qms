"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EditDepartmentDialog } from "@/components/departments/edit-department-dialog";
import { CreateUserDialog } from "@/components/users/create-user-dialog";
import { ResetPasswordButton } from "@/components/users/reset-password-button";

type Manager = {
  id: string;
  name: string;
  email: string;
};

type Member = {
  id: string;
  name: string;
  email: string;
  role: "USER" | "MANAGER" | "ADMIN";
  isActive: boolean;
  memberRole: "MEMBER" | "MANAGER";
};

type Department = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  managers: Manager[];
  members: Member[];
};

const ROLE_TRANSLATION_KEY = {
  USER: "roleUser",
  MANAGER: "roleManager",
  ADMIN: "roleAdmin",
} as const;

export function DepartmentDetailView({
  department,
  canEditDepartment = false,
  editMode = "admin",
  canCreateUser = false,
  canResetPasswords = false,
  showReadOnlyNotice = false,
}: {
  department: Department;
  canEditDepartment?: boolean;
  editMode?: "admin" | "manager";
  canCreateUser?: boolean;
  canResetPasswords?: boolean;
  showReadOnlyNotice?: boolean;
}) {
  const t = useTranslations("departments.detail");
  const tCommon = useTranslations("common");
  const tUsers = useTranslations("settings.users");
  const tForm = useTranslations("departments.form");

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/departments">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("back")}
        </Link>
      </Button>

      {showReadOnlyNotice && (
        <div className="rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
          {tCommon("labels.readOnly") ?? "Read-only"}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle>{department.name}</CardTitle>
            {canEditDepartment && (
              <EditDepartmentDialog
                dept={{
                  id: department.id,
                  name: department.name,
                  slug: department.slug,
                  description: department.description,
                  isActive: department.isActive,
                  managerIds: department.managers.map((m) => m.id),
                }}
                mode={editMode}
              />
            )}
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Slug</p>
            <p className="text-sm">{department.slug}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {tForm("manager")}
            </p>
            {department.managers.length === 0 ? (
              <p className="text-sm mt-1">-</p>
            ) : (
              <div className="mt-2 space-y-2">
                {department.managers.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.email}</p>
                    </div>
                    <Badge variant="secondary">{tUsers("roleManager")}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {tCommon("labels.description")}
            </p>
            <p className="text-sm">{department.description || "-"}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {tCommon("labels.status")}
            </p>
            <Badge variant={department.isActive ? "default" : "secondary"}>
              {department.isActive
                ? tCommon("status.active")
                : tCommon("status.inactive")}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>{t("members")}</CardTitle>
              <span className="text-sm text-muted-foreground">
                {t("memberCount", { count: department.members.length })}
              </span>
            </div>
            {canCreateUser && (
              <CreateUserDialog
                presetDepartmentId={department.id}
                presetDepartmentName={department.name}
                allowedRoles={["USER", "MANAGER"]}
                triggerLabel={tUsers("addUser")}
              />
            )}
          </div>
        </CardHeader>
        <CardContent>
          {department.members.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noMembers")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tCommon("labels.name")}</TableHead>
                  <TableHead>{tCommon("labels.email")}</TableHead>
                  <TableHead>{tUsers("roles")}</TableHead>
                  <TableHead>{tCommon("labels.status")}</TableHead>
                  {canResetPasswords && (
                    <TableHead className="w-12">{tCommon("labels.actions")}</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {department.members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.name}</TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {tUsers(ROLE_TRANSLATION_KEY[member.role])}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={member.isActive ? "default" : "secondary"}
                      >
                        {member.isActive
                          ? tCommon("status.active")
                          : tCommon("status.inactive")}
                      </Badge>
                    </TableCell>
                    {canResetPasswords && (
                      <TableCell>
                        <ResetPasswordButton userId={member.id} />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
