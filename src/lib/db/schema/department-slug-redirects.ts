import {
  pgTable,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";
import { departments } from "./departments";

export const departmentSlugRedirects = pgTable(
  "department_slug_redirects",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    oldSlug: text("old_slug").notNull().unique(),
    departmentId: text("department_id")
      .notNull()
      .references(() => departments.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("department_slug_redirects_dept_id_idx").on(table.departmentId),
  ],
);
