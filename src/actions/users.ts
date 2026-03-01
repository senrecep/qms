"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  users,
  departments,
  departmentMembers,
  documentRevisions,
  approvals,
  readConfirmations,
  activityLogs,
  documents,
} from "@/lib/db/schema";
import { eq, and, ne, count, desc, sql, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { env } from "@/lib/env";
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

async function getManagerDepartmentIds(userId: string) {
  const rows = await db
    .select({ departmentId: departmentMembers.departmentId })
    .from(departmentMembers)
    .where(
      and(
        eq(departmentMembers.userId, userId),
        eq(departmentMembers.role, "MANAGER"),
      ),
    );
  return rows.map((r) => r.departmentId);
}

export async function createUser(formData: {
  name: string;
  email: string;
  role: "ADMIN" | "MANAGER" | "USER";
  departmentIds?: string[];
}): Promise<ActionResult> {
  try {
    const session = await getSessionOrThrow();
    const role = (session.user as { role?: string }).role;

    if (role !== "ADMIN" && role !== "MANAGER") throw new Error("Forbidden");

    if (role === "MANAGER") {
      const managerDeptIds = await getManagerDepartmentIds(session.user.id);
      if (managerDeptIds.length === 0) throw new Error("Forbidden");

      if (formData.role === "ADMIN") throw new Error("Forbidden");

      if (!formData.departmentIds || formData.departmentIds.length === 0) {
        return { success: false, error: "Managers must be assigned to at least one department", errorCode: "MANAGER_NEEDS_DEPARTMENT" };
      }

      const isSubset = formData.departmentIds.every((deptId) => managerDeptIds.includes(deptId));
      if (!isSubset) throw new Error("Forbidden");

      if (formData.role === "USER" && formData.departmentIds.length !== 1) {
        return { success: false, error: "Users must be assigned to exactly one department", errorCode: "USER_NEEDS_ONE_DEPARTMENT" };
      }
    }

    // Validate department rules
    if (formData.role === "MANAGER") {
      if (!formData.departmentIds || formData.departmentIds.length === 0) {
        return { success: false, error: "Managers must be assigned to at least one department", errorCode: "MANAGER_NEEDS_DEPARTMENT" };
      }
    } else if (formData.role === "USER") {
      if (!formData.departmentIds || formData.departmentIds.length !== 1) {
        return { success: false, error: "Users must be assigned to exactly one department", errorCode: "USER_NEEDS_ONE_DEPARTMENT" };
      }
    }

    // Check if email already exists
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, formData.email))
      .limit(1);

    if (existing.length > 0) {
      return { success: false, error: "A user with this email already exists", errorCode: "EMAIL_EXISTS" };
    }

    // Generate a temporary password (never used directly by the user)
    const tempPassword = crypto.randomUUID();

    // Create user via Better Auth (handles password hashing)
    const result = await auth.api.signUpEmail({
      body: {
        name: formData.name,
        email: formData.email,
        password: tempPassword,
      },
    });

    if (!result.user) {
      return { success: false, error: "Failed to create user", errorCode: "USER_CREATE_FAILED" };
    }

    // Update role (input: false field)
    await db
      .update(users)
      .set({ role: formData.role })
      .where(eq(users.id, result.user.id));

    // Insert department memberships
    if (formData.departmentIds && formData.departmentIds.length > 0) {
      const memberRole = formData.role === "MANAGER" ? "MANAGER" : "MEMBER";
      await db.insert(departmentMembers).values(
        formData.departmentIds.map((deptId) => ({
          userId: result.user.id,
          departmentId: deptId,
          role: memberRole as "MEMBER" | "MANAGER",
        })),
      );
    }

    // Trigger password reset email via Better Auth endpoint
    await fetch(`${env.BETTER_AUTH_URL}/api/auth/request-password-reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: formData.email,
        redirectTo: "/set-password",
      }),
    });

    revalidatePath("/users");
    revalidatePath("/departments");
    return { success: true };
  } catch (error) {
    return classifyError(error);
  }
}

export async function sendPasswordReset(userId: string): Promise<ActionResult> {
  try {
    const session = await getSessionOrThrow();
    const role = (session.user as { role?: string }).role;

    if (role !== "ADMIN" && role !== "MANAGER") throw new Error("Forbidden");

    if (role === "MANAGER") {
      const managerDeptIds = await getManagerDepartmentIds(session.user.id);
      if (managerDeptIds.length === 0) throw new Error("Forbidden");

      const allowed = await db
        .select({ departmentId: departmentMembers.departmentId })
        .from(departmentMembers)
        .where(
          and(
            eq(departmentMembers.userId, userId),
            inArray(departmentMembers.departmentId, managerDeptIds),
          ),
        )
        .limit(1);

      if (allowed.length === 0) throw new Error("Forbidden");
    }

    const user = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length === 0) {
      return { success: false, error: "User not found", errorCode: "USER_NOT_FOUND" };
    }

    const res = await fetch(`${env.BETTER_AUTH_URL}/api/auth/request-password-reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: user[0].email,
        redirectTo: "/set-password",
      }),
    });

    if (!res.ok) {
      return { success: false, error: "Failed to send password reset email", errorCode: "PASSWORD_RESET_FAILED" };
    }

    return { success: true };
  } catch (error) {
    return classifyError(error);
  }
}

export async function getDepartmentsList() {
  const depts = await db
    .select({ id: departments.id, name: departments.name })
    .from(departments)
    .where(eq(departments.isActive, true));
  return depts;
}

export async function toggleUserActive(userId: string, isActive: boolean): Promise<ActionResult> {
  try {
    await requireAdmin();
    await db.update(users).set({ isActive }).where(eq(users.id, userId));
    revalidatePath("/users");
    return { success: true };
  } catch (error) {
    return classifyError(error);
  }
}

export async function updateUser(
  userId: string,
  formData: {
    name: string;
    email: string;
    role: "ADMIN" | "MANAGER" | "USER";
    departmentIds?: string[];
    isActive: boolean;
  }
): Promise<ActionResult> {
  try {
    await requireAdmin();

    // Validate department rules
    if (formData.role === "MANAGER") {
      if (!formData.departmentIds || formData.departmentIds.length === 0) {
        return { success: false, error: "Managers must be assigned to at least one department", errorCode: "MANAGER_NEEDS_DEPARTMENT" };
      }
    } else if (formData.role === "USER") {
      if (!formData.departmentIds || formData.departmentIds.length !== 1) {
        return { success: false, error: "Users must be assigned to exactly one department", errorCode: "USER_NEEDS_ONE_DEPARTMENT" };
      }
    }

    // Check email uniqueness (exclude current user)
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, formData.email), ne(users.id, userId)))
      .limit(1);

    if (existing.length > 0) {
      return { success: false, error: "A user with this email already exists", errorCode: "EMAIL_EXISTS" };
    }

    await db
      .update(users)
      .set({
        name: formData.name,
        email: formData.email,
        role: formData.role,
        isActive: formData.isActive,
      })
      .where(eq(users.id, userId));

    // Replace department memberships: delete old, insert new
    if (formData.departmentIds !== undefined) {
      await db
        .delete(departmentMembers)
        .where(eq(departmentMembers.userId, userId));

      if (formData.departmentIds.length > 0) {
        const memberRole = formData.role === "MANAGER" ? "MANAGER" : "MEMBER";
        await db.insert(departmentMembers).values(
          formData.departmentIds.map((deptId) => ({
            userId,
            departmentId: deptId,
            role: memberRole as "MEMBER" | "MANAGER",
          })),
        );
      }
    }

    revalidatePath("/users");
    return { success: true };
  } catch (error) {
    return classifyError(error);
  }
}

export async function getUserDetail(userId: string) {
  const userInfo = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (userInfo.length === 0) return null;

  // Get departments via department_members
  const userDepartments = await db
    .select({
      departmentId: departmentMembers.departmentId,
      departmentName: departments.name,
      memberRole: departmentMembers.role,
    })
    .from(departmentMembers)
    .innerJoin(departments, eq(departmentMembers.departmentId, departments.id))
    .where(eq(departmentMembers.userId, userId));

  // Optimized: 3 queries instead of 6 using conditional aggregation
  const [
    documentsCreatedResult,
    approvalStatsResult,
    readStatsResult,
  ] = await Promise.all([
    db
      .select({ count: count() })
      .from(documentRevisions)
      .where(eq(documentRevisions.createdById, userId)),
    db
      .select({
        approved: sql<number>`count(*) filter (where ${approvals.status} = 'APPROVED')`.as("approved"),
        rejected: sql<number>`count(*) filter (where ${approvals.status} = 'REJECTED')`.as("rejected"),
        pending: sql<number>`count(*) filter (where ${approvals.status} = 'PENDING')`.as("pending"),
      })
      .from(approvals)
      .where(eq(approvals.approverId, userId)),
    db
      .select({
        confirmed: count(readConfirmations.confirmedAt),
        total: count(),
      })
      .from(readConfirmations)
      .where(eq(readConfirmations.userId, userId)),
  ]);

  const recentActivities = await db
    .select({
      id: activityLogs.id,
      action: activityLogs.action,
      createdAt: activityLogs.createdAt,
      documentCode: documents.documentCode,
    })
    .from(activityLogs)
    .innerJoin(documents, eq(activityLogs.documentId, documents.id))
    .where(eq(activityLogs.userId, userId))
    .orderBy(desc(activityLogs.createdAt))
    .limit(10);

  return {
    ...userInfo[0],
    departments: userDepartments,
    stats: {
      documentsCreated: Number(documentsCreatedResult[0].count),
      approvalsApproved: Number(approvalStatsResult[0].approved),
      approvalsRejected: Number(approvalStatsResult[0].rejected),
      approvalsPending: Number(approvalStatsResult[0].pending),
      documentsRead: Number(readStatsResult[0].confirmed),
      readsPending: Number(readStatsResult[0].total) - Number(readStatsResult[0].confirmed),
    },
    recentActivities,
  };
}

/** Get user's department memberships (used by edit dialog) */
export async function getUserDepartments(userId: string) {
  return db
    .select({
      departmentId: departmentMembers.departmentId,
      role: departmentMembers.role,
    })
    .from(departmentMembers)
    .where(eq(departmentMembers.userId, userId));
}
