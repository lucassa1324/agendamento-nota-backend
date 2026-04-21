CREATE TABLE "custom_domains" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"domain" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"verification_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "custom_domains_company_id_unique" UNIQUE("company_id"),
	CONSTRAINT "custom_domains_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
ALTER TABLE "custom_domains" ADD CONSTRAINT "custom_domains_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;