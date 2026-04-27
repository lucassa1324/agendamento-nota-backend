import postgres from "postgres";

const LOCAL_URL = "postgres://postgres:admin123@localhost:5432/postgres";
const TARGET_EMAIL = "atrossilva2019@gmail.com";
const DATE_START = "2026-04-20";
const DATE_END = "2026-05-10";

type Professional = { id: string; name: string };
type Appointment = {
  id: string;
  day: string;
  service_id: string;
  staff_id: string | null;
  scheduled_at: Date;
  service_duration_snapshot: string;
};

function parseDurationToMinutes(value: string | null | undefined) {
  const num = Number.parseInt(String(value ?? "0"), 10);
  return Number.isFinite(num) && num > 0 ? num : 60;
}

function overlaps(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA < endB && endA > startB;
}

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

    const skillsMap = await loadSkillsMap(sql, company.id, professionals);

    const appointments = (await sql`
      select
        a.id,
        to_char((a.scheduled_at at time zone 'America/Sao_Paulo'), 'YYYY-MM-DD') as day,
        a.service_id,
        a.staff_id,
        a.scheduled_at,
        a.service_duration_snapshot
      from appointments a
      where a.company_id = ${company.id}
        and (a.scheduled_at at time zone 'America/Sao_Paulo')::date between ${DATE_START}::date and ${DATE_END}::date
        and a.assigned_by = 'system'
        and a.status in ('PENDING', 'CONFIRMED', 'ONGOING', 'POSTPONED', 'COMPLETED')
      order by day asc, a.scheduled_at asc
    `) as Appointment[];

    const invalid = appointments.filter((appointment) => {
      if (!appointment.staff_id) return false;
      return !skillsMap.get(appointment.staff_id)?.has(appointment.service_id);
    });

    if (invalid.length === 0) {
      console.log("Nenhuma atribuição inválida por habilidade encontrada.");
      return;
    }

    let fixed = 0;
    for (const appt of invalid) {
      const eligibleIds = professionals
        .filter((professional) =>
          skillsMap.get(professional.id)?.has(appt.service_id),
        )
        .map((professional) => professional.id);

      if (eligibleIds.length === 0) continue;

      const dayAppointments = appointments.filter((item) => item.day === appt.day);
      const loadByStaff = new Map<string, number>();
      for (const id of eligibleIds) loadByStaff.set(id, 0);
      for (const item of dayAppointments) {
        if (!item.staff_id) continue;
        if (!loadByStaff.has(item.staff_id)) continue;
        loadByStaff.set(item.staff_id, (loadByStaff.get(item.staff_id) ?? 0) + 1);
      }

      const targetStart = new Date(appt.scheduled_at);
      const targetEnd = new Date(
        targetStart.getTime() + parseDurationToMinutes(appt.service_duration_snapshot) * 60_000,
      );

      const orderedCandidates = [...eligibleIds].sort((a, b) => {
        const loadDiff = (loadByStaff.get(a) ?? 0) - (loadByStaff.get(b) ?? 0);
        if (loadDiff !== 0) return loadDiff;
        return a.localeCompare(b);
      });

      let selected: string | null = null;
      for (const candidateId of orderedCandidates) {
        const hasConflict = dayAppointments.some((item) => {
          if (item.id === appt.id) return false;
          if (item.staff_id !== candidateId) return false;
          const start = new Date(item.scheduled_at);
          const end = new Date(
            start.getTime() + parseDurationToMinutes(item.service_duration_snapshot) * 60_000,
          );
          return overlaps(targetStart, targetEnd, start, end);
        });
        if (!hasConflict) {
          selected = candidateId;
          break;
        }
      }

      if (!selected) continue;

      await sql`
        update appointments
        set staff_id = ${selected},
            assigned_by = 'system',
            validation_status = 'suggested',
            version = version + 1,
            updated_at = now()
        where id = ${appt.id}
      `;

      appt.staff_id = selected;
      fixed += 1;
    }

    console.log(`Atribuições inválidas encontradas: ${invalid.length}`);
    console.log(`Atribuições corrigidas: ${fixed}`);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error("[ERROR]", error?.message ?? error);
  process.exit(1);
});
