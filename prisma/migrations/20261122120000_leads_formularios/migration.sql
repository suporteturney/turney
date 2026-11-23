-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "formularios" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "pontuacao" INTEGER,
ADD COLUMN     "preenchidoEm" TIMESTAMP(3),
ADD COLUMN     "temperatura" TEXT,
ADD COLUMN     "temperaturaManual" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "RespostaFormulario" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "formulario" TEXT NOT NULL,
    "completa" BOOLEAN NOT NULL DEFAULT true,
    "preenchidoEm" TIMESTAMP(3) NOT NULL,
    "pontuacao" INTEGER,
    "temperatura" TEXT,
    "respostas" JSONB NOT NULL,
    "utms" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RespostaFormulario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RespostaFormulario_leadId_preenchidoEm_idx" ON "RespostaFormulario"("leadId", "preenchidoEm");

-- CreateIndex
CREATE INDEX "Lead_preenchidoEm_idx" ON "Lead"("preenchidoEm");

-- AddForeignKey
ALTER TABLE "RespostaFormulario" ADD CONSTRAINT "RespostaFormulario_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

