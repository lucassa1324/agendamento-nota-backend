const { auth } = require("./src/modules/infrastructure/auth/auth");

console.log("signInEmail type:", typeof auth.api.signInEmail);

(async () => {
  // The key question: does signInEmail accept (options), (ctx), or (request)?
  // Cast to any to bypass TS and inspect runtime behavior
  const fn = auth.api.signInEmail;
  
  // Test 1: Does it have a .handler property (is it an AuthEndpoint object)?
  console.log("\n=== Inspecting signInEmail ===");
  console.log("Has handler:", typeof fn.handler);
  console.log("Has options:", typeof fn.options);
  console.log("Own keys:", Object.keys(fn));
  
  // Test 2: Call with Request directly
  try {
    console.log("\n=== Test: Request directly ===");
    const req = new Request("http://localhost:3001/api/auth/sign-in/email", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Origin": "http://localhost:3001" },
      body: JSON.stringify({ email: "test@test.com", password: "123456" }),
    });
    const result = await fn(req);
    console.log("Result:", JSON.stringify(result, null, 2).slice(0, 500));
  } catch (e) {
    console.error("ERROR:", e.message);
  }
  
  // Test 3: Call with ctx = { request, body, context }
  try {
    console.log("\n=== Test: ctx with body ===");
    const result = await fn({
      request: new Request("http://localhost:3001/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Origin": "http://localhost:3001" },
        body: JSON.stringify({ email: "test@test.com", password: "123456" }),
      }),
      body: { email: "test@test.com", password: "123456" },
      context: { options: auth.options },
    });
    console.log("Result:", JSON.stringify(result, null, 2).slice(0, 500));
  } catch (e) {
    console.error("ERROR:", e.message);
  }

  // Test 4: call auth.handler with the Request
  try {
    console.log("\n=== Test: auth.handler(request) ===");
    const req = new Request("http://localhost:3001/api/auth/sign-in/email", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Origin": "http://localhost:3001" },
      body: JSON.stringify({ email: "test@test.com", password: "123456" }),
    });
    // Suppress long timeout by using Promise.race
    const result = await Promise.race([
      auth.handler(req),
      new Promise((_, rej) => setTimeout(() => rej(new Error("TIMEOUT 5s")), 5000)),
    ]);
    console.log("Result:", JSON.stringify(result, null, 2).slice(0, 500));
  } catch (e) {
    console.error("ERROR:", e.message);
  }
})();
