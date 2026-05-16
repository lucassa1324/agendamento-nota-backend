import "dotenv/config";
import { auth } from "back_end/src/modules/infrastructure/auth/auth";

console.log("signInEmail type:", typeof auth.api.signInEmail);
console.log("signInEmail length:", auth.api.signInEmail.length);

// Try calling it the way our index.ts does
(async () => {
  try {
    const fakeRequest = new Request("http://localhost:3001/api/auth/sign-in/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@test.com", password: "123456" }),
    });
    
    console.log("\nCalling auth.api.signInEmail with fake Request object...");
    const result = await auth.api.signInEmail(fakeRequest);
    console.log("Result:", JSON.stringify(result, null, 2).slice(0, 300));
  } catch (e) {
    console.error("ERROR:", e.message);
    console.error("Stack:", e.stack?.slice(0, 500));
  }

  try {
    console.log("\nCalling auth.api.signInEmail with options object...");
    const result = await auth.api.signInEmail({
      email: "test@test.com",
      password: "123456",
      headers: new Headers({ "Content-Type": "application/json" }),
    });
    console.log("Result:", JSON.stringify(result, null, 2).slice(0, 300));
  } catch (e) {
    console.error("ERROR:", e.message);
    console.error("Stack:", e.stack?.slice(0, 500));
  }
  
  try {
    console.log("\nCalling auth.api.signInEmail with just email/password...");
    const result = await auth.api.signInEmail({
      email: "test@test.com",
      password: "123456",
    });
    console.log("Result:", JSON.stringify(result, null, 2).slice(0, 300));
  } catch (e) {
    console.error("ERROR:", e.message);
    console.error("Stack:", e.stack?.slice(0, 500));
  }
})();
