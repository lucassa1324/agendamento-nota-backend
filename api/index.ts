// Handler para Vercel Serverless usando Factory Pattern
import { createApp } from "../src/index";

export default async function handler(request: Request): Promise<Response> {
  // Instancia sob demanda (evita erro de módulo não instanciado)
  const app = createApp();

  if (!process.env.DATABASE_URL) {
    console.error("[HANDLER] FATAL: DATABASE_URL IS MISSING");
    return new Response(JSON.stringify({ error: "DATABASE_URL_IS_MISSING" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (!process.env.BETTER_AUTH_SECRET) {
    console.warn("[HANDLER] WARNING: BETTER_AUTH_SECRET IS MISSING");
  }

  return await app.fetch(request);
}
