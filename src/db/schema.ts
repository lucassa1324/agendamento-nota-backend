import {
  pgTable,
  timestamp,
  text,
  uuid,
  varchar,
  boolean,
  index,
  jsonb,
  numeric,
  integer,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import {
  DEFAULT_LAYOUT_GLOBAL,
  DEFAULT_HOME_SECTION,
  DEFAULT_GALLERY_SECTION,
  DEFAULT_ABOUT_US_SECTION,
  DEFAULT_APPOINTMENT_FLOW_SECTION,
} from "../modules/business/domain/constants/site_customization.defaults";


export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  role: text("role").default("USER").notNull(), // USER ou SUPER_ADMIN
  active: boolean("active").default(true).notNull(),
  notifyNewAppointments: boolean("notify_new_appointments").default(true).notNull(),
  notifyCancellations: boolean("notify_cancellations").default(true).notNull(),
  notifyInventoryAlerts: boolean("notify_inventory_alerts").default(true).notNull(),
  accountStatus: text("account_status").default("ACTIVE").notNull(),
  cancellationRequestedAt: timestamp("cancellation_requested_at"),
  retentionEndsAt: timestamp("retention_ends_at"),
  lastRetentionDiscountAt: timestamp("last_retention_discount_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)]
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [index("account_userId_idx").on(table.userId)]
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)]
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const accountCancellationFeedback = pgTable("account_cancellation_feedback", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const companies = pgTable("companies", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  address: text("address"),
  contact: text("contact"),
  ownerId: text("owner_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  active: boolean("active").default(true).notNull(),
  subscriptionStatus: text("subscription_status").default('trial').notNull(),
  trialEndsAt: timestamp("trial_ends_at").defaultNow(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  accessType: text("access_type").default('automatic').notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const inventoryLogs = pgTable("inventory_logs", {
  id: text("id").primaryKey(),
  inventoryId: text("inventory_id")
    .notNull()
    .references(() => inventory.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["ENTRY", "EXIT"] }).notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull(),
  reason: text("reason").notNull(),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const companySiteCustomizations = pgTable("company_site_customizations", {
  id: text("id").primaryKey(),
  companyId: text("company_id")
    .notNull()
    .unique()
    .references(() => companies.id, { onDelete: "cascade" }),
  layoutGlobal: jsonb("layout_global").default(DEFAULT_LAYOUT_GLOBAL).notNull(),
  home: jsonb("home").default(DEFAULT_HOME_SECTION).notNull(),
  gallery: jsonb("gallery").default(DEFAULT_GALLERY_SECTION).notNull(),
  aboutUs: jsonb("about_us").default(DEFAULT_ABOUT_US_SECTION).notNull(),
  appointmentFlow: jsonb("appointment_flow")
    .default(DEFAULT_APPOINTMENT_FLOW_SECTION)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const services = pgTable("services", {
  id: text("id").primaryKey(),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  duration: text("duration").notNull(),
  icon: text("icon"),
  isVisible: boolean("is_visible").default(true).notNull(),
  showOnHome: boolean("show_on_home").default(false).notNull(),
  advancedRules: jsonb("advanced_rules").default({
    conflicts: [], // IDs de serviços que não podem ser feitos junto
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const appointments = pgTable("appointments", {
  id: text("id").primaryKey(),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  serviceId: text("service_id")
    .notNull()
    .references(() => services.id, { onDelete: "cascade" }),
  customerId: text("customer_id").references(() => user.id, { onDelete: "set null" }),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone").notNull(),
  // Snapshot do serviço no momento do agendamento
  serviceNameSnapshot: text("service_name_snapshot").notNull(),
  servicePriceSnapshot: numeric("service_price_snapshot", { precision: 10, scale: 2 }).notNull(),
  serviceDurationSnapshot: text("service_duration_snapshot").notNull(),
  scheduledAt: timestamp("scheduled_at").notNull(),
  status: text("status", { enum: ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "POSTPONED"] })
    .default("PENDING")
    .notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const agendaBlocks = pgTable("agenda_blocks", {
  id: text("id").primaryKey(),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  startDate: text("start_date").notNull(), // dd/mm/aaaa
  endDate: text("end_date").notNull(),
  startTime: text("start_time"), // HH:mm
  endTime: text("end_time"),
  reason: text("reason"),
  type: text("type", { enum: ["BLOCK_HOUR", "BLOCK_DAY", "BLOCK_PERIOD"] }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const serviceResources = pgTable("service_resources", {
  id: text("id").primaryKey(),
  serviceId: text("service_id")
    .notNull()
    .references(() => services.id, { onDelete: "cascade" }),
  inventoryId: text("inventory_id")
    .notNull()
    .references(() => inventory.id, { onDelete: "cascade" }),

  // Quantidade consumida no serviço
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull(),

  // Unidade usada no consumo (pode ser a principal ou secundária do produto)
  unit: text("unit").notNull(),

  // Se está usando a unidade secundária (ajuste fino)
  useSecondaryUnit: boolean("use_secondary_unit").default(false).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const googleCalendarConfigs = pgTable("google_calendar_configs", {
  id: text("id").primaryKey(),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  icalUrl: text("ical_url"),
  syncStatus: text("sync_status").default("INACTIVE").notNull(),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const operatingHours = pgTable("operating_hours", {
  id: text("id").primaryKey(),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  dayOfWeek: text("day_of_week").notNull(), // 0-6
  status: text("status").notNull(), // "OPEN", "CLOSED"
  morningStart: text("morning_start"),
  morningEnd: text("morning_end"),
  afternoonStart: text("afternoon_start"),
  afternoonEnd: text("afternoon_end"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const inventory = pgTable("inventory", {
  id: text("id").primaryKey(),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  initialQuantity: numeric("initial_quantity", { precision: 10, scale: 2 }).notNull(),
  currentQuantity: numeric("current_quantity", { precision: 10, scale: 2 }).notNull(),
  minQuantity: numeric("min_quantity", { precision: 10, scale: 2 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(), // Em centavos se preferir, mas usando numeric para precisão
  unit: text("unit").notNull(), // Ex: "un", "ml", "g"
  secondaryUnit: text("secondary_unit"),
  conversionFactor: numeric("conversion_factor", { precision: 10, scale: 2 }),
  isShared: boolean("is_shared").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const fixedExpenses = pgTable("fixed_expenses", {
  id: text("id").primaryKey(),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  value: numeric("value", { precision: 10, scale: 2 }).notNull(),
  category: text("category", {
    enum: [
      "INFRAESTRUTURA",
      "UTILIDADES",
      "MARKETING",
      "PRODUTOS_INSUMOS",
      "PESSOAL",
      "SISTEMAS_SOFTWARE",
      "IMPOSTOS",
      "GERAL"
    ]
  }).notNull(),
  type: text("type", { enum: ["FIXO", "VARIAVEL", "PARCELADO"] }).default("FIXO").notNull(),
  totalInstallments: integer("total_installments").default(1),
  currentInstallment: integer("current_installment").default(1),
  parentId: text("parent_id"),
  dueDate: timestamp("due_date").notNull(),
  isPaid: boolean("is_paid").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const businessProfiles = pgTable("business_profiles", {
  id: text("id").primaryKey(),
  businessId: text("business_id")
    .notNull()
    .unique()
    .references(() => companies.id, { onDelete: "cascade" }),

  // Informações Básicas
  siteName: text("site_name"),
  titleSuffix: text("title_suffix"),
  description: text("description"),
  logoUrl: text("logo_url"),

  // Redes Sociais
  instagram: text("instagram"),
  showInstagram: boolean("show_instagram").default(true).notNull(),
  whatsapp: text("whatsapp"),
  showWhatsapp: boolean("show_whatsapp").default(true).notNull(),
  facebook: text("facebook"),
  showFacebook: boolean("show_facebook").default(true).notNull(),
  tiktok: text("tiktok"),
  showTiktok: boolean("show_tiktok").default(true).notNull(),
  linkedin: text("linkedin"),
  showLinkedin: boolean("show_linkedin").default(true).notNull(),
  twitter: text("twitter"),
  showTwitter: boolean("show_twitter").default(true).notNull(),

  // Contato e Endereço
  phone: text("phone"),
  email: text("email"),
  address: text("address"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const galleryImages = pgTable("gallery_images", {
  id: text("id").primaryKey(),
  businessId: text("business_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  title: text("title"),
  imageUrl: text("image_url").notNull(),
  category: text("category"),
  showInHome: boolean("show_in_home").default(false).notNull(),
  order: numeric("order").default("0").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const companiesRelations = relations(companies, ({ one, many }) => ({
  owner: one(user, {
    fields: [companies.ownerId],
    references: [user.id],
  }),
  siteCustomization: one(companySiteCustomizations, {
    fields: [companies.id],
    references: [companySiteCustomizations.companyId],
  }),
  profile: one(businessProfiles, {
    fields: [companies.id],
    references: [businessProfiles.businessId],
  }),
  services: many(services),
  appointments: many(appointments),
  operatingHours: many(operatingHours),
  agendaBlocks: many(agendaBlocks),
  googleCalendarConfigs: many(googleCalendarConfigs),
  inventory: many(inventory),
  fixedExpenses: many(fixedExpenses),
  galleryImages: many(galleryImages),
}));

export const galleryImagesRelations = relations(galleryImages, ({ one }) => ({
  business: one(companies, {
    fields: [galleryImages.businessId],
    references: [companies.id],
  }),
}));

export const businessProfilesRelations = relations(businessProfiles, ({ one }) => ({
  business: one(companies, {
    fields: [businessProfiles.businessId],
    references: [companies.id],
  }),
}));

export const companySiteCustomizationsRelations = relations(companySiteCustomizations, ({ one }) => ({
  company: one(companies, {
    fields: [companySiteCustomizations.companyId],
    references: [companies.id],
  }),
}));

export const servicesRelations = relations(services, ({ one, many }) => ({
  company: one(companies, {
    fields: [services.companyId],
    references: [companies.id],
  }),
  appointments: many(appointments),
  resources: many(serviceResources),
}));

export const serviceResourcesRelations = relations(serviceResources, ({ one }) => ({
  service: one(services, {
    fields: [serviceResources.serviceId],
    references: [services.id],
  }),
  inventory: one(inventory, {
    fields: [serviceResources.inventoryId],
    references: [inventory.id],
  }),
}));

export const agendaBlocksRelations = relations(agendaBlocks, ({ one }) => ({
  company: one(companies, {
    fields: [agendaBlocks.companyId],
    references: [companies.id],
  }),
}));

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  company: one(companies, {
    fields: [appointments.companyId],
    references: [companies.id],
  }),
  service: one(services, {
    fields: [appointments.serviceId],
    references: [services.id],
  }),
  customer: one(user, {
    fields: [appointments.customerId],
    references: [user.id],
  }),
}));

export const googleCalendarConfigsRelations = relations(googleCalendarConfigs, ({ one }) => ({
  company: one(companies, {
    fields: [googleCalendarConfigs.companyId],
    references: [companies.id],
  }),
}));

export const operatingHoursRelations = relations(operatingHours, ({ one }) => ({
  company: one(companies, {
    fields: [operatingHours.companyId],
    references: [companies.id],
  }),
}));

export const inventoryRelations = relations(inventory, ({ one }) => ({
  company: one(companies, {
    fields: [inventory.companyId],
    references: [companies.id],
  }),
}));

export const fixedExpensesRelations = relations(fixedExpenses, ({ one }) => ({
  company: one(companies, {
    fields: [fixedExpenses.companyId],
    references: [companies.id],
  }),
}));


