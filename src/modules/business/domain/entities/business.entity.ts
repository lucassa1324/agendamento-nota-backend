export type BusinessSiteCustomization = {
  layoutGlobal: {
    header: any;
    footer: any;
    typography: any;
    base_colors: any;
  };
  home: {
    hero_banner: any;
    services_section: any;
    contact_section: any;
  };
  gallery: {
    grid_config: any;
    interactivity: any;
  };
  aboutUs: {
    about_banner: any;
    our_story: any;
    our_values: any[];
    our_team: any[];
    testimonials: any[];
  };
  appointmentFlow: {
    step_1_services: any;
    step_2_date: any;
    step_3_time: any;
    step_4_confirmation: any;
  };
};

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
