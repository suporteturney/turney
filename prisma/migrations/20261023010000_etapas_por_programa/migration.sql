-- Etapas passam a pertencer ao programa da jornada (upgrade inicia uma jornada nova)
ALTER TABLE "Etapa" ADD COLUMN "programa" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Renovacao" ADD COLUMN "programaAnterior" TEXT;

UPDATE "Etapa" e SET "programa" = COALESCE(m."tipo", '')
FROM "Mentorada" m WHERE m."id" = e."mentoradaId";

-- Programa anterior de quem mudou de programa (upgrade/downgrade/cross para o programa atual)
WITH ultima AS (
  SELECT DISTINCT ON (r."mentoradaId") r."id", r."mentoradaId", r."data"
  FROM "Renovacao" r JOIN "Mentorada" m ON m."id" = r."mentoradaId"
  WHERE r."acao" IN ('UPGRADE', 'DOWNGRADE', 'CROSS') AND r."destino" = m."tipo"
  ORDER BY r."mentoradaId", r."data" DESC
), anterior AS (
  SELECT u."id", u."mentoradaId", u."data",
    CASE
      WHEN m."produtoAnterior" ~* '^nexus\s*[123]$' THEN initcap(lower(m."produtoAnterior"))
      WHEN m."produtoAnterior" IS NOT NULL AND btrim(m."produtoAnterior") NOT IN ('', '-', '.') THEN m."produtoAnterior"
      WHEN m."codigo" LIKE 'NX%' THEN 'Nexus'
      ELSE 'Programa anterior'
    END AS "programa"
  FROM ultima u JOIN "Mentorada" m ON m."id" = u."mentoradaId"
)
UPDATE "Etapa" e SET "programa" = a."programa"
FROM anterior a
WHERE e."mentoradaId" = a."mentoradaId" AND e."data" < a."data";

UPDATE "Renovacao" r SET "programaAnterior" = a."programa"
FROM (
  SELECT DISTINCT ON (r2."mentoradaId") r2."id",
    CASE
      WHEN m."produtoAnterior" ~* '^nexus\s*[123]$' THEN initcap(lower(m."produtoAnterior"))
      WHEN m."produtoAnterior" IS NOT NULL AND btrim(m."produtoAnterior") NOT IN ('', '-', '.') THEN m."produtoAnterior"
      WHEN m."codigo" LIKE 'NX%' THEN 'Nexus'
      ELSE NULL
    END AS "programa"
  FROM "Renovacao" r2 JOIN "Mentorada" m ON m."id" = r2."mentoradaId"
  WHERE r2."acao" IN ('UPGRADE', 'DOWNGRADE', 'CROSS') AND r2."destino" = m."tipo"
  ORDER BY r2."mentoradaId", r2."data" DESC
) a
WHERE r."id" = a."id";

DROP INDEX "Etapa_mentoradaId_nome_key";
CREATE UNIQUE INDEX "Etapa_mentoradaId_programa_nome_key" ON "Etapa"("mentoradaId", "programa", "nome");
