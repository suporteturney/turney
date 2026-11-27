-- CreateTable
CREATE TABLE "Notificacao" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "texto" TEXT,
    "link" TEXT,
    "lidaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notificacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DevolutivaDisc" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT,
    "situacao" TEXT NOT NULL,
    "textoData" TEXT,
    "data" TIMESTAMP(3),
    "perfil" TEXT,
    "lideranca" TEXT,
    "resumo" TEXT,
    "mentoradaId" TEXT,
    "lancadaEm" TIMESTAMP(3),
    "avisadaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DevolutivaDisc_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notificacao_usuarioId_lidaEm_idx" ON "Notificacao"("usuarioId", "lidaEm");

-- CreateIndex
CREATE INDEX "Notificacao_usuarioId_createdAt_idx" ON "Notificacao"("usuarioId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DevolutivaDisc_chave_key" ON "DevolutivaDisc"("chave");

-- CreateIndex
CREATE INDEX "DevolutivaDisc_mentoradaId_idx" ON "DevolutivaDisc"("mentoradaId");

-- AddForeignKey
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevolutivaDisc" ADD CONSTRAINT "DevolutivaDisc_mentoradaId_fkey" FOREIGN KEY ("mentoradaId") REFERENCES "Mentorada"("id") ON DELETE SET NULL ON UPDATE CASCADE;

