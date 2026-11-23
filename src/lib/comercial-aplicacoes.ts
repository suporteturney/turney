import "server-only";
import { prisma } from "@/lib/prisma";
import { FORM_HUB, FORM_PRE } from "@/lib/respondi";

// Números das aplicações (formulários do Respondi) para a Visão geral do Comercial.
// Aplicação = formulário terminado. Quem começou e não terminou aparece à parte, uma vez por pessoa.
// Qualificado = quente (pela classificação do formulário).

const DIA = 86_400_000;
const diaBr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });
const somar = (iso: string, n: number) => new Date(Date.parse(iso) + n * DIA).toISOString().slice(0, 10);
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const limites = (de: string, ate: string) => ({ gte: new Date(`${de}T00:00:00-03:00`), lte: new Date(`${ate}T23:59:59.999-03:00`) });

type Temps = { quente: number; morno: number; frio: number; sem: number };
const zero = (): Temps => ({ quente: 0, morno: 0, frio: 0, sem: 0 });
const chaveTemp = (t: string | null): keyof Temps => (t === "quente" || t === "morno" || t === "frio" ? t : "sem");

export async function inicioDasAplicacoes() {
  const r = await prisma.respostaFormulario.findFirst({ orderBy: { preenchidoEm: "asc" }, select: { preenchidoEm: true } });
  return r ? diaBr.format(r.preenchidoEm) : null;
}

async function linhas(de: string, ate: string, form: string) {
  return prisma.respostaFormulario.findMany({
    where: { preenchidoEm: limites(de, ate), ...(form ? { formulario: form } : {}) },
    select: { leadId: true, formulario: true, completa: true, temperatura: true, canal: true, utms: true, preenchidoEm: true },
  });
}

export async function resumoAplicacoes(de: string, ate: string, form: string) {
  const dias = Math.round((Date.parse(ate) - Date.parse(de)) / DIA) + 1;
  // Período anterior do mesmo tamanho, para comparar.
  const antesAte = somar(de, -1), antesDe = somar(de, -dias);
  const [atual, anterior] = await Promise.all([linhas(de, ate, form), linhas(antesDe, antesAte, form)]);

  const conta = (rs: typeof atual) => {
    const completas = rs.filter(r => r.completa);
    const comCompleta = new Set(completas.map(r => r.leadId));
    const t = zero();
    for (const r of completas) t[chaveTemp(r.temperatura)]++;
    const soComecou = rs.filter(r => !r.completa && !comCompleta.has(r.leadId)).filter((r, i, l) => l.findIndex(x => x.leadId === r.leadId) === i);
    return { total: completas.length, incompletas: soComecou.length, temps: t, completas, soComecou };
  };
  const a = conta(atual), b = conta(anterior);

  // Origens: como a pessoa respondeu "onde nos conheceu" / "chegou através do". Mesma resposta com grafia diferente vira uma só.
  const origens = new Map<string, { nome: string; grafias: Map<string, number>; total: number; quentes: number }>();
  for (const r of a.completas) {
    const bruto = r.canal?.trim() || "";
    const k = bruto ? norm(bruto) : "";
    const o = origens.get(k) ?? { nome: "", grafias: new Map(), total: 0, quentes: 0 };
    o.grafias.set(bruto, (o.grafias.get(bruto) ?? 0) + 1);
    o.total++;
    if (r.temperatura === "quente") o.quentes++;
    origens.set(k, o);
  }
  const listaOrigens = [...origens.entries()].map(([k, o]) => ({
    nome: k ? [...o.grafias.entries()].sort((x, y) => y[1] - x[1])[0][0] : "Não informou", total: o.total, quentes: o.quentes,
  })).sort((x, y) => y.total - x.total || x.nome.localeCompare(y.nome, "pt-BR"));

  // UTMs (do link que a pessoa usou): fonte e campanha. Quem começou e não terminou conta à parte, para ver onde se perde gente.
  const utm = (r: (typeof atual)[number], k: string) => {
    const u = r.utms && typeof r.utms === "object" && !Array.isArray(r.utms) ? (r.utms as Record<string, unknown>)[k] : null;
    return typeof u === "string" && u.trim() ? u.trim().toLowerCase().slice(0, 80) : "";
  };
  const porUtm = (k: string) => {
    const m = new Map<string, { total: number; quentes: number; naoTerminaram: number }>();
    const pegar = (v: string) => { const o = m.get(v) ?? { total: 0, quentes: 0, naoTerminaram: 0 }; m.set(v, o); return o; };
    for (const r of a.completas) { const o = pegar(utm(r, k)); o.total++; if (r.temperatura === "quente") o.quentes++; }
    for (const r of a.soComecou) pegar(utm(r, k)).naoTerminaram++;
    return [...m.entries()].map(([nome, o]) => ({ nome: nome || "Sem UTM", ...o }))
      .sort((x, y) => y.total - x.total || y.naoTerminaram - x.naoTerminaram || x.nome.localeCompare(y.nome, "pt-BR"));
  };

  // Por formulário.
  const porForm = [FORM_HUB, FORM_PRE, ...new Set(a.completas.map(r => r.formulario))]
    .filter((f, i, l) => l.indexOf(f) === i && (!form || f === form))
    .map(f => {
      const rs = a.completas.filter(r => r.formulario === f);
      return { formulario: f, total: rs.length, quentes: rs.filter(r => r.temperatura === "quente").length };
    });

  // Série no tempo: por dia até 45 dias, por semana até ~7 meses, depois por mês.
  const passo = dias <= 45 ? "dia" : dias <= 210 ? "semana" : "mes";
  const balde = (iso: string) => {
    if (passo === "dia") return iso;
    if (passo === "mes") return iso.slice(0, 7);
    const d = new Date(iso); return somar(iso, -((d.getUTCDay() + 6) % 7)); // segunda-feira
  };
  const chaves: string[] = [];
  for (let d = de; d <= ate; d = somar(d, 1)) { const k = balde(d); if (chaves.at(-1) !== k) chaves.push(k); }
  const serie = new Map(chaves.map(k => [k, zero()]));
  for (const r of a.completas) {
    const s = serie.get(balde(diaBr.format(r.preenchidoEm)));
    if (s) s[chaveTemp(r.temperatura)]++;
  }

  return {
    de, ate, form, passo,
    total: a.total, incompletas: a.incompletas, temps: a.temps,
    anterior: { de: antesDe, ate: antesAte, total: b.total, quentes: b.temps.quente },
    origens: listaOrigens, porForm, utmSource: porUtm("utm_source"), utmCampaign: porUtm("utm_campaign"),
    serie: chaves.map(k => ({ k, ...serie.get(k)! })),
  };
}
export type ResumoAplicacoes = Awaited<ReturnType<typeof resumoAplicacoes>>;
