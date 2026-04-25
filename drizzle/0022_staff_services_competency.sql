CREATE TABLE IF NOT EXISTS "staff_services_competency" (
  "id" text PRIMARY KEY,
  "staff_id" text NOT NULL REFERENCES "staff"("id") ON DELETE CASCADE,
  "service_id" text NOT NULL REFERENCES "services"("id") ON DELETE CASCADE,
  "is_active" boolean DEFAULT true NOT NULL,
  "priority_score" integer DEFAULT 5 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "staff_services_competency_staff_service_unique"
  ON "staff_services_competency" ("staff_id", "service_id");

CREATE INDEX IF NOT EXISTS "staff_services_competency_staff_idx"
  ON "staff_services_competency" ("staff_id");

CREATE INDEX IF NOT EXISTS "staff_services_competency_service_idx"
  ON "staff_services_competency" ("service_id");

CREATE INDEX IF NOT EXISTS "staff_services_competency_active_idx"
  ON "staff_services_competency" ("is_active");

INSERT INTO "staff_services_competency" (
  "id",
  "staff_id",
  "service_id",
  "is_active",
  "priority_score",
  "created_at",
  "updated_at"
)
SELECT
  ('ssc_' || md5(random()::text || clock_timestamp()::text || ss."staff_id" || ss."service_id")),
  ss."staff_id",
  ss."service_id",
  true,
  5,
  now(),
  now()
FROM "staff_services" ss
LEFT JOIN "staff_services_competency" ssc
  ON ssc."staff_id" = ss."staff_id"
 AND ssc."service_id" = ss."service_id"
WHERE ssc."id" IS NULL;

ALTER TABLE "staff_services_competency"
  DROP CONSTRAINT IF EXISTS "staff_services_competency_priority_score_check";

ALTER TABLE "staff_services_competency"
  ADD CONSTRAINT "staff_services_competency_priority_score_check"
  CHECK ("priority_score" >= 0 AND "priority_score" <= 10);
