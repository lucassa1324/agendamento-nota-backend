import { t } from "elysia";
export const createGalleryImageDTO = t.Object({
    title: t.Optional(t.String()),
    imageUrl: t.Optional(t.String()),
    category: t.Optional(t.String()),
    showInHome: t.Optional(t.Union([t.Boolean(), t.String()])), // Aceita boolean ou string "true"/"false" do FormData
    order: t.Optional(t.Union([t.Number(), t.String()])),
    file: t.Optional(t.Any()),
});
export const updateGalleryImageDTO = t.Partial(t.Object({
    title: t.Optional(t.String()),
    imageUrl: t.Optional(t.String()),
    category: t.Optional(t.String()),
    showInHome: t.Optional(t.Union([t.Boolean(), t.String()])),
    order: t.Optional(t.Union([t.Number(), t.String()])),
}));
