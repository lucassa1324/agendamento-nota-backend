const { auth } = require("./src/modules/infrastructure/auth/auth");

console.log("signInEmail:", typeof auth.api.signInEmail);
console.log("signInEmail.toString().slice(0,300):", String(auth.api.signInEmail).slice(0, 300));

(async () => {
  // Pass ctx.request directly — this is what the endpoint handler expects
  try {
    console.log("\n=== Test: Pass ctx.request directly ===");
    const fakeCtx = {
      request: new Request("http://localhost:3001/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Origin": "http://localhost:3001", "Accept": "application/json" },
        body: JSON.stringify({ email: "test@test.com", password: "123456" }),
      }),
      context: {},
      body: { email: "test@test.com", password: "123456" },
    };

    const result = await auth.api.signInEmail(fakeCtx);
    console.log("Result:", JSON.stringify(result, null, 2).slice(0, 300));
  } catch (e) {
    console.error("ERROR:", e.message);
  }

  // Also try with just body as the argument
  try {
    console.log("\n=== Test: Just body object ===");
    const result = await auth.api.signInEmail({
      email: "test@test.com",
      password: "123456",
      callbackURL: undefined,
      rememberMe: undefined,
    });
    console.log("Result:", JSON.stringify(result, null, 2).slice(0, 300));
  } catch (e) {
    console.error("ERROR:", e.message);
    console.error("Stack:", (e.stack || "").slice(0, 300));
  }

  // Try AuthRequest-like
  try {
    console.log("\n=== Test: AuthRequest with body directly ===");
    const result = await auth.api.signInEmail({ 
      body: { email: "test@test.com", password: "123456" }, 
      context: {} 
    });
    console.log("Result:", JSON.stringify(result, null, 2).slice(0, 300));
  } catch (e) {
    console.error("ERROR:", e.message);
  }
})();
