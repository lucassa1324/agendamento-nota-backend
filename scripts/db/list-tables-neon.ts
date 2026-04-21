import postgres from "postgres";

const NEW_NEON_URL = "postgresql://neondb_owner:npg_9pmJlr6etKHE@ep-little-math-ah9b7sm0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

async function main() {
  const client = postgres(NEW_NEON_URL);

  console.log(">>> Listando tabelas na NOVA URL do Neon...");
  
  try {
    const tables = await client`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
    console.log("\n[TABELAS ENCONTRADAS]");
    console.table(tables);
  } catch (error: any) {
    console.error("\n[ERRO]:", error.message || error);
  } finally {
    await client.end();
  }
}

main();
