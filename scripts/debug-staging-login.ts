type LoginTarget = {
  label: string;
  url: string;
};

const EMAIL = process.env.LOGIN_EMAIL || "lucassa1324@gmail.com";
const PASSWORD = process.env.LOGIN_PASSWORD || "123123123";

const FRONT_URL =
  process.env.STAGING_FRONT_URL || "https://agendamento-nota-front-qmmb.vercel.app";
const BACKEND_URL =
  process.env.STAGING_BACKEND_URL || "https://api.staging.aurasistema.com.br";

const targets: LoginTarget[] = [
  {
    label: "Front direto (/api/auth/sign-in/email)",
    url: `${FRONT_URL}/api/auth/sign-in/email`,
  },
  {
    label: "Front via proxy (/api-proxy/api/auth/sign-in/email)",
    url: `${FRONT_URL}/api-proxy/api/auth/sign-in/email`,
  },
  {
    label: "Backend direto (/api/auth/sign-in/email)",
    url: `${BACKEND_URL}/api/auth/sign-in/email`,
  },
];

function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!name || !domain) return email;
  const visible = name.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(name.length - 2, 1))}@${domain}`;
}

async function readResponseBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch (error) {
    return `[erro ao ler body: ${(error as Error).message}]`;
  }
}

async function testOneTarget(target: LoginTarget) {
  console.log("\n============================================================");
  console.log(`Target: ${target.label}`);
  console.log(`POST ${target.url}`);
  console.log("============================================================");

  try {
    const response = await fetch(target.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        email: EMAIL,
        password: PASSWORD,
      }),
    });

    const body = await readResponseBody(response);
    const setCookie = response.headers.get("set-cookie");
    const contentType = response.headers.get("content-type");

    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Content-Type: ${contentType || "(vazio)"}`);
    console.log(`Set-Cookie: ${setCookie ? "[presente]" : "[ausente]"}`);

    if (body.length > 800) {
      console.log(`Body (truncado): ${body.slice(0, 800)}...`);
    } else {
      console.log(`Body: ${body || "(vazio)"}`);
    }

    return {
      ok: response.ok,
      status: response.status,
      body,
    };
  } catch (error) {
    const message = (error as Error).message;
    console.log(`Erro de rede/fetch: ${message}`);
    return {
      ok: false,
      status: 0,
      body: message,
    };
  }
}

async function main() {
  console.log(">>> DEBUG LOGIN STAGING");
  console.log(`Conta: ${maskEmail(EMAIL)}`);
  console.log(`Front: ${FRONT_URL}`);
  console.log(`Backend: ${BACKEND_URL}`);

  const results = [];
  for (const target of targets) {
    // eslint-disable-next-line no-await-in-loop
    const result = await testOneTarget(target);
    results.push({ target, result });
  }

  console.log("\n==================== RESUMO ====================");
  for (const item of results) {
    console.log(
      `- ${item.target.label}: status=${item.result.status} ok=${item.result.ok}`,
    );
  }

  const anySuccess = results.some((r) => r.result.ok);
  if (!anySuccess) {
    console.log(
      "\nNenhum endpoint retornou sucesso. Verifique rewrites no front, trusted origins e variaveis BETTER_AUTH_URL/FRONTEND_URL no backend.",
    );
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Falha inesperada no script:", error);
  process.exit(1);
});

