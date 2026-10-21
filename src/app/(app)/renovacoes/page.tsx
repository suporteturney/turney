import { prisma } from "@/lib/prisma";
import styles from "../shared.module.css";

function formatData(d: Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

function diasRestantes(prazo: Date | null): number | null {
  if (!prazo) return null;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(prazo).getTime() - hoje.getTime()) / 86400000);
}

export default async function RenovacoesPage() {
  const mentorados = await prisma.mentorada.findMany({
    where: { status: { in: ["Ativo", "Em Renovação", "Em Andamento"] }, prazo: { not: null } },
    orderBy: { prazo: "asc" },
    select: { id: true, nome: true, tipo: true, status: true, saude: true, inicio: true, prazo: true, resp: true, codigo: true },
  });

  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const em30 = mentorados.filter(m => { const d = diasRestantes(m.prazo); return d !== null && d >= 0 && d <= 30; });
  const em60 = mentorados.filter(m => { const d = diasRestantes(m.prazo); return d !== null && d > 30 && d <= 60; });
  const emRenovacao = mentorados.filter(m => m.status === "Em Renovação");

  return (
    <>
      <div className={styles.topbar}>
        <div>
          <div className={styles.pageTitle}>Renovações</div>
          <div className={styles.pageSub}>Contratos próximos do vencimento e pipeline de renovação</div>
        </div>
      </div>
      <div className={styles.content}>
        <div className={`${styles.kpiGrid} ${styles.kpi3}`}>
          <div className={styles.kpi} style={{ "--kpi-color": "#EF4444" } as React.CSSProperties}>
            <div className={styles.kpiLabel}>Vencem em 30 dias</div>
            <div className={styles.kpiValue}>{em30.length}</div>
            <div className={styles.kpiDelta}>Ação urgente necessária</div>
          </div>
          <div className={styles.kpi} style={{ "--kpi-color": "#F59E0B" } as React.CSSProperties}>
            <div className={styles.kpiLabel}>Vencem em 31–60 dias</div>
            <div className={styles.kpiValue}>{em60.length}</div>
            <div className={styles.kpiDelta}>Iniciar contato em breve</div>
          </div>
          <div className={styles.kpi} style={{ "--kpi-color": "#73452B" } as React.CSSProperties}>
            <div className={styles.kpiLabel}>Em Renovação</div>
            <div className={styles.kpiValue}>{emRenovacao.length}</div>
            <div className={styles.kpiDelta}>Em processo de decisão</div>
          </div>
        </div>

        <div className={styles.tblCard}>
          <div className={styles.tblHead}>
            <span className={styles.tblTitle}>Contratos Ativos com Prazo</span>
            <span className={styles.tblCount}>{mentorados.length} mentoradas</span>
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
                  <th>Dias Restantes</th>
                  <th>Responsável</th>
                </tr>
              </thead>
              <tbody>
                {mentorados.map(m => {
                  const dias = diasRestantes(m.prazo);
                  const urgBg = dias !== null && dias <= 10 ? "#FEE2E2" : dias !== null && dias <= 30 ? "#FEF3C7" : dias !== null && dias <= 60 ? "#D1FAE5" : "transparent";
                  const urgFg = dias !== null && dias <= 10 ? "#991B1B" : dias !== null && dias <= 30 ? "#92400E" : "#065F46";
                  return (
                    <tr key={m.id}>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "var(--navy-mid)" }}>{m.nome}</div>
                        {m.codigo && <div style={{ fontSize: 10, color: "var(--txt3)" }}>{m.codigo}</div>}
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
                      <td>{formatData(m.inicio)}</td>
                      <td>{formatData(m.prazo)}</td>
                      <td>
                        {dias !== null ? (
                          <span style={{ background: urgBg, color: dias <= 60 ? urgFg : "var(--txt2)", padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                            {dias <= 0 ? "Vencido" : `${dias}d`}
                          </span>
                        ) : "—"}
                      </td>
                      <td style={{ color: "var(--txt3)", fontSize: 11 }}>{m.resp ?? "—"}</td>
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
