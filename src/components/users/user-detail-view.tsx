"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, FileText, ClipboardCheck, BookOpen } from "lucide-react";
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

type UserDetail = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MANAGER" | "USER";
  isActive: boolean;
  createdAt: Date | string;
  departments?: { departmentId: string; departmentName: string; memberRole: string }[];
  stats: {
    documentsCreated: number;
    approvalsApproved: number;
    approvalsRejected: number;
    approvalsPending: number;
    documentsRead: number;
    readsPending: number;
  };
  recentActivities: {
    id: string;
    action: string;
    createdAt: Date | string;
    documentCode: string;
  }[];
};

const ROLE_TRANSLATION_KEY = {
  USER: "roleUser",
  MANAGER: "roleManager",
  ADMIN: "roleAdmin",
} as const;

const ACTION_TRANSLATION_KEY: Record<string, string> = {
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

export function UserDetailView({ user }: { user: UserDetail }) {
  const t = useTranslations("settings.users.detail");
  const tUsers = useTranslations("settings.users");
  const tCommon = useTranslations("common");
  const tActivity = useTranslations("documents.activity");

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/users">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("back")}
        </Link>
      </Button>

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle>{user.name}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {tCommon("labels.email")}
            </p>
            <p className="text-sm">{user.email}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {tUsers("roles")}
            </p>
            <Badge variant="outline">
              {tUsers(ROLE_TRANSLATION_KEY[user.role])}
            </Badge>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {tCommon("labels.department")}
            </p>
            <p className="text-sm">
              {user.departments && user.departments.length > 0
                ? user.departments.map((d) => d.departmentName).join(", ")
                : "-"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {tCommon("labels.status")}
            </p>
            <Badge variant={user.isActive ? "default" : "secondary"}>
              {user.isActive
                ? tCommon("status.active")
                : tCommon("status.inactive")}
            </Badge>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {t("memberSince")}
            </p>
            <p className="text-sm">
              {new Date(user.createdAt).toLocaleDateString()}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Documents Created */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("stats.documentsCreated")}
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {user.stats.documentsCreated}
            </div>
          </CardContent>
        </Card>

        {/* Approval Stats */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("stats.approvals")}
            </CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {t("stats.approvalsCompleted")}
              </span>
              <span className="font-semibold text-green-600">
                {user.stats.approvalsApproved}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {t("stats.approvalsRejected")}
              </span>
              <span className="font-semibold text-red-500">
                {user.stats.approvalsRejected}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {t("stats.approvalsPending")}
              </span>
              <span className="font-semibold text-yellow-600">
                {user.stats.approvalsPending}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Read Stats */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("stats.readTasks")}
            </CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {t("stats.documentsRead")}
              </span>
              <span className="font-semibold text-green-600">
                {user.stats.documentsRead}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {t("stats.readsPending")}
              </span>
              <span className="font-semibold text-yellow-600">
                {user.stats.readsPending}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>{t("recentActivity")}</CardTitle>
        </CardHeader>
        <CardContent>
          {user.recentActivities.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noActivity")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tCommon("labels.date")}</TableHead>
                  <TableHead>{tCommon("labels.actions")}</TableHead>
                  <TableHead>{t("documentCode")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {user.recentActivities.map((activity) => (
                  <TableRow key={activity.id}>
                    <TableCell className="text-sm">
                      {new Date(activity.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {ACTION_TRANSLATION_KEY[activity.action]
                          ? tActivity(ACTION_TRANSLATION_KEY[activity.action])
                          : activity.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {activity.documentCode}
                    </TableCell>
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
