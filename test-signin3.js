const { auth } = require("./src/modules/infrastructure/auth/auth");

(async () => {
  // Use a fetch with a real server to see what the working route does
  console.log("signInEmail:", typeof auth.api.signInEmail);
  
  // Test what params it expects - pass ctx.request directly
  const fakeCtx = {
    request: new Request("http://localhost:3001/api/auth/sign-in/email", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Origin": "http://localhost:3001", "Accept": "application/json" },
      body: JSON.stringify({ email: "test@test.com", password: "123456" }),
    }),
    context: {},
    body: { email: "test@test.com", password: "123456" },
  };

  // Check if signInEmail gets body from ctx.body or from request parsing
  try {
    console.log("\nCalling with ctx-like object containing body...");
    const result = await auth.api.signInEmail(fakeCtx);
    console.log("ctx call result:", JSON.stringify(result, null, 2).slice(0, 300));
  } catch (e) {
    console.error("ERROR:", e.message);
  }

  // Check auth.handler vs auth.api.signInEmail
  try {
    console.log("\nChecking auth.handler...");
    console.log("auth.handler type:", typeof auth.handler);
    
    const testReq = new Request("http://localhost:3001/api/auth/sign-in/email", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Origin": "http://localhost:3001", "Accept": "application/json" },
      body: JSON.stringify({ email: "test@test.com", password: "123456" }),
    });
    
    const result = await auth.handler(testReq);
    console.log("auth.handler result status:", result.status);
    const text = await result.text();
    console.log("auth.handler result body:", text.slice(0, 300));
  } catch (e) {
    console.error("auth.handler ERROR:", e.message);
  }
})();
