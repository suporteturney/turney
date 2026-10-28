"use client";
import { useMemo, useState } from "react";
import JornadaModal from "@/components/JornadaModal";
import TextoInline from "@/components/TextoInline";
import styles from "../shared.module.css";
import f from "../filtros.module.css";
import s from "./saude.module.css";

type Linha = {
  id: string; nome: string; codigo: string | null; tipo: string; status: string; saude: string | null;
  saudeMotivo: string | null; saudeMotivoEm: string | null; inicio: string | null; prazo: string | null;
  onboarding: string | null; inicioCiclo: string | null; ultimoAcomp: string | null; presTotal: number; presOk: number;
  cancelamento: string | null; registros: { saude: string; data: string; motivo: string | null }[];
};

const ATIVOS = ["Ativo", "Em Andamento", "Em Renovação"];
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const ymDe = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const labelYm = (ym: string) => `${MESES[+ym.slice(5, 7) - 1].toLowerCase()} ${ym.slice(0, 4)}`;
function deslocar(ym: string, n: number) {
  const [y, m] = ym.split("-").map(Number);
  return ymDe(new Date(y, m - 1 + n, 1));
}
const inicioDoMes = (ym: string) => `${ym}-01`;
const fimDoMes = (ym: string) => { const [y, m] = ym.split("-").map(Number); return `${ym}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}T23:59:59.999Z`; };

type Estado = { ativa: boolean; saude: string | null; motivo: string | null };
function estadoNoMes(m: Linha, ym: string, atual: string): Estado {
  if (ym === atual) return { ativa: ATIVOS.includes(m.status), saude: m.saude, motivo: m.saudeMotivo };
  const ini = inicioDoMes(ym), fim = fimDoMes(ym);
  const ativa = !!m.inicio && m.inicio <= fim && (!m.prazo || m.prazo.slice(0, 10) >= ini) && (!m.cancelamento || m.cancelamento.slice(0, 10) >= ini);
  let reg: Linha["registros"][number] | null = null;
  for (const r of m.registros) { if (r.data <= fim) reg = r; else break; }
  return { ativa, saude: reg?.saude ?? null, motivo: reg?.motivo ?? null };
}
const FASES = [
  { k: "f1", label: "1º–2º mês", de: 0, ate: 2 },
  { k: "f2", label: "3º–4º mês", de: 2, ate: 4 },
  { k: "f3", label: "5º–6º mês", de: 4, ate: 6 },
  { k: "f4", label: "7º mês em diante", de: 6, ate: 999 },
];
function mesesDeMentoria(m: Linha, ym: string) {
  const ini = m.inicioCiclo && m.inicioCiclo.slice(0, 7) <= ym ? m.inicioCiclo : m.inicio;
  if (!ini) return null;
  const [y1, m1] = ini.slice(0, 7).split("-").map(Number);
  const [y2, m2] = ym.split("-").map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
}

type Nivel = "Saudável" | "Atenção" | "Risco" | "sem";
const NIVEIS: { k: Nivel; label: string; cor: string }[] = [
  { k: "Saudável", label: "Saudável", cor: "#10B981" },
  { k: "Atenção", label: "Atenção", cor: "#F59E0B" },
  { k: "Risco", label: "Risco", cor: "#EF4444" },
  { k: "sem", label: "Sem classificação", cor: "#CBD5E1" },
];
const ORDEM_NIVEL: Record<Nivel, number> = { Risco: 0, Atenção: 1, sem: 2, Saudável: 3 };

const nivel = (m: Linha): Nivel =>
  m.saude === "Saudável" || m.saude === "Atenção" || m.saude === "Risco" ? m.saude : "sem";
const casaTipo = (tipo: string, filtro: string) => tipo === filtro || tipo.startsWith(`${filtro} `);
const fmt = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");

function hojeUTC() {
  const h = new Date();
  return Date.UTC(h.getFullYear(), h.getMonth(), h.getDate());
}
const diasDesde = (iso: string) => Math.round((hojeUTC() - Date.parse(iso.slice(0, 10))) / 86400000);

type Sinal = { texto: string; tom: "danger" | "warn" | "info" };

function sinais(m: Linha): Sinal[] {
  const out: Sinal[] = [];
  if (!m.ultimoAcomp) out.push({ texto: "Sem acompanhamento registrado", tom: "info" });
  else {
    const d = diasDesde(m.ultimoAcomp);
    if (d > 14) out.push({ texto: `Último contato há ${d}d`, tom: d > 30 ? "danger" : "warn" });
  }
  if (m.presTotal > 0) {
    const p = Math.round((m.presOk / m.presTotal) * 100);
    if (p < 70) out.push({ texto: `Presença ${p}% (${m.presTotal - m.presOk} faltas)`, tom: p < 50 ? "danger" : "warn" });
  }
  if (m.prazo) {
    const d = -diasDesde(m.prazo);
    if (d < 0) out.push({ texto: "Contrato vencido", tom: "danger" });
    else if (d <= 30) out.push({ texto: `Contrato vence em ${d}d`, tom: "warn" });
  }
  if (!m.onboarding && m.inicioCiclo && diasDesde(m.inicioCiclo) > 7) {
    out.push({ texto: `Onboarding pendente (${diasDesde(m.inicioCiclo)}d de programa)`, tom: "warn" });
  }
  return out;
}

function indice(c: Record<Nivel, number>) {
  const classif = c.Saudável + c.Atenção + c.Risco;
  return classif ? Math.round(((c.Saudável + c.Atenção * 0.5) / classif) * 100) : null;
}
const corIndice = (i: number | null) => (i === null ? "var(--txt3)" : i >= 85 ? "#10B981" : i >= 65 ? "#F59E0B" : "#EF4444");

function contar(lista: Linha[]): Record<Nivel, number> {
  const c: Record<Nivel, number> = { Saudável: 0, Atenção: 0, Risco: 0, sem: 0 };
  for (const m of lista) c[nivel(m)]++;
  return c;
}

function Anel({ c, size, espessura, children }: { c: Record<Nivel, number>; size: number; espessura: number; children?: React.ReactNode }) {
  const total = c.Saudável + c.Atenção + c.Risco + c.sem;
  const r = (size - espessura) / 2;
  const circ = 2 * Math.PI * r;
  const gap = total > 1 ? 2.5 : 0;
  let acc = 0;
  return (
    <div className={s.anel} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F0EAE0" strokeWidth={espessura} />
        {total > 0 && NIVEIS.map(n => {
          const len = (c[n.k] / total) * circ;
          if (len <= 0) return null;
          const seg = (
            <circle
              key={n.k}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={n.cor}
              strokeWidth={espessura}
              strokeLinecap="butt"
              strokeDasharray={`${Math.max(len - gap, 0.5)} ${circ}`}
              strokeDashoffset={-acc}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              className={s.seg}
            />
          );
          acc += len;
          return seg;
        })}
      </svg>
      <div className={s.anelCentro}>{children}</div>
    </div>
  );
}

export default function SaudeCliente({ data }: { data: Linha[] }) {
  const atual = ymDe(new Date());
  const [linhas, setLinhas] = useState(data);
  const [filtTipo, setFiltTipo] = useState("");
  const [filtNivel, setFiltNivel] = useState<Nivel | "">("");
  const [aberta, setAberta] = useState<string | null>(null);
  const [mes, setMes] = useState(atual.slice(5, 7));
  const [ano, setAno] = useState(atual.slice(0, 4));
  const ref = `${ano}-${mes}`;
  const [comparar, setComparar] = useState(deslocar(atual, -1));
  const ehAtual = ref === atual;

  const inicioHistorico = useMemo(() => {
    let min: string | null = null;
    for (const m of linhas) for (const r of m.registros) if (!min || r.data < min) min = r.data;
    return min ? min.slice(0, 7) : atual;
  }, [linhas, atual]);
  const anos = useMemo(() => {
    const ys = linhas.filter(m => m.inicio).map(m => +m.inicio!.slice(0, 4));
    const max = +atual.slice(0, 4);
    const min = Math.min(max, ...ys);
    return Array.from({ length: max - min + 1 }, (_, i) => String(max - i));
  }, [linhas, atual]);
  const mesesComparar = useMemo(() => Array.from({ length: 24 }, (_, i) => deslocar(atual, -i)), [atual]);

  const naReferencia = useMemo(() => (ym: string) =>
    linhas.flatMap(m => {
      const e = estadoNoMes(m, ym, atual);
      return e.ativa ? [{ ...m, saude: e.saude, saudeMotivo: ehAtual && ym === atual ? m.saudeMotivo : e.motivo }] : [];
    }), [linhas, atual, ehAtual]);
  const linhasRef = useMemo(() => naReferencia(ref), [naReferencia, ref]);

  const porPrograma = useMemo(() => {
    const progs = [...new Set(linhasRef.map(m => m.tipo || "Sem programa"))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    return progs.map(prog => {
      const ms = linhasRef.filter(m => (m.tipo || "Sem programa") === prog);
      const c = contar(ms);
      return { prog, total: ms.length, c, idx: indice(c) };
    }).sort((a, b) => b.total - a.total);
  }, [linhasRef]);

  const doPrograma = useMemo(
    () => (filtTipo ? linhasRef.filter(m => casaTipo(m.tipo || "Sem programa", filtTipo)) : linhasRef),
    [linhasRef, filtTipo]
  );
  const cont = contar(doPrograma);
  const idxGeral = indice(cont);

  const lista = useMemo(
    () =>
      doPrograma
        .filter(m => !filtNivel || nivel(m) === filtNivel)
        .sort((a, b) => ORDEM_NIVEL[nivel(a)] - ORDEM_NIVEL[nivel(b)] || a.nome.localeCompare(b.nome, "pt-BR")),
    [doPrograma, filtNivel]
  );

  const tipos = useMemo(() => {
    const set = [...new Set(linhas.map(m => m.tipo).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    const grupos = [...new Set(set.filter(t => / \d+$/.test(t)).map(t => t.replace(/ \d+$/, "")))];
    return { set, grupos };
  }, [linhas]);

  const pct = (n: number) => (doPrograma.length ? Math.round((n / doPrograma.length) * 100) : 0);

  const comp = useMemo(() => {
    const doProg = (xs: Linha[]) => (filtTipo ? xs.filter(m => casaTipo(m.tipo || "Sem programa", filtTipo)) : xs);
    const a = doProg(linhasRef);
    const b = doProg(naReferencia(comparar));
    const ca = contar(a), cb = contar(b);
    const mapB = new Map(b.map(m => [m.id, nivel(m)]));
    const peso: Record<Nivel, number> = { Risco: 0, Atenção: 1, Saudável: 2, sem: -1 };
    const melhoraram: Linha[] = [], pioraram: Linha[] = [];
    for (const m of a) {
      const na = nivel(m), nb = mapB.get(m.id);
      if (!nb || na === "sem" || nb === "sem") continue;
      if (peso[na] > peso[nb]) melhoraram.push(m);
      if (peso[na] < peso[nb]) pioraram.push(m);
    }
    const progs = [...new Set([...a, ...b].map(m => m.tipo || "Sem programa"))].sort((x, y) => x.localeCompare(y, "pt-BR"));
    const porProg = progs.map(p => {
      const xa = contar(a.filter(m => (m.tipo || "Sem programa") === p));
      const xb = contar(b.filter(m => (m.tipo || "Sem programa") === p));
      return { p, ia: indice(xa), ib: indice(xb), ra: xa.Risco, rb: xb.Risco, na: a.filter(m => (m.tipo || "Sem programa") === p).length };
    }).filter(x => x.na > 0);
    const fases = FASES.map(fz => {
      const xs = a.filter(m => { const n = mesesDeMentoria(m, ref); return n !== null && n >= fz.de && n < fz.ate; });
      const c = contar(xs);
      const classif = c.Saudável + c.Atenção + c.Risco;
      return { ...fz, total: xs.length, c, idx: indice(c), risco: classif ? Math.round(((c.Risco + c.Atenção) / classif) * 100) : null };
    });
    const pior = fases.filter(x => x.risco !== null && x.total >= 3).sort((x, y) => (y.risco ?? 0) - (x.risco ?? 0))[0] ?? null;
    const evolucao = Array.from({ length: 12 }, (_, i) => deslocar(ref, i - 11))
      .filter(ym => ym >= inicioHistorico && ym <= atual)
      .map(ym => ({ ym, idx: indice(contar(doProg(naReferencia(ym)))) }));
    return { ca, cb, ia: indice(ca), ib: indice(cb), melhoraram, pioraram, porProg, fases, pior, evolucao };
  }, [linhasRef, naReferencia, comparar, filtTipo, ref, inicioHistorico, atual]);
  const toggleNivel = (k: Nivel) => setFiltNivel(v => (v === k ? "" : k));

  return (
    <>
      <div className={styles.topbar}>
        <div>
          <div className={styles.pageTitle}>Saúde da Base</div>
          <div className={styles.pageSub}>Contratos ativos por nível de risco — e o motivo de cada um</div>
        </div>
      </div>
      <div className={styles.content}>
        <div className={f.bar}>
          <select className={f.select} value={filtTipo} onChange={e => setFiltTipo(e.target.value)} aria-label="Filtrar por programa">
            <option value="">Todos os programas</option>
            {tipos.grupos.map(g => <option key={`g-${g}`} value={g}>{g} (todos)</option>)}
            {tipos.set.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className={f.select} value={mes} onChange={e => setMes(e.target.value)} aria-label="Mês">
            {MESES.map((nome, i) => <option key={nome} value={String(i + 1).padStart(2, "0")}>{nome}</option>)}
          </select>
          <select className={f.select} value={ano} onChange={e => setAno(e.target.value)} aria-label="Ano">
            {anos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <label className={s.cmpLabel}>
            comparar com
            <select className={f.select} value={comparar} onChange={e => setComparar(e.target.value)} aria-label="Comparar com o mês">
              {mesesComparar.filter(m => m !== ref).map(m => <option key={m} value={m}>{labelYm(m)}</option>)}
            </select>
          </label>
          {(filtTipo || filtNivel || !ehAtual) && (
            <button className={f.clear} onClick={() => { setFiltTipo(""); setFiltNivel(""); setMes(atual.slice(5, 7)); setAno(atual.slice(0, 4)); }}>Limpar filtros</button>
          )}
          <span className={f.count}>{doPrograma.length} contratos ativos em {labelYm(ref)}</span>
        </div>

        {ref > atual && <div className={s.avisoHist}>Esse mês ainda não chegou — mostrando quem terá contrato ativo, sem classificação de saúde.</div>}
        {ref < inicioHistorico && (
          <div className={s.avisoHist}>
            O histórico de saúde começou em {labelYm(inicioHistorico)}. Para {labelYm(ref)} aparecem as mentoradas que estavam ativas, mas sem a classificação daquele mês.
            A partir de agora, cada mudança (no cadastro ou pela varredura semanal) fica guardada.
          </div>
        )}

        <div className={s.kpis}>
          {NIVEIS.filter(n => n.k !== "sem" || cont.sem > 0).map(n => (
            <button
              key={n.k}
              className={`${s.kpi} ${filtNivel === n.k ? s.kpiOn : ""}`}
              style={{ "--c": n.cor } as React.CSSProperties}
              onClick={() => toggleNivel(n.k)}
              aria-pressed={filtNivel === n.k}
            >
              <span className={s.kpiLabel}><i />{n.label}</span>
              <span className={s.kpiValue}>{cont[n.k]}</span>
              <span className={s.kpiSub}>{pct(cont[n.k])}% da base{filtNivel === n.k ? " · filtrando" : ""}</span>
            </button>
          ))}
        </div>

        <div className={s.grid}>
          <div className={styles.card}>
            <div className={s.cardHead}>
              <div>
                <div className={styles.cardTitle}>Saúde por programa</div>
                <div className={styles.cardSub} style={{ marginBottom: 0 }}>Índice = saudáveis + metade das em atenção, sobre as classificadas</div>
              </div>
              <div className={s.legend}>
                {NIVEIS.slice(0, 3).map(n => <span key={n.k}><i style={{ background: n.cor }} />{n.label}</span>)}
              </div>
            </div>
            <div className={s.progGrid}>
              {porPrograma.map(p => (
                <button
                  key={p.prog}
                  className={`${s.prog} ${filtTipo === p.prog ? s.progOn : ""}`}
                  onClick={() => setFiltTipo(v => (v === p.prog ? "" : p.prog))}
                  aria-pressed={filtTipo === p.prog}
                  title={`Filtrar por ${p.prog}`}
                >
                  <Anel c={p.c} size={76} espessura={8}>
                    <strong style={{ color: corIndice(p.idx) }}>{p.idx ?? "—"}</strong>
                    <small>índice</small>
                  </Anel>
                  <div className={s.progInfo}>
                    <div className={s.progNome}>{p.prog}</div>
                    <div className={s.progTotal}>{p.total} ativo{p.total !== 1 ? "s" : ""}</div>
                    <div className={s.progBars}>
                      {NIVEIS.slice(0, 3).map(n => (
                        <div key={n.k} className={s.progRow}>
                          <span className={s.progDot} style={{ background: n.cor }} />
                          <span className={s.progTrack}><b style={{ width: `${p.total ? (p.c[n.k] / p.total) * 100 : 0}%`, background: n.cor }} /></span>
                          <span className={s.progN}>{p.c[n.k]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className={`${styles.card} ${s.geral}`}>
            <div className={styles.cardTitle}>Índice geral{filtTipo ? ` · ${filtTipo}` : ""}</div>
            <div className={styles.cardSub}>Distribuição dos contratos ativos</div>
            <div className={s.geralAnel}>
              <Anel c={cont} size={168} espessura={14}>
                <strong className={s.geralNum} style={{ color: corIndice(idxGeral) }}>{idxGeral ?? "—"}</strong>
                <small>de 100</small>
              </Anel>
            </div>
            <div className={s.geralLegend}>
              {NIVEIS.filter(n => n.k !== "sem" || cont.sem > 0).map(n => (
                <div key={n.k}>
                  <i style={{ background: n.cor }} />
                  <span>{n.label}</span>
                  <strong>{cont[n.k]}</strong>
                  <em>{pct(cont[n.k])}%</em>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <div className={s.cardHead}>
            <div>
              <div className={styles.cardTitle}>Comparativos — {labelYm(ref)} × {labelYm(comparar)}{filtTipo ? ` · ${filtTipo}` : ""}</div>
              <div className={styles.cardSub} style={{ marginBottom: 0 }}>Como a saúde mudou no tempo, por programa e por fase da mentoria</div>
            </div>
          </div>

          <div className={s.cmpTop}>
            <div className={s.cmpIdx}>
              <span>Índice</span>
              <strong style={{ color: corIndice(comp.ia) }}>{comp.ia ?? "—"}</strong>
              <Delta a={comp.ia} b={comp.ib} maiorMelhor sufixo=" pts" />
            </div>
            {NIVEIS.slice(0, 3).map(n => (
              <div key={n.k} className={s.cmpIdx}>
                <span><i style={{ background: n.cor }} />{n.label}</span>
                <strong>{comp.ca[n.k]}</strong>
                <Delta a={comp.ca[n.k]} b={comp.cb[n.k]} maiorMelhor={n.k === "Saudável"} />
              </div>
            ))}
          </div>

          <div className={s.cmpGrid}>
            <div className={s.cmpBloco}>
              <h4>Mudaram de condição</h4>
              {comp.melhoraram.length + comp.pioraram.length === 0 ? (
                <p className={s.cmpVazio}>Ninguém mudou de condição entre os dois meses{ref < inicioHistorico || comparar < inicioHistorico ? " (ou ainda não há histórico para comparar)" : ""}.</p>
              ) : (
                <>
                  {comp.melhoraram.length > 0 && (
                    <div className={s.cmpPessoas}>
                      <em className={s.up}>↑ {comp.melhoraram.length} melhoraram</em>
                      {comp.melhoraram.map(m => <button key={m.id} onClick={() => setAberta(m.id)}>{m.nome}</button>)}
                    </div>
                  )}
                  {comp.pioraram.length > 0 && (
                    <div className={s.cmpPessoas}>
                      <em className={s.down}>↓ {comp.pioraram.length} pioraram</em>
                      {comp.pioraram.map(m => <button key={m.id} onClick={() => setAberta(m.id)}>{m.nome}</button>)}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className={s.cmpBloco}>
              <h4>Por programa</h4>
              <table className={s.cmpTabela}>
                <thead><tr><th>Programa</th><th>Índice</th><th>vs {labelYm(comparar).split(" ")[0]}</th><th>Em risco</th></tr></thead>
                <tbody>
                  {comp.porProg.map(x => (
                    <tr key={x.p}>
                      <td>{x.p}</td>
                      <td style={{ color: corIndice(x.ia), fontWeight: 800 }}>{x.ia ?? "—"}</td>
                      <td><Delta a={x.ia} b={x.ib} maiorMelhor /></td>
                      <td>{x.ra}{x.rb !== x.ra && <small> (era {x.rb})</small>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={s.cmpBloco}>
              <h4>Por tempo de mentoria</h4>
              {comp.fases.map(fz => (
                <div key={fz.k} className={s.faseRow}>
                  <span className={s.faseLabel}>{fz.label}<small>{fz.total} mentoradas</small></span>
                  <span className={s.faseBar}>
                    {NIVEIS.slice(0, 3).map(n => (
                      <b key={n.k} style={{ width: `${fz.total ? (fz.c[n.k] / fz.total) * 100 : 0}%`, background: n.cor }} />
                    ))}
                  </span>
                  <span className={s.faseIdx} style={{ color: corIndice(fz.idx) }}>{fz.idx ?? "—"}</span>
                </div>
              ))}
              {comp.pior && comp.pior.risco! > 0 && (
                <p className={s.cmpInsight}>
                  A atenção e o risco se concentram no <strong>{comp.pior.label.toLowerCase()}</strong> ({comp.pior.risco}% das classificadas). Vale reforçar o acompanhamento nessa fase.
                </p>
              )}
            </div>

            <div className={s.cmpBloco}>
              <h4>Evolução do índice</h4>
              {comp.evolucao.length < 2 ? (
                <p className={s.cmpVazio}>A linha aparece a partir do segundo mês de histórico ({labelYm(deslocar(inicioHistorico, 1))}). Cada atualização de saúde e cada varredura alimentam este gráfico.</p>
              ) : (
                <Evolucao pontos={comp.evolucao} />
              )}
            </div>
          </div>
        </div>

        <div className={styles.tblCard}>
          <div className={styles.tblHead}>
            <span className={styles.tblTitle}>
              {filtNivel ? (filtNivel === "sem" ? "Sem classificação" : filtNivel) : "Todos os ativos"} · por que estão nessa condição
            </span>
            <span className={styles.tblCount}>{lista.length} mentoradas · risco primeiro</span>
          </div>
          <div className={styles.tblWrap}>
            <table className={`${styles.table} ${s.table}`}>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Programa</th>
                  <th>Saúde</th>
                  <th>Status</th>
                  <th>Prazo</th>
                  <th className={s.thMotivo}>Por que está nessa condição</th>
                </tr>
              </thead>
              <tbody>
                {lista.map(m => {
                  const n = nivel(m);
                  const sg = ehAtual ? sinais(m) : [];
                  return (
                    <tr key={m.id} className={n === "Risco" ? s.rowRisco : n === "Atenção" ? s.rowAtencao : undefined}>
                      <td>
                        <button className={f.nomeBtn} onClick={() => setAberta(m.id)}>{m.nome}</button>
                        {m.codigo && <div className={f.cod}>{m.codigo}</div>}
                      </td>
                      <td><span className={`${styles.badge} ${styles.bSilver}`}>{m.tipo || "—"}</span></td>
                      <td>
                        {n === "sem" ? <span className={f.pend}>—</span> : (
                          <span className={`${styles.badge} ${n === "Saudável" ? styles.bSau : n === "Atenção" ? styles.bAte : styles.bRis}`}>{n}</span>
                        )}
                      </td>
                      <td><span className={`${styles.badge} ${m.status === "Em Renovação" ? styles.bRenov : ATIVOS.includes(m.status) ? styles.bAtivo : styles.bEnc}`}>{m.status}</span></td>
                      <td className={s.prazo}>{fmt(m.prazo)}</td>
                      <td className={s.tdMotivo}>
                        {ehAtual ? (
                          <TextoInline
                            mentoradaId={m.id}
                            campo="saudeMotivo"
                            valor={m.saudeMotivo}
                            atualizadoEm={m.saudeMotivoEm}
                            placeholder={n === "Saudável" ? "Opcional — o que está indo bem" : "Escreva o motivo: o que aconteceu, desde quando…"}
                            ariaLabel={`Motivo da saúde de ${m.nome}`}
                            onSalvo={(saudeMotivo, saudeMotivoEm) =>
                              setLinhas(ls => ls.map(l => (l.id === m.id ? { ...l, saudeMotivo, saudeMotivoEm } : l)))}
                          />
                        ) : (
                          <span className={s.motivoPassado}>{m.saudeMotivo || (n === "sem" ? "Sem registro de saúde neste mês" : "Sem motivo registrado")}</span>
                        )}
                        {sg.length > 0 && (
                          <div className={s.sinais}>
                            {sg.map(x => <span key={x.texto} className={s[`s_${x.tom}`]}>{x.texto}</span>)}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {lista.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--txt3)", padding: 24 }}>Nenhuma mentorada com esses filtros.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {aberta && <JornadaModal key={aberta} id={aberta} onClose={() => setAberta(null)} />}
    </>
  );
}

function Delta({ a, b, maiorMelhor, sufixo = "" }: { a: number | null; b: number | null; maiorMelhor: boolean; sufixo?: string }) {
  if (a === null || b === null) return <small className={s.deltaN}>sem comparação</small>;
  const d = a - b;
  if (d === 0) return <small className={s.deltaN}>= igual</small>;
  const bom = maiorMelhor ? d > 0 : d < 0;
  return <small className={bom ? s.deltaBom : s.deltaRuim}>{d > 0 ? "▲" : "▼"} {Math.abs(d)}{sufixo}</small>;
}

function Evolucao({ pontos }: { pontos: { ym: string; idx: number | null }[] }) {
  const W = 300, H = 110, P = 22;
  const vals = pontos.map(p => p.idx ?? 0);
  const min = Math.max(0, Math.min(...vals) - 10), max = Math.min(100, Math.max(...vals) + 5);
  const x = (i: number) => P + (i / Math.max(1, pontos.length - 1)) * (W - P * 2);
  const y = (v: number) => H - P - ((v - min) / Math.max(1, max - min)) * (H - P * 2);
  const linha = pontos.map((p, i) => `${x(i).toFixed(1)},${y(p.idx ?? 0).toFixed(1)}`).join(" ");
  const ult = pontos[pontos.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={s.evo} role="img" aria-label="Evolução do índice de saúde por mês">
      <line x1={P} x2={W - P} y1={y(85)} y2={y(85)} className={s.evoMeta} />
      <polygon points={`${x(0)},${H - P} ${linha} ${x(pontos.length - 1)},${H - P}`} className={s.evoArea} />
      <polyline points={linha} className={s.evoLinha} />
      <circle cx={x(pontos.length - 1)} cy={y(ult.idx ?? 0)} r={4} className={s.evoPonto} />
      <text x={x(pontos.length - 1)} y={y(ult.idx ?? 0) - 8} textAnchor="end" className={s.evoValor}>{ult.idx}</text>
      {pontos.map((p, i) => (
        <text key={p.ym} x={x(i)} y={H - 6} textAnchor="middle" className={s.evoMes}>{MESES[+p.ym.slice(5, 7) - 1].slice(0, 3).toLowerCase()}</text>
      ))}
    </svg>
  );
}
