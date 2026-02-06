CREATE TABLE "business_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
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
	"twitter" text,
	"show_twitter" boolean DEFAULT true NOT NULL,
	"phone" text,
	"email" text,
	"address" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "business_profiles_business_id_unique" UNIQUE("business_id")
);
--> statement-breakpoint
DROP TABLE "company_settings" CASCADE;--> statement-breakpoint
ALTER TABLE "business_profiles" ADD CONSTRAINT "business_profiles_business_id_companies_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;