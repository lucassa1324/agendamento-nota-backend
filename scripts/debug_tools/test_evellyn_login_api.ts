import { fetch } from "bun";

async function testLogin() {
  const email = "evellyn@gmail.com";
  const password = "Mudar@123";

  console.log(`Testing login for ${email}...`);

  // Tenta diferentes endpoints comuns para descobrir onde o BA está montado
  const endpoints = [
    "http://localhost:3001/api/auth/sign-in/email",
    "http://localhost:3001/sign-in/email",
    "http://localhost:3001/api/auth/ok"
  ];

  for (const url of endpoints) {
    console.log(`\n--- Testing ${url} ---`);
    try {
      const response = await fetch(url, {
        method: url.includes("ok") ? "GET" : "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: url.includes("ok") ? undefined : JSON.stringify({ email, password })
      });

      const status = response.status;
      const text = await response.text();
      console.log("Status:", status);
      console.log("Raw Response:", text);

      if (status === 200 && text) {
        try {
          const data = JSON.parse(text);
          if (data.user || data.session) {
            console.log("SUCCESS: Login works!");
            return;
          }
        } catch (e) {
          // not json
        }
      }
    } catch (e: any) {
      console.log(`Error testing ${url}:`, e.message);
    }
  }

  console.log("\nFAILED: All login attempts failed.");
}

testLogin();
