-- Migration: Mover site_customization para uma nova tabela e migrar dados existentes
-- 1. Criar a nova tabela
CREATE TABLE IF NOT EXISTS "company_site_customizations" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"layout_global" jsonb DEFAULT '{"header":{},"footer":{},"typography":{},"base_colors":{}}'::jsonb NOT NULL,
	"home" jsonb DEFAULT '{"hero_banner":{},"services_section":{},"contact_section":{}}'::jsonb NOT NULL,
	"gallery" jsonb DEFAULT '{"grid_config":{},"interactivity":{}}'::jsonb NOT NULL,
	"about_us" jsonb DEFAULT '{"about_banner":{},"our_story":{},"our_values":[],"our_team":[],"testimonials":[]}'::jsonb NOT NULL,
	"appointment_flow" jsonb DEFAULT '{"step_1_services":{},"step_2_date":{},"step_3_time":{},"step_4_confirmation":{}}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "company_site_customizations_company_id_unique" UNIQUE("company_id")
);

-- 2. Adicionar constraint de chave estrangeira
DO $$ BEGIN
 ALTER TABLE "company_site_customizations" ADD CONSTRAINT "company_site_customizations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- 3. Migrar os dados existentes de companies para company_site_customizations
-- Usamos gen_random_uuid() para gerar novos IDs para a tabela de customização
-- Nota: Para Bun/Neon, usamos crypto.randomUUID() no código, mas no SQL usamos extensões ou strings
INSERT INTO "company_site_customizations" (
    "id", 
    "company_id", 
    "layout_global", 
    "home", 
    "gallery", 
    "about_us", 
    "appointment_flow", 
    "created_at", 
    "updated_at"
)
SELECT 
    'cust_' || id, -- Gerando um ID baseado no ID da empresa para garantir unicidade na migração
    id, 
    COALESCE(site_customization->'layout_global', '{"header":{},"footer":{},"typography":{},"base_colors":{}}'::jsonb),
    COALESCE(site_customization->'home', '{"hero_banner":{},"services_section":{},"contact_section":{}}'::jsonb),
    COALESCE(site_customization->'gallery', '{"grid_config":{},"interactivity":{}}'::jsonb),
    COALESCE(site_customization->'about_us', '{"about_banner":{},"our_story":{},"our_values":[],"our_team":[],"testimonials":[]}'::jsonb),
    COALESCE(site_customization->'appointment_flow', '{"step_1_services":{},"step_2_date":{},"step_3_time":{},"step_4_confirmation":{}}'::jsonb),
    created_at,
    updated_at
FROM "companies";

-- 4. Remover a coluna antiga da tabela companies
ALTER TABLE "companies" DROP COLUMN IF EXISTS "site_customization";
