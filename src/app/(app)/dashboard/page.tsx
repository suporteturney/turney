import { prisma } from "@/lib/prisma";
import styles from "./dashboard.module.css";

function getLast12Months(): { key: string; label: string }[] {
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
    months.push({ key, label });
  }
  return months;
}

function ltvMonths(m: { inicio: Date | null; prazo: Date | null }): number {
  if (!m.inicio) return 0;
  const end = m.prazo ? new Date(m.prazo) : new Date();
  const start = new Date(m.inicio);
  return Math.max(0, (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth());
}

function buildLineSvg(mentorados: Array<{ inicio: Date | null; prazo: Date | null; status: string }>): string {
  const months = getLast12Months();
  const W = 520, H = 160, P = 36;
  const ativos: number[] = [], ent: number[] = [], sai: number[] = [];
  months.forEach(({ key }) => {
    const [y, m] = key.split("-").map(Number);
    const endOfMonth = new Date(y, m, 0);
    const startOfMonth = new Date(y, m - 1, 1);
    ativos.push(mentorados.filter(d => {
      if (!d.inicio) return false;
      const ini = new Date(d.inicio);
      const pra = d.prazo ? new Date(d.prazo) : null;
      return ini <= endOfMonth && (pra ? pra >= startOfMonth : d.status === "Ativo");
    }).length);
    ent.push(mentorados.filter(d => d.inicio && new Date(d.inicio).toISOString().startsWith(key)).length);
    sai.push(mentorados.filter(d => d.prazo && new Date(d.prazo).toISOString().startsWith(key) && d.status === "Encerrado").length);
  });
  const maxV = Math.max(...ativos, ...ent, ...sai, 1);
  const n = months.length;
  function pts(arr: number[]) {
    return arr.map((v, i) => [P + (i / (n - 1)) * (W - P * 2), P + (1 - v / maxV) * (H - P * 2)] as [number, number]);
  }
  const pA = pts(ativos), pE = pts(ent), pS = pts(sai);
  function poly(a: [number, number][]) { return a.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" "); }
  let s = "";
  for (let g = 0; g <= 3; g++) {
    const yy = P + g * ((H - P * 2) / 3);
    const v = Math.round(maxV * (1 - g / 3));
    s += `<line x1="${P}" y1="${yy.toFixed(1)}" x2="${W - 8}" y2="${yy.toFixed(1)}" stroke="#EDE5D8" stroke-width="1"/>`;
    s += `<text x="${P - 4}" y="${(yy + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="#9B8B7A">${v}</text>`;
  }
  s += `<polygon points="${P},${H - P} ${poly(pA)} ${W - P},${H - P}" fill="rgba(201,168,118,.08)"/>`;
  s += `<polyline points="${poly(pA)}" fill="none" stroke="#C9A876" stroke-width="2" stroke-linejoin="round"/>`;
  s += `<polyline points="${poly(pE)}" fill="none" stroke="#10B981" stroke-width="1.5" stroke-dasharray="4 3"/>`;
  s += `<polyline points="${poly(pS)}" fill="none" stroke="#EF4444" stroke-width="1.5" stroke-dasharray="4 3"/>`;
  const last = pA[pA.length - 1];
  s += `<circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="4" fill="#C9A876"/>`;
  months.forEach(({ label }, i) => {
    const x = P + (i / (n - 1)) * (W - P * 2);
    s += `<text x="${x.toFixed(1)}" y="${H - 4}" text-anchor="middle" font-size="9" fill="#9B8B7A">${label}</text>`;
  });
  s += `<circle cx="12" cy="12" r="4" fill="#C9A876"/><text x="20" y="16" font-size="10" fill="#5C4A35">Ativos</text>`;
  s += `<line x1="68" y1="12" x2="82" y2="12" stroke="#10B981" stroke-width="1.5" stroke-dasharray="4 3"/><text x="86" y="16" font-size="10" fill="#5C4A35">Entradas</text>`;
  s += `<line x1="148" y1="12" x2="162" y2="12" stroke="#EF4444" stroke-width="1.5" stroke-dasharray="4 3"/><text x="166" y="16" font-size="10" fill="#5C4A35">Saídas</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" class="${styles.chartSvg}" xmlns="http://www.w3.org/2000/svg">${s}</svg>`;
}

function buildBarSvg(mentorados: Array<{ prazo: Date | null }>): string {
  const months = getLast12Months();
  const W = 520, H = 130, P = 32, gap = 3;
  const vencArr = months.map(({ key }) =>
    mentorados.filter(d => d.prazo && new Date(d.prazo).toISOString().startsWith(key)).length
  );
  const maxV = Math.max(...vencArr, 1);
  const gridMax = Math.ceil(maxV / 10) * 10 || 10;
  const bw = (W - P * 2 - gap * (months.length - 1)) / months.length;
  const now = new Date();
  const curKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  let s = "";
  [0, Math.round(gridMax * 0.33), Math.round(gridMax * 0.67), gridMax].forEach(v => {
    const yy = P + (1 - v / gridMax) * (H - P * 2);
    s += `<line x1="${P}" y1="${yy.toFixed(1)}" x2="${W - 4}" y2="${yy.toFixed(1)}" stroke="#EDE5D8" stroke-width="1"/>`;
    s += `<text x="${P - 4}" y="${(yy + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="#9B8B7A">${v}</text>`;
  });
  months.forEach(({ key, label }, i) => {
    const x = P + i * (bw + gap);
    const venc = vencArr[i];
    const isCur = key === curKey;
    if (venc > 0) {
      const vh = Math.max((venc / gridMax) * (H - P * 2), 2);
      const vy = P + (H - P * 2) - vh;
      s += `<rect x="${x.toFixed(1)}" y="${vy.toFixed(1)}" width="${bw.toFixed(1)}" height="${vh.toFixed(1)}" fill="${isCur ? "#C9A876" : "#EDE5D8"}" rx="2"/>`;
    }
    s += `<text x="${(x + bw / 2).toFixed(1)}" y="${H - 2}" text-anchor="middle" font-size="8" fill="#9B8B7A">${label}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" class="${styles.chartSvg}" xmlns="http://www.w3.org/2000/svg">${s}</svg>`;
}

function buildDonutSvg(mentorados: Array<{ tipo: string }>): string {
  const progDefs = [
    { l: "Nexus 1", k: "Nexus 1", c: "#0E152F" },
    { l: "Nexus 2", k: "Nexus 2", c: "#73452B" },
    { l: "Nexus 3", k: "Nexus 3", c: "#C9A876" },
    { l: "Atlas", k: "Atlas", c: "#E8DEC4" },
    { l: "Delta", k: "Delta", c: "#9B8B7A" },
  ];
  const progs = progDefs
    .map(p => ({ ...p, v: mentorados.filter(d => d.tipo === p.k).length }))
    .filter(p => p.v > 0);
  const tot = progs.reduce((a, p) => a + p.v, 0);
  const cx = 65, cy = 65, R = 50, r = 32;
  let angle = -Math.PI / 2;
  let s = "";
  progs.forEach(p => {
    const a = (p.v / tot) * Math.PI * 2;
    const x1 = cx + R * Math.cos(angle), y1 = cy + R * Math.sin(angle);
    const x2 = cx + R * Math.cos(angle + a), y2 = cy + R * Math.sin(angle + a);
    const xi = cx + r * Math.cos(angle), yi = cy + r * Math.sin(angle);
    const xo = cx + r * Math.cos(angle + a), yo = cy + r * Math.sin(angle + a);
    const lg = a > Math.PI ? 1 : 0;
    s += `<path d="M${xi.toFixed(1)},${yi.toFixed(1)} L${x1.toFixed(1)},${y1.toFixed(1)} A${R},${R} 0 ${lg},1 ${x2.toFixed(1)},${y2.toFixed(1)} L${xo.toFixed(1)},${yo.toFixed(1)} A${r},${r} 0 ${lg},0 ${xi.toFixed(1)},${yi.toFixed(1)} Z" fill="${p.c}" stroke="white" stroke-width="1.5"/>`;
    angle += a;
  });
  s += `<text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="13" font-weight="800" fill="#0E152F">${tot}</text>`;
  s += `<text x="${cx}" y="${cy + 12}" text-anchor="middle" font-size="9" fill="#9B8B7A">total</text>`;
  progs.forEach((p, i) => {
    const lx = 140, ly = 14 + i * 20;
    s += `<rect x="${lx}" y="${ly - 7}" width="8" height="8" fill="${p.c}" rx="1"/>`;
    s += `<text x="${lx + 12}" y="${ly}" font-size="10" fill="#5C4A35">${p.l}</text>`;
    s += `<text x="195" y="${ly}" text-anchor="end" font-size="10" font-weight="600" fill="#0E152F">${p.v}</text>`;
  });
  return `<svg viewBox="0 0 200 130" class="${styles.chartSvg}" xmlns="http://www.w3.org/2000/svg">${s}</svg>`;
}

export default async function DashboardPage() {
  const mentorados = await prisma.mentorada.findMany({
    select: { inicio: true, prazo: true, status: true, tipo: true, saude: true, nome: true },
    orderBy: { nome: "asc" },
  });

  const now = new Date();
  const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const mesLabel = now.toLocaleDateString("pt-BR", { month: "long" });
  const mesLabelCap = mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1);

  const tot = mentorados.length;
  const atv = mentorados.filter(d => d.status === "Ativo").length;
  const enc = mentorados.filter(d => d.status === "Encerrado").length;
  const renov = mentorados.filter(d => d.status === "Em Renovação").length;
  const risco = mentorados.filter(d =>
    (d.status === "Ativo" || d.status === "Em Andamento") && d.saude === "Risco"
  ).length;
  const entradas = mentorados.filter(d =>
    d.inicio && new Date(d.inicio).toISOString().startsWith(mesAtual)
  ).length;
  const ltvVals = mentorados.filter(d => d.prazo).map(d => ltvMonths(d));
  const ltvMed = ltvVals.length ? Math.round(ltvVals.reduce((a, b) => a + b, 0) / ltvVals.length) : 0;

  const saudavel = mentorados.filter(d => (d.status === "Ativo" || d.status === "Em Andamento") && d.saude === "Saudável").length;
  const atencao = mentorados.filter(d => (d.status === "Ativo" || d.status === "Em Andamento") && d.saude === "Atenção").length;
  const totalAtivos = atv + mentorados.filter(d => d.status === "Em Andamento").length;
  const sauPct = totalAtivos > 0 ? Math.round((saudavel / totalAtivos) * 100) : 0;
  const atePct = totalAtivos > 0 ? Math.round((atencao / totalAtivos) * 100) : 0;
  const risPct = totalAtivos > 0 ? Math.round((risco / totalAtivos) * 100) : 0;

  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const proxList = mentorados
    .filter(d => ["Ativo", "Em Renovação", "Em Andamento"].includes(d.status) && d.prazo)
    .map(d => {
      const dias = Math.ceil((new Date(d.prazo!).getTime() - hoje.getTime()) / 86400000);
      return { dias, nome: d.nome, tipo: d.tipo ?? "" };
    })
    .filter(x => x.dias >= 0 && x.dias <= 60)
    .sort((a, b) => a.dias - b.dias)
    .slice(0, 5);

  const lineSvg = buildLineSvg(mentorados.map(m => ({ inicio: m.inicio, prazo: m.prazo, status: m.status })));
  const barSvg = buildBarSvg(mentorados.map(m => ({ prazo: m.prazo })));
  const donutSvg = buildDonutSvg(mentorados.map(m => ({ tipo: m.tipo ?? "" })));

  return (
    <>
      <div className={styles.topbar}>
        <div>
          <div className={styles.pageTitle}>Dashboard</div>
          <div className={styles.pageSub}>Visão geral da base · {now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.kpiGrid}>
          <div className={styles.kpi} style={{ "--kpi-color": "#C9A876" } as React.CSSProperties}>
            <div className={styles.kpiLabel}>Total de Mentorados</div>
            <div className={styles.kpiValue}>{tot}</div>
            <div className={styles.kpiDelta}>Histórico completo da base</div>
          </div>
          <div className={styles.kpi} style={{ "--kpi-color": "#10B981" } as React.CSSProperties}>
            <div className={styles.kpiLabel}>Ativos</div>
            <div className={styles.kpiValue}>{atv}</div>
            <div className={styles.kpiDelta}>Contratos vigentes</div>
          </div>
          <div className={styles.kpi} style={{ "--kpi-color": "#73452B" } as React.CSSProperties}>
            <div className={styles.kpiLabel}>Em Renovação</div>
            <div className={styles.kpiValue}>{renov}</div>
            <div className={styles.kpiDelta}>Encerrando e em decisão</div>
          </div>
          <div className={styles.kpi} style={{ "--kpi-color": "#EF4444" } as React.CSSProperties}>
            <div className={styles.kpiLabel}>Encerrados</div>
            <div className={styles.kpiValue}>{enc}</div>
            <div className={styles.kpiDelta}>Contratos finalizados</div>
          </div>
          <div className={styles.kpi} style={{ "--kpi-color": "#C9A876" } as React.CSSProperties}>
            <div className={styles.kpiLabel}>Novas Entradas</div>
            <div className={styles.kpiValue}>{entradas}</div>
            <div className={styles.kpiDelta}>Iniciaram em {mesLabelCap}</div>
          </div>
          <div className={styles.kpi} style={{ "--kpi-color": "#EF4444" } as React.CSSProperties}>
            <div className={styles.kpiLabel}>Em Risco</div>
            <div className={styles.kpiValue}>{risco}</div>
            <div className={styles.kpiDelta}>Saúde = Risco (ativos)</div>
          </div>
          <div className={styles.kpi} style={{ "--kpi-color": "#C9A876" } as React.CSSProperties}>
            <div className={styles.kpiLabel}>LTV Médio</div>
            <div className={styles.kpiValue}>{ltvMed}m</div>
            <div className={styles.kpiDelta}>Tempo médio com a Turney</div>
          </div>
          <div className={styles.kpi} style={{ "--kpi-color": "#F59E0B" } as React.CSSProperties}>
            <div className={styles.kpiLabel}>🏆 Aprovações em Vaga</div>
            <div className={styles.kpiValue}>0</div>
            <div className={styles.kpiDelta}>Mentoradas aprovadas na base</div>
          </div>
        </div>

        <div className={styles.row2}>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Evolução da Base</div>
            <div className={styles.cardSub}>Últimos 12 meses — ativos, entradas e saídas</div>
            <div dangerouslySetInnerHTML={{ __html: lineSvg }} />
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>Saúde da Base</div>
            <div className={styles.cardSub}>Distribuição por status · ativos</div>
            <div className={styles.hbar}>
              <div className={styles.hbarDot} style={{ background: "#10B981" }} />
              <div className={styles.hbarLabel}>Saudável</div>
              <div className={styles.hbarTrack}>
                <div className={styles.hbarFill} style={{ background: "#10B981", width: `${sauPct}%` }} />
              </div>
              <div className={styles.hbarN}>{saudavel}</div>
            </div>
            <div className={styles.hbar}>
              <div className={styles.hbarDot} style={{ background: "#D97706" }} />
              <div className={styles.hbarLabel}>Atenção</div>
              <div className={styles.hbarTrack}>
                <div className={styles.hbarFill} style={{ background: "#D97706", width: `${atePct}%` }} />
              </div>
              <div className={styles.hbarN}>{atencao}</div>
            </div>
            <div className={styles.hbar}>
              <div className={styles.hbarDot} style={{ background: "#EF4444" }} />
              <div className={styles.hbarLabel}>Risco</div>
              <div className={styles.hbarTrack}>
                <div className={styles.hbarFill} style={{ background: "#EF4444", width: `${risPct}%` }} />
              </div>
              <div className={styles.hbarN}>{risco}</div>
            </div>
            <div className={styles.divider} />
            <div className={styles.cardTitle} style={{ fontSize: "12px", marginBottom: "10px" }}>Próximas Renovações</div>
            {proxList.length === 0 ? (
              <div className={styles.emptyMsg}>Nenhuma renovação nos próximos 60 dias</div>
            ) : (
              proxList.map((item, i) => {
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
              })
            )}
          </div>
        </div>

        <div className={styles.row3}>
          <div className={styles.card} style={{ gridColumn: "span 2" }}>
            <div className={styles.cardTitle}>Vencimentos por Mês</div>
            <div className={styles.cardSub}>Últimos 12 meses</div>
            <div dangerouslySetInnerHTML={{ __html: barSvg }} />
          </div>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Mix de Programas</div>
            <div className={styles.cardSub}>Distribuição da base por produto</div>
            <div dangerouslySetInnerHTML={{ __html: donutSvg }} />
          </div>
        </div>
      </div>
    </>
  );
}
