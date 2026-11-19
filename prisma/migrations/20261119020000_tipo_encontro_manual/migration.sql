-- CreateTable
CREATE TABLE "TipoEncontroManual" (
    "id" TEXT NOT NULL,
    "escopo" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "criadaPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TipoEncontroManual_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TipoEncontroManual_escopo_chave_key" ON "TipoEncontroManual"("escopo", "chave");
