import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config({ path: ".env.production" });

const DATABASE_URL_A = process.env.DATABASE_URL;

if (!DATABASE_URL_A) {
  throw new Error("DATABASE_URL não definida em .env.production");
}

const macielData = {
  user: {
    id: "mYc5lW9Q9gcJBbeNgF1yUDIoIJfwGW8A",
    name: "Maciel Gomes Suassuna",
    email: "macielsuassuna14@gmail.com",
    email_verified: true, // Forçando verificado para facilitar
    active: true,
    role: "SUPER_ADMIN",
    created_at: "2026-02-20T20:52:47.450Z",
    updated_at: "2026-02-20T20:53:12.964Z",
  },
  account: {
    id: "Fe7sifWVbbr3iLCtVXe9u6Hxoi5QJJsr",
    account_id: "mYc5lW9Q9gcJBbeNgF1yUDIoIJfwGW8A",
    provider_id: "credential",
    user_id: "mYc5lW9Q9gcJBbeNgF1yUDIoIJfwGW8A",
    password: "fc835c589cecbeef3a5a2f33906116a6:47b41e36839c7154ee035b6f2d4279768741fa37d1f8a45c6ca6721577c9665290e60a57fc5fa7b8b844dbe31ed94da2f6cf6420ba8e91fdf8b0c5d790f24d6b",
    created_at: "2026-02-20T20:52:47.499Z",
    updated_at: "2026-02-20T20:52:47.499Z",
  }
};

async function main() {
  const sql = postgres(DATABASE_URL_A);

  try {
    console.log(`>>> Clonando usuário ${macielData.user.email} para o Banco A...`);

    await sql.begin(async (tx) => {
      // 1. Inserir ou Atualizar Usuário
      await tx`
        INSERT INTO "user" (id, name, email, role, email_verified, active, created_at, updated_at)
        VALUES (
          ${macielData.user.id}, 
          ${macielData.user.name}, 
          ${macielData.user.email}, 
          ${macielData.user.role}, 
          ${macielData.user.email_verified}, 
          ${macielData.user.active}, 
          ${macielData.user.created_at}, 
          ${macielData.user.updated_at}
        )
        ON CONFLICT (email) DO UPDATE SET 
          role = EXCLUDED.role,
          updated_at = NOW()
      `;
      console.log("[USER] Usuário inserido/atualizado.");

      // 2. Inserir ou Atualizar Conta
      await tx`
        INSERT INTO "account" (id, account_id, provider_id, user_id, password, created_at, updated_at)
        VALUES (
          ${macielData.account.id}, 
          ${macielData.account.account_id}, 
          ${macielData.account.provider_id}, 
          ${macielData.account.user_id}, 
          ${macielData.account.password}, 
          ${macielData.account.created_at}, 
          ${macielData.account.updated_at}
        )
        ON CONFLICT (id) DO NOTHING
      `;
      console.log("[ACCOUNT] Conta de credenciais inserida (se não existia).");
    });

    console.log("\n[SUCESSO] Operação concluída com sucesso no Banco A!");

  } catch (error: any) {
    console.error(`[ERRO]:`, error.message || error);
  } finally {
    await sql.end();
  }
}

main();
