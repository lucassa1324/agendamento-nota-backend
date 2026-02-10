export interface SiteCustomization {
  layoutGlobal: LayoutGlobal;
  home: HomeSection;
  gallery: GallerySection;
  aboutUs: AboutUsSection;
  appointmentFlow: AppointmentFlowSection;
}

// --- Layout Global ---
export interface LayoutGlobal {
  header: {
    backgroundAndEffect: {
      color: string;
      opacity: number;
      blur: number;
    };
    textColors: {
      logo: string;
      links: string;
      hover: string;
    };
    actionButtons: {
      backgroundColor: string;
      textColor: string;
    };
  };
  typography: {
    headingsFont: string;
    subheadingsFont: string;
    bodyFont: string;
  };
  siteColors: {
    primary: string;
    secondary: string;
    background: string;
  };
  footer: {
    colors: {
      background: string;
      text: string;
      icons: string;
    };
    typography: {
      headings: string;
      body: string;
    };
    visibility: boolean;
  };
}

// --- Home Section ---
export interface HomeSection {
  heroBanner: {
    visibility: boolean;
    title: {
      text: string;
      color: string;
      font: string;
      sizeMobile: string;
      sizeDesktop: string;
    };
    subtitle: {
      text: string;
      color: string;
      font: string;
      size: string;
    };
    ctaButton: {
      text: string;
      backgroundColor: string;
      textColor: string;
      borderRadius: string;
      borderColor: string;
      destinationLink: string;
    };
    appearance: {
      backgroundImageUrl: string;
      glassEffect: {
        active: boolean;
        intensity: number;
      };
      overlay: {
        color: string;
        opacity: number; // Percentage 0-100 or 0-1
      };
      verticalAlignment: 'top' | 'center' | 'bottom';
      horizontalAlignment: 'left' | 'center' | 'right';
      sectionHeight: 'small' | 'medium' | 'full_screen';
    };
  };
  servicesSection: {
    visibility: boolean;
    orderOnHome: number;
    header: {
      title: {
        text: string;
        color: string;
        font: string;
        size: string;
      };
      subtitle: {
        text: string;
        color: string;
        font: string;
        size: string;
      };
      alignment: 'left' | 'center' | 'right';
    };
    cardConfig: {
      showImage: boolean;
      showCategory: boolean;
      priceStyle: {
        visible: boolean;
        color: string;
        font: string;
      };
      durationStyle: {
        visible: boolean;
        color: string;
      };
      cardBackgroundColor: string;
      borderAndShadow: {
        borderSize: string;
        shadowIntensity: string;
      };
      borderRadius: string;
    };
    bookingButtonStyle: {
      text: string;
      backgroundColor: string;
      textColor: string;
      borderRadius: string;
    };
  };
  valuesSection: {
    visibility: boolean;
    orderOnHome: number;
    header: {
      title: {
        text: string;
        color: string;
        font: string;
        size: string;
      };
      subtitle: {
        text: string;
        color: string;
        font: string;
        size: string;
      };
    };
    itemsStyle: {
      layout: 'grid' | 'list' | 'carousel';
      itemBackgroundColor: string;
      borderRadius: string;
      internalAlignment: 'left' | 'center';
    };
    items: ValueItem[];
  };
  galleryPreview: {
    visibility: boolean;
    orderOnHome: number;
    header: {
      title: {
        text: string;
        color: string;
        font: string;
        size: string;
      };
      subtitle: {
        text: string;
        color: string;
        font: string;
        size: string;
      };
    };
    displayLogic: {
      selectionMode: 'automatic_recent' | 'manual_highlights';
      photoCount: 3 | 6 | 9 | 12;
      gridLayout: 'mosaic' | 'fixed_squares' | 'carousel';
    };
    photoStyle: {
      aspectRatio: '1:1' | '4:3' | '16:9';
      spacing: string;
      borderRadius: string;
      hoverEffect: 'zoom' | 'brightness' | 'none';
    };
    viewMoreButton: {
      visible: boolean;
      text: string;
      style: {
        backgroundColor: string;
        textColor: string;
        borderRadius: string;
      };
    };
  };
  ctaSection: {
    visibility: boolean;
    orderOnHome: number;
    title: {
      text: string;
      color: string;
      font: string;
      size: {
        desktop: string;
        mobile: string;
      };
    };
    subtitle: {
      text: string;
      color: string;
      font: string;
      size: string;
    };
    conversionButton: {
      text: string;
      style: {
        backgroundColor: string;
        textColor: string;
        borderColor: string;
      };
      borderRadius: string;
    };
    designConfig: {
      backgroundType: 'solid_color' | 'gradient' | 'image';
      colorOrImageUrl: string;
      glassEffect: {
        active: boolean;
        intensity: number;
      };
      borders: {
        top: boolean;
        bottom: boolean;
      };
      padding: string;
      alignment: 'left' | 'center' | 'right';
    };
  };
}

export interface ValueItem {
  id: string;
  order: number;
  icon: {
    type: 'icon' | 'image' | 'number';
    value: string;
    color: string;
  };
  title: {
    text: string;
    style: {
      color: string;
      font: string;
      size: string;
    };
  };
  description: {
    text: string;
    style: {
      color: string;
      font: string;
      size: string;
    };
  };
}

// --- Gallery Section (Page) ---
export interface GallerySection {
  gridConfig: {
    // Define properties based on general requirements or leave generic if not fully specified
    columns: number;
    gap: string;
  };
  interactivity: {
    enableLightbox: boolean;
    showCaptions: boolean;
  };
}

// --- About Us Section (Page) ---
export interface AboutUsSection {
  aboutBanner: {
    // Similar to hero banner but for about page
    visibility: boolean;
    title: string;
    backgroundImageUrl: string;
  };
  ourStory: {
    visibility: boolean;
    title: string;
    text: string;
    imageUrl: string;
  };
  ourValues: ValueItem[]; // Reusing ValueItem
  ourTeam: TeamMember[];
  testimonials: Testimonial[];
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  imageUrl: string;
  bio: string;
}

export interface Testimonial {
  id: string;
  author: string;
  text: string;
  rating: number;
  imageUrl?: string;
}

// --- Appointment Flow ---
export interface AppointmentFlowSection {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    text: string;
  };
  step1Services: {
    title: string;
    showPrices: boolean;
    showDurations: boolean;
    cardConfig: {
      backgroundColor: string;
    };
  };
  step2Date: {
    title: string;
    calendarStyle: 'modern' | 'classic';
  };
  step3Times: {
    title: string;
    timeSlotStyle: 'list' | 'grid';
    timeSlotSize: number; // Intervalo em minutos (ex: 30, 60)
  };
  step4Confirmation: {
    title: string;
    requireLogin: boolean;
  };
}
