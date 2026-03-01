import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { departments, departmentMembers, users } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import Link from "next/link";
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
import { CreateDepartmentDialog } from "@/components/departments/create-department-dialog";
import { EditDepartmentDialog } from "@/components/departments/edit-department-dialog";

export default async function DepartmentsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const userRole = (session.user as { role?: string }).role;
  const isAdmin = userRole === "ADMIN";

  const t = await getTranslations("departments");
  const tCommon = await getTranslations("common");

  const departmentList = await db
    .select({
      id: departments.id,
      name: departments.name,
      slug: departments.slug,
      description: departments.description,
      isActive: departments.isActive,
    })
    .from(departments)
    .where(eq(departments.isDeleted, false));

  // Get managers for all departments via junction table
  const deptIds = departmentList.map((d) => d.id);
  const managerMemberships = deptIds.length > 0
    ? await db
        .select({
          departmentId: departmentMembers.departmentId,
          managerId: users.id,
          managerName: users.name,
        })
        .from(departmentMembers)
        .innerJoin(users, eq(departmentMembers.userId, users.id))
        .where(
          and(
            inArray(departmentMembers.departmentId, deptIds),
            eq(departmentMembers.role, "MANAGER"),
          ),
        )
    : [];

  // Build map: departmentId -> manager info
  const managerMap = new Map<string, { id: string; name: string }[]>();
  for (const m of managerMemberships) {
    const existing = managerMap.get(m.departmentId) || [];
    existing.push({ id: m.managerId, name: m.managerName });
    managerMap.set(m.departmentId, existing);
  }

  const enrichedList = departmentList.map((dept) => ({
    ...dept,
    managers: managerMap.get(dept.id) || [],
    managerNames: managerMap.get(dept.id)?.map((m) => m.name).join(", ") ?? "-",
    managerIds: managerMap.get(dept.id)?.map((m) => m.id) ?? [],
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("list.title")}</h1>
        {isAdmin && <CreateDepartmentDialog />}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("list.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {enrichedList.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("list.empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tCommon("labels.name")}</TableHead>
                  <TableHead>{t("form.manager")}</TableHead>
                  <TableHead>{tCommon("labels.status")}</TableHead>
                {isAdmin && (
                  <TableHead className="w-12">{tCommon("labels.actions")}</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {enrichedList.map((dept) => (
                <TableRow key={dept.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/departments/${dept.slug}`}
                        className="hover:underline text-primary"
                      >
                        {dept.name}
                      </Link>
                    </TableCell>
                    <TableCell>{dept.managerNames}</TableCell>
                    <TableCell>
                      <Badge variant={dept.isActive ? "default" : "secondary"}>
                        {dept.isActive
                          ? tCommon("status.active")
                          : tCommon("status.inactive")}
                      </Badge>
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <EditDepartmentDialog dept={{
                          id: dept.id,
                          name: dept.name,
                          slug: dept.slug,
                          description: dept.description,
                          isActive: dept.isActive,
                          managerIds: dept.managerIds,
                        }} />
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
