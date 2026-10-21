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
const ATIVOS_KEY = "__ativos__";
const ATIVOS = ["Ativo", "Em Andamento", "Em Renovação"];
const casaTipo = (tipo: string, filtro: string) => tipo === filtro || tipo.startsWith(`${filtro} `);

export default function RenovacoesCliente({ data }: { data: Linha[] }) {
  const router = useRouter();
  const [linhas, setLinhas] = useState(data);
  const [filtTipo, setFiltTipo] = useState("");
  const [filtStatus, setFiltStatus] = useState(ATIVOS_KEY);
  const [filtMes, setFiltMes] = useState("");
  const [filtAno, setFiltAno] = useState("");
  const [soVencidos, setSoVencidos] = useState(false);
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

  const anos = useMemo(() => {
    const ys = linhas.filter(m => m.prazo).map(m => +m.prazo!.slice(0, 4));
    const atual = new Date().getFullYear();
    const min = Math.min(atual, ...ys);
    const max = Math.max(atual + 1, ...ys);
    return Array.from({ length: max - min + 1 }, (_, i) => String(max - i));
  }, [linhas]);

  const lista = useMemo(
    () =>
      linhas.filter(m => {
        if (filtTipo && !casaTipo(m.tipo, filtTipo)) return false;
        if (filtStatus === ATIVOS_KEY ? !ATIVOS.includes(m.status) : filtStatus && m.status !== filtStatus) return false;
        if (filtAno && m.prazo?.slice(0, 4) !== filtAno) return false;
        if (filtMes && m.prazo?.slice(5, 7) !== filtMes) return false;
        if (soVencidos && (diasRestantes(m.prazo) ?? 0) >= 0) return false;
        return true;
      }),
    [linhas, filtTipo, filtStatus, filtMes, filtAno, soVencidos]
  );

  const temFiltro = !!(filtTipo || filtStatus !== ATIVOS_KEY || filtMes || filtAno || soVencidos);
  const limpar = () => { setFiltTipo(""); setFiltStatus(ATIVOS_KEY); setFiltMes(""); setFiltAno(""); setSoVencidos(false); };
  const periodoTxt = filtMes || filtAno
    ? ` · vencimento em ${filtMes ? MESES[+filtMes - 1].toLowerCase() : "qualquer mês"}${filtAno ? ` de ${filtAno}` : " (todos os anos)"}`
    : "";

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
              <span className={styles.tblTitle}>
                {filtStatus === ATIVOS_KEY ? "Contratos ativos" : filtStatus || "Todos os contratos"}{periodoTxt}
              </span>
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
                <option value={ATIVOS_KEY}>Contratos ativos</option>
                <option value="">Todos os status</option>
                {statusOpts.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select
                className={r.select}
                value={filtMes}
                onChange={e => setFiltMes(e.target.value)}
                aria-label="Filtrar por mês de vencimento"
              >
                <option value="">Todos os meses</option>
                {MESES.map((nome, i) => <option key={nome} value={String(i + 1).padStart(2, "0")}>{nome}</option>)}
              </select>
              <select
                className={r.select}
                value={filtAno}
                onChange={e => setFiltAno(e.target.value)}
                aria-label="Filtrar por ano de vencimento"
              >
                <option value="">Todos os anos</option>
                {anos.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <label className={r.toggle}>
                <input type="checkbox" checked={soVencidos} onChange={e => setSoVencidos(e.target.checked)} />
                Só vencidos
              </label>
              {temFiltro && <button className={r.clear} onClick={limpar}>Limpar</button>}
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
