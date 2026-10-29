import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { pode } from "@/lib/permissoes";
import EquipeCliente from "./EquipeCliente";
import styles from "../shared.module.css";

export default async function EquipePage() {
  const usuario = await exigirUsuario();
  if (!pode(usuario, "equipe")) {
    return (
      <div className={styles.content}>
        <div className={styles.card}>Esta área é só para quem administra os acessos da equipe.</div>
      </div>
    );
  }
  const lista = await prisma.usuario.findMany({
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
    select: { id: true, nome: true, email: true, papel: true, permissoes: true, ativo: true, trocarSenha: true, ultimoAcesso: true },
  });
  return (
    <EquipeCliente
      euId={usuario.id}
      inicial={lista.map(u => ({ ...u, ultimoAcesso: u.ultimoAcesso?.toISOString() ?? null }))}
    />
  );
}
