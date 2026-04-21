import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}

const client = postgres(connectionString);
const db = drizzle(client);

async function main() {
  try {
    const result = await client`SELECT * FROM "__drizzle_migrations" ORDER BY created_at DESC`;
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error querying migrations:', error);
  } finally {
    await client.end();
  }
}

main();
