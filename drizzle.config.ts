import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

// Carrega o .env.local se existir, senão carrega o .env
dotenv.config({ path: ".env.local" });
dotenv.config();

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
