import { Elysia, t } from "elysia";
import { and, eq, inArray } from "drizzle-orm";
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

const generateTemporaryPassword = () => {
  const randomSuffix = Math.random().toString(36).slice(-6).toUpperCase();
  return `Aura@${randomSuffix}9`;
};

type StaffInvitePayload = {
  token: string;
  staffId: string;
  companyId: string;
  email: string;
  invitedBy: string;
  createdAt: string;
};

const parseInvitePayload = (value: string): StaffInvitePayload | null => {
  try {
    const parsed = JSON.parse(value) as Partial<StaffInvitePayload>;
    if (
      !parsed ||
      typeof parsed.token !== "string" ||
      typeof parsed.staffId !== "string" ||
      typeof parsed.companyId !== "string" ||
      typeof parsed.email !== "string"
    ) {
      return null;
    }
    return {
      token: parsed.token,
      staffId: parsed.staffId,
      companyId: parsed.companyId,
      email: normalizeEmail(parsed.email),
      invitedBy: String(parsed.invitedBy || ""),
      createdAt: String(parsed.createdAt || ""),
    };
  } catch {
    return null;
  }
};

type CreateInviteParams = {
  staffId: string;
  companyId: string;
  email: string;
  invitedBy: string;
};

const createInviteRecord = async (params: CreateInviteParams) => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + INVITE_EXPIRATION_HOURS * 60 * 60 * 1000);
  const inviteToken = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
  const inviteIdentifier = buildInviteIdentifier(params.companyId, params.email);
  const invitePayload = JSON.stringify({
    token: inviteToken,
    staffId: params.staffId,
    companyId: params.companyId,
    email: params.email,
    invitedBy: params.invitedBy,
    createdAt: now.toISOString(),
  } satisfies StaffInvitePayload);

  await db.delete(schema.verification).where(eq(schema.verification.identifier, inviteIdentifier));
  await db.insert(schema.verification).values({
    id: crypto.randomUUID(),
    identifier: inviteIdentifier,
    value: invitePayload,
    expiresAt,
    createdAt: now,
    updatedAt: now,
  });

  const inviteUrl = `${resolveFrontendBaseUrl()}/convite-colaborador?token=${encodeURIComponent(inviteToken)}&companyId=${encodeURIComponent(params.companyId)}&email=${encodeURIComponent(params.email)}`;
  return {
    inviteToken,
    inviteUrl,
    expiresAt,
  };
};

const sendInviteEmail = async (params: {
  email: string;
  name: string;
  inviteUrl: string;
  temporaryPassword?: string | null;
}) => {
  const mailService = new MailService();
  const credentialBlock = params.temporaryPassword
    ? `
        <p><strong>Senha temporária de acesso:</strong> ${params.temporaryPassword}</p>
        <p>Use essa senha para entrar e, após o primeiro acesso, altere para uma senha pessoal.</p>
      `
    : `
        <p>Use a senha já cadastrada para este e-mail para concluir o acesso.</p>
      `;
  await mailService.sendMail({
    to: params.email,
    subject: "Você foi convidado para colaborar no Aura Gestão",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2>Convite para o time</h2>
        <p>Olá, ${params.name}!</p>
        <p>Você recebeu um convite para entrar no time do Aura Gestão.</p>
        ${credentialBlock}
        <p><a href="${params.inviteUrl}" target="_blank" rel="noreferrer">Clique aqui para aceitar o convite</a></p>
        <p>Este link expira em ${INVITE_EXPIRATION_HOURS} horas.</p>
      </div>
    `,
  });
};

async function canManageStaff(companyId: string, userId: string, role?: string) {
  const normalizedRole = role?.toUpperCase();
  if (normalizedRole === "SUPER_ADMIN" || normalizedRole === "ADMIN") {
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
      isSecretary: schema.staff.isSecretary,
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

  return Boolean(
    staffMember?.isActive && (staffMember.isAdmin || staffMember.isSecretary),
  );
}

const ensureUserAndCredentialForStaff = async (params: {
  email: string;
  name: string;
  passwordHash?: string;
  updateExistingPassword?: boolean;
}) => {
  const normalizedEmail = normalizeEmail(params.email);
  const [existingUser] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, normalizedEmail))
    .limit(1);

  const userId = existingUser?.id || crypto.randomUUID();

  if (!existingUser) {
    await db.insert(schema.user).values({
      id: userId,
      name: params.name.trim() || "Colaborador",
      email: normalizedEmail,
      emailVerified: true,
    });
  }

  let createdCredentialAccount = false;
  let updatedCredentialAccount = false;

  if (params.passwordHash) {
    const existingCredentialAccounts = await db
      .select({ id: schema.account.id })
      .from(schema.account)
      .where(
        and(
          eq(schema.account.userId, userId),
          eq(schema.account.providerId, "credential"),
        ),
      );

    if (existingCredentialAccounts.length === 0) {
      await db.insert(schema.account).values({
        id: crypto.randomUUID(),
        // Para provider "credential", o Better Auth usa accountId vinculado ao e-mail.
        // Salvar userId aqui quebra o lookup de login por e-mail.
        accountId: normalizedEmail,
        providerId: "credential",
        userId,
        password: params.passwordHash,
      });
      createdCredentialAccount = true;
    } else if (params.updateExistingPassword) {
      await db
        .update(schema.account)
        .set({
          // Auto-correção de contas antigas criadas com accountId incorreto.
          accountId: normalizedEmail,
          password: params.passwordHash,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.account.userId, userId),
            eq(schema.account.providerId, "credential"),
          ),
        );
      updatedCredentialAccount = true;
    }
  }

  return {
    userId,
    createdUser: !existingUser,
    createdCredentialAccount,
    updatedCredentialAccount,
  };
};

export const staffController = () =>
  new Elysia({ prefix: "/staff" })
    .get(
      "/invite/preview",
      async ({ query, set }) => {
        const normalizedEmail = normalizeEmail(query.email);
        const inviteIdentifier = buildInviteIdentifier(query.companyId, normalizedEmail);
        const [inviteRow] = await db
          .select({
            id: schema.verification.id,
            value: schema.verification.value,
            expiresAt: schema.verification.expiresAt,
          })
          .from(schema.verification)
          .where(eq(schema.verification.identifier, inviteIdentifier))
          .limit(1);

        if (!inviteRow) {
          set.status = 404;
          return { error: "Convite não encontrado." };
        }

        const now = new Date();
        if (inviteRow.expiresAt.getTime() < now.getTime()) {
          set.status = 410;
          return { error: "Convite expirado." };
        }

        const payload = parseInvitePayload(inviteRow.value);
        if (!payload || payload.token !== query.token) {
          set.status = 403;
          return { error: "Token inválido." };
        }

        const [company] = await db
          .select({
            id: schema.companies.id,
            name: schema.companies.name,
            slug: schema.companies.slug,
          })
          .from(schema.companies)
          .where(eq(schema.companies.id, query.companyId))
          .limit(1);

        const [member] = await db
          .select({
            name: schema.staff.name,
            email: schema.staff.email,
            isAdmin: schema.staff.isAdmin,
            isSecretary: schema.staff.isSecretary,
            isProfessional: schema.staff.isProfessional,
          })
          .from(schema.staff)
          .where(eq(schema.staff.id, payload.staffId))
          .limit(1);

        return {
          success: true,
          company: company || null,
          member: member || null,
          expiresAt: inviteRow.expiresAt.toISOString(),
          dashboardUrl: company?.slug ? `/admin/${company.slug}/dashboard` : "/admin",
        };
      },
      {
        query: t.Object({
          token: t.String({ minLength: 16 }),
          companyId: t.String(),
          email: t.String({ format: "email" }),
        }),
      },
    )
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
        const normalizedEmail = normalizeEmail(body.email);
        const isAllowed = await canManageStaff(body.companyId, user!.id, user?.role);

        if (!isAllowed) {
          set.status = 403;
          return { error: "Forbidden" };
        }

        const now = new Date();

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

        const temporaryPassword = generateTemporaryPassword();
        const temporaryPasswordHash = await Bun.password.hash(temporaryPassword, {
          algorithm: "argon2id",
        });

        const ensuredUser = await ensureUserAndCredentialForStaff({
          email: normalizedEmail,
          name: body.name,
          passwordHash: temporaryPasswordHash,
          updateExistingPassword: true,
        });
        const temporaryPasswordForInvite = temporaryPassword;
        await db
          .update(schema.staff)
          .set({
            userId: ensuredUser.userId,
            updatedAt: now,
          })
          .where(eq(schema.staff.id, memberId));

        const invite = await createInviteRecord({
          staffId: memberId,
          companyId: body.companyId,
          email: normalizedEmail,
          invitedBy: user!.id,
        });
        let emailSent = false;
        let emailError: string | null = null;

        try {
          await sendInviteEmail({
            email: normalizedEmail,
            name: body.name.trim(),
            inviteUrl: invite.inviteUrl,
            temporaryPassword: temporaryPasswordForInvite,
          });
          emailSent = true;
        } catch (error: unknown) {
          emailError =
            error instanceof Error
              ? error.message
              : typeof error === "object" &&
                  error !== null &&
                  "message" in error &&
                  typeof (error as { message?: unknown }).message === "string"
                ? (error as { message: string }).message
                : "Falha desconhecida ao enviar convite por e-mail.";
          console.error("[STAFF_INVITE_EMAIL_ERROR]", error);
        }

        return {
          success: true,
          staffId: memberId,
          email: normalizedEmail,
          inviteUrl: invite.inviteUrl,
          expiresAt: invite.expiresAt.toISOString(),
          emailSent,
          emailError,
          temporaryPassword: temporaryPasswordForInvite,
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
    .post(
      "/invite/resend",
      async ({ body, user, set }) => {
        const normalizedEmail = normalizeEmail(body.email);
        const isAllowed = await canManageStaff(body.companyId, user!.id, user?.role);
        if (!isAllowed) {
          set.status = 403;
          return { error: "Forbidden" };
        }

        const [member] = await db
          .select({
            id: schema.staff.id,
            name: schema.staff.name,
            email: schema.staff.email,
          })
          .from(schema.staff)
          .where(
            and(
              eq(schema.staff.companyId, body.companyId),
              eq(schema.staff.email, normalizedEmail),
            ),
          )
          .limit(1);

        if (!member) {
          set.status = 404;
          return { error: "Colaborador não encontrado para este e-mail." };
        }

        const temporaryPassword = generateTemporaryPassword();
        const temporaryPasswordHash = await Bun.password.hash(temporaryPassword, {
          algorithm: "argon2id",
        });
        const ensuredUser = await ensureUserAndCredentialForStaff({
          email: normalizedEmail,
          name: member.name,
          passwordHash: temporaryPasswordHash,
          updateExistingPassword: true,
        });
        const temporaryPasswordForInvite = temporaryPassword;

        const invite = await createInviteRecord({
          staffId: member.id,
          companyId: body.companyId,
          email: normalizedEmail,
          invitedBy: user!.id,
        });

        let emailSent = false;
        let emailError: string | null = null;
        try {
          await sendInviteEmail({
            email: normalizedEmail,
            name: member.name,
            inviteUrl: invite.inviteUrl,
            temporaryPassword: temporaryPasswordForInvite,
          });
          emailSent = true;
        } catch (error: unknown) {
          emailError =
            error instanceof Error
              ? error.message
              : typeof error === "object" &&
                  error !== null &&
                  "message" in error &&
                  typeof (error as { message?: unknown }).message === "string"
                ? (error as { message: string }).message
                : "Falha desconhecida ao reenviar convite por e-mail.";
          console.error("[STAFF_RESEND_INVITE_EMAIL_ERROR]", error);
        }

        return {
          success: true,
          staffId: member.id,
          email: normalizedEmail,
          inviteUrl: invite.inviteUrl,
          expiresAt: invite.expiresAt.toISOString(),
          emailSent,
          emailError,
          temporaryPassword: temporaryPasswordForInvite,
        };
      },
      {
        body: t.Object({
          companyId: t.String(),
          email: t.String({ format: "email" }),
        }),
      },
    )
    .post(
      "/invite/accept",
      async ({ body, user, set }) => {
        if (!user?.email) {
          set.status = 400;
          return { error: "Não foi possível identificar o e-mail da sessão." };
        }

        const normalizedEmail = normalizeEmail(body.email);
        const sessionEmail = normalizeEmail(user.email);
        const inviteIdentifier = buildInviteIdentifier(body.companyId, normalizedEmail);

        const [inviteRow] = await db
          .select({
            id: schema.verification.id,
            value: schema.verification.value,
            expiresAt: schema.verification.expiresAt,
          })
          .from(schema.verification)
          .where(eq(schema.verification.identifier, inviteIdentifier))
          .limit(1);

        if (!inviteRow) {
          set.status = 404;
          return { error: "Convite não encontrado ou já utilizado." };
        }

        const now = new Date();
        if (inviteRow.expiresAt.getTime() < now.getTime()) {
          await db.delete(schema.verification).where(eq(schema.verification.id, inviteRow.id));
          set.status = 410;
          return { error: "Este convite expirou. Solicite um novo convite ao administrador." };
        }

        const payload = parseInvitePayload(inviteRow.value);
        if (
          !payload ||
          payload.token !== body.token ||
          payload.companyId !== body.companyId ||
          payload.email !== normalizedEmail
        ) {
          set.status = 403;
          return { error: "Token de convite inválido." };
        }

        if (sessionEmail !== normalizedEmail) {
          set.status = 403;
          return { error: "Faça login com o mesmo e-mail que recebeu o convite." };
        }

        const [member] = await db
          .select({
            id: schema.staff.id,
            userId: schema.staff.userId,
            companyId: schema.staff.companyId,
            email: schema.staff.email,
            name: schema.staff.name,
            isAdmin: schema.staff.isAdmin,
            isSecretary: schema.staff.isSecretary,
            isProfessional: schema.staff.isProfessional,
          })
          .from(schema.staff)
          .where(
            and(
              eq(schema.staff.id, payload.staffId),
              eq(schema.staff.companyId, payload.companyId),
              eq(schema.staff.email, payload.email),
            ),
          )
          .limit(1);

        if (!member) {
          set.status = 404;
          return { error: "Colaborador não encontrado para este convite." };
        }

        if (member.userId && member.userId !== user.id) {
          set.status = 409;
          return { error: "Este convite já foi aceito por outra conta." };
        }

        const [alreadyLinked] = await db
          .select({ id: schema.staff.id })
          .from(schema.staff)
          .where(
            and(
              eq(schema.staff.companyId, payload.companyId),
              eq(schema.staff.userId, user.id),
            ),
          )
          .limit(1);

        if (alreadyLinked && alreadyLinked.id !== member.id) {
          set.status = 409;
          return { error: "Sua conta já está vinculada a outro colaborador desta empresa." };
        }

        await db
          .update(schema.staff)
          .set({
            userId: user.id,
            isActive: true,
            updatedAt: now,
          })
          .where(eq(schema.staff.id, member.id));

        await db.delete(schema.verification).where(eq(schema.verification.id, inviteRow.id));

        const [company] = await db
          .select({
            id: schema.companies.id,
            slug: schema.companies.slug,
            name: schema.companies.name,
          })
          .from(schema.companies)
          .where(eq(schema.companies.id, payload.companyId))
          .limit(1);

        const dashboardUrl = company?.slug ? `/admin/${company.slug}/dashboard` : "/admin";

        return {
          success: true,
          message: "Convite aceito com sucesso.",
          companyId: payload.companyId,
          companyName: company?.name || null,
          dashboardUrl,
          staff: {
            id: member.id,
            name: member.name,
            email: member.email,
            isAdmin: member.isAdmin,
            isSecretary: member.isSecretary,
            isProfessional: member.isProfessional,
          },
        };
      },
      {
        body: t.Object({
          token: t.String({ minLength: 16 }),
          companyId: t.String(),
          email: t.String({ format: "email" }),
        }),
      },
    )
    .patch(
      "/company/:companyId/financial-password",
      async ({ params: { companyId }, body, user, set }) => {
        const isAllowed = await canManageStaff(companyId, user!.id, user?.role);
        if (!isAllowed) {
          set.status = 403;
          return { error: "Forbidden" };
        }

        if (!body.password || body.password.trim().length < 4) {
          set.status = 422;
          return { error: "A senha financeira deve ter ao menos 4 caracteres." };
        }

        const [company] = await db
          .select({ id: schema.companies.id })
          .from(schema.companies)
          .where(eq(schema.companies.id, companyId))
          .limit(1);

        if (!company) {
          set.status = 404;
          return { error: "Empresa não encontrada." };
        }

        const hashedPassword = await Bun.password.hash(body.password);
        await db
          .update(schema.companies)
          .set({
            financialPassword: hashedPassword,
            updatedAt: new Date(),
          })
          .where(eq(schema.companies.id, companyId));

        return {
          success: true,
          hasFinancialPassword: true,
        };
      },
      {
        params: t.Object({
          companyId: t.String(),
        }),
        body: t.Object({
          password: t.String({ minLength: 4, maxLength: 128 }),
        }),
      },
    )
    .patch(
      "/:id/reset-password",
      async ({ params: { id }, body, user, set }) => {
        const isAllowed = await canManageStaff(body.companyId, user!.id, user?.role);
        if (!isAllowed) {
          set.status = 403;
          return { error: "Forbidden" };
        }

        if (id.startsWith("temp-")) {
          set.status = 422;
          return { error: "Salve o colaborador antes de redefinir a senha." };
        }

        const [member] = await db
          .select({
            id: schema.staff.id,
            name: schema.staff.name,
            email: schema.staff.email,
          })
          .from(schema.staff)
          .where(
            and(
              eq(schema.staff.id, id),
              eq(schema.staff.companyId, body.companyId),
            ),
          )
          .limit(1);

        if (!member) {
          set.status = 404;
          return { error: "Colaborador não encontrado." };
        }

        const hashedPassword = await Bun.password.hash(body.password, {
          algorithm: "argon2id",
        });
        const ensuredUser = await ensureUserAndCredentialForStaff({
          email: member.email,
          name: member.name,
          passwordHash: hashedPassword,
          updateExistingPassword: true,
        });

        await db
          .update(schema.staff)
          .set({
            userId: ensuredUser.userId,
            updatedAt: new Date(),
          })
          .where(eq(schema.staff.id, member.id));

        return {
          success: true,
          message: "Senha de acesso redefinida com sucesso.",
          createdCredentialAccount: ensuredUser.createdCredentialAccount,
          updatedCredentialAccount: ensuredUser.updatedCredentialAccount,
          createdUser: ensuredUser.createdUser,
        };
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        body: t.Object({
          companyId: t.String(),
          password: t.String({ minLength: 6, maxLength: 128 }),
        }),
      },
    )
    .patch(
      "/:id",
      async ({ params: { id }, body, user, set }) => {
        const isAllowed = await canManageStaff(body.companyId, user!.id, user?.role);
        if (!isAllowed) {
          set.status = 403;
          return { error: "Forbidden" };
        }

        const isTemporaryId = id.startsWith("temp-");
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

        if (!existing && !isTemporaryId) {
          set.status = 404;
          return { error: "Staff not found" };
        }

        const staffId = existing?.id || crypto.randomUUID();

        if (!existing && isTemporaryId) {
          await db.insert(schema.staff).values({
            id: staffId,
            companyId: body.companyId,
            name: body.name.trim(),
            email: normalizeEmail(body.email),
            isActive: body.isActive,
            isAdmin: body.isAdmin,
            isSecretary: body.isSecretary,
            isProfessional: body.isProfessional,
            commissionRate: body.commissionRate,
          });
        } else {
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
            .where(eq(schema.staff.id, staffId));
        }

        await db.delete(schema.staffServices).where(eq(schema.staffServices.staffId, staffId));
        if (body.serviceIds.length > 0) {
          await db.insert(schema.staffServices).values(
            body.serviceIds.map((serviceId) => ({
              staffId,
              serviceId,
            })),
          );
        }

        return { success: true, id: staffId, created: isTemporaryId && !existing };
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
    )
    .delete(
      "/:id",
      async ({ params: { id }, query, user, set }) => {
        const isAllowed = await canManageStaff(query.companyId, user!.id, user?.role);
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
              eq(schema.staff.companyId, query.companyId),
            ),
          )
          .limit(1);

        if (!existing) {
          set.status = 404;
          return { error: "Staff not found" };
        }

        const [member] = await db
          .select({
            id: schema.staff.id,
            email: schema.staff.email,
            userId: schema.staff.userId,
          })
          .from(schema.staff)
          .where(eq(schema.staff.id, id))
          .limit(1);

        const normalizedEmail = normalizeEmail(member?.email || "");
        const inviteIdentifier = normalizedEmail
          ? buildInviteIdentifier(query.companyId, normalizedEmail)
          : null;
        const now = new Date();

        await db.transaction(async (tx) => {
          await tx.delete(schema.staffServices).where(eq(schema.staffServices.staffId, id));

          // Limpa vínculos operacionais da empresa sem deixar referências órfãs.
          await tx
            .update(schema.appointments)
            .set({
              staffId: null,
              updatedAt: now,
            })
            .where(
              and(
                eq(schema.appointments.companyId, query.companyId),
                eq(schema.appointments.staffId, id),
              ),
            );

          if (member?.userId) {
            await tx
              .update(schema.appointments)
              .set({
                createdBy: null,
                updatedAt: now,
              })
              .where(
                and(
                  eq(schema.appointments.companyId, query.companyId),
                  eq(schema.appointments.createdBy, member.userId),
                ),
              );

            await tx
              .delete(schema.systemLogs)
              .where(
                and(
                  eq(schema.systemLogs.companyId, query.companyId),
                  eq(schema.systemLogs.userId, member.userId),
                ),
              );

            await tx
              .delete(schema.bugReports)
              .where(
                and(
                  eq(schema.bugReports.companyId, query.companyId),
                  eq(schema.bugReports.reporterUserId, member.userId),
                ),
              );
          }

          if (inviteIdentifier) {
            await tx
              .delete(schema.verification)
              .where(eq(schema.verification.identifier, inviteIdentifier));
          }

          await tx.delete(schema.staff).where(eq(schema.staff.id, id));
        });

        return { success: true };
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        query: t.Object({
          companyId: t.String(),
        }),
      },
    );
