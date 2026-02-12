CREATE TABLE "gallery_images" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"title" text,
	"image_url" text NOT NULL,
	"category" text,
	"show_in_home" boolean DEFAULT false NOT NULL,
	"order" numeric DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gallery_images" ADD CONSTRAINT "gallery_images_business_id_companies_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;