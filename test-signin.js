require("dotenv").config();
const { auth } = require("./src/modules/infrastructure/auth/auth");

console.log("signInEmail type:", typeof auth.api.signInEmail);

(async () => {
  try {
    console.log("\nCalling auth.api.signInEmail with Request object...");
    const fakeRequest = new Request("http://localhost:3001/api/auth/sign-in/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@test.com", password: "123456" }),
    });
    const result = await auth.api.signInEmail(fakeRequest);
    console.log("Result with Request:", JSON.stringify(result, null, 2).slice(0, 300));
  } catch (e) {
    console.error("ERROR with Request:", e.message);
  }

  try {
    console.log("\nCalling auth.api.signInEmail with plain object...");
    const result = await auth.api.signInEmail({
      email: "test@test.com",
      password: "123456",
    });
    console.log("Result with object:", JSON.stringify(result, null, 2).slice(0, 300));
  } catch (e) {
    console.error("ERROR with object:", e.message);
  }
  
  try {
    console.log("\nCalling auth.api.signInEmail with object + headers...");
    const result = await auth.api.signInEmail({
      email: "test@test.com",
      password: "123456",
      headers: new Headers({ "Content-Type": "application/json" }),
    });
    console.log("Result with headers:", JSON.stringify(result, null, 2).slice(0, 300));
  } catch (e) {
    console.error("ERROR with headers:", e.message);
  }
})();
