import { Elysia, t } from "elysia";
import { GetSettingsUseCase } from "../../../application/use-cases/get-settings.use-case";
import { SaveSettingsUseCase } from "../../../application/use-cases/save-settings.use-case";
import { GetSiteCustomizationUseCase } from "../../../application/use-cases/get-site-customization.use-case";
import { UpdateSiteCustomizationUseCase } from "../../../application/use-cases/update-site-customization.use-case";
import { SaveSettingsDTO } from "../dtos/settings.dto";
import { authPlugin } from "../../../../infrastructure/auth/auth-plugin";
import { repositoriesPlugin } from "../../../../infrastructure/di/repositories.plugin";
import { uploadToB2 } from "../../../../infrastructure/storage/b2.storage";

const getExtensionFromMime = (mimeType?: string) => {
  if (!mimeType) return "bin";
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/svg+xml": "svg"
  };
  return map[mimeType] || "bin";
};

export const settingsController = () => new Elysia({ prefix: "/settings" })
  .use(authPlugin)
  .use(repositoriesPlugin)
  // --- ROTAS PÚBLICAS ---
  .get("/customization/:businessId", async ({ params: { businessId }, settingsRepository, set }) => {
    try {
      console.log(`>>> [BACK_PUBLIC_ACCESS] Customização liberada para a empresa: ${businessId}`);

      // Adicionar headers de cache para evitar dados antigos no navegador
      set.headers["Cache-Control"] = "no-store, max-age=0, must-revalidate";
      set.headers["Pragma"] = "no-cache";
      set.headers["Expires"] = "0";

      const getSiteCustomizationUseCase = new GetSiteCustomizationUseCase(settingsRepository);
      const customization = await getSiteCustomizationUseCase.execute(businessId);

      console.log(`>>> [BACK_PUBLIC_ACCESS] Payload de customização enviado. AppointmentFlow presente: ${!!customization.appointmentFlow}`);

      return customization;
    } catch (error: any) {
      console.error("[SETTINGS_GET_CUSTOMIZATION_ERROR]:", error);
      set.status = 500;
      return { error: error.message };
    }
  })
  .get("/profile/:businessId", async ({ params: { businessId }, settingsRepository, businessRepository, userRepository, set }) => {
    try {
      const business = await businessRepository.findById(businessId);
      if (!business) {
        set.status = 404;
        return { error: "Empresa não encontrada" };
      }

      const getSettingsUseCase = new GetSettingsUseCase(settingsRepository);
      const profile = await getSettingsUseCase.execute(businessId);

      // Lógica de Fallback para E-mail:
      // 1. Tenta pegar do perfil do negócio (configuração específica)
      // 2. Se não tiver, tenta pegar do contato da empresa
      // 3. Se não tiver, pega do e-mail do dono da conta (User)
      let publicEmail = profile?.email || (business as any).contact;

      if (!publicEmail && business.ownerId) {
        const owner = await userRepository.find(business.ownerId);
        if (owner) {
          publicEmail = owner.email;
        }
      }

      // Padronização Sênior: Garante tipos booleanos reais e nomes de campos consistentes
      // Além de fallback seguro para campos de contato vindo do cadastro da empresa
      const standardizedProfile = {
        id: profile?.id || null,
        businessId: businessId,
        siteName: profile?.siteName || business.name,
        titleSuffix: profile?.titleSuffix || "",
        description: profile?.description || "",
        logoUrl: profile?.logoUrl || "",

        // Redes Sociais com normalização de visibilidade
        instagram: profile?.instagram || null,
        showInstagram: Boolean(profile?.showInstagram ?? true),
        whatsapp: profile?.whatsapp || null,
        showWhatsapp: Boolean(profile?.showWhatsapp ?? true),
        facebook: profile?.facebook || null,
        showFacebook: Boolean(profile?.showFacebook ?? true),
        tiktok: profile?.tiktok || null,
        showTiktok: Boolean(profile?.showTiktok ?? true),
        linkedin: profile?.linkedin || null,
        showLinkedin: Boolean(profile?.showLinkedin ?? true),
        twitter: profile?.twitter || null,
        showTwitter: Boolean(profile?.showTwitter ?? true),

        // Contato e Endereço
        phone: profile?.phone || (business as any).contact || null,
        email: publicEmail || null,
        address: profile?.address || (business as any).address || null,

        createdAt: profile?.createdAt || null,
        updatedAt: profile?.updatedAt || null
      };

      console.log(`>>> [SETTINGS_PROFILE_RESPONSE] Enviando perfil padronizado para businessId: ${businessId}`);

      return standardizedProfile;
    } catch (error: any) {
      console.error("[SETTINGS_GET_PROFILE_PUBLIC_ERROR]:", error);
      set.status = 500;
      return { error: error.message };
    }
  })
  // --- ROTAS PRIVADAS (EXIGEM AUTH) ---
  .group("", (app) =>
    app.onBeforeHandle(({ user, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Não autorizado" };
      }
    })
      .post("/logo", async ({ body, user, settingsRepository, businessRepository, set }) => {
        try {
          const { file, businessId } = body;
          if (!file || !businessId) {
            set.status = 400;
            return { error: "Arquivo e businessId são obrigatórios" };
          }

          // Validar se o usuário é dono da empresa
          const business = await businessRepository.findById(businessId);
          if (!business || business.ownerId !== user!.id) {
            set.status = 403;
            return { error: "Você não tem permissão para esta empresa." };
          }

          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const extension = getExtensionFromMime(file.type);
          const key = `logos/${businessId}/${crypto.randomUUID()}.${extension}`;

          const logoUrl = await uploadToB2({
            buffer,
            contentType: file.type || "application/octet-stream",
            key,
            cacheControl: "public, max-age=31536000"
          });

          const saveSettingsUseCase = new SaveSettingsUseCase(settingsRepository);
          await saveSettingsUseCase.execute(businessId, { logoUrl });

          console.log(`[SETTINGS_CONTROLLER] Logo salva no banco de dados para businessId: ${businessId}`);

          return {
            success: true,
            logoUrl
          };
        } catch (error: any) {
          console.error("[SETTINGS_LOGO_UPLOAD_ERROR]:", error);
          set.status = 500;
          return { error: error.message };
        }
      }, {
        body: t.Object({
          file: t.Any(),
          businessId: t.String()
        })
      })
      .patch("/profile/:businessId", async ({ params: { businessId }, body, settingsRepository, businessRepository, user, set }) => {
        try {
          // Validar se o usuário é dono da empresa
          const business = await businessRepository.findById(businessId);
          if (!business || business.ownerId !== user!.id) {
            set.status = 403;
            return { error: "Você não tem permissão para alterar as configurações desta empresa." };
          }

          const saveSettingsUseCase = new SaveSettingsUseCase(settingsRepository);
          const updatedProfile = await saveSettingsUseCase.execute(businessId, body);

          return updatedProfile;
        } catch (error: any) {
          console.error("[SETTINGS_PATCH_PROFILE_ERROR]:", error);
          set.status = 500;
          return { error: error.message };
        }
      }, {
        body: SaveSettingsDTO
      })
      .post("/profile/:businessId", async ({ params: { businessId }, body, settingsRepository, businessRepository, user, set }) => {
        try {
          // Validar se o usuário é dono da empresa
          const business = await businessRepository.findById(businessId);
          if (!business || business.ownerId !== user!.id) {
            set.status = 403;
            return { error: "Você não tem permissão para alterar as configurações desta empresa." };
          }

          const saveSettingsUseCase = new SaveSettingsUseCase(settingsRepository);
          const updatedProfile = await saveSettingsUseCase.execute(businessId, body);

          return updatedProfile;
        } catch (error: any) {
          console.error("[SETTINGS_SAVE_PROFILE_ERROR]:", error);
          set.status = 500;
          return { error: error.message };
        }
      }, {
        body: SaveSettingsDTO
      })
      .patch("/customization/:businessId", async ({ params: { businessId }, body, settingsRepository, businessRepository, user, set }) => {
        try {
          console.log('BODY BRUTO RECEBIDO:', JSON.stringify(body, null, 2));
          console.log('COR RECEBIDA DO FRONT:', (body as any).layoutGlobal?.siteColors?.primary || (body as any).layout_global?.site_colors?.primary);

          // Validar se o usuário é dono da empresa
          const business = await businessRepository.findById(businessId);
          if (!business || business.ownerId !== user!.id) {
            set.status = 403;
            return { error: "Você não tem permissão para alterar a personalização desta empresa." };
          }

          const getSiteCustomizationUseCase = new GetSiteCustomizationUseCase(settingsRepository);
          const updateSiteCustomizationUseCase = new UpdateSiteCustomizationUseCase(
            settingsRepository,
            getSiteCustomizationUseCase
          );

          return await updateSiteCustomizationUseCase.execute(businessId, body);
        } catch (error: any) {
          console.error("[SETTINGS_UPDATE_CUSTOMIZATION_ERROR]:", error);
          if (error.all) {
            console.log('ERRO DE VALIDAÇÃO DETALHADO:', JSON.stringify(error.all, null, 2));
          }
          set.status = 500;
          return { error: error.message };
        }
      }, {
        body: t.Any() // Permitir qualquer formato para que o Use Case normalize
      })
  );

export default settingsController;
