import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { urlFoto } from "@/lib/foto";
import TrocarSenha from "@/components/TrocarSenha";
import FotoPerfil from "@/components/FotoPerfil";
import styles from "../shared.module.css";

export default async function ContaPage() {
  const usuario = await exigirUsuario();
  const foto = await prisma.fotoUsuario.findUnique({ where: { usuarioId: usuario.id }, select: { atualizadaEm: true } });
  return (
    <TrocarSenha
      primeiroAcesso={false}
      nome={usuario.nome}
      extra={
        <div className={styles.card} style={{ maxWidth: 440, marginBottom: 16 }}>
          <div className={styles.cardTitle} style={{ marginBottom: 12 }}>Minha foto</div>
          <FotoPerfil usuarioId={usuario.id} nome={usuario.nome} foto={urlFoto(usuario.id, foto)} />
        </div>
      }
    />
  );
}
