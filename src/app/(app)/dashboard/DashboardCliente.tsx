"use client";
import { useMemo, useState } from "react";
import styles from "./dashboard.module.css";

type Mentorada = {
  id: string;
  codigo: string | null;
  nome: string;
  tipo: string;
  status: string;
  saude: string | null;
  inicio: string | null;
  prazo: string | null;
  duracao: number | null;
  resp: string | null;
  obs: string | null;
};

function getLast12Months(referenceDate?: Date): { key: string; label: string }[] {
  const months = [];
  const now = referenceDate ?? new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
    months.push({ key, label });
  }
  return months;
}

function ltvMonths(m: Mentorada): number {
  if (!m.inicio) return 0;
  const end = m.prazo ? new Date(m.prazo) : new Date();
  const start = new Date(m.inicio);
  return Math.max(0, (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth());
}

// ── SVG Charts ─────────────────────────────────────────────────────────────

function LineSvg({ data }: { data: Mentorada[] }) {
  const months = getLast12Months();
  const W = 520, H = 160, P = 36;
  const ativos: number[] = [], ent: number[] = [], sai: number[] = [];
  months.forEach(({ key }) => {
    const [y, m] = key.split("-").map(Number);
    const endOfMonth = new Date(y, m, 0);
    const startOfMonth = new Date(y, m - 1, 1);
    ativos.push(data.filter(d => {
      if (!d.inicio) return false;
      const ini = new Date(d.inicio);
      const pra = d.prazo ? new Date(d.prazo) : null;
      return ini <= endOfMonth && (pra ? pra >= startOfMonth : d.status === "Ativo" || d.status === "Em Andamento");
    }).length);
    ent.push(data.filter(d => d.inicio && d.inicio.startsWith(key)).length);
    sai.push(data.filter(d => d.prazo && d.prazo.startsWith(key) && (d.status === "Encerrado" || d.status === "Churn")).length);
  });
  const maxV = Math.max(...ativos, ...ent, ...sai, 1);
  const n = months.length;
  function pts(arr: number[]) {
    return arr.map((v, i) => [P + (i / (n - 1)) * (W - P * 2), P + (1 - v / maxV) * (H - P * 2)] as [number, number]);
  }
  const pA = pts(ativos), pE = pts(ent), pS = pts(sai);
  function poly(a: [number, number][]) { return a.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" "); }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={styles.chartSvg}>
      {[0, 1, 2, 3].map(g => {
        const yy = P + g * ((H - P * 2) / 3);
        const v = Math.round(maxV * (1 - g / 3));
        return (
          <g key={g}>
            <line x1={P} y1={yy} x2={W - 8} y2={yy} stroke="#EDE5D8" strokeWidth="1" />
            <text x={P - 4} y={yy + 3} textAnchor="end" fontSize="9" fill="#9B8B7A">{v}</text>
          </g>
        );
      })}
      <polygon points={`${P},${H - P} ${poly(pA)} ${W - P},${H - P}`} fill="rgba(201,168,118,.08)" />
      <polyline points={poly(pA)} fill="none" stroke="#C9A876" strokeWidth="2" strokeLinejoin="round" />
      <polyline points={poly(pE)} fill="none" stroke="#10B981" strokeWidth="1.5" strokeDasharray="4 3" />
      <polyline points={poly(pS)} fill="none" stroke="#EF4444" strokeWidth="1.5" strokeDasharray="4 3" />
      <circle cx={pA[pA.length - 1][0]} cy={pA[pA.length - 1][1]} r="4" fill="#C9A876" />
      {months.map(({ label }, i) => {
        const x = P + (i / (n - 1)) * (W - P * 2);
        return <text key={i} x={x} y={H - 4} textAnchor="middle" fontSize="9" fill="#9B8B7A">{label}</text>;
      })}
      <circle cx="12" cy="12" r="4" fill="#C9A876" />
      <text x="20" y="16" fontSize="10" fill="#5C4A35">Ativos</text>
      <line x1="68" y1="12" x2="82" y2="12" stroke="#10B981" strokeWidth="1.5" strokeDasharray="4 3" />
      <text x="86" y="16" fontSize="10" fill="#5C4A35">Entradas</text>
      <line x1="148" y1="12" x2="162" y2="12" stroke="#EF4444" strokeWidth="1.5" strokeDasharray="4 3" />
      <text x="166" y="16" fontSize="10" fill="#5C4A35">Saídas</text>
    </svg>
  );
}

function BarSvg({ data }: { data: Mentorada[] }) {
  const months = getLast12Months();
  const W = 520, H = 130, P = 32, gap = 3;
  const now = new Date();
  const curKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const vencArr = months.map(({ key }) =>
    data.filter(d => d.prazo && d.prazo.startsWith(key)).length
  );
  const renovArr = months.map(({ key }) =>
    data.filter(d => d.prazo && d.prazo.startsWith(key) && d.status === "Em Renovação").length
  );
  const gridMax = Math.ceil(Math.max(...vencArr, 1) / 5) * 5 || 10;
  const bw = (W - P * 2 - gap * (months.length - 1)) / months.length;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={styles.chartSvg}>
      {[0, Math.round(gridMax * 0.33), Math.round(gridMax * 0.67), gridMax].map((v, i) => {
        const yy = P + (1 - v / gridMax) * (H - P * 2);
        return (
          <g key={i}>
            <line x1={P} y1={yy} x2={W - 4} y2={yy} stroke="#EDE5D8" strokeWidth="1" />
            <text x={P - 4} y={yy + 3} textAnchor="end" fontSize="9" fill="#9B8B7A">{v}</text>
          </g>
        );
      })}
      {months.map(({ key, label }, i) => {
        const x = P + i * (bw + gap);
        const venc = vencArr[i];
        const renov = renovArr[i];
        const isCur = key === curKey;
        const totalH = venc > 0 ? Math.max((venc / gridMax) * (H - P * 2), 2) : 0;
        const renovH = renov > 0 ? Math.max((renov / gridMax) * (H - P * 2), 2) : 0;
        const baseY = P + (H - P * 2);
        return (
          <g key={i}>
            {venc > 0 && (
              <rect x={x} y={baseY - totalH} width={bw} height={totalH}
                fill={isCur ? "rgba(14,21,47,.15)" : "#E8DEC4"} rx="2" />
            )}
            {renov > 0 && (
              <rect x={x} y={baseY - renovH} width={bw} height={renovH}
                fill="#10B981" rx="2" />
            )}
            <text x={x + bw / 2} y={H - 2} textAnchor="middle" fontSize="8" fill="#9B8B7A">{label}</text>
          </g>
        );
      })}
      <rect x="32" y="3" width="8" height="8" fill="#E8DEC4" rx="1" />
      <text x="42" y="11" fontSize="9" fill="#9B8B7A">Vencimentos</text>
      <rect x="120" y="3" width="8" height="8" fill="#10B981" rx="1" />
      <text x="130" y="11" fontSize="9" fill="#5C4A35">Em Renovação</text>
    </svg>
  );
}

function DonutSvg({ data }: { data: Mentorada[] }) {
  const progDefs = [
    { l: "Nexus 1", k: "Nexus 1", c: "#0E152F" },
    { l: "Nexus 2", k: "Nexus 2", c: "#73452B" },
    { l: "Nexus 3", k: "Nexus 3", c: "#C9A876" },
    { l: "Atlas", k: "Atlas", c: "#E8DEC4" },
    { l: "Delta", k: "Delta", c: "#9B8B7A" },
  ];
  const progs = progDefs
    .map(p => ({ ...p, v: data.filter(d => d.tipo === p.k).length }))
    .filter(p => p.v > 0);
  const tot = progs.reduce((a, p) => a + p.v, 0);
  const cx = 65, cy = 65, R = 50, r = 32;
  let angle = -Math.PI / 2;
  const paths: React.ReactNode[] = [];
  progs.forEach((p, idx) => {
    const a = (p.v / tot) * Math.PI * 2;
    const x1 = cx + R * Math.cos(angle), y1 = cy + R * Math.sin(angle);
    const x2 = cx + R * Math.cos(angle + a), y2 = cy + R * Math.sin(angle + a);
    const xi = cx + r * Math.cos(angle), yi = cy + r * Math.sin(angle);
    const xo = cx + r * Math.cos(angle + a), yo = cy + r * Math.sin(angle + a);
    const lg = a > Math.PI ? 1 : 0;
    paths.push(
      <path key={idx}
        d={`M${xi.toFixed(1)},${yi.toFixed(1)} L${x1.toFixed(1)},${y1.toFixed(1)} A${R},${R} 0 ${lg},1 ${x2.toFixed(1)},${y2.toFixed(1)} L${xo.toFixed(1)},${yo.toFixed(1)} A${r},${r} 0 ${lg},0 ${xi.toFixed(1)},${yi.toFixed(1)} Z`}
        fill={p.c} stroke="white" strokeWidth="1.5" />
    );
    angle += a;
  });

  return (
    <svg viewBox="0 0 200 130" className={styles.chartSvg}>
      {paths}
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize="13" fontWeight="800" fill="#0E152F">{tot}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9" fill="#9B8B7A">total</text>
      {progs.map((p, i) => {
        const lx = 135, ly = 14 + i * 22;
        return (
          <g key={i}>
            <rect x={lx} y={ly - 7} width="8" height="8" fill={p.c} rx="1" />
            <text x={lx + 12} y={ly} fontSize="10" fill="#5C4A35">{p.l}</text>
            <text x="198" y={ly} textAnchor="end" fontSize="10" fontWeight="700" fill="#0E152F">{p.v}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function DashboardCliente({ data }: { data: Mentorada[] }) {
  const now = new Date();
  const [filterMes, setFilterMes] = useState("");
  const [filterMentorada, setFilterMentorada] = useState("");

  const mesOpts = useMemo(() => {
    const opts: { key: string; label: string }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
      opts.push({ key, label: label.charAt(0).toUpperCase() + label.slice(1) });
    }
    return opts.reverse();
  }, []);

  const filtered = useMemo(() => {
    let r = data;
    if (filterMentorada) {
      const q = filterMentorada.toLowerCase();
      r = r.filter(m =>
        m.nome.toLowerCase().includes(q) ||
        (m.codigo ?? "").toLowerCase().includes(q)
      );
    }
    if (filterMes) {
      r = r.filter(m => {
        const [y, mo] = filterMes.split("-").map(Number);
        const startOfMonth = new Date(y, mo - 1, 1);
        const endOfMonth = new Date(y, mo, 0);
        if (!m.inicio) return false;
        const ini = new Date(m.inicio);
        const pra = m.prazo ? new Date(m.prazo) : null;
        return ini <= endOfMonth && (pra ? pra >= startOfMonth : true);
      });
    }
    return r;
  }, [data, filterMes, filterMentorada]);

  const mesLabel = filterMes
    ? new Date(filterMes + "-15").toLocaleDateString("pt-BR", { month: "long" })
    : now.toLocaleDateString("pt-BR", { month: "long" });
  const mesLabelCap = mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1);

  const mesAtual = filterMes || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const tot = filtered.length;
  const atv = filtered.filter(d => d.status === "Ativo" || d.status === "Em Andamento").length;
  const enc = filtered.filter(d => d.status === "Encerrado" || d.status === "Churn").length;
  const renov = filtered.filter(d => d.status === "Em Renovação").length;
  const risco = filtered.filter(d =>
    (d.status === "Ativo" || d.status === "Em Andamento") && d.saude === "Risco"
  ).length;
  const entradas = filtered.filter(d => d.inicio && d.inicio.startsWith(mesAtual)).length;
  const ltvVals = filtered.filter(d => d.prazo).map(d => ltvMonths(d));
  const ltvMed = ltvVals.length ? Math.round(ltvVals.reduce((a, b) => a + b, 0) / ltvVals.length) : 0;

  const ativos = filtered.filter(d => d.status === "Ativo" || d.status === "Em Andamento");
  const saudavel = ativos.filter(d => d.saude === "Saudável").length;
  const atencao = ativos.filter(d => d.saude === "Atenção").length;
  const totalAtivos = ativos.length;
  const sauPct = totalAtivos > 0 ? Math.round((saudavel / totalAtivos) * 100) : 0;
  const atePct = totalAtivos > 0 ? Math.round((atencao / totalAtivos) * 100) : 0;
  const risPct = totalAtivos > 0 ? Math.round((risco / totalAtivos) * 100) : 0;

  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const proxList = filtered
    .filter(d => ["Ativo", "Em Renovação", "Em Andamento"].includes(d.status) && d.prazo)
    .map(d => {
      const dias = Math.ceil((new Date(d.prazo!).getTime() - hoje.getTime()) / 86400000);
      return { dias, nome: d.nome, tipo: d.tipo };
    })
    .filter(x => x.dias >= 0 && x.dias <= 60)
    .sort((a, b) => a.dias - b.dias)
    .slice(0, 5);

  const pipeline = filtered.filter(d => d.status === "Em Renovação");

  const isFiltered = !!filterMes || !!filterMentorada;

  return (
    <>
      <div className={styles.topbar}>
        <div>
          <div className={styles.pageTitle}>Dashboard</div>
          <div className={styles.pageSub}>
            {isFiltered ? "Visão filtrada" : "Visão geral"} da base ·{" "}
            {now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </div>
        </div>
        <div className={styles.filterBar}>
          <div className={styles.filterGroup}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.filterIcon}>
              <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <select value={filterMes} onChange={e => setFilterMes(e.target.value)} className={styles.filterSelect}>
              <option value="">Todos os meses</option>
              {mesOpts.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </div>
          <div className={styles.filterGroup}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.filterIcon}>
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="search"
              placeholder="Buscar mentorada…"
              value={filterMentorada}
              onChange={e => setFilterMentorada(e.target.value)}
              className={styles.filterInput}
            />
          </div>
          {isFiltered && (
            <button className={styles.clearBtn} onClick={() => { setFilterMes(""); setFilterMentorada(""); }}>
              ✕ Limpar
            </button>
          )}
        </div>
      </div>

      <div className={styles.content}>
        {/* KPIs */}
        <div className={styles.kpiGrid}>
          <KpiCard label="Total de Mentorados" value={tot} delta="Histórico completo da base" color="#C9A876" />
          <KpiCard label="Ativos" value={atv} delta="Contratos vigentes" color="#10B981" />
          <KpiCard label="Em Renovação" value={renov} delta="Encerrando e em decisão" color="#73452B" />
          <KpiCard label="Encerrados" value={enc} delta="Contratos finalizados" color="#EF4444" />
          <KpiCard label="Novas Entradas" value={entradas} delta={`Iniciaram em ${mesLabelCap}`} color="#C9A876" />
          <KpiCard label="Em Risco" value={risco} delta="Saúde = Risco (ativos)" color="#EF4444" />
          <KpiCard label="LTV Médio" value={`${ltvMed}m`} delta="Tempo médio com a Turney" color="#C9A876" />
          <KpiCard label="🏆 Aprovações em Vaga" value={0} delta="Mentoradas aprovadas na base" color="#F59E0B" />
        </div>

        {/* Row 2 */}
        <div className={styles.row2}>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Evolução da Base</div>
            <div className={styles.cardSub}>Últimos 12 meses — ativos, entradas e saídas</div>
            <LineSvg data={filtered} />
          </div>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Saúde da Base</div>
            <div className={styles.cardSub}>Distribuição por status · ativos</div>
            <HBar label="Saudável" color="#10B981" pct={sauPct} n={saudavel} />
            <HBar label="Atenção" color="#D97706" pct={atePct} n={atencao} />
            <HBar label="Risco" color="#EF4444" pct={risPct} n={risco} />
            <div className={styles.divider} />
            <div className={styles.sectionMini}>Próximas Renovações</div>
            {proxList.length === 0 ? (
              <div className={styles.emptyMsg}>Nenhuma renovação nos próximos 60 dias</div>
            ) : proxList.map((item, i) => {
              const bg = item.dias <= 10 ? "#FEE2E2" : item.dias <= 20 ? "#FEF3C7" : "#D1FAE5";
              const fg = item.dias <= 10 ? "#991B1B" : item.dias <= 20 ? "#92400E" : "#065F46";
              return (
                <div key={i} className={styles.renewItem}>
                  <div>
                    <div className={styles.renewNome}>{item.nome}</div>
                    <div className={styles.renewTipo}>{item.tipo}</div>
                  </div>
                  <span className={styles.days} style={{ background: bg, color: fg }}>{item.dias}d</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Row 3 */}
        <div className={styles.row3}>
          <div className={`${styles.card} ${styles.span2}`}>
            <div className={styles.cardTitle}>Taxa de Renovação Mensal</div>
            <div className={styles.cardSub}>Últimos 12 meses — vencimentos vs em renovação</div>
            <BarSvg data={filtered} />
          </div>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Por Programa</div>
            <div className={styles.cardSub}>Distribuição total</div>
            <DonutSvg data={filtered} />
          </div>
        </div>

        {/* Pipeline */}
        <div className={styles.card} style={{ marginBottom: 0 }}>
          <div className={styles.pipelineHead}>
            <div>
              <div className={styles.cardTitle}>Pipeline de Renovações</div>
              <div className={styles.cardSub}>Acompanhamento das negociações em andamento</div>
            </div>
            <span className={styles.pipelineCount}>{pipeline.length} em negociação</span>
          </div>
          {pipeline.length === 0 ? (
            <div className={styles.emptyMsg}>Nenhuma mentorada em renovação no momento.</div>
          ) : (
            <div className={styles.tblWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Programa</th>
                    <th>Prazo</th>
                    <th>Status</th>
                    <th>Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {pipeline.map(m => {
                    const dias = m.prazo
                      ? Math.ceil((new Date(m.prazo).getTime() - hoje.getTime()) / 86400000)
                      : null;
                    return (
                      <tr key={m.id}>
                        <td>
                          <div className={styles.nomeMain}>{m.nome}</div>
                          {m.codigo && <div className={styles.nomeId}>{m.codigo}</div>}
                        </td>
                        <td>
                          <span className={styles.badge}>{m.tipo}</span>
                        </td>
                        <td>
                          {m.prazo ? (
                            <span style={{ fontVariantNumeric: "tabular-nums", fontSize: 12 }}>
                              {new Date(m.prazo).toLocaleDateString("pt-BR")}
                              {dias !== null && dias < 0 && <span style={{ color: "#EF4444", fontSize: 10 }}> · vencido</span>}
                              {dias !== null && dias >= 0 && dias <= 30 && <span style={{ color: "#F59E0B", fontSize: 10 }}> · {dias}d</span>}
                            </span>
                          ) : "—"}
                        </td>
                        <td>
                          <span className={styles.pipeStatus}>Em Renovação</span>
                        </td>
                        <td className={styles.obsCell}>{m.obs ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function KpiCard({ label, value, delta, color }: { label: string; value: string | number; delta: string; color: string }) {
  return (
    <div className={styles.kpi} style={{ "--kpi-color": color } as React.CSSProperties}>
      <div className={styles.kpiLabel}>{label}</div>
      <div className={styles.kpiValue}>{value}</div>
      <div className={styles.kpiDelta}>{delta}</div>
    </div>
  );
}

function HBar({ label, color, pct, n }: { label: string; color: string; pct: number; n: number }) {
  return (
    <div className={styles.hbar}>
      <div className={styles.hbarDot} style={{ background: color }} />
      <div className={styles.hbarLabel}>{label}</div>
      <div className={styles.hbarTrack}>
        <div className={styles.hbarFill} style={{ background: color, width: `${pct}%` }} />
      </div>
      <div className={styles.hbarN}>{n}</div>
    </div>
  );
}
