
import { Client } from "pg";
import "dotenv/config";

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  await client.connect();

  try {
    console.log("Applying migration 0014...");
    
    // SQL from 0014_account_cancellation.sql
    await client.query(`
      ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "account_status" text DEFAULT 'ACTIVE' NOT NULL;
      ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "cancellation_requested_at" timestamp;
      ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "retention_ends_at" timestamp;
      ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "last_retention_discount_at" timestamp;
      
      CREATE TABLE IF NOT EXISTS "account_cancellation_feedback" (
        "id" text PRIMARY KEY NOT NULL,
        "user_id" text NOT NULL,
        "reason" text NOT NULL,
        "details" text,
        "created_at" timestamp DEFAULT now() NOT NULL
      );
      
      DO $$ BEGIN
        ALTER TABLE "account_cancellation_feedback" ADD CONSTRAINT "account_cancellation_feedback_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    console.log("Migration 0014 applied successfully!");
    
  } catch (err) {
    console.error("Error applying migration:", err);
  } finally {
    await client.end();
  }
}

main();
