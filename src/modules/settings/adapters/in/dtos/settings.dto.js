import { t } from "elysia";
export const SaveSettingsDTO = t.Object({
    businessId: t.Optional(t.String()),
    companyId: t.Optional(t.String()),
    siteName: t.Optional(t.Nullable(t.String())),
    titleSuffix: t.Optional(t.Nullable(t.String())),
    description: t.Optional(t.Nullable(t.String())),
    logoUrl: t.Optional(t.Nullable(t.String())),
    // Suporte a campos extras que o front pode enviar por engano
    message: t.Optional(t.Any()),
    data: t.Optional(t.Any()),
    // Redes Sociais
    instagram: t.Optional(t.Nullable(t.String())),
    showInstagram: t.Optional(t.Boolean()),
    whatsapp: t.Optional(t.Nullable(t.String())),
    showWhatsapp: t.Optional(t.Boolean()),
    facebook: t.Optional(t.Nullable(t.String())),
    showFacebook: t.Optional(t.Boolean()),
    tiktok: t.Optional(t.Nullable(t.String())),
    showTiktok: t.Optional(t.Boolean()),
    linkedin: t.Optional(t.Nullable(t.String())),
    showLinkedin: t.Optional(t.Boolean()),
    twitter: t.Optional(t.Nullable(t.String())),
    showTwitter: t.Optional(t.Boolean()),
    // Contato e Endereço
    phone: t.Optional(t.Nullable(t.String())),
    email: t.Optional(t.Nullable(t.String())),
    address: t.Optional(t.Nullable(t.String())),
});
