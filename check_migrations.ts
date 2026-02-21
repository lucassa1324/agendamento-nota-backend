
import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import * as schema from "./src/db/schema";
import "dotenv/config";

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  await client.connect();
  const db = drizzle(client, { schema });

  try {
    // Check if companies table has subscription_status column
    const companies = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'companies' 
      AND column_name = 'subscription_status';
    `);
    console.log("companies.subscription_status exists:", companies.rows.length > 0);

    // Check if fixed_expenses table has type column
    const expenses = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'fixed_expenses' 
      AND column_name = 'type';
    `);
    console.log("fixed_expenses.type exists:", expenses.rows.length > 0);

    // Check if user table has account_status column (what we need)
    const userStatus = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'user' 
      AND column_name = 'account_status';
    `);
    console.log("user.account_status exists:", userStatus.rows.length > 0);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

main();
