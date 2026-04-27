import fs from "fs";
import postgres from "postgres";

const txt = fs.readFileSync("scripts/backup.env/backup.env", "utf8");
const url = txt.match(/url stagin DATABASE_URL="([^"]+)"/)?.[1];
if (!url) throw new Error("staging url nao encontrada");

const sql = postgres(url, { max: 1 });

try {
  const [user] = await sql`select id from "user" where lower(email)=lower(${"atrossilva2019@gmail.com"}) limit 1`;
  if (!user) throw new Error("usuario nao encontrado");

  const rows = await sql`
    select customer_name, scheduled_at
    from appointments
    where customer_id = ${user.id}
    order by scheduled_at asc
  `;

  console.log(`TOTAL_ATRO_APPOINTMENTS: ${rows.length}`);
  console.log(JSON.stringify(rows.slice(0, 25), null, 2));
} finally {
  await sql.end();
}
