-- CreateTable
CREATE TABLE "AgendaFonte" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT,
    "url" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultimaLeitura" TIMESTAMP(3),
    "ultimoErro" TEXT,
    "eventos" INTEGER,
    "criadaPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgendaFonte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoAgenda" (
    "id" TEXT NOT NULL,
    "agenda" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3),
    "tipo" TEXT NOT NULL,
    "link" TEXT,
    "convidados" INTEGER NOT NULL DEFAULT 0,
    "mentoradaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoAgenda_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventoAgenda_inicio_idx" ON "EventoAgenda"("inicio");

-- CreateIndex
CREATE INDEX "EventoAgenda_agenda_inicio_idx" ON "EventoAgenda"("agenda", "inicio");

-- AddForeignKey
ALTER TABLE "EventoAgenda" ADD CONSTRAINT "EventoAgenda_mentoradaId_fkey" FOREIGN KEY ("mentoradaId") REFERENCES "Mentorada"("id") ON DELETE SET NULL ON UPDATE CASCADE;

