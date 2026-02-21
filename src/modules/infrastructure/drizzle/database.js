import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
if (!process.env.DATABASE_URL) {
    console.error("CRITICAL ERROR: DATABASE_URL is not defined in environment variables.");
}
const dbUrl = process.env.DATABASE_URL || "";
// Configuração resiliente do client Postgres
const queryClient = postgres(dbUrl, {
    prepare: false, // Otimização para serverless (evita prepared statements cacheados que falham em conexões pooladas)
    connect_timeout: 10, // Timeout curto para falhar rápido se a conexão estiver ruim
});
export const db = drizzle(queryClient, { logger: true });
