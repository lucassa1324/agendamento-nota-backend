
import postgres from "postgres";
import { v4 as uuidv4 } from "uuid";

// O erro de linter "Cannot find name Bun" ocorre porque o TS não reconhece o global do Bun em scripts isolados.
// Como o script é rodado com 'bun run', ele funciona perfeitamente na execução.
declare const Bun: any;

// --- CONFIGURAÇÃO LOCAL ---
const TARGET_URL = "postgres://postgres:admin123@localhost:5432/postgres"; // URL Local (Docker)
const target = postgres(TARGET_URL);

async function setPassword() {
  const email = "lucassa1324@gmail.com";
  const password = "admin123"; // SENHA PADRÃO PARA DESENVOLVIMENTO

  console.log(`🚀 Definindo senha para o Super Admin: ${email}`);

  try {
    // 1. Buscar o ID do usuário
    const [user] = await target.unsafe(`SELECT id FROM "user" WHERE email = $1`, [email]);

    if (!user) {
      console.error("❌ Erro: Usuário não encontrado no banco local.");
      process.exit(1);
    }

    // 2. Gerar o hash da senha usando o padrão do projeto (argon2id via Bun)
    const passwordHash = await Bun.password.hash(password, { algorithm: "argon2id" });

    // 3. Inserir ou atualizar na tabela 'account'
    // O BetterAuth espera providerId = 'credential' para login por email/senha
    const [existingAccount] = await target.unsafe(
      `SELECT id FROM "account" WHERE user_id = $1 AND provider_id = 'credential'`,
      [user.id]
    );

    if (existingAccount) {
      await target.unsafe(
        `UPDATE "account" SET "password" = $1, "updated_at" = NOW() WHERE id = $2`,
        [passwordHash, existingAccount.id]
      );
      console.log(`✅ Senha atualizada para o usuário.`);
    } else {
      const accountId = uuidv4();
      await target.unsafe(`
        INSERT INTO "account" (
          "id", "user_id", "account_id", "provider_id", "password", "created_at", "updated_at"
        ) VALUES (
          $1, $2, $3, $4, $5, NOW(), NOW()
        )
      `, [accountId, user.id, email, "credential", passwordHash]);
      console.log(`✅ Novo registro de autenticação criado.`);
    }

    console.log("\n===================================================");
    console.log("🔑 SENHA DEFINIDA COM SUCESSO!");
    console.log(`📧 Email: ${email}`);
    console.log(`🔓 Senha: ${password}`);
    console.log("---------------------------------------------------");
    console.log("💡 Agora você pode logar localmente com estas credenciais.");
    console.log("===================================================");

  } catch (error: any) {
    console.error("\n💥 ERRO AO DEFINIR SENHA:", error.message);
  } finally {
    await target.end();
    process.exit();
  }
}

setPassword();
