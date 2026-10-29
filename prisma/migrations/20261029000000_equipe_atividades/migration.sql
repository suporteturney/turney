-- Níveis de acesso da equipe e registro de atividades
ALTER TABLE "Usuario" ALTER COLUMN "papel" SET DEFAULT 'leitura';
ALTER TABLE "Usuario" ADD COLUMN "permissoes" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Usuario" ADD COLUMN "trocarSenha" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "Atividade" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "usuarioNome" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "mentoradaId" TEXT,
    "resumo" TEXT NOT NULL,
    "detalhe" JSONB,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Atividade_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Atividade_data_idx" ON "Atividade"("data");
CREATE INDEX "Atividade_usuarioId_data_idx" ON "Atividade"("usuarioId", "data");
CREATE INDEX "Atividade_mentoradaId_data_idx" ON "Atividade"("mentoradaId", "data");

ALTER TABLE "Atividade" ADD CONSTRAINT "Atividade_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
