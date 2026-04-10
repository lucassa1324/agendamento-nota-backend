
import postgres from "postgres";
import { v4 as uuidv4 } from "uuid";

// --- CONFIGURAÇÃO LOCAL ---
const TARGET_URL = "postgres://postgres:admin123@localhost:5432/postgres"; // URL Local (Docker)
const target = postgres(TARGET_URL);

async function createSuperAdmin() {
  const email = "lucassa1324@gmail.com";
  const userId = uuidv4();
  
  console.log(`🚀 Iniciando criação de Super Admin local para: ${email}`);

  try {
    // 1. Inserir na tabela 'user'
    await target.unsafe(`
      INSERT INTO "user" (
        "id", "name", "email", "email_verified", "role", "active", "account_status", "has_completed_onboarding", "created_at", "updated_at"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()
      ) ON CONFLICT ("email") DO UPDATE SET "role" = 'SUPER_ADMIN'
    `, [userId, "Lucas Super Admin", email, true, "SUPER_ADMIN", true, "ACTIVE", true]);

    console.log(`✅ Usuário criado/atualizado como SUPER_ADMIN na tabela 'user'.`);

    // 2. Opcional: Se houver uma senha padrão para login local, poderíamos inserir na tabela 'account'
    // Mas geralmente o BetterAuth lida com isso. Se você for usar login por senha, precisará de um hash.
    
    console.log("\n===================================================");
    console.log("🏆 SUPER ADMIN CRIADO COM SUCESSO NO DOCKER!");
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Role: SUPER_ADMIN`);
    console.log("===================================================");

  } catch (error: any) {
    console.error("\n💥 ERRO AO CRIAR SUPER ADMIN:", error.message);
  } finally {
    await target.end();
    process.exit();
  }
}

createSuperAdmin();
