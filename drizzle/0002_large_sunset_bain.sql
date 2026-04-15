CREATE TABLE "bug_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"reporter_user_id" text,
	"company_id" text,
	"type" text DEFAULT 'BUG' NOT NULL,
	"description" text NOT NULL,
	"screenshot_url" text,
	"page_url" text NOT NULL,
	"user_agent" text,
	"ip_address" text,
	"accept_language" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'NEW' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "master_template_variations" (
	"id" text PRIMARY KEY NOT NULL,
	"template_id" text NOT NULL,
	"variation_key" text NOT NULL,
	"variation_name" text NOT NULL,
	"niche" text NOT NULL,
	"section_type" text NOT NULL,
	"config" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "master_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"template_key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "master_templates_template_key_unique" UNIQUE("template_key")
);
--> statement-breakpoint
CREATE TABLE "system_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"action" text NOT NULL,
	"details" text,
	"level" text DEFAULT 'INFO' NOT NULL,
	"company_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company_site_customizations" ALTER COLUMN "appointment_flow" SET DEFAULT '{"colors":{"primary":"#000000","secondary":"#333333","background":"#ffffff","text":"#000000"},"step1Services":{"title":"Selecione o Serviço","showPrices":true,"showDurations":true,"cardConfig":{"backgroundColor":"TRANSPARENT_DEFAULT"}},"step2Date":{"title":"Escolha a Data","calendarStyle":"modern"},"step3Times":{"title":"Escolha o Horário","timeSlotStyle":"grid","timeSlotSize":30,"minimumBookingLeadMinutes":0},"step4Confirmation":{"title":"Confirme seu Agendamento","requireLogin":false}}'::jsonb;--> statement-breakpoint
ALTER TABLE "site_drafts" ALTER COLUMN "appointment_flow" SET DEFAULT '{"colors":{"primary":"#000000","secondary":"#333333","background":"#ffffff","text":"#000000"},"step1Services":{"title":"Selecione o Serviço","showPrices":true,"showDurations":true,"cardConfig":{"backgroundColor":"TRANSPARENT_DEFAULT"}},"step2Date":{"title":"Escolha a Data","calendarStyle":"modern"},"step3Times":{"title":"Escolha o Horário","timeSlotStyle":"grid","timeSlotSize":30,"minimumBookingLeadMinutes":0},"step4Confirmation":{"title":"Confirme seu Agendamento","requireLogin":false}}'::jsonb;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "billing_anchor_day" integer;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "billing_grace_ends_at" timestamp;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "billing_day_last_changed_at" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "cpf_cnpj" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "accepted_terms" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "accepted_terms_at" timestamp;--> statement-breakpoint
ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_reporter_user_id_user_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "master_template_variations" ADD CONSTRAINT "master_template_variations_template_id_master_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."master_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_logs" ADD CONSTRAINT "system_logs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_logs" ADD CONSTRAINT "system_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bug_reports_created_at_idx" ON "bug_reports" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "bug_reports_status_idx" ON "bug_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bug_reports_type_idx" ON "bug_reports" USING btree ("type");--> statement-breakpoint
CREATE INDEX "master_template_variations_template_id_idx" ON "master_template_variations" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "master_template_variations_section_type_idx" ON "master_template_variations" USING btree ("section_type");--> statement-breakpoint
CREATE UNIQUE INDEX "master_template_variations_unique_section_per_variation" ON "master_template_variations" USING btree ("template_id","variation_key","section_type");