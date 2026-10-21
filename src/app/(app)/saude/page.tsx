import { prisma } from "@/lib/prisma";
import styles from "../shared.module.css";

export default async function SaudePage() {
  const mentorados = await prisma.mentorada.findMany({
    where: { status: { in: ["Ativo", "Em Andamento", "Em Renovação"] } },
    orderBy: [{ saude: "asc" }, { nome: "asc" }],
    select: { id: true, nome: true, tipo: true, status: true, saude: true, resp: true, codigo: true, prazo: true },
  });

  const saudavel = mentorados.filter(m => m.saude === "Saudável");
  const atencao = mentorados.filter(m => m.saude === "Atenção");
  const risco = mentorados.filter(m => m.saude === "Risco");
  const semClassif = mentorados.filter(m => !m.saude);
  const total = mentorados.length;

  // Por programa
  const programas = [...new Set(mentorados.map(m => m.tipo ?? ""))].filter(Boolean).sort();
  const porProg = programas.map(prog => {
    const m = mentorados.filter(x => x.tipo === prog);
    return {
      prog,
      total: m.length,
      sau: m.filter(x => x.saude === "Saudável").length,
      ate: m.filter(x => x.saude === "Atenção").length,
      ris: m.filter(x => x.saude === "Risco").length,
    };
  });

  const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;

  return (
    <>
      <div className={styles.topbar}>
        <div>
          <div className={styles.pageTitle}>Saúde da Base</div>
          <div className={styles.pageSub}>Classificação dos contratos ativos por nível de risco</div>
        </div>
      </div>
      <div className={styles.content}>
        <div className={`${styles.kpiGrid} ${styles.kpi3}`}>
          <div className={styles.kpi} style={{ "--kpi-color": "#10B981" } as React.CSSProperties}>
            <div className={styles.kpiLabel}>Saudável</div>
            <div className={styles.kpiValue}>{saudavel.length}</div>
            <div className={styles.kpiDelta}>Ativos sem alertas · {pct(saudavel.length)}%</div>
          </div>
          <div className={styles.kpi} style={{ "--kpi-color": "#D97706" } as React.CSSProperties}>
            <div className={styles.kpiLabel}>Atenção</div>
            <div className={styles.kpiValue}>{atencao.length}</div>
            <div className={styles.kpiDelta}>Monitorar de perto · {pct(atencao.length)}%</div>
          </div>
          <div className={styles.kpi} style={{ "--kpi-color": "#EF4444" } as React.CSSProperties}>
            <div className={styles.kpiLabel}>Em Risco</div>
            <div className={styles.kpiValue}>{risco.length}</div>
            <div className={styles.kpiDelta}>Ação imediata necessária · {pct(risco.length)}%</div>
          </div>
        </div>

        <div className={styles.row2}>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Saúde por Programa</div>
            <div className={styles.cardSub}>Distribuição de saudável / atenção / risco entre ativos</div>
            {porProg.map(({ prog, total: tot, sau, ate, ris }) => (
              <div key={prog} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                  <span style={{ fontWeight: 600, color: "var(--navy-mid)" }}>{prog}</span>
                  <span style={{ color: "var(--txt3)" }}>{tot} ativo{tot !== 1 ? "s" : ""}</span>
                </div>
                <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", gap: 1 }}>
                  {sau > 0 && <div style={{ flex: sau, background: "#10B981" }} title={`${sau} saudável`} />}
                  {ate > 0 && <div style={{ flex: ate, background: "#D97706" }} title={`${ate} atenção`} />}
                  {ris > 0 && <div style={{ flex: ris, background: "#EF4444" }} title={`${ris} risco`} />}
                  {(sau + ate + ris === 0) && <div style={{ flex: 1, background: "#E5E7EB" }} />}
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 3, fontSize: 10, color: "var(--txt3)" }}>
                  <span style={{ color: "#10B981" }}>✓ {sau}</span>
                  <span style={{ color: "#D97706" }}>⚠ {ate}</span>
                  <span style={{ color: "#EF4444" }}>✕ {ris}</span>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>Distribuição Geral</div>
            <div className={styles.cardSub}>Todos os ativos classificados</div>
            <div className={styles.hbar}>
              <div className={styles.hbarDot} style={{ background: "#10B981" }} />
              <div className={styles.hbarLabel}>Saudável</div>
              <div className={styles.hbarTrack}>
                <div className={styles.hbarFill} style={{ background: "#10B981", width: `${pct(saudavel.length)}%` }} />
              </div>
              <div className={styles.hbarN}>{saudavel.length}</div>
            </div>
            <div className={styles.hbar}>
              <div className={styles.hbarDot} style={{ background: "#D97706" }} />
              <div className={styles.hbarLabel}>Atenção</div>
              <div className={styles.hbarTrack}>
                <div className={styles.hbarFill} style={{ background: "#D97706", width: `${pct(atencao.length)}%` }} />
              </div>
              <div className={styles.hbarN}>{atencao.length}</div>
            </div>
            <div className={styles.hbar}>
              <div className={styles.hbarDot} style={{ background: "#EF4444" }} />
              <div className={styles.hbarLabel}>Risco</div>
              <div className={styles.hbarTrack}>
                <div className={styles.hbarFill} style={{ background: "#EF4444", width: `${pct(risco.length)}%` }} />
              </div>
              <div className={styles.hbarN}>{risco.length}</div>
            </div>
            {semClassif.length > 0 && (
              <div className={styles.hbar}>
                <div className={styles.hbarDot} style={{ background: "#9CA3AF" }} />
                <div className={styles.hbarLabel}>Sem classif.</div>
                <div className={styles.hbarTrack}>
                  <div className={styles.hbarFill} style={{ background: "#9CA3AF", width: `${pct(semClassif.length)}%` }} />
                </div>
                <div className={styles.hbarN}>{semClassif.length}</div>
              </div>
            )}
          </div>
        </div>

        {risco.length > 0 && (
          <div className={styles.tblCard}>
            <div className={styles.tblHead}>
              <span className={styles.tblTitle} style={{ color: "#991B1B" }}>⚠ Em Risco — Ação Imediata</span>
              <span className={styles.tblCount}>{risco.length} mentoradas</span>
            </div>
            <div className={styles.tblWrap}>
              <table className={styles.table}>
                <thead><tr><th>Nome</th><th>Programa</th><th>Status</th><th>Prazo</th><th>Responsável</th></tr></thead>
                <tbody>
                  {risco.map(m => (
                    <tr key={m.id}>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "var(--navy-mid)" }}>{m.nome}</div>
                        {m.codigo && <div style={{ fontSize: 10, color: "var(--txt3)" }}>{m.codigo}</div>}
                      </td>
                      <td><span className={`${styles.badge} ${styles.bSilver}`}>{m.tipo}</span></td>
                      <td><span className={`${styles.badge} ${styles.bAtivo}`}>{m.status}</span></td>
                      <td style={{ color: "var(--txt3)" }}>{m.prazo ? new Date(m.prazo).toLocaleDateString("pt-BR") : "—"}</td>
                      <td style={{ color: "var(--txt3)", fontSize: 11 }}>{m.resp ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className={styles.tblCard}>
          <div className={styles.tblHead}>
            <span className={styles.tblTitle}>Todos os Ativos</span>
            <span className={styles.tblCount}>{mentorados.length} mentoradas</span>
          </div>
          <div className={styles.tblWrap}>
            <table className={styles.table}>
              <thead><tr><th>Nome</th><th>Programa</th><th>Saúde</th><th>Status</th><th>Prazo</th><th>Responsável</th></tr></thead>
              <tbody>
                {mentorados.map(m => (
                  <tr key={m.id}>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "var(--navy-mid)" }}>{m.nome}</div>
                      {m.codigo && <div style={{ fontSize: 10, color: "var(--txt3)" }}>{m.codigo}</div>}
                    </td>
                    <td><span className={`${styles.badge} ${styles.bSilver}`}>{m.tipo}</span></td>
                    <td>
                      {m.saude ? (
                        <span className={`${styles.badge} ${m.saude === "Saudável" ? styles.bSau : m.saude === "Atenção" ? styles.bAte : styles.bRis}`}>{m.saude}</span>
                      ) : <span style={{ color: "var(--txt3)", fontSize: 11 }}>—</span>}
                    </td>
                    <td><span className={`${styles.badge} ${styles.bAtivo}`}>{m.status}</span></td>
                    <td style={{ color: "var(--txt3)" }}>{m.prazo ? new Date(m.prazo).toLocaleDateString("pt-BR") : "—"}</td>
                    <td style={{ color: "var(--txt3)", fontSize: 11 }}>{m.resp ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
