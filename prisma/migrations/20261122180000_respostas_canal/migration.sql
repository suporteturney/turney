-- AlterTable
ALTER TABLE "RespostaFormulario" ADD COLUMN     "canal" TEXT;

-- CreateIndex
CREATE INDEX "RespostaFormulario_preenchidoEm_idx" ON "RespostaFormulario"("preenchidoEm");

-- Preenche o canal das respostas que já existiam
UPDATE "RespostaFormulario" r SET "canal" = LEFT((
  SELECT x->>'r' FROM jsonb_array_elements(r."respostas") x
  WHERE translate(lower(x->>'p'), 'áàâãéêíóôõúç', 'aaaaeeiooouc') ~ '(nos conheceu|chegou ate esse formulario)'
  LIMIT 1), 80)
WHERE jsonb_typeof(r."respostas") = 'array';
