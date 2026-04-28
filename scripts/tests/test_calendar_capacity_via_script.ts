import postgres from "postgres";

type Company = { id: string; name: string; slug: string; owner_id: string };
type Service = {
  service_id: string;
  service_name: string;
  duration: string;
  professional_count: string;
};
type StaffMember = { id: string; name: string; email: string };
type OperatingHour = {
  day_of_week: string;
  status: string;
  morning_start: string | null;
  morning_end: string | null;
  afternoon_start: string | null;
  afternoon_end: string | null;
};
type AgendaBlock = {
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  type: string;
};

type SlotCapacity = {
  time: string;
  freeStaffIds: string[];
  freeCount: number;
};

const sql = postgres(process.env.DATABASE_URL || "", { max: 1 });

const INTERVAL_MINUTES = 30;
const LOOKAHEAD_DAYS = 30;
const TARGET_SLUG = "aura-teste";
const TARGET_OWNER_FALLBACK = "atrossilva2019@gmail.com";

const createdAppointmentIds: string[] = [];

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function fromMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function parseDurationToMinutes(duration: string): number {
  const normalized = String(duration || "60").trim();
  if (normalized.includes(":")) {
    const [h, m] = normalized.split(":").map((v) => Number(v || 0));
    return h * 60 + m;
  }
  const num = Number(normalized);
  return Number.isFinite(num) && num > 0 ? num : 60;
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toAgendaDateBr(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

function parseBrDateToKey(brDate: string): string {
  const [d, m, y] = brDate.split("/").map(Number);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function isBetweenDateKeys(target: string, start: string, end: string): boolean {
  return target >= start && target <= end;
}

function generateSlotsForPeriods(periods: Array<{ start: string; end: string }>): string[] {
  const slots: string[] = [];
  for (const p of periods) {
    const start = toMinutes(p.start);
    const end = toMinutes(p.end);
    for (let t = start; t + INTERVAL_MINUTES <= end; t += INTERVAL_MINUTES) {
      slots.push(fromMinutes(t));
    }
  }
  return Array.from(new Set(slots));
}

async function getCompany(): Promise<Company> {
  const rows = await sql`
    select id, name, slug, owner_id
    from companies
    where lower(slug) = lower(${TARGET_SLUG})
    limit 1
  `;

  if (rows.length > 0) return rows[0] as Company;

  const byOwner = await sql`
    select c.id, c.name, c.slug, c.owner_id
    from companies c
    join "user" u on u.id = c.owner_id
    where lower(u.email) = lower(${TARGET_OWNER_FALLBACK})
    limit 1
  `;

  if (byOwner.length === 0) {
    throw new Error("Empresa alvo nao encontrada por slug nem por e-mail do dono.");
  }

  return byOwner[0] as Company;
}

async function getServiceWithTwoPros(companyId: string): Promise<{ service: Service; staff: StaffMember[] }> {
  const services = (await sql`
    select
      s.id as service_id,
      s.name as service_name,
      s.duration,
      count(distinct st.id) as professional_count
    from services s
    join staff_services ss on ss.service_id = s.id
    join staff st
      on st.id = ss.staff_id
     and st.is_active = true
     and st.is_professional = true
    where s.company_id = ${companyId}
      and coalesce(s.is_visible, true) = true
    group by s.id, s.name, s.duration
    having count(distinct st.id) = 2
    order by s.name asc
    limit 1
  `) as Service[];

  if (services.length === 0) {
    throw new Error("Nao foi encontrado servico com exatamente 2 profissionais ativos.");
  }

  const service = services[0];

  const staff = (await sql`
    select st.id, st.name, st.email
    from staff_services ss
    join staff st on st.id = ss.staff_id
    where ss.service_id = ${service.service_id}
      and st.is_active = true
      and st.is_professional = true
    order by st.name asc
  `) as StaffMember[];

  if (staff.length !== 2) {
    throw new Error(`Servico escolhido nao retornou exatamente 2 profissionais (retornou ${staff.length}).`);
  }

  return { service, staff };
}

async function getOperatingHours(companyId: string): Promise<OperatingHour[]> {
  return (await sql`
    select day_of_week, status, morning_start, morning_end, afternoon_start, afternoon_end
    from operating_hours
    where company_id = ${companyId}
  `) as OperatingHour[];
}

async function getAgendaBlocks(companyId: string): Promise<AgendaBlock[]> {
  return (await sql`
    select start_date, end_date, start_time, end_time, type
    from agenda_blocks
    where company_id = ${companyId}
  `) as AgendaBlock[];
}

async function isStaffFree(staffId: string, start: Date, end: Date): Promise<boolean> {
  const apptOverlap = await sql`
    select 1
    from appointments a
    where a.staff_id = ${staffId}
      and a.status <> 'CANCELLED'
      and a.scheduled_at < ${end}
      and (a.scheduled_at + (coalesce(nullif(a.service_duration_snapshot, ''), '60') || ' minutes')::interval) > ${start}
    limit 1
  `;

  if (apptOverlap.length > 0) return false;

  const blockOverlap = await sql`
    select 1
    from schedule_blocks sb
    where sb.staff_id = ${staffId}
      and sb.start_time < ${end}
      and sb.end_time > ${start}
    limit 1
  `;

  if (blockOverlap.length > 0) return false;

  const absenceOverlap = await sql`
    select 1
    from staff_absences sa
    where sa.staff_id = ${staffId}
      and sa.start_time < ${end}
      and sa.end_time > ${start}
    limit 1
  `;

  return absenceOverlap.length === 0;
}

function applyAgendaBlockFilter(
  date: Date,
  slots: string[],
  agendaBlocks: AgendaBlock[],
  durationMinutes: number,
): string[] {
  const dateKey = formatDateKey(date);

  return slots.filter((slot) => {
    const slotStart = toMinutes(slot);
    const slotEnd = slotStart + durationMinutes;

    for (const block of agendaBlocks) {
      const startKey = parseBrDateToKey(block.start_date);
      const endKey = parseBrDateToKey(block.end_date);
      if (!isBetweenDateKeys(dateKey, startKey, endKey)) continue;

      // Bloqueio dia inteiro
      if (!block.start_time && !block.end_time) return false;

      // Bloqueio parcial
      if (block.start_time && block.end_time) {
        const bStart = toMinutes(block.start_time);
        const bEnd = toMinutes(block.end_time);
        if (slotStart < bEnd && slotEnd > bStart) return false;
      }
    }

    return true;
  });
}

async function computeSlotCapacities(
  date: Date,
  serviceDurationMinutes: number,
  staffIds: string[],
  periods: Array<{ start: string; end: string }>,
  agendaBlocks: AgendaBlock[],
): Promise<SlotCapacity[]> {
  const rawSlots = generateSlotsForPeriods(periods);
  const filteredSlots = applyAgendaBlockFilter(date, rawSlots, agendaBlocks, serviceDurationMinutes);

  const capacities: SlotCapacity[] = [];

  for (const time of filteredSlots) {
    const [hh, mm] = time.split(":").map(Number);
    const start = new Date(date);
    start.setHours(hh, mm, 0, 0);
    const end = new Date(start.getTime() + serviceDurationMinutes * 60000);

    const freeStaffIds: string[] = [];
    for (const staffId of staffIds) {
      const free = await isStaffFree(staffId, start, end);
      if (free) freeStaffIds.push(staffId);
    }

    capacities.push({ time, freeStaffIds, freeCount: freeStaffIds.length });
  }

  return capacities;
}

async function insertAppointment(params: {
  companyId: string;
  serviceId: string;
  staffId: string;
  serviceName: string;
  servicePrice: string;
  serviceDurationSnapshot: string;
  startAt: Date;
  suffix: string;
}) {
  const id = crypto.randomUUID();
  createdAppointmentIds.push(id);

  await sql`
    insert into appointments (
      id,
      company_id,
      service_id,
      staff_id,
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
      created_at,
      updated_at
    ) values (
      ${id},
      ${params.companyId},
      ${params.serviceId},
      ${params.staffId},
      ${`Teste Capacidade ${params.suffix}`},
      ${`capacidade.${params.suffix}.${Date.now()}@example.com`},
      ${"(11) 98888-7777"},
      ${params.serviceName},
      ${params.servicePrice},
      ${params.serviceDurationSnapshot},
      ${params.startAt},
      ${"CONFIRMED"},
      ${"staff"},
      ${"confirmed"},
      ${1},
      ${"[]"}::jsonb,
      now(),
      now()
    )
  `;
}

async function main() {
  const company = await getCompany();
  const ownerRows = await sql`
    select email
    from "user"
    where id = ${company.owner_id}
    limit 1
  `;

  const ownerEmail = ownerRows[0]?.email || null;
  const { service, staff } = await getServiceWithTwoPros(company.id);
  const durationMinutes = parseDurationToMinutes(service.duration);

  const operating = await getOperatingHours(company.id);
  const agendaBlocks = await getAgendaBlocks(company.id);

  let pickedDate: Date | null = null;
  let pickedDateSlotsBefore: SlotCapacity[] = [];

  for (let i = 1; i <= LOOKAHEAD_DAYS; i += 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + i);

    const dayOfWeek = String(date.getDay());
    const oh = operating.find((o) => o.day_of_week === dayOfWeek && o.status === "OPEN");
    if (!oh) continue;

    const periods: Array<{ start: string; end: string }> = [];
    if (oh.morning_start && oh.morning_end) periods.push({ start: oh.morning_start, end: oh.morning_end });
    if (oh.afternoon_start && oh.afternoon_end) periods.push({ start: oh.afternoon_start, end: oh.afternoon_end });
    if (periods.length === 0) continue;

    const capacities = await computeSlotCapacities(
      date,
      durationMinutes,
      staff.map((s) => s.id),
      periods,
      agendaBlocks,
    );

    const hasTwoCapacity = capacities.some((c) => c.freeCount >= 2);
    if (!hasTwoCapacity) continue;

    pickedDate = date;
    pickedDateSlotsBefore = capacities;
    break;
  }

  if (!pickedDate) {
    throw new Error("Nao foi encontrado dia/horario com capacidade para 2 profissionais nos proximos 30 dias.");
  }

  const slotForTwo = pickedDateSlotsBefore.find((c) => c.freeCount >= 2);
  if (!slotForTwo) {
    throw new Error("Falha interna ao selecionar horario com capacidade 2.");
  }

  const [h, m] = slotForTwo.time.split(":").map(Number);
  const slotStart = new Date(pickedDate);
  slotStart.setHours(h, m, 0, 0);

  const servicePriceRows = await sql`
    select price
    from services
    where id = ${service.service_id}
    limit 1
  `;
  const servicePrice = String(servicePriceRows[0]?.price ?? "0");

  // Cria dois agendamentos simultaneos (um para cada profissional)
  await insertAppointment({
    companyId: company.id,
    serviceId: service.service_id,
    staffId: staff[0].id,
    serviceName: service.service_name,
    servicePrice,
    serviceDurationSnapshot: String(durationMinutes),
    startAt: slotStart,
    suffix: "A",
  });

  await insertAppointment({
    companyId: company.id,
    serviceId: service.service_id,
    staffId: staff[1].id,
    serviceName: service.service_name,
    servicePrice,
    serviceDurationSnapshot: String(durationMinutes),
    startAt: slotStart,
    suffix: "B",
  });

  // Recalcula capacidades apos inserir os 2 agendamentos
  const dayOfWeek = String(pickedDate.getDay());
  const oh = operating.find((o) => o.day_of_week === dayOfWeek && o.status === "OPEN");
  if (!oh) {
    throw new Error("Horario de funcionamento nao encontrado apos insercao.");
  }

  const periods: Array<{ start: string; end: string }> = [];
  if (oh.morning_start && oh.morning_end) periods.push({ start: oh.morning_start, end: oh.morning_end });
  if (oh.afternoon_start && oh.afternoon_end) periods.push({ start: oh.afternoon_start, end: oh.afternoon_end });

  const capacitiesAfter = await computeSlotCapacities(
    pickedDate,
    durationMinutes,
    staff.map((s) => s.id),
    periods,
    agendaBlocks,
  );

  const sameTimeAfter = capacitiesAfter.find((c) => c.time === slotForTwo.time);
  const sameTimeFreeCount = sameTimeAfter?.freeCount ?? -1;

  const stillAvailableSlots = capacitiesAfter.filter((c) => c.freeCount > 0).map((c) => c.time);

  const result = {
    company: {
      id: company.id,
      name: company.name,
      slug: company.slug,
      ownerEmail,
    },
    targetService: {
      id: service.service_id,
      name: service.service_name,
      durationMinutes,
      professionals: staff,
    },
    testDate: formatDateKey(pickedDate),
    testDateBr: toAgendaDateBr(pickedDate),
    targetTime: slotForTwo.time,
    beforeInsertionCapacityAtTargetTime: slotForTwo.freeCount,
    insertedAppointments: createdAppointmentIds,
    afterInsertionCapacityAtTargetTime: sameTimeFreeCount,
    thirdAppointmentBlocked: sameTimeFreeCount === 0,
    stillAvailableSlotsCountAfterInsertion: stillAvailableSlots.length,
    stillAvailableSlotsAfterInsertion: stillAvailableSlots,
  };

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((err) => {
    console.error("[SCRIPT_ERROR]", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    // Limpeza para nao sujar o ambiente de teste
    if (createdAppointmentIds.length > 0) {
      await sql`
        delete from appointments
        where id = any(${createdAppointmentIds}::text[])
      `;
      console.log(`CLEANUP_OK: ${createdAppointmentIds.length} agendamento(s) removido(s)`);
    }
    await sql.end();
  });
