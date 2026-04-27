import postgres from "postgres";

const LOCAL_URL = "postgres://postgres:admin123@localhost:5432/postgres";
const TARGET_EMAIL = "atrossilva2019@gmail.com";
const DAY = "2026-04-24";

type Staff = { id: string; name: string };

async function loadSkills(
  sql: ReturnType<typeof postgres>,
  companyId: string,
  staffIds: string[],
) {
  const map = new Map<string, Set<string>>();
  for (const id of staffIds) map.set(id, new Set<string>());

  let usedCompetency = false;
  try {
    const rows = await sql`
      select ssc.staff_id, ssc.service_id
      from staff_services_competency ssc
      inner join staff s on s.id = ssc.staff_id
      where s.company_id = ${companyId}
        and ssc.staff_id in ${sql(staffIds)}
        and ssc.is_active = true
    `;
    usedCompetency = rows.length > 0;
    for (const row of rows as unknown as Array<{ staff_id: string; service_id: string }>) {
      map.get(row.staff_id)?.add(row.service_id);
    }
  } catch (error: any) {
    if (error?.code !== "42P01") throw error;
  }

  const fallbackIds = staffIds.filter((id) => !usedCompetency || (map.get(id)?.size ?? 0) === 0);
  if (fallbackIds.length > 0) {
    const legacy = await sql`
      select ss.staff_id, ss.service_id
      from staff_services ss
      where ss.staff_id in ${sql(fallbackIds)}
    `;
    for (const row of legacy as unknown as Array<{ staff_id: string; service_id: string }>) {
      map.get(row.staff_id)?.add(row.service_id);
    }
  }

  return map;
}

async function main() {
  const sql = postgres(LOCAL_URL, { max: 1 });
  try {
    const [user] = await sql`
      select id from "user"
      where lower(email) = lower(${TARGET_EMAIL})
      limit 1
    `;
    if (!user) throw new Error("Usuário não encontrado");

    const [company] = await sql`
      select id from companies
      where owner_id = ${user.id}
      limit 1
    `;
    if (!company) throw new Error("Empresa não encontrada");

    const staff = (await sql`
      select id, name
      from staff
      where company_id = ${company.id}
        and is_active = true
        and is_professional = true
      order by name asc
    `) as Staff[];
    const staffIds = staff.map((s) => s.id);
    const staffName = new Map(staff.map((s) => [s.id, s.name]));

    const skills = await loadSkills(sql, company.id, staffIds);

    const rows = await sql`
      select
        a.id,
        a.service_id,
        srv.name as service_name,
        a.service_duration_snapshot,
        a.staff_id,
        a.assigned_by,
        a.validation_status,
        a.status,
        to_char((a.scheduled_at at time zone 'America/Sao_Paulo'),'HH24:MI') as hhmm
      from appointments a
      inner join services srv on srv.id = a.service_id
      where a.company_id = ${company.id}
        and (a.scheduled_at at time zone 'America/Sao_Paulo')::date = ${DAY}::date
        and a.status in ('PENDING','CONFIRMED','ONGOING','POSTPONED','COMPLETED')
      order by a.scheduled_at asc
    `;

    const detailed = (rows as Array<any>).map((r) => {
      const eligible = staff
        .filter((s) => skills.get(s.id)?.has(r.service_id))
        .map((s) => s.name);
      return {
        hora: r.hhmm,
        servico: r.service_name,
        duracao_min: Number.parseInt(String(r.service_duration_snapshot ?? "0"), 10) || 60,
        profissional: r.staff_id ? staffName.get(r.staff_id) ?? r.staff_id : "SEM_ATRIBUICAO",
        assigned_by: r.assigned_by,
        validation_status: r.validation_status,
        elegiveis: eligible.join(", "),
        elegiveis_qtd: eligible.length,
      };
    });

    const countByStaff = new Map<string, number>();
    for (const s of staff) countByStaff.set(s.name, 0);
    for (const r of detailed) {
      if (r.profissional !== "SEM_ATRIBUICAO") {
        countByStaff.set(r.profissional, (countByStaff.get(r.profissional) ?? 0) + 1);
      }
    }

    console.log("=== DIA 24 DETALHE ===");
    console.table(detailed);

    const blocks = await sql`
      select
        sb.staff_id,
        to_char((sb.start_time at time zone 'America/Sao_Paulo'),'YYYY-MM-DD HH24:MI') as start_local,
        to_char((sb.end_time at time zone 'America/Sao_Paulo'),'YYYY-MM-DD HH24:MI') as end_local,
        sb.reason,
        sb.is_overrideable
      from schedule_blocks sb
      where sb.staff_id in ${sql(staffIds)}
        and (sb.start_time at time zone 'America/Sao_Paulo')::date <= ${DAY}::date
        and (sb.end_time at time zone 'America/Sao_Paulo')::date >= ${DAY}::date
      order by sb.start_time asc
    `;

    console.log("=== BLOQUEIOS NO DIA 24 ===");
    console.table(
      (blocks as Array<any>).map((b) => ({
        profissional: staffName.get(b.staff_id) ?? b.staff_id,
        inicio: b.start_local,
        fim: b.end_local,
        motivo: b.reason,
        override: b.is_overrideable,
      })),
    );

    console.log("=== CONTAGEM POR PROFISSIONAL ===");
    console.table(Array.from(countByStaff.entries()).map(([name, total]) => ({ profissional: name, total })));

    const appts = detailed.map((d) => {
      const [hh, mm] = String(d.hora).split(":").map((v) => Number.parseInt(v, 10));
      const start = new Date(`${DAY}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00-03:00`);
      const end = new Date(start.getTime() + Number(d.duracao_min) * 60_000);
      return {
        ...d,
        start,
        end,
      };
    });

    const laura = appts.filter((a) => a.profissional === "Laura");
    const lucas = appts.filter((a) => a.profissional === "Lucas");
    const canMoveLucasToLaura = lucas.filter((candidate) => {
      return !laura.some((slot) => candidate.start < slot.end && candidate.end > slot.start);
    });

    console.log("=== MOVIMENTOS POSSIVEIS LUCAS -> LAURA ===");
    console.table(
      canMoveLucasToLaura.map((item) => ({
        hora: item.hora,
        servico: item.servico,
        duracao_min: item.duracao_min,
      })),
    );
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error("[ERROR]", e?.message ?? e);
  process.exit(1);
});
