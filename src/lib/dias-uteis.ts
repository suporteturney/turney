// Dias úteis: segunda a sexta, sem os feriados nacionais (e Carnaval).
// Datas no formato "AAAA-MM-DD". Funciona no servidor e no navegador.

const DIA = 86_400_000;

// Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher).
function pascoa(ano: number) {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return Date.UTC(ano, mes - 1, dia);
}

const cache = new Map<number, Set<string>>();
function feriados(ano: number) {
  let s = cache.get(ano);
  if (s) return s;
  const fixos = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"].map(md => `${ano}-${md}`);
  const p = pascoa(ano);
  // Carnaval (segunda e terça), Sexta-feira Santa e Corpus Christi.
  const moveis = [-48, -47, -2, 60].map(n => new Date(p + n * DIA).toISOString().slice(0, 10));
  s = new Set([...fixos, ...moveis]);
  cache.set(ano, s);
  return s;
}

export function ehDiaUtil(iso: string) {
  const t = Date.parse(iso.slice(0, 10));
  const semana = new Date(t).getUTCDay();
  return semana !== 0 && semana !== 6 && !feriados(+iso.slice(0, 4)).has(iso.slice(0, 10));
}

// Data do N-ésimo dia útil depois de `iso` (o próprio dia não conta).
export function somarDiasUteis(iso: string, n: number) {
  let t = Date.parse(iso.slice(0, 10));
  let faltam = n;
  while (faltam > 0) {
    t += DIA;
    if (ehDiaUtil(new Date(t).toISOString())) faltam--;
  }
  return new Date(t).toISOString().slice(0, 10);
}

// Hoje no horário de Brasília, "AAAA-MM-DD".
export const hojeISO = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
