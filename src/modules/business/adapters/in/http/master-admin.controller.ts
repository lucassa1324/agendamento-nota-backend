import { Elysia, t } from "elysia";
import { authPlugin } from "../../../../infrastructure/auth/auth-plugin";
import { auth } from "../../../../infrastructure/auth/auth";
import { db } from "../../../../infrastructure/drizzle/database";
import * as schema from "../../../../../db/schema";
import { eq, sql, count } from "drizzle-orm";

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

      const [revenue] = await db.execute(sql`
        SELECT COALESCE(SUM(plan_price), 0)::float as total
        FROM (
          SELECT 
            CASE 
              WHEN access_type = 'premium' THEN 97.00
              WHEN access_type = 'pro' THEN 197.00
              WHEN access_type = 'automatic' THEN 47.00
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

        } else if (actionType === 'automatic') {
          // Reset Automático: SEMPRE revoga acesso manual/extendido e bloqueia se não houver pagamento.
          // Independente da idade da empresa, ao voltar para automático, o trial é zerado.
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 1);

          updateData.subscriptionStatus = 'past_due';
          updateData.trialEndsAt = yesterday;
          updateData.accessType = 'automatic';
          console.log(`[MASTER_ADMIN] Reset Automático: Trial zerado e acesso bloqueado (sem pagamento).`);
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

      return {
        success: true,
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

      // 3. Faturamento Mensal Estimado
      const [monthlyRevenue] = await db.execute(sql`
        SELECT COALESCE(SUM(plan_price), 0)::float as total
        FROM (
          SELECT 
            CASE 
              WHEN access_type = 'premium' THEN 97.00
              WHEN access_type = 'pro' THEN 197.00
              WHEN access_type = 'automatic' THEN 47.00
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
        monthlyRevenue: Number(monthlyRevenue?.total || 0),
        totalAppointments: Number(totalAppointments?.count || 0),
        // Adicionando campos extras caso o front use nomes diferentes
        revenue: Number(monthlyRevenue?.total || 0),
        appointments: Number(totalAppointments?.count || 0),
        companies: Number(totalCompanies?.count || 0)
      };

      return stats;
    } catch (error: any) {
      console.error("[MASTER_ADMIN_REPORT_STATS_ERROR]:", error);
      throw new Error("Erro ao gerar estatísticas do dashboard: " + error.message);
    }
  })
  // Alias para compatibilidade
  .get("/reports/financial", async ({ set }) => {
    try {
      const [monthlyRevenue] = await db.execute(sql`
        SELECT COALESCE(SUM(plan_price), 0)::float as total
        FROM (
          SELECT 
            CASE 
              WHEN access_type = 'premium' THEN 97.00
              WHEN access_type = 'pro' THEN 197.00
              WHEN access_type = 'automatic' THEN 47.00
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
