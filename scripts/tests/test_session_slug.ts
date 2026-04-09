import { fetch } from "bun";

async function testSession() {
  const email = "evellyn@gmail.com";
  const password = "Mudar@123";

  console.log(`\n1. Realizando login para obter token...`);
  const loginUrl = "http://localhost:3001/api/auth/sign-in/email";
  const loginRes = await fetch(loginUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const loginData = await loginRes.json();
  const token = loginData.token;
  
  if (!token) {
    console.error("Login falhou, sem token.");
    return;
  }

  console.log(`Login OK. Token: ${token.substring(0, 10)}...`);
  console.log(`Slug no sign-in: ${loginData.user?.slug}`);

  console.log(`\n2. Testando /get-session com o token...`);
  const sessionUrl = "http://localhost:3001/get-session";
  const sessionRes = await fetch(sessionUrl, {
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });

  const sessionData = await sessionRes.json();
  console.log("Status /get-session:", sessionRes.status);
  console.log("Response /get-session:", JSON.stringify(sessionData, null, 2));

  if (sessionData.user && sessionData.user.slug) {
    console.log(`\n✅ SUCESSO: O endpoint /get-session retornou o slug: ${sessionData.user.slug}`);
  } else {
    console.log(`\n❌ FALHA: O endpoint /get-session NÃO retornou o slug.`);
  }
}

testSession();
