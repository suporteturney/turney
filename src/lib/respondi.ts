import { whatsappComDDI } from "@/lib/whatsapp";

// Formulários do Respondi → leads do funil. Regras puras (sem banco), usadas no aviso automático e na importação da planilha.

export const TEMPERATURAS = [
  { k: "quente", label: "Quente", icone: "🔥" },
  { k: "morno", label: "Morno", icone: "🌤️" },
  { k: "frio", label: "Frio", icone: "❄️" },
] as const;
export type Temperatura = (typeof TEMPERATURAS)[number]["k"];
export const NOME_TEMP = Object.fromEntries(TEMPERATURAS.map(t => [t.k, `${t.icone} ${t.label}`])) as Record<string, string>;
export const ORDEM_TEMP: Record<string, number> = { quente: 0, morno: 1, frio: 2 };
export const FORM_HUB = "HUB";
export const FORM_PRE = "Pré Mentoria";

export type Resposta = { p: string; r: string };
export type Preenchimento = {
  id: string; formulario: string; completa: boolean; preenchidoEm: Date;
  nome: string; email: string | null; whatsapp: string | null; origem: string | null;
  respostas: Resposta[]; utms: Record<string, string> | null;
};

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const limpar = (s: string) => s.replace(/\*\*/g, "").replace(/\r/g, "").replace(/\n{2,}/g, "\n").trim();
const achar = (rs: Resposta[], re: RegExp, nao?: RegExp) => rs.find(x => re.test(norm(x.p)) && !nao?.test(norm(x.p)))?.r ?? null;

// ---- Classificação ----
// Renda atual vale até 40 pontos, disposição a investir até 35 e inglês até 25. Quente: 65 ou mais. Morno: 35 a 64. Frio: menos de 35.
// Quem não disse que está disposta a investir (respondeu "não" ou não chegou nessa pergunta) fica no máximo em morno.
const EURO = 6; // só para comparar as faixas em € com as faixas em R$
export const PESOS = { renda: 40, investir: 35, ingles: 25 };
export const CORTE = { quente: 65, morno: 35 };

export function notaRenda(r: string | null): number | null {
  if (!r) return null;
  const t = norm(r);
  const nums = [...t.matchAll(/\d[\d.]*(?:,\d+)?/g)].map(m => parseFloat(m[0].replace(/\./g, "").replace(",", "."))).filter(n => Number.isFinite(n));
  if (!nums.length) return /sem renda|nao tenho|nenhuma|desempreg/.test(t) ? 0 : null;
  const moeda = /€|eur/.test(t) ? EURO : 1;
  const base = nums.length >= 2 ? (nums[0] + nums[1]) / 2 : /^\+|acima|mais de|maior|a partir/.test(t) ? nums[0] * 1.2 : nums[0] * 0.9;
  const v = base * moeda;
  return v < 3000 ? 0 : v < 5000 ? 0.25 : v < 8000 ? 0.5 : v < 10000 ? 0.7 : v < 15000 ? 0.85 : 1;
}
export function notaInvestir(r: string | null): number | null {
  if (!r) return null;
  const t = norm(r);
  if (/^sim\b|^estou\b|com certeza|claro/.test(t)) return 1;
  if (/nao sei|talvez|depende|nao tenho certeza|quem sabe|pensar/.test(t)) return 0.3;
  if (/^nao\b/.test(t)) return 0;
  return null;
}
export function notaIngles(r: string | null): number | null {
  if (!r) return null;
  const t = norm(r);
  if (/fluente|nativ|proficien|\bc2\b/.test(t)) return 1;
  if (/avancad|\bc1\b/.test(t)) return 0.85;
  if (/intermedi|\bb1\b|\bb2\b/.test(t)) return 0.5;
  if (/basic|inician|nao falo|nenhum|zero|\ba1\b|\ba2\b/.test(t)) return 0;
  return null;
}
export const criterios = (rs: Resposta[]) => ({
  renda: achar(rs, /renda.*atual/, /sonha/),
  investir: achar(rs, /dispost[oa].*investir/, /^quanto/),
  ingles: achar(rs, /nivel de ingles/),
});

export function classificar(rs: Resposta[]): { temperatura: Temperatura | null; pontuacao: number | null } {
  const c = criterios(rs);
  const n = { renda: notaRenda(c.renda), investir: notaInvestir(c.investir), ingles: notaIngles(c.ingles) };
  if (n.renda === null && n.investir === null && n.ingles === null) return { temperatura: null, pontuacao: null };
  const pontuacao = Math.round((n.renda ?? 0) * PESOS.renda + (n.investir ?? 0) * PESOS.investir + (n.ingles ?? 0) * PESOS.ingles);
  let temperatura: Temperatura = pontuacao >= CORTE.quente ? "quente" : pontuacao >= CORTE.morno ? "morno" : "frio";
  if (temperatura === "quente" && !n.investir) temperatura = "morno";
  return { temperatura, pontuacao };
}

// ---- Leitura ----
export function nomeFormulario(nome: string, rs: Resposta[]): string {
  const n = norm(nome);
  if (/\bhub\b/.test(n)) return FORM_HUB;
  if (/pre.?mentoria|mentoria|consultoria/.test(n)) return FORM_PRE;
  const perguntas = norm(rs.map(x => x.p).join(" "));
  if (/hub de carreira/.test(perguntas)) return FORM_HUB;
  if (/onde voce nos conheceu|nossa consultoria/.test(perguntas)) return FORM_PRE;
  return nome.trim().slice(0, 60) || "Formulário";
}

// Os formulários mandam o número com DDI: "55 38998778909", "5561983790917", "351 914141934".
export function whatsDoForm(v: string | null): string | null {
  const t = (v ?? "").trim();
  const d = t.replace(/\D/g, "");
  if (d.length < 8) return null;
  if (/^\+/.test(t) || /^\d{1,3}\s+\d{6,}$/.test(t)) return `+${d}`;
  if (d.length === 11 && d[2] !== "9") return `+${d}`; // não é celular do Brasil: já veio com DDI (ex.: 1 415…)
  return whatsappComDDI(d);
}
export function origemDoForm(v: string | null): string | null {
  const t = norm(v ?? "");
  if (!t) return null;
  if (/linkedin/.test(t)) return "LinkedIn";
  if (/instagram|^ig\b/.test(t)) return "Instagram";
  if (/youtube/.test(t)) return "YouTube";
  if (/indica|indiac|amig/.test(t)) return "Indicação";
  if (/live|evento|palestra|masterclass/.test(t)) return "Lives / Eventos";
  if (/parceri/.test(t)) return "Parceria";
  return "Outra";
}

function montar(base: { id: string; nomeForm: string; completa: boolean; preenchidoEm: Date; respostas: Resposta[]; utms: Record<string, string> | null }): Preenchimento | null {
  // Pergunta repetida na planilha: vale a que tem resposta.
  const rs: Resposta[] = [];
  for (const x of base.respostas) {
    const p = limpar(x.p).slice(0, 500), r = limpar(x.r).slice(0, 2000);
    if (p && r && !rs.some(y => y.p === p) && rs.length < 80) rs.push({ p, r });
  }
  const email = achar(rs, /e-?mail/)?.toLowerCase().trim() ?? null;
  const whatsapp = whatsDoForm(achar(rs, /whatsapp|telefone|celular/));
  const emailOk = email && /^\S+@\S+\.\S+$/.test(email) ? email.slice(0, 200) : null;
  if (!emailOk && !whatsapp) return null; // sem contato não dá para a SDR chamar
  const nome = achar(rs, /seu nome|^nome\b/)?.replace(/\s+/g, " ").slice(0, 120) || emailOk || whatsapp!;
  return {
    id: base.id.slice(0, 80), formulario: nomeFormulario(base.nomeForm, rs), completa: base.completa, preenchidoEm: base.preenchidoEm,
    nome, email: emailOk, whatsapp, origem: origemDoForm(achar(rs, /nos conheceu|chegou ate esse formulario/)),
    respostas: rs, utms: base.utms,
  };
}

const emTexto = (v: unknown): string => {
  if (v == null) return "";
  if (Array.isArray(v)) return v.map(emTexto).filter(Boolean).join(", ");
  if (typeof v === "object") return Object.values(v as object).map(emTexto).filter(Boolean).join(" ");
  return String(v);
};
const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

// Horário sem fuso ("2026-11-05 12:11:02"): no aviso automático pode vir em UTC ou de Brasília.
// Vale a leitura mais recente que não fique no futuro.
export function dataDoAviso(v: unknown, agora: Date): Date {
  const m = typeof v === "string" ? v.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::(\d{2}))?/) : null;
  if (!m) return agora;
  const utc = new Date(`${m[1]}T${m[2]}:${m[3] ?? "00"}Z`);
  if (Number.isNaN(utc.getTime())) return agora;
  const brasilia = new Date(utc.getTime() + 3 * 3_600_000);
  const limite = agora.getTime() + 10 * 60_000;
  return brasilia.getTime() <= limite ? brasilia : utc.getTime() <= limite ? utc : agora;
}

// Nome do formulário de um aviso, mesmo quando ele não vira cartão.
export function formularioDoAviso(corpo: unknown): string {
  const b = obj(corpo), resp = obj(b.respondent);
  return nomeFormulario(emTexto(obj(b.form).form_name), Object.keys(obj(resp.answers)).map(p => ({ p, r: "" })));
}

// Aviso (webhook) do Respondi.
export function lerAvisoRespondi(corpo: unknown, agora: Date): Preenchimento | null {
  const b = obj(corpo), form = obj(b.form), resp = obj(b.respondent);
  const id = emTexto(resp.respondent_id);
  if (!id) return null;
  let respostas = Object.entries(obj(resp.answers)).map(([p, r]) => ({ p, r: emTexto(r) }));
  if (!respostas.length && Array.isArray(resp.raw_answers)) {
    respostas = resp.raw_answers.map(x => ({ p: emTexto(obj(obj(x).question).question_title), r: emTexto(obj(x).answer) }));
  }
  const utms = Object.fromEntries(Object.entries(obj(resp.respondent_utms)).map(([k, v]) => [k.slice(0, 40), emTexto(v).slice(0, 200)]).filter(([, v]) => v));
  const status = norm(emTexto(resp.status));
  return montar({
    id, nomeForm: emTexto(form.form_name), completa: !status || /^complet/.test(status), preenchidoEm: dataDoAviso(resp.date, agora),
    respostas, utms: Object.keys(utms).length ? utms : null,
  });
}

// Planilha do Respondi (Google Planilhas baixada em .xlsx).
const NAO_PERGUNTA = /^(pontuacao|data|id|status|utm_.*|gclid|fbclid)$/;
export function dataDaPlanilha(v: string): Date | null {
  const t = v.trim();
  const m = t.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) return new Date(`${m[1]}T${m[2].padStart(2, "0")}:${m[3]}:${m[4] ?? "00"}-03:00`);
  const n = Number(t); // data guardada como número do Excel
  if (Number.isFinite(n) && n > 40000 && n < 70000) return new Date(Math.round((n - 25569) * 86_400_000) + 3 * 3_600_000);
  return null;
}
const semNotacao = (v: string) => (/^\d+(\.\d+)?E\+?\d+$/i.test(v) ? Number(v).toFixed(0) : /^\d{10,15}\.0$/.test(v) ? v.slice(0, -2) : v);

export function lerPlanilhaRespondi(linhas: string[][], nomeArquivo: string): { lidos: Preenchimento[]; semContato: number; erro?: string } {
  const cab = linhas[0] ?? [];
  const iId = cab.findIndex(x => norm(x) === "id"), iData = cab.findIndex(x => norm(x) === "data");
  if (iId < 0 || iData < 0 || !cab.some(x => /e-?mail|whatsapp/.test(norm(x)))) {
    return { lidos: [], semContato: 0, erro: "Essa planilha não parece ser a do Respondi (faltam as colunas Data, ID, e-mail ou WhatsApp)." };
  }
  const formulario = nomeFormulario(nomeArquivo, cab.map(p => ({ p, r: "" })));
  if (formulario !== FORM_HUB && formulario !== FORM_PRE) {
    return { lidos: [], semContato: 0, erro: "Não reconheci se a planilha é do forms HUB ou do Pré Mentoria. Baixe de novo do Google sem mudar o nome do arquivo." };
  }
  // O "Status" do Respondi é o último; pode haver uma pergunta vazia com o mesmo nome no meio.
  const iStatus = cab.map(norm).lastIndexOf("status");
  const lidos: Preenchimento[] = [];
  let semContato = 0;
  for (const l of linhas.slice(1)) {
    const id = (l[iId] ?? "").trim(), data = dataDaPlanilha(l[iData] ?? "");
    if (!id || !data) continue;
    const respostas: Resposta[] = [], utms: Record<string, string> = {};
    cab.forEach((p, i) => {
      const r = semNotacao((l[i] ?? "").trim());
      if (!r) return;
      const n = norm(p);
      if (/^utm_/.test(n)) utms[n] = r.slice(0, 200);
      else if (!NAO_PERGUNTA.test(n)) respostas.push({ p, r });
    });
    const status = iStatus >= 0 ? norm(l[iStatus] ?? "") : "";
    const temInvestir = respostas.some(x => /dispost[oa].*investir/.test(norm(x.p)));
    const p = montar({
      id, nomeForm: nomeArquivo, completa: status ? /^complet/.test(status) : temInvestir, preenchidoEm: data,
      respostas, utms: Object.keys(utms).length ? utms : null,
    });
    if (p) lidos.push({ ...p, formulario }); else semContato++;
  }
  return { lidos, semContato };
}
