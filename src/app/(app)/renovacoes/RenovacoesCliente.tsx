"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import JornadaModal from "@/components/JornadaModal";
import MentoradaDrawer from "@/components/MentoradaDrawer";
import TextoInline from "@/components/TextoInline";
import StatusRenovacao from "@/components/StatusRenovacao";
import styles from "../shared.module.css";
import r from "./renovacoes.module.css";

type Linha = {
  id: string; nome: string; codigo: string | null; tipo: string; status: string; saude: string | null;
  inicio: string | null; prazo: string | null; negociacao: string | null; negociacaoEm: string | null;
  renovacaoStatus: string | null;
  duracao: number | null;
};

const fmt = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");

function diasRestantes(prazo: string | null): number | null {
  if (!prazo) return null;
  const hoje = new Date();
  const h = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((Date.parse(prazo.slice(0, 10)) - h) / 86400000);
}

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const casaTipo = (tipo: string, filtro: string) => tipo === filtro || tipo.startsWith(`${filtro} `);

export default function RenovacoesCliente({ data }: { data: Linha[] }) {
  const router = useRouter();
  const [linhas, setLinhas] = useState(data);
  const [filtTipo, setFiltTipo] = useState("");
  const [filtStatus, setFiltStatus] = useState("");
  const [filtMes, setFiltMes] = useState("");
  const [jornada, setJornada] = useState<string | null>(null);
  const [cadastro, setCadastro] = useState<string | null>(null);

  const tipos = useMemo(() => {
    const set = [...new Set(linhas.map(m => m.tipo).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    const grupos = [...new Set(set.filter(t => / \d+$/.test(t)).map(t => t.replace(/ \d+$/, "")))];
    return { set, grupos };
  }, [linhas]);

  const statusOpts = useMemo(
    () => [...new Set(linhas.map(m => m.status))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [linhas]
  );

  const periodos = useMemo(() => {
    const porAno = new Map<string, Map<string, number>>();
    for (const m of linhas) {
      if (!m.prazo) continue;
      const ym = m.prazo.slice(0, 7);
      const ano = ym.slice(0, 4);
      if (!porAno.has(ano)) porAno.set(ano, new Map());
      const meses = porAno.get(ano)!;
      meses.set(ym, (meses.get(ym) ?? 0) + 1);
    }
    return [...porAno.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ano, meses]) => ({
        ano,
        total: [...meses.values()].reduce((x, y) => x + y, 0),
        meses: [...meses.entries()].sort(([a], [b]) => a.localeCompare(b)),
      }));
  }, [linhas]);

  const lista = useMemo(() => {
    const casaPeriodo = (prazo: string | null) => {
      if (!filtMes) return true;
      if (!prazo) return false;
      if (filtMes === "vencidos") return (diasRestantes(prazo) ?? 0) < 0;
      if (filtMes.startsWith("ano:")) return prazo.startsWith(filtMes.slice(4));
      return prazo.startsWith(filtMes);
    };
    return linhas.filter(m => (!filtTipo || casaTipo(m.tipo, filtTipo)) && (!filtStatus || m.status === filtStatus) && casaPeriodo(m.prazo));
  },
    [linhas, filtTipo, filtStatus, filtMes]
  );

  const em30 = lista.filter(m => { const d = diasRestantes(m.prazo); return d !== null && d >= 0 && d <= 30; }).length;
  const em60 = lista.filter(m => { const d = diasRestantes(m.prazo); return d !== null && d > 30 && d <= 60; }).length;
  const emRenovacao = lista.filter(m => m.status === "Em Renovação").length;

  const atualizarLinha = (id: string, patch: Partial<Linha>) =>
    setLinhas(ls => ls.map(l => (l.id === id ? { ...l, ...patch } : l)));

  return (
    <>
      <div className={styles.topbar}>
        <div>
          <div className={styles.pageTitle}>Renovações</div>
          <div className={styles.pageSub}>Contratos próximos do vencimento e andamento de cada negociação</div>
        </div>
      </div>
      <div className={styles.content}>
        <div className={`${styles.kpiGrid} ${styles.kpi3}`}>
          <div className={styles.kpi} style={{ "--kpi-color": "#EF4444" } as React.CSSProperties}>
            <div className={styles.kpiLabel}>Vencem em 30 dias</div>
            <div className={styles.kpiValue}>{em30}</div>
            <div className={styles.kpiDelta}>Ação urgente necessária</div>
          </div>
          <div className={styles.kpi} style={{ "--kpi-color": "#F59E0B" } as React.CSSProperties}>
            <div className={styles.kpiLabel}>Vencem em 31–60 dias</div>
            <div className={styles.kpiValue}>{em60}</div>
            <div className={styles.kpiDelta}>Iniciar contato em breve</div>
          </div>
          <div className={styles.kpi} style={{ "--kpi-color": "#73452B" } as React.CSSProperties}>
            <div className={styles.kpiLabel}>Em Renovação</div>
            <div className={styles.kpiValue}>{emRenovacao}</div>
            <div className={styles.kpiDelta}>Em processo de decisão</div>
          </div>
        </div>

        <div className={styles.tblCard}>
          <div className={styles.tblHead}>
            <div className={r.headLeft}>
              <span className={styles.tblTitle}>Contratos ativos com prazo</span>
              <select
                className={r.select}
                value={filtTipo}
                onChange={e => setFiltTipo(e.target.value)}
                aria-label="Filtrar por programa"
              >
                <option value="">Todos os programas</option>
                {tipos.grupos.map(g => <option key={`g-${g}`} value={g}>{g} (todos)</option>)}
                {tipos.set.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select
                className={r.select}
                value={filtStatus}
                onChange={e => setFiltStatus(e.target.value)}
                aria-label="Filtrar por status"
              >
                <option value="">Todos os status</option>
                {statusOpts.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select
                className={r.select}
                value={filtMes}
                onChange={e => setFiltMes(e.target.value)}
                aria-label="Filtrar por mês e ano de vencimento"
              >
                <option value="">Todos os vencimentos</option>
                <option value="vencidos">Já vencidos</option>
                {periodos.map(p => (
                  <optgroup key={p.ano} label={p.ano}>
                    <option value={`ano:${p.ano}`}>{p.ano} inteiro ({p.total})</option>
                    {p.meses.map(([ym, n]) => (
                      <option key={ym} value={ym}>{MESES[+ym.slice(5, 7) - 1]} {p.ano} ({n})</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {(filtTipo || filtStatus || filtMes) && (
                <button className={r.clear} onClick={() => { setFiltTipo(""); setFiltStatus(""); setFiltMes(""); }}>Limpar</button>
              )}
            </div>
            <span className={styles.tblCount}>{lista.length} mentoradas</span>
          </div>
          <div className={styles.tblWrap}>
            <table className={`${styles.table} ${r.table}`}>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Programa</th>
                  <th>Status</th>
                  <th>Saúde</th>
                  <th>Início</th>
                  <th>Prazo</th>
                  <th>Dias restantes</th>
                  <th>Status de renovação</th>
                  <th className={r.thNegoc}>Andamento da negociação</th>
                </tr>
              </thead>
              <tbody>
                {lista.map(m => {
                  const dias = diasRestantes(m.prazo);
                  const urgBg = dias !== null && dias <= 10 ? "#FEE2E2" : dias !== null && dias <= 30 ? "#FEF3C7" : dias !== null && dias <= 60 ? "#D1FAE5" : "transparent";
                  const urgFg = dias !== null && dias <= 10 ? "#991B1B" : dias !== null && dias <= 30 ? "#92400E" : "#065F46";
                  return (
                    <tr key={m.id}>
                      <td>
                        <button className={r.nomeBtn} onClick={() => setJornada(m.id)} title="Ver jornada da mentorada">
                          {m.nome}
                        </button>
                        {m.codigo && <div className={r.cod}>{m.codigo}</div>}
                      </td>
                      <td><span className={`${styles.badge} ${styles.bSilver}`}>{m.tipo}</span></td>
                      <td>
                        <span className={`${styles.badge} ${m.status === "Ativo" ? styles.bAtivo : m.status === "Em Renovação" ? styles.bRenov : styles.bSilver}`}>
                          {m.status}
                        </span>
                      </td>
                      <td>
                        {m.saude ? (
                          <span className={`${styles.badge} ${m.saude === "Saudável" ? styles.bSau : m.saude === "Atenção" ? styles.bAte : styles.bRis}`}>
                            {m.saude}
                          </span>
                        ) : "—"}
                      </td>
                      <td>{fmt(m.inicio)}</td>
                      <td>{fmt(m.prazo)}</td>
                      <td>
                        {dias !== null ? (
                          <span style={{ background: urgBg, color: dias <= 60 ? urgFg : "var(--txt2)", padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                            {dias <= 0 ? "Vencido" : `${dias}d`}
                          </span>
                        ) : "—"}
                      </td>
                      <td>
                        <StatusRenovacao
                          mentorada={m}
                          valor={m.renovacaoStatus}
                          onSalvo={renovacaoStatus => atualizarLinha(m.id, { renovacaoStatus })}
                          onRenovado={r => {
                            atualizarLinha(m.id, { status: r.status, tipo: r.tipo, prazo: r.prazo, duracao: r.duracao, renovacaoStatus: r.renovacaoStatus });
                            router.refresh();
                          }}
                        />
                      </td>
                      <td className={r.tdNegoc}>
                        <TextoInline
                          mentoradaId={m.id}
                          campo="negociacao"
                          valor={m.negociacao}
                          atualizadoEm={m.negociacaoEm}
                          placeholder="Escreva como está a negociação…"
                          ariaLabel={`Andamento da negociação de ${m.nome}`}
                          onSalvo={(negociacao, negociacaoEm) => atualizarLinha(m.id, { negociacao, negociacaoEm })}
                        />
                      </td>
                    </tr>
                  );
                })}
                {lista.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", color: "var(--txt3)", padding: 24 }}>
                      Nenhum contrato com esses filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {jornada && (
        <JornadaModal
          key={jornada}
          id={jornada}
          onClose={() => setJornada(null)}
          onAbrirCadastro={() => { setCadastro(jornada); setJornada(null); }}
        />
      )}
      {cadastro && (
        <MentoradaDrawer
          key={cadastro}
          id={cadastro}
          onClose={() => setCadastro(null)}
          onChanged={() => router.refresh()}
        />
      )}
    </>
  );
}
