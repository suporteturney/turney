// Relatório "Consumo do membro por conteúdo" da Hubla → registros por aula.
// Colunas: Membros, ID do membro, E-mail, Módulo, Conteúdo, Tipo de conteúdo, Visualizações totais,
// Taxa de conclusão ("100.00%"), Data de primeiro consumo e Data do último consumo ("21 de ago. de 2026, 09:18:49").

export type LinhaConsumo = {
  email: string; nome: string | null; modulo: string; conteudo: string; tipo: string;
  visualizacoes: number; conclusao: number; primeiro: Date | null; ultimo: Date | null;
};

const MESES: Record<string, number> = { jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5, jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11 };
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Datas da Hubla vêm no horário de Brasília.
export function dataHubla(v: string): Date | null {
  const t = v.trim();
  const m = norm(t).match(/^(\d{1,2}) de ([a-z]{3})[a-z]*\.? de (\d{4})(?:,? (\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m && m[2] in MESES) return new Date(Date.UTC(+m[3], MESES[m[2]], +m[1], +(m[4] ?? 12) + 3, +(m[5] ?? 0), +(m[6] ?? 0)));
  const br = t.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[ ,]+(\d{1,2}):(\d{2}))?/);
  if (br) return new Date(Date.UTC(+br[3], +br[2] - 1, +br[1], +(br[4] ?? 12) + 3, +(br[5] ?? 0)));
  if (/^\d{4}-\d{2}-\d{2}/.test(t) && !Number.isNaN(Date.parse(t))) return new Date(t);
  if (/^\d{5}(\.\d+)?$/.test(t)) return new Date(Math.round((+t - 25569) * 86_400_000) + 3 * 3_600_000); // data do Excel
  return null;
}

const percentual = (v: string) => {
  const n = parseFloat(v.replace("%", "").replace(",", "."));
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(!v.includes("%") && n <= 1 ? n * 100 : n)));
};

export function lerConsumo(linhas: string[][]): { registros: LinhaConsumo[]; erro?: string } {
  if (!linhas.length) return { registros: [], erro: "A planilha está vazia." };
  const cab = linhas[0].map(norm);
  const col = (...nomes: string[]) => cab.findIndex(c => nomes.some(n => c === n || c.startsWith(n)));
  const i = {
    nome: col("membros", "membro", "nome"), email: col("e-mail", "email"), modulo: col("modulo"), conteudo: col("conteudo"),
    tipo: col("tipo de conteudo", "tipo"), vis: col("visualizacoes totais", "visualizacoes"), taxa: col("taxa de conclusao"),
    primeiro: col("data de primeiro consumo"), ultimo: col("data do ultimo consumo"),
  };
  if (i.email < 0 || i.conteudo < 0 || i.modulo < 0) {
    return { registros: [], erro: "Essa planilha não parece ser o relatório “Consumo do membro por conteúdo” da Hubla (faltam as colunas E-mail, Módulo ou Conteúdo)." };
  }
  const registros: LinhaConsumo[] = [];
  for (const l of linhas.slice(1)) {
    const email = (l[i.email] ?? "").trim().toLowerCase();
    if (!email.includes("@")) continue;
    registros.push({
      email,
      nome: i.nome >= 0 ? l[i.nome]?.trim() || null : null,
      modulo: (l[i.modulo] ?? "").trim() || "Sem módulo",
      conteudo: (l[i.conteudo] ?? "").trim() || "Sem título",
      tipo: i.tipo >= 0 ? (l[i.tipo] ?? "").trim() || "Outro" : "Outro",
      visualizacoes: i.vis >= 0 ? parseInt(l[i.vis] ?? "0", 10) || 0 : 0,
      conclusao: i.taxa >= 0 ? percentual(l[i.taxa] ?? "0") : 0,
      primeiro: i.primeiro >= 0 ? dataHubla(l[i.primeiro] ?? "") : null,
      ultimo: i.ultimo >= 0 ? dataHubla(l[i.ultimo] ?? "") : null,
    });
  }
  return { registros };
}

// Resumo por mentorada para o painel e o cadastro.
export const CONCLUIDA = 90; // a partir de 90% a aula conta como assistida
export function resumoConsumo(itens: { conclusao: number; ultimo: Date | string | null; tipo: string }[], hojeMs: number) {
  const ultimos = itens.map(x => (x.ultimo ? new Date(x.ultimo).getTime() : 0)).filter(Boolean);
  const ultimo = ultimos.length ? Math.max(...ultimos) : null;
  const dias = (n: number) => itens.filter(x => x.ultimo && hojeMs - new Date(x.ultimo).getTime() <= n * 86_400_000).length;
  return {
    total: itens.length,
    concluidas: itens.filter(x => x.conclusao >= CONCLUIDA).length,
    ultimo: ultimo ? new Date(ultimo).toISOString() : null,
    diasSemAula: ultimo ? Math.floor((hojeMs - ultimo) / 86_400_000) : null,
    em7: dias(7),
    em30: dias(30),
  };
}
