CREATE TABLE IF NOT EXISTS "master_templates" (
  "id" text PRIMARY KEY NOT NULL,
  "template_key" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "description" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "master_template_variations" (
  "id" text PRIMARY KEY NOT NULL,
  "template_id" text NOT NULL REFERENCES "public"."master_templates"("id") ON DELETE cascade ON UPDATE no action,
  "variation_key" text NOT NULL,
  "variation_name" text NOT NULL,
  "niche" text NOT NULL,
  "section_type" text NOT NULL,
  "config" jsonb NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "master_template_variations_template_id_idx"
  ON "master_template_variations" USING btree ("template_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "master_template_variations_section_type_idx"
  ON "master_template_variations" USING btree ("section_type");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "master_template_variations_unique_section_per_variation"
  ON "master_template_variations" USING btree ("template_id", "variation_key", "section_type");
--> statement-breakpoint
INSERT INTO "master_templates" ("id", "template_key", "name", "description", "is_active")
VALUES
  ('template_1', 'template-1', 'Template 1', 'Estrutura base com início completo (banner, serviços, história e equipe).', true)
ON CONFLICT ("template_key") DO NOTHING;
--> statement-breakpoint
INSERT INTO "master_template_variations"
  ("id", "template_id", "variation_key", "variation_name", "niche", "section_type", "config", "is_active", "sort_order")
VALUES
  (
    'template_1_var_1_banner',
    'template_1',
    'variacao-1',
    'Premium & Exclusivo',
    'Advocacia',
    'banner',
    $${
      "id": "advocacia-3",
      "niche": "Advocacia",
      "variationName": "Premium & Exclusivo",
      "title": "Excelência em Defesa Jurídica",
      "subtitle": "Soluções jurídicas personalizadas para questões complexas e alta gestão patrimonial.",
      "badge": "Assessoria VIP",
      "badgeIcon": "Crown",
      "primaryButton": "Agendar Reunião",
      "secondaryButton": "Nossa Equipe",
      "bgImage": "https://images.unsplash.com/photo-1453723490680-8b9d7350dd93?q=80&w=1920&auto=format&fit=crop",
      "bgType": "image",
      "primaryButtonColor": "#18181b",
      "badgeColor": "#f4f4f5",
      "badgeTextColor": "#18181b",
      "fontFamily": "lora",
      "titleSize": "xl",
      "sectionId": "home-hero"
    }$$::jsonb,
    true,
    1
  ),
  (
    'template_1_var_1_servicos',
    'template_1',
    'variacao-1',
    'Premium & Exclusivo',
    'Advocacia',
    'servicos',
    $${
      "id": "servicos-1",
      "niche": "Geral",
      "variationName": "Minimalista",
      "title": "Nossos Serviços Especializados",
      "subtitle": "Conheça nossos tratamentos e escolha o melhor para você.",
      "cardBgColor": "#ffffff",
      "cardTitleColor": "#000000",
      "cardDescriptionColor": "#666666",
      "cardIconColor": "#000000"
    }$$::jsonb,
    true,
    2
  ),
  (
    'template_1_var_1_historia',
    'template_1',
    'variacao-1',
    'Premium & Exclusivo',
    'Advocacia',
    'historia',
    $${
      "id": "historia-1",
      "niche": "Geral",
      "variationName": "Clássica",
      "title": "Nossa Trajetória",
      "subtitle": "Conheça como começamos nossa jornada de excelência.",
      "bgType": "color",
      "bgColor": "#f3f4f6"
    }$$::jsonb,
    true,
    3
  ),
  (
    'template_1_var_1_equipe',
    'template_1',
    'variacao-1',
    'Premium & Exclusivo',
    'Advocacia',
    'equipe',
    $${
      "id": "equipe-1",
      "niche": "Geral",
      "variationName": "Profissional",
      "title": "Nossa Equipe de Especialistas",
      "subtitle": "Conheça os profissionais por trás do nosso sucesso.",
      "bgType": "color",
      "bgColor": "#ffffff"
    }$$::jsonb,
    true,
    4
  )
ON CONFLICT ("id") DO NOTHING;
