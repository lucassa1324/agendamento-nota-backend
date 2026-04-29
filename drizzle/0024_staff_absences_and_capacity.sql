ALTER TABLE "companies"
ALTER COLUMN "billing_anchor_day" SET DEFAULT 27;

UPDATE "companies"
SET "billing_anchor_day" = 27
WHERE "billing_anchor_day" IS NULL;

ALTER TABLE "companies"
ALTER COLUMN "billing_anchor_day" SET NOT NULL;

CREATE TABLE IF NOT EXISTS "staff_absences" (
  "id" text PRIMARY KEY NOT NULL,
  "company_id" text NOT NULL,
  "staff_id" text NOT NULL,
  "start_time" timestamp NOT NULL,
  "end_time" timestamp NOT NULL,
  "reason" text,
  "created_by" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "staff_absences_company_id_companies_id_fk"
    FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade,
  CONSTRAINT "staff_absences_staff_id_staff_id_fk"
    FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade,
  CONSTRAINT "staff_absences_created_by_user_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null
);

CREATE INDEX IF NOT EXISTS "staff_absences_company_idx"
ON "staff_absences" ("company_id");

CREATE INDEX IF NOT EXISTS "staff_absences_staff_idx"
ON "staff_absences" ("staff_id");

CREATE INDEX IF NOT EXISTS "staff_absences_time_idx"
ON "staff_absences" ("start_time", "end_time");
