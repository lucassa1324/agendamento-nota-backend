
import { db } from "../src/modules/infrastructure/drizzle/database";
import * as schema from "../src/db/schema";
import { eq } from "drizzle-orm";

async function testLogin() {
  const email = "laura3@gmail.com";
  const passwordsToTest = ["Mudar@123", "123123123"];

  console.log(`\n--- TESTANDO LOGIN PARA: ${email} ---\n`);

  const userResult = await db.select().from(schema.user).where(eq(schema.user.email, email)).limit(1);
  const user = userResult[0];

  if (!user) {
    console.log("❌ Usuário não encontrado.");
    return;
  }

  const accountResult = await db.select().from(schema.account).where(eq(schema.account.userId, user.id)).limit(1);
  const account = accountResult[0];

  if (!account || !account.password) {
    console.log("❌ Conta ou senha não encontrada.");
    return;
  }

  const hash = account.password;
  console.log(`Hash no banco: ${hash}\n`);

  for (const pwd of passwordsToTest) {
    const isMatch = await Bun.password.verify(pwd, hash);
    console.log(`Senha [${pwd}]: ${isMatch ? "✅ CORRETA" : "❌ INCORRETA"}`);
  }

  process.exit(0);
}

testLogin().catch(err => {
  console.error(err);
  process.exit(1);
});
