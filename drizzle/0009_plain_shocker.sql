CREATE TABLE "fixed_expenses" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"description" text NOT NULL,
	"value" numeric(10, 2) NOT NULL,
	"category" text NOT NULL,
	"due_date" timestamp NOT NULL,
	"is_paid" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company_site_customizations" ALTER COLUMN "appointment_flow" SET DEFAULT '{"colors":{"primary":"#000000","secondary":"#333333","background":"#ffffff","text":"#000000"},"step1Services":{"title":"Selecione o Serviço","showPrices":true,"showDurations":true,"cardConfig":{"backgroundColor":"TRANSPARENT_DEFAULT"}},"step2Date":{"title":"Escolha a Data","calendarStyle":"modern"},"step3Times":{"title":"Escolha o Horário","timeSlotStyle":"grid","timeSlotSize":"00:30"},"step4Confirmation":{"title":"Confirme seu Agendamento","requireLogin":false}}'::jsonb;--> statement-breakpoint
ALTER TABLE "service_resources" ADD COLUMN "quantity" numeric(10, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "service_resources" ADD COLUMN "unit" text NOT NULL;--> statement-breakpoint
ALTER TABLE "service_resources" ADD COLUMN "use_secondary_unit" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "fixed_expenses" ADD CONSTRAINT "fixed_expenses_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_resources" DROP COLUMN "consumption_unit";--> statement-breakpoint
ALTER TABLE "service_resources" DROP COLUMN "conversion_factor";--> statement-breakpoint
ALTER TABLE "service_resources" DROP COLUMN "purchase_unit";--> statement-breakpoint
ALTER TABLE "service_resources" DROP COLUMN "consumed_quantity";--> statement-breakpoint
ALTER TABLE "service_resources" DROP COLUMN "output_factor";--> statement-breakpoint
ALTER TABLE "service_resources" DROP COLUMN "trigger";