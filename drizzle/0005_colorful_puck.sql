CREATE TABLE "staff_absences" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"staff_id" text NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"reason" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_services_competency" (
	"id" text PRIMARY KEY NOT NULL,
	"staff_id" text NOT NULL,
	"service_id" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"priority_score" integer DEFAULT 5 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "companies" ALTER COLUMN "billing_anchor_day" SET DEFAULT 27;--> statement-breakpoint
ALTER TABLE "companies" ALTER COLUMN "billing_anchor_day" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "first_subscription_at" timestamp;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "blocked_at" timestamp;--> statement-breakpoint
ALTER TABLE "staff_absences" ADD CONSTRAINT "staff_absences_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_absences" ADD CONSTRAINT "staff_absences_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_absences" ADD CONSTRAINT "staff_absences_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_services_competency" ADD CONSTRAINT "staff_services_competency_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_services_competency" ADD CONSTRAINT "staff_services_competency_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staff_absences_company_idx" ON "staff_absences" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "staff_absences_staff_idx" ON "staff_absences" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "staff_absences_time_idx" ON "staff_absences" USING btree ("start_time","end_time");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_services_competency_staff_service_unique" ON "staff_services_competency" USING btree ("staff_id","service_id");--> statement-breakpoint
CREATE INDEX "staff_services_competency_staff_idx" ON "staff_services_competency" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "staff_services_competency_service_idx" ON "staff_services_competency" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "staff_services_competency_active_idx" ON "staff_services_competency" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_email_company_unique" ON "staff" USING btree ("email","company_id");--> statement-breakpoint
CREATE INDEX "staff_email_idx" ON "staff" USING btree ("email");