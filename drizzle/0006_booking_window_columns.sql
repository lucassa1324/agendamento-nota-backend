ALTER TABLE "business_profiles" ADD COLUMN "booking_window_type" text DEFAULT 'UNLIMITED' NOT NULL;
ALTER TABLE "business_profiles" ADD COLUMN "booking_window_days" integer DEFAULT 30;
