import { Elysia, t } from "elysia";
import { authPlugin } from "../../../../infrastructure/auth/auth-plugin";
import { repositoriesPlugin } from "../../../../infrastructure/di/repositories.plugin";
import { createGalleryImageDTO, updateGalleryImageDTO } from "../dtos/gallery.dto";
import { uploadToB2, deleteFileFromB2 } from "../../../../infrastructure/storage/b2.storage";
import crypto from "crypto";
const getExtensionFromMime = (mimeType) => {
    if (!mimeType)
        return "bin";
    const map = {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/jpg": "jpg",
        "image/webp": "webp",
        "image/gif": "gif",
        "image/svg+xml": "svg"
    };
    return map[mimeType] || "bin";
};
export const galleryController = () => new Elysia({ prefix: "/gallery" })
    .use(repositoriesPlugin)
    // Grupo Público (Acesso sem autenticação)
    .group("/public", (app) => app.get("/:businessId", async ({ params: { businessId }, query, galleryRepository, set }) => {
    try {
        const filters = {
            category: query.category,
            showInHome: query.showInHome === "true" ? true : query.showInHome === "false" ? false : undefined,
        };
        const images = await galleryRepository.findByBusinessId(businessId, filters);
        return images;
    }
    catch (error) {
        console.error("[GALLERY_GET_PUBLIC_ERROR]:", error);
        set.status = 500;
        return { error: error.message };
    }
}, {
    query: t.Object({
        category: t.Optional(t.String()),
        showInHome: t.Optional(t.String()),
    })
}))
    // Grupo Privado (Requer autenticação)
    .use(authPlugin)
    .group("", (app) => app
    .onBeforeHandle(({ user, set }) => {
    if (!user) {
        set.status = 401;
        return { error: "Não autorizado" };
    }
})
    .get("/categories", async ({ serviceRepository, user, set }) => {
    try {
        const businessId = user.businessId;
        if (!businessId) {
            set.status = 401;
            return { error: "Usuário não vinculado a uma empresa" };
        }
        const services = await serviceRepository.findAllByCompanyId(businessId);
        // Retorna apenas os nomes dos serviços como categorias
        return services.map((s) => ({ id: s.id, name: s.name }));
    }
    catch (error) {
        console.error("[GALLERY_CATEGORIES_ERROR]:", error);
        set.status = 500;
        return { error: error.message };
    }
})
    .get("/", async ({ galleryRepository, user, set }) => {
    try {
        const businessId = user.businessId;
        if (!businessId) {
            set.status = 401;
            return { error: "Usuário não vinculado a uma empresa" };
        }
        const images = await galleryRepository.findByBusinessId(businessId);
        return images;
    }
    catch (error) {
        console.error("[GALLERY_GET_ERROR]:", error);
        set.status = 500;
        return { error: error.message };
    }
})
    .post("/", async ({ body, galleryRepository, user, set }) => {
    try {
        const businessId = user.businessId;
        if (!businessId) {
            set.status = 401;
            return { error: "Usuário não vinculado a uma empresa" };
        }
        const file = body.file;
        let imageUrl = body.imageUrl;
        if (!imageUrl && file) {
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const extension = getExtensionFromMime(file.type);
            const key = `gallery/${businessId}/${crypto.randomUUID()}.${extension}`;
            imageUrl = await uploadToB2({
                buffer,
                contentType: file.type || "application/octet-stream",
                key,
                cacheControl: "public, max-age=31536000"
            });
        }
        if (!imageUrl) {
            set.status = 400;
            return { error: "imageUrl ou file é obrigatório" };
        }
        const image = await galleryRepository.save({
            ...body,
            businessId,
            imageUrl,
            title: body.title || null,
            category: body.category || null,
            showInHome: body.showInHome === "true" || body.showInHome === true,
            order: (body.order || "0").toString(),
        });
        return image;
    }
    catch (error) {
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
        if (existing.businessId !== user.businessId) {
            set.status = 403;
            return { error: "Não autorizado" };
        }
        // Se a imagem estiver sendo alterada e a antiga for do B2, apaga a antiga
        if (body.imageUrl && body.imageUrl !== existing.imageUrl && existing.imageUrl && existing.imageUrl.includes("/api/storage/")) {
            try {
                const parts = existing.imageUrl.split("/api/storage/");
                if (parts.length > 1) {
                    await deleteFileFromB2(parts[1]);
                }
            }
            catch (err) {
                console.error("[GALLERY_UPDATE_FILE_ERROR]: Falha ao deletar imagem antiga do B2.", err);
            }
        }
        const updated = await galleryRepository.update(id, {
            ...body,
            showInHome: body.showInHome === "true" || body.showInHome === true,
            order: body.order?.toString()
        });
        return updated;
    }
    catch (error) {
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
        if (existing.businessId !== user.businessId) {
            set.status = 403;
            return { error: "Não autorizado" };
        }
        // Tenta deletar a imagem do B2 se ela existir
        if (existing.imageUrl && existing.imageUrl.includes("/api/storage/")) {
            try {
                // Extrai a key da URL. Ex: http://.../api/storage/gallery/123.jpg -> gallery/123.jpg
                const parts = existing.imageUrl.split("/api/storage/");
                if (parts.length > 1) {
                    const key = parts[1];
                    await deleteFileFromB2(key);
                }
            }
            catch (err) {
                console.error("[GALLERY_DELETE_FILE_ERROR]: Falha ao deletar arquivo do B2, mas prosseguindo com exclusão do banco.", err);
            }
        }
        await galleryRepository.delete(id);
        return { success: true };
    }
    catch (error) {
        console.error("[GALLERY_DELETE_ERROR]:", error);
        set.status = 500;
        return { error: error.message };
    }
}));
