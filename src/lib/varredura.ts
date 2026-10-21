export type Banda = "vermelho" | "amarelo" | "verde";

export const BANDAS: { k: Banda; label: string; titulo: string; cor: string }[] = [
  { k: "vermelho", label: "Vermelho", titulo: "Vermelho — contato prioritário", cor: "#B23A2E" },
  { k: "amarelo", label: "Amarelo", titulo: "Amarelo — pendência a acompanhar", cor: "#A9660A" },
  { k: "verde", label: "Verde", titulo: "Verde — em dia", cor: "#2E7D4F" },
];
export const PESO_BANDA: Record<Banda, number> = { vermelho: 0, amarelo: 1, verde: 2 };
export const SAUDE_DA_BANDA: Record<Banda, string> = { vermelho: "Risco", amarelo: "Atenção", verde: "Saudável" };

export const LISTAS = ["concluido", "pendencias", "atencao", "acompanhar", "perguntar", "retornos", "proximos"] as const;
export type CampoLista = (typeof LISTAS)[number];

export type ItemVarredura = {
  nome: string;
  banda: Banda;
  tag: string | null;
  etapa: string | null;
  status: string | null;
  mensagem: string | null;
  prioridade: number | null;
  prioridadeMotivo: string | null;
} & Record<CampoLista, string[]>;

export type Analise = { bom: string[]; ruim: string[]; invisivel: string[]; melhorias: string[] };

export type VarreduraPayload = {
  data: string;
  programa: string | null;
  titulo: string | null;
  analise: Analise;
  itens: ItemVarredura[];
};

const ALIAS: Record<string, string> = {
  name: "nome", band: "banda", stage: "etapa", message: "mensagem",
  done: "concluido", pending: "pendencias", attention: "atencao", followUp: "acompanhar",
  ask: "perguntar", owe: "retornos", next: "proximos",
  "concluído": "concluido", "pendências": "pendencias", "atenção": "atencao",
};
const BANDA_ALIAS: Record<string, Banda> = {
  red: "vermelho", vermelho: "vermelho", amber: "amarelo", yellow: "amarelo", amarelo: "amarelo",
  green: "verde", verde: "verde",
};

export const normNome = (s: string) =>
  (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const lista = (v: unknown) =>
  Array.isArray(v) ? v.map(x => (typeof x === "string" ? x.trim() : "")).filter(Boolean) : typeof v === "string" && v.trim() ? [v.trim()] : [];

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dataISO(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

function extrairJSON(texto: string): unknown {
  const t = texto.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(t);
  } catch {
    const ini = Math.min(...["{", "["].map(c => t.indexOf(c)).filter(i => i >= 0));
    const fim = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
    if (Number.isFinite(ini) && fim > ini) return JSON.parse(t.slice(ini, fim + 1));
    throw new Error("json");
  }
}

export function lerVarredura(texto: string): { ok: true; payload: VarreduraPayload; avisos: string[] } | { ok: false; erro: string } {
  let raw: unknown;
  try {
    raw = extrairJSON(texto);
  } catch {
    return { ok: false, erro: "Não consegui ler o conteúdo. Peça ao Claude a varredura em JSON (use o botão “Copiar instruções para o Claude”) e cole aqui." };
  }
  const obj = (Array.isArray(raw) ? { mentoradas: raw } : raw) as Record<string, unknown>;
  const brutos = (obj.mentoradas ?? obj.mentees ?? obj.itens) as unknown;
  if (!Array.isArray(brutos) || brutos.length === 0) {
    return { ok: false, erro: "A varredura não tem a lista de mentoradas (campo “mentoradas”)." };
  }

  const avisos: string[] = [];
  const prioridade = Array.isArray(obj.prioridade ?? obj.priority) ? ((obj.prioridade ?? obj.priority) as Record<string, unknown>[]) : [];
  const ordem = new Map<string, { pos: number; motivo: string | null }>();
  prioridade.forEach((p, i) => {
    const n = str(p.nome ?? p.name);
    if (n) ordem.set(normNome(n), { pos: i + 1, motivo: str(p.motivo ?? p.why) });
  });

  const itens: ItemVarredura[] = [];
  brutos.forEach((b, i) => {
    const r: Record<string, unknown> = {};
    for (const [k, v] of Object.entries((b ?? {}) as Record<string, unknown>)) r[ALIAS[k] ?? k] = v;
    const nome = str(r.nome);
    const banda = BANDA_ALIAS[(str(r.banda) ?? "").toLowerCase()];
    if (!nome) { avisos.push(`Item ${i + 1} sem nome — ignorado.`); return; }
    if (!banda) { avisos.push(`${nome}: cor “${String(r.banda ?? "")}” não reconhecida — ignorada.`); return; }
    const pr = ordem.get(normNome(nome));
    const item = {
      nome, banda,
      tag: str(r.tag), etapa: str(r.etapa), status: str(r.status), mensagem: str(r.mensagem),
      prioridade: pr?.pos ?? null, prioridadeMotivo: pr?.motivo ?? null,
    } as ItemVarredura;
    for (const c of LISTAS) item[c] = lista(r[c]);
    itens.push(item);
  });
  if (!itens.length) return { ok: false, erro: "Nenhuma mentorada válida na varredura." };

  const a = (obj.analise ?? obj.analysis ?? {}) as Record<string, unknown>;
  const data = dataISO(obj.data ?? obj.date);
  if (!data) avisos.push("Sem data na varredura — usei a data de hoje.");

  return {
    ok: true,
    avisos,
    payload: {
      data: data ?? hojeISO(),
      programa: str(obj.programa ?? obj.program),
      titulo: str(obj.titulo ?? obj.title),
      analise: { bom: lista(a.bom), ruim: lista(a.ruim), invisivel: lista(a.invisivel), melhorias: lista(a.melhorias) },
      itens,
    },
  };
}

export type MentoradaRef = { id: string; nome: string; tipo: string; status: string };

export function casarMentorada(nome: string, base: MentoradaRef[], programa?: string | null): string | null {
  const n = normNome(nome);
  let cand = base.filter(m => normNome(m.nome) === n);
  if (cand.length > 1 && programa) cand = cand.filter(m => m.tipo === programa || m.tipo.startsWith(`${programa} `));
  if (cand.length > 1) cand = cand.filter(m => m.status !== "Encerrado" && m.status !== "Churn");
  if (cand.length === 1) return cand[0].id;
  if (cand.length === 0) {
    const t = n.split(" ");
    if (t.length >= 2) {
      const parc = base.filter(m => {
        const mn = normNome(m.nome);
        return mn.startsWith(`${t[0]} `) && mn.includes(t[t.length - 1]);
      });
      const ativos = parc.filter(m => m.status !== "Encerrado" && m.status !== "Churn");
      if (parc.length === 1) return parc[0].id;
      if (ativos.length === 1) return ativos[0].id;
    }
  }
  return null;
}

export function instrucoesClaude(opts: {
  programa: string;
  anterior: { data: string; itens: { nome: string; banda: Banda; tag: string | null }[] } | null;
  mentoradas: { nome: string; status: string }[];
  assinatura: string;
}) {
  const ant = opts.anterior
    ? `\n\nVarredura anterior (${opts.anterior.data.split("-").reverse().join("/")}) para comparar e apontar quem melhorou, piorou ou continua igual:\n` +
      opts.anterior.itens.map(i => `- ${i.nome}: ${i.banda}${i.tag ? ` (${i.tag})` : ""}`).join("\n")
    : "";
  const lista = opts.mentoradas.length
    ? `\n\nMentoradas do ${opts.programa} ativas/em renovação no painel:\n` + opts.mentoradas.map(m => `- ${m.nome} (${m.status})`).join("\n")
    : "";
  return `Faça a varredura de acompanhamento semanal no WhatsApp das mentoradas ${opts.programa} da Turney Academy.

Para cada mentorada, leia as conversas recentes e classifique o engajamento:
- "vermelho": pede contato prioritário (silêncio prolongado, risco de não renovar, problema grave);
- "amarelo": tem pendência real a acompanhar;
- "verde": está em dia.${lista}${ant}

Responda SOMENTE com um JSON neste formato (sem texto antes ou depois):
{
  "data": "AAAA-MM-DD",
  "programa": "${opts.programa}",
  "prioridade": [{ "nome": "Nome completo", "motivo": "por que é prioridade agora" }],
  "analise": {
    "bom": ["o que foi muito bom nesta semana, comparando com a anterior"],
    "ruim": ["o que foi muito ruim"],
    "invisivel": ["situações que a equipe provavelmente não está enxergando (padrões, riscos silenciosos)"],
    "melhorias": ["insights práticos de melhoria para o processo de CS"]
  },
  "mentoradas": [
    {
      "nome": "Nome completo exatamente como no painel",
      "banda": "vermelho | amarelo | verde",
      "tag": "resumo curto da situação",
      "etapa": "em que ponto da jornada ela está",
      "status": "2 a 3 frases sobre o momento atual",
      "concluido": ["o que já foi concluído, com datas"],
      "pendencias": ["pendências da mentorada"],
      "atencao": ["pontos de atenção, com datas e trechos relevantes"],
      "acompanhar": ["o que preciso acompanhar"],
      "perguntar": ["o que preciso perguntar"],
      "retornos": ["retornos que a equipe deve à mentorada"],
      "proximos": ["próximos passos recomendados"],
      "mensagem": "mensagem sugerida para enviar no WhatsApp, assinada por ${opts.assinatura}"
    }
  ]
}`;
}
