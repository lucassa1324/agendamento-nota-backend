ALTER TABLE "companies"
ADD COLUMN IF NOT EXISTS "first_subscription_at" timestamp;

ALTER TABLE "companies"
ADD COLUMN IF NOT EXISTS "blocked_at" timestamp;

CREATE INDEX IF NOT EXISTS "companies_blocked_at_idx"
ON "companies" ("blocked_at");
