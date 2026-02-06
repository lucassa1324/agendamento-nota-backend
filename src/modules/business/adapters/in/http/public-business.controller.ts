import { Elysia, t } from "elysia";
import { repositoriesPlugin } from "../../../../infrastructure/di/repositories.plugin";

export const publicBusinessController = new Elysia({ prefix: "/api/business" })
  .use(repositoriesPlugin)
  .get("/slug/:slug", async ({ params: { slug }, set, businessRepository }) => {
    console.log(`[PUBLIC_BUSINESS_FETCH] Buscando dados para o slug: ${slug}`);

    // Forçar o navegador a não usar cache para garantir que as cores novas apareçam
    set.headers["Cache-Control"] = "no-store, max-age=0, must-revalidate";
    set.headers["Pragma"] = "no-cache";
    set.headers["Expires"] = "0";

    const business = await businessRepository.findBySlug(slug);

    if (!business) {
      console.log(`[PUBLIC_BUSINESS_FETCH] Empresa não encontrada para o slug: ${slug}`);
      set.status = 404;
      return { error: "Business not found" };
    }

    console.log(`[PUBLIC_BUSINESS_FETCH] Dados retornados do banco para o slug: ${slug}`);
    const customization = business.siteCustomization as any;
    const primaryColor = customization?.layoutGlobal?.siteColors?.primary ||
      customization?.layoutGlobal?.base_colors?.primary ||
      'Padrão';

    console.log(`[PUBLIC_BUSINESS_FETCH] Cor Primária no Banco:`, primaryColor);

    return business;
  }, {
    params: t.Object({
      slug: t.String()
    })
  });
