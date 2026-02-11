import { t } from "elysia";

export const CreateExpenseDto = t.Object({
  companyId: t.String(),
  description: t.String(),
  value: t.String(),
  category: t.Enum({
    INFRAESTRUTURA: "INFRAESTRUTURA",
    UTILIDADES: "UTILIDADES",
    MARKETING: "MARKETING",
    PRODUTOS_INSUMOS: "PRODUTOS_INSUMOS",
    PESSOAL: "PESSOAL",
    SISTEMAS_SOFTWARE: "SISTEMAS_SOFTWARE",
    IMPOSTOS: "IMPOSTOS",
    GERAL: "GERAL",
  }),
  dueDate: t.String(), // ISO Date string
  isPaid: t.Optional(t.Boolean()),
});

export const UpdateExpenseDto = t.Partial(CreateExpenseDto);
