CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "account_cancellation_feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"reason" text NOT NULL,
	"details" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agenda_blocks" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"start_time" text,
	"end_time" text,
	"reason" text,
	"type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointment_items" (
	"id" text PRIMARY KEY NOT NULL,
	"appointment_id" text NOT NULL,
	"service_id" text NOT NULL,
	"service_name_snapshot" text NOT NULL,
	"service_price_snapshot" numeric(10, 2) NOT NULL,
	"service_duration_snapshot" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"service_id" text NOT NULL,
	"customer_id" text,
	"customer_name" text NOT NULL,
	"customer_email" text NOT NULL,
	"customer_phone" text NOT NULL,
	"service_name_snapshot" text NOT NULL,
	"service_price_snapshot" numeric(10, 2) NOT NULL,
	"service_duration_snapshot" text NOT NULL,
	"scheduled_at" timestamp NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "companies" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"address" text,
	"contact" text,
	"owner_id" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"subscription_status" text DEFAULT 'trial' NOT NULL,
	"trial_ends_at" timestamp DEFAULT now(),
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"access_type" text DEFAULT 'automatic' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "companies_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "company_site_customizations" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"layout_global" jsonb DEFAULT '{"header":{"backgroundAndEffect":{"color":"#ffffff","opacity":0.95,"blur":10},"textColors":{"logo":"#000000","links":"#333333","hover":"#000000"},"actionButtons":{"backgroundColor":"#000000","textColor":"#ffffff"}},"typography":{"headingsFont":"Inter","subheadingsFont":"Inter","bodyFont":"Inter"},"siteColors":{"primary":"#000000","secondary":"#333333","background":"#ffffff"},"footer":{"colors":{"background":"#f5f5f5","text":"#333333","icons":"#000000"},"typography":{"headings":"Inter","body":"Inter"},"visibility":true}}'::jsonb NOT NULL,
	"home" jsonb DEFAULT '{"heroBanner":{"visibility":true,"title":{"text":"Sua beleza, nossa prioridade","color":"#000000","font":"Inter","sizeMobile":"32px","sizeDesktop":"48px"},"subtitle":{"text":"Agende seu horário e realce o que você tem de melhor","color":"#666666","font":"Inter","size":"18px"},"ctaButton":{"text":"Agendar Agora","backgroundColor":"#000000","textColor":"#ffffff","borderRadius":"8px","borderColor":"transparent","destinationLink":"/agendamento"},"appearance":{"bgType":"image","backgroundColor":"#ffffff","backgroundImageUrl":"","glassEffect":{"active":false,"intensity":0},"overlay":{"color":"#000000","opacity":0},"verticalAlignment":"center","horizontalAlignment":"center","sectionHeight":"medium"},"bgColor":"#ffffff"},"servicesSection":{"visibility":true,"orderOnHome":1,"header":{"title":{"text":"Nossos Serviços","color":"#000000","font":"Inter","size":"36px"},"subtitle":{"text":"Escolha o tratamento ideal para si","color":"#666666","font":"Inter","size":"16px"},"alignment":"center"},"cardConfig":{"showImage":true,"showCategory":true,"priceStyle":{"visible":true,"color":"#000000","font":"Inter"},"durationStyle":{"visible":true,"color":"#666666"},"cardBackgroundColor":"#ffffff","borderAndShadow":{"borderSize":"1px","shadowIntensity":"small"},"borderRadius":"12px"},"bookingButtonStyle":{"text":"Agendar","backgroundColor":"#000000","textColor":"#ffffff","borderRadius":"6px"}},"valuesSection":{"visibility":true,"orderOnHome":2,"header":{"title":{"text":"Nossos Valores","color":"#000000","font":"Inter","size":"36px"},"subtitle":{"text":"O que nos move todos os dias","color":"#666666","font":"Inter","size":"16px"}},"itemsStyle":{"layout":"grid","itemBackgroundColor":"#f9f9f9","borderRadius":"8px","internalAlignment":"center"},"items":[]},"galleryPreview":{"visibility":true,"orderOnHome":3,"header":{"title":{"text":"Nossa Galeria","color":"#000000","font":"Inter","size":"36px"},"subtitle":{"text":"Confira nossos últimos trabalhos","color":"#666666","font":"Inter","size":"16px"}},"displayLogic":{"selectionMode":"automatic_recent","photoCount":6,"gridLayout":"mosaic"},"photoStyle":{"aspectRatio":"1:1","spacing":"16px","borderRadius":"8px","hoverEffect":"zoom"},"viewMoreButton":{"visible":true,"text":"Ver Galeria Completa","style":{"backgroundColor":"transparent","textColor":"#000000","borderRadius":"4px"}}},"ctaSection":{"visibility":true,"orderOnHome":4,"title":{"text":"Pronto para transformar seu olhar?","color":"#ffffff","font":"Inter","size":{"desktop":"42px","mobile":"28px"}},"subtitle":{"text":"Reserve seu horário em menos de 1 minuto.","color":"#f0f0f0","font":"Inter","size":"18px"},"conversionButton":{"text":"Agendar Agora","style":{"backgroundColor":"#ffffff","textColor":"#000000","borderColor":"transparent"},"borderRadius":"8px"},"designConfig":{"backgroundType":"solid_color","colorOrImageUrl":"#000000","glassEffect":{"active":false,"intensity":0},"borders":{"top":false,"bottom":false},"padding":"60px","alignment":"center"}}}'::jsonb NOT NULL,
	"gallery" jsonb DEFAULT '{"gridConfig":{"columns":3,"gap":"24px"},"interactivity":{"enableLightbox":true,"showCaptions":true}}'::jsonb NOT NULL,
	"about_us" jsonb DEFAULT '{"aboutBanner":{"visibility":true,"title":"Sobre Nós","backgroundImageUrl":""},"ourStory":{"visibility":true,"title":"Nossa História","text":"Começamos com um sonho...","imageUrl":""},"ourValues":[],"ourTeam":[],"testimonials":[]}'::jsonb NOT NULL,
	"appointment_flow" jsonb DEFAULT '{"colors":{"primary":"#000000","secondary":"#333333","background":"#ffffff","text":"#000000"},"step1Services":{"title":"Selecione o Serviço","showPrices":true,"showDurations":true,"cardConfig":{"backgroundColor":"TRANSPARENT_DEFAULT"}},"step2Date":{"title":"Escolha a Data","calendarStyle":"modern"},"step3Times":{"title":"Escolha o Horário","timeSlotStyle":"grid","timeSlotSize":30},"step4Confirmation":{"title":"Confirme seu Agendamento","requireLogin":false}}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "company_site_customizations_company_id_unique" UNIQUE("company_id")
);
--> statement-breakpoint
CREATE TABLE "fixed_expenses" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"description" text NOT NULL,
	"value" numeric(10, 2) NOT NULL,
	"category" text NOT NULL,
	"type" text DEFAULT 'FIXO' NOT NULL,
	"total_installments" integer DEFAULT 1,
	"current_installment" integer DEFAULT 1,
	"parent_id" text,
	"due_date" timestamp NOT NULL,
	"is_paid" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "google_calendar_configs" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"ical_url" text,
	"sync_status" text DEFAULT 'INACTIVE' NOT NULL,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"name" text NOT NULL,
	"initial_quantity" numeric(10, 2) NOT NULL,
	"current_quantity" numeric(10, 2) NOT NULL,
	"min_quantity" numeric(10, 2) NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"unit" text NOT NULL,
	"secondary_unit" text,
	"conversion_factor" numeric(10, 2),
	"is_shared" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"inventory_id" text NOT NULL,
	"type" text NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"reason" text NOT NULL,
	"company_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operating_hours" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"day_of_week" text NOT NULL,
	"status" text NOT NULL,
	"morning_start" text,
	"morning_end" text,
	"afternoon_start" text,
	"afternoon_end" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prospects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"establishment_name" text NOT NULL,
	"instagram_link" text,
	"status" text DEFAULT 'NOT_CONTACTED' NOT NULL,
	"category" text NOT NULL,
	"location" text,
	"address" text,
	"maps_link" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "service_resources" (
	"id" text PRIMARY KEY NOT NULL,
	"service_id" text NOT NULL,
	"inventory_id" text NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"unit" text NOT NULL,
	"use_secondary_unit" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price" numeric(10, 2) NOT NULL,
	"duration" text NOT NULL,
	"icon" text,
	"is_visible" boolean DEFAULT true NOT NULL,
	"show_on_home" boolean DEFAULT false NOT NULL,
	"advanced_rules" jsonb DEFAULT '{"conflicts":[]}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "site_drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"layout_global" jsonb DEFAULT '{"header":{"backgroundAndEffect":{"color":"#ffffff","opacity":0.95,"blur":10},"textColors":{"logo":"#000000","links":"#333333","hover":"#000000"},"actionButtons":{"backgroundColor":"#000000","textColor":"#ffffff"}},"typography":{"headingsFont":"Inter","subheadingsFont":"Inter","bodyFont":"Inter"},"siteColors":{"primary":"#000000","secondary":"#333333","background":"#ffffff"},"footer":{"colors":{"background":"#f5f5f5","text":"#333333","icons":"#000000"},"typography":{"headings":"Inter","body":"Inter"},"visibility":true}}'::jsonb NOT NULL,
	"home" jsonb DEFAULT '{"heroBanner":{"visibility":true,"title":{"text":"Sua beleza, nossa prioridade","color":"#000000","font":"Inter","sizeMobile":"32px","sizeDesktop":"48px"},"subtitle":{"text":"Agende seu horário e realce o que você tem de melhor","color":"#666666","font":"Inter","size":"18px"},"ctaButton":{"text":"Agendar Agora","backgroundColor":"#000000","textColor":"#ffffff","borderRadius":"8px","borderColor":"transparent","destinationLink":"/agendamento"},"appearance":{"bgType":"image","backgroundColor":"#ffffff","backgroundImageUrl":"","glassEffect":{"active":false,"intensity":0},"overlay":{"color":"#000000","opacity":0},"verticalAlignment":"center","horizontalAlignment":"center","sectionHeight":"medium"},"bgColor":"#ffffff"},"servicesSection":{"visibility":true,"orderOnHome":1,"header":{"title":{"text":"Nossos Serviços","color":"#000000","font":"Inter","size":"36px"},"subtitle":{"text":"Escolha o tratamento ideal para si","color":"#666666","font":"Inter","size":"16px"},"alignment":"center"},"cardConfig":{"showImage":true,"showCategory":true,"priceStyle":{"visible":true,"color":"#000000","font":"Inter"},"durationStyle":{"visible":true,"color":"#666666"},"cardBackgroundColor":"#ffffff","borderAndShadow":{"borderSize":"1px","shadowIntensity":"small"},"borderRadius":"12px"},"bookingButtonStyle":{"text":"Agendar","backgroundColor":"#000000","textColor":"#ffffff","borderRadius":"6px"}},"valuesSection":{"visibility":true,"orderOnHome":2,"header":{"title":{"text":"Nossos Valores","color":"#000000","font":"Inter","size":"36px"},"subtitle":{"text":"O que nos move todos os dias","color":"#666666","font":"Inter","size":"16px"}},"itemsStyle":{"layout":"grid","itemBackgroundColor":"#f9f9f9","borderRadius":"8px","internalAlignment":"center"},"items":[]},"galleryPreview":{"visibility":true,"orderOnHome":3,"header":{"title":{"text":"Nossa Galeria","color":"#000000","font":"Inter","size":"36px"},"subtitle":{"text":"Confira nossos últimos trabalhos","color":"#666666","font":"Inter","size":"16px"}},"displayLogic":{"selectionMode":"automatic_recent","photoCount":6,"gridLayout":"mosaic"},"photoStyle":{"aspectRatio":"1:1","spacing":"16px","borderRadius":"8px","hoverEffect":"zoom"},"viewMoreButton":{"visible":true,"text":"Ver Galeria Completa","style":{"backgroundColor":"transparent","textColor":"#000000","borderRadius":"4px"}}},"ctaSection":{"visibility":true,"orderOnHome":4,"title":{"text":"Pronto para transformar seu olhar?","color":"#ffffff","font":"Inter","size":{"desktop":"42px","mobile":"28px"}},"subtitle":{"text":"Reserve seu horário em menos de 1 minuto.","color":"#f0f0f0","font":"Inter","size":"18px"},"conversionButton":{"text":"Agendar Agora","style":{"backgroundColor":"#ffffff","textColor":"#000000","borderColor":"transparent"},"borderRadius":"8px"},"designConfig":{"backgroundType":"solid_color","colorOrImageUrl":"#000000","glassEffect":{"active":false,"intensity":0},"borders":{"top":false,"bottom":false},"padding":"60px","alignment":"center"}}}'::jsonb NOT NULL,
	"gallery" jsonb DEFAULT '{"gridConfig":{"columns":3,"gap":"24px"},"interactivity":{"enableLightbox":true,"showCaptions":true}}'::jsonb NOT NULL,
	"about_us" jsonb DEFAULT '{"aboutBanner":{"visibility":true,"title":"Sobre Nós","backgroundImageUrl":""},"ourStory":{"visibility":true,"title":"Nossa História","text":"Começamos com um sonho...","imageUrl":""},"ourValues":[],"ourTeam":[],"testimonials":[]}'::jsonb NOT NULL,
	"appointment_flow" jsonb DEFAULT '{"colors":{"primary":"#000000","secondary":"#333333","background":"#ffffff","text":"#000000"},"step1Services":{"title":"Selecione o Serviço","showPrices":true,"showDurations":true,"cardConfig":{"backgroundColor":"TRANSPARENT_DEFAULT"}},"step2Date":{"title":"Escolha a Data","calendarStyle":"modern"},"step3Times":{"title":"Escolha o Horário","timeSlotStyle":"grid","timeSlotSize":30},"step4Confirmation":{"title":"Confirme seu Agendamento","requireLogin":false}}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "site_drafts_company_id_unique" UNIQUE("company_id")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" text DEFAULT 'USER' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"notify_new_appointments" boolean DEFAULT true NOT NULL,
	"notify_cancellations" boolean DEFAULT true NOT NULL,
	"notify_inventory_alerts" boolean DEFAULT true NOT NULL,
	"account_status" text DEFAULT 'ACTIVE' NOT NULL,
	"cancellation_requested_at" timestamp,
	"retention_ends_at" timestamp,
	"last_retention_discount_at" timestamp,
	"has_completed_onboarding" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_cancellation_feedback" ADD CONSTRAINT "account_cancellation_feedback_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agenda_blocks" ADD CONSTRAINT "agenda_blocks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_items" ADD CONSTRAINT "appointment_items_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_items" ADD CONSTRAINT "appointment_items_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_customer_id_user_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_profiles" ADD CONSTRAINT "business_profiles_business_id_companies_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_site_customizations" ADD CONSTRAINT "company_site_customizations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_expenses" ADD CONSTRAINT "fixed_expenses_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_images" ADD CONSTRAINT "gallery_images_business_id_companies_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_calendar_configs" ADD CONSTRAINT "google_calendar_configs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_logs" ADD CONSTRAINT "inventory_logs_inventory_id_inventory_id_fk" FOREIGN KEY ("inventory_id") REFERENCES "public"."inventory"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_logs" ADD CONSTRAINT "inventory_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operating_hours" ADD CONSTRAINT "operating_hours_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_resources" ADD CONSTRAINT "service_resources_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_resources" ADD CONSTRAINT "service_resources_inventory_id_inventory_id_fk" FOREIGN KEY ("inventory_id") REFERENCES "public"."inventory"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_drafts" ADD CONSTRAINT "site_drafts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");