import { SiteCustomization } from "../../../business/domain/types/site_customization.types";

export interface BusinessProfile {
  id: string;
  businessId: string;
  siteName: string | null;
  titleSuffix: string | null;
  description: string | null;
  logoUrl: string | null;
  instagram: string | null;
  showInstagram: boolean;
  whatsapp: string | null;
  showWhatsapp: boolean;
  facebook: string | null;
  showFacebook: boolean;
  tiktok: string | null;
  showTiktok: boolean;
  linkedin: string | null;
  showLinkedin: boolean;
  twitter: string | null;
  showTwitter: boolean;
  phone: string | null;
  email: string | null;
  address: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SettingsRepository {
  findByBusinessId(businessId: string): Promise<BusinessProfile | null>;
  upsert(businessId: string, data: Partial<Omit<BusinessProfile, "id" | "businessId" | "createdAt" | "updatedAt">>): Promise<BusinessProfile>;

  findCustomizationByBusinessId(businessId: string): Promise<SiteCustomization | null>;
  saveCustomization(businessId: string, data: SiteCustomization): Promise<SiteCustomization>;
}
