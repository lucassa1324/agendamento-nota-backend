import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const DATABASE_URL = "postgresql://neondb_owner:npg_Mmy0tQl2CTKS@ep-steep-base-a4rcsq71-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const user = pgTable("user", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
});

const account = pgTable("account", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  password: text("password"),
});

async function main() {
  const client = postgres(DATABASE_URL);
  const db = drizzle(client);

  console.log(">>> Buscando senha para lucassa1324@gmail.com no Neon...");
  
  try {
    const results = await db
      .select({
        email: user.email,
        password: account.password,
      })
      .from(user)
      .innerJoin(account, (user, account) => ({
        on: (user, account) => {
          // In Drizzle ORM v2 syntax might be different, 
          // but I'll use a simpler query if needed.
          // Let's use raw query for simplicity and certainty.
          return;
        }
      }))
      .where((user) => ({
        on: (user) => {
           return;
        }
      }));

    // Actually, let's use a simpler approach with raw SQL to avoid Drizzle version issues
    const query = await client`
      SELECT a.password 
      FROM "user" u 
      JOIN "account" a ON u.id = a.user_id 
      WHERE u.email = 'lucassa1324@gmail.com'
    `;

    if (query.length > 0) {
      console.log("\n[SUCESSO] Senha encontrada (Hash):");
      console.log(query[0].password);
    } else {
      console.log("\n[AVISO] Usuário não encontrado ou sem senha definida no Neon.");
    }
  } catch (error) {
    console.error("\n[ERRO] Falha ao conectar ou consultar o Neon:", error);
  } finally {
    await client.end();
  }
}

main();
