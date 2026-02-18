import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
const dbUrl = process.env.DATABASE_URL;
const queryClient = postgres(dbUrl);
export const db = drizzle(queryClient, { logger: true });
