import { t } from "elysia";

export const LayoutGlobalDTO = t.Object({
  header: t.Object({
    backgroundAndEffect: t.Object({
      color: t.String(),
      opacity: t.Number(),
      blur: t.Number(),
    }),
    textColors: t.Object({
      logo: t.String(),
      links: t.String(),
      hover: t.String(),
    }),
    actionButtons: t.Object({
      backgroundColor: t.String(),
      textColor: t.String(),
    }),
  }),
  typography: t.Object({
    headingsFont: t.String(),
    subheadingsFont: t.String(),
    bodyFont: t.String(),
  }),
  siteColors: t.Object({
    primary: t.String(),
    secondary: t.String(),
    background: t.String(),
  }),
  footer: t.Object({
    colors: t.Object({
      background: t.String(),
      text: t.String(),
      icons: t.String(),
    }),
    typography: t.Object({
      headings: t.String(),
      body: t.String(),
    }),
    visibility: t.Boolean(),
  }),
});

export const HomeSectionDTO = t.Object({
  heroBanner: t.Object({
    visibility: t.Boolean(),
    title: t.Object({
      text: t.String(),
      color: t.String(),
      font: t.String(),
      sizeMobile: t.String(),
      sizeDesktop: t.String(),
    }),
    subtitle: t.Object({
      text: t.String(),
      color: t.String(),
      font: t.String(),
      size: t.String(),
    }),
    ctaButton: t.Object({
      text: t.String(),
      backgroundColor: t.String(),
      textColor: t.String(),
      borderRadius: t.String(),
      borderColor: t.String(),
      destinationLink: t.String(),
    }),
    appearance: t.Object({
      backgroundImageUrl: t.String(),
      glassEffect: t.Object({
        active: t.Boolean(),
        intensity: t.Number(),
      }),
      overlay: t.Object({
        color: t.String(),
        opacity: t.Number(),
      }),
      verticalAlignment: t.Union([t.Literal("top"), t.Literal("center"), t.Literal("bottom")]),
      horizontalAlignment: t.Union([t.Literal("left"), t.Literal("center"), t.Literal("right")]),
      sectionHeight: t.Union([t.Literal("small"), t.Literal("medium"), t.Literal("full_screen")]),
    }),
  }),
  servicesSection: t.Object({
    visibility: t.Boolean(),
    orderOnHome: t.Number(),
    header: t.Object({
      title: t.Object({
        text: t.String(),
        color: t.String(),
        font: t.String(),
        size: t.String(),
      }),
      subtitle: t.Object({
        text: t.String(),
        color: t.String(),
        font: t.String(),
        size: t.String(),
      }),
      alignment: t.Union([t.Literal("left"), t.Literal("center"), t.Literal("right")]),
    }),
    cardConfig: t.Object({
      showImage: t.Boolean(),
      showCategory: t.Boolean(),
      priceStyle: t.Object({
        visible: t.Boolean(),
        color: t.String(),
        font: t.String(),
      }),
      durationStyle: t.Object({
        visible: t.Boolean(),
        color: t.String(),
      }),
      cardBackgroundColor: t.String(),
      borderAndShadow: t.Object({
        borderSize: t.String(),
        shadowIntensity: t.String(),
      }),
      borderRadius: t.String(),
    }),
    bookingButtonStyle: t.Object({
      text: t.String(),
      backgroundColor: t.String(),
      textColor: t.String(),
      borderRadius: t.String(),
    }),
  }),
  valuesSection: t.Object({
    visibility: t.Boolean(),
    orderOnHome: t.Number(),
    header: t.Object({
      title: t.Object({
        text: t.String(),
        color: t.String(),
        font: t.String(),
        size: t.String(),
      }),
      subtitle: t.Object({
        text: t.String(),
        color: t.String(),
        font: t.String(),
        size: t.String(),
      }),
    }),
    itemsStyle: t.Object({
      layout: t.Union([t.Literal("grid"), t.Literal("list"), t.Literal("carousel")]),
      itemBackgroundColor: t.String(),
      borderRadius: t.String(),
      internalAlignment: t.Union([t.Literal("left"), t.Literal("center")]),
    }),
    items: t.Array(t.Object({
      id: t.String(),
      order: t.Number(),
      icon: t.Object({
        type: t.Union([t.Literal("icon"), t.Literal("image"), t.Literal("number")]),
        value: t.String(),
        color: t.String(),
      }),
      title: t.Object({
        text: t.String(),
        style: t.Object({
          color: t.String(),
          font: t.String(),
          size: t.String(),
        }),
      }),
      description: t.Object({
        text: t.String(),
        style: t.Object({
          color: t.String(),
          font: t.String(),
          size: t.String(),
        }),
      }),
    })),
  }),
  galleryPreview: t.Object({
    visibility: t.Boolean(),
    orderOnHome: t.Number(),
    header: t.Object({
      title: t.Object({
        text: t.String(),
        color: t.String(),
        font: t.String(),
        size: t.String(),
      }),
      subtitle: t.Object({
        text: t.String(),
        color: t.String(),
        font: t.String(),
        size: t.String(),
      }),
    }),
    displayLogic: t.Object({
      selectionMode: t.Union([t.Literal("automatic_recent"), t.Literal("manual_highlights")]),
      photoCount: t.Union([t.Literal(3), t.Literal(6), t.Literal(9), t.Literal(12)]),
      gridLayout: t.Union([t.Literal("mosaic"), t.Literal("fixed_squares"), t.Literal("carousel")]),
    }),
    photoStyle: t.Object({
      aspectRatio: t.Union([t.Literal("1:1"), t.Literal("4:3"), t.Literal("16:9")]),
      spacing: t.String(),
      borderRadius: t.String(),
      hoverEffect: t.Union([t.Literal("zoom"), t.Literal("brightness"), t.Literal("none")]),
    }),
    viewMoreButton: t.Object({
      visible: t.Boolean(),
      text: t.String(),
      style: t.Object({
        backgroundColor: t.String(),
        textColor: t.String(),
        borderRadius: t.String(),
      }),
    }),
  }),
  ctaSection: t.Object({
    visibility: t.Boolean(),
    orderOnHome: t.Number(),
    title: t.Object({
      text: t.String(),
      color: t.String(),
      font: t.String(),
      size: t.Object({
        desktop: t.String(),
        mobile: t.String(),
      }),
    }),
    subtitle: t.Object({
      text: t.String(),
      color: t.String(),
      font: t.String(),
      size: t.String(),
    }),
    conversionButton: t.Object({
      text: t.String(),
      style: t.Object({
        backgroundColor: t.String(),
        textColor: t.String(),
        borderColor: t.String(),
      }),
      borderRadius: t.String(),
    }),
    designConfig: t.Object({
      backgroundType: t.Union([t.Literal("solid_color"), t.Literal("gradient"), t.Literal("image")]),
      colorOrImageUrl: t.String(),
      glassEffect: t.Object({
        active: t.Boolean(),
        intensity: t.Number(),
      }),
      borders: t.Object({
        top: t.Boolean(),
        bottom: t.Boolean(),
      }),
      padding: t.String(),
      alignment: t.Union([t.Literal("left"), t.Literal("center"), t.Literal("right")]),
    }),
  }),
});

export const GallerySectionDTO = t.Object({
  gridConfig: t.Object({
    columns: t.Number(),
    gap: t.String(),
  }),
  interactivity: t.Object({
    enableLightbox: t.Boolean(),
    showCaptions: t.Boolean(),
  }),
});

export const AboutUsSectionDTO = t.Object({
  aboutBanner: t.Object({
    visibility: t.Boolean(),
    title: t.String(),
    backgroundImageUrl: t.String(),
  }),
  ourStory: t.Object({
    visibility: t.Boolean(),
    title: t.String(),
    text: t.String(),
    imageUrl: t.String(),
  }),
  ourValues: t.Array(t.Any()), // Using Any to avoid circular dependency or duplication complexity for now
  ourTeam: t.Array(t.Object({
    id: t.String(),
    name: t.String(),
    role: t.String(),
    imageUrl: t.String(),
    bio: t.String(),
  })),
  testimonials: t.Array(t.Object({
    id: t.String(),
    author: t.String(),
    text: t.String(),
    rating: t.Number(),
    imageUrl: t.Optional(t.String()),
  })),
});

export const AppointmentFlowSectionDTO = t.Object({
  colors: t.Object({
    primary: t.String(),
    secondary: t.String(),
    background: t.String(),
    text: t.String(),
  }),
  step1Services: t.Object({
    title: t.String(),
    showPrices: t.Boolean(),
    showDurations: t.Boolean(),
    cardConfig: t.Object({
      backgroundColor: t.String(),
    }),
  }),
  step2Date: t.Object({
    title: t.String(),
    calendarStyle: t.Union([t.Literal("modern"), t.Literal("classic")]),
  }),
  step3Time: t.Object({
    title: t.String(),
    timeSlotStyle: t.Union([t.Literal("list"), t.Literal("grid")]),
  }),
  step4Confirmation: t.Object({
    title: t.String(),
    requireLogin: t.Boolean(),
  }),
});
