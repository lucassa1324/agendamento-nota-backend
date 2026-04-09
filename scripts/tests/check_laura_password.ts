
import { db } from "../src/modules/infrastructure/drizzle/database";
import * as schema from "../src/db/schema";
import { eq } from "drizzle-orm";

async function checkPassword() {
  const email = "laura3@gmail.com";
  console.log(`\n--- VERIFICANDO USUÁRIO: ${email} ---\n`);

  const userResult = await db.select().from(schema.user).where(eq(schema.user.email, email)).limit(1);
  const foundUser = userResult[0];

  if (!foundUser) {
    console.log("❌ Usuário não encontrado na tabela 'user'.");
    return;
  }

  console.log(`ID do Usuário: ${foundUser.id}`);

  const accountResult = await db.select().from(schema.account).where(eq(schema.account.userId, foundUser.id)).limit(1);
  const foundAccount = accountResult[0];

  if (!foundAccount) {
    console.log("❌ Conta (credenciais) não encontrada na tabela 'account'.");
    return;
  }

  console.log(`Hash da Senha no Banco: ${foundAccount.password}`);

  if (foundAccount.password?.startsWith("$argon2id$")) {
    console.log("✅ Algoritmo: Argon2id (Migrado)");
  } else {
    console.log("⚠️ Algoritmo: Scrypt ou Outro (Ainda não migrado)");
  }

  process.exit(0);
}

checkPassword().catch(err => {
  console.error(err);
  process.exit(1);
});
