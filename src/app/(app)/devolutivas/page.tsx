import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { pode } from "@/lib/permissoes";
import { configDaPlanilha, statusDaPlanilha } from "@/lib/devolutiva-servidor";
import DevolutivasCliente from "./DevolutivasCliente";
import styles from "../shared.module.css";

export default async function DevolutivasPage() {
  const usuario = await exigirUsuario();
  if (!pode(usuario, "equipe")) {
    return (
      <div className={styles.content}>
        <div className={styles.card}>Esta área é só para quem administra a equipe.</div>
      </div>
    );
  }
  const [conf, status, linhas, equipe] = await Promise.all([
    configDaPlanilha(),
    statusDaPlanilha(),
    prisma.devolutivaDisc.findMany({ orderBy: [{ data: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }], include: { mentorada: { select: { id: true, nome: true } } } }),
    prisma.usuario.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true, papel: true } }),
  ]);
  return (
    <DevolutivasCliente
      ligada={!!conf}
      mentora={conf?.mentora ?? "Natalia"}
      finalId={conf ? conf.id.slice(-4) : null}
      status={status}
      equipe={equipe.map(u => ({ id: u.id, nome: u.nome }))}
      avisar={conf ? (conf.avisar?.length ? conf.avisar : equipe.filter(u => u.papel === "admin").map(u => u.id)) : [usuario.id]}
      linhas={linhas.map(l => ({
        id: l.id, nome: l.nome, email: l.email, situacao: l.situacao, textoData: l.textoData,
        data: l.data?.toISOString().slice(0, 10) ?? null, perfil: l.perfil, lideranca: l.lideranca,
        mentorada: l.mentorada, lancada: !!l.lancadaEm,
      }))}
    />
  );
}
