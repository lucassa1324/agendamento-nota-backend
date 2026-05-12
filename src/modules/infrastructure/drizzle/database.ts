import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

if (!process.env.DATABASE_URL) {
    console.error("CRITICAL ERROR: DATABASE_URL is not defined in environment variables.");
}

const dbUrl = process.env.DATABASE_URL || "";

if (dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1")) {
    console.log(">>> [DB] Conectado ao PostgreSQL Local (Docker) na porta 5432");
}

let _queryClient: ReturnType<typeof postgres> | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

export function getDB() {
    if (_db) {
        return _db;
    }

    // Configuração resiliente do client Postgres (lazy)
    _queryClient = postgres(dbUrl, {
        prepare: false, // Otimização para serverless
        connect_timeout: 10,
        idle_timeout: 20, // Fecha conexões inativas após 20s
        max_lifetime: 60 * 30, // Vida máxima de uma conexão (30 min)
    });

    _db = drizzle(_queryClient, {
        logger: process.env.NODE_ENV === "production" ? false : true
    });

    console.log("[DB] Instância do banco inicializada sob demanda");
    return _db;
}

// Mantém a exportação para compatibilidade, mas agora é lazy
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
    get(target, prop) {
        const database = getDB();
        return (database as any)[prop];
    }
});
