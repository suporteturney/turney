-- AlterTable
ALTER TABLE "Mentorada" ADD COLUMN     "pipelineFaseEm" TIMESTAMP(3),
ADD COLUMN     "pipelineFaseId" TEXT;

-- CreateTable
CREATE TABLE "PipelineFase" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "tarefaTexto" TEXT,
    "tarefaDiasUteis" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PipelineFase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tarefa" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "prazo" TIMESTAMP(3) NOT NULL,
    "mentoradaId" TEXT,
    "faseId" TEXT,
    "automatica" BOOLEAN NOT NULL DEFAULT false,
    "criadaPor" TEXT,
    "concluidaEm" TIMESTAMP(3),
    "concluidaPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tarefa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Tarefa_concluidaEm_prazo_idx" ON "Tarefa"("concluidaEm", "prazo");

-- CreateIndex
CREATE INDEX "Tarefa_mentoradaId_idx" ON "Tarefa"("mentoradaId");

-- AddForeignKey
ALTER TABLE "Mentorada" ADD CONSTRAINT "Mentorada_pipelineFaseId_fkey" FOREIGN KEY ("pipelineFaseId") REFERENCES "PipelineFase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarefa" ADD CONSTRAINT "Tarefa_mentoradaId_fkey" FOREIGN KEY ("mentoradaId") REFERENCES "Mentorada"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarefa" ADD CONSTRAINT "Tarefa_faseId_fkey" FOREIGN KEY ("faseId") REFERENCES "PipelineFase"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Etapas iniciais do Pipeline (dá para renomear, reordenar, criar e excluir pela tela)
INSERT INTO "PipelineFase" ("id", "nome", "ordem", "tarefaTexto", "tarefaDiasUteis") VALUES
  ('fase_onboarding_agendado', 'Onboarding agendado', 1, NULL, NULL),
  ('fase_onboarding_realizado', 'Onboarding realizado', 2, NULL, NULL),
  ('fase_testes_iniciais', 'Testes Iniciais', 3, NULL, NULL),
  ('fase_mentoria_estrategica', 'Mentoria Estratégica', 4, 'Enviar o roadmap', 5),
  ('fase_envio_materiais', 'Envio de Materiais para análise', 5, NULL, NULL),
  ('fase_aplicacoes', 'Aplicações', 6, NULL, NULL),
  ('fase_entrevistas', 'Entrevistas', 7, NULL, NULL),
  ('fase_aprovacao', 'Aprovação', 8, NULL, NULL);
