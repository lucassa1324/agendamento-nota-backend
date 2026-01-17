import { Elysia, t } from "elysia";
import { authPlugin } from "../../../../infrastructure/auth/auth-plugin";

// Temporariamente desabilitado até que a tabela 'reports' seja criada no schema
export const reportController = new Elysia({ prefix: "/reports" })
  .use(authPlugin)
  .get("/", async ({ set }) => {
    set.status = 501;
    return { error: "Reports functionality is not implemented yet." };
  });
