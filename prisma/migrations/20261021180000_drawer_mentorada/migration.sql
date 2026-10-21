-- AlterTable
ALTER TABLE "Mentorada" ADD COLUMN     "asana" TEXT,
ADD COLUMN     "cancelamento" TIMESTAMP(3),
ADD COLUMN     "disc" TEXT,
ADD COLUMN     "drive" TEXT,
ADD COLUMN     "linkedin" TEXT,
ADD COLUMN     "mesesAntes" INTEGER,
ADD COLUMN     "vagaCargo" TEXT,
ADD COLUMN     "vagaData" TIMESTAMP(3),
ADD COLUMN     "vagaEmpresa" TEXT;

-- AlterTable
ALTER TABLE "Acompanhamento" ADD COLUMN     "tipo" TEXT;

-- CreateTable
CREATE TABLE "Observacao" (
    "id" TEXT NOT NULL,
    "mentoradaId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "texto" TEXT NOT NULL,
    "autor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Observacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Renovacao" (
    "id" TEXT NOT NULL,
    "mentoradaId" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "destino" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "novoPrazo" TIMESTAMP(3),
    "obs" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Renovacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Observacao_mentoradaId_idx" ON "Observacao"("mentoradaId");

-- CreateIndex
CREATE INDEX "Renovacao_mentoradaId_idx" ON "Renovacao"("mentoradaId");

-- AddForeignKey
ALTER TABLE "Observacao" ADD CONSTRAINT "Observacao_mentoradaId_fkey" FOREIGN KEY ("mentoradaId") REFERENCES "Mentorada"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Renovacao" ADD CONSTRAINT "Renovacao_mentoradaId_fkey" FOREIGN KEY ("mentoradaId") REFERENCES "Mentorada"("id") ON DELETE CASCADE ON UPDATE CASCADE;

