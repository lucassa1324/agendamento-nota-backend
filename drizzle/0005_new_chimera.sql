CREATE TABLE "company_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"site_name" text,
	"title_suffix" text,
	"description" text,
	"logo_url" text,
	"instagram" text,
	"show_instagram" boolean DEFAULT true NOT NULL,
	"whatsapp" text,
	"show_whatsapp" boolean DEFAULT true NOT NULL,
	"facebook" text,
	"show_facebook" boolean DEFAULT true NOT NULL,
	"tiktok" text,
	"show_tiktok" boolean DEFAULT true NOT NULL,
	"linkedin" text,
	"show_linkedin" boolean DEFAULT true NOT NULL,
	"x_twitter" text,
	"show_x_twitter" boolean DEFAULT true NOT NULL,
	"phone" text,
	"email" text,
	"address" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "company_settings_company_id_unique" UNIQUE("company_id")
);
--> statement-breakpoint
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;