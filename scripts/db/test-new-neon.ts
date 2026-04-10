import postgres from "postgres";

const NEW_NEON_URL = "postgresql://neondb_owner:npg_9pmJlr6etKHE@ep-little-math-ah9b7sm0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

async function main() {
  const client = postgres(NEW_NEON_URL);

  console.log(">>> Testando conexão com a NOVA URL do Neon...");
  
  try {
    const query = await client`SELECT 1 as connected`;
    if (query[0].connected === 1) {
      console.log("\n[SUCESSO] Conexão estabelecida com sucesso!");
      
      const userCheck = await client`SELECT id, email, role FROM "user" WHERE email = 'lucassa1324@gmail.com'`;
      if (userCheck.length > 0) {
        console.log("\n[INFO] Usuário já existe:");
        console.table(userCheck);
      } else {
        console.log("\n[INFO] Usuário lucassa1324@gmail.com NÃO existe nesta base.");
      }
    }
  } catch (error: any) {
    console.error("\n[ERRO] Falha ao conectar à nova URL:", error.message || error);
  } finally {
    await client.end();
  }
}

main();
