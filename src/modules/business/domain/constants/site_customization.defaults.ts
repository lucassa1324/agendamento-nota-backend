import {
  LayoutGlobal,
  HomeSection,
  GallerySection,
  AboutUsSection,
  AppointmentFlowSection,
} from "../types/site_customization.types";

export const DEFAULT_LAYOUT_GLOBAL: LayoutGlobal = {
  header: {
    backgroundAndEffect: {
      color: "#ffffff",
      opacity: 0.95,
      blur: 10,
    },
    textColors: {
      logo: "#000000",
      links: "#333333",
      hover: "#000000",
    },
    actionButtons: {
      backgroundColor: "#000000",
      textColor: "#ffffff",
    },
  },
  typography: {
    headingsFont: "Inter",
    subheadingsFont: "Inter",
    bodyFont: "Inter",
  },
  siteColors: {
    primary: "#000000",
    secondary: "#333333",
    background: "#ffffff",
  },
  footer: {
    colors: {
      background: "#f5f5f5",
      text: "#333333",
      icons: "#000000",
    },
    typography: {
      headings: "Inter",
      body: "Inter",
    },
    visibility: true,
  },
};

export const DEFAULT_HOME_SECTION: HomeSection = {
  heroBanner: {
    visibility: true,
    title: {
      text: "Sua beleza, nossa prioridade",
      color: "#000000",
      font: "Inter",
      sizeMobile: "32px",
      sizeDesktop: "48px",
    },
    subtitle: {
      text: "Agende seu horário e realce o que você tem de melhor",
      color: "#666666",
      font: "Inter",
      size: "18px",
    },
    ctaButton: {
      text: "Agendar Agora",
      backgroundColor: "#000000",
      textColor: "#ffffff",
      borderRadius: "8px",
      borderColor: "transparent",
      destinationLink: "/agendamento",
    },
    appearance: {
      backgroundImageUrl: "",
      glassEffect: {
        active: false,
        intensity: 0,
      },
      overlay: {
        color: "#000000",
        opacity: 0,
      },
      verticalAlignment: "center",
      horizontalAlignment: "center",
      sectionHeight: "medium",
    },
  },
  servicesSection: {
    visibility: true,
    orderOnHome: 1,
    header: {
      title: {
        text: "Nossos Serviços",
        color: "#000000",
        font: "Inter",
        size: "36px",
      },
      subtitle: {
        text: "Escolha o tratamento ideal para si",
        color: "#666666",
        font: "Inter",
        size: "16px",
      },
      alignment: "center",
    },
    cardConfig: {
      showImage: true,
      showCategory: true,
      priceStyle: {
        visible: true,
        color: "#000000",
        font: "Inter",
      },
      durationStyle: {
        visible: true,
        color: "#666666",
      },
      cardBackgroundColor: "#ffffff",
      borderAndShadow: {
        borderSize: "1px",
        shadowIntensity: "small",
      },
      borderRadius: "12px",
    },
    bookingButtonStyle: {
      text: "Agendar",
      backgroundColor: "#000000",
      textColor: "#ffffff",
      borderRadius: "6px",
    },
  },
  valuesSection: {
    visibility: true,
    orderOnHome: 2,
    header: {
      title: {
        text: "Nossos Valores",
        color: "#000000",
        font: "Inter",
        size: "36px",
      },
      subtitle: {
        text: "O que nos move todos os dias",
        color: "#666666",
        font: "Inter",
        size: "16px",
      },
    },
    itemsStyle: {
      layout: "grid",
      itemBackgroundColor: "#f9f9f9",
      borderRadius: "8px",
      internalAlignment: "center",
    },
    items: [], // Initial empty list or default values could be added here
  },
  galleryPreview: {
    visibility: true,
    orderOnHome: 3,
    header: {
      title: {
        text: "Nossa Galeria",
        color: "#000000",
        font: "Inter",
        size: "36px",
      },
      subtitle: {
        text: "Confira nossos últimos trabalhos",
        color: "#666666",
        font: "Inter",
        size: "16px",
      },
    },
    displayLogic: {
      selectionMode: "automatic_recent",
      photoCount: 6,
      gridLayout: "mosaic",
    },
    photoStyle: {
      aspectRatio: "1:1",
      spacing: "16px",
      borderRadius: "8px",
      hoverEffect: "zoom",
    },
    viewMoreButton: {
      visible: true,
      text: "Ver Galeria Completa",
      style: {
        backgroundColor: "transparent",
        textColor: "#000000",
        borderRadius: "4px",
      },
    },
  },
  ctaSection: {
    visibility: true,
    orderOnHome: 4,
    title: {
      text: "Pronto para transformar seu olhar?",
      color: "#ffffff",
      font: "Inter",
      size: {
        desktop: "42px",
        mobile: "28px",
      },
    },
    subtitle: {
      text: "Reserve seu horário em menos de 1 minuto.",
      color: "#f0f0f0",
      font: "Inter",
      size: "18px",
    },
    conversionButton: {
      text: "Agendar Agora",
      style: {
        backgroundColor: "#ffffff",
        textColor: "#000000",
        borderColor: "transparent",
      },
      borderRadius: "8px",
    },
    designConfig: {
      backgroundType: "solid_color",
      colorOrImageUrl: "#000000",
      glassEffect: {
        active: false,
        intensity: 0,
      },
      borders: {
        top: false,
        bottom: false,
      },
      padding: "60px",
      alignment: "center",
    },
  },
};

export const DEFAULT_GALLERY_SECTION: GallerySection = {
  gridConfig: {
    columns: 3,
    gap: "24px",
  },
  interactivity: {
    enableLightbox: true,
    showCaptions: true,
  },
};

export const DEFAULT_ABOUT_US_SECTION: AboutUsSection = {
  aboutBanner: {
    visibility: true,
    title: "Sobre Nós",
    backgroundImageUrl: "",
  },
  ourStory: {
    visibility: true,
    title: "Nossa História",
    text: "Começamos com um sonho...",
    imageUrl: "",
  },
  ourValues: [],
  ourTeam: [],
  testimonials: [],
};

export const DEFAULT_APPOINTMENT_FLOW_SECTION: AppointmentFlowSection = {
  colors: {
    primary: "#000000",
    secondary: "#333333",
    background: "#ffffff",
    text: "#000000",
  },
  step1Services: {
    title: "Selecione o Serviço",
    showPrices: true,
    showDurations: true,
    cardConfig: {
      backgroundColor: "TRANSPARENT_DEFAULT",
    },
  },
  step2Date: {
    title: "Escolha a Data",
    calendarStyle: "modern",
  },
  step3Time: {
    title: "Escolha o Horário",
    timeSlotStyle: "grid",
  },
  step4Confirmation: {
    title: "Confirme seu Agendamento",
    requireLogin: false,
  },
};
