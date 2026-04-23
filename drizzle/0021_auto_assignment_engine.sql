ALTER TABLE "appointments"
ADD COLUMN IF NOT EXISTS "assigned_by" text DEFAULT 'staff' NOT NULL;

ALTER TABLE "appointments"
ADD COLUMN IF NOT EXISTS "validation_status" text DEFAULT 'confirmed' NOT NULL;

ALTER TABLE "appointments"
ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1 NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'appointments_assigned_by_check'
  ) THEN
    ALTER TABLE "appointments"
    ADD CONSTRAINT "appointments_assigned_by_check"
    CHECK ("assigned_by" IN ('system', 'staff'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'appointments_validation_status_check'
  ) THEN
    ALTER TABLE "appointments"
    ADD CONSTRAINT "appointments_validation_status_check"
    CHECK ("validation_status" IN ('suggested', 'confirmed'));
  END IF;
END $$;
