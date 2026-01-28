import { t } from "elysia";

export const createBusinessDTO = t.Object({
  name: t.String(),
  slug: t.String(),
});

export const updateBusinessConfigDTO = t.Object({
  config: t.Object({
    layoutGlobal: t.Optional(t.Any()),
    home: t.Optional(t.Any()),
    gallery: t.Optional(t.Any()),
    aboutUs: t.Optional(t.Any()),
    appointmentFlow: t.Optional(t.Any()),
  }),
});

export type CreateBusinessDTO = typeof createBusinessDTO.static;
export type UpdateBusinessConfigDTO = typeof updateBusinessConfigDTO.static;
