-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "pilares" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "AgendaFonte" ADD COLUMN     "pilar" TEXT NOT NULL DEFAULT 'posvenda';

-- AlterTable
ALTER TABLE "EventoAgenda" ADD COLUMN     "pilar" TEXT NOT NULL DEFAULT 'posvenda';

-- CreateTable
CREATE TABLE "FunilEtapa" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'aberta',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FunilEtapa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "whatsapp" TEXT,
    "email" TEXT,
    "instagram" TEXT,
    "origem" TEXT,
    "programa" TEXT,
    "valorCentavos" INTEGER,
    "responsavel" TEXT,
    "etapaId" TEXT NOT NULL,
    "etapaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "proximoPasso" TEXT,
    "proximoPassoEm" TIMESTAMP(3),
    "motivoPerda" TEXT,
    "obs" TEXT,
    "criadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadNota" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'nota',
    "texto" TEXT NOT NULL,
    "autor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadNota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venda" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "cliente" TEXT NOT NULL,
    "email" TEXT,
    "whatsapp" TEXT,
    "programa" TEXT NOT NULL,
    "valorCentavos" INTEGER NOT NULL,
    "pagamento" TEXT,
    "vendedora" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "origem" TEXT,
    "inicio" TIMESTAMP(3),
    "duracao" INTEGER,
    "combinados" TEXT,
    "cancelada" BOOLEAN NOT NULL DEFAULT false,
    "motivoCancelamento" TEXT,
    "passagem" TEXT NOT NULL DEFAULT 'pendente',
    "passagemEm" TIMESTAMP(3),
    "passagemPor" TEXT,
    "mentoradaId" TEXT,
    "criadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Venda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaVenda" (
    "id" TEXT NOT NULL,
    "mes" TEXT NOT NULL,
    "vendedora" TEXT NOT NULL DEFAULT '',
    "valorCentavos" INTEGER NOT NULL,
    "quantidade" INTEGER,

    CONSTRAINT "MetaVenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Call" (
    "id" TEXT NOT NULL,
    "eventoChave" TEXT,
    "leadId" TEXT,
    "titulo" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "link" TEXT,
    "responsavel" TEXT,
    "resultado" TEXT,
    "obs" TEXT,
    "registradoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Call_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lead_etapaId_idx" ON "Lead"("etapaId");

-- CreateIndex
CREATE INDEX "Lead_responsavel_idx" ON "Lead"("responsavel");

-- CreateIndex
CREATE INDEX "LeadNota_leadId_createdAt_idx" ON "LeadNota"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "Venda_data_idx" ON "Venda"("data");

-- CreateIndex
CREATE INDEX "Venda_passagem_idx" ON "Venda"("passagem");

-- CreateIndex
CREATE UNIQUE INDEX "MetaVenda_mes_vendedora_key" ON "MetaVenda"("mes", "vendedora");

-- CreateIndex
CREATE UNIQUE INDEX "Call_eventoChave_key" ON "Call"("eventoChave");

-- CreateIndex
CREATE INDEX "Call_inicio_idx" ON "Call"("inicio");

-- CreateIndex
CREATE INDEX "Call_leadId_idx" ON "Call"("leadId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "FunilEtapa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadNota" ADD CONSTRAINT "LeadNota_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venda" ADD CONSTRAINT "Venda_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venda" ADD CONSTRAINT "Venda_mentoradaId_fkey" FOREIGN KEY ("mentoradaId") REFERENCES "Mentorada"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Quem já tinha acesso continua vendo o Pós Venda (tudo o que existia até aqui).
UPDATE "Usuario" SET "pilares" = ARRAY['posvenda']::TEXT[];

-- Etapas iniciais do funil de vendas (podem ser renomeadas, criadas e excluídas na tela).
INSERT INTO "FunilEtapa" ("id", "nome", "ordem", "tipo") VALUES
  ('funil_novo', 'Novo lead', 1, 'aberta'),
  ('funil_conversa', 'Em conversa', 2, 'aberta'),
  ('funil_call', 'Call agendada', 3, 'aberta'),
  ('funil_proposta', 'Proposta enviada', 4, 'aberta'),
  ('funil_ganho', 'Fechado', 5, 'ganho'),
  ('funil_perdido', 'Perdido', 6, 'perdido');
