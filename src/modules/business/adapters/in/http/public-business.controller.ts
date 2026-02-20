import { Elysia, t } from "elysia";
import { repositoriesPlugin } from "../../../../infrastructure/di/repositories.plugin";

export const publicBusinessController = () => new Elysia({ prefix: "/api/business" })
  .use(repositoriesPlugin)
  .get("/slug/:slug", async ({ params: { slug }, set, businessRepository, settingsRepository, userRepository }) => {
    // Normalização de entrada para evitar erros de case/espaços
    const normalizedSlug = slug.trim().toLowerCase();
    
    console.log(`[PUBLIC_BUSINESS_FETCH] Buscando dados para o slug (RAW): '${slug}'`);
    console.log(`[PUBLIC_BUSINESS_FETCH] Buscando dados para o slug (NORMALIZED): '${normalizedSlug}'`);

    // Forçar o navegador a não usar cache para garantir que as cores novas apareçam
    set.headers["Cache-Control"] = "no-store, max-age=0, must-revalidate";
    set.headers["Pragma"] = "no-cache";
    set.headers["Expires"] = "0";

    // Busca usando o slug normalizado
    const business = await businessRepository.findBySlug(normalizedSlug);

    if (!business) {
      console.error(`[PUBLIC_BUSINESS_FETCH] ❌ ERRO 404: Empresa não encontrada para o slug: '${normalizedSlug}'`);
      set.status = 404;
      return { 
        error: "Business not found",
        message: `Nenhum estúdio encontrado com o endereço '${normalizedSlug}'. Verifique se o link está correto.`
      };
    }

    console.log(`[PUBLIC_BUSINESS_FETCH] ✅ SUCESSO: Dados encontrados para: ${business.name} (ID: ${business.id})`);

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
        console.error(`[PUBLIC_BUSINESS_FETCH] Erro ao buscar owner para fallback de email:`, err);
      }
    }

    // 2. Resolução de Telefone (Prioridade: Perfil > Cadastro da Empresa)
    const publicPhone = profile?.phone || business.contact || null;

    const customization = business.siteCustomization as any;
    const primaryColor = customization?.layoutGlobal?.siteColors?.primary ||
      customization?.layoutGlobal?.base_colors?.primary ||
      'Padrão';

    console.log(`[PUBLIC_BUSINESS_FETCH] Cor Primária no Banco:`, primaryColor);
    console.log(`[PUBLIC_BUSINESS_FETCH] Contato resolvido - Email: ${publicEmail}, Phone: ${publicPhone}`);

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
  });
