import { readFile } from "node:fs/promises";
import path from "node:path";

const normalizeEnvValue = (value?: string) =>
  value?.trim().replace(/^['"]|['"]$/g, "") || "";

const extractEnvValueFromContent = (content: string, key: string) => {
  const regex = new RegExp(`^${key}=(.*)$`, "m");
  const match = content.match(regex);
  return match?.[1] ? normalizeEnvValue(match[1]) : "";
};

async function checkAsaasConnection() {
  console.log("🔍 Iniciando diagnóstico de conexão com Asaas...");

  let asaasApiKey = process.env.ASAAS_API_KEY || "";
  let asaasApiUrl = process.env.ASAAS_API_URL || "https://api-sandbox.asaas.com/v3";

  // Tentar carregar do .env.local se não estiver no process.env
  if (!asaasApiKey) {
    try {
      const envPath = path.join(process.cwd(), ".env.local");
      const content = await readFile(envPath, "utf8");
      asaasApiKey = extractEnvValueFromContent(content, "ASAAS_API_KEY") ||
        extractEnvValueFromContent(content, "ASAAS_ACCESS_TOKEN");
      const url = extractEnvValueFromContent(content, "ASAAS_API_URL") ||
        extractEnvValueFromContent(content, "ASAAS_BASE_URL");
      if (url) {
        asaasApiUrl = url.endsWith("/v3") ? url : `${url}/v3`;
      }
      console.log("📝 Credenciais carregadas do .env.local");
    } catch (e) {
      console.log("⚠️ Não foi possível ler .env.local");
    }
  }

  if (!asaasApiKey) {
    console.error("❌ Erro: ASAAS_API_KEY não encontrada nas variáveis de ambiente ou .env.local");
    process.exit(1);
  }

  console.log(`🌐 Usando URL: ${asaasApiUrl}`);
  console.log(`🔑 API Key (final): ${asaasApiKey.substring(0, 10)}...`);

  try {
    console.log("📡 Testando chamada GET /v3/customers...");
    const response = await fetch(`${asaasApiUrl}/customers?limit=1`, {
      headers: {
        'access_token': asaasApiKey,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json() as any;

    if (response.ok) {
      console.log("✅ Conexão com Asaas estabelecida com sucesso!");
      console.log(`📊 Total de clientes encontrados: ${data.totalCount || 0}`);
    } else {
      console.error("❌ Erro na resposta do Asaas:");
      console.error(`Status: ${response.status} ${response.statusText}`);
      console.error("Detalhes:", JSON.stringify(data.errors || data, null, 2));

      if (data.errors?.[0]?.code === 'invalid_access_token') {
        console.error("\n💡 Dica: Sua API Key parece estar incorreta ou expirada.");
      }
    }
  } catch (error: any) {
    console.error("❌ Erro ao tentar conectar com o Asaas:");
    console.error(error.message);
  }
}

checkAsaasConnection();
