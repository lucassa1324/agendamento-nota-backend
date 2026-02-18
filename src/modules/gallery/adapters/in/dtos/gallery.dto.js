import { t } from "elysia";
export const createGalleryImageDTO = t.Object({
    title: t.Optional(t.String()),
    imageUrl: t.String(),
    category: t.Optional(t.String()),
    showInHome: t.Optional(t.Boolean()),
    order: t.Optional(t.Union([t.Number(), t.String()])),
});
export const updateGalleryImageDTO = t.Partial(t.Object({
    title: t.Optional(t.String()),
    imageUrl: t.Optional(t.String()),
    category: t.Optional(t.String()),
    showInHome: t.Optional(t.Boolean()),
    order: t.Optional(t.Union([t.Number(), t.String()])),
}));
