ALTER TABLE "companies" ADD COLUMN "subscription_status" text DEFAULT 'trial' NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "trial_ends_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "stripe_subscription_id" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "access_type" text DEFAULT 'automatic' NOT NULL;--> statement-breakpoint
ALTER TABLE "fixed_expenses" ADD COLUMN "type" text DEFAULT 'FIXO' NOT NULL;--> statement-breakpoint
ALTER TABLE "fixed_expenses" ADD COLUMN "total_installments" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "fixed_expenses" ADD COLUMN "current_installment" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "fixed_expenses" ADD COLUMN "parent_id" text;--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN "is_shared" boolean DEFAULT false NOT NULL;