import postgres from "postgres";
import { v4 as uuidv4 } from "uuid";

const NEW_NEON_URL = "postgresql://neondb_owner:npg_9pmJlr6etKHE@ep-little-math-ah9b7sm0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

async function main() {
  const client = postgres(NEW_NEON_URL);

  const email = "lucassa1324@gmail.com";
  const password = "123123123";
  const name = "Lucas Sá";

  console.log(`>>> Criando Super Admin: ${email} no Neon...`);
  
  try {
    // 1. Gerar Hash Argon2id usando Bun (já que o projeto usa Bun)
    // Como estamos rodando com tsx/node, vamos usar uma alternativa se o Bun não estiver disponível,
    // mas o ambiente do usuário tem Bun. Vou tentar usar o Bun.password se estiver disponível.
    
    let hashedPassword;
    try {
      // @ts-ignore
      hashedPassword = await Bun.password.hash(password, { algorithm: "argon2id" });
      console.log("[HASH] Hash gerado com Bun.password");
    } catch (e) {
      console.log("[HASH] Bun não detectado, usando hash fixo compatível (ou falhando se necessário)");
      // Se não tiver bun, vamos avisar. Mas o ambiente deve ter.
      throw new Error("Este script deve ser rodado com 'bun run' para gerar o hash compatível com o Better Auth do projeto.");
    }

    const userId = uuidv4();
    const accountId = uuidv4();
    const now = new Date();

    // Iniciar transação
    await client.begin(async (sql) => {
      // 2. Inserir Usuário
      await sql`
        INSERT INTO "user" (id, name, email, role, email_verified, active, created_at, updated_at)
        VALUES (${userId}, ${name}, ${email}, 'SUPER_ADMIN', true, true, ${now}, ${now})
      `;
      console.log("[USER] Usuário inserido.");

      // 3. Inserir Conta (Better Auth)
      await sql`
        INSERT INTO "account" (id, account_id, provider_id, user_id, password, created_at, updated_at)
        VALUES (${accountId}, ${userId}, 'credential', ${userId}, ${hashedPassword}, ${now}, ${now})
      `;
      console.log("[ACCOUNT] Conta de credenciais inserida.");
    });

    console.log("\n[SUCESSO] Super Admin criado com sucesso!");
    console.log(`E-mail: ${email}`);
    console.log(`Senha: ${password}`);

  } catch (error: any) {
    console.error("\n[ERRO]:", error.message || error);
    if (error.message?.includes("duplicate key")) {
      console.log("\n[DICA] O usuário já existe. Se quiser resetar a senha, use um script de UPDATE.");
    }
  } finally {
    await client.end();
  }
}

main();
