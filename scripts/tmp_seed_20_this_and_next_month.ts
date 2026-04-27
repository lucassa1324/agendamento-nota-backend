import fs from "fs";
import postgres from "postgres";

const TARGET_EMAIL = "atrossilva2019@gmail.com";

const NAMES = [
  "Amanda Ribeiro",
  "Beatriz Carvalho",
  "Camila Fernandes",
  "Debora Santana",
  "Elaine Oliveira",
  "Fabiana Gomes",
  "Giovana Santos",
  "Heloisa Pereira",
  "Ingrid Cardoso",
  "Jessica Rodrigues",
  "Karen Almeida",
  "Leticia Costa",
  "Monique Azevedo",
  "Nayara Batista",
  "Priscila Andrade",
  "Raissa Monteiro",
  "Simone Farias",
  "Talita Barbosa",
  "Vanessa Rocha",
  "Yasmin Nogueira",
];

function readStagingDbUrl() {
  const backupEnv = fs.readFileSync("scripts/backup.env/backup.env", "utf8");
  const match = backupEnv.match(/url stagin DATABASE_URL="([^"]+)"/);
  if (!match?.[1]) throw new Error("DATABASE_URL de staging nao encontrada");
  return match[1];
}

function pad(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function buildSlots(now: Date) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;

  const slots: Date[] = [];
  const hours = [9, 11, 14, 16];

  for (let day = now.getDate() + 1; day <= 31 && slots.length < 10; day += 1) {
    const d = new Date(year, month, day, 0, 0, 0, 0);
    if (d.getMonth() !== month) break;
    if (d.getDay() === 0) continue;
    for (const h of hours) {
      if (slots.length >= 10) break;
      slots.push(new Date(year, month, day, h, 0, 0, 0));
    }
  }

  for (let day = 1; day <= 31 && slots.length < 20; day += 1) {
    const d = new Date(nextYear, nextMonth, day, 0, 0, 0, 0);
    if (d.getMonth() !== nextMonth) break;
    if (d.getDay() === 0) continue;
    for (const h of hours) {
      if (slots.length >= 20) break;
      slots.push(new Date(nextYear, nextMonth, day, h, 0, 0, 0));
    }
  }

  if (slots.length < 20) throw new Error("Nao foi possivel gerar 20 horarios");
  return slots;
}

function phoneFor(i: number) {
  return `11987${pad(10 + i)}${pad(20 + i)}${i % 10}`;
}

async function main() {
  const sql = postgres(readStagingDbUrl(), { max: 1 });
  try {
    const [user] = await sql`
      select id, email
      from "user"
      where lower(email) = lower(${TARGET_EMAIL})
      limit 1
    `;
    if (!user) throw new Error("Usuario alvo nao encontrado");

    const [company] = await sql`
      select id
      from companies
      where owner_id = ${user.id}
      limit 1
    `;
    if (!company) throw new Error("Empresa alvo nao encontrada");

    const [service] = await sql`
      select id, name, price, duration
      from services
      where company_id = ${company.id}
      order by created_at asc
      limit 1
    `;
    if (!service) throw new Error("Servico alvo nao encontrado");

    const slots = buildSlots(new Date());

    for (let i = 0; i < 20; i += 1) {
      const dt = slots[i];
      const name = NAMES[i];

      await sql`
        insert into appointments (
          id,
          company_id,
          service_id,
          staff_id,
          customer_id,
          created_by,
          customer_name,
          customer_email,
          customer_phone,
          service_name_snapshot,
          service_price_snapshot,
          service_duration_snapshot,
          scheduled_at,
          status,
          assigned_by,
          validation_status,
          version,
          audit_log,
          notes
        ) values (
          ${crypto.randomUUID()},
          ${company.id},
          ${service.id},
          ${null},
          ${user.id},
          ${null},
          ${name},
          ${TARGET_EMAIL},
          ${phoneFor(i)},
          ${service.name},
          ${service.price},
          ${String(service.duration)},
          ${dt},
          ${"PENDING"},
          ${"staff"},
          ${"confirmed"},
          ${1},
          ${JSON.stringify([])}::jsonb,
          ${"Teste de fluxo - seed este e proximo mes"}
        )
      `;

      console.log(`[OK ${i + 1}/20] ${name} -> ${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:00`);
    }

    const [check] = await sql`
      select count(*)::int as total
      from appointments
      where company_id = ${company.id}
        and customer_email = ${TARGET_EMAIL}
        and notes = 'Teste de fluxo - seed este e proximo mes'
    `;

    console.log(`[DONE] novos agendamentos inseridos: ${check?.total ?? 0}`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("[ERROR]", err?.message ?? err);
  process.exit(1);
});
