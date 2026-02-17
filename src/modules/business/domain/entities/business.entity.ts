import { SiteCustomization } from "../types/site_customization.types";

export type BusinessSiteCustomization = SiteCustomization;

export type Business = {
  id: string;
  name: string;
  slug: string;
  address?: string | null;
  contact?: string | null;
  ownerId: string;
  createdAt: Date;
  updatedAt?: Date;
  siteCustomization?: BusinessSiteCustomization;
};

export type BusinessSummary = {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  siteCustomization?: BusinessSiteCustomization;
};

export type CreateBusinessInput = {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
};
