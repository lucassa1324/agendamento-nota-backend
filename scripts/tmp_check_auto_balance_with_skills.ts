import postgres from "postgres";

const LOCAL_URL = "postgres://postgres:admin123@localhost:5432/postgres";
const TARGET_EMAIL = "atrossilva2019@gmail.com";
const DATE_START = "2026-04-20";
const DATE_END = "2026-05-10";

type Professional = { id: string; name: string };
type AppointmentRow = {
  id: string;
  day: string;
  service_id: string;
  staff_id: string | null;
  assigned_by: string | null;
};

async function loadSkillsMap(
  sql: ReturnType<typeof postgres>,
  companyId: string,
  professionals: Professional[],
) {
  const map = new Map<string, Set<string>>();
  for (const professional of professionals) {
    map.set(professional.id, new Set<string>());
  }

  const professionalIds = professionals.map((p) => p.id);
  let competencyTableExists = true;
  try {
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
    for (const row of competencyRows as unknown as Array<{ staff_id: string; service_id: string }>) {
      map.get(row.staff_id)?.add(row.service_id);
    }
  } catch (error: any) {
    if (error?.code === "42P01") {
      competencyTableExists = false;
    } else {
      throw error;
    }
  }

  const needsLegacy = professionals
    .filter((p) => !competencyTableExists || (map.get(p.id)?.size ?? 0) === 0)
    .map((p) => p.id);

  if (needsLegacy.length > 0) {
    const legacyRows = await sql`
      select ss.staff_id, ss.service_id
      from staff_services ss
      inner join staff s on s.id = ss.staff_id
      where s.company_id = ${companyId}
        and s.is_active = true
        and s.is_professional = true
        and ss.staff_id in ${sql(needsLegacy)}
    `;
    for (const row of legacyRows as unknown as Array<{ staff_id: string; service_id: string }>) {
      map.get(row.staff_id)?.add(row.service_id);
    }
  }

  return map;
}

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

    const professionals = (await sql`
      select id, name
      from staff
      where company_id = ${company.id}
        and is_active = true
        and is_professional = true
      order by name asc
    `) as Professional[];

    if (professionals.length === 0) {
      throw new Error("Nenhum profissional ativo encontrado.");
    }

    const skillsMap = await loadSkillsMap(sql, company.id, professionals);

    const appointments = (await sql`
      select
        a.id,
        to_char((a.scheduled_at at time zone 'America/Sao_Paulo'), 'YYYY-MM-DD') as day,
        a.service_id,
        a.staff_id,
        a.assigned_by
      from appointments a
      where a.company_id = ${company.id}
        and (a.scheduled_at at time zone 'America/Sao_Paulo')::date between ${DATE_START}::date and ${DATE_END}::date
        and a.assigned_by = 'system'
        and a.status in ('PENDING', 'CONFIRMED', 'ONGOING', 'POSTPONED', 'COMPLETED')
      order by day asc
    `) as AppointmentRow[];

    const dailyActual = new Map<string, Map<string, number>>();
    const dailyExpected = new Map<string, Map<string, number>>();
    const invalidAssignments: Array<{ day: string; appointmentId: string; staffId: string }> = [];

    const ensureDayMaps = (day: string) => {
      if (!dailyActual.has(day)) {
        const actual = new Map<string, number>();
        const expected = new Map<string, number>();
        for (const professional of professionals) {
          actual.set(professional.id, 0);
          expected.set(professional.id, 0);
        }
        dailyActual.set(day, actual);
        dailyExpected.set(day, expected);
      }
    };

    for (const appointment of appointments) {
      ensureDayMaps(appointment.day);
      const actualMap = dailyActual.get(appointment.day)!;
      const expectedMap = dailyExpected.get(appointment.day)!;

      const eligible = professionals
        .filter((professional) =>
          skillsMap.get(professional.id)?.has(appointment.service_id),
        )
        .map((professional) => professional.id);

      if (eligible.length > 0) {
        const share = 1 / eligible.length;
        for (const professionalId of eligible) {
          expectedMap.set(
            professionalId,
            (expectedMap.get(professionalId) ?? 0) + share,
          );
        }
      }

      if (appointment.staff_id && actualMap.has(appointment.staff_id)) {
        actualMap.set(
          appointment.staff_id,
          (actualMap.get(appointment.staff_id) ?? 0) + 1,
        );
        if (
          eligible.length > 0 &&
          !eligible.includes(appointment.staff_id)
        ) {
          invalidAssignments.push({
            day: appointment.day,
            appointmentId: appointment.id,
            staffId: appointment.staff_id,
          });
        }
      }
    }

    const professionalNameById = new Map(professionals.map((p) => [p.id, p.name]));
    const dailySummary: Array<Record<string, unknown>> = [];

    for (const day of Array.from(dailyActual.keys()).sort((a, b) => a.localeCompare(b))) {
      const actualMap = dailyActual.get(day)!;
      const expectedMap = dailyExpected.get(day)!;

      const involved = professionals
        .filter((professional) => (expectedMap.get(professional.id) ?? 0) > 0)
        .map((professional) => professional.id);

      const scopeIds = involved.length > 0 ? involved : professionals.map((p) => p.id);

      let maxAbsDelta = 0;
      const parts: string[] = [];
      for (const professionalId of scopeIds) {
        const actual = actualMap.get(professionalId) ?? 0;
        const expected = expectedMap.get(professionalId) ?? 0;
        const delta = actual - expected;
        maxAbsDelta = Math.max(maxAbsDelta, Math.abs(delta));
        parts.push(
          `${professionalNameById.get(professionalId)} A:${actual} E:${expected.toFixed(2)} D:${delta.toFixed(2)}`,
        );
      }

      dailySummary.push({
        day,
        distribuicao: parts.join(" | "),
        max_delta_abs: Number(maxAbsDelta.toFixed(2)),
        balanceado: maxAbsDelta <= 1 ? "SIM" : "NAO",
      });
    }

    console.log("=== BALANCEAMENTO AUTOMATICO (IGNORA MANUAL, RESPEITA HABILIDADES) ===");
    console.table(dailySummary);
    console.log(`Dias analisados: ${dailySummary.length}`);
    console.log(`Agendamentos automaticos analisados: ${appointments.length}`);
    console.log(`Atribuicoes invalidas por habilidade: ${invalidAssignments.length}`);
    if (invalidAssignments.length > 0) {
      console.table(invalidAssignments.slice(0, 20));
    }
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error("[ERROR]", error?.message ?? error);
  process.exit(1);
});
