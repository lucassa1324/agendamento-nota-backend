-- Migration 0025: índices de unicidade de e-mail na tabela staff
--
-- Objetivo:
--   1. Garantir que o mesmo e-mail não seja cadastrado duas vezes dentro do
--      mesmo estúdio (company_id).
--   2. Permitir busca rápida por e-mail em qualquer estúdio, de modo que o
--      backend possa bloquear o cadastro de colaboradores que já pertencem a
--      outro studio cadastrado na plataforma.
--
-- Índices criados:
--   staff_email_idx          - índice de busca por e-mail (qualquer empresa)
--   staff_email_company_unique - índice único composto (email + company_id)
--
-- Observação:
--   O índice único composto é a garantia definitiva contra duplicidade
--   dentro do mesmo estúdio, mesmo em cenários de condição de corrida
--   (cadastro simultâneo). O backend também valida antes de inserir para
--   retornar mensagens de erro amigáveis ao usuário ao invés de um erro
--   de constraint genérico do PostgreSQL.

-- 1. Índice de busca por e-mail em qualquer estúdio
CREATE INDEX IF NOT EXISTS "staff_email_idx"
ON "staff" ("email");

-- 2. Índice único composto: impede duplicidade de e-mail dentro do mesmo estúdio
--    Esta constraint é a barreira final contra condições de corrida.
DO $$
BEGIN
  -- Verifica se já existe para não falhar em re-execuções
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'staff_email_company_unique'
  ) THEN
    CREATE UNIQUE INDEX "staff_email_company_unique"
    ON "staff" ("email", "company_id");
  END IF;
END $$;

-- Comentários para documentação
COMMENT ON INDEX "staff_email_idx" IS
  'Índice de busca rápida por e-mail. Usado para detectar e-mails já vinculados a outro estúdio antes de permitir cadastro/edição.';

COMMENT ON INDEX "staff_email_company_unique" IS
  'Índice único composto: garante que o mesmo e-mail não seja cadastrado duas vezes dentro do mesmo estúdio. Barreira final contra condições de corrida.';
