import postgres from "postgres";

const LOCAL_URL = "postgres://postgres:admin123@localhost:5432/postgres";
const TARGET_EMAIL = "atrossilva2019@gmail.com";
const DATE_START = "2026-04-20";
const DATE_END = "2026-04-30";

async function main() {
  const sql = postgres(LOCAL_URL, { max: 1 });
  try {
    const [user] = await sql`
      select id
      from "user"
      where lower(email) = lower(${TARGET_EMAIL})
      limit 1
    `;
    if (!user) throw new Error("Usuário alvo não encontrado.");

    const [company] = await sql`
      select id
      from companies
      where owner_id = ${user.id}
      limit 1
    `;
    if (!company) throw new Error("Empresa alvo não encontrada.");

    const focusedProfessionals = await sql`
      select
        s.name as staff_name,
        count(*)::int as total
      from appointments a
      inner join staff s on s.id = a.staff_id
      where a.company_id = ${company.id}
        and (a.scheduled_at at time zone 'America/Sao_Paulo')::date between ${DATE_START}::date and ${DATE_END}::date
        and a.status in ('PENDING', 'CONFIRMED', 'ONGOING', 'POSTPONED', 'COMPLETED')
      group by s.name
      order by total desc, s.name asc
      limit 2
    `;
    const professionalNames = (
      focusedProfessionals as Array<{ staff_name: string }>
    ).map((item) => item.staff_name);
    if (professionalNames.length === 0) {
      throw new Error("Não encontrei profissionais com agendamentos no período.");
    }

    const rows = await sql`
      select
        to_char((a.scheduled_at at time zone 'America/Sao_Paulo'), 'YYYY-MM-DD') as day,
        coalesce(s.name, 'SEM_ATRIBUICAO') as staff_name,
        count(*)::int as total
      from appointments a
      left join staff s on s.id = a.staff_id
      where a.company_id = ${company.id}
        and (a.scheduled_at at time zone 'America/Sao_Paulo')::date between ${DATE_START}::date and ${DATE_END}::date
        and a.status in ('PENDING', 'CONFIRMED', 'ONGOING', 'POSTPONED', 'COMPLETED')
        and (
          s.name is null
          or s.name in ${sql(professionalNames)}
        )
      group by 1, 2
      order by 1 asc, 2 asc
    `;

    const days = [
      DATE_START,
      "2026-04-21",
      "2026-04-22",
      "2026-04-23",
      "2026-04-24",
      "2026-04-25",
      "2026-04-26",
      "2026-04-27",
      "2026-04-28",
      "2026-04-29",
      DATE_END,
    ];

    const dayMap = new Map<string, Array<{ staff_name: string; total: number }>>();
    for (const day of days) {
      dayMap.set(
        day,
        professionalNames.map((name) => ({ staff_name: name, total: 0 })),
      );
    }

    for (const row of rows as Array<{ day: string; staff_name: string; total: number }>) {
      const current = dayMap.get(row.day) ?? [];
      const found = current.find((item) => item.staff_name === row.staff_name);
      if (found) {
        found.total = row.total;
      } else {
        current.push({ staff_name: row.staff_name, total: row.total });
      }
      dayMap.set(row.day, current);
    }

    const summary: Array<Record<string, unknown>> = [];
    for (const [day, values] of Array.from(dayMap.entries()).sort(([a], [b]) => a.localeCompare(b))) {
      const assigned = values.filter((v) => v.staff_name !== "SEM_ATRIBUICAO");
      const unassigned = values.find((v) => v.staff_name === "SEM_ATRIBUICAO")?.total ?? 0;
      const counts = assigned.map((v) => v.total);
      const min = counts.length ? Math.min(...counts) : 0;
      const max = counts.length ? Math.max(...counts) : 0;
      const diff = max - min;
      const balanced = counts.length <= 1 ? true : diff <= 1;

      summary.push({
        day,
        distribuicao: assigned.map((v) => `${v.staff_name}:${v.total}`).join(" | "),
        sem_atribuicao: unassigned,
        diferenca: diff,
        balanceado: balanced ? "SIM" : "NAO",
      });
    }

    console.log("=== BALANCEAMENTO 20 A 30 ===");
    console.table(summary);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error("[ERROR]", error?.message ?? error);
  process.exit(1);
});
