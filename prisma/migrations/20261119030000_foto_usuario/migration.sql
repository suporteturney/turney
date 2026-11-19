-- CreateTable
CREATE TABLE "FotoUsuario" (
    "usuarioId" TEXT NOT NULL,
    "dados" BYTEA NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'image/jpeg',
    "atualizadaEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotoUsuario_pkey" PRIMARY KEY ("usuarioId")
);

-- AddForeignKey
ALTER TABLE "FotoUsuario" ADD CONSTRAINT "FotoUsuario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
