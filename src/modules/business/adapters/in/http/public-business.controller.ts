import { Elysia, t } from "elysia";
export const publicBusinessController = new Elysia({ prefix: "/api/business" })
  .get("/slug/:slug", async ({ params: { slug }, set, businessRepository }) => {
    console.log(`[BUSINESS_FETCH] Buscando dados para o slug: ${slug}`);
    const business = await businessRepository.findBySlug(slug);

    if (!business) {
      set.status = 404;
      return { error: "Business not found" };
    }

    return business;
  }, {
    params: t.Object({
      slug: t.String()
    })
  });
