import { Elysia, t } from "elysia";
import { authPlugin, syncAsaasPaymentForCompany } from "../../../../infrastructure/auth/auth-plugin";
import { repositoriesPlugin } from "../../../../infrastructure/di/repositories.plugin";
import { ListMyBusinessesUseCase } from "../../../application/use-cases/list-my-businesses.use-case";
import { CreateBusinessUseCase } from "../../../application/use-cases/create-business.use-case";
import { UpdateBusinessConfigUseCase } from "../../../application/use-cases/update-business-config.use-case";
import { createBusinessDTO, updateBusinessConfigDTO } from "../dtos/business.dto";
import { updateOperatingHoursDTO, createAgendaBlockDTO } from "../dtos/business.settings.dto";
import { UpdateOperatingHoursUseCase } from "../../../application/use-cases/update-operating-hours.use-case";
import { GetOperatingHoursUseCase } from "../../../application/use-cases/get-operating-hours.use-case";
import { CreateAgendaBlockUseCase } from "../../../application/use-cases/create-agenda-block.use-case";
import { ListAgendaBlocksUseCase } from "../../../application/use-cases/list-agenda-blocks.use-case";
import { DeleteAgendaBlockUseCase } from "../../../application/use-cases/delete-agenda-block.use-case";
import { db } from "../../../../infrastructure/drizzle/database";
import * as schema from "../../../../../db/schema";
import { eq } from "drizzle-orm";

const BILLING_DAY_CHANGE_LOCK_MONTHS = 3;

const daysInMonth = (year: number, monthIndex: number) =>
  new Date(year, monthIndex + 1, 0).getDate();

const clampBillingAnchorDay = (anchorDay: number) =>
  Math.min(Math.max(anchorDay, 1), 31);

const buildDateByAnchor = (year: number, monthIndex: number, anchorDay: number) => {
  const maxDay = daysInMonth(year, monthIndex);
  const day = Math.min(clampBillingAnchorDay(anchorDay), maxDay);
  return new Date(year, monthIndex, day);
};

const calculateNextDueDate = (referenceDate: Date, anchorDay: number) => {
  let due = buildDateByAnchor(referenceDate.getFullYear(), referenceDate.getMonth(), anchorDay);
  if (referenceDate.getTime() >= due.getTime()) {
    due = buildDateByAnchor(referenceDate.getFullYear(), referenceDate.getMonth() + 1, anchorDay);
  }
  return due;
};

export const businessController = () => new Elysia({ prefix: "/business" })
  .use(repositoriesPlugin)
  .use(authPlugin)
  .onError(({ code, error, set }) => {
    const message = (error as any)?.message ?? String(error);
    const detail = (error as any)?.errors ?? (error as any)?.cause ?? null;
    console.error("BUSINESS_CONTROLLER_VALIDATION_ERROR", code, message, detail);
    if (code === "VALIDATION") {
      set.status = 422;
      return {
        error: "ValidationError",
        message,
        detail
      };
    }
  })
  // Rotas Públicas (Sem necessidade de Token)
  .group("", (publicGroup) =>
    publicGroup
      .get("/settings/pricing", async ({ set }) => {
        try {
          const [setting] = await db
            .select()
            .from(schema.systemSettings)
            .where(eq(schema.systemSettings.key, "monthly_price"))
            .limit(1);

          // Forçar o navegador a não usar cache para garantir que o preço atualizado apareça
          set.headers["Cache-Control"] = "no-store, max-age=0, must-revalidate";
          set.headers["Pragma"] = "no-cache";
          set.headers["Expires"] = "0";

          return {
            price: setting ? parseFloat(setting.value) : 49.90,
            updatedAt: setting?.updatedAt || new Date()
          };
        } catch (error: any) {
          return {
            price: 49.90,
            error: "Erro ao buscar preço: " + error.message
          };
        }
      })
      .get("/debug-slug/:slug", async ({ params: { slug }, businessRepository }) => {
        const normalizedSlug = decodeURIComponent(slug).trim().toLowerCase();
        console.log(`[DEBUG_SLUG] Buscando: '${normalizedSlug}'`);
        const business = await businessRepository.findBySlug(normalizedSlug);
        return {
          original: slug,
          decoded: decodeURIComponent(slug),
          normalized: normalizedSlug,
          found: !!business,
          data: business ? { id: business.id, name: business.name, slug: business.slug } : null
        };
      })
      .get("/slug/:slug", async ({ params: { slug }, set, businessRepository, settingsRepository, userRepository, user }) => {
        // Normalização de entrada para evitar erros de case/espaços e caracteres especiais
        const normalizedSlug = decodeURIComponent(slug).trim().toLowerCase();

        console.log(`[BUSINESS_CONTROLLER] Buscando dados para o slug (RAW): '${slug}'`);
        console.log(`[BUSINESS_CONTROLLER] Buscando dados para o slug (DECODED): '${decodeURIComponent(slug)}'`);
        console.log(`[BUSINESS_CONTROLLER] Buscando dados para o slug (NORMALIZED): '${normalizedSlug}'`);

        // Forçar o navegador a não usar cache para garantir que as cores novas apareçam
        set.headers["Cache-Control"] = "no-store, max-age=0, must-revalidate";
        set.headers["Pragma"] = "no-cache";
        set.headers["Expires"] = "0";

        // Busca usando o slug normalizado
        let business = await businessRepository.findBySlug(normalizedSlug);

        // Fallback: Se não encontrou pelo slug exato, tenta buscar por parte do slug ou sem hifens
        if (!business && normalizedSlug.includes("-")) {
          const simpleSlug = normalizedSlug.replace(/-/g, "");
          console.log(`[BUSINESS_CONTROLLER] Fallback: Tentando slug simplificado: '${simpleSlug}'`);
          business = await businessRepository.findBySlug(simpleSlug);
        }

        if (!business) {
          console.error(`[BUSINESS_CONTROLLER] ❌ ERRO 404: Empresa não encontrada para o slug: '${normalizedSlug}'`);
          set.status = 404;
          return {
            error: "Business not found",
            message: `Nenhum estúdio encontrado com o endereço '${normalizedSlug}'. Verifique se o link está correto.`
          };
        }

        const isBlockedStatus =
          business.subscriptionStatus === "past_due" ||
          business.subscriptionStatus === "canceled";

        if ((business.active === false || isBlockedStatus) && (!user || (user.id !== business.ownerId && user.role !== "SUPER_ADMIN"))) {
          set.status = 403;
          return {
            error: "Business suspended",
            message: "Este site está temporariamente indisponível."
          };
        }

        console.log(`[BUSINESS_CONTROLLER] ✅ SUCESSO: Dados encontrados para: ${business.name} (ID: ${business.id})`);

        // --- ENRIQUECIMENTO DE DADOS DE CONTATO (REQ-FIX-CONTACT-NULL) ---
        // Busca o perfil para tentar obter e-mail e telefone configurados
        const profile = await settingsRepository.findByBusinessId(business.id);

        // 1. Resolução de E-mail (Prioridade: Perfil > Dono da Conta)
        let publicEmail = profile?.email || null;

        if (!publicEmail && business.ownerId) {
          // Fallback: Busca e-mail do dono da conta
          try {
            const owner = await userRepository.find(business.ownerId);
            if (owner) {
              publicEmail = owner.email;
            }
          } catch (err) {
            console.error(`[BUSINESS_CONTROLLER] Erro ao buscar owner para fallback de email:`, err);
          }
        }

        // 2. Resolução de Telefone (Prioridade: Perfil > Cadastro da Empresa - phone > Cadastro da Empresa - contact)
        const publicPhone = profile?.phone || business.phone || business.contact || null;

        const customization = business.siteCustomization as any;
        const primaryColor = customization?.layoutGlobal?.siteColors?.primary ||
          customization?.layoutGlobal?.base_colors?.primary ||
          'Padrão';

        console.log(`[BUSINESS_CONTROLLER] Cor Primária no Banco:`, primaryColor);
        console.log(`[BUSINESS_CONTROLLER] Contato resolvido - Email: ${publicEmail}, Phone: ${publicPhone}`);

        // Retorna objeto com estrutura garantida para o Front-end
        return {
          ...business,
          email: publicEmail, // Email na raiz conforme solicitado
          contact: {          // Objeto contact populado
            email: publicEmail,
            phone: publicPhone
          }
        };
      }, {
        params: t.Object({
          slug: t.String()
        })
      })
      .get("/settings/:companyId", async ({ params: { companyId }, businessRepository, set }) => {
        try {
          console.log(`>>> [BACK_PUBLIC_ACCESS] Buscando horários para a empresa: ${companyId}`);
          const useCase = new GetOperatingHoursUseCase(businessRepository);
          const result = await useCase.execute(companyId);

          if (result) {
            console.log(`>>> [PUBLIC_API_SEND] Enviando intervalo para o site: ${result.interval}`);
          }

          return result;
        } catch (error: any) {
          set.status = 404;
          return { error: error.message };
        }
      }, {
        params: t.Object({ companyId: t.String() })
      })
      .get("/settings/:companyId/", async ({ params: { companyId }, businessRepository, set }) => {
        try {
          const useCase = new GetOperatingHoursUseCase(businessRepository);
          return await useCase.execute(companyId);
        } catch (error: any) {
          set.status = 404;
          return { error: error.message };
        }
      }, {
        params: t.Object({ companyId: t.String() })
      })
      .get("/settings/:companyId/blocks", async ({ params: { companyId }, businessRepository, set }) => {
        try {
          console.log(`>>> [BACK_PUBLIC_ACCESS] Buscando bloqueios para a empresa: ${companyId}`);
          const useCase = new ListAgendaBlocksUseCase(businessRepository);
          return await useCase.execute(companyId);
        } catch (error: any) {
          set.status = 404;
          return { error: error.message };
        }
      }, {
        params: t.Object({ companyId: t.String() })
      })
  )
  // Rotas Privadas (Exigem Token)
  .group("", (privateGroup) =>
    privateGroup
      .onBeforeHandle(({ user, set }) => {
        if (!user) {
          set.status = 401;
          return { error: "Unauthorized" };
        }
      })
      .get("/my", async ({ user, businessRepository }) => {
        const listMyBusinessesUseCase = new ListMyBusinessesUseCase(businessRepository);
        return await listMyBusinessesUseCase.execute(user!.id);
      })
      .post("/sync", async ({ user, set }) => {
        try {
          const [userCompany] = await db.select()
            .from(schema.companies)
            .where(eq(schema.companies.ownerId, user!.id))
            .limit(1);

          if (!userCompany) {
            set.status = 404;
            return { error: "Company not found" };
          }

          console.log(`[BUSINESS_SYNC] Sincronização manual solicitada pelo usuário ${user!.email} para a empresa ${userCompany.id}`);

          const syncResult = await syncAsaasPaymentForCompany(
            userCompany.id,
            userCompany.ownerId,
            user!.email,
            {
              requireCurrentMonthPayment: true,
              ignoreBlockDate: false
            }
          );

          if (syncResult?.activated) {
            return {
              success: true,
              message: "Pagamento confirmado e acesso liberado!",
              nextDue: syncResult.nextDue
            };
          }

          return {
            success: false,
            message: "Nenhum novo pagamento identificado no Asaas. Se você acabou de pagar, aguarde alguns minutos pela compensação."
          };
        } catch (error: any) {
          console.error("[BUSINESS_SYNC_ERROR]:", error);
          set.status = 500;
          return { error: "Erro ao sincronizar: " + error.message };
        }
      })
      .patch("/billing/day", async ({ user, body, set }) => {
        try {
          const requestedDay = clampBillingAnchorDay(Number(body.day));
          if (!Number.isFinite(requestedDay) || requestedDay < 1 || requestedDay > 31) {
            set.status = 422;
            return { error: "Dia de cobrança inválido. Use um valor entre 1 e 31." };
          }

          const [company] = await db.select()
            .from(schema.companies)
            .where(eq(schema.companies.ownerId, user!.id))
            .limit(1);

          if (!company) {
            set.status = 404;
            return { error: "Empresa não encontrada para este usuário." };
          }

          const now = new Date();
          const lockedUntil = company.billingDayLastChangedAt
            ? new Date(company.billingDayLastChangedAt)
            : null;

          if (lockedUntil && lockedUntil > now) {
            set.status = 409;
            return {
              error: "ALTERACAO_BLOQUEADA",
              message: "Você só pode alterar novamente o dia de cobrança após o período mínimo de 3 meses.",
              nextAllowedChangeAt: lockedUntil.toISOString(),
            };
          }

          const currentAnchor = company.billingAnchorDay || (company.trialEndsAt ? new Date(company.trialEndsAt).getDate() : null);
          if (currentAnchor === requestedDay) {
            const nextDue = calculateNextDueDate(now, requestedDay);
            const nextLock = new Date(now);
            nextLock.setMonth(nextLock.getMonth() + BILLING_DAY_CHANGE_LOCK_MONTHS);
            return {
              success: true,
              billingAnchorDay: requestedDay,
              nextInvoiceDate: nextDue.toISOString(),
              nextAllowedChangeAt: (company.billingDayLastChangedAt || nextLock).toISOString(),
              message: "O dia de cobrança já está configurado com este valor."
            };
          }

          const nextDue = calculateNextDueDate(now, requestedDay);
          const nextAllowedChangeAt = new Date(now);
          nextAllowedChangeAt.setMonth(nextAllowedChangeAt.getMonth() + BILLING_DAY_CHANGE_LOCK_MONTHS);

          const [updated] = await db.update(schema.companies)
            .set({
              billingAnchorDay: requestedDay,
              billingDayLastChangedAt: nextAllowedChangeAt,
              trialEndsAt: nextDue,
              updatedAt: now,
            })
            .where(eq(schema.companies.id, company.id))
            .returning();

          return {
            success: true,
            billingAnchorDay: updated.billingAnchorDay,
            nextInvoiceDate: updated.trialEndsAt?.toISOString?.() || nextDue.toISOString(),
            nextAllowedChangeAt: updated.billingDayLastChangedAt?.toISOString?.() || nextAllowedChangeAt.toISOString(),
            message: `Dia de cobrança alterado para ${requestedDay}. Nova alteração disponível em 3 meses.`
          };
        } catch (error: any) {
          set.status = 500;
          return { error: "Erro ao atualizar dia de cobrança: " + error.message };
        }
      }, {
        body: t.Object({
          day: t.Number(),
        })
      })
      .post("/", async ({ user, body, set, businessRepository }) => {
        try {
          const createBusinessUseCase = new CreateBusinessUseCase(businessRepository);
          return await createBusinessUseCase.execute(user!.id, body);
        } catch (error: any) {
          set.status = 400;
          return { error: error.message };
        }
      }, {
        body: createBusinessDTO
      })
      .patch("/:id/config", async ({ user, params: { id }, body, set, businessRepository }) => {
        try {
          const updateBusinessConfigUseCase = new UpdateBusinessConfigUseCase(businessRepository);
          return await updateBusinessConfigUseCase.execute(id, user!.id, body);
        } catch (error: any) {
          set.status = 400;
          return { error: error.message };
        }
      }, {
        body: updateBusinessConfigDTO,
        params: t.Object({
          id: t.String()
        })
      })
      .patch("/:id/status", async ({ user, params: { id }, body, set, businessRepository }) => {
        try {
          const business = await businessRepository.findById(id);

          if (!business) {
            set.status = 404;
            return { error: "Business not found" };
          }

          if (business.ownerId !== user!.id && user!.role !== "SUPER_ADMIN") {
            set.status = 403;
            return { error: "Unauthorized" };
          }

          const [updated] = await db
            .update(schema.companies)
            .set({
              active: body.active,
              updatedAt: new Date(),
            })
            .where(eq(schema.companies.id, id))
            .returning({
              id: schema.companies.id,
              active: schema.companies.active,
              updatedAt: schema.companies.updatedAt,
            });

          return {
            success: true,
            business: updated,
          };
        } catch (error: any) {
          set.status = 400;
          return { error: error.message };
        }
      }, {
        body: t.Object({
          active: t.Boolean()
        }),
        params: t.Object({
          id: t.String()
        })
      })
      .put("/settings/:companyId", async ({ user, params: { companyId }, body, businessRepository, set }) => {
        try {
          console.log("BUSINESS_SETTINGS_PUT", JSON.stringify(body));
          const interval = (body as any).interval ?? (body as any).slotInterval ?? (body as any).timeInterval;
          if (!interval || !/^\d{2}:\d{2}$/.test(interval)) {
            set.status = 422;
            console.error("BUSINESS_SETTINGS_INTERVAL_INVALID", interval);
            return { error: "Invalid interval format", field: "interval", expected: "HH:mm" };
          }
          if (!Array.isArray(body?.weekly) || body.weekly.length !== 7) {
            set.status = 422;
            console.error("BUSINESS_SETTINGS_WEEKLY_LENGTH_INVALID", Array.isArray(body?.weekly) ? body.weekly.length : null);
            return { error: "Weekly must have 7 days", field: "weekly.length", expected: 7 };
          }
          const useCase = new UpdateOperatingHoursUseCase(businessRepository);
          const normalizedBody = { ...(body as any), interval };
          return await useCase.execute(companyId, user!.id, normalizedBody as any);
        } catch (error: any) {
          set.status = error.message?.includes("Unauthorized") ? 403 : 400;
          return { error: error.message };
        }
      }, {
        body: updateOperatingHoursDTO,
        params: t.Object({ companyId: t.String() })
      })
      .put("/settings/:companyId/", async ({ user, params: { companyId }, body, businessRepository, set }) => {
        try {
          console.log("BUSINESS_SETTINGS_PUT", JSON.stringify(body));
          const interval = (body as any).interval ?? (body as any).slotInterval ?? (body as any).timeInterval;
          if (!interval || !/^\d{2}:\d{2}$/.test(interval)) {
            set.status = 422;
            console.error("BUSINESS_SETTINGS_INTERVAL_INVALID", interval);
            return { error: "Invalid interval format", field: "interval", expected: "HH:mm" };
          }
          if (!Array.isArray(body?.weekly) || body.weekly.length !== 7) {
            set.status = 422;
            console.error("BUSINESS_SETTINGS_WEEKLY_LENGTH_INVALID", Array.isArray(body?.weekly) ? body.weekly.length : null);
            return { error: "Weekly must have 7 days", field: "weekly.length", expected: 7 };
          }
          const useCase = new UpdateOperatingHoursUseCase(businessRepository);
          const normalizedBody = { ...(body as any), interval };
          return await useCase.execute(companyId, user!.id, normalizedBody as any);
        } catch (error: any) {
          set.status = error.message?.includes("Unauthorized") ? 403 : 400;
          return { error: error.message };
        }
      }, {
        body: updateOperatingHoursDTO,
        params: t.Object({ companyId: t.String() })
      })
      .get("/settings/:companyId/blocks/", async ({ user, params: { companyId }, businessRepository, set }) => {
        try {
          const useCase = new ListAgendaBlocksUseCase(businessRepository);
          return await useCase.execute(companyId, user!.id);
        } catch (error: any) {
          set.status = error.message?.includes("Unauthorized") ? 403 : 400;
          return { error: error.message };
        }
      }, {
        params: t.Object({ companyId: t.String() })
      })
      .post("/settings/:companyId/blocks", async ({ user, params: { companyId }, body, businessRepository, set }) => {
        try {
          const useCase = new CreateAgendaBlockUseCase(businessRepository);
          return await useCase.execute(companyId, user!.id, body);
        } catch (error: any) {
          set.status = error.message?.includes("Unauthorized") ? 403 : 400;
          return { error: error.message };
        }
      }, {
        body: createAgendaBlockDTO,
        params: t.Object({ companyId: t.String() })
      })
      .post("/settings/:companyId/blocks/", async ({ user, params: { companyId }, body, businessRepository, set }) => {
        try {
          const useCase = new CreateAgendaBlockUseCase(businessRepository);
          return await useCase.execute(companyId, user!.id, body);
        } catch (error: any) {
          set.status = error.message?.includes("Unauthorized") ? 403 : 400;
          return { error: error.message };
        }
      }, {
        body: createAgendaBlockDTO,
        params: t.Object({ companyId: t.String() })
      })
      .delete("/settings/:companyId/blocks/:blockId", async ({ user, params: { companyId, blockId }, businessRepository, set }) => {
        try {
          const useCase = new DeleteAgendaBlockUseCase(businessRepository);
          return await useCase.execute(companyId, user!.id, blockId);
        } catch (error: any) {
          set.status = error.message?.includes("Unauthorized") ? 403 : 400;
          return { error: error.message };
        }
      }, {
        params: t.Object({
          companyId: t.String(),
          blockId: t.String()
        })
      })
      .delete("/settings/:companyId/blocks/:blockId/", async ({ user, params: { companyId, blockId }, businessRepository, set }) => {
        try {
          const useCase = new DeleteAgendaBlockUseCase(businessRepository);
          return await useCase.execute(companyId, user!.id, blockId);
        } catch (error: any) {
          set.status = error.message?.includes("Unauthorized") ? 403 : 400;
          return { error: error.message };
        }
      }, {
        params: t.Object({
          companyId: t.String(),
          blockId: t.String()
        })
      })
      .get("/:id", async ({ params: { id }, set, businessRepository, settingsRepository, userRepository, user }) => {
        console.log(`[BUSINESS_CONTROLLER] Buscando dados por ID: '${id}'`);

        const business = await businessRepository.findById(id);

        if (!business) {
          console.error(`[BUSINESS_CONTROLLER] ❌ ERRO 404: Empresa não encontrada para o ID: '${id}'`);
          set.status = 404;
          return {
            error: "Business not found",
            message: `Nenhum estúdio encontrado com o ID '${id}'.`
          };
        }

        if (business.active === false && (!user || (user.id !== business.ownerId && user.role !== "SUPER_ADMIN"))) {
          set.status = 403;
          return {
            error: "Business suspended",
            message: "Este site está temporariamente indisponível."
          };
        }

        console.log(`[BUSINESS_CONTROLLER] ✅ SUCESSO: Dados encontrados para: ${business.name} (ID: ${business.id})`);

        // Reutilizando lógica de enriquecimento
        const profile = await settingsRepository.findByBusinessId(business.id);
        let publicEmail = profile?.email || null;
        if (!publicEmail && business.ownerId) {
          try {
            const owner = await userRepository.find(business.ownerId);
            if (owner) publicEmail = owner.email;
          } catch (err) { }
        }
        const publicPhone = profile?.phone || business.phone || business.contact || null;

        return {
          ...business,
          email: publicEmail,
          contact: {
            email: publicEmail,
            phone: publicPhone
          }
        };
      }, {
        params: t.Object({
          id: t.String()
        })
      })
  );
