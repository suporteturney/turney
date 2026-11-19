-- CreateTable
CREATE TABLE "ConsumoHubla" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nome" TEXT,
    "modulo" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "visualizacoes" INTEGER NOT NULL DEFAULT 0,
    "conclusao" INTEGER NOT NULL DEFAULT 0,
    "primeiro" TIMESTAMP(3),
    "ultimo" TIMESTAMP(3),
    "mentoradaId" TEXT,

    CONSTRAINT "ConsumoHubla_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConsumoHubla_mentoradaId_idx" ON "ConsumoHubla"("mentoradaId");

-- CreateIndex
CREATE INDEX "ConsumoHubla_email_idx" ON "ConsumoHubla"("email");

-- AddForeignKey
ALTER TABLE "ConsumoHubla" ADD CONSTRAINT "ConsumoHubla_mentoradaId_fkey" FOREIGN KEY ("mentoradaId") REFERENCES "Mentorada"("id") ON DELETE SET NULL ON UPDATE CASCADE;

