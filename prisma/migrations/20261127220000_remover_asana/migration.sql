-- A Turney não usa mais o Asana (pedido da Eduarda em 27/11/2026).
-- Os 9 links que existiam foram copiados para fora do sistema antes desta migração.
-- O histórico do Acompanhamento importado do Asana fica; só perde o nome "Asana".
UPDATE "Acompanhamento" SET "tipo" = 'Registro' WHERE "tipo" = 'Registro do Asana';

-- AlterTable
ALTER TABLE "Mentorada" DROP COLUMN "asana";
