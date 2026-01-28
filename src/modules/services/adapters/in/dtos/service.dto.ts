import { t } from "elysia";

export const createServiceDTO = t.Object({
  id: t.Optional(t.String()),
  companyId: t.String(),
  name: t.String(),
  description: t.Optional(t.Nullable(t.String())),
  price: t.Union([t.String(), t.Number()]),
  duration: t.Union([t.String(), t.Number()]),
  icon: t.Optional(t.Nullable(t.String())),
  isVisible: t.Optional(t.Boolean()),
  advancedRules: t.Optional(t.Any()),
});

export type CreateServiceDTO = typeof createServiceDTO.static;
