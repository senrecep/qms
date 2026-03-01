"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { updateProfile } from "@/actions/profile";
import { authClient } from "@/lib/auth/client";
import { toast } from "sonner";
import { User, Mail, Shield, Building2, Calendar, Lock } from "lucide-react";
import { format } from "date-fns";

type ProfileData = {
  id: string;
  name: string;
  email: string;
  role: string;
  departmentName: string | null;
  isActive: boolean;
  createdAt: Date;
};

const ERROR_CODE_MAP: Record<string, string> = {
  NAME_REQUIRED: "nameRequired",
  EMAIL_TEST_FAILED: "emailTestFailed",
  UNAUTHORIZED: "unauthorized",
  FORBIDDEN: "forbidden",
  UNEXPECTED_ERROR: "unexpectedError",
};

export function ProfileForm({ profile }: { profile: ProfileData }) {
  const t = useTranslations();
  const tErrors = useTranslations("errors");
  const router = useRouter();

  // Name edit state
  const [name, setName] = useState(profile.name);
  const [nameLoading, setNameLoading] = useState(false);
  const [nameError, setNameError] = useState("");

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const handleNameSave = async () => {
    if (name.trim() === profile.name) return;
    setNameLoading(true);
    setNameError("");
    try {
      const result = await updateProfile({ name: name.trim() });
      if (!result.success) {
        const key = ERROR_CODE_MAP[result.errorCode] ?? "unexpectedError";
        setNameError(tErrors(key));
      } else {
        toast.success(t("common.status.success"));
        router.refresh();
      }
    } catch {
      setNameError(tErrors("unexpectedError"));
    } finally {
      setNameLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");

    if (newPassword.length < 8) {
      setPasswordError(t("profile.passwordTooShort"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t("profile.passwordMismatch"));
      return;
    }

    setPasswordLoading(true);
    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: false,
      });

      if (result.error) {
        setPasswordError(result.error.message || "Failed to change password");
      } else {
        toast.success(t("profile.passwordChanged"));
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      setPasswordError("Failed to change password");
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Profile Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="size-5" />
            {t("profile.info")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Name - editable */}
          <div className="space-y-2">
            <Label htmlFor="profile-name">{t("common.labels.name")}</Label>
            <div className="flex gap-2">
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              {name.trim() !== profile.name && (
                <Button
                  onClick={handleNameSave}
                  disabled={nameLoading}
                  size="sm"
                >
                  {nameLoading
                    ? t("common.status.loading")
                    : t("common.actions.save")}
                </Button>
              )}
            </div>
            {nameError && (
              <p className="text-sm text-destructive">{nameError}</p>
            )}
          </div>

          <Separator />

          {/* Read-only fields */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-3">
              <Mail className="text-muted-foreground size-4" />
              <div>
                <p className="text-muted-foreground text-xs">
                  {t("common.labels.email")}
                </p>
                <p className="text-sm font-medium">{profile.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Shield className="text-muted-foreground size-4" />
              <div>
                <p className="text-muted-foreground text-xs">
                  {t("settings.users.roles")}
                </p>
                <Badge variant="outline">{profile.role}</Badge>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Building2 className="text-muted-foreground size-4" />
              <div>
                <p className="text-muted-foreground text-xs">
                  {t("common.labels.department")}
                </p>
                <p className="text-sm font-medium">
                  {profile.departmentName ?? "-"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="text-muted-foreground size-4" />
              <div>
                <p className="text-muted-foreground text-xs">
                  {t("common.labels.createdAt")}
                </p>
                <p className="text-sm font-medium">
                  {format(profile.createdAt, "dd.MM.yyyy")}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Password Change Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="size-5" />
            {t("profile.changePassword")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">
                {t("profile.currentPassword")}
              </Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">{t("profile.newPassword")}</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">
                {t("profile.confirmPassword")}
              </Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>

            {passwordError && (
              <p className="text-sm text-destructive">{passwordError}</p>
            )}

            <Button type="submit" disabled={passwordLoading}>
              {passwordLoading
                ? t("common.status.loading")
                : t("profile.changePassword")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
