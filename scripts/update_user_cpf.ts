import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { user } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const normalizeEnvValue = (value?: string) =>
  value?.trim().replace(/^['"]|['"]$/g, "") || "";

const extractEnvValueFromContent = (content: string, key: string) => {
  const regex = new RegExp(`^${key}=(.*)$`, "m");
  const match = content.match(regex);
  return match?.[1] ? normalizeEnvValue(match[1]) : "";
};

async function updateCpf() {
  console.log("🚀 Iniciando atualização de CPF no banco Neon...");

  let databaseUrl = "";
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    const content = await readFile(envPath, "utf8");
    databaseUrl = extractEnvValueFromContent(content, "DATABASE_URL");
  } catch (e) {
    console.error("❌ Não foi possível ler .env.local");
    process.exit(1);
  }

  if (!databaseUrl) {
    console.error("❌ DATABASE_URL não encontrada no .env.local");
    process.exit(1);
  }

  console.log("🔗 Conectando ao banco de dados...");
  const queryClient = postgres(databaseUrl);
  const db = drizzle(queryClient);

  const targetEmail = "atrossilva2019@gmail.com";
  const newCpf = "13228359425";

  try {
    console.log(`🔎 Buscando usuário com email: ${targetEmail}`);
    const result = await db.update(user)
      .set({ cpfCnpj: newCpf })
      .where(eq(user.email, targetEmail))
      .returning();

    if (result.length > 0) {
      console.log(`✅ CPF atualizado com sucesso para o usuário: ${result[0].name}`);
      console.log(`📄 Novo CPF cadastrado: ${result[0].cpfCnpj}`);
    } else {
      console.log(`⚠️ Nenhum usuário encontrado com o email: ${targetEmail}`);
    }
  } catch (error) {
    console.error("❌ Erro ao atualizar CPF:", error);
  } finally {
    await queryClient.end();
    process.exit(0);
  }
}

updateCpf();
