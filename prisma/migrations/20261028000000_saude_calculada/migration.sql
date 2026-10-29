-- Saúde calculada (jornada + encontros + acompanhamento) e ajuste manual
ALTER TABLE "Mentorada" ADD COLUMN "saudeNota" INTEGER;
ALTER TABLE "Mentorada" ADD COLUMN "saudeCalculada" TEXT;
ALTER TABLE "Mentorada" ADD COLUMN "saudeDetalhe" JSONB;
ALTER TABLE "Mentorada" ADD COLUMN "saudeAjusteEm" TIMESTAMP(3);
