import { notaIngles, type Resposta } from "@/lib/respondi";

// Inteligência comercial: lê as respostas dos formulários e resume o que elas dizem.
// Sem inteligência artificial paga: contagens, agrupamento de respostas parecidas, temas por palavras-chave
// e cruzamento com a temperatura e com as vendas.

export type Linha = {
  leadId: string; nome: string; formulario: string; completa: boolean; temperatura: string | null;
  comprou: boolean; preenchidoEm: Date; respostas: Resposta[];
};
export type Opcao = { nome: string; n: number; quentes: number; compraram: number };
export type Citacao = { leadId: string; nome: string; texto: string; temperatura: string | null; comprou: boolean; data: string; formulario: string; temas: string[] };
export type Pergunta = {
  id: string; titulo: string; completo: string; formularios: string[]; tipo: "escolha" | "curta" | "longa";
  respondidas: number; quentes: number; compraram: number;
  opcoes: Opcao[]; outras: number; termos: { termo: string; n: number }[]; temas: (Opcao & { k: string })[]; citacoes: Citacao[];
};

export const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const CONTATO = /seu nome|^nome\b|e-?mail|whatsapp|telefone|celular/;

// Título curto: a última frase com "?" (as perguntas longas têm um texto de introdução antes).
export function tituloCurto(p: string) {
  const t = p.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
  if (t.length <= 90) return t;
  const frases = t.split(/(?<=[.?!:])\s+/).filter(Boolean);
  let pergunta = ([...frases].reverse().find(f => f.includes("?")) ?? frases.at(-1)!).replace(/^[^?]*?:\s*(?=\S)/, "");
  pergunta = pergunta.charAt(0).toUpperCase() + pergunta.slice(1);
  return pergunta.length > 140 ? `${pergunta.slice(0, 137)}…` : pergunta;
}

// ---- Temas das respostas escritas (carreira internacional / remota) ----
export const TEMAS: { k: string; label: string; re: RegExp }[] = [
  { k: "ingles", label: "Inglês", re: /ingles|idioma|fluenc|conversac/ },
  { k: "clareza", label: "Não sabe por onde começar", re: /por onde comec|clareza|direcion|perdid|nao sei (o que|qual|como|por)|sem foco|falta de foco|caminho|plano/ },
  { k: "tempo", label: "Falta de tempo", re: /\btempo\b|rotina|corrid|conciliar/ },
  { k: "vagas", label: "Vagas e oportunidades", re: /\bvagas?\b|oportunidade|emprego|contrata|recoloca|ser chamad|retorno das? empresa/ },
  { k: "curriculo", label: "Currículo e LinkedIn", re: /curricul|\bcv\b|resume|linkedin|portfolio|perfil profissional/ },
  { k: "entrevista", label: "Entrevistas e processos seletivos", re: /entrevista|processos? seletivos?|recrutador|aplica(r|cao|coes)|candidat/ },
  { k: "experiencia", label: "Falta de experiência", re: /experiencia|sem pratica|inexperien|junior/ },
  { k: "dinheiro", label: "Dinheiro / vida financeira", re: /dinheiro|financ|grana|recurso|caro\b|pagar|condic(ao|oes) de pag|investimento/ },
  { k: "confianca", label: "Medo e insegurança", re: /medo|insegur|confian|autoestima|ansied|coragem|vergonha|travad|sindrome/ },
  { k: "networking", label: "Networking e contatos", re: /network|contatos?\b|indicac|conexo/ },
  { k: "fora", label: "Morar fora / mudar de país", re: /morar fora|exterior|europa|portugal|canada|eua|estados unidos|mudar de pais|imigra|visto|cidadania|intercambio/ },
  { k: "remoto", label: "Trabalho remoto", re: /remot|home ?office|anywhere|nomade/ },
  { k: "transicao", label: "Transição de carreira", re: /transic|mudar de area|nova area|outra area|migrar|trocar de area/ },
  { k: "salario", label: "Ganhar mais / dólar e euro", re: /salario|ganhar mais|renda|dolar|euro|moeda forte|remunera/ },
  { k: "idade", label: "Idade", re: /minha idade|\bidade\b|velh[ao]|\b[4-6]\d\+|\b[4-6]\d anos de idade/ },
  { k: "orientacao", label: "Quer orientação e acompanhamento", re: /mentor|orienta|acompanha|passo a passo|estrategi|guia|direcionamento/ },
  { k: "estudo", label: "Cursos e qualificação", re: /\bcursos?\b|certifica|estud|capacita|qualifica|pos.?gradua|mba\b/ },
];

const STOP = new Set(("a ao aos as at ate com como da das de dei do dos e ela ele em entao era essa esse esta estou eu foi ha isso ja la mais mas me meu meus minha minhas muito na nas nem no nos o os ou para pela pelo pode por pra pro que quero se sem ser seu sua sou ta tambem tem tenho ter um uma umas uns voce voces vcs vc nao sim so ainda bem algo alguma algum assim cada coisa coisas consigo conseguir dentro depois desde disso dessa desse esta estar estao estava fazer faz fico hoje isso la lo mesmo minha muita muitas muitos nada onde pois porque pouco qual quais quando quanto queria sao seja sempre sendo sera seria sobre tanto toda todas todo todos tudo vai ver vez vou acho preciso gostaria quer ser estar ter ajuda ajudar aqui ai entre outro outra outros outras forma maneira melhor bom boa grande tipo hora").split(" "));
const palavras = (t: string) => norm(t).replace(/[^a-z0-9+ ]/g, " ").split(" ").filter(w => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w));

// Respostas curtas parecidas viram uma só ("Sou formada em Direito" = "direito").
const PREFIXOS = /^(sim[,.!]?\s*)?((eu\s+)?(sou\s+)?(formad[oa]|graduad[oa]|bacharel(ado)?|licenciad[oa]|licenciatura|graduacao|formacao|tecnologo|tecnico|superior|curso|pos.?graduad[oa])\s+(em|de|no|na)\s+)?/;
export function chaveCurta(t: string, formacao: boolean) {
  let n = norm(t).replace(/[.!;]+$/g, "");
  if (formacao) n = n.replace(PREFIXOS, "").replace(/^(em|de)\s+/, "").trim();
  if (!n || /^(nao|nao tenho|nenhum[a]?|nenhuma dificuldade|nao possuo|nada)$/.test(n) || (formacao && /^nao\b/.test(n))) return "-nao-";
  return n.slice(0, 60);
}

// Ordem natural das opções: faixas de valor/idade/tempo em ordem crescente, nível de inglês do básico ao fluente.
function ordenar(opcoes: Opcao[]) {
  if (opcoes.every(o => notaIngles(o.nome) !== null)) return [...opcoes].sort((a, b) => notaIngles(a.nome)! - notaIngles(b.nome)!);
  const temMes = opcoes.some(o => /\bm[eê]s(es)?\b/i.test(o.nome));
  const chave = (s: string) => {
    const ns = [...norm(s).matchAll(/\d[\d.]*(?:,\d+)?/g)].map(m => parseFloat(m[0].replace(/\./g, "").replace(",", ".")));
    if (!ns.length) return null;
    const mult = temMes && /\bano/.test(norm(s)) ? 12 : 1;
    const seg = ns[1] ?? (/^(ate|menos)/.test(norm(s)) ? ns[0] - 0.5 : ns[0] + 0.5);
    return [ns[0] * mult, seg * mult];
  };
  const ks = opcoes.map(o => chave(o.nome));
  if (ks.filter(Boolean).length >= Math.max(2, opcoes.length * 0.7) && opcoes.length >= 3) {
    return opcoes.map((o, i) => ({ o, k: ks[i] ?? [Infinity, Infinity] })).sort((a, b) => a.k[0] - b.k[0] || a.k[1] - b.k[1]).map(x => x.o);
  }
  return [...opcoes].sort((a, b) => b.n - a.n);
}

export function analisar(linhas: Linha[], { maxCitacoes = 400 } = {}) {
  // Agrupa por pergunta (o mesmo título nos dois formulários vira uma pergunta só).
  const mapa = new Map<string, { completo: string; forms: Set<string>; posicoes: number[]; itens: { l: Linha; r: string }[] }>();
  for (const l of linhas) {
    l.respostas.forEach((x, i) => {
      const k = norm(x.p);
      if (CONTATO.test(k) || !x.r.trim()) return;
      const g = mapa.get(k) ?? { completo: x.p, forms: new Set(), posicoes: [], itens: [] };
      g.forms.add(l.formulario); g.posicoes.push(i); g.itens.push({ l, r: x.r.trim() });
      mapa.set(k, g);
    });
  }
  const perguntas: Pergunta[] = [];
  for (const [k, g] of mapa) {
    const n = g.itens.length;
    const distintos = new Map<string, number>();
    for (const it of g.itens) distintos.set(norm(it.r), (distintos.get(norm(it.r)) ?? 0) + 1);
    const tamMedio = g.itens.reduce((s, it) => s + it.r.length, 0) / n;
    const top10 = [...distintos.values()].sort((a, b) => b - a).slice(0, 10).reduce((s, v) => s + v, 0);
    const tipo: Pergunta["tipo"] = distintos.size <= 25 && (top10 / n >= 0.85 || distintos.size <= 8) && tamMedio < 80 ? "escolha" : tamMedio <= 45 ? "curta" : "longa";

    const conta = (grupos: Map<string, { nome: Map<string, number>; its: { l: Linha }[] }>) =>
      [...grupos.values()].map(gr => {
        const nome = [...gr.nome.entries()].sort((a, b) => b[1] - a[1])[0][0];
        return { nome, n: gr.its.length, quentes: gr.its.filter(x => x.l.temperatura === "quente").length, compraram: gr.its.filter(x => x.l.comprou).length };
      });
    const agrupar = (chave: (r: string) => string, rotulo: (r: string) => string) => {
      const grupos = new Map<string, { nome: Map<string, number>; its: { l: Linha }[] }>();
      for (const it of g.itens) {
        const c = chave(it.r);
        const gr = grupos.get(c) ?? { nome: new Map<string, number>(), its: [] as { l: Linha }[] };
        const nm = rotulo(it.r);
        gr.nome.set(nm, (gr.nome.get(nm) ?? 0) + 1); gr.its.push(it);
        grupos.set(c, gr);
      }
      return conta(grupos);
    };

    let opcoes: Opcao[] = [], outras = 0, termos: Pergunta["termos"] = [], temas: Pergunta["temas"] = [];
    if (tipo === "escolha") {
      // Muitas opções (respostas soltas tipo "Outro"): as 8 maiores e o resto em "Outras".
      const todas = agrupar(r => norm(r), r => r);
      if (todas.length > 8) {
        const maiores = [...todas].sort((a, b) => b.n - a.n);
        opcoes = maiores.slice(0, 8); outras = maiores.slice(8).reduce((s, o) => s + o.n, 0);
      } else opcoes = ordenar(todas);
    }
    if (tipo === "curta") {
      const formacao = /formacao|curso|graduac/.test(k);
      const todas = agrupar(r => chaveCurta(r, formacao), r => {
        const c = chaveCurta(r, formacao);
        if (c === "-nao-") return formacao ? "Não tem formação" : "Não / nada";
        // Quem escreveu só o nome do curso ("Administração") empresta a grafia com acento para o grupo.
        const limpa = r.trim().replace(/[.!;]+$/g, "");
        return norm(limpa) === c ? limpa.charAt(0).toUpperCase() + limpa.slice(1) : c.charAt(0).toUpperCase() + c.slice(1);
      }).sort((a, b) => b.n - a.n);
      opcoes = todas.slice(0, 15); outras = todas.slice(15).reduce((s, o) => s + o.n, 0);
    }
    if (tipo !== "escolha") {
      const cont = new Map<string, number>();
      for (const it of g.itens) {
        const ws = palavras(it.r);
        const vistos = new Set<string>();
        ws.forEach((w, i) => { vistos.add(w); if (ws[i + 1]) vistos.add(`${w} ${ws[i + 1]}`); });
        for (const v of vistos) cont.set(v, (cont.get(v) ?? 0) + 1);
      }
      const minimo = Math.max(2, Math.round(n * 0.02));
      const expressoes = [...cont.entries()].filter(([t, c]) => t.includes(" ") && c >= minimo);
      const usadas = new Set(expressoes.flatMap(([t]) => t.split(" ")));
      termos = [...cont.entries()]
        .filter(([t, c]) => c >= minimo && (t.includes(" ") || !usadas.has(t) || c >= minimo * 3))
        .sort((a, b) => b[1] - a[1]).slice(0, 24).map(([termo, c]) => ({ termo, n: c }));
    }
    if (tipo !== "escolha") {
      temas = TEMAS.map(t => {
        const its = g.itens.filter(it => t.re.test(norm(it.r)));
        return { k: t.k, nome: t.label, n: its.length, quentes: its.filter(x => x.l.temperatura === "quente").length, compraram: its.filter(x => x.l.comprou).length };
      }).filter(t => t.n > 0).sort((a, b) => b.n - a.n);
      if (tipo === "curta" && temas.reduce((s, t) => s + t.n, 0) < n * 0.25) temas = []; // respostas curtas sem tema (ex.: formação)
    }
    const citacoes: Citacao[] = tipo === "escolha" ? [] : [...g.itens]
      .sort((a, b) => b.l.preenchidoEm.getTime() - a.l.preenchidoEm.getTime()).slice(0, maxCitacoes)
      .map(it => ({
        leadId: it.l.leadId, nome: it.l.nome.split(" ")[0], texto: it.r.slice(0, 1200), temperatura: it.l.temperatura, comprou: it.l.comprou,
        data: it.l.preenchidoEm.toISOString(), formulario: it.l.formulario, temas: TEMAS.filter(t => t.re.test(norm(it.r))).map(t => t.k),
      }));
    perguntas.push({
      id: k.replace(/[^a-z0-9]+/g, "-").slice(0, 60), titulo: tituloCurto(g.completo), completo: g.completo.replace(/\*\*/g, ""),
      formularios: [...g.forms], tipo, respondidas: n,
      quentes: g.itens.filter(x => x.l.temperatura === "quente").length, compraram: g.itens.filter(x => x.l.comprou).length,
      opcoes, outras, termos, temas, citacoes,
      _ordem: g.posicoes.reduce((s, p) => s + p, 0) / g.posicoes.length,
    } as Pergunta & { _ordem: number });
  }
  perguntas.sort((a, b) => (a as Pergunta & { _ordem: number })._ordem - (b as Pergunta & { _ordem: number })._ordem);
  for (const p of perguntas) delete (p as Partial<Pergunta & { _ordem: number }>)._ordem;

  // Onde desistem: para quem não terminou, a pergunta seguinte à última respondida (na ordem do formulário).
  const ordemDoForm = new Map<string, string[]>();
  for (const l of linhas) {
    const atual = ordemDoForm.get(l.formulario);
    if (l.completa && (!atual || l.respostas.length > atual.length)) ordemDoForm.set(l.formulario, l.respostas.map(x => norm(x.p)));
  }
  const titulos = new Map<string, string>();
  for (const l of linhas) for (const x of l.respostas) if (!titulos.has(norm(x.p))) titulos.set(norm(x.p), tituloCurto(x.p));
  const paradas = new Map<string, number>();
  const incompletas = linhas.filter(l => !l.completa);
  for (const l of incompletas) {
    const ultima = l.respostas.at(-1);
    if (!ultima) continue;
    const ordem = ordemDoForm.get(l.formulario) ?? [];
    const i = ordem.indexOf(norm(ultima.p));
    const proxima = i >= 0 && ordem[i + 1] ? ordem[i + 1] : null;
    const titulo = proxima ? titulos.get(proxima) ?? tituloCurto(proxima) : `depois de “${tituloCurto(ultima.p)}”`;
    paradas.set(titulo, (paradas.get(titulo) ?? 0) + 1);
  }
  const abandono = [...paradas.entries()].map(([pergunta, n]) => ({ pergunta, n })).sort((a, b) => b.n - a.n).slice(0, 6);

  const base = linhas.length, completas = linhas.filter(l => l.completa).length;
  const quentes = linhas.filter(l => l.temperatura === "quente").length, compraram = linhas.filter(l => l.comprou).length;

  // Destaques escritos a partir dos números.
  const destaques: string[] = [];
  const pc = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
  if (incompletas.length && base >= 10) {
    destaques.push(`${pc(incompletas.length, base)}% das pessoas começaram o formulário e não terminaram${abandono[0] ? `. A maior parte parou em “${abandono[0].pergunta}” (${abandono[0].n} pessoas)` : ""}.`);
  }
  const mediaQ = pc(quentes, base);
  // Renda, inglês e "disposta a investir" já definem a temperatura: ficam fora dos destaques para não repetir o óbvio.
  const CRITERIO = /renda.*atual|dispost[oa].*investir.*acelerar|nivel de ingles/;
  const sinais = perguntas.filter(p => p.tipo === "escolha" && p.respondidas >= 20 && !CRITERIO.test(norm(p.completo)))
    .flatMap(p => p.opcoes.filter(o => o.n >= Math.max(8, p.respondidas * 0.05)).map(o => ({ p, o, taxa: pc(o.quentes, o.n) })));
  const fortes = sinais.filter(s => s.taxa >= mediaQ + 15).sort((a, b) => b.taxa - a.taxa);
  for (const s of fortes.filter((s, i, l) => l.findIndex(x => x.p === s.p) === i).slice(0, 2)) {
    destaques.push(`Quem responde “${s.o.nome}” em “${s.p.titulo}” é quente ${s.taxa}% das vezes (a média é ${mediaQ}%).`);
  }
  const fracos = sinais.filter(s => s.o.n >= 15 && s.taxa <= mediaQ - 15).sort((a, b) => b.o.n - a.o.n);
  if (fracos[0]) destaques.push(`${fracos[0].o.n} pessoas marcaram “${fracos[0].o.nome}” em “${fracos[0].p.titulo}”, e só ${fracos[0].taxa}% delas são quentes: é um público que o conteúdo está atraindo, mas que ainda não está pronto.`);
  const dif = perguntas.find(p => p.tipo !== "escolha" && /dificuldade/.test(norm(p.completo)) && p.temas.length);
  if (dif) destaques.push(`A dificuldade mais citada é “${dif.temas[0].nome}” (${pc(dif.temas[0].n, dif.respondidas)}% de quem respondeu)${dif.temas[1] ? `, seguida de “${dif.temas[1].nome}” (${pc(dif.temas[1].n, dif.respondidas)}%)` : ""}.`);
  const obj = perguntas.find(p => p.tipo !== "escolha" && /objetivo/.test(norm(p.completo)) && p.temas.length);
  if (obj) destaques.push(`Nos objetivos, o tema que mais aparece é “${obj.temas[0].nome}” (${pc(obj.temas[0].n, obj.respondidas)}%).`);
  if (compraram) destaques.push(`${compraram} ${compraram === 1 ? "pessoa deste período já comprou" : "pessoas deste período já compraram"}. Use o filtro “Compraram” para ver o perfil de quem fecha.`);

  return { base, completas, quentes, compraram, perguntas, abandono, destaques };
}
export type Inteligencia = ReturnType<typeof analisar>;
