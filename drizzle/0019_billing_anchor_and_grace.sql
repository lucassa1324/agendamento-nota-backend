ALTER TABLE "companies"
ADD COLUMN "billing_anchor_day" integer;

ALTER TABLE "companies"
ADD COLUMN "billing_grace_ends_at" timestamp;

ALTER TABLE "companies"
ADD COLUMN "billing_day_last_changed_at" timestamp;
