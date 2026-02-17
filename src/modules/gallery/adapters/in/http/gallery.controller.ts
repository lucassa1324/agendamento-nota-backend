import { Elysia, t } from "elysia";
import { authPlugin } from "../../../../infrastructure/auth/auth-plugin";
import { repositoriesPlugin } from "../../../../infrastructure/di/repositories.plugin";
import { createGalleryImageDTO, updateGalleryImageDTO } from "../dtos/gallery.dto";

export const galleryController = new Elysia({ prefix: "/gallery" })
  .use(repositoriesPlugin)
  // Grupo Público (Acesso sem autenticação)
  .group("/public", (app) =>
    app.get("/:businessId", async ({ params: { businessId }, query, galleryRepository, set }) => {
      try {
        const filters = {
          category: query.category,
          showInHome: query.showInHome === "true" ? true : query.showInHome === "false" ? false : undefined,
        };
        const images = await galleryRepository.findByBusinessId(businessId, filters);
        return images;
      } catch (error: any) {
        console.error("[GALLERY_GET_PUBLIC_ERROR]:", error);
        set.status = 500;
        return { error: error.message };
      }
    }, {
      query: t.Object({
        category: t.Optional(t.String()),
        showInHome: t.Optional(t.String()),
      })
    })
  )
  // Grupo Privado (Requer autenticação)
  .use(authPlugin)
  .group("", (app) =>
    app
      .onBeforeHandle(({ user, set }) => {
        if (!user) {
          set.status = 401;
          return { error: "Não autorizado" };
        }
      })
      .get("/categories", async ({ serviceRepository, user, set }) => {
        try {
          const businessId = user!.businessId;
          if (!businessId) {
            set.status = 401;
            return { error: "Usuário não vinculado a uma empresa" };
          }
          const services = await serviceRepository.findAllByCompanyId(businessId);
          // Retorna apenas os nomes dos serviços como categorias
          return services.map(s => ({ id: s.id, name: s.name }));
        } catch (error: any) {
          console.error("[GALLERY_CATEGORIES_ERROR]:", error);
          set.status = 500;
          return { error: error.message };
        }
      })
      .get("/", async ({ galleryRepository, user, set }) => {
        try {
          const businessId = user!.businessId;
          if (!businessId) {
            set.status = 401;
            return { error: "Usuário não vinculado a uma empresa" };
          }
          const images = await galleryRepository.findByBusinessId(businessId);
          return images;
        } catch (error: any) {
          console.error("[GALLERY_GET_ERROR]:", error);
          set.status = 500;
          return { error: error.message };
        }
      })
      .post("/", async ({ body, galleryRepository, user, set }) => {
        try {
          const businessId = user!.businessId;
          if (!businessId) {
            set.status = 401;
            return { error: "Usuário não vinculado a uma empresa" };
          }

          const image = await galleryRepository.save({
            ...body,
            businessId,
            title: body.title || null,
            category: body.category || null,
            showInHome: body.showInHome || false,
            order: (body.order || "0").toString(),
          });

          return image;
        } catch (error: any) {
          console.error("[GALLERY_POST_ERROR]:", error);
          set.status = 500;
          return { error: error.message };
        }
      }, {
        body: createGalleryImageDTO
      })
      .patch("/:id", async ({ params: { id }, body, galleryRepository, user, set }) => {
        try {
          const existing = await galleryRepository.findById(id);
          if (!existing) {
            set.status = 404;
            return { error: "Imagem não encontrada" };
          }

          if (existing.businessId !== user!.businessId) {
            set.status = 403;
            return { error: "Não autorizado" };
          }

          const updated = await galleryRepository.update(id, {
            ...body,
            order: body.order?.toString()
          });
          return updated;
        } catch (error: any) {
          console.error("[GALLERY_PATCH_ERROR]:", error);
          set.status = 500;
          return { error: error.message };
        }
      }, {
        body: updateGalleryImageDTO
      })
      .delete("/:id", async ({ params: { id }, galleryRepository, user, set }) => {
        try {
          const existing = await galleryRepository.findById(id);
          if (!existing) {
            set.status = 404;
            return { error: "Imagem não encontrada" };
          }

          if (existing.businessId !== user!.businessId) {
            set.status = 403;
            return { error: "Não autorizado" };
          }

          await galleryRepository.delete(id);
          return { success: true };
        } catch (error: any) {
          console.error("[GALLERY_DELETE_ERROR]:", error);
          set.status = 500;
          return { error: error.message };
        }
      })
  );
