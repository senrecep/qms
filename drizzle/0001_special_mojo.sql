CREATE TABLE IF NOT EXISTS "department_slug_redirects" (
	"id" text PRIMARY KEY NOT NULL,
	"old_slug" text NOT NULL,
	"department_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "department_slug_redirects_old_slug_unique" UNIQUE("old_slug")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "department_slug_redirects_dept_id_idx" ON "department_slug_redirects" USING btree ("department_id");
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'department_slug_redirects_department_id_departments_id_fk'
	) THEN
		ALTER TABLE "department_slug_redirects"
		ADD CONSTRAINT "department_slug_redirects_department_id_departments_id_fk"
		FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;
	END IF;
END $$;
