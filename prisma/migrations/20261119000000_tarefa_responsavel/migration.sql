-- Tarefa: quem é responsável por fazer
ALTER TABLE "Tarefa" ADD COLUMN "responsavel" TEXT;
CREATE INDEX "Tarefa_responsavel_idx" ON "Tarefa"("responsavel");
