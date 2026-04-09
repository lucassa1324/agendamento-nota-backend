import postgres from "postgres";

const LOCAL_DATABASE_URL = "postgres://postgres:admin123@localhost:5432/postgres";

async function main() {
  const client = postgres(LOCAL_DATABASE_URL);

  console.log(">>> Buscando senha para lucassa1324@gmail.com no banco LOCAL...");
  
  try {
    const query = await client`
      SELECT a.password 
      FROM "user" u 
      JOIN "account" a ON u.id = a.user_id 
      WHERE u.email = 'lucassa1324@gmail.com'
    `;

    if (query.length > 0) {
      console.log("\n[SUCESSO] Senha encontrada no banco LOCAL (Hash):");
      console.log(query[0].password);
    } else {
      console.log("\n[AVISO] Usuário não encontrado no banco LOCAL.");
    }
  } catch (error) {
    console.error("\n[ERRO] Falha ao conectar ou consultar o banco LOCAL:", error);
  } finally {
    await client.end();
  }
}

main();
