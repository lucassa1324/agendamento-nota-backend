import { Elysia, t } from "elysia";
import { authPlugin, syncAsaasPaymentForCompany } from "../../../../infrastructure/auth/auth-plugin";
import { auth } from "../../../../infrastructure/auth/auth";
import { db } from "../../../../infrastructure/drizzle/database";
import * as schema from "../../../../../db/schema";
import { and, eq, sql, count } from "drizzle-orm";

const writeSystemLog = async ({
  userId,
  action,
  details,
  level = "INFO",
  companyId,
}: {
  userId?: string;
  action: string;
  details?: string;
  level?: string;
  companyId?: string;
}) => {
  try {
    await db.insert(schema.systemLogs).values({
      id: crypto.randomUUID(),
      userId,
      action,
      details,
      level,
      companyId,
      createdAt: new Date()
    });
  } catch (error: any) {
    const code = (error as any)?.code;
    const message = String(error?.message || "");
    if (code === "42P01" || message.toLowerCase().includes("system_logs")) {
      return;
    }
    console.error("[MASTER_ADMIN_LOG_WRITE_ERROR]:", error);
  }
};

const HEALTH_CHECK_COMPANY_SLUG = "sistema-health-check";
const HEALTH_CHECK_COMPANY_NAME = "SISTEMA_HEALTH_CHECK";
const HEALTH_CHECK_SERVICE_NAME = "Serviço Diagnóstico HC";
const HEALTH_CHECK_CUSTOMER_EMAIL = "healthcheck@system.local";

export const masterAdminController = () => new Elysia({ prefix: "/admin/master" })
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

      // Busca também assinaturas ativas e faturamento para a rota principal de stats
      const [activeSubs] = await db.execute(sql`
        SELECT COUNT(*)::int as count 
        FROM companies 
        WHERE subscription_status IN ('active', 'trialing', 'trial')
      `);

      // Busca o preço dinâmico para o cálculo do faturamento
      const [pricingSetting] = await db
        .select()
        .from(schema.systemSettings)
        .where(eq(schema.systemSettings.key, "monthly_price"))
        .limit(1);

      const currentPrice = pricingSetting ? parseFloat(pricingSetting.value) : 49.90;

      const [revenue] = await db.execute(sql`
        SELECT COALESCE(SUM(plan_price), 0)::float as total
        FROM (
          SELECT 
            CASE 
              WHEN access_type = 'premium' THEN 97.00
              WHEN access_type = 'pro' THEN 197.00
              WHEN access_type = 'automatic' THEN ${sql.raw(currentPrice.toString())}
              ELSE 0 
            END as plan_price
          FROM companies
          WHERE subscription_status IN ('active', 'trialing', 'trial')
        ) as prices
      `);

      return {
        totalUsers: Number(userStats.count),
        totalCompanies: Number(companyStats.count),
        totalAppointments: Number(appointmentStats.count),
        activeCompanies: Number(activeCompanies.count),
        activeSubscriptions: Number(activeSubs?.count || 0),
        monthlyRevenue: Number(revenue?.total || 0),
        revenue: Number(revenue?.total || 0), // Alias
        companies: Number(companyStats.count), // Alias
        appointments: Number(appointmentStats.count) // Alias
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
  .patch("/companies/:id/status", async ({ params, body, set }) => {
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
        return { error: "Empresa não encontrada" };
      }

      return {
        success: true,
        message: `Status da empresa ${updated.name} alterado para ${active ? 'ativa' : 'inativa'}`
      };
    } catch (error: any) {
      console.error("[MASTER_ADMIN_COMPANY_STATUS_ERROR]:", error);
      set.status = 500;
      return { error: "Erro ao atualizar status da empresa: " + error.message };
    }
  }, {
    body: t.Object({
      active: t.Boolean()
    })
  })
  .post("/users/:id/reset-email-verification", async ({ params, set }) => {
    try {
      const { id } = params;

      const [updated] = await db
        .update(schema.user)
        .set({
          emailVerified: false,
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
        message: `Verificação de e-mail do usuário ${updated.name} resetada com sucesso.`
      };
    } catch (error: any) {
      console.error("[MASTER_ADMIN_RESET_EMAIL_VERIFICATION_ERROR]:", error);
      set.status = 500;
      return { error: "Erro ao resetar verificação: " + error.message };
    }
  })
  .post("/companies/:id/reset-onboarding", async ({ params, set, user }) => {
    try {
      const { id } = params;

      const [company] = await db
        .select()
        .from(schema.companies)
        .where(eq(schema.companies.id, id))
        .limit(1);

      if (!company) {
        set.status = 404;
        return { error: "Empresa não encontrada." };
      }

      await db.update(schema.user)
        .set({
          hasCompletedOnboarding: false,
          updatedAt: new Date()
        })
        .where(eq(schema.user.id, company.ownerId));

      await writeSystemLog({
        userId: (user as any)?.id,
        action: "RESET_ONBOARDING",
        details: `Primeiro acesso resetado para ${company.name}.`,
        level: "WARN",
        companyId: id
      });

      return {
        success: true,
        message: "Primeiro acesso resetado com sucesso."
      };
    } catch (error: any) {
      console.error("[MASTER_ADMIN_RESET_ONBOARDING_ERROR]:", error);
      set.status = 500;
      return { error: "Erro ao resetar primeiro acesso: " + error.message };
    }
  })
  .patch("/companies/:id/subscription", async ({ params, body, set }) => {
    try {
      const { id } = params;
      const { status, accessType, actionType, trialDays } = body;

      let updateData: any = {
        subscriptionStatus: status as any,
        accessType: accessType as any,
        updatedAt: new Date()
      };

      // Se actionType for fornecido, aplica lógica específica
      if (actionType) {
        const [currentCompany] = await db
          .select()
          .from(schema.companies)
          .where(eq(schema.companies.id, id))
          .limit(1);

        if (!currentCompany) {
          set.status = 404;
          return { error: "Empresa não encontrada" };
        }

        const now = new Date();

        if (actionType === 'manual_custom_days') {
          // Opção 1: Liberar por X dias (Manual/Fatura)
          // Define status como 'active' para liberar acesso imediato
          const daysToAdd = trialDays ? Number(trialDays) : 30;
          const nextDue = new Date(now);
          nextDue.setDate(nextDue.getDate() + daysToAdd);

          updateData.subscriptionStatus = 'active';
          updateData.accessType = 'manual'; // Marca como manual para diferenciar
          updateData.trialEndsAt = nextDue;
          updateData.active = true;

        } else if (actionType === 'extend_trial_custom') {
          // Opção 2: Definir Teste (Novo Prazo)
          // Lógica alterada: Agora define EXATAMENTE os dias a partir de hoje, substituindo o prazo anterior.
          // Ex: Se faltam 3 dias e defino 4, passa a faltar 4 (não soma 3+4).

          const daysToAdd = trialDays ? Number(trialDays) : 14;
          const extendedDate = new Date(now); // Baseado em HOJE
          extendedDate.setDate(extendedDate.getDate() + daysToAdd);

          updateData.subscriptionStatus = 'trial';
          updateData.trialEndsAt = extendedDate;
          // Força o tipo de acesso para 'extended_trial' para diferenciar do 'automatic' (padrão)
          // O Frontend usará isso para saber que houve uma extensão manual.
          updateData.accessType = 'extended_trial';
          updateData.active = true;

        } else if (actionType === 'automatic') {
          // Busca o email do proprietário para sincronização
          const [owner] = await db
            .select()
            .from(schema.user)
            .where(eq(schema.user.id, currentCompany.ownerId))
            .limit(1);

          console.log(`[MASTER_ADMIN] Empresa ${id} voltando para modo automático. Sincronizando com Asaas...`);

          // Executa a sincronização real com o Asaas
          const syncResult = await syncAsaasPaymentForCompany(
            id,
            currentCompany.ownerId,
            owner?.email,
            {
              requireCurrentMonthPayment: true,
              ignoreBlockDate: false
            }
          );

          if (syncResult && syncResult.activated) {
            updateData.subscriptionStatus = 'active';
            updateData.accessType = 'automatic';
            updateData.trialEndsAt = syncResult.nextDue;
            updateData.active = true;
            console.log(`[MASTER_ADMIN] Sincronização bem-sucedida: Empresa ${id} ATIVA.`);
          } else {
            // Se não encontrar pagamento, define como past_due
            updateData.subscriptionStatus = 'past_due';
            updateData.accessType = 'automatic';
            updateData.active = false;
            console.log(`[MASTER_ADMIN] Sincronização falhou ou sem pagamento: Empresa ${id} bloqueada (past_due).`);
          }
        }
      }

      const [updated] = await db
        .update(schema.companies)
        .set(updateData)
        .where(eq(schema.companies.id, id))
        .returning();

      if (!updated) {
        set.status = 404;
        return { error: "Empresa não encontrada" };
      }

      if (actionType === 'automatic') {
        if (updated.subscriptionStatus === 'past_due') {
          try {
            await db
              .delete(schema.session)
              .where(eq(schema.session.userId, updated.ownerId));

            console.log(`[MASTER_ADMIN_KICK]: Sessões invalidadas para o estúdio ${updated.name} (Owner: ${updated.ownerId})`);
          } catch (kickError) {
            console.error("[MASTER_ADMIN_KICK_ERROR]:", kickError);
          }
        }
      } else if (actionType === 'manual_custom_days' || actionType === 'extend_trial_custom') {
        await db
          .update(schema.user)
          .set({
            active: true,
            updatedAt: new Date()
          })
          .where(eq(schema.user.id, updated.ownerId));
      }

      return {
        success: true,
        status: updated.subscriptionStatus,
        message: `Assinatura atualizada via ${actionType || 'direto'}: Status ${updated.subscriptionStatus}, Vence em ${updated.trialEndsAt?.toLocaleDateString()}`
      };
    } catch (error: any) {
      console.error("[MASTER_ADMIN_SUBSCRIPTION_ERROR]:", error);
      set.status = 500;
      return { error: "Erro ao atualizar assinatura: " + error.message };
    }
  }, {
    body: t.Object({
      status: t.String(),
      accessType: t.Optional(t.String()),
      actionType: t.Optional(t.String()), // 'manual_custom_days' | 'extend_trial_custom' | 'automatic'
      trialDays: t.Optional(t.Number()) // Quantidade de dias customizável
    })
  })
  .post("/companies/:id/sync", async ({ params, set, user }) => {
    try {
      const { id } = params;

      const [currentCompany] = await db
        .select()
        .from(schema.companies)
        .where(eq(schema.companies.id, id))
        .limit(1);

      if (!currentCompany) {
        set.status = 404;
        return { error: "Empresa não encontrada" };
      }

      const [owner] = await db
        .select()
        .from(schema.user)
        .where(eq(schema.user.id, currentCompany.ownerId))
        .limit(1);

      console.log(`[MASTER_ADMIN] Sincronização manual solicitada para ${id}.`);

      const syncResult = await syncAsaasPaymentForCompany(
        id,
        currentCompany.ownerId,
        owner?.email,
        {
          requireCurrentMonthPayment: true,
          ignoreBlockDate: false
        }
      );

      await writeSystemLog({
        userId: (user as any)?.id,
        action: "SYNC_ASAAS",
        details: `Sincronização manual solicitada. Resultado: ${syncResult?.activated ? 'Ativado' : 'Não alterado'}`,
        level: "INFO",
        companyId: id
      });

      if (syncResult && syncResult.activated) {
        return {
          success: true,
          status: 'active',
          message: "Pagamento confirmado e acesso liberado."
        };
      }

      // Se não ativou via syncResult, garante que o status reflita a realidade (past_due se automático)
      if (currentCompany.accessType === 'automatic') {
        await db.update(schema.companies)
          .set({ subscriptionStatus: 'past_due', updatedAt: new Date() })
          .where(eq(schema.companies.id, id));

        return {
          success: true,
          status: 'past_due',
          message: "Nenhum pagamento confirmado encontrado. Status definido como Pendente."
        };
      }

      return {
        success: false,
        status: currentCompany.subscriptionStatus,
        message: "Nenhum novo pagamento identificado no Asaas."
      };

    } catch (error: any) {
      console.error("[MASTER_ADMIN_SYNC_ERROR]:", error);
      set.status = 500;
      return { error: "Erro ao sincronizar: " + error.message };
    }
  })
  .post("/companies/:id/simulate-block", async ({ params, set, user }) => {
    try {
      const { id } = params;

      const [company] = await db.select()
        .from(schema.companies)
        .where(eq(schema.companies.id, id))
        .limit(1);

      if (!company) {
        set.status = 404;
        return { error: "Empresa não encontrada." };
      }

      console.log(`[MASTER_ADMIN] Simulando bloqueio para: ${company.name} (ID: ${company.id})`);

      // 1. Marcar como inadimplente e inativa
      await db.update(schema.companies)
        .set({
          subscriptionStatus: "past_due",
          active: false,
          accessType: "automatic",
          updatedAt: new Date() // CRITICAL: This date will be used by auth-plugin to ignore old payments
        })
        .where(eq(schema.companies.id, company.id));

      // 2. Desativar o dono
      await db.update(schema.user)
        .set({
          active: false,
          updatedAt: new Date()
        })
        .where(eq(schema.user.id, company.ownerId));

      // 3. Matar sessões para forçar re-login/re-auth
      await db.delete(schema.session)
        .where(eq(schema.session.userId, company.ownerId));

      await writeSystemLog({
        userId: (user as any)?.id,
        action: "SIMULATE_BLOCK",
        details: `Bloqueio simulado para ${company.name}. Status: past_due, Active: false.`,
        level: "WARN",
        companyId: id
      });

      return {
        success: true,
        message: `Bloqueio simulado com sucesso para ${company.name}.`
      };
    } catch (error: any) {
      console.error("[MASTER_ADMIN_SIMULATE_BLOCK_ERROR]:", error);
      set.status = 500;
      return { error: "Erro na simulação: " + error.message };
    }
  })
  .post("/companies/:id/reset-data", async ({ params, body, set, user }) => {
    try {
      const { id } = params;
      const { resetAppointments, resetServices } = body;

      if (resetAppointments) {
        await db.delete(schema.appointments).where(eq(schema.appointments.companyId, id));
      }

      if (resetServices) {
        await db.delete(schema.services).where(eq(schema.services.companyId, id));
      }

      await writeSystemLog({
        userId: (user as any)?.id,
        action: "RESET_DATA",
        details: `Reset: ${[resetAppointments ? 'Agendamentos' : null, resetServices ? 'Serviços' : null].filter(Boolean).join(', ')}`,
        level: "WARN",
        companyId: id
      });

      return {
        success: true,
        message: `Dados resetados com sucesso: ${[resetAppointments ? 'Agendamentos' : null, resetServices ? 'Serviços' : null].filter(Boolean).join(', ')}`
      };
    } catch (error: any) {
      console.error("[MASTER_ADMIN_RESET_DATA_ERROR]:", error);
      set.status = 500;
      return { error: "Erro ao resetar dados: " + error.message };
    }
  }, {
    body: t.Object({
      resetAppointments: t.Boolean(),
      resetServices: t.Boolean()
    })
  })
  .post("/companies/:id/test-expiration", async ({ params, set, user }) => {
    try {
      const { id } = params;
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      await db.update(schema.companies)
        .set({
          accessType: "manual",
          subscriptionStatus: "active",
          trialEndsAt: pastDate,
          updatedAt: new Date()
        })
        .where(eq(schema.companies.id, id));

      await writeSystemLog({
        userId: (user as any)?.id,
        action: "TEST_EXPIRATION",
        details: "Configurada expiração manual forçada para teste.",
        level: "INFO",
        companyId: id
      });

      return {
        success: true,
        message: "Empresa configurada como expirada (Acesso Manual). O sistema deve reverter para automático no próximo acesso."
      };
    } catch (error: any) {
      console.error("[MASTER_ADMIN_TEST_EXPIRATION_ERROR]:", error);
      set.status = 500;
      return { error: "Erro ao configurar expiração: " + error.message };
    }
  })
  .post("/companies/:id/simulate-past-due", async ({ params, set, user }) => {
    try {
      const { id } = params;

      await db.update(schema.companies)
        .set({
          accessType: "automatic",
          subscriptionStatus: "past_due",
          active: false,
          updatedAt: new Date()
        })
        .where(eq(schema.companies.id, id));

      // 2. Desativar o dono para garantir o bloqueio total
      const [company] = await db.select().from(schema.companies).where(eq(schema.companies.id, id)).limit(1);
      if (company) {
        await db.update(schema.user)
          .set({ active: false, updatedAt: new Date() })
          .where(eq(schema.user.id, company.ownerId));

        // 3. Matar sessões para forçar re-login/bloqueio imediato
        await db.delete(schema.session)
          .where(eq(schema.session.userId, company.ownerId));
      }

      await writeSystemLog({
        userId: (user as any)?.id,
        action: "SIMULATE_PAST_DUE",
        details: "Simulação de vencimento automático (past_due) ativada.",
        level: "INFO",
        companyId: id
      });

      return {
        success: true,
        message: "Empresa definida como Vencida (Modo Automático)."
      };
    } catch (error: any) {
      console.error("[MASTER_ADMIN_PAST_DUE_ERROR]:", error);
      set.status = 500;
      return { error: "Erro ao simular vencimento: " + error.message };
    }
  })
  .get("/logs", async () => {
    try {
      const results = await db
        .select({
          id: schema.systemLogs.id,
          userName: schema.user.name,
          action: schema.systemLogs.action,
          details: schema.systemLogs.details,
          level: schema.systemLogs.level,
          companyName: schema.companies.name,
          createdAt: schema.systemLogs.createdAt,
        })
        .from(schema.systemLogs)
        .leftJoin(schema.user, eq(schema.systemLogs.userId, schema.user.id))
        .leftJoin(schema.companies, eq(schema.systemLogs.companyId, schema.companies.id))
        .orderBy(sql`${schema.systemLogs.createdAt} DESC`)
        .limit(50);

      return results;
    } catch (error: any) {
      console.error("[MASTER_ADMIN_LOGS_ERROR]:", error);
      const code = (error as any)?.code;
      const message = String(error?.message || "");

      if (code === "42P01" || message.toLowerCase().includes("system_logs")) {
        return [];
      }

      throw new Error("Erro ao buscar logs: " + message);
    }
  })
  .post("/health/ensure-test-company", async ({ user, set }) => {
    try {
      const currentUserId = (user as any)?.id;

      if (!currentUserId) {
        set.status = 401;
        return { error: "Usuário não autenticado." };
      }

      const [currentUser] = await db
        .select()
        .from(schema.user)
        .where(eq(schema.user.id, currentUserId))
        .limit(1);

      if (!currentUser) {
        set.status = 404;
        return { error: "Usuário não encontrado." };
      }

      const now = new Date();

      let [healthCompany] = await db
        .select()
        .from(schema.companies)
        .where(eq(schema.companies.slug, HEALTH_CHECK_COMPANY_SLUG))
        .limit(1);

      if (!healthCompany) {
        [healthCompany] = await db
          .insert(schema.companies)
          .values({
            id: crypto.randomUUID(),
            name: HEALTH_CHECK_COMPANY_NAME,
            slug: HEALTH_CHECK_COMPANY_SLUG,
            ownerId: currentUserId,
            active: true,
            subscriptionStatus: "active",
            accessType: "manual",
            trialEndsAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
            createdAt: now,
            updatedAt: now
          })
          .returning();
      } else if (healthCompany.ownerId !== currentUserId) {
        const [updatedCompany] = await db
          .update(schema.companies)
          .set({
            ownerId: currentUserId,
            active: true,
            subscriptionStatus: "active",
            accessType: "manual",
            updatedAt: now
          })
          .where(eq(schema.companies.id, healthCompany.id))
          .returning();

        if (updatedCompany) {
          healthCompany = updatedCompany;
        }
      }

      if (!healthCompany) {
        set.status = 500;
        return { error: "Não foi possível preparar a empresa de teste." };
      }

      await db.delete(schema.operatingHours).where(eq(schema.operatingHours.companyId, healthCompany.id));

      const operatingHoursPayload = Array.from({ length: 7 }).map((_, dayIndex) => ({
        id: crypto.randomUUID(),
        companyId: healthCompany.id,
        dayOfWeek: String(dayIndex),
        status: "OPEN",
        morningStart: "09:00",
        morningEnd: "12:00",
        afternoonStart: "13:00",
        afternoonEnd: "18:00",
        createdAt: now,
        updatedAt: now
      }));

      await db.insert(schema.operatingHours).values(operatingHoursPayload);

      await db
        .delete(schema.appointments)
        .where(
          and(
            eq(schema.appointments.companyId, healthCompany.id),
            eq(schema.appointments.customerEmail, HEALTH_CHECK_CUSTOMER_EMAIL)
          )
        );

      let [healthService] = await db
        .select()
        .from(schema.services)
        .where(
          and(
            eq(schema.services.companyId, healthCompany.id),
            eq(schema.services.name, HEALTH_CHECK_SERVICE_NAME)
          )
        )
        .limit(1);

      if (!healthService) {
        [healthService] = await db
          .insert(schema.services)
          .values({
            id: crypto.randomUUID(),
            companyId: healthCompany.id,
            name: HEALTH_CHECK_SERVICE_NAME,
            description: "Serviço usado para diagnóstico automático de rotas.",
            price: "1.00",
            duration: "00:30",
            isVisible: false,
            showOnHome: false,
            createdAt: now,
            updatedAt: now
          })
          .returning();
      }

      if (!healthService) {
        set.status = 500;
        return { error: "Não foi possível preparar o serviço de diagnóstico." };
      }

      await writeSystemLog({
        userId: currentUserId,
        action: "HEALTH_TEST_READY",
        details: "Empresa de teste preparada para diagnóstico de rotas.",
        level: "INFO",
        companyId: healthCompany.id
      });

      return {
        success: true,
        companyId: healthCompany.id,
        companyName: healthCompany.name,
        companySlug: healthCompany.slug,
        serviceId: healthService.id,
        serviceName: healthService.name,
        servicePrice: String(healthService.price),
        serviceDuration: healthService.duration,
        testCustomerName: "Health Check Bot",
        testCustomerEmail: HEALTH_CHECK_CUSTOMER_EMAIL,
        testCustomerPhone: "11999999999"
      };
    } catch (error: any) {
      console.error("[MASTER_ADMIN_HEALTH_SETUP_ERROR]:", error);
      set.status = 500;
      return { error: "Erro ao preparar ambiente de teste: " + error.message };
    }
  })
  // --- NOVAS ROTAS DE PROSPECTS (POSSÍVEIS CLIENTES) ---
  .get("/prospects", async () => {
    try {
      return await db.select().from(schema.prospects).orderBy(sql`${schema.prospects.createdAt} DESC`);
    } catch (error: any) {
      console.error("[MASTER_ADMIN_PROSPECTS_LIST_ERROR]:", error);
      throw new Error("Erro ao listar possíveis clientes: " + error.message);
    }
  })
  .post("/prospects", async ({ body, set }) => {
    try {
      // Mapeamento de status de Português para o Enum do Banco
      const statusMap: Record<string, string> = {
        "Não Contatado": "NOT_CONTACTED",
        "Contatado": "CONTACTED",
        "Em Negociação": "IN_NEGOTIATION",
        "Convertido": "CONVERTED",
        "Recusado": "REJECTED"
      };

      const status = body.status && statusMap[body.status] ? statusMap[body.status] : (body.status || "NOT_CONTACTED");

      const [newProspect] = await db.insert(schema.prospects).values({
        id: crypto.randomUUID(),
        name: body.name,
        phone: body.phone,
        establishmentName: body.establishmentName,
        instagramLink: body.instagramLink,
        category: body.category,
        location: body.location,
        address: body.address,
        mapsLink: body.mapsLink,
        status: status as any,
        notes: body.notes,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();

      return newProspect;
    } catch (error: any) {
      console.error("[MASTER_ADMIN_PROSPECT_CREATE_ERROR]:", error);
      set.status = 500;
      return { error: "Erro ao criar possível cliente: " + error.message };
    }
  }, {
    body: t.Object({
      name: t.String(),
      phone: t.String(),
      establishmentName: t.String(),
      instagramLink: t.Optional(t.String()),
      category: t.String(),
      location: t.Optional(t.String()),
      address: t.Optional(t.String()),
      mapsLink: t.Optional(t.String()),
      status: t.Optional(t.String()),
      notes: t.Optional(t.String())
    })
  })
  .post("/prospects/bulk", async ({ body, set }) => {
    try {
      const prospectsToInsert = body.map((p: any) => {
        // Mapeamento de status para cada item
        const statusMap: Record<string, string> = {
          "Não Contatado": "NOT_CONTACTED",
          "Contatado": "CONTACTED",
          "Em Negociação": "IN_NEGOTIATION",
          "Convertido": "CONVERTED",
          "Recusado": "REJECTED"
        };
        const status = p.status && statusMap[p.status] ? statusMap[p.status] : (p.status || "NOT_CONTACTED");

        return {
          id: crypto.randomUUID(),
          name: p.name,
          phone: p.phone,
          establishmentName: p.establishmentName || p.name,
          instagramLink: p.instagramLink,
          category: p.category,
          location: p.location,
          address: p.address,
          mapsLink: p.mapsLink,
          status: status as any,
          notes: p.notes,
          createdAt: new Date(),
          updatedAt: new Date()
        };
      });

      const inserted = await db.insert(schema.prospects).values(prospectsToInsert).returning();
      return { success: true, count: inserted.length };
    } catch (error: any) {
      console.error("[MASTER_ADMIN_PROSPECT_BULK_ERROR]:", error);
      set.status = 500;
      return { error: "Erro ao importar clientes em massa: " + error.message };
    }
  }, {
    body: t.Array(t.Object({
      name: t.String(),
      phone: t.String(),
      establishmentName: t.Optional(t.String()),
      instagramLink: t.Optional(t.String()),
      category: t.String(),
      location: t.Optional(t.String()),
      address: t.Optional(t.String()),
      mapsLink: t.Optional(t.String()),
      status: t.Optional(t.String()),
      notes: t.Optional(t.String())
    }))
  })
  .post("/prospects/parse-import", async ({ body }) => {
    // Rota auxiliar para transformar o formato bruto da planilha (ex: Google Maps)
    // para o formato que o nosso sistema entende, para o front mostrar o preview.
    try {
      const rawData = body as any[];

      const parsed = rawData.map(row => {
        // Mapeamento baseado no exemplo fornecido pelo usuário
        // qBF1Pd -> Nome/Estabelecimento
        // W4Efsd -> Categoria
        // W4Efsd 2 -> Endereço
        // telefone -> Telefone
        // hfpxzc href -> Link do Maps

        return {
          name: row["qBF1Pd"] || row["Nome"] || "Sem Nome",
          establishmentName: row["qBF1Pd"] || row["Estabelecimento"] || row["Nome"] || "Sem Nome",
          category: row["W4Efsd"] || row["Categoria"] || "Sem Categoria",
          address: row["W4Efsd 2"] || row["Endereço"] || row["Address"] || "",
          location: row["UY7F9"] || row["Localização"] || "", // Tentativa de pegar localização de outro campo
          phone: row["telefone"] || row["Telefone"] || row["WhatsApp"] || "",
          mapsLink: row["hfpxzc href"] || row["Maps Link"] || "",
          instagramLink: row["Instagram"] || row["instagram"] || "", // Campo que o usuário disse que vai adicionar
          status: "Não Contatado",
          notes: ""
        };
      });

      return parsed;
    } catch (error: any) {
      throw new Error("Erro ao processar dados da planilha: " + error.message);
    }
  })
  .patch("/prospects/:id", async ({ params, body, set }) => {
    try {
      const { id } = params;

      // Mapeamento de status de Português para o Enum do Banco
      const statusMap: Record<string, string> = {
        "Não Contatado": "NOT_CONTACTED",
        "Contatado": "CONTACTED",
        "Em Negociação": "IN_NEGOTIATION",
        "Convertido": "CONVERTED",
        "Recusado": "REJECTED"
      };

      const updateData: any = {
        ...body,
        updatedAt: new Date()
      };

      if (body.status && statusMap[body.status]) {
        updateData.status = statusMap[body.status];
      }

      const [updated] = await db.update(schema.prospects)
        .set(updateData)
        .where(eq(schema.prospects.id, id))
        .returning();

      if (!updated) {
        set.status = 404;
        return { error: "Possível cliente não encontrado" };
      }

      return updated;
    } catch (error: any) {
      console.error("[MASTER_ADMIN_PROSPECT_UPDATE_ERROR]:", error);
      set.status = 500;
      return { error: "Erro ao atualizar possível cliente: " + error.message };
    }
  }, {
    body: t.Object({
      name: t.Optional(t.String()),
      phone: t.Optional(t.String()),
      establishmentName: t.Optional(t.String()),
      instagramLink: t.Optional(t.String()),
      category: t.Optional(t.String()),
      location: t.Optional(t.String()),
      address: t.Optional(t.String()),
      mapsLink: t.Optional(t.String()),
      status: t.Optional(t.String()),
      notes: t.Optional(t.String())
    })
  })
  .delete("/prospects/:id", async ({ params, set }) => {
    try {
      const { id } = params;
      const [deleted] = await db.delete(schema.prospects)
        .where(eq(schema.prospects.id, id))
        .returning();

      if (!deleted) {
        set.status = 404;
        return { error: "Possível cliente não encontrado" };
      }

      return { success: true, message: "Possível cliente removido" };
    } catch (error: any) {
      console.error("[MASTER_ADMIN_PROSPECT_DELETE_ERROR]:", error);
      set.status = 500;
      return { error: "Erro ao remover possível cliente: " + error.message };
    }
  })
  // --- NOVAS ROTAS DE RELATÓRIOS DO MASTER ADMIN ---
  .get("/reports/growth", async () => {
    try {
      // Relatório de crescimento de usuários e empresas por mês
      const companyGrowth = await db.execute(sql`
        SELECT 
          TO_CHAR(created_at, 'YYYY-MM') as month,
          COUNT(*)::int as count
        FROM companies
        GROUP BY month
        ORDER BY month DESC
        LIMIT 12
      `);

      const userGrowth = await db.execute(sql`
        SELECT 
          TO_CHAR(created_at, 'YYYY-MM') as month,
          COUNT(*)::int as count
        FROM "user"
        GROUP BY month
        ORDER BY month DESC
        LIMIT 12
      `);

      // Convertendo para array puro e garantindo que count seja número
      return {
        companies: Array.from(companyGrowth).map((row: any) => ({ ...row, count: Number(row.count) })),
        users: Array.from(userGrowth).map((row: any) => ({ ...row, count: Number(row.count) }))
      };
    } catch (error: any) {
      console.error("[MASTER_ADMIN_REPORT_GROWTH_ERROR]:", error);
      throw new Error("Erro ao gerar relatório de crescimento: " + error.message);
    }
  })
  .get("/reports/subscriptions", async () => {
    try {
      // Relatório de status de assinaturas
      const stats = await db.execute(sql`
        SELECT 
          subscription_status as status,
          access_type as type,
          COUNT(*)::int as count
        FROM companies
        GROUP BY subscription_status, access_type
      `);

      return Array.from(stats).map((row: any) => ({ ...row, count: Number(row.count) }));
    } catch (error: any) {
      console.error("[MASTER_ADMIN_REPORT_SUBSCRIPTIONS_ERROR]:", error);
      throw new Error("Erro ao gerar relatório de assinaturas: " + error.message);
    }
  })
  .get("/reports/dashboard-stats", async () => {
    try {
      // 1. Total de Estúdios (Empresas)
      const [totalCompanies] = await db.execute(sql`SELECT COUNT(*)::int as count FROM companies`);

      // 2. Assinaturas Ativas (Status active ou trialing)
      const [activeSubscriptions] = await db.execute(sql`
        SELECT COUNT(*)::int as count 
        FROM companies 
        WHERE subscription_status IN ('active', 'trialing', 'trial')
      `);

      // 3. Faturamento Mensal Estimado usando preço dinâmico
      const [pricingSetting] = await db
        .select()
        .from(schema.systemSettings)
        .where(eq(schema.systemSettings.key, "monthly_price"))
        .limit(1);

      const currentPrice = pricingSetting ? parseFloat(pricingSetting.value) : 49.90;

      const [revenue] = await db.execute(sql`
        SELECT COALESCE(SUM(plan_price), 0)::float as total
        FROM (
          SELECT 
            CASE 
              WHEN access_type = 'premium' THEN 97.00
              WHEN access_type = 'pro' THEN 197.00
              WHEN access_type = 'automatic' THEN ${sql.raw(currentPrice.toString())}
              ELSE 0 
            END as plan_price
          FROM companies
          WHERE subscription_status IN ('active', 'trialing', 'trial')
        ) as prices
      `);

      // 4. Volume Global de Agendamentos
      const [totalAppointments] = await db.execute(sql`SELECT COUNT(*)::int as count FROM appointments`);

      // Garantir que todos os valores sejam números, pois o driver pode retornar como string
      const stats = {
        totalCompanies: Number(totalCompanies?.count || 0),
        activeSubscriptions: Number(activeSubscriptions?.count || 0),
        monthlyRevenue: Number(revenue?.total || 0),
        totalAppointments: Number(totalAppointments?.count || 0),
        // Adicionando campos extras caso o front use nomes diferentes
        revenue: Number(revenue?.total || 0),
        appointments: Number(totalAppointments?.count || 0),
        companies: Number(totalCompanies?.count || 0),
        currentPricing: currentPrice
      };

      return stats;
    } catch (error: any) {
      console.error("[MASTER_ADMIN_REPORT_STATS_ERROR]:", error);
      throw new Error("Erro ao gerar estatísticas do dashboard: " + error.message);
    }
  })
  .get("/settings/pricing", async () => {
    try {
      const [setting] = await db
        .select()
        .from(schema.systemSettings)
        .where(eq(schema.systemSettings.key, "monthly_price"))
        .limit(1);

      return {
        price: setting ? parseFloat(setting.value) : 49.90,
        updatedAt: setting?.updatedAt || new Date()
      };
    } catch (error: any) {
      throw new Error("Erro ao buscar preço: " + error.message);
    }
  })
  .post("/settings/pricing", async ({ body, set }) => {
    try {
      const { price } = body;

      const [updated] = await db
        .insert(schema.systemSettings)
        .values({
          id: crypto.randomUUID(),
          key: "monthly_price",
          value: price.toString(),
          description: "Preço da mensalidade do Plano Pro",
          updatedAt: new Date()
        })
        .onConflictDoUpdate({
          target: schema.systemSettings.key,
          set: {
            value: price.toString(),
            updatedAt: new Date()
          }
        })
        .returning();

      return {
        success: true,
        price: parseFloat(updated.value),
        message: "Preço da mensalidade atualizado com sucesso"
      };
    } catch (error: any) {
      set.status = 500;
      return { error: "Erro ao atualizar preço: " + error.message };
    }
  }, {
    body: t.Object({
      price: t.Number()
    })
  })
  // Alias para compatibilidade
  .get("/reports/financial", async ({ set }) => {
    try {
      // Busca o preço dinâmico para o cálculo do faturamento
      const [pricingSetting] = await db
        .select()
        .from(schema.systemSettings)
        .where(eq(schema.systemSettings.key, "monthly_price"))
        .limit(1);

      const currentPrice = pricingSetting ? parseFloat(pricingSetting.value) : 49.90;

      const [monthlyRevenue] = await db.execute(sql`
        SELECT COALESCE(SUM(plan_price), 0)::float as total
        FROM (
          SELECT 
            CASE 
              WHEN access_type = 'premium' THEN 97.00
              WHEN access_type = 'pro' THEN 197.00
              WHEN access_type = 'automatic' THEN ${sql.raw(currentPrice.toString())}
              ELSE 0 
            END as plan_price
          FROM companies
          WHERE subscription_status IN ('active', 'trialing', 'trial')
        ) as prices
      `);

      const revenueValue = Number(monthlyRevenue?.total || 0);
      return {
        totalRevenue: revenueValue,
        monthlyRevenue: revenueValue,
        revenue: revenueValue // Mais uma variação
      };
    } catch (error: any) {
      set.status = 500;
      return { error: error.message };
    }
  })
  .patch("/users/:id/email", async ({ params, body, set }) => {
    try {
      const { id } = params;
      const { email } = body;

      // 1. Atualiza email na tabela de usuários
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

      // 2. Atualiza o e-mail/accountId na tabela accounts
      // No Better Auth, para o provider 'credential', o accountId é o próprio e-mail.
      // Se não atualizarmos aqui, o usuário não conseguirá logar com o novo e-mail.
      await db
        .update(schema.account)
        .set({
          accountId: email,
          updatedAt: new Date()
        })
        .where(
          sql`${schema.account.userId} = ${id} AND ${schema.account.providerId} = 'credential'`
        );

      return {
        success: true,
        message: `Email do usuário ${updated.name} alterado para ${email} em todas as tabelas.`
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

      // Gera hash da senha usando Bun (Argon2id/Bcrypt)
      const hashedPassword = await Bun.password.hash(defaultPassword);

      // Atualiza a senha na tabela account
      const [updatedAccount] = await db
        .update(schema.account)
        .set({
          password: hashedPassword,
          updatedAt: new Date()
        })
        .where(
          sql`${schema.account.userId} = ${id} AND ${schema.account.providerId} = 'credential'`
        )
        .returning();

      if (!updatedAccount) {
        set.status = 404;
        return { error: "Usuário não possui conta de email/senha vinculada." };
      }

      return {
        success: true,
        message: `Senha de ${updatedAccount.userId} resetada para Mudar@123 com sucesso.`
      };
    } catch (error: any) {
      console.error("[MASTER_ADMIN_RESET_PASSWORD_ERROR]:", error);
      set.status = 500;
      return { error: "Erro ao resetar senha: " + error.message };
    }
  })
  .get("/financial-details", async ({ query, set }) => {
    try {
      const { email } = query;
      if (!email) {
        set.status = 400;
        return { error: "Email é obrigatório" };
      }

      // Busca a empresa vinculada ao email (dono)
      const [company] = await db
        .select({
          id: schema.companies.id,
          subscriptionStatus: schema.companies.subscriptionStatus,
          trialEndsAt: schema.companies.trialEndsAt,
          createdAt: schema.companies.createdAt,
        })
        .from(schema.companies)
        .innerJoin(schema.user, eq(schema.companies.ownerId, schema.user.id))
        .where(eq(schema.user.email, email))
        .limit(1);

      if (!company) {
        return {
          status: "Não identificado",
          nextInvoiceDate: null,
          lastPaymentDate: null,
          history: []
        };
      }

      // Por enquanto, como não temos integração total de histórico com Asaas implementada no AsaasClient,
      // retornamos um mock estruturado que o front espera baseado no status do banco.

      const statusMap: Record<string, string> = {
        active: "Ativo",
        trialing: "Teste",
        trial: "Teste",
        past_due: "Vencido",
        deleted: "Cancelado"
      };

      // Cálculo simples da próxima fatura (mensal)
      const nextInvoice = new Date(company.createdAt);
      const now = new Date();

      // Se estiver em trial, a primeira fatura é após o trial
      if ((company.subscriptionStatus === 'trial' || company.subscriptionStatus === 'trialing') && company.trialEndsAt) {
        nextInvoice.setTime(company.trialEndsAt.getTime());
      } else {
        while (nextInvoice < now) {
          nextInvoice.setMonth(nextInvoice.getMonth() + 1);
        }
      }

      return {
        status: statusMap[company.subscriptionStatus] || "Não identificado",
        nextInvoiceDate: (company.subscriptionStatus === 'active' || company.subscriptionStatus === 'trial' || company.subscriptionStatus === 'trialing') ? nextInvoice.toISOString() : null,
        lastPaymentDate: company.createdAt.toISOString(), // Simplificação
        history: [] // Histórico real exigiria busca no Asaas via API
      };
    } catch (error: any) {
      console.error("[MASTER_ADMIN_FINANCIAL_DETAILS_ERROR]:", error);
      set.status = 500;
      return { error: "Erro ao buscar detalhes financeiros: " + error.message };
    }
  }, {
    query: t.Object({
      email: t.String()
    })
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
          subscriptionStatus: company.subscriptionStatus,
          trialEndsAt: company.trialEndsAt,
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
          ownerId: schema.companies.ownerId,
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
