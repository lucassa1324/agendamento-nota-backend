ALTER TABLE "magic_links" ADD COLUMN "expiration_hours" integer DEFAULT 24 NOT NULL;--> statement-breakpoint
ALTER TABLE "magic_links" ADD COLUMN "single_use" boolean DEFAULT true NOT NULL;