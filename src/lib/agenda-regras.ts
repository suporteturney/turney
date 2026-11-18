// Leitura da agenda das mentoras (arquivo iCal) — regras puras, sem banco, testáveis.
// Eventos que contam: "Atlas - Mentoria Estratégica - Individual - Fulana and Amanda Dutra",
// "N2 - Mentoria Individual - Fulana and Amanda Dutra", "Mentoria Estratégica - Fulana & Amanda Dutra".

export type EventoAgenda = { inicio: Date; titulo: string; emails: string[] };

// ---------- iCal ----------

const desescapar = (s: string) => s.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1");

// Data e hora de início. Sem fuso explícito, considera horário de Brasília (-03:00).
function dataIcal(prop: string, valor: string): Date | null {
  const m = valor.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (!h) return null; // dia inteiro: não é encontro com horário
  if (z) return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
  const fuso = /TZID=America\/(Manaus|Cuiaba|Porto_Velho|Boa_Vista|Campo_Grande)/i.test(prop) ? 4 : 3;
  return new Date(Date.UTC(+y, +mo - 1, +d, +h + fuso, +mi, +s));
}

export function lerIcal(texto: string): EventoAgenda[] {
  const linhas = texto.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/);
  const eventos: EventoAgenda[] = [];
  let atual: { inicio?: Date | null; titulo?: string; emails: string[]; cancelado?: boolean } | null = null;
  for (const linha of linhas) {
    if (linha === "BEGIN:VEVENT") { atual = { emails: [] }; continue; }
    if (linha === "END:VEVENT") {
      if (atual?.inicio && atual.titulo && !atual.cancelado) eventos.push({ inicio: atual.inicio, titulo: atual.titulo, emails: atual.emails });
      atual = null;
      continue;
    }
    if (!atual) continue;
    const i = linha.indexOf(":");
    if (i < 0) continue;
    const prop = linha.slice(0, i), valor = linha.slice(i + 1);
    const nome = prop.split(";")[0].toUpperCase();
    if (nome === "DTSTART") atual.inicio = dataIcal(prop, valor);
    else if (nome === "SUMMARY") atual.titulo = desescapar(valor).trim();
    else if (nome === "STATUS" && valor.toUpperCase() === "CANCELLED") atual.cancelado = true;
    else if (nome === "ATTENDEE") {
      const e = valor.replace(/^mailto:/i, "").trim().toLowerCase();
      if (e.includes("@")) atual.emails.push(e);
    }
  }
  return eventos;
}

// ---------- Título → nome da mentorada ----------

export function ehMentoriaEstrategica(titulo: string) {
  return /mentoria\s+(estrat[eé]gica|individual)/i.test(titulo) && !/entrevista|pr[eé][\s-]?mentoria/i.test(titulo);
}

// "… - Fulana de Tal and Amanda Dutra" → "Fulana de Tal" (o nome da mentora vem depois do and / e / &).
export function nomeNoTitulo(titulo: string, mentora: string) {
  const primeiro = mentora.trim().split(/\s+/)[0];
  const partes = titulo.split(/\s+-\s+/);
  const trecho = partes.find(p => new RegExp(`\\s(and|e|&)\\s+${primeiro}\\b`, "i").test(p));
  if (!trecho) return null;
  const nome = trecho.replace(new RegExp(`\\s+(and|e|&)\\s+${primeiro}\\b.*$`, "i"), "").replace(/\(copy\)/i, "").trim();
  return nome || null;
}

export const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();

const ATIVOS = ["Ativo", "Em Andamento", "Em Renovação", "Congelado"];

// Acha a mentorada: primeiro pelo e-mail dos convidados; depois por todas as palavras do nome do título
// estarem no nome cadastrado. Precisa de pelo menos nome + sobrenome e de uma única resposta.
export function acharMentorada<T extends { nome: string; email: string | null; status: string }>(
  ev: { titulo: string; emails: string[] }, mentora: { nome: string; email: string }, lista: T[],
): { mentorada: T | null; nome: string | null; motivo?: string } {
  const emails = ev.emails.filter(e => e !== mentora.email.toLowerCase());
  const porEmail = lista.filter(m => m.email && emails.includes(m.email.trim().toLowerCase()));
  const nome = nomeNoTitulo(ev.titulo, mentora.nome);
  if (porEmail.length === 1) return { mentorada: porEmail[0], nome };
  if (!nome) return { mentorada: null, nome, motivo: "não achei o nome da mentorada no título" };
  const palavras = normalizar(nome).split(" ").filter(p => p.length > 1);
  if (palavras.length < 2) return { mentorada: null, nome, motivo: "só tem o primeiro nome no título" };
  let achadas = lista.filter(m => { const n = normalizar(m.nome).split(" "); return palavras.every(p => n.includes(p)); });
  if (achadas.length > 1) {
    const ativas = achadas.filter(m => ATIVOS.includes(m.status));
    if (ativas.length) achadas = ativas;
  }
  if (achadas.length === 1) return { mentorada: achadas[0], nome };
  return { mentorada: null, nome, motivo: achadas.length ? "mais de uma mentorada com esse nome" : "nome não encontrado no cadastro" };
}
