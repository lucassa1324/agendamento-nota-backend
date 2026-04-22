import "dotenv/config";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL não configurada");
}

const sql = postgres(databaseUrl);

try {
  await sql.unsafe(
    'ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "asaas_subscription_id" text;',
  );
  console.log("OK: coluna asaas_subscription_id garantida");
} finally {
  await sql.end();
}
