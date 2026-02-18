import { Elysia, t } from "elysia";
import { authPlugin } from "../../../../infrastructure/auth/auth-plugin";
import { repositoriesPlugin } from "../../../../infrastructure/di/repositories.plugin";
import { UpdateBusinessConfigUseCase } from "../../../application/use-cases/update-business-config.use-case";
export const companyController = new Elysia({ prefix: "/company" })
    .use(repositoriesPlugin)
    .use(authPlugin)
    .onBeforeHandle(({ user, set }) => {
    if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
    }
})
    .post("/customizer", async ({ user, body, set, businessRepository }) => {
    try {
        // O corpo pode conter campos como hero_title, primary_color, etc.
        // Vamos mapear para a estrutura que o repositório espera ou salvar como JSON direto.
        // Para manter a flexibilidade solicitada, vamos permitir campos diretos e mapear.
        const config = {};
        // Mapeamento básico se vierem campos flat
        if (body.hero_title || body.hero_subtitle) {
            config.home = {
                hero_banner: {
                    title: body.hero_title,
                    subtitle: body.hero_subtitle
                }
            };
        }
        if (body.primary_color || body.font_family) {
            config.layoutGlobal = {
                base_colors: {
                    primary: body.primary_color
                },
                typography: {
                    font_family: body.font_family
                }
            };
        }
        // Se vier a config completa, usa ela
        const finalConfig = body.config || config;
        const companyId = body.companyId;
        if (!companyId) {
            set.status = 400;
            return { error: "companyId is required" };
        }
        const updateBusinessConfigUseCase = new UpdateBusinessConfigUseCase(businessRepository);
        return await updateBusinessConfigUseCase.execute(companyId, user.id, { config: finalConfig });
    }
    catch (error) {
        set.status = 400;
        return { error: error.message };
    }
}, {
    body: t.Object({
        companyId: t.String(),
        hero_title: t.Optional(t.String()),
        hero_subtitle: t.Optional(t.String()),
        primary_color: t.Optional(t.String()),
        font_family: t.Optional(t.String()),
        config: t.Optional(t.Any())
    })
});
