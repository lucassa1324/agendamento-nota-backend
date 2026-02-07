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
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
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

export const companies = pgTable("companies", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  address: text("address"),
  contact: text("contact"),
  ownerId: text("owner_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

import {
  DEFAULT_LAYOUT_GLOBAL,
  DEFAULT_HOME_SECTION,
  DEFAULT_GALLERY_SECTION,
  DEFAULT_ABOUT_US_SECTION,
  DEFAULT_APPOINTMENT_FLOW_SECTION,
} from "../modules/business/domain/constants/site_customization.defaults";

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
  consumptionUnit: text("consumption_unit").notNull(),
  conversionFactor: text("conversion_factor").notNull(),
  purchaseUnit: text("purchase_unit").notNull(),
  consumedQuantity: text("consumed_quantity").notNull(),
  outputFactor: text("output_factor").notNull(),
  trigger: text("trigger").default("UPON_COMPLETION").notNull(),
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



