import { Elysia, t } from "elysia";
import { GetSettingsUseCase } from "../../../application/use-cases/get-settings.use-case";
import { SaveSettingsUseCase } from "../../../application/use-cases/save-settings.use-case";
import { GetSiteCustomizationUseCase } from "../../../application/use-cases/get-site-customization.use-case";
import { UpdateSiteCustomizationUseCase } from "../../../application/use-cases/update-site-customization.use-case";
import { SaveSettingsDTO } from "../dtos/settings.dto";
import {
  LayoutGlobalDTO,
  HomeSectionDTO,
  GallerySectionDTO,
  AboutUsSectionDTO,
  AppointmentFlowSectionDTO,
} from "../../../../business/adapters/in/dtos/site_customization.dto";
import { authPlugin } from "../../../../infrastructure/auth/auth-plugin";
import { repositoriesPlugin } from "../../../../infrastructure/di/repositories.plugin";
import sharp from "sharp";
import { join } from "path";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";

export const settingsController = new Elysia({ prefix: "/api/settings" })
  .use(authPlugin)
  .use(repositoriesPlugin)
  .onBeforeHandle(({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "Não autorizado" };
    }
  })
  .post("/logo", async ({ body: { file, businessId }, user, businessRepository, set }) => {
    try {
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

      const uploadDir = join(process.cwd(), "public/uploads/logos");
      if (!existsSync(uploadDir)) {
        await mkdir(uploadDir, { recursive: true });
      }

      const fileName = `${businessId}-${Date.now()}.webp`;
      const filePath = join(uploadDir, fileName);
      const publicUrl = `/public/uploads/logos/${fileName}`;

      // Processamento em Background e Streaming
      // Lemos o buffer do arquivo (Elysia já faz o parse do multipart)
      const buffer = Buffer.from(await file.arrayBuffer());

      // Retornamos a resposta imediatamente após iniciar o processamento
      // O processamento real acontece em background
      const processImage = async () => {
        try {
          await sharp(buffer)
            .resize(400, 400, { fit: "inside", withoutEnlargement: true })
            .webp({ quality: 80 })
            .toFile(filePath);
          console.log(`[SETTINGS_CONTROLLER] Logo processada e salva em: ${filePath}`);
        } catch (err) {
          console.error(`[SETTINGS_CONTROLLER] Erro no processamento da logo:`, err);
        }
      };

      // Dispara o processamento sem esperar (background)
      processImage();

      return { url: publicUrl };
    } catch (error: any) {
      console.error("[SETTINGS_LOGO_UPLOAD_ERROR]:", error);
      set.status = 500;
      return { error: error.message };
    }
  }, {
    body: t.Object({
      file: t.File(),
      businessId: t.String()
    })
  })
  .get("/profile/:businessId", async ({ params: { businessId }, settingsRepository, businessRepository, user, set }) => {
    try {
      // Validar se o usuário é dono da empresa
      const business = await businessRepository.findById(businessId);
      if (!business || business.ownerId !== user!.id) {
        set.status = 403;
        return { error: "Você não tem permissão para acessar as configurações desta empresa." };
      }

      const getSettingsUseCase = new GetSettingsUseCase(settingsRepository);
      const profile = await getSettingsUseCase.execute(businessId);

      // Retorna o perfil mesclado com dados de cadastro como padrão
      return {
        id: profile?.id,
        businessId: businessId,
        siteName: profile?.siteName || business.name,
        titleSuffix: profile?.titleSuffix || "",
        description: profile?.description || "",
        logoUrl: profile?.logoUrl || "",
        instagram: profile?.instagram || "",
        showInstagram: profile?.showInstagram ?? true,
        whatsapp: profile?.whatsapp || "",
        showWhatsapp: profile?.showWhatsapp ?? true,
        facebook: profile?.facebook || "",
        showFacebook: profile?.showFacebook ?? true,
        tiktok: profile?.tiktok || "",
        showTiktok: profile?.showTiktok ?? true,
        linkedin: profile?.linkedin || "",
        showLinkedin: profile?.showLinkedin ?? true,
        twitter: profile?.twitter || "",
        showTwitter: profile?.showTwitter ?? true,
        phone: profile?.phone || (business as any).contact || "",
        email: profile?.email || user!.email,
        address: profile?.address || (business as any).address || "",
        createdAt: profile?.createdAt,
        updatedAt: profile?.updatedAt
      };
    } catch (error: any) {
      console.error("[SETTINGS_GET_PROFILE_ERROR]:", error);
      set.status = 500;
      return { error: error.message };
    }
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
  .get("/customization/:businessId", async ({ params: { businessId }, settingsRepository, businessRepository, user, set }) => {
    try {
      console.log(`[DB_FETCH] Buscando customização para ID: ${businessId}`);

      // Validar se o usuário é dono da empresa
      const business = await businessRepository.findById(businessId);
      if (!business || business.ownerId !== user!.id) {
        set.status = 403;
        return { error: "Você não tem permissão para acessar a personalização desta empresa." };
      }

      // Adicionar headers de cache para evitar dados antigos no navegador
      set.headers["Cache-Control"] = "no-store, max-age=0";

      const getSiteCustomizationUseCase = new GetSiteCustomizationUseCase(settingsRepository);
      return await getSiteCustomizationUseCase.execute(businessId);
    } catch (error: any) {
      console.error("[SETTINGS_GET_CUSTOMIZATION_ERROR]:", error);
      set.status = 500;
      return { error: error.message };
    }
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
  });
