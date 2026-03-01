"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, departments, departmentMembers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { classifyError, type ActionResult } from "@/lib/errors";

async function getSessionOrThrow() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");
  return session;
}

export async function getProfile() {
  const session = await getSessionOrThrow();

  const result = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (result.length === 0) throw new Error("User not found");

  // Get departments via junction table
  const userDepartments = await db
    .select({
      departmentId: departmentMembers.departmentId,
      departmentName: departments.name,
      memberRole: departmentMembers.role,
    })
    .from(departmentMembers)
    .innerJoin(departments, eq(departmentMembers.departmentId, departments.id))
    .where(eq(departmentMembers.userId, session.user.id));

  return {
    ...result[0],
    departments: userDepartments,
    // Backward-compatible fields for profile-form
    departmentName: userDepartments.map((d) => d.departmentName).join(", ") || null,
  };
}

export async function updateProfile(data: { name: string }): Promise<ActionResult> {
  try {
    const session = await getSessionOrThrow();

    if (!data.name || data.name.trim().length === 0) {
      return { success: false, error: "Name is required", errorCode: "NAME_REQUIRED" };
    }

    await db
      .update(users)
      .set({ name: data.name.trim() })
      .where(eq(users.id, session.user.id));

    revalidatePath("/profile");
    return { success: true };
  } catch (error) {
    return classifyError(error);
  }
}
