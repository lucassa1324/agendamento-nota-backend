// test signInEmail - no dotenv needed
const { auth } = require("./src/modules/infrastructure/auth/auth");

console.log("signInEmail type:", typeof auth.api.signInEmail);
console.log("signInEmail length:", auth.api.signInEmail.length);

(async () => {
  try {
    console.log("\n=== Test 1: Calling with Request object ===");
    const fakeRequest = new Request("http://localhost:3001/api/auth/sign-in/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@test.com", password: "123456" }),
    });
    const result = await auth.api.signInEmail(fakeRequest);
    console.log("Result with Request:", JSON.stringify(result, null, 2).slice(0, 400));
  } catch (e) {
    console.error("ERROR with Request:", e.message);
    if (e.stack) console.error("Stack:", e.stack.slice(0, 500));
  }

  try {
    console.log("\n=== Test 2: Calling with plain object ===");
    const result = await auth.api.signInEmail({
      email: "test@test.com",
      password: "123456",
    });
    console.log("Result with object:", JSON.stringify(result, null, 2).slice(0, 400));
  } catch (e) {
    console.error("ERROR with object:", e.message);
  }

  try {
    console.log("\n=== Test 3: Calling with object + headers ===");
    const result = await auth.api.signInEmail({
      email: "test@test.com",
      password: "123456",
      headers: new Headers({ "Content-Type": "application/json" }),
    });
    console.log("Result with headers:", JSON.stringify(result, null, 2).slice(0, 400));
  } catch (e) {
    console.error("ERROR with headers:", e.message);
  }

  // Check findUserByEmail in drizzle adapter
  try {
    const { db } = require("./src/modules/infrastructure/drizzle/database");
    const * as schema from "./src/db/schema";
    console.log("\n=== Test 4: Direct DB query for user ===");
    const { eq } = require("drizzle-orm");
    const users = await db.select().from(schema.user).where(eq(schema.user.email, "test@test.com")).limit(1);
    console.log("User found:", users.length, users[0] || "none");
  } catch(e) {
    console.error("DB query error:", e.message);
  }
})();
