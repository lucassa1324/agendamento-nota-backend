import { Elysia, t } from "elysia";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../../../infrastructure/drizzle/database";
import * as schema from "../../../../../db/schema";
import { authPlugin } from "../../../../infrastructure/auth/auth-plugin";
import { MailService } from "../../../../notifications/application/mail.service";

const INVITE_EXPIRATION_HOURS = 48;

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const buildInviteIdentifier = (companyId: string, email: string) =>
  `staff-invite:${companyId}:${normalizeEmail(email)}`;

const resolveFrontendBaseUrl = () =>
  process.env.FRONTEND_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3000";

async function canManageStaff(companyId: string, userId: string, role?: string) {
  if (role === "SUPER_ADMIN" || role === "ADMIN") {
    return true;
  }

  const [company] = await db
    .select({ ownerId: schema.companies.ownerId })
    .from(schema.companies)
    .where(eq(schema.companies.id, companyId))
    .limit(1);

  if (company?.ownerId === userId) {
    return true;
  }

  const [staffMember] = await db
    .select({
      isAdmin: schema.staff.isAdmin,
      isActive: schema.staff.isActive,
    })
    .from(schema.staff)
    .where(
      and(
        eq(schema.staff.companyId, companyId),
        eq(schema.staff.userId, userId),
      ),
    )
    .limit(1);

  return Boolean(staffMember?.isActive && staffMember?.isAdmin);
}

const ensureStaffSchemaAvailable = async () => {
  const result = await db.execute(
    sql`select exists (
      select 1
      from information_schema.tables
      where table_schema = 'public' and table_name = 'staff'
    ) as exists`,
  );

  const rows = (result as { rows?: Array<{ exists?: boolean }> }).rows ?? [];
  return rows[0]?.exists === true;
};

export const staffController = () =>
  new Elysia({ prefix: "/staff" })
    .use(authPlugin)
    .onBeforeHandle(({ user, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }
    })
    .get(
      "/company/:companyId",
      async ({ params: { companyId }, user, set }) => {
        const schemaReady = await ensureStaffSchemaAvailable();
        if (!schemaReady) {
          set.status = 503;
          return { error: "Módulo de staff indisponível. Execute as migrations pendentes." };
        }

        const isAllowed = await canManageStaff(companyId, user!.id, user?.role);
        if (!isAllowed) {
          set.status = 403;
          return { error: "Forbidden" };
        }

        const members = await db
          .select({
            id: schema.staff.id,
            name: schema.staff.name,
            email: schema.staff.email,
            isActive: schema.staff.isActive,
            isAdmin: schema.staff.isAdmin,
            isSecretary: schema.staff.isSecretary,
            isProfessional: schema.staff.isProfessional,
            commissionRate: schema.staff.commissionRate,
          })
          .from(schema.staff)
          .where(eq(schema.staff.companyId, companyId));

        if (members.length === 0) {
          return [];
        }

        const serviceLinks = await db
          .select({
            staffId: schema.staffServices.staffId,
            serviceId: schema.staffServices.serviceId,
          })
          .from(schema.staffServices)
          .where(inArray(schema.staffServices.staffId, members.map((member) => member.id)));

        const servicesByStaff = new Map<string, string[]>();
        for (const link of serviceLinks) {
          const current = servicesByStaff.get(link.staffId) || [];
          current.push(link.serviceId);
          servicesByStaff.set(link.staffId, current);
        }

        return members.map((member) => ({
          ...member,
          serviceIds: servicesByStaff.get(member.id) || [],
        }));
      },
      {
        params: t.Object({
          companyId: t.String(),
        }),
      },
    )
    .post(
      "/invite",
      async ({ body, user, set }) => {
        const schemaReady = await ensureStaffSchemaAvailable();
        if (!schemaReady) {
          set.status = 503;
          return { error: "Módulo de staff indisponível. Execute as migrations pendentes." };
        }

        const normalizedEmail = normalizeEmail(body.email);
        const isAllowed = await canManageStaff(body.companyId, user!.id, user?.role);

        if (!isAllowed) {
          set.status = 403;
          return { error: "Forbidden" };
        }

        const now = new Date();
        const expiresAt = new Date(now.getTime() + INVITE_EXPIRATION_HOURS * 60 * 60 * 1000);

        const [existingMember] = await db
          .select({ id: schema.staff.id })
          .from(schema.staff)
          .where(
            and(
              eq(schema.staff.companyId, body.companyId),
              eq(schema.staff.email, normalizedEmail),
            ),
          )
          .limit(1);

        const memberId = existingMember?.id || crypto.randomUUID();

        if (existingMember) {
          await db
            .update(schema.staff)
            .set({
              name: body.name.trim(),
              email: normalizedEmail,
              isAdmin: body.isAdmin ?? false,
              isSecretary: body.isSecretary ?? false,
              isProfessional: body.isProfessional ?? true,
              commissionRate: body.commissionRate ?? 0,
              isActive: body.isActive ?? true,
              updatedAt: now,
            })
            .where(eq(schema.staff.id, existingMember.id));
        } else {
          await db.insert(schema.staff).values({
            id: memberId,
            companyId: body.companyId,
            name: body.name.trim(),
            email: normalizedEmail,
            isAdmin: body.isAdmin ?? false,
            isSecretary: body.isSecretary ?? false,
            isProfessional: body.isProfessional ?? true,
            commissionRate: body.commissionRate ?? 0,
            isActive: body.isActive ?? true,
          });
        }

        const serviceIds = body.serviceIds ?? [];
        await db.delete(schema.staffServices).where(eq(schema.staffServices.staffId, memberId));
        if (serviceIds.length > 0) {
          await db.insert(schema.staffServices).values(
            serviceIds.map((serviceId) => ({
              staffId: memberId,
              serviceId,
            })),
          );
        }

        const inviteToken = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
        const inviteIdentifier = buildInviteIdentifier(body.companyId, normalizedEmail);
        const invitePayload = JSON.stringify({
          token: inviteToken,
          staffId: memberId,
          companyId: body.companyId,
          email: normalizedEmail,
          invitedBy: user!.id,
          createdAt: now.toISOString(),
        });

        await db.delete(schema.verification).where(eq(schema.verification.identifier, inviteIdentifier));
        await db.insert(schema.verification).values({
          id: crypto.randomUUID(),
          identifier: inviteIdentifier,
          value: invitePayload,
          expiresAt,
          createdAt: now,
          updatedAt: now,
        });

        const inviteUrl = `${resolveFrontendBaseUrl()}/convite-colaborador?token=${encodeURIComponent(inviteToken)}&companyId=${encodeURIComponent(body.companyId)}&email=${encodeURIComponent(normalizedEmail)}`;
        let emailSent = false;

        try {
          const mailService = new MailService();
          await mailService.sendMail({
            to: normalizedEmail,
            subject: "Você foi convidado para colaborar no Aura Gestão",
            html: `
              <div style="font-family:Arial,sans-serif;line-height:1.5">
                <h2>Convite para o time</h2>
                <p>Olá, ${body.name.trim()}!</p>
                <p>Você recebeu um convite para entrar no time do Aura Gestão.</p>
                <p><a href="${inviteUrl}" target="_blank" rel="noreferrer">Clique aqui para aceitar o convite</a></p>
                <p>Este link expira em ${INVITE_EXPIRATION_HOURS} horas.</p>
              </div>
            `,
          });
          emailSent = true;
        } catch (error) {
          console.error("[STAFF_INVITE_EMAIL_ERROR]", error);
        }

        return {
          success: true,
          staffId: memberId,
          email: normalizedEmail,
          inviteUrl,
          expiresAt: expiresAt.toISOString(),
          emailSent,
        };
      },
      {
        body: t.Object({
          companyId: t.String(),
          name: t.String({ minLength: 2 }),
          email: t.String({ format: "email" }),
          isActive: t.Optional(t.Boolean()),
          isAdmin: t.Optional(t.Boolean()),
          isSecretary: t.Optional(t.Boolean()),
          isProfessional: t.Optional(t.Boolean()),
          commissionRate: t.Optional(t.Number({ minimum: 0, maximum: 100 })),
          serviceIds: t.Optional(t.Array(t.String())),
        }),
      },
    )
    .patch(
      "/:id",
      async ({ params: { id }, body, user, set }) => {
        const schemaReady = await ensureStaffSchemaAvailable();
        if (!schemaReady) {
          set.status = 503;
          return { error: "Módulo de staff indisponível. Execute as migrations pendentes." };
        }

        const isAllowed = await canManageStaff(body.companyId, user!.id, user?.role);
        if (!isAllowed) {
          set.status = 403;
          return { error: "Forbidden" };
        }

        const [existing] = await db
          .select({ id: schema.staff.id })
          .from(schema.staff)
          .where(
            and(
              eq(schema.staff.id, id),
              eq(schema.staff.companyId, body.companyId),
            ),
          )
          .limit(1);

        if (!existing) {
          set.status = 404;
          return { error: "Staff not found" };
        }

        await db
          .update(schema.staff)
          .set({
            name: body.name.trim(),
            email: normalizeEmail(body.email),
            isActive: body.isActive,
            isAdmin: body.isAdmin,
            isSecretary: body.isSecretary,
            isProfessional: body.isProfessional,
            commissionRate: body.commissionRate,
            updatedAt: new Date(),
          })
          .where(eq(schema.staff.id, id));

        await db.delete(schema.staffServices).where(eq(schema.staffServices.staffId, id));
        if (body.serviceIds.length > 0) {
          await db.insert(schema.staffServices).values(
            body.serviceIds.map((serviceId) => ({
              staffId: id,
              serviceId,
            })),
          );
        }

        return { success: true };
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        body: t.Object({
          companyId: t.String(),
          name: t.String({ minLength: 2 }),
          email: t.String({ format: "email" }),
          isActive: t.Boolean(),
          isAdmin: t.Boolean(),
          isSecretary: t.Boolean(),
          isProfessional: t.Boolean(),
          commissionRate: t.Number({ minimum: 0, maximum: 100 }),
          serviceIds: t.Array(t.String()),
        }),
      },
    );
