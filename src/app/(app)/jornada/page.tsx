import { prisma } from "@/lib/prisma";
import styles from "../shared.module.css";

const ETAPAS_LABELS: Record<string, string> = {
  onboarding: "Onboarding",
  kick_off: "Kick-off",
  sessao_estrategica: "Sessão Estratégica",
  trilha1: "Trilha 1",
  trilha2: "Trilha 2",
  trilha3: "Trilha 3",
  correcao: "Correção/Devolutiva",
  mentoria_individual: "Mentoria Individual",
  encerramento: "Encerramento",
};

function diasEntre(a: Date | null, b: Date | null): number | null {
  if (!a || !b) return null;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

export default async function JornadaPage() {
  const mentorados = await prisma.mentorada.findMany({
    orderBy: { nome: "asc" },
    select: {
      id: true, nome: true, tipo: true, status: true, inicio: true, codigo: true,
      etapas: { select: { nome: true, data: true } },
    },
  });

  // KPIs globais
  const obsOb = mentorados
    .map(m => {
      const ob = m.etapas.find(e => e.nome === "onboarding");
      return diasEntre(m.inicio, ob?.data ?? null);
    })
    .filter((d): d is number => d !== null && d >= 0);

  const obsSe = mentorados
    .map(m => {
      const se = m.etapas.find(e => e.nome === "sessao_estrategica");
      return diasEntre(m.inicio, se?.data ?? null);
    })
    .filter((d): d is number => d !== null && d >= 0);

  const obsCd = mentorados
    .map(m => {
      const cd = m.etapas.find(e => e.nome === "correcao");
      return diasEntre(m.inicio, cd?.data ?? null);
    })
    .filter((d): d is number => d !== null && d >= 0);

  const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;

  // Por programa
  const programas = [...new Set(mentorados.map(m => m.tipo ?? ""))].filter(Boolean).sort();

  // Lista de etapas únicas presentes
  const todasEtapas = [...new Set(mentorados.flatMap(m => m.etapas.map(e => e.nome)))];

  return (
    <>
      <div className={styles.topbar}>
        <div>
          <div className={styles.pageTitle}>Jornada</div>
          <div className={styles.pageSub}>Tempo médio entre etapas da mentoria</div>
        </div>
      </div>
      <div className={styles.content}>
        <div className={`${styles.kpiGrid} ${styles.kpi3}`}>
          <div className={styles.kpi} style={{ "--kpi-color": "#C9A876" } as React.CSSProperties}>
            <div className={styles.kpiLabel}>Início → Onboarding</div>
            <div className={styles.kpiValue}>{avg(obsOb) !== null ? `${avg(obsOb)}d` : "—"}</div>
            <div className={styles.kpiDelta}>Dias em média (todos)</div>
          </div>
          <div className={styles.kpi} style={{ "--kpi-color": "#0E152F" } as React.CSSProperties}>
            <div className={styles.kpiLabel}>Início → Sessão Estratégica</div>
            <div className={styles.kpiValue}>{avg(obsSe) !== null ? `${avg(obsSe)}d` : "—"}</div>
            <div className={styles.kpiDelta}>Dias em média</div>
          </div>
          <div className={styles.kpi} style={{ "--kpi-color": "#73452B" } as React.CSSProperties}>
            <div className={styles.kpiLabel}>Início → Correção/Devolutiva</div>
            <div className={styles.kpiValue}>{avg(obsCd) !== null ? `${avg(obsCd)}d` : "—"}</div>
            <div className={styles.kpiDelta}>Dias em média</div>
          </div>
        </div>

        <div className={styles.tblCard}>
          <div className={styles.tblHead}>
            <span className={styles.tblTitle}>Jornada Individual por Mentorada</span>
            <span className={styles.tblCount}>{mentorados.length} registros</span>
          </div>
          <div className={styles.tblWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Programa</th>
                  <th>Status</th>
                  {Object.entries(ETAPAS_LABELS).slice(0, 5).map(([k, v]) => <th key={k}>{v}</th>)}
                </tr>
              </thead>
              <tbody>
                {mentorados.map(m => (
                  <tr key={m.id}>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "var(--navy-mid)" }}>{m.nome}</div>
                      {m.codigo && <div style={{ fontSize: 10, color: "var(--txt3)" }}>{m.codigo}</div>}
                    </td>
                    <td><span className={`${styles.badge} ${styles.bSilver}`}>{m.tipo}</span></td>
                    <td>
                      <span className={`${styles.badge} ${m.status === "Ativo" ? styles.bAtivo : m.status === "Encerrado" ? styles.bEnc : styles.bSilver}`}>
                        {m.status}
                      </span>
                    </td>
                    {Object.keys(ETAPAS_LABELS).slice(0, 5).map(k => {
                      const etapa = m.etapas.find(e => e.nome === k);
                      const d = diasEntre(m.inicio, etapa?.data ?? null);
                      return (
                        <td key={k} style={{ textAlign: "center" }}>
                          {etapa?.data ? (
                            <span style={{ fontSize: 11 }}>
                              {new Date(etapa.data).toLocaleDateString("pt-BR")}
                              {d !== null && <div style={{ fontSize: 10, color: "var(--txt3)" }}>{d}d</div>}
                            </span>
                          ) : <span style={{ color: "var(--txt3)", fontSize: 11 }}>—</span>}
                        </td>
                      );
                    })}
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
