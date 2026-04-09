import { fetch } from "bun";

async function testEvellynDashboard() {
  const email = "evellyn@gmail.com";
  const password = "Mudar@123";

  console.log(`\n--- INICIANDO TESTE DE ACESSO AO DASHBOARD (Evellyn) ---`);

  // 1. Login
  console.log(`1. Realizando login...`);
  const loginUrl = "http://localhost:3001/api/auth/sign-in/email";
  const loginRes = await fetch(loginUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  if (loginRes.status !== 200) {
    console.error(`❌ Erro no login: ${loginRes.status}`);
    console.log(await loginRes.text());
    return;
  }

  const loginData = await loginRes.json();
  const token = loginData.token;
  const user = loginData.user;

  console.log(`✅ Login realizado com sucesso!`);
  console.log(`👤 Usuário: ${user.name} (${user.email})`);
  console.log(`🏷️ Role: ${user.role}`);
  console.log(`🔗 Slug no login: ${user.slug}`);

  const headers = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  };

  // 2. Testar /get-session
  console.log(`\n2. Verificando /get-session...`);
  const sessionRes = await fetch("http://localhost:3001/get-session", { headers });
  const sessionData = await sessionRes.json();
  console.log(`Status: ${sessionRes.status}`);
  console.log(`Slug na sessão: ${sessionData.user?.slug}`);

  // 3. Testar /api/auth/business-info (Endpoint do Plugin)
  console.log(`\n3. Verificando /api/auth/business-info (Plugin)...`);
  const bizInfoRes = await fetch("http://localhost:3001/api/auth/business-info", { headers });
  if (bizInfoRes.status === 200) {
    const bizInfo = await bizInfoRes.json();
    console.log(`✅ Sucesso!`);
    console.log(`🏢 Estúdio: ${bizInfo.business?.name}`);
    console.log(`📍 Slug: ${bizInfo.slug}`);
  } else {
    console.log(`❌ Erro ao buscar business-info: ${bizInfoRes.status}`);
  }

  // 4. Testar /api/business/my (Rota Privada do Controller)
  console.log(`\n4. Verificando /api/business/my (Controller Privado)...`);
  const myBizRes = await fetch("http://localhost:3001/api/business/my", { headers });
  if (myBizRes.status === 200) {
    const myBizList = await myBizRes.json();
    console.log(`✅ Sucesso! Encontrado(s) ${myBizList.length} estúdio(s).`);
    myBizList.forEach((b: any) => {
      console.log(` - ${b.name} (Slug: ${b.slug}, ID: ${b.id})`);
    });
  } else {
    console.log(`❌ Erro ao acessar /api/business/my: ${myBizRes.status}`);
    console.log(await myBizRes.text());
  }

  // 5. Testar /api/appointments (Dashboard Data)
  console.log(`\n5. Verificando acesso a dados do Dashboard (/api/appointments)...`);
  // Note: O endpoint /api/appointments precisa de companyId em algumas rotas ou lista tudo?
  // Vamos tentar o GET base se existir.
  const appointmentsRes = await fetch("http://localhost:3001/api/appointments", { headers });
  console.log(`Status /api/appointments: ${appointmentsRes.status}`);
  if (appointmentsRes.status === 200) {
    console.log(`✅ Acesso ao dashboard confirmado!`);
  } else if (appointmentsRes.status === 404) {
    console.log(`ℹ️ Endpoint /api/appointments base não encontrado (esperado se for apenas sub-rotas).`);
  } else {
    console.log(`❌ Erro de permissão ou rota: ${appointmentsRes.status}`);
  }

  console.log(`\n--- FIM DO TESTE ---`);
}

testEvellynDashboard();
