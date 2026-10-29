import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { pode } from "@/lib/permissoes";
import styles from "../shared.module.css";
import f from "../filtros.module.css";
import a from "./atividades.module.css";

const ENTIDADES: Record<string, string> = {
  mentorada: "Cadastro", etapa: "Jornada", presenca: "Presença", acompanhamento: "Acompanhamento",
  observacao: "Observação", renovacao: "Renovação", varredura: "Varredura", usuario: "Acessos", sessao: "Entrada e saída",
};
const ACOES: Record<string, string> = {
  criou: "Criou", editou: "Alterou", excluiu: "Excluiu", importou: "Importou", entrou: "Entrou", saiu: "Saiu",
};
const LIMITE = 300;

type Filtros = { pessoa?: string; tipo?: string; acao?: string; de?: string; ate?: string; q?: string };

export default async function AtividadesPage({ searchParams }: { searchParams: Promise<Filtros> }) {
  const usuario = await exigirUsuario();
  if (!pode(usuario, "equipe")) {
    return (
      <div className={styles.content}>
        <div className={styles.card}>O registro de atividades é visível só para quem administra a equipe.</div>
      </div>
    );
  }
  const fl = await searchParams;
  const dia = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined);
  const de = dia(fl.de), ate = dia(fl.ate);

  const [pessoas, itens] = await Promise.all([
    prisma.usuario.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    prisma.atividade.findMany({
      where: {
        ...(fl.pessoa ? { usuarioId: fl.pessoa } : {}),
        ...(fl.tipo ? { entidade: fl.tipo } : {}),
        ...(fl.acao ? { acao: fl.acao } : {}),
        ...(fl.q ? { resumo: { contains: fl.q, mode: "insensitive" as const } } : {}),
        ...(de || ate ? { data: { ...(de ? { gte: new Date(`${de}T00:00:00-03:00`) } : {}), ...(ate ? { lte: new Date(`${ate}T23:59:59-03:00`) } : {}) } } : {}),
      },
      orderBy: { data: "desc" },
      take: LIMITE,
    }),
  ]);
  const filtrando = Object.values(fl).some(Boolean);

  return (
    <>
      <div className={styles.topbar}>
        <div>
          <div className={styles.pageTitle}>Atividades</div>
          <div className={styles.pageSub}>Registro de quem fez o quê na plataforma</div>
        </div>
      </div>
      <div className={styles.content}>
        <form className={f.bar} method="get">
          <select className={f.select} name="pessoa" defaultValue={fl.pessoa ?? ""} aria-label="Pessoa">
            <option value="">Todas as pessoas</option>
            {pessoas.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
          <select className={f.select} name="tipo" defaultValue={fl.tipo ?? ""} aria-label="Área">
            <option value="">Todas as áreas</option>
            {Object.entries(ENTIDADES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className={f.select} name="acao" defaultValue={fl.acao ?? ""} aria-label="Ação">
            <option value="">Todas as ações</option>
            {Object.entries(ACOES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input className={f.select} type="date" name="de" defaultValue={de ?? ""} aria-label="De" />
          <input className={f.select} type="date" name="ate" defaultValue={ate ?? ""} aria-label="Até" />
          <input className={f.select} name="q" defaultValue={fl.q ?? ""} placeholder="Nome da mentorada ou palavra" aria-label="Buscar" />
          <button className={a.btn} type="submit">Filtrar</button>
          {filtrando && <Link className={f.clear} href="/atividades">Limpar</Link>}
          <span className={f.count}>{itens.length === LIMITE ? `últimas ${LIMITE}` : `${itens.length} atividades`}</span>
        </form>

        <div className={styles.tblCard}>
          <div className={styles.tblWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Quando</th><th>Quem</th><th>Ação</th><th>O que aconteceu</th></tr>
              </thead>
              <tbody>
                {itens.map(i => {
                  const det = i.detalhe as Record<string, unknown> | null;
                  return (
                    <tr key={i.id}>
                      <td className={a.quando}>{i.data.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                      <td className={a.quem}>{i.usuarioNome}</td>
                      <td><span className={`${a.acao} ${a[`a_${i.acao}`] ?? ""}`}>{ACOES[i.acao] ?? i.acao}</span><div className={a.area}>{ENTIDADES[i.entidade] ?? i.entidade}</div></td>
                      <td>
                        {i.resumo}
                        {det && Object.keys(det).length > 0 && (
                          <details className={a.det}>
                            <summary>Detalhes</summary>
                            <ul>
                              {Object.entries(det).map(([k, v]) => (
                                <li key={k}>
                                  <b>{k}</b>:{" "}
                                  {v && typeof v === "object" && "de" in v && "para" in v
                                    ? `${(v as { de: string }).de} → ${(v as { para: string }).para}`
                                    : typeof v === "object" ? JSON.stringify(v) : String(v)}
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!itens.length && (
                  <tr><td colSpan={4} className={a.vazio}>Nenhuma atividade {filtrando ? "com esses filtros" : "registrada ainda"}.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
