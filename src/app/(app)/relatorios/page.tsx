import { prisma } from "@/lib/prisma";
import styles from "../shared.module.css";

export default async function RelatoriosPage() {
  const mentorados = await prisma.mentorada.findMany({
    orderBy: { nome: "asc" },
    select: {
      id: true, nome: true, tipo: true, status: true, saude: true, inicio: true, prazo: true, resp: true,
      etapas: { select: { nome: true, data: true } },
      presencas: { select: { presente: true } },
    },
  });

  const tot = mentorados.length;
  const atv = mentorados.filter(m => m.status === "Ativo" || m.status === "Em Andamento").length;
  const enc = mentorados.filter(m => m.status === "Encerrado" || m.status === "Churn").length;
  const renov = mentorados.filter(m => m.status === "Em Renovação").length;

  // Assiduidade geral
  const comPresenca = mentorados.filter(m => m.presencas.length > 0);
  const assidGeral = comPresenca.length > 0
    ? Math.round(comPresenca.reduce((a, m) => {
        const pct = m.presencas.filter(p => p.presente).length / m.presencas.length * 100;
        return a + pct;
      }, 0) / comPresenca.length)
    : null;

  // Por programa
  const programas = [...new Set(mentorados.map(m => m.tipo ?? ""))].filter(Boolean).sort();
  const porProg = programas.map(prog => ({
    prog,
    total: mentorados.filter(m => m.tipo === prog).length,
    ativos: mentorados.filter(m => m.tipo === prog && (m.status === "Ativo" || m.status === "Em Andamento")).length,
    enc: mentorados.filter(m => m.tipo === prog && (m.status === "Encerrado" || m.status === "Churn")).length,
  }));
  const maxAtivos = Math.max(...porProg.map(p => p.ativos), 1);

  // Saúde
  const ativos = mentorados.filter(m => m.status === "Ativo" || m.status === "Em Andamento");
  const sau = ativos.filter(m => m.saude === "Saudável").length;
  const ate = ativos.filter(m => m.saude === "Atenção").length;
  const ris = ativos.filter(m => m.saude === "Risco").length;
  const semSau = ativos.filter(m => !m.saude).length;

  return (
    <>
      <div className={styles.topbar}>
        <div>
          <div className={styles.pageTitle}>Relatórios</div>
          <div className={styles.pageSub}>Visão consolidada da base para apresentação executiva</div>
        </div>
      </div>
      <div className={styles.content}>
        <div className={`${styles.kpiGrid} ${styles.kpi4}`}>
          <div className={styles.kpi} style={{ "--kpi-color": "#C9A876" } as React.CSSProperties}>
            <div className={styles.kpiLabel}>Total Mentorados</div>
            <div className={styles.kpiValue}>{tot}</div>
          </div>
          <div className={styles.kpi} style={{ "--kpi-color": "#10B981" } as React.CSSProperties}>
            <div className={styles.kpiLabel}>Ativos</div>
            <div className={styles.kpiValue}>{atv}</div>
          </div>
          <div className={styles.kpi} style={{ "--kpi-color": "#73452B" } as React.CSSProperties}>
            <div className={styles.kpiLabel}>Em Renovação</div>
            <div className={styles.kpiValue}>{renov}</div>
          </div>
          <div className={styles.kpi} style={{ "--kpi-color": "#9B8B7A" } as React.CSSProperties}>
            <div className={styles.kpiLabel}>Assiduidade Geral</div>
            <div className={styles.kpiValue}>{assidGeral !== null ? `${assidGeral}%` : "—"}</div>
          </div>
        </div>

        <div className={styles.row3}>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Ativos por Programa</div>
            <div className={styles.cardSub}>Distribuição atual</div>
            {porProg.map(({ prog, ativos: a }) => (
              <div key={prog} className={styles.hbar}>
                <div className={styles.hbarLabel}>{prog}</div>
                <div className={styles.hbarTrack}>
                  <div className={styles.hbarFill} style={{ background: "#C9A876", width: `${Math.round((a / maxAtivos) * 100)}%` }} />
                </div>
                <div className={styles.hbarN}>{a}</div>
              </div>
            ))}
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>Saúde Geral</div>
            <div className={styles.cardSub}>Ativos classificados</div>
            {ativos.length > 0 ? (
              <>
                <div className={styles.hbar}>
                  <div className={styles.hbarDot} style={{ background: "#10B981" }} />
                  <div className={styles.hbarLabel}>Saudável</div>
                  <div className={styles.hbarTrack}>
                    <div className={styles.hbarFill} style={{ background: "#10B981", width: `${Math.round((sau / ativos.length) * 100)}%` }} />
                  </div>
                  <div className={styles.hbarN}>{sau}</div>
                </div>
                <div className={styles.hbar}>
                  <div className={styles.hbarDot} style={{ background: "#D97706" }} />
                  <div className={styles.hbarLabel}>Atenção</div>
                  <div className={styles.hbarTrack}>
                    <div className={styles.hbarFill} style={{ background: "#D97706", width: `${Math.round((ate / ativos.length) * 100)}%` }} />
                  </div>
                  <div className={styles.hbarN}>{ate}</div>
                </div>
                <div className={styles.hbar}>
                  <div className={styles.hbarDot} style={{ background: "#EF4444" }} />
                  <div className={styles.hbarLabel}>Risco</div>
                  <div className={styles.hbarTrack}>
                    <div className={styles.hbarFill} style={{ background: "#EF4444", width: `${Math.round((ris / ativos.length) * 100)}%` }} />
                  </div>
                  <div className={styles.hbarN}>{ris}</div>
                </div>
                {semSau > 0 && (
                  <div className={styles.hbar}>
                    <div className={styles.hbarDot} style={{ background: "#9CA3AF" }} />
                    <div className={styles.hbarLabel}>Sem classif.</div>
                    <div className={styles.hbarTrack}>
                      <div className={styles.hbarFill} style={{ background: "#9CA3AF", width: `${Math.round((semSau / ativos.length) * 100)}%` }} />
                    </div>
                    <div className={styles.hbarN}>{semSau}</div>
                  </div>
                )}
              </>
            ) : <div style={{ fontSize: 12, color: "var(--txt3)" }}>Sem dados</div>}
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>Status Geral</div>
            <div className={styles.cardSub}>Distribuição completa da base</div>
            {[
              { label: "Ativos", n: atv, cor: "#10B981" },
              { label: "Em Renovação", n: renov, cor: "#73452B" },
              { label: "Encerrados/Churn", n: enc, cor: "#EF4444" },
            ].map(item => (
              <div key={item.label} className={styles.hbar}>
                <div className={styles.hbarDot} style={{ background: item.cor }} />
                <div className={styles.hbarLabel}>{item.label}</div>
                <div className={styles.hbarTrack}>
                  <div className={styles.hbarFill} style={{ background: item.cor, width: tot > 0 ? `${Math.round((item.n / tot) * 100)}%` : "0%" }} />
                </div>
                <div className={styles.hbarN}>{item.n}</div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.tblCard}>
          <div className={styles.tblHead}>
            <span className={styles.tblTitle}>Resumo Completo da Base</span>
            <span className={styles.tblCount}>{tot} mentoradas</span>
          </div>
          <div className={styles.tblWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Programa</th>
                  <th>Status</th>
                  <th>Saúde</th>
                  <th>Início</th>
                  <th>Prazo</th>
                  <th>Etapas</th>
                  <th>Responsável</th>
                </tr>
              </thead>
              <tbody>
                {mentorados.map(m => (
                  <tr key={m.id}>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "var(--navy-mid)" }}>{m.nome}</div>
                    </td>
                    <td><span className={`${styles.badge} ${styles.bSilver}`}>{m.tipo}</span></td>
                    <td>
                      <span className={`${styles.badge} ${m.status === "Ativo" ? styles.bAtivo : m.status === "Encerrado" ? styles.bEnc : m.status === "Churn" ? styles.bChurn : m.status === "Em Renovação" ? styles.bRenov : styles.bSilver}`}>
                        {m.status}
                      </span>
                    </td>
                    <td>
                      {m.saude ? (
                        <span className={`${styles.badge} ${m.saude === "Saudável" ? styles.bSau : m.saude === "Atenção" ? styles.bAte : styles.bRis}`}>{m.saude}</span>
                      ) : "—"}
                    </td>
                    <td style={{ color: "var(--txt3)", fontSize: 11 }}>{m.inicio ? new Date(m.inicio).toLocaleDateString("pt-BR") : "—"}</td>
                    <td style={{ color: "var(--txt3)", fontSize: 11 }}>{m.prazo ? new Date(m.prazo).toLocaleDateString("pt-BR") : "—"}</td>
                    <td style={{ color: "var(--txt3)", fontSize: 11 }}>{m.etapas.filter(e => e.data).length}/{m.etapas.length}</td>
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
