import postgres from "postgres";

const DATABASE_URL = "postgresql://neondb_owner:npg_9pmJlr6etKHE@ep-little-math-ah9b7sm0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

async function main() {
  const sql = postgres(DATABASE_URL);
  const email = "macielsuassuna14@gmail.com";
  // Senha clonada do Banco B (Scrypt hash)
  const passwordHash = "fc835c589cecbeef3a5a2f33906116a6:47b41e36839c7154ee035b6f2d4279768741fa37d1f8a45c6ca6721577c9665290e60a57fc5fa7b8b844dbe31ed94da2f6cf6420ba8e91fdf8b0c5d790f24d6b";

  try {
    console.log(`>>> Atualizando usuário no banco: ${DATABASE_URL.substring(0, 30)}...`);

    await sql.begin(async (tx) => {
      // 1. Atualizar Usuário
      const updatedUser = await tx`
        UPDATE "user" 
        SET 
          role = 'SUPER_ADMIN', 
          email_verified = true, 
          active = true,
          updated_at = NOW()
        WHERE email = ${email}
        RETURNING id
      `;

      if (updatedUser.length === 0) {
        console.log(`[!] Usuário ${email} não encontrado. Criando novo...`);
        // Se não existir, criamos com o ID padrão que usamos antes
        const userId = "mYc5lW9Q9gcJBbeNgF1yUDIoIJfwGW8A";
        await tx`
          INSERT INTO "user" (id, name, email, role, email_verified, active, created_at, updated_at)
          VALUES (${userId}, 'Maciel Gomes Suassuna', ${email}, 'SUPER_ADMIN', true, true, NOW(), NOW())
        `;
        
        await tx`
          INSERT INTO "account" (id, account_id, provider_id, user_id, password, created_at, updated_at)
          VALUES (
            'Fe7sifWVbbr3iLCtVXe9u6Hxoi5QJJsr', 
            ${userId}, 
            'credential', 
            ${userId}, 
            ${passwordHash}, 
            NOW(), 
            NOW()
          )
        `;
        console.log("[+] Usuário e conta criados.");
      } else {
        const userId = updatedUser[0].id;
        console.log(`[+] Usuário ${email} (ID: ${userId}) atualizado para SUPER_ADMIN.`);

        // 2. Atualizar Senha na conta vinculada
        const updatedAccount = await tx`
          UPDATE "account"
          SET 
            password = ${passwordHash},
            updated_at = NOW()
          WHERE user_id = ${userId} AND provider_id = 'credential'
          RETURNING id
        `;

        if (updatedAccount.length === 0) {
          console.log("[!] Conta de credenciais não encontrada. Criando...");
          await tx`
            INSERT INTO "account" (id, account_id, provider_id, user_id, password, created_at, updated_at)
            VALUES (
              ${'acc_' + Math.random().toString(36).substring(2, 11)}, 
              ${userId}, 
              'credential', 
              ${userId}, 
              ${passwordHash}, 
              NOW(), 
              NOW()
            )
          `;
        } else {
          console.log("[+] Senha da conta atualizada.");
        }
      }
    });

    console.log("\n[SUCESSO] Operação concluída no Banco de Nuvem!");

  } catch (error: any) {
    console.error(`[ERRO]:`, error.message || error);
  } finally {
    await sql.end();
  }
}

main();
