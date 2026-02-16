import { t } from "elysia";
import {
  LayoutGlobalDTO,
  HomeSectionDTO,
  GallerySectionDTO,
  AboutUsSectionDTO,
  AppointmentFlowSectionDTO,
} from "./site_customization.dto";

export const createBusinessDTO = t.Object({
  name: t.String(),
  slug: t.Optional(t.String()),
});

export const updateBusinessConfigDTO = t.Object({
  config: t.Object({
    layoutGlobal: t.Optional(LayoutGlobalDTO),
    home: t.Optional(HomeSectionDTO),
    gallery: t.Optional(GallerySectionDTO),
    aboutUs: t.Optional(AboutUsSectionDTO),
    appointmentFlow: t.Optional(AppointmentFlowSectionDTO),
  }),
});

export type CreateBusinessDTO = typeof createBusinessDTO.static;
export type UpdateBusinessConfigDTO = typeof updateBusinessConfigDTO.static;
