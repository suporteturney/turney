-- CreateTable
CREATE TABLE "Configuracao" (
    "chave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "atualizadaPor" TEXT,
    "atualizadaEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Configuracao_pkey" PRIMARY KEY ("chave")
);

-- CreateTable
CREATE TABLE "EventoHubla" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nome" TEXT,
    "produtoId" TEXT,
    "produto" TEXT,
    "modulo" TEXT,
    "data" TIMESTAMP(3) NOT NULL,
    "mentoradaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoHubla_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventoHubla_chave_key" ON "EventoHubla"("chave");

-- CreateIndex
CREATE INDEX "EventoHubla_mentoradaId_data_idx" ON "EventoHubla"("mentoradaId", "data");

-- CreateIndex
CREATE INDEX "EventoHubla_email_idx" ON "EventoHubla"("email");

-- CreateIndex
CREATE INDEX "EventoHubla_data_idx" ON "EventoHubla"("data");

-- AddForeignKey
ALTER TABLE "EventoHubla" ADD CONSTRAINT "EventoHubla_mentoradaId_fkey" FOREIGN KEY ("mentoradaId") REFERENCES "Mentorada"("id") ON DELETE SET NULL ON UPDATE CASCADE;

