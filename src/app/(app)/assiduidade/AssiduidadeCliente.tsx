"use client";
import { useMemo, useState } from "react";
import JornadaModal from "@/components/JornadaModal";
import styles from "../shared.module.css";
import f from "../filtros.module.css";

type Linha = {
  id: string; nome: string; tipo: string; status: string; codigo: string | null;
  total: number; presentes: number;
};

const casaTipo = (tipo: string, filtro: string) => tipo === filtro || tipo.startsWith(`${filtro} `);
const corPct = (p: number | null) => (p === null ? "#9CA3AF" : p < 50 ? "#EF4444" : p < 80 ? "#D97706" : "#10B981");

export default function AssiduidadeCliente({ data }: { data: Linha[] }) {
  const [filtTipo, setFiltTipo] = useState("");
  const [filtStatus, setFiltStatus] = useState("Ativo");
  const [aberta, setAberta] = useState<string | null>(null);

  const tipos = useMemo(() => {
    const set = [...new Set(data.map(m => m.tipo).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    const grupos = [...new Set(set.filter(t => / \d+$/.test(t)).map(t => t.replace(/ \d+$/, "")))];
    return { set, grupos };
  }, [data]);
  const statusOpts = useMemo(() => [...new Set(data.map(m => m.status))].sort((a, b) => a.localeCompare(b, "pt-BR")), [data]);

  const lista = useMemo(
    () =>
      data
        .filter(m => (!filtTipo || casaTipo(m.tipo, filtTipo)) && (!filtStatus || m.status === filtStatus))
        .map(m => ({ ...m, pct: m.total > 0 ? Math.round((m.presentes / m.total) * 100) : null }))
        .sort((a, b) => (a.pct ?? 101) - (b.pct ?? 101) || a.nome.localeCompare(b.nome, "pt-BR")),
    [data, filtTipo, filtStatus]
  );

  const comDados = lista.filter(m => m.pct !== null);
  const mediaGeral = comDados.length ? Math.round(comDados.reduce((a, m) => a + m.pct!, 0) / comDados.length) : null;
  const baixa = comDados.filter(m => m.pct! < 50).length;
  const media = comDados.filter(m => m.pct! >= 50 && m.pct! < 80).length;
  const alta = comDados.filter(m => m.pct! >= 80).length;

  const porProg = [...new Set(lista.map(m => m.tipo))].sort((a, b) => a.localeCompare(b, "pt-BR")).map(prog => {
    const ms = comDados.filter(m => m.tipo === prog);
    return { prog, pct: ms.length ? Math.round(ms.reduce((a, m) => a + m.pct!, 0) / ms.length) : null };
  }).filter(p => p.pct !== null);

  const faixa = (n: number) => (comDados.length ? `${Math.round((n / comDados.length) * 100)}%` : "0%");

  return (
    <>
      <div className={styles.topbar}>
        <div>
          <div className={styles.pageTitle}>Assiduidade</div>
          <div className={styles.pageSub}>Frequência nos encontros em grupo</div>
        </div>
      </div>
      <div className={styles.content}>
        <div className={f.bar}>
          <select className={f.select} value={filtTipo} onChange={e => setFiltTipo(e.target.value)} aria-label="Filtrar por programa">
            <option value="">Todos os programas</option>
            {tipos.grupos.map(g => <option key={`g-${g}`} value={g}>{g} (todos)</option>)}
            {tipos.set.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className={f.select} value={filtStatus} onChange={e => setFiltStatus(e.target.value)} aria-label="Filtrar por status">
            <option value="">Todos os status</option>
            {statusOpts.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {(filtTipo || filtStatus !== "Ativo") && (
            <button className={f.clear} onClick={() => { setFiltTipo(""); setFiltStatus("Ativo"); }}>Voltar ao padrão</button>
          )}
          <span className={f.count}>{lista.length} mentoradas · {comDados.length} com presença registrada</span>
        </div>

        <div className={`${styles.kpiGrid} ${styles.kpi3}`}>
          <div className={styles.kpi} style={{ "--kpi-color": "#C9A876" } as React.CSSProperties}>
            <div className={styles.kpiLabel}>Assiduidade geral</div>
            <div className={styles.kpiValue}>{mediaGeral !== null ? `${mediaGeral}%` : "—"}</div>
            <div className={styles.kpiDelta}>Média entre as mentoradas com registro</div>
          </div>
          <div className={styles.kpi} style={{ "--kpi-color": "#EF4444" } as React.CSSProperties}>
            <div className={styles.kpiLabel}>Baixa (&lt;50%)</div>
            <div className={styles.kpiValue}>{baixa}</div>
            <div className={styles.kpiDelta}>Necessitam atenção</div>
          </div>
          <div className={styles.kpi} style={{ "--kpi-color": "#10B981" } as React.CSSProperties}>
            <div className={styles.kpiLabel}>Alta (≥80%)</div>
            <div className={styles.kpiValue}>{alta}</div>
            <div className={styles.kpiDelta}>Presença consistente</div>
          </div>
        </div>

        <div className={styles.row2}>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Assiduidade por programa</div>
            <div className={styles.cardSub}>Média de presença por produto</div>
            {porProg.map(({ prog, pct }) => (
              <div key={prog} className={styles.hbar}>
                <div className={styles.hbarDot} style={{ background: corPct(pct) }} />
                <div className={styles.hbarLabel}>{prog}</div>
                <div className={styles.hbarTrack}>
                  <div className={styles.hbarFill} style={{ background: corPct(pct), width: `${pct}%` }} />
                </div>
                <div className={styles.hbarN}>{pct}%</div>
              </div>
            ))}
            {porProg.length === 0 && (
              <div style={{ fontSize: 12, color: "var(--txt3)", padding: "12px 0" }}>
                Nenhuma presença registrada para esses filtros. Marque as presenças na aba Presença do cadastro da mentorada.
              </div>
            )}
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>Distribuição</div>
            <div className={styles.cardSub}>Classificação por faixa de presença</div>
            {[
              { label: "Alta (≥80%)", n: alta, cor: "#10B981" },
              { label: "Média (50–79%)", n: media, cor: "#D97706" },
              { label: "Baixa (<50%)", n: baixa, cor: "#EF4444" },
            ].map(x => (
              <div key={x.label} className={styles.hbar}>
                <div className={styles.hbarDot} style={{ background: x.cor }} />
                <div className={styles.hbarLabel}>{x.label}</div>
                <div className={styles.hbarTrack}>
                  <div className={styles.hbarFill} style={{ background: x.cor, width: faixa(x.n) }} />
                </div>
                <div className={styles.hbarN}>{x.n}</div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.tblCard}>
          <div className={styles.tblHead}>
            <span className={styles.tblTitle}>Assiduidade individual</span>
            <span className={styles.tblCount}>{lista.length} mentoradas</span>
          </div>
          <div className={styles.tblWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Programa</th>
                  <th>Status</th>
                  <th>Presenças</th>
                  <th>Faltas</th>
                  <th>Total</th>
                  <th>Assiduidade</th>
                </tr>
              </thead>
              <tbody>
                {lista.map(m => {
                  const cor = corPct(m.pct);
                  return (
                    <tr key={m.id}>
                      <td>
                        <button className={f.nomeBtn} onClick={() => setAberta(m.id)}>{m.nome}</button>
                        {m.codigo && <div className={f.cod}>{m.codigo}</div>}
                      </td>
                      <td><span className={`${styles.badge} ${styles.bSilver}`}>{m.tipo}</span></td>
                      <td>
                        <span className={`${styles.badge} ${m.status === "Ativo" ? styles.bAtivo : m.status === "Em Renovação" ? styles.bRenov : m.status === "Churn" ? styles.bChurn : m.status === "Encerrado" ? styles.bEnc : styles.bSilver}`}>
                          {m.status}
                        </span>
                      </td>
                      <td style={{ color: "#10B981", fontWeight: 600 }}>{m.presentes}</td>
                      <td style={{ color: "#EF4444", fontWeight: 600 }}>{m.total - m.presentes}</td>
                      <td style={{ color: "var(--txt3)" }}>{m.total}</td>
                      <td style={{ minWidth: 160 }}>
                        {m.pct !== null ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ flex: 1, height: 6, background: "#F0EAE0", borderRadius: 3, overflow: "hidden" }}>
                              <div style={{ height: "100%", background: cor, width: `${m.pct}%`, borderRadius: 3 }} />
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: cor, width: 36, textAlign: "right" }}>{m.pct}%</span>
                          </div>
                        ) : <span style={{ color: "var(--txt3)", fontSize: 11 }}>sem registro</span>}
                      </td>
                    </tr>
                  );
                })}
                {lista.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--txt3)", padding: 24 }}>Nenhuma mentorada com esses filtros.</td></tr>
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
