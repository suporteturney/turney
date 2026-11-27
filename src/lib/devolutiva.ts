// Regras puras da planilha de devolutivas comportamentais (DISC) da mentora parceira.
// A planilha tem a aba "lista completa" (Nome, email, Data de devolutiva, Perfil, Liderança…)
// e, às vezes, a aba "relatorio da devolutiva" (Nome, Resumo).

export type Situacao = "feita" | "faltou" | "agendada" | "pendente";
export type LinhaDevolutiva = {
  chave: string;
  nome: string;
  email: string | null;
  situacao: Situacao;
  textoData: string | null;
  data: string | null; // AAAA-MM-DD
  perfil: string | null;
  lideranca: string | null;
  resumo: string | null;
};

export const NOME_SITUACAO: Record<Situacao, string> = {
  feita: "Realizada", faltou: "Faltou", agendada: "Agendada", pendente: "Sem data",
};

export const norm = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

const MESES = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const dois = (n: number) => String(n).padStart(2, "0");
const valida = (a: number, m: number, d: number) => {
  const t = new Date(Date.UTC(a, m - 1, d));
  return t.getUTCFullYear() === a && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
};

// Lê "03 de julho de 2024", "13 de março 2025", "03 de julho", "10/07", "10/07/2026" ou a data numérica do Excel.
// Devolve o dia, o mês e o ano (quando escrito).
export function lerDiaMes(texto: string): { d: number; m: number; a: number | null } | null {
  const t = norm(texto);
  if (/^\d{5}(\.\d+)?$/.test(t)) {
    const dia = new Date(Date.UTC(1899, 11, 30) + Math.floor(+t) * 86_400_000);
    return { d: dia.getUTCDate(), m: dia.getUTCMonth() + 1, a: dia.getUTCFullYear() };
  }
  const ext = t.match(/\b(\d{1,2})\s*(?:de\s+)?([a-z]{3,9})\b(?:\s*(?:de\s+)?(\d{4}))?/);
  if (ext) {
    const m = MESES.findIndex(x => x === ext[2] || (ext[2].length >= 3 && x.startsWith(ext[2])));
    if (m >= 0) return { d: +ext[1], m: m + 1, a: ext[3] ? +ext[3] : null };
  }
  const num = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (num) {
    const a = num[3] ? (num[3].length === 2 ? 2000 + +num[3] : +num[3]) : null;
    return { d: +num[1], m: +num[2], a };
  }
  return null;
}

const FALTOU = /\bnao (apareceu|compareceu|veio|foi)\b|faltou|no.?show|desmarcou/;

function limparEmail(s: string) {
  const e = s.replace(/\\/g, "").replace(/\s+/g, "").toLowerCase();
  return /^[^@]+@[^@]+\.[^@]+$/.test(e) ? e : null;
}
const limparNome = (s: string) => s.replace(/[:;,.]+\s*$/, "").replace(/\s+/g, " ").trim();
function limparPerfil(s: string) {
  const p = s.toUpperCase().replace(/[^A-Z]/g, "");
  return /^[DISC]{1,3}$/.test(p) ? p : null;
}
function limparLideranca(s: string) {
  const t = s.trim();
  return t ? t[0].toUpperCase() + t.slice(1) : null;
}

function achaCabecalho(linhas: string[][]) {
  for (let i = 0; i < Math.min(linhas.length, 10); i++) {
    const h = linhas[i].map(norm);
    const nome = h.findIndex(x => x === "nome" || x.startsWith("nome"));
    const email = h.findIndex(x => /e-?mail/.test(x));
    const data = h.findIndex(x => /devolutiva|^data/.test(x));
    if (nome >= 0 && email >= 0 && data >= 0) {
      return {
        linha: i, nome, email, data,
        perfil: h.findIndex(x => /perfil|disc/.test(x)),
        lideranca: h.findIndex(x => /lideran/.test(x)),
      };
    }
  }
  return null;
}

// Mesma pessoa nas duas abas: nome igual, ou um começa com o outro ("Andreia" e "Andreia Matias").
export function mesmoNome(a: string, b: string) {
  const x = norm(limparNome(a)), y = norm(limparNome(b));
  if (!x || !y) return false;
  return x === y || x.startsWith(`${y} `) || y.startsWith(`${x} `);
}

export function lerPlanilhaDevolutivas(abas: { nome: string; linhas: string[][] }[], hoje: string): LinhaDevolutiva[] {
  const lista = abas.map(a => ({ a, c: achaCabecalho(a.linhas) })).find(x => x.c);
  if (!lista || !lista.c) throw new Error("Não achei as colunas Nome, e-mail e Data de devolutiva em nenhuma aba.");
  const { a, c } = lista;

  // Resumos (aba com as colunas Nome e Resumo).
  const resumos: { nome: string; resumo: string }[] = [];
  for (const ab of abas) {
    const i = ab.linhas.findIndex(l => l.some(x => norm(x) === "resumo"));
    if (i < 0) continue;
    const h = ab.linhas[i].map(norm);
    const cn = h.findIndex(x => x.startsWith("nome")), cr = h.indexOf("resumo");
    if (cn < 0) continue;
    for (const l of ab.linhas.slice(i + 1)) if ((l[cn] ?? "").trim() && (l[cr] ?? "").trim()) resumos.push({ nome: l[cn], resumo: l[cr].trim() });
  }

  const brutas = a.linhas.slice(c.linha + 1)
    .map(l => ({ nome: limparNome(l[c.nome] ?? ""), email: limparEmail(l[c.email] ?? ""), texto: (l[c.data] ?? "").trim(), l }))
    .filter(x => x.nome || x.email);

  // Ano que falta ("03 de julho"): a planilha é cronológica, então vale o ano da linha anterior (ou da próxima).
  const dm = brutas.map(b => (b.texto ? lerDiaMes(b.texto) : null));
  const anoHoje = +hoje.slice(0, 4);
  const anos: (number | null)[] = dm.map(x => x?.a ?? null);
  let ultimo: number | null = null;
  for (let i = 0; i < anos.length; i++) {
    if (anos[i] != null) ultimo = anos[i];
    else if (dm[i]) anos[i] = ultimo ?? anos.slice(i + 1).find(x => x != null) ?? null;
  }

  const porChave = new Map<string, LinhaDevolutiva>();
  brutas.forEach((b, i) => {
    const x = dm[i];
    let data: string | null = null;
    if (x) {
      let ano = anos[i] ?? anoHoje;
      if (!valida(ano, x.m, x.d)) ano = NaN;
      if (Number.isFinite(ano)) {
        data = `${ano}-${dois(x.m)}-${dois(x.d)}`;
        // Sem ano escrito e caindo no futuro distante: é do ano anterior.
        if (x.a == null && anos[i] == null && data > hoje) data = `${ano - 1}-${dois(x.m)}-${dois(x.d)}`;
      }
    }
    const tn = norm(b.texto);
    const situacao: Situacao = !b.texto ? "pendente"
      : FALTOU.test(tn) ? "faltou"
      : data ? (data > hoje ? "agendada" : "feita")
      : "pendente";
    const resumo = resumos.find(r => mesmoNome(r.nome, b.nome))?.resumo ?? null;
    const chave = `${b.email ?? norm(b.nome)}|${tn}`;
    porChave.set(chave, {
      chave, nome: b.nome || (b.email ?? ""), email: b.email, situacao, textoData: b.texto || null,
      data: situacao === "pendente" ? null : data,
      perfil: c.perfil >= 0 ? limparPerfil(b.l[c.perfil] ?? "") : null,
      lideranca: c.lideranca >= 0 ? limparLideranca(b.l[c.lideranca] ?? "") : null,
      resumo,
    });
  });
  return [...porChave.values()];
}

// Código do arquivo a partir do link do Drive ou do Planilhas.
export function idDoLink(link: string): string | null {
  const t = link.trim();
  const m = t.match(/\/d\/([\w-]{20,})/) ?? t.match(/[?&]id=([\w-]{20,})/) ?? t.match(/^([\w-]{20,})$/);
  return m ? m[1] : null;
}

export const dataBr = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");
