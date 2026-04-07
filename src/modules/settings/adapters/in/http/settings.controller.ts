import { Elysia, t } from "elysia";
import { GetSettingsUseCase } from "../../../application/use-cases/get-settings.use-case";
import { SaveSettingsUseCase } from "../../../application/use-cases/save-settings.use-case";
import { GetSiteCustomizationUseCase } from "../../../application/use-cases/get-site-customization.use-case";
import { UpdateSiteCustomizationUseCase } from "../../../application/use-cases/update-site-customization.use-case";
import { SaveSettingsDTO } from "../dtos/settings.dto";
import { authPlugin } from "../../../../infrastructure/auth/auth-plugin";
import { repositoriesPlugin } from "../../../../infrastructure/di/repositories.plugin";
import { uploadToB2, deleteFileFromB2 } from "../../../../infrastructure/storage/b2.storage";

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

const normalizeKeys = (obj: any): any => {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;

  const normalized: any = {};
  const mappings: Record<string, string> = {
    layout_global: "layoutGlobal",
    site_colors: "siteColors",
    base_colors: "siteColors",
    text_colors: "textColors",
    action_buttons: "actionButtons",
    about_us: "aboutUs",
    appointment_flow: "appointmentFlow",
    step1_services: "step1Services",
    step1_service: "step1Services",
    step1Service: "step1Services",
    service: "step1Services",
    step3_time: "step3Times",
    step3Time: "step3Times",
    step3Times: "step3Times",
    slot_interval: "timeSlotSize",
    timeSlotSize: "timeSlotSize",
    time_slot_size: "timeSlotSize",
    card_config: "cardConfig",
    card_bg_color: "cardBgColor",
    card_background_color: "cardBgColor",
    cardBgColor: "cardBgColor",
    cardBackgroundColor: "cardBgColor",
    background_color: "backgroundColor",
    backgroundColor: "backgroundColor",
    bgColor: "bgColor",
    bg_color: "bgColor",
    hero_banner: "heroBanner",
    hero: "heroBanner",
    services: "servicesSection",
    services_section: "servicesSection",
    values: "valuesSection",
    values_section: "valuesSection",
    gallery_preview: "galleryPreview",
    gallery_section: "galleryPreview",
    gallerySection: "galleryPreview",
    cta: "ctaSection",
    cta_section: "ctaSection",
    background_and_effect: "backgroundAndEffect",
    text_colors_header: "textColors",
    action_buttons_header: "actionButtons",
    theme: "layoutGlobal",
    fonts: "typography",
    colors: "siteColors",
    headings: "headingsFont",
    body: "bodyFont",
    primary: "primary",
    secondary: "secondary",
    background: "background"
  };

  for (const key in obj) {
    let targetKey = mappings[key] || key;
    let value = obj[key];

    if (targetKey === "timeSlotSize" && typeof value === "string") {
      const parsed = parseInt(value, 10);
      if (!isNaN(parsed)) {
        console.log(`>>> [NORMALIZE] Convertendo timeSlotSize de string para número: ${value} -> ${parsed}`);
        value = parsed;
      }
    }

    // Corrigir mapeamento recursivo para chaves mapeadas
    const remappedKey = mappings[key] || key;
    normalized[remappedKey] = normalizeKeys(value);
  }
  return normalized;
};

const deepMerge = (target: any, source: any): any => {
  if (!source || typeof source !== "object" || Array.isArray(source)) return source;
  if (!target || typeof target !== "object" || Array.isArray(target)) return source;

  const result = { ...target };

  for (const key in source) {
    if (source[key] === undefined) continue;

    const sourceValue = source[key];
    const targetValue = target[key];

    // Lógica Especial para Imagens: Se o novo valor for string vazia e o antigo for uma URL de storage, marcar para deleção
    if (key === "bgImage" || key === "backgroundImageUrl" || key === "logoUrl") {
      if (sourceValue === "" && typeof targetValue === "string" && targetValue.includes("/api/storage/")) {
        const storageKey = targetValue.split("/api/storage/")[1];
        if (storageKey) {
          console.log(`>>> [DEEP_MERGE] Detectada remoção de imagem: ${targetValue}. Key para deleção: ${storageKey}`);
          // Armazenamos as chaves para deletar no final do processo se necessário
          // Como o deepMerge é recursivo e puro, idealmente o controller deve gerenciar isso
          // Mas para simplificar, vamos logar e o controller pode agir baseado no rascunho anterior
        }
      }
    }

    if (sourceValue && typeof sourceValue === "object" && !Array.isArray(sourceValue)) {
      if (Object.keys(sourceValue).length === 0) {
        continue;
      }
      result[key] = deepMerge(targetValue || {}, sourceValue);
    } else {
      result[key] = sourceValue;
    }
  }
  return result;
};

export const settingsController = () => new Elysia({ prefix: "/settings" })
  .use(authPlugin)
  .use(repositoriesPlugin)
  // --- ROTAS PÚBLICAS ---
  .get("/published/:businessId", async ({ params: { businessId }, settingsRepository, set }) => {
    try {
      console.log(`>>> [BACK_PUBLIC_ACCESS] Buscando customização publicada para empresa: ${businessId}`);

      // Adicionar headers de cache para evitar dados antigos no navegador
      set.headers["Cache-Control"] = "no-store, max-age=0, must-revalidate";
      set.headers["Pragma"] = "no-cache";
      set.headers["Expires"] = "0";

      const customization = await settingsRepository.findCustomizationByBusinessId(businessId);

      if (!customization) {
        console.error(`!!! [BACK_PUBLIC_ACCESS_ERROR] Customização não encontrada para empresa: ${businessId}`);
        set.status = 404;
        return { error: "Customização publicada não encontrada para esta empresa." };
      }

      console.log(`>>> [BACK_PUBLIC_ACCESS] Sucesso ao carregar customização publicada para: ${businessId}`);
      console.log(`>>> [DATA_VERIFY] primaryButtonColor em layoutGlobal: ${(customization.layoutGlobal as any)?.primaryButtonColor}`);

      return customization;
    } catch (error: any) {
      console.error("[SETTINGS_GET_PUBLISHED_ERROR]:", error);
      set.status = 500;
      return { error: error.message };
    }
  })
  .get("/customization/:businessId", async ({ params: { businessId }, settingsRepository, set }) => {
    try {
      console.log(`>>> [BACK_PUBLIC_ACCESS] Buscando customização para empresa: ${businessId}`);

      // Adicionar headers de cache para evitar dados antigos no navegador
      set.headers["Cache-Control"] = "no-store, max-age=0, must-revalidate";
      set.headers["Pragma"] = "no-cache";
      set.headers["Expires"] = "0";

      const customization = await settingsRepository.findCustomizationByBusinessId(businessId);

      if (!customization) {
        console.error(`!!! [BACK_PUBLIC_ACCESS_ERROR] Customização não encontrada para empresa: ${businessId}`);
        set.status = 404;
        return { error: "Customização publicada não encontrada para esta empresa." };
      }

      console.log(`>>> [BACK_PUBLIC_ACCESS] Sucesso ao carregar customização para: ${businessId}`);
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
        phone: profile?.phone || (business as any).phone || (business as any).contact || null,
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
      .post("/background-image", async ({ body, user, businessRepository, set }) => {
        try {
          const { file, businessId, section } = body;
          console.log(`>>> [UPLOAD_BG_START] Recebendo upload para seção: ${section}, Empresa: ${businessId}`);
          console.log(`--- [UPLOAD_BG_FILE] Nome: ${file?.name}, Tipo: ${file?.type}, Tamanho: ${file?.size} bytes`);

          if (!file || !businessId || !section) {
            console.error(`!!! [UPLOAD_BG_ERROR] Dados ausentes: file=${!!file}, businessId=${businessId}, section=${section}`);
            set.status = 400;
            return { error: "Arquivo, businessId e seção são obrigatórios" };
          }

          // Validar se o usuário é dono da empresa
          const business = await businessRepository.findById(businessId);
          if (!business || business.ownerId !== user!.id) {
            console.error(`!!! [UPLOAD_BG_ERROR] Sem permissão ou empresa não existe. Owner: ${business?.ownerId}, User: ${user?.id}`);
            set.status = 403;
            return { error: "Você não tem permissão para esta empresa." };
          }

          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const extension = getExtensionFromMime(file.type);
          const key = `backgrounds/${businessId}/${section}_${crypto.randomUUID()}.${extension}`;

          console.log(`--- [UPLOAD_BG_B2] Iniciando upload para B2: ${key}`);

          const imageUrl = await uploadToB2({
            buffer,
            contentType: file.type || "application/octet-stream",
            key,
            cacheControl: "public, max-age=31536000"
          });

          console.log(`<<< [UPLOAD_BG_SUCCESS] Imagem enviada com sucesso: ${imageUrl}`);

          return {
            success: true,
            imageUrl
          };
        } catch (error: any) {
          console.error("!!! [UPLOAD_BG_ERROR_CRITICAL]:", error);
          set.status = 500;
          return { error: error.message };
        }
      }, {
        body: t.Object({
          file: t.Any(),
          businessId: t.String(),
          section: t.String() // hero, services, values, gallery, cta
        })
      })
      .delete("/background-image", async ({ body, user, businessRepository, settingsRepository, set }) => {
        try {
          const { imageUrl, businessId } = body;
          console.log(`>>> [DELETE_BG_START] Tentando deletar imagem: ${imageUrl} para Empresa: ${businessId}`);

          if (!imageUrl || !businessId) {
            set.status = 400;
            return { error: "imageUrl e businessId são obrigatórios" };
          }

          // Validar se o usuário é dono da empresa
          const business = await businessRepository.findById(businessId);
          if (!business || business.ownerId !== user!.id) {
            set.status = 403;
            return { error: "Não autorizado" };
          }

          const customization = await settingsRepository.findCustomizationByBusinessId(businessId);
          const draft = await settingsRepository.findDraftByBusinessId(businessId);
          const usedInCustomization = customization ? JSON.stringify(customization).includes(imageUrl) : false;
          const usedInDraft = draft ? JSON.stringify(draft).includes(imageUrl) : false;

          if (usedInCustomization || usedInDraft) {
            return { success: true, deleted: false, inUse: true };
          }

          // Só deleta se for uma URL do nosso B2 (proxy /api/storage/)
          if (imageUrl.includes("/api/storage/")) {
            const parts = imageUrl.split("/api/storage/");
            if (parts.length > 1) {
              const key = parts[1];
              // Importação dinâmica para evitar problemas se b2.storage não estiver pronto
              const { deleteFileFromB2 } = require("../../../../infrastructure/storage/b2.storage");
              await deleteFileFromB2(key);
              console.log(`<<< [DELETE_BG_SUCCESS] Arquivo removido do B2: ${key}`);
            }
          }

          return { success: true };
        } catch (error: any) {
          console.error("!!! [DELETE_BG_ERROR]:", error);
          set.status = 500;
          return { error: error.message };
        }
      }, {
        body: t.Object({
          imageUrl: t.String(),
          businessId: t.String()
        })
      })
      .get("/draft/:businessId", async ({ params: { businessId }, settingsRepository, businessRepository, user, set }) => {
        try {
          // Adicionar headers de cache para evitar dados antigos no navegador
          set.headers["Cache-Control"] = "no-store, max-age=0, must-revalidate";
          set.headers["Pragma"] = "no-cache";
          set.headers["Expires"] = "0";

          const business = await businessRepository.findById(businessId);
          if (!business || business.ownerId !== user!.id) {
            set.status = 403;
            return { error: "Você não tem permissão para acessar este rascunho." };
          }

          const draft = await settingsRepository.findDraftByBusinessId(businessId);
          if (draft) {
            return {
              layoutGlobal: draft.layoutGlobal,
              home: draft.home,
              gallery: draft.gallery,
              aboutUs: draft.aboutUs,
              appointmentFlow: draft.appointmentFlow,
            };
          }

          const getSiteCustomizationUseCase = new GetSiteCustomizationUseCase(settingsRepository);
          const customization = await getSiteCustomizationUseCase.execute(businessId);

          const savedDraft = await settingsRepository.saveDraft(businessId, customization);
          return {
            layoutGlobal: savedDraft.layoutGlobal,
            home: savedDraft.home,
            gallery: savedDraft.gallery,
            aboutUs: savedDraft.aboutUs,
            appointmentFlow: savedDraft.appointmentFlow,
          };
        } catch (error: any) {
          console.error("[SETTINGS_GET_DRAFT_ERROR]:", error);
          set.status = 500;
          return { error: error.message };
        }
      })
      .patch("/draft/:businessId", async ({ params: { businessId }, body, settingsRepository, businessRepository, user, set }) => {
        try {
          console.log(`>>> [PATCH_DRAFT_START] Recebendo patch para businessId: ${businessId}, User: ${user?.id}`);
          const business = await businessRepository.findById(businessId);
          if (!business || business.ownerId !== user!.id) {
            set.status = 403;
            return { error: "Você não tem permissão para atualizar este rascunho." };
          }

          let draft = await settingsRepository.findDraftByBusinessId(businessId);
          if (!draft) {
            const getSiteCustomizationUseCase = new GetSiteCustomizationUseCase(settingsRepository);
            const customization = await getSiteCustomizationUseCase.execute(businessId);
            draft = await settingsRepository.saveDraft(businessId, customization);
          }

          const normalizedData = normalizeKeys(body);
          console.log(`>>> [PATCH_DRAFT] Dados normalizados recebidos:`, JSON.stringify(normalizedData, null, 2));

          // Log específico para campos de estilização (botões, badges)
          if (normalizedData.heroBanner?.ctaButton || normalizedData.heroBanner?.badge) {
            console.log(`>>> [STYLING_DEBUG] Campos de estilo detectados:`, {
              ctaButton: normalizedData.heroBanner.ctaButton,
              badge: normalizedData.heroBanner.badge
            });
          }

          // Mapeamento de seções que pertencem ao 'home' mas podem vir na raiz
          const HOME_SECTIONS = [
            "heroBanner",
            "servicesSection",
            "valuesSection",
            "galleryPreview",
            "ctaSection",
            "backgroundAndEffect"
          ];

          // Mapeamento de seções que pertencem ao 'layoutGlobal' mas podem vir na raiz
          const LAYOUT_GLOBAL_SECTIONS = [
            "typography",
            "siteColors",
            "header",
            "footer"
          ];

          const dataToMerge: any = {};

          // Capturar campos de estilo da RAIZ (primaryButtonColor, secondaryButtonColor, badge, badgeColor, subtitleColor)
          const STYLING_ROOT_FIELDS = [
            "primaryButtonColor",
            "secondaryButtonColor",
            "badge",
            "badgeColor",
            "subtitleColor"
          ];

          for (const key in normalizedData) {
            if (HOME_SECTIONS.includes(key)) {
              dataToMerge.home = dataToMerge.home || {};
              dataToMerge.home[key] = normalizedData[key];
            } else if (LAYOUT_GLOBAL_SECTIONS.includes(key)) {
              dataToMerge.layoutGlobal = dataToMerge.layoutGlobal || {};
              dataToMerge.layoutGlobal[key] = normalizedData[key];
            } else if (STYLING_ROOT_FIELDS.includes(key)) {
              // Mapeia campos de estilo da raiz para layoutGlobal
              dataToMerge.layoutGlobal = dataToMerge.layoutGlobal || {};
              dataToMerge.layoutGlobal[key] = normalizedData[key];
              console.log(`>>> [STYLING_ROOT_MAPPING] Mapeando ${key} para layoutGlobal: ${normalizedData[key]}`);
            } else {
              dataToMerge[key] = normalizedData[key];
            }
          }

          console.log(`>>> [PATCH_DRAFT] Dados preparados para merge:`, JSON.stringify(dataToMerge, null, 2));

          const merged = deepMerge(draft, dataToMerge);

          if (merged.home?.heroBanner && merged.layoutGlobal?.heroBanner) {
            delete merged.layoutGlobal.heroBanner;
          }
          if (merged.home?.hero && merged.layoutGlobal?.hero) {
            delete merged.layoutGlobal.hero;
          }
          if (merged.home?.aboutHero && merged.layoutGlobal?.aboutHero) {
            delete merged.layoutGlobal.aboutHero;
          }
          if (merged.home?.storySection && merged.layoutGlobal?.story) {
            delete merged.layoutGlobal.story;
          }
          if (merged.home?.teamSection && merged.layoutGlobal?.team) {
            delete merged.layoutGlobal.team;
          }
          if (merged.home?.testimonialsSection && merged.layoutGlobal?.testimonials) {
            delete merged.layoutGlobal.testimonials;
          }
          if (merged.home?.servicesSection && merged.layoutGlobal?.services) {
            delete merged.layoutGlobal.services;
          }
          if (merged.home?.galleryPreview && merged.layoutGlobal?.galleryPreview) {
            delete merged.layoutGlobal.galleryPreview;
          }
          if (merged.home?.ctaSection && merged.layoutGlobal?.cta) {
            delete merged.layoutGlobal.cta;
          }

          // Log ultra-específico antes do DB update
          console.log(`>>> [STYLING_DEBUG_FINAL] Estado final antes de salvar no DB (layoutGlobal):`, {
            primaryButtonColor: merged.layoutGlobal?.primaryButtonColor,
            secondaryButtonColor: merged.layoutGlobal?.secondaryButtonColor,
            badge: merged.layoutGlobal?.badge,
            badgeColor: merged.layoutGlobal?.badgeColor,
            subtitleColor: merged.layoutGlobal?.subtitleColor
          });

          // Função para extrair todas as URLs de storage de um objeto
          const getStorageKeys = (obj: any): string[] => {
            const keys: string[] = [];
            const findKeys = (current: any) => {
              if (!current || typeof current !== "object") return;
              for (const key in current) {
                const val = current[key];
                if (typeof val === "string" && val.includes("/api/storage/")) {
                  const storageKey = val.split("/api/storage/")[1];
                  if (storageKey) keys.push(storageKey);
                } else if (val && typeof val === "object") {
                  findKeys(val);
                }
              }
            };
            findKeys(obj);
            return keys;
          };

          // Comparar rascunho antigo com o novo para detectar imagens deletadas
          const oldKeys = getStorageKeys(draft);
          const newKeys = getStorageKeys(merged);
          const deletedKeys = oldKeys.filter(k => !newKeys.includes(k));

          console.log(`>>> [STORAGE_CLEANUP_CHECK] Old Keys:`, oldKeys);
          console.log(`>>> [STORAGE_CLEANUP_CHECK] New Keys:`, newKeys);

          if (deletedKeys.length > 0) {
            console.log(`>>> [STORAGE_CLEANUP] Detectadas ${deletedKeys.length} imagens para deletar:`, deletedKeys);
            for (const key of deletedKeys) {
              try {
                // Remove prefixo de URL se existir (segurança extra)
                const cleanKey = key.startsWith("/") ? key.substring(1) : key;
                await deleteFileFromB2(cleanKey);
                console.log(`>>> [STORAGE_CLEANUP] Imagem deletada com sucesso: ${cleanKey}`);
              } catch (e) {
                console.error(`>>> [STORAGE_CLEANUP] Erro ao deletar imagem ${key}:`, e);
              }
            }
          }

          // Limpeza de duplicidade: Se existir 'gallerySection' no home, move para 'galleryPreview' e deleta a antiga
          if (merged.home && merged.home.gallerySection) {
            console.log(`>>> [CLEANUP] Movendo gallerySection para galleryPreview e removendo duplicata`);
            merged.home.galleryPreview = deepMerge(merged.home.galleryPreview || {}, merged.home.gallerySection);
            delete merged.home.gallerySection;
          }

          console.log(`>>> [PATCH_DRAFT] Dados após merge e limpeza:`, JSON.stringify(merged, null, 2));

          const savedDraft = await settingsRepository.saveDraft(businessId, merged);

          return savedDraft;
        } catch (error: any) {
          console.error("[SETTINGS_PATCH_DRAFT_ERROR]:", error);
          set.status = 500;
          return { error: error.message };
        }
      }, {
        body: t.Any()
      })
      .post("/publish/:businessId", async ({ params: { businessId }, settingsRepository, businessRepository, user, set }) => {
        try {
          const business = await businessRepository.findById(businessId);
          if (!business || business.ownerId !== user!.id) {
            set.status = 403;
            return { error: "Você não tem permissão para publicar este site." };
          }

          const published = await settingsRepository.publishDraft(businessId);
          if (!published) {
            set.status = 404;
            return { error: "Rascunho não encontrado" };
          }

          return published;
        } catch (error: any) {
          console.error("[SETTINGS_PUBLISH_DRAFT_ERROR]:", error);
          set.status = 500;
          return { error: error.message };
        }
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
          console.log(`>>> [PUBLISH_SITE] Empresa: ${businessId}`);

          // Validar se o usuário é dono da empresa
          const business = await businessRepository.findById(businessId);
          if (!business || business.ownerId !== user!.id) {
            console.error(`!!! [PUBLISH_SITE_ERROR] Sem permissão ou empresa não existe.`);
            set.status = 403;
            return { error: "Você não tem permissão para alterar a personalização desta empresa." };
          }

          const getSiteCustomizationUseCase = new GetSiteCustomizationUseCase(settingsRepository);
          const updateSiteCustomizationUseCase = new UpdateSiteCustomizationUseCase(
            settingsRepository,
            getSiteCustomizationUseCase
          );

          // Log específico para verificar a chegada de backgrounds (Hero, Serviços, etc)
          const typedBody = body as any;
          if (typedBody?.home) {
            Object.keys(typedBody.home).forEach(section => {
              const bgUrl = typedBody.home[section]?.appearance?.backgroundImageUrl;
              if (bgUrl) {
                console.log(`[BACKGROUND_DETECTED] Seção: ${section.toUpperCase()} | URL: ${bgUrl.substring(0, 70)}...`);
              }
            });
          }

          const result = await updateSiteCustomizationUseCase.execute(businessId, body);
          console.log(`<<< [PUBLISH_SITE_SUCCESS] Empresa: ${businessId}`);
          return result;
        } catch (error: any) {
          console.error("!!! [PUBLISH_SITE_ERROR_CRITICAL]:", error.message);
          set.status = 500;
          return { error: error.message };
        }
      }, {
        body: t.Any()
      })
      .post("/customizer/reset", async ({ body, user, settingsRepository, businessRepository, set }) => {
        try {
          const { businessId } = body;
          if (!businessId) {
            set.status = 400;
            return { error: "businessId é obrigatório" };
          }

          // Validar se o usuário é dono da empresa
          const business = await businessRepository.findById(businessId);
          if (!business || business.ownerId !== user!.id) {
            set.status = 403;
            return { error: "Você não tem permissão para esta empresa." };
          }

          console.log(`>>> [CUSTOMIZER_RESET] Resetando site para o padrão: ${businessId}`);
          const reseted = await settingsRepository.resetCustomization(businessId);

          return {
            success: true,
            message: "Site resetado para o padrão com sucesso.",
            data: reseted
          };
        } catch (error: any) {
          console.error("!!! [CUSTOMIZER_RESET_ERROR]:", error);
          set.status = 500;
          return { error: error.message };
        }
      }, {
        body: t.Object({
          businessId: t.String()
        })
      })
  );

export default settingsController;
