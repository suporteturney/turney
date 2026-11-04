-- AlterTable
ALTER TABLE "Acompanhamento" ADD COLUMN "fixado" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Observacao" ADD COLUMN "fixado" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Documento" (
    "id" TEXT NOT NULL,
    "acompanhamentoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "conteudo" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Documento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Documento_acompanhamentoId_key" ON "Documento"("acompanhamentoId");

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_acompanhamentoId_fkey" FOREIGN KEY ("acompanhamentoId") REFERENCES "Acompanhamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
