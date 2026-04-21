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
ALTER TABLE "user" ADD COLUMN "cpf_cnpj" text;--> statement-breakpoint
ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_reporter_user_id_user_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_logs" ADD CONSTRAINT "system_logs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_logs" ADD CONSTRAINT "system_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bug_reports_created_at_idx" ON "bug_reports" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "bug_reports_status_idx" ON "bug_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bug_reports_type_idx" ON "bug_reports" USING btree ("type");