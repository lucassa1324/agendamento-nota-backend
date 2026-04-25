import { and, desc, eq, gte, lt } from "drizzle-orm";
import { db } from "../src/modules/infrastructure/drizzle/database";
import * as schema from "../src/db/schema";

const DEFAULT_EMAIL = "atrossilva2019@gmail.com";
const DEFAULT_PER_MONTH = 10;
const SLOT_HOURS = [9, 10, 11, 14, 15, 16];

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const buildIsoKey = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
};

const monthStart = (base: Date, offset: number) =>
  new Date(base.getFullYear(), base.getMonth() + offset, 1, 0, 0, 0, 0);

const monthEndExclusive = (base: Date, offset: number) =>
  new Date(base.getFullYear(), base.getMonth() + offset + 1, 1, 0, 0, 0, 0);

const formatMonthLabel = (date: Date) =>
  `${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;

async function resolveCompanyId(targetEmail: string) {
  const forcedCompanyId = process.env.COMPANY_ID?.trim();
  if (forcedCompanyId) {
    const [forcedCompany] = await db
      .select({ id: schema.companies.id, name: schema.companies.name })
      .from(schema.companies)
      .where(eq(schema.companies.id, forcedCompanyId))
      .limit(1);

    if (!forcedCompany) {
      throw new Error(`COMPANY_ID informado não foi encontrado: ${forcedCompanyId}`);
    }

    return forcedCompany.id;
  }

  const [existingByCustomer] = await db
    .select({ companyId: schema.appointments.companyId })
    .from(schema.appointments)
    .where(eq(schema.appointments.customerEmail, targetEmail))
    .orderBy(desc(schema.appointments.createdAt))
    .limit(1);

  if (existingByCustomer?.companyId) {
    return existingByCustomer.companyId;
  }

  const [fallbackCompany] = await db
    .select({ id: schema.companies.id })
    .from(schema.companies)
    .limit(1);

  if (!fallbackCompany) {
    throw new Error("Nenhuma empresa encontrada para inserir agendamentos.");
  }

  return fallbackCompany.id;
}

async function run() {
  const targetEmail = normalizeEmail(process.argv[2] || DEFAULT_EMAIL);
  const appointmentsPerMonth = Number(process.argv[3] || DEFAULT_PER_MONTH);

  if (!Number.isFinite(appointmentsPerMonth) || appointmentsPerMonth <= 0) {
    throw new Error("Quantidade por mês inválida. Use um número maior que zero.");
  }

  const companyId = await resolveCompanyId(targetEmail);

  const [company] = await db
    .select({ id: schema.companies.id, name: schema.companies.name, ownerId: schema.companies.ownerId })
    .from(schema.companies)
    .where(eq(schema.companies.id, companyId))
    .limit(1);

  if (!company) {
    throw new Error("Empresa selecionada não encontrada.");
  }

  const services = await db
    .select({
      id: schema.services.id,
      name: schema.services.name,
      price: schema.services.price,
      duration: schema.services.duration,
    })
    .from(schema.services)
    .where(eq(schema.services.companyId, company.id));

  if (services.length === 0) {
    throw new Error("A empresa não possui serviços cadastrados.");
  }

  const professionals = await db
    .select({ id: schema.staff.id })
    .from(schema.staff)
    .where(
      and(
        eq(schema.staff.companyId, company.id),
        eq(schema.staff.isActive, true),
        eq(schema.staff.isProfessional, true),
      ),
    );

  const [customerUser] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, targetEmail))
    .limit(1);

  const now = new Date();
  const globalStart = monthStart(now, 0);
  const globalEnd = monthEndExclusive(now, 1);

  const existingAppointments = await db
    .select({ scheduledAt: schema.appointments.scheduledAt })
    .from(schema.appointments)
    .where(
      and(
        eq(schema.appointments.companyId, company.id),
        gte(schema.appointments.scheduledAt, globalStart),
        lt(schema.appointments.scheduledAt, globalEnd),
      ),
    );

  const occupiedSlots = new Set(existingAppointments.map((row) => buildIsoKey(new Date(row.scheduledAt))));

  let createdTotal = 0;

  for (const monthOffset of [0, 1]) {
    const start = monthStart(now, monthOffset);
    const endExclusive = monthEndExclusive(now, monthOffset);
    const monthCandidates: Date[] = [];

    for (let day = 1; day <= 31; day += 1) {
      const dayDate = new Date(start.getFullYear(), start.getMonth(), day, 0, 0, 0, 0);
      if (dayDate.getMonth() !== start.getMonth()) break;

      const dayOfWeek = dayDate.getDay();
      if (dayOfWeek === 0) continue; // pula domingo

      for (const hour of SLOT_HOURS) {
        const slot = new Date(start.getFullYear(), start.getMonth(), day, hour, 0, 0, 0);
        if (slot < now) continue;
        if (slot >= endExclusive) continue;
        monthCandidates.push(slot);
      }
    }

    let createdThisMonth = 0;

    for (let i = 0; i < monthCandidates.length && createdThisMonth < appointmentsPerMonth; i += 1) {
      const scheduledAt = monthCandidates[i];
      const slotKey = buildIsoKey(scheduledAt);

      if (occupiedSlots.has(slotKey)) continue;

      const service = services[(createdTotal + i) % services.length];
      const staffId =
        professionals.length > 0 && (createdThisMonth + 1) % 3 !== 0
          ? professionals[(createdThisMonth + i) % professionals.length].id
          : null;

      await db.insert(schema.appointments).values({
        id: crypto.randomUUID(),
        companyId: company.id,
        serviceId: service.id,
        staffId,
        customerId: customerUser?.id || null,
        createdBy: company.ownerId,
        customerName: "ATRO SILVA",
        customerEmail: targetEmail,
        customerPhone: "11999999999",
        serviceNameSnapshot: service.name,
        servicePriceSnapshot: service.price,
        serviceDurationSnapshot: service.duration,
        scheduledAt,
        status: "PENDING",
        assignedBy: "staff",
        validationStatus: "confirmed",
      });

      occupiedSlots.add(slotKey);
      createdThisMonth += 1;
      createdTotal += 1;
    }

    console.log(
      `[SEED_APPOINTMENTS] ${createdThisMonth} agendamentos criados em ${formatMonthLabel(start)} para ${targetEmail}`,
    );
  }

  console.log(
    `[SEED_APPOINTMENTS] Total criado: ${createdTotal} | Empresa: ${company.name} (${company.id}) | Cliente: ${targetEmail}`,
  );
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[SEED_APPOINTMENTS] Erro:", error);
    process.exit(1);
  });
