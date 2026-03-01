import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";
import { users } from "./users";
import { departments } from "./departments";
import { departmentMemberRoleEnum } from "./enums";

export const departmentMembers = pgTable(
  "department_members",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    departmentId: text("department_id")
      .notNull()
      .references(() => departments.id),
    role: departmentMemberRoleEnum("role").notNull().default("MEMBER"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("dept_members_user_dept_idx").on(
      table.userId,
      table.departmentId,
    ),
    index("dept_members_user_id_idx").on(table.userId),
    index("dept_members_department_id_idx").on(table.departmentId),
    index("dept_members_dept_role_idx").on(table.departmentId, table.role),
  ],
);
