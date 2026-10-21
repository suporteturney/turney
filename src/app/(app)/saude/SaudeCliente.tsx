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
  onboarding: string | null; ultimoAcomp: string | null; presTotal: number; presOk: number;
};

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
  if (!m.onboarding && m.inicio && diasDesde(m.inicio) > 7) {
    out.push({ texto: `Onboarding pendente (${diasDesde(m.inicio)}d de programa)`, tom: "warn" });
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
  const [linhas, setLinhas] = useState(data);
  const [filtTipo, setFiltTipo] = useState("");
  const [filtNivel, setFiltNivel] = useState<Nivel | "">("");
  const [aberta, setAberta] = useState<string | null>(null);

  const porPrograma = useMemo(() => {
    const progs = [...new Set(linhas.map(m => m.tipo || "Sem programa"))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    return progs.map(prog => {
      const ms = linhas.filter(m => (m.tipo || "Sem programa") === prog);
      const c = contar(ms);
      return { prog, total: ms.length, c, idx: indice(c) };
    }).sort((a, b) => b.total - a.total);
  }, [linhas]);

  const doPrograma = useMemo(
    () => (filtTipo ? linhas.filter(m => casaTipo(m.tipo || "Sem programa", filtTipo)) : linhas),
    [linhas, filtTipo]
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
          {(filtTipo || filtNivel) && (
            <button className={f.clear} onClick={() => { setFiltTipo(""); setFiltNivel(""); }}>Limpar filtros</button>
          )}
          <span className={f.count}>{doPrograma.length} contratos ativos</span>
        </div>

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
                  const sg = sinais(m);
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
                      <td><span className={`${styles.badge} ${m.status === "Em Renovação" ? styles.bRenov : styles.bAtivo}`}>{m.status}</span></td>
                      <td className={s.prazo}>{fmt(m.prazo)}</td>
                      <td className={s.tdMotivo}>
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
