import fs from "fs";
import postgres from "postgres";

const TARGET_EMAIL = "atrossilva2019@gmail.com";
const TARGET_TOTAL = 20;

const NAMES = [
  "Ana Souza",
  "Bruna Lima",
  "Carla Mendes",
  "Daniela Rocha",
  "Eduarda Alves",
  "Fernanda Reis",
  "Gabriela Nunes",
  "Helena Costa",
  "Isabela Martins",
  "Juliana Prado",
  "Kamila Araujo",
  "Larissa Teixeira",
  "Marina Borges",
  "Natasha Freitas",
  "Olivia Barros",
  "Patricia Moraes",
  "Quezia Ramos",
  "Renata Pires",
  "Sabrina Duarte",
  "Tatiane Melo",
];

function readStagingDbUrl() {
  const backupEnv = fs.readFileSync("scripts/backup.env/backup.env", "utf8");
  const match = backupEnv.match(/url stagin DATABASE_URL="([^"]+)"/);
  if (!match?.[1]) {
    throw new Error("DATABASE_URL de staging nao encontrada em scripts/backup.env/backup.env");
  }
  return match[1];
}

function phoneFor(index: number) {
  return `11988${String(10000 + index).slice(-5)}`;
}

function scheduledAtFor(index: number) {
  const base = new Date("2026-05-05T09:00:00-03:00");
  const dayOffset = Math.floor(index / 4);
  const slot = index % 4;
  const hour = [9, 11, 14, 16][slot];
  const dt = new Date(base);
  dt.setDate(base.getDate() + dayOffset);
  dt.setHours(hour, 0, 0, 0);
  return dt;
}

async function ensureAppointmentsSchema(sql: postgres.Sql) {
  const rows = await sql`
    select column_name
    from information_schema.columns
    where table_schema = 'public' and table_name = 'appointments'
  `;
  const cols = new Set(rows.map((r: any) => r.column_name));

  if (!cols.has("staff_id")) {
    await sql`alter table appointments add column staff_id text`;
    console.log("[SCHEMA] add column appointments.staff_id");
  }

  if (!cols.has("created_by")) {
    await sql`alter table appointments add column created_by text`;
    console.log("[SCHEMA] add column appointments.created_by");
  }

  if (!cols.has("assigned_by")) {
    await sql`alter table appointments add column assigned_by text not null default 'staff'`;
    console.log("[SCHEMA] add column appointments.assigned_by");
  }

  if (!cols.has("validation_status")) {
    await sql`alter table appointments add column validation_status text not null default 'confirmed'`;
    console.log("[SCHEMA] add column appointments.validation_status");
  }

  if (!cols.has("version")) {
    await sql`alter table appointments add column version integer not null default 1`;
    console.log("[SCHEMA] add column appointments.version");
  }

  if (!cols.has("audit_log")) {
    await sql`alter table appointments add column audit_log jsonb not null default '[]'::jsonb`;
    console.log("[SCHEMA] add column appointments.audit_log");
  }
}

async function main() {
  const sql = postgres(readStagingDbUrl(), { max: 1 });
  try {
    await ensureAppointmentsSchema(sql);

    const [user] = await sql`
      select id, name, email
      from "user"
      where lower(email) = lower(${TARGET_EMAIL})
      limit 1
    `;
    if (!user) throw new Error(`Usuario nao encontrado: ${TARGET_EMAIL}`);

    const [company] = await sql`
      select id, name, slug
      from companies
      where owner_id = ${user.id}
      limit 1
    `;
    if (!company) throw new Error("Empresa nao encontrada para o usuario alvo");

    const [service] = await sql`
      select id, name, price, duration
      from services
      where company_id = ${company.id}
      order by created_at asc
      limit 1
    `;
    if (!service) throw new Error("Servico nao encontrado para a empresa alvo");

    console.log(`[INFO] user=${user.id} company=${company.id} service=${service.id}`);

    for (let i = 0; i < TARGET_TOTAL; i += 1) {
      const id = crypto.randomUUID();
      const customerName = NAMES[i % NAMES.length];
      const scheduledAt = scheduledAtFor(i);
      const customerPhone = phoneFor(i);

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
          notes
        ) values (
          ${id},
          ${company.id},
          ${service.id},
          ${null},
          ${user.id},
          ${null},
          ${customerName},
          ${TARGET_EMAIL},
          ${customerPhone},
          ${service.name},
          ${service.price},
          ${String(service.duration)},
          ${scheduledAt},
          ${"PENDING"},
          ${"staff"},
          ${"confirmed"},
          ${1},
          ${"Criado via script de apoio"}
        )
      `;

      console.log(`[OK ${i + 1}/${TARGET_TOTAL}] ${customerName} -> ${scheduledAt.toISOString()}`);
    }

    const [countRow] = await sql`
      select count(*)::int as total
      from appointments
      where company_id = ${company.id}
    `;

    console.log(`[DONE] total appointments company=${countRow?.total ?? 0}`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("[ERROR]", err?.message ?? err);
  process.exit(1);
});
