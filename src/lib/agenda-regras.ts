// Leitura das agendas do Google (arquivo iCal) — regras puras, sem banco, testáveis.
// Eventos de mentoria: "Atlas - Mentoria Estratégica - Individual - Fulana and Amanda Dutra",
// "N2 - Mentoria Individual - Fulana and Amanda Dutra", "Mentoria Estratégica - Fulana & Amanda Dutra".

export type EventoAgenda = {
  uid: string;
  inicio: Date;
  fim: Date | null;
  titulo: string;
  emails: string[];
  link: string | null;
};

type Bruto = EventoAgenda & {
  rrule: string | null;
  exdates: { ms: number; diaInteiro: boolean }[];
  recurrenceId: number | null;
  cancelado: boolean;
};

const DIA = 86_400_000;
const HORA = 3_600_000;

// ---------- iCal ----------

const desescapar = (s: string) => s.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1");

// Fuso de Brasília (-03:00) quando não vem explícito; alguns estados -04:00.
const fusoDe = (prop: string) => (/TZID=America\/(Manaus|Cuiaba|Porto_Velho|Boa_Vista|Campo_Grande)/i.test(prop) ? 4 : 3);

// Data e hora. Dia inteiro (sem hora) volta null, a não ser que aceite dia inteiro.
function dataIcal(prop: string, valor: string, aceitarDia = false): { ms: number; diaInteiro: boolean } | null {
  const m = valor.trim().match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (!h) return aceitarDia ? { ms: Date.UTC(+y, +mo - 1, +d, 3), diaInteiro: true } : null;
  if (z) return { ms: Date.UTC(+y, +mo - 1, +d, +h, +mi, +s), diaInteiro: false };
  return { ms: Date.UTC(+y, +mo - 1, +d, +h + fusoDe(prop), +mi, +s), diaInteiro: false };
}

const LINK = /https:\/\/(?:meet\.google\.com|[\w.-]*zoom\.us|teams\.microsoft\.com|teams\.live\.com)\/[^\s"<>\\,;]+/i;

function lerBrutos(texto: string): Bruto[] {
  const linhas = texto.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/);
  const eventos: Bruto[] = [];
  let a: Partial<Bruto> & { emails: string[]; exdates: Bruto["exdates"]; texto: string } | null = null;
  for (const linha of linhas) {
    if (linha === "BEGIN:VEVENT") { a = { emails: [], exdates: [], texto: "" }; continue; }
    if (linha === "END:VEVENT") {
      if (a?.inicio && a.titulo) {
        eventos.push({
          uid: a.uid ?? `${a.titulo}-${a.inicio.getTime()}`,
          inicio: a.inicio, fim: a.fim ?? null, titulo: a.titulo, emails: a.emails,
          link: a.link ?? a.texto.match(LINK)?.[0] ?? null,
          rrule: a.rrule ?? null, exdates: a.exdates, recurrenceId: a.recurrenceId ?? null, cancelado: !!a.cancelado,
        });
      }
      a = null;
      continue;
    }
    if (!a) continue;
    const i = linha.indexOf(":");
    if (i < 0) continue;
    const prop = linha.slice(0, i), valor = linha.slice(i + 1);
    const nome = prop.split(";")[0].toUpperCase();
    if (nome === "DTSTART") { const d = dataIcal(prop, valor); a.inicio = d ? new Date(d.ms) : undefined; }
    else if (nome === "DTEND") { const d = dataIcal(prop, valor); a.fim = d ? new Date(d.ms) : null; }
    else if (nome === "SUMMARY") a.titulo = desescapar(valor).trim();
    else if (nome === "UID") a.uid = valor.trim();
    else if (nome === "RRULE") a.rrule = valor.trim();
    else if (nome === "RECURRENCE-ID") a.recurrenceId = dataIcal(prop, valor, true)?.ms ?? null;
    else if (nome === "EXDATE") {
      for (const v of valor.split(",")) { const d = dataIcal(prop, v, true); if (d) a.exdates.push(d); }
    } else if (nome === "STATUS" && valor.toUpperCase() === "CANCELLED") a.cancelado = true;
    else if (nome === "X-GOOGLE-CONFERENCE") a.link = valor.trim();
    else if (nome === "DESCRIPTION" || nome === "LOCATION") a.texto += ` ${valor}`;
    else if (nome === "ATTENDEE") {
      if (/PARTSTAT=DECLINED/i.test(prop)) continue;
      const e = valor.replace(/^mailto:/i, "").trim().toLowerCase();
      if (e.includes("@")) a.emails.push(e);
    }
  }
  return eventos;
}

// ---------- Repetições (RRULE) ----------

const DIAS_SEMANA = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const local = (ms: number) => new Date(ms - 3 * HORA); // relógio de Brasília em campos UTC
const diaLocal = (ms: number) => Math.floor((ms - 3 * HORA) / DIA);

// Datas de início de cada ocorrência entre `de` e `ate` (inclui a original se não tiver repetição).
export function ocorrencias(inicio: number, rrule: string | null, de: number, ate: number): number[] {
  if (!rrule) return inicio >= de && inicio <= ate ? [inicio] : [];
  const r = Object.fromEntries(rrule.split(";").map(p => p.split("=")).map(([k, v]) => [k.toUpperCase(), v ?? ""]));
  const freq = r.FREQ;
  const intervalo = Math.max(1, +r.INTERVAL || 1);
  const total = r.COUNT ? +r.COUNT : Infinity;
  const ateRegra = r.UNTIL ? (() => { const d = dataIcal("", r.UNTIL, true); return d ? (d.diaInteiro ? d.ms + DIA - 1 : d.ms) : Infinity; })() : Infinity;
  const limite = Math.min(ate, ateRegra);
  const saida: number[] = [];
  let n = 0;
  const conta = (t: number) => { n++; if (t >= de && t <= limite) saida.push(t); };
  const MAX = 4000;

  if (freq === "DAILY") {
    for (let t = inicio, k = 0; t <= limite && n < total && k < MAX * 5; t += intervalo * DIA, k++) conta(t);
  } else if (freq === "WEEKLY") {
    const dias = r.BYDAY ? r.BYDAY.split(",").map((d: string) => DIAS_SEMANA.indexOf(d.slice(-2))) : [local(inicio).getUTCDay()];
    const semanaBase = Math.floor((diaLocal(inicio) + 3) / 7); // semanas começando na segunda
    for (let t = inicio, k = 0; t <= limite && n < total && k < MAX * 7; t += DIA, k++) {
      const semana = Math.floor((diaLocal(t) + 3) / 7) - semanaBase;
      if (semana % intervalo === 0 && dias.includes(local(t).getUTCDay())) conta(t);
    }
  } else if (freq === "MONTHLY" || freq === "YEARLY") {
    const b = local(inicio);
    const hm = inicio - (diaLocal(inicio) * DIA + 3 * HORA); // hora do dia em ms
    const nth = r.BYDAY?.match(/^(-?\d)(MO|TU|WE|TH|FR|SA|SU)$/);
    for (let k = 0; n < total && k < MAX; k++) {
      const meses = freq === "MONTHLY" ? k * intervalo : k * 12 * intervalo;
      const ano = b.getUTCFullYear() + Math.floor((b.getUTCMonth() + meses) / 12);
      const mes = (b.getUTCMonth() + meses) % 12;
      let dia: number;
      if (nth) {
        const alvo = DIAS_SEMANA.indexOf(nth[2]);
        const q = +nth[1];
        if (q > 0) {
          const primeiro = new Date(Date.UTC(ano, mes, 1)).getUTCDay();
          dia = 1 + ((alvo - primeiro + 7) % 7) + (q - 1) * 7;
        } else {
          const ultimoDia = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
          const ultimo = new Date(Date.UTC(ano, mes, ultimoDia)).getUTCDay();
          dia = ultimoDia - ((ultimo - alvo + 7) % 7) + (q + 1) * 7;
        }
      } else dia = r.BYMONTHDAY ? +r.BYMONTHDAY : b.getUTCDate();
      const ultimoDia = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
      if (dia < 1 || dia > ultimoDia) continue;
      const t = Date.UTC(ano, mes, dia) + 3 * HORA + hm;
      if (t > limite) break;
      if (t >= inicio) conta(t);
    }
  }
  return saida;
}

// Todos os encontros entre `de` e `ate`, já com as repetições abertas, exceções e cancelamentos aplicados.
export function lerIcal(texto: string, de = new Date(0), ate = new Date(Date.now() + 365 * DIA)): EventoAgenda[] {
  const brutos = lerBrutos(texto);
  const removidas = new Set(brutos.filter(b => b.recurrenceId != null).map(b => `${b.uid}|${b.recurrenceId}`));
  const saida: EventoAgenda[] = [];
  for (const b of brutos) {
    const duracao = b.fim ? b.fim.getTime() - b.inicio.getTime() : null;
    if (b.recurrenceId != null) {
      // Ocorrência alterada (ou cancelada) de um evento que se repete.
      if (!b.cancelado && b.inicio >= de && b.inicio <= ate) saida.push({ ...pick(b), uid: `${b.uid}|${b.recurrenceId}` });
      continue;
    }
    if (b.cancelado) continue;
    for (const t of ocorrencias(b.inicio.getTime(), b.rrule, de.getTime(), ate.getTime())) {
      if (removidas.has(`${b.uid}|${t}`)) continue;
      if (b.exdates.some(x => (x.diaInteiro ? diaLocal(x.ms) === diaLocal(t) : x.ms === t))) continue;
      saida.push({
        ...pick(b),
        uid: b.rrule ? `${b.uid}|${t}` : b.uid,
        inicio: new Date(t),
        fim: duracao != null ? new Date(t + duracao) : null,
      });
    }
  }
  return saida.sort((x, y) => x.inicio.getTime() - y.inicio.getTime());
}
const pick = (b: Bruto): EventoAgenda => ({ uid: b.uid, inicio: b.inicio, fim: b.fim, titulo: b.titulo, emails: b.emails, link: b.link });

// ---------- Tipo do encontro ----------

export type TipoEncontro = "individual" | "grupo" | "onboarding" | "outro";
export const TIPOS_MANUAIS = ["individual", "grupo", "onboarding", "pessoal", "outro"] as const;
export type TipoManual = (typeof TIPOS_MANUAIS)[number];

// Escolha feita à mão: primeiro a do encontro, depois a de todos com o mesmo nome, senão a regra do título.
export type Manuais = { porEvento: Map<string, string>; porTitulo: Map<string, string> };
export const chaveTitulo = (titulo: string) => normalizar(titulo);
export function tipoFinal(ev: { uid: string; titulo: string }, convidados: number, manuais?: Manuais): TipoManual {
  return (manuais?.porEvento.get(ev.uid) ?? manuais?.porTitulo.get(chaveTitulo(ev.titulo)) ?? classificar(ev.titulo, convidados)) as TipoManual;
}

export function classificar(titulo: string, convidados: number): TipoEncontro {
  const t = normalizar(titulo);
  if (/\bonboarding\b|boas vindas|kick ?off|\bintegracao\b/.test(t)) return "onboarding";
  if (/\bindividual\b|\b1 ?[x:]? ?1\b/.test(t)) return "individual";
  if (/\bencontro|ao vivo|\bgrupo\b|\bturma\b|coletiv|\blive\b|master ?class|workshop|hot ?seat|plantao|\bimersao|\btutoria|codigo da aprovacao|\bevolution\b/.test(t)) return "grupo";
  if (/mentoria|estrategic|entrevista|devolutiva|\bsessao\b|roadmap|feedback/.test(t)) return convidados >= 6 ? "grupo" : "individual";
  if (convidados >= 6) return "grupo";
  return "outro";
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
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 :]/g, " ").replace(/\s+/g, " ").trim();
const soLetras = (s: string) => normalizar(s).replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();

const ATIVOS = ["Ativo", "Em Andamento", "Em Renovação", "Congelado"];

function porPalavras<T extends { nome: string; status: string }>(nome: string, lista: T[]) {
  const palavras = soLetras(nome).split(" ").filter(p => p.length > 1);
  if (palavras.length < 2) return [];
  let achadas = lista.filter(m => { const n = soLetras(m.nome).split(" "); return palavras.every(p => n.includes(p)); });
  if (achadas.length > 1) {
    const ativas = achadas.filter(m => ATIVOS.includes(m.status));
    if (ativas.length) achadas = ativas;
  }
  return achadas;
}

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
  if (soLetras(nome).split(" ").filter(p => p.length > 1).length < 2) return { mentorada: null, nome, motivo: "só tem o primeiro nome no título" };
  const achadas = porPalavras(nome, lista);
  if (achadas.length === 1) return { mentorada: achadas[0], nome };
  return { mentorada: null, nome, motivo: achadas.length ? "mais de uma mentorada com esse nome" : "nome não encontrado no cadastro" };
}

// Para mostrar no painel: tenta achar a mentorada de qualquer encontro (individual, onboarding…).
// Grupo não tem uma mentorada só.
export function mentoradaDoEncontro<T extends { nome: string; email: string | null; status: string }>(
  ev: { titulo: string; emails: string[] }, dona: { nome: string; email: string }, lista: T[], tipo: string,
): T | null {
  if (tipo === "grupo" || tipo === "pessoal") return null;
  const r = acharMentorada(ev, dona, lista);
  if (r.mentorada) return r.mentorada;
  // "Onboarding - Fulana Silva", "Fulana Silva | Devolutiva", "Onboarding com Fulana Silva", "Onboarding | Turney Academy (Fulana Silva)"
  // Agendamento do Google: "Onboarding | Turney Academy (Fulana Silva)" — o nome vem entre parênteses.
  const entreParenteses = [...ev.titulo.matchAll(/\(([^)]+)\)/g)].map(m => m[1].trim());
  const trechos = [
    ...entreParenteses,
    ...ev.titulo.split(/\s+[-–|:]\s+|\s+com\s+|\s+(?:and|e|&)\s+/i).map(x => x.replace(/\(.*?\)/g, "").trim()),
  ].filter(Boolean);
  const achadas = new Set<T>();
  for (const tr of trechos) {
    const a = porPalavras(tr, lista);
    if (a.length === 1) achadas.add(a[0]);
  }
  return achadas.size === 1 ? [...achadas][0] : null;
}

// ---------- Encontro em grupo → chave da presença (aba "Presença nos Encontros") ----------

export function chaveDoEncontro(titulo: string): string | null {
  const t = normalizar(titulo);
  if (/hot ?seat/.test(t)) return "hotseat";
  if (/\btutoria/.test(t)) return "tutoria";
  if (/codigo da aprovacao/.test(t)) return "codigoAprovacao";
  if (/\bevolution/.test(t)) return "evolutionDay";
  if (/master ?class/.test(t)) return "masterclassDay";
  return null;
}

// "… | Mentoria Nexus" ou agenda "Mentoria Atlas" → programa do encontro (para listar só quem é de lá).
export function programaDoEncontro(titulo: string, agenda: string): "Atlas" | "Nexus" | null {
  const t = normalizar(`${titulo} ${agenda}`);
  const atlas = /\batlas\b/.test(t), nexus = /\bnexus\b/.test(t);
  return atlas && !nexus ? "Atlas" : nexus && !atlas ? "Nexus" : null;
}
