import { t } from "elysia";

export const CreateProductDTO = t.Object({
  companyId: t.String(),
  name: t.String(),
  initialQuantity: t.Union([t.String(), t.Number()]),
  currentQuantity: t.Optional(t.Union([t.String(), t.Number()])),
  minQuantity: t.Union([t.String(), t.Number()]),
  unitPrice: t.Union([t.String(), t.Number()]),
  unit: t.Optional(t.String()),
  secondaryUnit: t.Optional(t.Nullable(t.Any())),
  conversionFactor: t.Optional(t.Nullable(t.Any())),
});

export const UpdateProductDTO = t.Partial(
  t.Object({
    name: t.String(),
    initialQuantity: t.Union([t.String(), t.Number()]),
    currentQuantity: t.Union([t.String(), t.Number()]),
    minQuantity: t.Union([t.String(), t.Number()]),
    unitPrice: t.Union([t.String(), t.Number()]),
    unit: t.String(),
    secondaryUnit: t.Optional(t.Nullable(t.Any())),
    conversionFactor: t.Optional(t.Nullable(t.Any())),
  })
);

export const ProductResponseDTO = t.Object({
  id: t.String(),
  companyId: t.String(),
  name: t.String(),
  initialQuantity: t.String(),
  currentQuantity: t.String(),
  minQuantity: t.String(),
  unitPrice: t.String(),
  unit: t.String(),
  secondaryUnit: t.Optional(t.Nullable(t.String())),
  conversionFactor: t.Optional(t.Nullable(t.String())),
  createdAt: t.Date(),
  updatedAt: t.Date(),
});
