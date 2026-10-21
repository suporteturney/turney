import { prisma } from "@/lib/prisma";
import styles from "../shared.module.css";

export default async function AssiduidadePage() {
  const mentorados = await prisma.mentorada.findMany({
    where: { status: { in: ["Ativo", "Em Andamento"] } },
    orderBy: { nome: "asc" },
    select: {
      id: true, nome: true, tipo: true, codigo: true,
      presencas: { select: { encontro: true, presente: true } },
    },
  });

  // Calcular assiduidade por mentorada
  const comAssid = mentorados.map(m => {
    const total = m.presencas.length;
    const presentes = m.presencas.filter(p => p.presente).length;
    const pct = total > 0 ? Math.round((presentes / total) * 100) : null;
    return { ...m, total, presentes, pct };
  });

  const comDados = comAssid.filter(m => m.total > 0);
  const mediaGeral = comDados.length > 0
    ? Math.round(comDados.reduce((a, m) => a + (m.pct ?? 0), 0) / comDados.length)
    : null;

  const baixa = comDados.filter(m => (m.pct ?? 100) < 50);
  const media = comDados.filter(m => (m.pct ?? 0) >= 50 && (m.pct ?? 0) < 80);
  const alta = comDados.filter(m => (m.pct ?? 0) >= 80);

  // Assiduidade por programa
  const programas = [...new Set(mentorados.map(m => m.tipo ?? ""))].filter(Boolean).sort();

  function assidProg(prog: string) {
    const ms = comDados.filter(m => m.tipo === prog);
    if (ms.length === 0) return null;
    return Math.round(ms.reduce((a, m) => a + (m.pct ?? 0), 0) / ms.length);
  }

  return (
    <>
      <div className={styles.topbar}>
        <div>
          <div className={styles.pageTitle}>Assiduidade</div>
          <div className={styles.pageSub}>Frequência nos encontros — mentoradas ativas</div>
        </div>
      </div>
      <div className={styles.content}>
        <div className={`${styles.kpiGrid} ${styles.kpi3}`}>
          <div className={styles.kpi} style={{ "--kpi-color": "#C9A876" } as React.CSSProperties}>
            <div className={styles.kpiLabel}>Assiduidade Geral</div>
            <div className={styles.kpiValue}>{mediaGeral !== null ? `${mediaGeral}%` : "—"}</div>
            <div className={styles.kpiDelta}>Média entre as mentoradas com registro</div>
          </div>
          <div className={styles.kpi} style={{ "--kpi-color": "#EF4444" } as React.CSSProperties}>
            <div className={styles.kpiLabel}>Baixa (&lt;50%)</div>
            <div className={styles.kpiValue}>{baixa.length}</div>
            <div className={styles.kpiDelta}>Necessitam atenção</div>
          </div>
          <div className={styles.kpi} style={{ "--kpi-color": "#10B981" } as React.CSSProperties}>
            <div className={styles.kpiLabel}>Alta (≥80%)</div>
            <div className={styles.kpiValue}>{alta.length}</div>
            <div className={styles.kpiDelta}>Presença consistente</div>
          </div>
        </div>

        <div className={styles.row2}>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Assiduidade por Programa</div>
            <div className={styles.cardSub}>Média de presença por produto</div>
            {programas.map(prog => {
              const a = assidProg(prog);
              if (a === null) return null;
              const cor = a < 50 ? "#EF4444" : a < 80 ? "#D97706" : "#10B981";
              return (
                <div key={prog} className={styles.hbar}>
                  <div className={styles.hbarDot} style={{ background: cor }} />
                  <div className={styles.hbarLabel}>{prog}</div>
                  <div className={styles.hbarTrack}>
                    <div className={styles.hbarFill} style={{ background: cor, width: `${a}%` }} />
                  </div>
                  <div className={styles.hbarN}>{a}%</div>
                </div>
              );
            })}
            {comDados.length === 0 && (
              <div style={{ fontSize: 12, color: "var(--txt3)", padding: "12px 0" }}>
                Nenhuma presença registrada ainda.
              </div>
            )}
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>Distribuição</div>
            <div className={styles.cardSub}>Classificação por faixa de presença</div>
            <div className={styles.hbar}>
              <div className={styles.hbarDot} style={{ background: "#10B981" }} />
              <div className={styles.hbarLabel}>Alta (≥80%)</div>
              <div className={styles.hbarTrack}>
                <div className={styles.hbarFill} style={{ background: "#10B981", width: comDados.length ? `${Math.round((alta.length / comDados.length) * 100)}%` : "0%" }} />
              </div>
              <div className={styles.hbarN}>{alta.length}</div>
            </div>
            <div className={styles.hbar}>
              <div className={styles.hbarDot} style={{ background: "#D97706" }} />
              <div className={styles.hbarLabel}>Média (50-79%)</div>
              <div className={styles.hbarTrack}>
                <div className={styles.hbarFill} style={{ background: "#D97706", width: comDados.length ? `${Math.round((media.length / comDados.length) * 100)}%` : "0%" }} />
              </div>
              <div className={styles.hbarN}>{media.length}</div>
            </div>
            <div className={styles.hbar}>
              <div className={styles.hbarDot} style={{ background: "#EF4444" }} />
              <div className={styles.hbarLabel}>Baixa (&lt;50%)</div>
              <div className={styles.hbarTrack}>
                <div className={styles.hbarFill} style={{ background: "#EF4444", width: comDados.length ? `${Math.round((baixa.length / comDados.length) * 100)}%` : "0%" }} />
              </div>
              <div className={styles.hbarN}>{baixa.length}</div>
            </div>
          </div>
        </div>

        <div className={styles.tblCard}>
          <div className={styles.tblHead}>
            <span className={styles.tblTitle}>Assiduidade Individual</span>
            <span className={styles.tblCount}>{mentorados.length} mentoradas ativas</span>
          </div>
          <div className={styles.tblWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Programa</th>
                  <th>Presenças</th>
                  <th>Faltas</th>
                  <th>Total</th>
                  <th>Assiduidade</th>
                </tr>
              </thead>
              <tbody>
                {comAssid.sort((a, b) => (a.pct ?? 101) - (b.pct ?? 101)).map(m => {
                  const cor = m.pct === null ? "#9CA3AF" : m.pct < 50 ? "#EF4444" : m.pct < 80 ? "#D97706" : "#10B981";
                  return (
                    <tr key={m.id}>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "var(--navy-mid)" }}>{m.nome}</div>
                        {m.codigo && <div style={{ fontSize: 10, color: "var(--txt3)" }}>{m.codigo}</div>}
                      </td>
                      <td><span className={`${styles.badge} ${styles.bSilver}`}>{m.tipo}</span></td>
                      <td style={{ color: "#10B981", fontWeight: 600 }}>{m.presentes}</td>
                      <td style={{ color: "#EF4444", fontWeight: 600 }}>{m.total - m.presentes}</td>
                      <td style={{ color: "var(--txt3)" }}>{m.total}</td>
                      <td>
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
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
