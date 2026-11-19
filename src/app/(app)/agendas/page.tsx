import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { pode } from "@/lib/permissoes";
import AgendasCliente from "./AgendasCliente";
import styles from "../shared.module.css";

// De qual agenda é o link, sem mostrar o endereço secreto inteiro.
function resumoLink(url: string) {
  const id = url.match(/calendar\/ical\/([^/]+)\//)?.[1];
  if (id) return decodeURIComponent(id);
  try { return new URL(url).hostname; } catch { return "link guardado"; }
}

export default async function AgendasPage() {
  const usuario = await exigirUsuario();
  if (!pode(usuario, "equipe")) {
    return (
      <div className={styles.content}>
        <div className={styles.card}>Esta área é só para quem administra a equipe.</div>
      </div>
    );
  }
  const [fontes, porAgenda] = await Promise.all([
    prisma.agendaFonte.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.eventoAgenda.groupBy({ by: ["agenda", "tipo"], _count: { _all: true }, where: { inicio: { gte: new Date() } } }),
  ]);
  const vercel = (process.env.AGENDAS_ICS ?? "").split(/\n|;;/).map(l => l.split("|").map(x => x.trim()))
    .filter(p => p.length >= 3 && /^https:\/\//.test(p[2]) && !fontes.some(f => f.url === p[2]))
    .map(p => ({ nome: p[0], agenda: resumoLink(p[2]) }));

  return (
    <AgendasCliente
      fontes={fontes.map(f => ({
        id: f.id, nome: f.nome, email: f.email, agenda: resumoLink(f.url), ativo: f.ativo,
        ultimaLeitura: f.ultimaLeitura?.toISOString() ?? null, ultimoErro: f.ultimoErro, eventos: f.eventos,
        proximos: Object.fromEntries(porAgenda.filter(x => x.agenda === f.nome).map(x => [x.tipo, x._count._all])),
      }))}
      vercel={vercel}
    />
  );
}
