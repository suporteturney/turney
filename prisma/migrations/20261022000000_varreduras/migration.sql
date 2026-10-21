-- AlterTable
ALTER TABLE "Acompanhamento" ADD COLUMN     "varreduraId" TEXT;

-- CreateTable
CREATE TABLE "Varredura" (
    "id" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "programa" TEXT,
    "titulo" TEXT,
    "autor" TEXT,
    "bom" TEXT[],
    "ruim" TEXT[],
    "invisivel" TEXT[],
    "melhorias" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Varredura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VarreduraItem" (
    "id" TEXT NOT NULL,
    "varreduraId" TEXT NOT NULL,
    "mentoradaId" TEXT,
    "nome" TEXT NOT NULL,
    "banda" TEXT NOT NULL,
    "tag" TEXT,
    "etapa" TEXT,
    "status" TEXT,
    "concluido" TEXT[],
    "pendencias" TEXT[],
    "atencao" TEXT[],
    "acompanhar" TEXT[],
    "perguntar" TEXT[],
    "retornos" TEXT[],
    "proximos" TEXT[],
    "mensagem" TEXT,
    "prioridade" INTEGER,
    "prioridadeMotivo" TEXT,

    CONSTRAINT "VarreduraItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Varredura_data_idx" ON "Varredura"("data");

-- CreateIndex
CREATE INDEX "VarreduraItem_varreduraId_idx" ON "VarreduraItem"("varreduraId");

-- CreateIndex
CREATE INDEX "VarreduraItem_mentoradaId_idx" ON "VarreduraItem"("mentoradaId");

-- CreateIndex
CREATE INDEX "Acompanhamento_varreduraId_idx" ON "Acompanhamento"("varreduraId");

-- AddForeignKey
ALTER TABLE "Acompanhamento" ADD CONSTRAINT "Acompanhamento_varreduraId_fkey" FOREIGN KEY ("varreduraId") REFERENCES "Varredura"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VarreduraItem" ADD CONSTRAINT "VarreduraItem_varreduraId_fkey" FOREIGN KEY ("varreduraId") REFERENCES "Varredura"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VarreduraItem" ADD CONSTRAINT "VarreduraItem_mentoradaId_fkey" FOREIGN KEY ("mentoradaId") REFERENCES "Mentorada"("id") ON DELETE SET NULL ON UPDATE CASCADE;

