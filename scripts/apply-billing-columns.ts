import dotenv from "dotenv";
import postgres from "postgres";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env.production" });
dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL não definida.");
}

const sql = postgres(connectionString);

try {
  await sql.unsafe(
    'ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "billing_anchor_day" integer;',
  );
  await sql.unsafe(
    'ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "billing_grace_ends_at" timestamp;',
  );
  await sql.unsafe(
    'ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "billing_day_last_changed_at" timestamp;',
  );

  // Compatibilidade com schema atual de autenticação (Better Auth + Drizzle)
  await sql.unsafe(
    'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "cpf_cnpj" text;',
  );
  await sql.unsafe(
    'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "accepted_terms" boolean DEFAULT false NOT NULL;',
  );
  await sql.unsafe(
    'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "accepted_terms_at" timestamp;',
  );
  await sql.unsafe(
    'ALTER TABLE IF EXISTS public."user" ADD COLUMN IF NOT EXISTS "cpf_cnpj" text;',
  );
  await sql.unsafe(
    'ALTER TABLE IF EXISTS public."user" ADD COLUMN IF NOT EXISTS "accepted_terms" boolean DEFAULT false NOT NULL;',
  );
  await sql.unsafe(
    'ALTER TABLE IF EXISTS public."user" ADD COLUMN IF NOT EXISTS "accepted_terms_at" timestamp;',
  );

  console.log("Colunas de billing/auth aplicadas com sucesso.");
} finally {
  await sql.end();
}
