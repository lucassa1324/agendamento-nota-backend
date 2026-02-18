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
    showOnHome: t.Optional(t.Boolean()),
    show_on_home: t.Optional(t.Boolean()),
    advancedRules: t.Optional(t.Any()),
    advanced_rules: t.Optional(t.Any()),
    // Novos campos para recursos/estoque
    resources: t.Optional(t.Array(t.Object({
        inventoryId: t.String(),
        quantity: t.Number(),
        unit: t.String(),
        useSecondaryUnit: t.Boolean(),
    }))),
});
