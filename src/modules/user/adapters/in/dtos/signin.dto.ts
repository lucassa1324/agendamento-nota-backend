import { t } from "elysia";

export const signinDTO = t.Object({
  name: t.String(),
  email: t.String({ format: "email" }),
  password: t.String({ minLength: 6 }),
  studioName: t.String(),
  phone: t.String({
    pattern: "^[0-9]{10,11}$|^\\([0-9]{2}\\)\\s?[0-9]{4,5}-[0-9]{4}$",
    error: "Telefone inválido. Use o formato (99) 99999-9999 ou apenas números com DDD."
  }),
  cpfCnpj: t.Optional(t.String()),
  role: t.Optional(t.String()), // "USER" ou "SUPER_ADMIN"
}, {
  additionalProperties: true
});

export type SigninDTO = typeof signinDTO.static;
