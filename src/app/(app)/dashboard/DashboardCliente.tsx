"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MentoradaDrawer from "@/components/MentoradaDrawer";
import NovoMentoradoModal, { useNovoMentorado } from "@/components/NovoMentoradoModal";
import JornadaModal from "@/components/JornadaModal";
import TextoInline from "@/components/TextoInline";
import StatusRenovacao from "@/components/StatusRenovacao";
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
  negociacao: string | null;
  negociacaoEm: string | null;
  renovacaoStatus: string | null;
  saudeMotivo: string | null;
  motivoVarredura: string | null;
  vagaData: string | null;
  vagaCargo: string | null;
  vagaEmpresa: string | null;
};

type RenovacaoResumo = { mentoradaId: string; acao: string; data: string };

// Painel com a lista por trás de cada número ou pedaço de gráfico.
type ItemLista = { m: Mentorada; info?: string };
type SecaoLista = { titulo?: string; itens: ItemLista[] };
type Lista = { titulo: string; sub?: string; secoes: SecaoLista[] };

const ehAtivo = (d: Mentorada) => d.status === "Ativo" || d.status === "Em Andamento";
const fmtData = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");
const porNome = (a: ItemLista, b: ItemLista) => a.m.nome.localeCompare(b.m.nome, "pt-BR");

// Quem estava ativo, entrou e saiu num mês ("AAAA-MM") — mesma conta do gráfico de evolução.
function movimentoDoMes(data: Mentorada[], key: string) {
  const [y, m] = key.split("-").map(Number);
  const endOfMonth = new Date(y, m, 0);
  const startOfMonth = new Date(y, m - 1, 1);
  return {
    ativos: data.filter(d => {
      if (!d.inicio) return false;
      const ini = new Date(d.inicio);
      const pra = d.prazo ? new Date(d.prazo) : null;
      return ini <= endOfMonth && (pra ? pra >= startOfMonth : ehAtivo(d));
    }),
    entradas: data.filter(d => d.inicio && d.inicio.startsWith(key)),
    saidas: data.filter(d => d.prazo && d.prazo.startsWith(key) && (d.status === "Encerrado" || d.status === "Churn")),
  };
}

const nomeMes = (key: string) => {
  const t = new Date(`${key}-15T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return t.charAt(0).toUpperCase() + t.slice(1);
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

function LineSvg({ data, onMes }: { data: Mentorada[]; onMes: (key: string) => void }) {
  const months = getLast12Months();
  const W = 520, H = 160, P = 36;
  const ativos: number[] = [], ent: number[] = [], sai: number[] = [];
  months.forEach(({ key }) => {
    const mv = movimentoDoMes(data, key);
    ativos.push(mv.ativos.length);
    ent.push(mv.entradas.length);
    sai.push(mv.saidas.length);
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
      {months.map(({ key }, i) => {
        const passo = (W - P * 2) / (n - 1);
        const x = P + i * passo;
        return (
          <rect
            key={`alvo-${key}`} className={styles.alvoMes}
            x={x - passo / 2} y={P - 10} width={passo} height={H - P - 2}
            role="button" tabIndex={0} aria-label={`Ver mentoradas de ${nomeMes(key)}`}
            onClick={() => onMes(key)}
            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onMes(key); } }}
          >
            <title>{`${nomeMes(key)}: ${ativos[i]} ativos · ${ent[i]} entradas · ${sai[i]} saídas — clique para ver`}</title>
          </rect>
        );
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

function BarSvg({ data, onMes }: { data: Mentorada[]; onMes: (key: string) => void }) {
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
            {venc > 0 && (
              <rect
                className={styles.alvoMes} x={x - gap / 2} y={P - 6} width={bw + gap} height={H - P}
                role="button" tabIndex={0} aria-label={`Ver vencimentos de ${nomeMes(key)}`}
                onClick={() => onMes(key)}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onMes(key); } }}
              >
                <title>{`${nomeMes(key)}: ${venc} vencimentos · ${renov} em renovação — clique para ver`}</title>
              </rect>
            )}
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

function DonutSvg({ data, onPrograma }: { data: Mentorada[]; onPrograma: (k: string) => void }) {
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
        fill={p.c} stroke="white" strokeWidth="1.5" className={styles.fatia}
        role="button" tabIndex={0} aria-label={`Ver mentoradas do ${p.l}`}
        onClick={() => onPrograma(p.k)}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPrograma(p.k); } }}>
        <title>{`${p.l}: ${p.v} — clique para ver`}</title>
      </path>
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
          <g key={i} className={styles.legendaBtn} onClick={() => onPrograma(p.k)}>
            <rect x={lx - 4} y={ly - 12} width="70" height="18" fill="transparent" />
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

export default function DashboardCliente({ data, renovacoes }: { data: Mentorada[]; renovacoes: RenovacaoResumo[] }) {
  const router = useRouter();
  const now = new Date();
  const novo = useNovoMentorado();
  const [criada, setCriada] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [jornada, setJornada] = useState<string | null>(null);
  const [filterMes, setFilterMes] = useState("");
  const [filterMentorada, setFilterMentorada] = useState("");
  const [lista, setLista] = useState<Lista | null>(null);
  const [cadastro, setCadastro] = useState<string | null>(null);

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
  const congelados = filtered.filter(d => d.status === "Congelado").length;
  const enc = filtered.filter(d => d.status === "Encerrado" || d.status === "Churn").length;
  const renov = filtered.filter(d => d.status === "Em Renovação").length;
  const risco = filtered.filter(d =>
    (d.status === "Ativo" || d.status === "Em Andamento") && d.saude === "Risco"
  ).length;
  const entradas = filtered.filter(d => d.inicio && d.inicio.startsWith(mesAtual)).length;
  const ltvVals = filtered.filter(d => d.inicio).map(d => ltvMonths(d));
  const ltvMed = ltvVals.length ? Math.round(ltvVals.reduce((a, b) => a + b, 0) / ltvVals.length) : 0;

  const idsFiltrados = new Set(filtered.map(d => d.id));
  const renovsFiltradas = renovacoes.filter(r => idsFiltrados.has(r.mentoradaId) && (!filterMes || r.data.startsWith(filterMes)));
  const nRenov = renovsFiltradas.filter(r => r.acao === "RENOVAÇÃO").length;
  const nUpgrade = renovsFiltradas.filter(r => r.acao === "UPGRADE").length;
  const nDowngrade = renovsFiltradas.filter(r => r.acao === "DOWNGRADE").length;
  const txRenov = tot > 0 ? ((nRenov / tot) * 100).toFixed(1) : "0.0";
  const txRenovSub = `${nRenov} renovações · ${nUpgrade} upgrades${nDowngrade ? ` · ${nDowngrade} downgrades` : ""} · ${txRenov}% da base`;
  const aprovacoes = filtered.filter(d => d.vagaData || d.vagaCargo || d.vagaEmpresa).length;

  const ativos = filtered.filter(d => d.status === "Ativo" || d.status === "Em Andamento");
  const saudavel = ativos.filter(d => d.saude === "Saudável").length;
  const atencao = ativos.filter(d => d.saude === "Atenção").length;
  const totalAtivos = ativos.length;
  const sauPct = totalAtivos > 0 ? Math.round((saudavel / totalAtivos) * 100) : 0;
  const atePct = totalAtivos > 0 ? Math.round((atencao / totalAtivos) * 100) : 0;
  const risPct = totalAtivos > 0 ? Math.round((risco / totalAtivos) * 100) : 0;

  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const diasAte = (iso: string) => Math.ceil((new Date(iso).getTime() - hoje.getTime()) / 86400000);

  const criticos = filtered
    .filter(d => ["Ativo", "Em Andamento", "Em Renovação"].includes(d.status) && d.saude === "Risco")
    .sort((a, b) => (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999"));

  const pipeline = filtered
    .filter(d => d.status !== "Encerrado" && d.status !== "Churn")
    .filter(d => d.status === "Em Renovação" || !!d.renovacaoStatus || (d.prazo && diasAte(d.prazo) >= -30 && diasAte(d.prazo) <= 60))
    .sort((a, b) => (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999"));

  const isFiltered = !!filterMes || !!filterMentorada;

  // ── Listas por trás de cada número ──
  const recorte = isFiltered ? ` · ${[filterMes ? nomeMes(filterMes) : "", filterMentorada ? `busca "${filterMentorada}"` : ""].filter(Boolean).join(" · ")}` : "";
  const comPrazo = (m: Mentorada): ItemLista => ({ m, info: m.prazo ? `Encerramento em ${fmtData(m.prazo)}` : undefined });
  const abrir = (titulo: string, itens: ItemLista[], sub?: string) =>
    setLista({ titulo, sub: (sub ?? "") + recorte || undefined, secoes: [{ itens: [...itens].sort(porNome) }] });
  const porId = new Map(data.map(m => [m.id, m]));
  const SAUDE_INFO = (m: Mentorada) => m.saudeMotivo || m.motivoVarredura || (m.prazo ? `Encerramento em ${fmtData(m.prazo)}` : undefined);

  const listas = {
    total: () => abrir("Total de mentorados", filtered.map(comPrazo), "Toda a base"),
    ativos: () => abrir("Ativos", ativos.map(comPrazo), "Status Ativo ou Em Andamento"),
    renovacao: () => abrir("Em Renovação", filtered.filter(d => d.status === "Em Renovação").map(comPrazo)),
    encerrados: () => abrir("Encerrados", filtered.filter(d => d.status === "Encerrado" || d.status === "Churn")
      .map(m => ({ m, info: `${m.status === "Churn" ? "Cancelou (Churn)" : "Encerrado"}${m.prazo ? ` · ${fmtData(m.prazo)}` : ""}` }))),
    renovacoes: () => {
      const grupo = (acao: string, titulo: string, singular: string): SecaoLista => ({
        titulo,
        itens: renovsFiltradas
          .filter(r => r.acao === acao && porId.has(r.mentoradaId))
          .sort((a, b) => b.data.localeCompare(a.data))
          .map(r => ({ m: porId.get(r.mentoradaId)!, info: `${singular} em ${fmtData(r.data)}` })),
      });
      setLista({
        titulo: "Renovações",
        sub: (filterMes ? "Registradas no mês" : "Todas as registradas") + recorte,
        secoes: [grupo("RENOVAÇÃO", "Renovações", "Renovou"), grupo("UPGRADE", "Upgrades", "Upgrade"), grupo("DOWNGRADE", "Downgrades", "Downgrade")].filter(x => x.itens.length),
      });
    },
    entradas: () => abrir(`Novas entradas · ${mesLabelCap}`, filtered.filter(d => d.inicio && d.inicio.startsWith(mesAtual))
      .map(m => ({ m, info: `Início em ${fmtData(m.inicio)}` }))),
    risco: () => abrir("Em Risco", ativos.filter(d => d.saude === "Risco").map(m => ({ m, info: SAUDE_INFO(m) })), "Ativos com saúde Risco"),
    saude: (nivel: string) => abrir(`Saúde: ${nivel}`, ativos.filter(d => d.saude === nivel).map(m => ({ m, info: SAUDE_INFO(m) })), "Mentoradas ativas"),
    ltv: () => setLista({
      titulo: "Tempo com a Turney",
      sub: `Média de ${ltvMed} meses${recorte}`,
      secoes: [{ itens: filtered.filter(d => d.inicio).map(m => ({ m, info: `${ltvMonths(m)} meses · desde ${fmtData(m.inicio)}` }))
        .sort((a, b) => ltvMonths(b.m) - ltvMonths(a.m)) }],
    }),
    aprovacoes: () => abrir("Aprovações em vaga", filtered.filter(d => d.vagaData || d.vagaCargo || d.vagaEmpresa)
      .map(m => ({ m, info: [m.vagaCargo, m.vagaEmpresa, m.vagaData ? fmtData(m.vagaData) : ""].filter(Boolean).join(" · ") || "Aprovada" }))),
    evolucao: (key: string) => {
      const mv = movimentoDoMes(filtered, key);
      setLista({
        titulo: `Evolução da base · ${nomeMes(key)}`,
        secoes: [
          { titulo: "Entradas", itens: mv.entradas.map(m => ({ m, info: `Início em ${fmtData(m.inicio)}` })).sort(porNome) },
          { titulo: "Saídas", itens: mv.saidas.map(m => ({ m, info: `${m.status} · ${fmtData(m.prazo)}` })).sort(porNome) },
          { titulo: "Ativos no mês", itens: mv.ativos.map(comPrazo).sort(porNome) },
        ],
      });
    },
    vencimentos: (key: string) => {
      const vencem = filtered.filter(d => d.prazo && d.prazo.startsWith(key));
      setLista({
        titulo: `Vencimentos · ${nomeMes(key)}`,
        secoes: [
          { titulo: "Em Renovação", itens: vencem.filter(d => d.status === "Em Renovação").map(comPrazo).sort(porNome) },
          { titulo: "Demais vencimentos", itens: vencem.filter(d => d.status !== "Em Renovação").map(m => ({ m, info: `${m.status} · ${fmtData(m.prazo)}` })).sort(porNome) },
        ],
      });
    },
    programa: (tipo: string) => abrir(tipo, filtered.filter(d => d.tipo === tipo).map(comPrazo), "Por programa · todos os status"),
  };

  return (
    <>
      <div className={styles.topbar}>
        <div>
          <div className={styles.pageTitle}>Dashboard</div>
          <div className={styles.pageSub}>Visão estratégica da base de mentorados — clique em qualquer número ou gráfico para ver quem está nele</div>
        </div>
        <div className={styles.topbarRight}>
          <span className={styles.topbarDate}>
            {now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </span>
          <button className={styles.btnPrimary} onClick={novo.abrir}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {novo.temRascunho ? "Continuar cadastro" : "Novo Mentorado"}
          </button>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.filterBar}>
          <div className={styles.filterGroup}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.filterIcon}>
              <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <select value={filterMes} onChange={e => setFilterMes(e.target.value)} className={styles.filterSelect} aria-label="Filtrar por mês">
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
              aria-label="Buscar mentorada"
            />
          </div>
          {isFiltered && (
            <button className={styles.clearBtn} onClick={() => { setFilterMes(""); setFilterMentorada(""); }}>
              ✕ Limpar
            </button>
          )}
        </div>

        {/* KPIs */}
        <div className={styles.kpiGrid}>
          <KpiCard label="Total de Mentorados" value={tot} delta="Histórico completo da base" color="#C9A876" onClick={listas.total} />
          <KpiCard label="Ativos" value={atv} delta={congelados ? `Contratos vigentes · ${congelados} congelada${congelados > 1 ? "s" : ""} fora da conta` : "Contratos vigentes"} color="#10B981" onClick={listas.ativos} />
          <KpiCard label="Em Renovação" value={renov} delta="Encerrando e em decisão" color="#73452B" onClick={listas.renovacao} />
          <KpiCard label="Encerrados" value={enc} delta="Contratos finalizados" color="#EF4444" onClick={listas.encerrados} />
          <KpiCard label="Renovações" value={`${txRenov}%`} delta={txRenovSub} color="#10B981" onClick={listas.renovacoes} />
          <KpiCard label="Novas Entradas" value={entradas} delta={`Iniciaram em ${mesLabelCap}`} color="#C9A876" onClick={listas.entradas} />
          <KpiCard label="Em Risco" value={risco} delta="Saúde = Risco (ativos)" color="#EF4444" onClick={listas.risco} />
          <KpiCard label="LTV Médio" value={`${ltvMed}m`} delta="Tempo médio com a Turney" color="#C9A876" onClick={listas.ltv} />
          <KpiCard label="🏆 Aprovações em Vaga" value={aprovacoes} delta="Mentoradas aprovadas na base" color="#F59E0B" onClick={listas.aprovacoes} />
        </div>

        {/* Row 2 */}
        <div className={styles.row2}>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Evolução da Base</div>
            <div className={styles.cardSub}>Últimos 12 meses — ativos, entradas e saídas</div>
            <LineSvg data={filtered} onMes={listas.evolucao} />
          </div>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Saúde da Base</div>
            <div className={styles.cardSub}>Distribuição por status · ativos</div>
            <HBar label="Saudável" color="#10B981" pct={sauPct} n={saudavel} onClick={() => listas.saude("Saudável")} />
            <HBar label="Atenção" color="#D97706" pct={atePct} n={atencao} onClick={() => listas.saude("Atenção")} />
            <HBar label="Risco" color="#EF4444" pct={risPct} n={risco} onClick={() => listas.saude("Risco")} />
            <div className={styles.divider} />
            <div className={styles.sectionMini}>
              Críticos agora <span className={styles.criticoCount}>{criticos.length}</span>
            </div>
            {criticos.length === 0 ? (
              <div className={styles.emptyMsg}>Nenhuma mentorada ativa em risco.</div>
            ) : (
              <ul className={styles.criticos}>
                {criticos.map(m => (
                  <li key={m.id}>
                    <button className={styles.criticoNome} onClick={() => setJornada(m.id)} title="Ver jornada">
                      {m.nome}
                    </button>
                    <span className={styles.criticoMotivo}>
                      {m.saudeMotivo || m.motivoVarredura || "Sem motivo registrado — abra a jornada e registre na Saúde da Base"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Row 3 */}
        <div className={styles.row3}>
          <div className={`${styles.card} ${styles.span2}`}>
            <div className={styles.cardTitle}>Taxa de Renovação Mensal</div>
            <div className={styles.cardSub}>Últimos 12 meses — vencimentos vs em renovação</div>
            <BarSvg data={filtered} onMes={listas.vencimentos} />
          </div>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Por Programa</div>
            <div className={styles.cardSub}>Distribuição total</div>
            <DonutSvg data={filtered} onPrograma={listas.programa} />
          </div>
        </div>

        {/* Pipeline */}
        <div className={styles.card} style={{ marginBottom: 0 }}>
          <div className={styles.pipelineHead}>
            <div>
              <div className={styles.cardTitle}>Pipeline de Renovações</div>
              <div className={styles.cardSub}>Em renovação, com status definido ou vencendo em até 60 dias — edite aqui ou na aba Renovações</div>
            </div>
            <span className={styles.pipelineCount}>{pipeline.length} na lista</span>
          </div>
          {pipeline.length === 0 ? (
            <div className={styles.emptyMsg}>Nenhuma negociação de renovação em aberto.</div>
          ) : (
            <div className={styles.tblWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Programa</th>
                    <th>Prazo</th>
                    <th>Status de renovação</th>
                    <th className={styles.thNegoc}>Andamento da negociação</th>
                  </tr>
                </thead>
                <tbody>
                  {pipeline.map(m => {
                    const dias = m.prazo ? diasAte(m.prazo) : null;
                    return (
                      <tr key={m.id}>
                        <td>
                          <button className={styles.nomeBtn} onClick={() => setJornada(m.id)} title="Ver jornada">{m.nome}</button>
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
                          <StatusRenovacao mentorada={m} valor={m.renovacaoStatus} onRenovado={() => router.refresh()} />
                        </td>
                        <td className={styles.tdNegoc}>
                          <TextoInline
                            mentoradaId={m.id}
                            campo="negociacao"
                            valor={m.negociacao}
                            atualizadoEm={m.negociacaoEm}
                            placeholder="Escreva o andamento da negociação…"
                            ariaLabel={`Andamento da negociação de ${m.nome}`}
                            onSalvo={() => {}}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {novo.aberto && (
        <NovoMentoradoModal
          onClose={novo.fechar}
          onCriado={(id, nome) => {
            novo.fechar();
            setCriada(id);
            setToast(`${nome} cadastrada`);
            window.setTimeout(() => setToast(null), 2600);
            router.refresh();
          }}
        />
      )}
      {criada && (
        <MentoradaDrawer
          key={criada}
          id={criada}
          onClose={() => setCriada(null)}
          onChanged={() => router.refresh()}
        />
      )}
      {lista && <ListaPainel lista={lista} onFechar={() => setLista(null)} onAbrir={setJornada} />}
      {jornada && (
        <JornadaModal
          key={jornada} id={jornada} onClose={() => setJornada(null)}
          onAbrirCadastro={() => { setCadastro(jornada); setJornada(null); }}
        />
      )}
      {cadastro && (
        <MentoradaDrawer key={cadastro} id={cadastro} onClose={() => setCadastro(null)} onChanged={() => router.refresh()} />
      )}
      {toast && <div className={styles.toast} role="status">{toast}</div>}
    </>
  );
}

function KpiCard({ label, value, delta, color, onClick }: { label: string; value: string | number; delta: string; color: string; onClick: () => void }) {
  return (
    <button type="button" className={`${styles.kpi} ${styles.kpiBtn}`} style={{ "--kpi-color": color } as React.CSSProperties} onClick={onClick}>
      <div className={styles.kpiLabel}>{label}<span className={styles.kpiVer} aria-hidden="true">ver lista →</span></div>
      <div className={styles.kpiValue}>{value}</div>
      <div className={styles.kpiDelta}>{delta}</div>
    </button>
  );
}

function HBar({ label, color, pct, n, onClick }: { label: string; color: string; pct: number; n: number; onClick: () => void }) {
  return (
    <button type="button" className={`${styles.hbar} ${styles.hbarBtn}`} onClick={onClick} aria-label={`Ver mentoradas com saúde ${label} (${n})`}>
      <div className={styles.hbarDot} style={{ background: color }} />
      <div className={styles.hbarLabel}>{label}</div>
      <div className={styles.hbarTrack}>
        <div className={styles.hbarFill} style={{ background: color, width: `${pct}%` }} />
      </div>
      <div className={styles.hbarN}>{n}</div>
    </button>
  );
}

const STATUS_CHIP: Record<string, string> = {
  "Ativo": styles.chipOk, "Em Andamento": styles.chipOk, "Em Renovação": styles.chipRenov,
  "Congelado": styles.chipCong, "Encerrado": styles.chipFim, "Churn": styles.chipFim,
};
const SAUDE_CHIP: Record<string, string> = { "Saudável": styles.chipOk, "Atenção": styles.chipAte, "Risco": styles.chipRis };

function ListaPainel({ lista, onFechar, onAbrir }: { lista: Lista; onFechar: () => void; onAbrir: (id: string) => void }) {
  const [busca, setBusca] = useState("");
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onFechar]);

  const q = busca.trim().toLowerCase();
  const secoes = lista.secoes.map(sec => ({ ...sec, itens: q ? sec.itens.filter(i => i.m.nome.toLowerCase().includes(q) || i.m.tipo.toLowerCase().includes(q)) : sec.itens }));
  const total = lista.secoes.reduce((a, sec) => a + sec.itens.length, 0);
  const visiveis = secoes.reduce((a, sec) => a + sec.itens.length, 0);

  return (
    <div className={styles.listaFundo} onClick={onFechar}>
      <aside className={styles.listaPainel} role="dialog" aria-modal="true" aria-labelledby="lista-titulo" onClick={e => e.stopPropagation()}>
        <header className={styles.listaTopo}>
          <div>
            <h2 id="lista-titulo" className={styles.listaTitulo}>{lista.titulo} <span>{total}</span></h2>
            {lista.sub && <p className={styles.listaSub}>{lista.sub}</p>}
          </div>
          <button className={styles.listaFechar} onClick={onFechar} aria-label="Fechar lista">×</button>
        </header>
        {total > 6 && (
          <input
            className={styles.listaBusca} type="search" placeholder="Filtrar por nome ou programa…"
            value={busca} onChange={e => setBusca(e.target.value)} aria-label="Filtrar a lista" autoFocus
          />
        )}
        <div className={styles.listaCorpo}>
          {!total && <p className={styles.emptyMsg}>Ninguém aqui.</p>}
          {!!total && !visiveis && <p className={styles.emptyMsg}>Ninguém com esse nome nesta lista.</p>}
          {secoes.map((sec, i) => (!sec.itens.length ? null : (
            <section key={i}>
              {sec.titulo && <h3 className={styles.listaSecao}>{sec.titulo} <span>{sec.itens.length}</span></h3>}
              <ul className={styles.listaItens}>
                {sec.itens.map((it, j) => (
                  <li key={`${it.m.id}-${j}`}>
                    <button className={styles.listaNome} onClick={() => onAbrir(it.m.id)} title="Ver jornada">{it.m.nome}</button>
                    <div className={styles.listaChips}>
                      <span className={styles.chip}>{it.m.tipo}</span>
                      <span className={`${styles.chip} ${STATUS_CHIP[it.m.status] ?? ""}`}>{it.m.status}</span>
                      {it.m.saude && <span className={`${styles.chip} ${SAUDE_CHIP[it.m.saude] ?? ""}`}>{it.m.saude}</span>}
                    </div>
                    {it.info && <div className={styles.listaInfo}>{it.info}</div>}
                  </li>
                ))}
              </ul>
            </section>
          )))}
        </div>
      </aside>
    </div>
  );
}
