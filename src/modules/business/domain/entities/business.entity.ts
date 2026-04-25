import { SiteCustomization } from "../types/site_customization.types";

export type BusinessSiteCustomization = SiteCustomization;

export type Business = {
  id: string;
  name: string;
  slug: string;
  phone?: string | null;
  address?: string | null;
  contact?: string | null;
  ownerId: string;
  active: boolean;
  createdAt: Date;
  updatedAt?: Date;
  subscriptionStatus?:
  | 'trial'
  | 'trialing'
  | 'active'
  | 'grace_period'
  | 'past_due'
  | 'blocked'
  | 'pending_cancellation'
  | 'canceled'
  | 'manual_active';
  trialEndsAt?: Date;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  accessType?: 'automatic' | 'manual' | 'extended_trial';
  siteCustomization?: BusinessSiteCustomization;
};

export type BusinessSummary = {
  id: string;
  name: string;
  slug: string;
  phone?: string | null;
  createdAt: Date;
  siteCustomization?: BusinessSiteCustomization;
};

export type CreateBusinessInput = {
  id: string;
  name: string;
  phone: string;
  slug: string;
  ownerId: string;
};
