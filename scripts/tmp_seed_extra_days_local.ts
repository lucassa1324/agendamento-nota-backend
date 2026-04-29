import postgres from "postgres";

const LOCAL_URL = "postgres://postgres:admin123@localhost:5432/postgres";
const TARGET_EMAIL = "atrossilva2019@gmail.com";
const BASE_NOTE = "SEED_DISTRIBUICAO_DIAS_EXTRAS_2026-04-27_2026-05";

const DAY_LOAD: Array<{ day: string; count: number }> = [
  { day: "2026-04-27", count: 4 },
  { day: "2026-04-28", count: 6 },
  { day: "2026-04-29", count: 5 },
  { day: "2026-04-30", count: 7 },
  { day: "2026-05-02", count: 3 },
  { day: "2026-05-04", count: 6 },
  { day: "2026-05-05", count: 4 },
  { day: "2026-05-07", count: 5 },
  { day: "2026-05-09", count: 3 },
];

const SLOT_HOURS = [8, 9, 10, 11, 13, 14, 15, 16, 17, 18];

function pad(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function makePhone(index: number) {
  return `1198${pad(10 + (index % 90))}${pad(20 + (index % 70))}${index % 10}`;
}

function makeDateInBrt(day: string, hour: number) {
  return new Date(`${day}T${pad(hour)}:00:00.000-03:00`);
}

async function getCommonServiceIds(
  sql: ReturnType<typeof postgres>,
  companyId: string,
  professionalIds: string[],
) {
  const competencyRows = await sql`
    select ssc.staff_id, ssc.service_id
    from staff_services_competency ssc
    inner join staff s on s.id = ssc.staff_id
    where s.company_id = ${companyId}
      and s.is_active = true
      and s.is_professional = true
      and ssc.is_active = true
      and ssc.staff_id in ${sql(professionalIds)}
  `;

  let rows = competencyRows as Array<{ staff_id: string; service_id: string }>;
  if (rows.length === 0) {
    const legacyRows = await sql`
      select ss.staff_id, ss.service_id
      from staff_services ss
      inner join staff s on s.id = ss.staff_id
      where s.company_id = ${companyId}
        and s.is_active = true
        and s.is_professional = true
        and ss.staff_id in ${sql(professionalIds)}
    `;
    rows = legacyRows as Array<{ staff_id: string; service_id: string }>;
  }

  const byStaff = new Map<string, Set<string>>();
  for (const row of rows) {
    const current = byStaff.get(row.staff_id) ?? new Set<string>();
    current.add(row.service_id);
    byStaff.set(row.staff_id, current);
  }

  const [first, ...rest] = professionalIds;
  const firstSet = byStaff.get(first) ?? new Set<string>();
  return Array.from(firstSet).filter((serviceId) =>
    rest.every((staffId) => byStaff.get(staffId)?.has(serviceId)),
  );
}

async function pickBestProfessionalPair(
  sql: ReturnType<typeof postgres>,
  companyId: string,
) {
  const professionals = await sql`
    select id
    from staff
    where company_id = ${companyId}
      and is_active = true
      and is_professional = true
    order by name asc
  `;
  if (!professionals || professionals.length < 2) return null;

  let bestPair: { ids: [string, string]; common: string[] } | null = null;

  for (let i = 0; i < professionals.length; i += 1) {
    for (let j = i + 1; j < professionals.length; j += 1) {
      const idA = String((professionals[i] as any).id);
      const idB = String((professionals[j] as any).id);
      const common = await getCommonServiceIds(sql, companyId, [idA, idB]);
      if (!bestPair || common.length > bestPair.common.length) {
        bestPair = { ids: [idA, idB], common };
      }
    }
  }

  return bestPair;
}

async function main() {
  const sql = postgres(LOCAL_URL, { max: 1 });
  try {
    const [user] = await sql`
      select id from "user"
      where lower(email) = lower(${TARGET_EMAIL})
      limit 1
    `;
    if (!user) throw new Error("Usuário alvo não encontrado.");

    const [company] = await sql`
      select id from companies
      where owner_id = ${user.id}
      limit 1
    `;
    if (!company) throw new Error("Empresa não encontrada.");

    const bestPair = await pickBestProfessionalPair(sql, company.id);
    if (!bestPair || bestPair.common.length === 0) {
      throw new Error("Não encontrei serviços em comum entre profissionais.");
    }

    const services = await sql`
      select id, name, price, duration
      from services
      where company_id = ${company.id}
        and id in ${sql(bestPair.common.slice(0, 5))}
      order by created_at asc
    `;
    if (!services || services.length === 0) {
      throw new Error("Serviços não encontrados para seed.");
    }

    await sql`
      delete from appointments
      where company_id = ${company.id}
        and notes = ${BASE_NOTE}
    `;

    let idx = 0;
    for (const dayConfig of DAY_LOAD) {
      for (let i = 0; i < dayConfig.count; i += 1) {
        const service = services[(idx + i) % services.length] as any;
        const hour = SLOT_HOURS[i % SLOT_HOURS.length];
        const dt = makeDateInBrt(dayConfig.day, hour);

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
            ${`Teste Extra ${dayConfig.day} #${i + 1}`},
            ${TARGET_EMAIL},
            ${makePhone(idx)},
            ${service.name},
            ${service.price},
            ${String(service.duration)},
            ${dt},
            ${"PENDING"},
            ${"system"},
            ${"suggested"},
            ${1},
            ${JSON.stringify([])}::jsonb,
            ${BASE_NOTE}
          )
        `;
        idx += 1;
      }
    }

    const summary = await sql`
      select
        to_char((scheduled_at at time zone 'America/Sao_Paulo'), 'YYYY-MM-DD') as day,
        count(*)::int as total
      from appointments
      where company_id = ${company.id}
        and notes = ${BASE_NOTE}
      group by 1
      order by 1
    `;

    console.log("Seed extra concluído.");
    console.table(summary);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error("[ERROR]", error?.message ?? error);
  process.exit(1);
});
