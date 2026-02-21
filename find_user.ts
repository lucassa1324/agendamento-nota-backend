
import { db } from "./src/modules/infrastructure/drizzle/database";
import { user } from "./src/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  try {
    const users = await db.select().from(user).limit(1);
    if (users.length > 0) {
      console.log("User found:", users[0].email);
      console.log("Please use this email for testing or provide the password if known.");
    } else {
      console.log("No users found in DB.");
    }
    process.exit(0);
  } catch (error) {
    console.error("Error finding user:", error);
    process.exit(1);
  }
}

main();
