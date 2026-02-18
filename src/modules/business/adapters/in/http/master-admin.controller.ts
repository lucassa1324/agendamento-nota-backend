import { Elysia, t } from "elysia";
import { authPlugin } from "../../../../infrastructure/auth/auth-plugin";
import { auth } from "../../../../infrastructure/auth/auth";
import { db } from "../../../../infrastructure/drizzle/database";
import * as schema from "../../../../../db/schema";
import { eq, sql, count } from "drizzle-orm";

export const masterAdminController = new Elysia({ prefix: "/admin/master" })
  .use(authPlugin)
  .guard({
    isMaster: true
  })
  .get("/stats", async () => {
    try {
      const [userStats] = await db.select({ count: count() }).from(schema.user);
      const [companyStats] = await db.select({ count: count() }).from(schema.companies);
      const [appointmentStats] = await db.select({ count: count() }).from(schema.appointments);
      const [activeCompanies] = await db.select({ count: count() }).from(schema.companies).where(eq(schema.companies.active, true));

      return {
        totalUsers: Number(userStats.count),
        totalCompanies: Number(companyStats.count),
        totalAppointments: Number(appointmentStats.count),
        activeCompanies: Number(activeCompanies.count)
      };
    } catch (error: any) {
      console.error("[MASTER_ADMIN_STATS_ERROR]:", error);
      throw new Error("Erro ao buscar estatísticas: " + error.message);
    }
  })
  .get("/users", async () => {
    try {
      const results = await db
        .select({
          id: schema.user.id,
          name: schema.user.name,
          email: schema.user.email,
          role: schema.user.role,
          active: schema.user.active,
          createdAt: schema.user.createdAt,
          companyId: schema.companies.id,
          companyName: schema.companies.name,
          companySlug: schema.companies.slug,
        })
        .from(schema.user)
        .leftJoin(schema.companies, eq(schema.user.id, schema.companies.ownerId));

      return results;
    } catch (error: any) {
      console.error("[MASTER_ADMIN_USERS_ERROR]:", error);
      throw new Error("Erro ao buscar usuários: " + error.message);
    }
  })
  .patch("/users/:id/status", async ({ params, body, set }) => {
    try {
      const { id } = params;
      const { active } = body;

      const [updated] = await db
        .update(schema.user)
        .set({
          active,
          updatedAt: new Date()
        })
        .where(eq(schema.user.id, id))
        .returning();

      if (!updated) {
        set.status = 404;
        return { error: "Usuário não encontrado" };
      }

      return {
        success: true,
        message: `Status do usuário ${updated.name} alterado para ${active ? 'ativo' : 'inativo'}`
      };
    } catch (error: any) {
      console.error("[MASTER_ADMIN_USER_STATUS_ERROR]:", error);
      set.status = 500;
      return { error: "Erro ao atualizar status: " + error.message };
    }
  }, {
    body: t.Object({
      active: t.Boolean()
    })
  })
  .patch("/companies/:id/subscription", async ({ params, body, set }) => {
    try {
      const { id } = params;
      const { status, accessType } = body;

      const [updated] = await db
        .update(schema.companies)
        .set({
          subscriptionStatus: status as any,
          accessType: accessType as any,
          updatedAt: new Date()
        })
        .where(eq(schema.companies.id, id))
        .returning();

      if (!updated) {
        set.status = 404;
        return { error: "Empresa não encontrada" };
      }

      return {
        success: true,
        message: `Status da assinatura alterado para ${status} (Acesso: ${accessType})`
      };
    } catch (error: any) {
      console.error("[MASTER_ADMIN_SUBSCRIPTION_ERROR]:", error);
      set.status = 500;
      return { error: "Erro ao atualizar assinatura: " + error.message };
    }
  }, {
    body: t.Object({
      status: t.String(),
      accessType: t.Optional(t.String())
    })
  })
  .patch("/users/:id/email", async ({ params, body, set }) => {
    try {
      const { id } = params;
      const { email } = body;

      const [updated] = await db
        .update(schema.user)
        .set({
          email,
          updatedAt: new Date()
        })
        .where(eq(schema.user.id, id))
        .returning();

      if (!updated) {
        set.status = 404;
        return { error: "Usuário não encontrado" };
      }

      return {
        success: true,
        message: `Email do usuário ${updated.name} alterado para ${email}`
      };
    } catch (error: any) {
      console.error("[MASTER_ADMIN_USER_EMAIL_ERROR]:", error);
      set.status = 500;
      return { error: "Erro ao atualizar email: " + error.message };
    }
  }, {
    body: t.Object({
      email: t.String({ format: 'email' })
    })
  })
  .post("/users/:id/reset-password", async ({ params, set }) => {
    try {
      const { id } = params;
      const defaultPassword = "Mudar@123";

      // Better Auth gerencia as senhas na tabela 'user' (geralmente via hash)
      // Como estamos no Master Admin, vamos usar a API do Better Auth para atualizar
      // ou atualizar diretamente se soubermos o algoritmo. 
      // O Better Auth usa Scrypt por padrão.

      await auth.api.setPassword({
        body: {
          newPassword: defaultPassword,
        },
        headers: new Headers({
          "x-better-auth-user-id": id
        })
      });

      return {
        success: true,
        message: `Senha resetada para o padrão: ${defaultPassword}`
      };
    } catch (error: any) {
      console.error("[MASTER_ADMIN_RESET_PASSWORD_ERROR]:", error);
      set.status = 500;
      return { error: "Erro ao resetar senha: " + error.message };
    }
  })
  .get("/users/:id/details", async ({ params, set }) => {
    try {
      const { id } = params;

      // 1. Dados do Usuário
      const [usr] = await db
        .select()
        .from(schema.user)
        .where(eq(schema.user.id, id))
        .limit(1);

      if (!usr) {
        set.status = 404;
        return { error: "Usuário não encontrado" };
      }

      // 2. Dados do Estúdio
      const [company] = await db
        .select()
        .from(schema.companies)
        .where(eq(schema.companies.ownerId, id))
        .limit(1);

      // 3. Métricas Básicas (Agendamentos)
      const [appointmentStats] = await db
        .select({ count: count() })
        .from(schema.appointments)
        .where(company ? eq(schema.appointments.companyId, company.id) : undefined);

      // 4. Contas Vinculadas (Better Auth)
      const accounts = await db
        .select()
        .from(schema.account)
        .where(eq(schema.account.userId, id));

      return {
        user: {
          id: usr.id,
          name: usr.name,
          email: usr.email,
          role: usr.role,
          active: usr.active,
          createdAt: usr.createdAt,
        },
        business: company ? {
          id: company.id,
          name: company.name,
          slug: company.slug,
          active: company.active,
          createdAt: company.createdAt,
        } : null,
        stats: {
          totalAppointments: Number(appointmentStats?.count || 0),
        },
        auth: {
          providers: accounts.map(acc => acc.providerId),
        }
      };
    } catch (error: any) {
      console.error("[MASTER_ADMIN_USER_DETAILS_ERROR]:", error);
      set.status = 500;
      return { error: "Erro ao buscar detalhes: " + error.message };
    }
  })
  .delete("/users/:id", async ({ params, set }) => {
    try {
      const { id } = params;

      // O banco está configurado com ON DELETE CASCADE em todas as tabelas vinculadas:
      // user -> companies -> (services, appointments, site_customizations, gallery, etc.)
      const [deleted] = await db
        .delete(schema.user)
        .where(eq(schema.user.id, id))
        .returning();

      if (!deleted) {
        set.status = 404;
        return { error: "Usuário não encontrado" };
      }

      console.log(`[MASTER_ADMIN_DELETE]: Usuário ${deleted.email} e todos os seus dados foram removidos.`);

      return {
        success: true,
        message: `Usuário ${deleted.name} e todos os dados vinculados foram apagados permanentemente.`
      };
    } catch (error: any) {
      console.error("[MASTER_ADMIN_DELETE_ERROR]:", error);
      set.status = 500;
      return { error: "Erro ao apagar usuário: " + error.message };
    }
  })
  .get("/businesses", async () => {
    try {
      const results = await db
        .select({
          id: schema.companies.id,
          name: schema.companies.name,
          slug: schema.companies.slug,
          active: schema.companies.active,
          subscriptionStatus: schema.companies.subscriptionStatus,
          trialEndsAt: schema.companies.trialEndsAt,
          accessType: schema.companies.accessType,
          createdAt: schema.companies.createdAt,
          ownerEmail: schema.user.email,
        })
        .from(schema.companies)
        .innerJoin(schema.user, eq(schema.companies.ownerId, schema.user.id));

      return results;
    } catch (error: any) {
      console.error("[MASTER_ADMIN_BUSINESSES_ERROR]:", error);
      throw new Error("Erro ao buscar estúdios: " + error.message);
    }
  })
  .patch("/businesses/:id/status", async ({ params, body, set }) => {
    try {
      const { id } = params;
      const { active } = body;

      const [updated] = await db
        .update(schema.companies)
        .set({
          active,
          updatedAt: new Date()
        })
        .where(eq(schema.companies.id, id))
        .returning();

      if (!updated) {
        set.status = 404;
        return { error: "Estúdio não encontrado" };
      }

      // Invalidação de Sessão (Real-time Kick)
      if (active === false) {
        try {
          // Deleta todas as sessões vinculadas ao proprietário do estúdio
          await db
            .delete(schema.session)
            .where(eq(schema.session.userId, updated.ownerId));

          console.log(`[MASTER_ADMIN_KICK]: Sessões invalidadas para o estúdio ${updated.name} (Owner: ${updated.ownerId})`);
        } catch (kickError) {
          console.error("[MASTER_ADMIN_KICK_ERROR]:", kickError);
        }
      }

      return {
        success: true,
        message: `Status do estúdio ${updated.name} alterado para ${active ? 'ativo' : 'inativo'}`
      };
    } catch (error: any) {
      console.error("[MASTER_ADMIN_STATUS_ERROR]:", error);
      set.status = 500;
      return { error: "Erro ao atualizar status: " + error.message };
    }
  }, {
    body: t.Object({
      active: t.Boolean()
    })
  })
  .patch("/businesses/:id/subscription", async ({ params, body, set }) => {
    try {
      const { id } = params;
      const { subscriptionStatus, accessType } = body;

      const [updated] = await db
        .update(schema.companies)
        .set({
          subscriptionStatus,
          accessType: accessType || 'automatic',
          updatedAt: new Date()
        })
        .where(eq(schema.companies.id, id))
        .returning();

      if (!updated) {
        set.status = 404;
        return { error: "Estúdio não encontrado" };
      }

      return {
        success: true,
        message: `Assinatura do estúdio ${updated.name} alterada para ${subscriptionStatus}`
      };
    } catch (error: any) {
      console.error("[MASTER_ADMIN_SUBSCRIPTION_ERROR]:", error);
      set.status = 500;
      return { error: "Erro ao atualizar assinatura: " + error.message };
    }
  }, {
    body: t.Object({
      subscriptionStatus: t.String(),
      accessType: t.Optional(t.String())
    })
  });
