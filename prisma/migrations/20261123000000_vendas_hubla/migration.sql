-- AlterTable
ALTER TABLE "Venda" ADD COLUMN     "hublaFatura" TEXT,
ADD COLUMN     "hublaProduto" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Venda_hublaFatura_key" ON "Venda"("hublaFatura");

-- CreateIndex
CREATE INDEX "Venda_email_idx" ON "Venda"("email");

