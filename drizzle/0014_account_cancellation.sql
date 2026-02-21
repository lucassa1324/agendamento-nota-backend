ALTER TABLE "user" ADD COLUMN "account_status" text DEFAULT 'ACTIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "cancellation_requested_at" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "retention_ends_at" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "last_retention_discount_at" timestamp;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "account_cancellation_feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"reason" text NOT NULL,
	"details" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "account_cancellation_feedback" ADD CONSTRAINT "account_cancellation_feedback_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
