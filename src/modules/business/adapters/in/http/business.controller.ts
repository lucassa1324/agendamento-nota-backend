import { Elysia, t } from "elysia";
import { authPlugin } from "../../../../infrastructure/auth/auth-plugin";
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
      .get("/slug/:slug", async ({ params: { slug }, set, businessRepository, settingsRepository, userRepository }) => {
        // Normalização de entrada para evitar erros de case/espaços
        const normalizedSlug = slug.trim().toLowerCase();

        console.log(`[BUSINESS_CONTROLLER] Buscando dados para o slug (RAW): '${slug}'`);
        console.log(`[BUSINESS_CONTROLLER] Buscando dados para o slug (NORMALIZED): '${normalizedSlug}'`);

        // Forçar o navegador a não usar cache para garantir que as cores novas apareçam
        set.headers["Cache-Control"] = "no-store, max-age=0, must-revalidate";
        set.headers["Pragma"] = "no-cache";
        set.headers["Expires"] = "0";

        // Busca usando o slug normalizado
        const business = await businessRepository.findBySlug(normalizedSlug);

        if (!business) {
          console.error(`[BUSINESS_CONTROLLER] ❌ ERRO 404: Empresa não encontrada para o slug: '${normalizedSlug}'`);
          set.status = 404;
          return {
            error: "Business not found",
            message: `Nenhum estúdio encontrado com o endereço '${normalizedSlug}'. Verifique se o link está correto.`
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

        // 2. Resolução de Telefone (Prioridade: Perfil > Cadastro da Empresa)
        const publicPhone = profile?.phone || business.contact || null;

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
  );
