import { t } from "elysia";

export const signinDTO = t.Object({
  name: t.String(),
  email: t.String({ format: "email" }),
  password: t.String({ minLength: 6 }),
  studioName: t.String(),
  role: t.Optional(t.String()), // "USER" ou "SUPER_ADMIN"
});

export type SigninDTO = typeof signinDTO.static;
