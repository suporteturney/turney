import { prisma } from "@/lib/prisma";
import styles from "../shared.module.css";

function formatData(d: Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

export default async function EncerradosPage() {
  const todos = await prisma.mentorada.findMany({
    where: { status: { in: ["Encerrado", "Churn"] } },
    orderBy: { prazo: "desc" },
    select: { id: true, nome: true, tipo: true, status: true, inicio: true, prazo: true, duracao: true, resp: true, codigo: true, saude: true, obs: true },
  });

  const encerrados = todos.filter(m => m.status === "Encerrado");
  const churns = todos.filter(m => m.status === "Churn");

  // Por programa
  const porProg: Record<string, { enc: number; churn: number }> = {};
  todos.forEach(m => {
    const k = m.tipo ?? "Outro";
    if (!porProg[k]) porProg[k] = { enc: 0, churn: 0 };
    if (m.status === "Encerrado") porProg[k].enc++;
    else porProg[k].churn++;
  });
  const maxProg = Math.max(...Object.values(porProg).map(v => v.enc + v.churn), 1);

  return (
    <>
      <div className={styles.topbar}>
        <div>
          <div className={styles.pageTitle}>Encerrados</div>
          <div className={styles.pageSub}>Contratos finalizados — conclusão natural e churn</div>
        </div>
      </div>
      <div className={styles.content}>
        <div className={`${styles.kpiGrid} ${styles.kpi3}`}>
          <div className={styles.kpi} style={{ "--kpi-color": "#EF4444" } as React.CSSProperties}>
            <div className={styles.kpiLabel}>Total Encerrados</div>
            <div className={styles.kpiValue}>{todos.length}</div>
          </div>
          <div className={styles.kpi} style={{ "--kpi-color": "#D97706" } as React.CSSProperties}>
            <div className={styles.kpiLabel}>Churn</div>
            <div className={styles.kpiValue}>{churns.length}</div>
            <div className={styles.kpiDelta}>Saída antecipada</div>
          </div>
          <div className={styles.kpi} style={{ "--kpi-color": "#10B981" } as React.CSSProperties}>
            <div className={styles.kpiLabel}>Conclusão Natural</div>
            <div className={styles.kpiValue}>{encerrados.length}</div>
            <div className={styles.kpiDelta}>Prazo atingido</div>
          </div>
        </div>

        <div className={styles.row2} style={{ marginBottom: 16 }}>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Encerrados por Programa</div>
            <div className={styles.cardSub}>Conclusão natural vs churn</div>
            {Object.entries(porProg).sort((a, b) => (b[1].enc + b[1].churn) - (a[1].enc + a[1].churn)).map(([prog, vals]) => (
              <div key={prog} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                  <span style={{ fontWeight: 600, color: "var(--navy-mid)" }}>{prog}</span>
                  <span style={{ color: "var(--txt3)" }}>{vals.enc + vals.churn} total</span>
                </div>
                <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", gap: 1 }}>
                  {vals.enc > 0 && <div style={{ flex: vals.enc, background: "#10B981" }} title={`${vals.enc} conclusão`} />}
                  {vals.churn > 0 && <div style={{ flex: vals.churn, background: "#EF4444" }} title={`${vals.churn} churn`} />}
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 3, fontSize: 10, color: "var(--txt3)" }}>
                  <span style={{ color: "#10B981" }}>✓ {vals.enc}</span>
                  <span style={{ color: "#EF4444" }}>✕ {vals.churn}</span>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>Legenda</div>
            <div className={styles.cardSub}>Tipos de encerramento</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ width: 12, height: 12, borderRadius: 2, background: "#10B981", marginTop: 1, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--navy-mid)" }}>Conclusão Natural</div>
                  <div style={{ fontSize: 11, color: "var(--txt3)" }}>Mentorada que completou o prazo contratado</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ width: 12, height: 12, borderRadius: 2, background: "#EF4444", marginTop: 1, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--navy-mid)" }}>Churn</div>
                  <div style={{ fontSize: 11, color: "var(--txt3)" }}>Saída antecipada antes do término do contrato</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.tblCard}>
          <div className={styles.tblHead}>
            <span className={styles.tblTitle}>Lista de Encerrados</span>
            <span className={styles.tblCount}>{todos.length} registros</span>
          </div>
          <div className={styles.tblWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Programa</th>
                  <th>Status</th>
                  <th>Início</th>
                  <th>Encerramento</th>
                  <th>Duração</th>
                  <th>Responsável</th>
                </tr>
              </thead>
              <tbody>
                {todos.map(m => {
                  let dur = m.duracao ? `${m.duracao}m` : "—";
                  if (!m.duracao && m.inicio && m.prazo) {
                    const d = new Date(m.prazo);
                    const i = new Date(m.inicio);
                    const months = (d.getFullYear() - i.getFullYear()) * 12 + d.getMonth() - i.getMonth();
                    if (months > 0) dur = `${months}m`;
                  }
                  return (
                    <tr key={m.id}>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "var(--navy-mid)" }}>{m.nome}</div>
                        {m.codigo && <div style={{ fontSize: 10, color: "var(--txt3)" }}>{m.codigo}</div>}
                      </td>
                      <td><span className={`${styles.badge} ${styles.bSilver}`}>{m.tipo}</span></td>
                      <td>
                        <span className={`${styles.badge} ${m.status === "Churn" ? styles.bChurn : styles.bEnc}`}>
                          {m.status}
                        </span>
                      </td>
                      <td>{formatData(m.inicio)}</td>
                      <td>{formatData(m.prazo)}</td>
                      <td style={{ color: "var(--txt3)" }}>{dur}</td>
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
