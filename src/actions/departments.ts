"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  departments,
  departmentMembers,
  users,
  departmentSlugRedirects,
} from "@/lib/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { classifyError, type ActionResult } from "@/lib/errors";

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");
  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN") throw new Error("Forbidden");
  return session;
}

async function getSessionOrThrow() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");
  return session;
}

export async function createDepartment(formData: {
  name: string;
  slug: string;
  description?: string;
  managerIds?: string[];
  isActive?: boolean;
}): Promise<ActionResult> {
  try {
    await requireAdmin();

    const existing = await db
      .select({ id: departments.id })
      .from(departments)
      .where(eq(departments.slug, formData.slug))
      .limit(1);

    if (existing.length > 0) {
      return { success: false, error: "A department with this slug already exists", errorCode: "SLUG_EXISTS" };
    }

    const [dept] = await db.insert(departments).values({
      name: formData.name,
      slug: formData.slug,
      description: formData.description || null,
      isActive: formData.isActive ?? true,
    }).returning({ id: departments.id });

    // Insert manager memberships
    if (formData.managerIds && formData.managerIds.length > 0) {
      await db.insert(departmentMembers).values(
        formData.managerIds.map((managerId) => ({
          userId: managerId,
          departmentId: dept.id,
          role: "MANAGER" as const,
        })),
      );
    }

    revalidatePath("/departments");
    return { success: true };
  } catch (error) {
    return classifyError(error);
  }
}

export async function updateDepartment(
  id: string,
  formData: {
    name: string;
    slug: string;
    description?: string;
    managerIds?: string[];
    isActive?: boolean;
  },
): Promise<ActionResult> {
  try {
    const session = await getSessionOrThrow();
    const role = (session.user as { role?: string }).role;

    if (role !== "ADMIN" && role !== "MANAGER") throw new Error("Forbidden");

    const current = await db
      .select({ slug: departments.slug })
      .from(departments)
      .where(eq(departments.id, id))
      .limit(1);

    if (current.length === 0) throw new Error("Forbidden");

    const previousSlug = current[0].slug;
    const slugChanged = previousSlug !== formData.slug;

    if (role === "MANAGER") {
      const managerDept = await db
        .select({ departmentId: departmentMembers.departmentId })
        .from(departmentMembers)
        .where(
          and(
            eq(departmentMembers.userId, session.user.id),
            eq(departmentMembers.role, "MANAGER"),
            eq(departmentMembers.departmentId, id),
          ),
        )
        .limit(1);

      if (managerDept.length === 0) throw new Error("Forbidden");

      const slugConflict = await db
        .select({ id: departments.id })
        .from(departments)
        .where(and(eq(departments.slug, formData.slug), ne(departments.id, id)))
        .limit(1);

      if (slugConflict.length > 0) {
        return { success: false, error: "A department with this slug already exists", errorCode: "SLUG_EXISTS" };
      }

      await db
        .update(departments)
        .set({
          name: formData.name,
          slug: formData.slug,
          description: formData.description || null,
          isActive: formData.isActive ?? true,
        })
        .where(eq(departments.id, id));

      if (slugChanged) {
        await db
          .delete(departmentSlugRedirects)
          .where(eq(departmentSlugRedirects.oldSlug, previousSlug));
        await db.insert(departmentSlugRedirects).values({
          oldSlug: previousSlug,
          departmentId: id,
        });
        revalidatePath(`/departments/${previousSlug}`);
      }

      revalidatePath("/departments");
      return { success: true };
    }

    await requireAdmin();

    const slugConflict = await db
      .select({ id: departments.id })
      .from(departments)
      .where(and(eq(departments.slug, formData.slug), ne(departments.id, id)))
      .limit(1);

    if (slugConflict.length > 0) {
      return { success: false, error: "A department with this slug already exists", errorCode: "SLUG_EXISTS" };
    }

    await db
      .update(departments)
      .set({
        name: formData.name,
        slug: formData.slug,
        description: formData.description || null,
        isActive: formData.isActive ?? true,
      })
      .where(eq(departments.id, id));

    if (slugChanged) {
      await db
        .delete(departmentSlugRedirects)
        .where(eq(departmentSlugRedirects.oldSlug, previousSlug));
      await db.insert(departmentSlugRedirects).values({
        oldSlug: previousSlug,
        departmentId: id,
      });
      revalidatePath(`/departments/${previousSlug}`);
    }

    // Replace manager memberships: delete old MANAGER entries, insert new
    if (formData.managerIds !== undefined) {
      await db
        .delete(departmentMembers)
        .where(
          and(
            eq(departmentMembers.departmentId, id),
            eq(departmentMembers.role, "MANAGER"),
          ),
        );

      if (formData.managerIds.length > 0) {
        await db.insert(departmentMembers).values(
          formData.managerIds.map((managerId) => ({
            userId: managerId,
            departmentId: id,
            role: "MANAGER" as const,
          })),
        );
      }
    }

    revalidatePath("/departments");
    return { success: true };
  } catch (error) {
    return classifyError(error);
  }
}

export async function toggleDepartmentActive(id: string, isActive: boolean): Promise<ActionResult> {
  try {
    await requireAdmin();
    await db.update(departments).set({ isActive }).where(eq(departments.id, id));
    revalidatePath("/departments");
    return { success: true };
  } catch (error) {
    return classifyError(error);
  }
}

async function getDepartmentDetailById(departmentId: string) {
  const dept = await db
    .select({
      id: departments.id,
      name: departments.name,
      slug: departments.slug,
      description: departments.description,
      isActive: departments.isActive,
    })
    .from(departments)
    .where(and(eq(departments.id, departmentId), eq(departments.isDeleted, false)))
    .limit(1);

  if (dept.length === 0) return null;

  const managers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
    })
    .from(departmentMembers)
    .innerJoin(users, eq(departmentMembers.userId, users.id))
    .where(
      and(
        eq(departmentMembers.departmentId, dept[0].id),
        eq(departmentMembers.role, "MANAGER"),
      ),
    );

  const members = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      memberRole: departmentMembers.role,
    })
    .from(departmentMembers)
    .innerJoin(users, eq(departmentMembers.userId, users.id))
    .where(
      and(
        eq(departmentMembers.departmentId, dept[0].id),
        eq(users.isActive, true),
      ),
    );

  return { ...dept[0], managers, members };
}

export async function getDepartmentBySlug(slug: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const dept = await db
    .select({ id: departments.id })
    .from(departments)
    .where(and(eq(departments.slug, slug), eq(departments.isDeleted, false)))
    .limit(1);

  if (dept.length > 0) {
    return getDepartmentDetailById(dept[0].id);
  }

  const redirect = await db
    .select({ departmentId: departmentSlugRedirects.departmentId })
    .from(departmentSlugRedirects)
    .where(eq(departmentSlugRedirects.oldSlug, slug))
    .limit(1);

  if (redirect.length === 0) return null;

  const detail = await getDepartmentDetailById(redirect[0].departmentId);
  if (!detail) return null;

  return { ...detail, redirectFrom: slug };
}
