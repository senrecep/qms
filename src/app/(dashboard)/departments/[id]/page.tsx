import { getSession } from "@/lib/auth/session";
import { redirect, notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getDepartmentBySlug } from "@/actions/departments";
import { DepartmentDetailView } from "@/components/departments/department-detail-view";

export default async function DepartmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id: slug } = await params;
  const department = await getDepartmentBySlug(slug);

  if (!department) notFound();
  if ("redirectFrom" in department && department.redirectFrom && department.slug !== slug) {
    redirect(`/departments/${department.slug}`);
  }

  const userRole = (session.user as { role?: string }).role;
  const isAdmin = userRole === "ADMIN";
  const isManager = userRole === "MANAGER";
  const isDeptManager = isManager && department.managers.some((m) => m.id === session.user.id);

  const t = await getTranslations("departments.detail");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
      <DepartmentDetailView
        department={department}
        canEditDepartment={isAdmin || isDeptManager}
        editMode={isAdmin ? "admin" : "manager"}
        canCreateUser={isAdmin || isDeptManager}
        canResetPasswords={isAdmin || isDeptManager}
        showReadOnlyNotice={isManager && !isDeptManager}
      />
    </div>
  );
}
