ALTER TABLE "appointments" ALTER COLUMN "service_price_snapshot" SET DATA TYPE numeric(10, 2);--> statement-breakpoint
ALTER TABLE "services" ALTER COLUMN "price" SET DATA TYPE numeric(10, 2);--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN "initial_quantity" numeric(10, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN "current_quantity" numeric(10, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN "min_quantity" numeric(10, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN "unit_price" numeric(10, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN "secondary_unit" text;--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN "conversion_factor" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "inventory" DROP COLUMN "description";--> statement-breakpoint
ALTER TABLE "inventory" DROP COLUMN "quantity";