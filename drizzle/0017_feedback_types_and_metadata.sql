ALTER TABLE "bug_reports" ADD COLUMN IF NOT EXISTS "type" text DEFAULT 'BUG' NOT NULL;
--> statement-breakpoint
ALTER TABLE "bug_reports" ALTER COLUMN "screenshot_url" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "bug_reports" ADD COLUMN IF NOT EXISTS "ip_address" text;
--> statement-breakpoint
ALTER TABLE "bug_reports" ADD COLUMN IF NOT EXISTS "accept_language" text;
--> statement-breakpoint
ALTER TABLE "bug_reports" ADD COLUMN IF NOT EXISTS "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bug_reports_type_idx" ON "bug_reports" USING btree ("type");
