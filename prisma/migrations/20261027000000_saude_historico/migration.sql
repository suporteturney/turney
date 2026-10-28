-- CreateTable
CREATE TABLE "SaudeRegistro" (
    "id" TEXT NOT NULL,
    "mentoradaId" TEXT NOT NULL,
    "saude" TEXT NOT NULL,
    "motivo" TEXT,
    "origem" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaudeRegistro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SaudeRegistro_mentoradaId_data_idx" ON "SaudeRegistro"("mentoradaId", "data");

-- CreateIndex
CREATE INDEX "SaudeRegistro_data_idx" ON "SaudeRegistro"("data");

-- AddForeignKey
ALTER TABLE "SaudeRegistro" ADD CONSTRAINT "SaudeRegistro_mentoradaId_fkey" FOREIGN KEY ("mentoradaId") REFERENCES "Mentorada"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Ponto de partida do histórico: a saúde atual de cada mentorada
INSERT INTO "SaudeRegistro" ("id", "mentoradaId", "saude", "motivo", "origem", "data")
SELECT 'ini_' || m."id", m."id", m."saude", m."saudeMotivo", 'inicial', NOW()
FROM "Mentorada" m
WHERE m."saude" IN ('Saudável', 'Atenção', 'Risco');
