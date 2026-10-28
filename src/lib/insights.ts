import { contaNaAssiduidade, encontrosGrupo, etapaFields, etapasDoPrograma, inicioCiclo } from "./jornada";

export type Setor = "posvenda" | "marketing" | "produto" | "vendas" | "dados";
export const SETORES: { k: Setor; label: string }[] = [
  { k: "posvenda", label: "Pós-venda" },
  { k: "marketing", label: "Marketing" },
  { k: "produto", label: "Produto" },
  { k: "vendas", label: "Vendas" },
  { k: "dados", label: "Qualidade dos dados" },
];

export type MentoradaInsight = {
  id: string; nome: string; tipo: string; status: string; saude: string | null; disc: string | null;
  area: string | null; localizacao: string | null; origem: string | null; origemDetalhe: string | null;
  produtoAnterior: string | null; inicio: string | null; prazo: string | null; cancelamento: string | null;
  vagaData: string | null; vagaCargo: string | null; renovacaoStatus: string | null;
  etapas: { nome: string; data: string | null; programa: string; titulo: string | null }[];
  renovacoes: { acao: string; destino: string; data: string; programaAnterior: string | null }[];
  presencas: { encontro: string; presente: boolean }[];
  acompanhamentos: number;
};

export type Linha = { label: string; valor: number | null; n: number; sufixo?: string; destaque?: "bom" | "ruim" };
export type Insight = {
  id: string;
  setor: Setor;
  titulo: string;
  achado: string;
  linhas: Linha[];
  confianca: "alta" | "media" | "baixa" | "sem-dados";
  acao: string;
  rotulo?: string;
};

const ATIVOS = ["Ativo", "Em Andamento", "Em Renovação"];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);
const dias = (a: string, b: string) => Math.round((Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / 86400000);
const norm = (s: string | null) => (s ?? "").trim();
const media = (xs: number[]) => (xs.length ? Math.round(xs.reduce((x, y) => x + y, 0) / xs.length) : null);

function confianca(ns: number[]): Insight["confianca"] {
  const min = Math.min(...ns.filter(n => n > 0));
  if (!Number.isFinite(min)) return "sem-dados";
  return min >= 30 ? "alta" : min >= 10 ? "media" : "baixa";
}

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

const renovou = (m: MentoradaInsight) =>
  m.renovacaoStatus === "Renovou" || m.renovacoes.some(r => r.acao === "RENOVAÇÃO" || r.acao === "UPGRADE");
const churn = (m: MentoradaInsight) => m.status === "Churn" || !!m.cancelamento;
const decidida = (m: MentoradaInsight) => renovou(m) || churn(m) || (!!m.prazo && m.prazo.slice(0, 10) < hoje());

function taxas(grupo: MentoradaInsight[]) {
  const dec = grupo.filter(decidida);
  return {
    n: dec.length,
    renovacao: pct(dec.filter(renovou).length, dec.length),
    churn: pct(dec.filter(churn).length, dec.length),
  };
}

function primeiraLetra(disc: string | null) {
  const d = norm(disc).toUpperCase();
  return /^[DISC]/.test(d) ? d[0] : null;
}
const NOME_DISC: Record<string, string> = { D: "Dominância (D)", I: "Influência (I)", S: "Estabilidade (S)", C: "Conformidade (C)" };

function progressoJornada(m: MentoradaInsight) {
  const campos = etapaFields(m.tipo).filter(f => !f.campoMentorada);
  if (!campos.length) return null;
  const feitas = etapasDoPrograma(m).filter(e => e.data && campos.some(c => c.key === e.nome)).length;
  return Math.round((feitas / campos.length) * 100);
}
function diasAte(m: MentoradaInsight, etapa: string) {
  const ini = inicioCiclo(m);
  const e = etapasDoPrograma(m).find(x => x.nome === etapa && x.data);
  return ini && e ? dias(ini, e.data!) : null;
}

export function gerarInsights(base: MentoradaInsight[]): Insight[] {
  const out: Insight[] = [];
  const ativas = base.filter(m => ATIVOS.includes(m.status));
  const comOnb = base.filter(m => diasAte(m, "onboarding") !== null);

  // 1. Velocidade do onboarding × renovação
  {
    const faixas = [
      { label: "Onboarding em até 7 dias", curto: "até 7 dias", f: (d: number) => d <= 7 },
      { label: "Entre 8 e 14 dias", curto: "8 a 14 dias", f: (d: number) => d > 7 && d <= 14 },
      { label: "Mais de 14 dias", curto: "mais de 14 dias", f: (d: number) => d > 14 },
    ];
    const grupos = faixas.map(fx => {
      const g = base.filter(m => { const d = diasAte(m, "onboarding"); return d !== null && d >= 0 && fx.f(d); });
      return { ...fx, ...taxas(g) };
    });
    const sem = taxas(base.filter(m => diasAte(m, "onboarding") === null && decidida(m)));
    const validos = grupos.filter(g => g.n >= 5 && g.renovacao !== null);
    const rapido = grupos[0];
    const lento = grupos[2];
    const rapidoMelhor = validos.length >= 2 && validos.every(g => (rapido.renovacao ?? -1) >= (g.renovacao ?? 0));
    const tempoMedio = media(comOnb.map(m => diasAte(m, "onboarding")!).filter(d => d >= 0));
    const resumo = grupos.map(g => `${g.curto}: ${g.renovacao ?? "—"}%`).join(" · ");
    out.push({
      id: "onboarding-renovacao",
      setor: "posvenda",
      titulo: "Velocidade do onboarding × renovação",
      achado: validos.length < 2
        ? "Ainda não há contratos encerrados suficientes com onboarding registrado para comparar."
        : rapidoMelhor
          ? `Quem faz o onboarding em até 7 dias renova ${rapido.renovacao}% das vezes, contra ${lento.renovacao ?? "—"}% de quem passa de 14 dias. O tempo médio hoje é de ${tempoMedio ?? "—"} dias.`
          : `A velocidade do onboarding, sozinha, não explica a renovação (${resumo}). O que pesa mais é ter onboarding registrado: sem ele, a renovação cai para ${sem.renovacao ?? "—"}%. Tempo médio atual: ${tempoMedio ?? "—"} dias.`,
      linhas: [
        ...grupos.map(g => ({ label: `${g.label} · churn ${g.churn ?? "—"}%`, valor: g.renovacao, n: g.n, sufixo: "% renovaram" })),
        { label: "Sem onboarding registrado", valor: sem.renovacao, n: sem.n, sufixo: "% renovaram", destaque: "ruim" as const },
      ],
      confianca: confianca(validos.map(g => g.n)),
      acao: rapidoMelhor
        ? "Meta de onboarding em até 7 dias após a compra: agendar já na mensagem de boas-vindas e acompanhar quem passar do prazo."
        : "Garantir que toda mentorada faça (e tenha registrado) o onboarding. A data em si importa menos que a mentorada realmente começar a jornada.",
      rotulo: "renovação",
    });
  }

  // 2. Mentoria Individual × renovação
  {
    const com = base.filter(m => etapasDoPrograma(m).some(e => e.nome === "sessao" && e.data));
    const semM = base.filter(m => etapaFields(m.tipo).some(f => f.key === "sessao") && !etapasDoPrograma(m).some(e => e.nome === "sessao" && e.data));
    const a = taxas(com), b = taxas(semM);
    out.push({
      id: "mentoria-renovacao",
      setor: "posvenda",
      titulo: "Mentoria Individual realizada × renovação",
      achado: a.renovacao !== null && b.renovacao !== null
        ? `Mentoradas que fizeram a Mentoria Individual renovam ${a.renovacao}% das vezes; as que não fizeram, ${b.renovacao}%. O churn é de ${a.churn}% contra ${b.churn}%.`
        : "Dados insuficientes para comparar.",
      linhas: [
        { label: "Fizeram a Mentoria Individual", valor: a.renovacao, n: a.n, sufixo: "% renovaram", destaque: (a.renovacao ?? 0) >= (b.renovacao ?? 0) ? "bom" : undefined },
        { label: "Não fizeram", valor: b.renovacao, n: b.n, sufixo: "% renovaram", destaque: (b.renovacao ?? 0) < (a.renovacao ?? 0) ? "ruim" : undefined },
        { label: "Churn — fizeram", valor: a.churn, n: a.n, sufixo: "% churn" },
        { label: "Churn — não fizeram", valor: b.churn, n: b.n, sufixo: "% churn" },
      ],
      confianca: confianca([a.n, b.n]),
      acao: "Tratar a Mentoria Individual como marco obrigatório: quem não agendou até o 2º mês entra na lista de contato prioritário.",
      rotulo: "renovação",
    });
  }

  // 3. Programa × resultado
  {
    const progs = [...new Set(base.map(m => m.tipo).filter(Boolean))];
    const linhas = progs.map(p => {
      const g = base.filter(m => m.tipo === p);
      const t = taxas(g);
      return { p, ...t, onb: media(g.map(m => diasAte(m, "onboarding")).filter((d): d is number => d !== null && d >= 0)), total: g.length };
    }).filter(x => x.n >= 1).sort((a, b) => (b.renovacao ?? 0) - (a.renovacao ?? 0));
    const comparaveis = linhas.filter(x => x.n >= 10);
    const topo = comparaveis[0], fundo = comparaveis[comparaveis.length - 1];
    const maisChurn = [...comparaveis].sort((a, b) => (b.churn ?? 0) - (a.churn ?? 0))[0];
    out.push({
      id: "programa-resultado",
      setor: "produto",
      titulo: "Renovação e churn por programa",
      achado: comparaveis.length >= 2
        ? `${topo.p} tem a maior renovação (${topo.renovacao}%) e ${fundo.p} a menor (${fundo.renovacao}%). O churn mais alto está no ${maisChurn.p} (${maisChurn.churn}%)${[...comparaveis].sort((a, b) => (b.onb ?? 0) - (a.onb ?? 0))[0].p === maisChurn.p ? `, que também tem o onboarding mais demorado (${maisChurn.onb} dias em média)` : ""}.`
        : "Poucos contratos encerrados por programa para comparar.",
      linhas: linhas.map(x => ({
        label: `${x.p} · churn ${x.churn ?? "—"}% · onboarding em ${x.onb ?? "—"}d${x.n < 10 ? " · amostra pequena" : ""}`,
        valor: x.renovacao, n: x.n, sufixo: "% renovaram",
        destaque: x === topo ? "bom" as const : x === fundo && comparaveis.length > 1 ? "ruim" as const : undefined,
      })),
      confianca: confianca(comparaveis.map(x => x.n)),
      acao: "Levar ao time de produto o programa com menor renovação: entender em que etapa as mentoradas travam e o que o de melhor desempenho faz diferente.",
      rotulo: "renovação",
    });
  }

  // 4. Momento do churn
  {
    const ch = base.filter(m => m.cancelamento && m.inicio).map(m => Math.max(0, Math.floor(dias(m.inicio!, m.cancelamento!) / 30)));
    const buckets = [
      { label: "1º mês", f: (x: number) => x < 1 },
      { label: "2º mês", f: (x: number) => x >= 1 && x < 2 },
      { label: "3º mês", f: (x: number) => x >= 2 && x < 3 },
      { label: "4º ao 6º mês", f: (x: number) => x >= 3 && x < 6 },
      { label: "Depois do 6º mês", f: (x: number) => x >= 6 },
    ].map(b => ({ ...b, n: ch.filter(b.f).length }));
    const pico = [...buckets].sort((a, b) => b.n - a.n)[0];
    out.push({
      id: "momento-churn",
      setor: "produto",
      titulo: "Em que momento da mentoria acontece o cancelamento",
      achado: ch.length
        ? `${pct(pico.n, ch.length)}% dos cancelamentos com data registrada acontecem no ${pico.label.toLowerCase()} da mentoria.`
        : "Nenhum cancelamento tem data registrada ainda. Preencha a “Data de cancelamento” no cadastro de quem saiu.",
      linhas: buckets.map(b => ({ label: b.label, valor: pct(b.n, ch.length), n: b.n, sufixo: "% dos cancelamentos", destaque: b === pico && ch.length ? "ruim" as const : undefined })),
      confianca: confianca([ch.length]),
      acao: "Reforçar o acompanhamento (contato semanal e entregas visíveis) na fase em que mais acontecem cancelamentos.",
      rotulo: "cancelamentos",
    });
  }

  // 5. Localização × resultado
  {
    const loc = (m: MentoradaInsight) => {
      const l = norm(m.localizacao);
      if (!l) return null;
      return /^bra(s|z)il$/i.test(l) ? "Brasil" : "Exterior";
    };
    const br = taxas(base.filter(m => loc(m) === "Brasil"));
    const ex = taxas(base.filter(m => loc(m) === "Exterior"));
    const paises = new Map<string, MentoradaInsight[]>();
    for (const m of base) { const l = norm(m.localizacao); if (l) paises.set(l, [...(paises.get(l) ?? []), m]); }
    const top = [...paises.entries()].map(([p, g]) => ({ p, total: g.length, ...taxas(g) })).sort((a, b) => b.total - a.total).slice(0, 6);
    out.push({
      id: "localizacao",
      setor: "marketing",
      titulo: "Onde estão as mentoradas que mais renovam",
      achado: br.renovacao !== null && ex.renovacao !== null
        ? `Quem já mora fora renova ${ex.renovacao}% das vezes; quem está no Brasil, ${br.renovacao}%. ${top[0] ? `${top[0].p} concentra ${pct(top[0].total, base.filter(m => norm(m.localizacao)).length)}% da base com localização informada.` : ""}`
        : "Localização preenchida em poucos cadastros para comparar.",
      linhas: [
        { label: "Brasil", valor: br.renovacao, n: br.n, sufixo: "% renovaram" },
        { label: "Exterior", valor: ex.renovacao, n: ex.n, sufixo: "% renovaram" },
        ...top.map(t => ({ label: `${t.p} · ${t.total} mentoradas`, valor: t.renovacao, n: t.n, sufixo: "% renovaram" })),
      ],
      confianca: confianca([br.n, ex.n]),
      acao: "Direcionar campanhas e depoimentos para o público com maior renovação, e ajustar a mensagem para o público que menos renova.",
      rotulo: "renovação",
    });
  }

  // 6. Origem × resultado
  {
    const origens = new Map<string, MentoradaInsight[]>();
    for (const m of base) { const o = norm(m.origem); if (o) origens.set(o, [...(origens.get(o) ?? []), m]); }
    const ls = [...origens.entries()].map(([o, g]) => ({ o, total: g.length, ...taxas(g) })).sort((a, b) => b.total - a.total);
    const eventos = new Map<string, number>();
    for (const m of base) { const d = norm(m.origemDetalhe); if (d) eventos.set(d, (eventos.get(d) ?? 0) + 1); }
    const topEvento = [...eventos.entries()].sort((a, b) => b[1] - a[1])[0];
    out.push({
      id: "origem",
      setor: "marketing",
      titulo: "Canais de origem × renovação",
      achado: ls.length
        ? `${ls[0].o} é o canal com mais mentoradas (${ls[0].total}).${topEvento ? ` A live/evento que mais trouxe mentoradas foi “${topEvento[0]}” (${topEvento[1]}).` : ""} A origem está preenchida em ${pct(base.filter(m => norm(m.origem)).length, base.length)}% dos cadastros.`
        : "A origem quase não está preenchida. Sem ela não dá para saber quais canais trazem as mentoradas que mais renovam.",
      linhas: ls.slice(0, 8).map(x => ({ label: `${x.o} · ${x.total} mentoradas`, valor: x.renovacao, n: x.n, sufixo: "% renovaram" })),
      confianca: confianca(ls.slice(0, 3).map(x => x.n)),
      acao: "Preencher a origem em todo cadastro novo (o formulário já pede). Em 2 ou 3 meses dá para comparar o custo de cada canal com a renovação que ele gera.",
      rotulo: "renovação",
    });
  }

  // 7. Sazonalidade das entradas
  {
    const porMes = Array(12).fill(0) as number[];
    const anos = new Map<string, number[]>();
    for (const m of base) {
      if (!m.inicio) continue;
      const mm = +m.inicio.slice(5, 7) - 1;
      porMes[mm]++;
      const y = m.inicio.slice(0, 4);
      if (!anos.has(y)) anos.set(y, Array(12).fill(0));
      anos.get(y)![mm]++;
    }
    const total = porMes.reduce((a, b) => a + b, 0);
    const ordem = porMes.map((n, i) => ({ i, n })).sort((a, b) => b.n - a.n);
    out.push({
      id: "sazonalidade",
      setor: "vendas",
      titulo: "Meses com mais entradas de mentoradas",
      achado: total
        ? `Os meses que mais trazem mentoradas são ${MESES[ordem[0].i]}, ${MESES[ordem[1].i]} e ${MESES[ordem[2].i]}; os mais fracos, ${MESES[ordem[11].i]} e ${MESES[ordem[10].i]}.`
        : "Sem datas de início registradas.",
      linhas: porMes.map((n, i) => ({
        label: `${MESES[i]} · ${[...anos.entries()].sort().map(([y, v]) => `${y}: ${v[i]}`).join(" · ")}`,
        valor: pct(n, total), n, sufixo: "% das entradas",
        destaque: i === ordem[0].i ? "bom" as const : i === ordem[11].i ? "ruim" as const : undefined,
      })),
      confianca: confianca([total]),
      acao: "Planejar lançamentos e lives 30 a 45 dias antes dos meses de pico, e criar uma oferta específica para os meses mais fracos.",
      rotulo: "entradas",
    });
  }

  // 8. Upgrade e produto anterior
  {
    const caminhos = new Map<string, number>();
    for (const m of base) for (const r of m.renovacoes) {
      if (r.acao === "UPGRADE" || r.acao === "DOWNGRADE" || r.acao === "CROSS") {
        const k = `${r.acao === "UPGRADE" ? "Upgrade" : r.acao === "DOWNGRADE" ? "Downgrade" : "Cross"}: ${r.programaAnterior ?? "?"} → ${r.destino}`;
        caminhos.set(k, (caminhos.get(k) ?? 0) + 1);
      }
    }
    const veio = taxas(base.filter(m => norm(m.produtoAnterior) && !/^[-.]$/.test(norm(m.produtoAnterior))));
    const novos = taxas(base.filter(m => !norm(m.produtoAnterior)));
    const lista = [...caminhos.entries()].sort((a, b) => b[1] - a[1]);
    out.push({
      id: "upgrade",
      setor: "vendas",
      titulo: "Quem já foi aluna renova mais?",
      achado: veio.renovacao !== null && novos.renovacao !== null
        ? `Quem veio de outro produto da Turney renova ${veio.renovacao}% das vezes; quem é aluna nova, ${novos.renovacao}%.${lista[0] ? ` O caminho de upgrade mais comum é “${lista[0][0]}” (${lista[0][1]}).` : ""}`
        : "Ainda não há dados suficientes de produto anterior.",
      linhas: [
        { label: "Veio de outro produto", valor: veio.renovacao, n: veio.n, sufixo: "% renovaram" },
        { label: "Aluna nova", valor: novos.renovacao, n: novos.n, sufixo: "% renovaram" },
        ...lista.slice(0, 5).map(([k, n]) => ({ label: k, valor: null, n, sufixo: "" })),
      ],
      confianca: confianca([veio.n, novos.n]),
      acao: "Usar a base de ex-alunas como público de venda (upgrade e reativação) — e mapear em que momento a oferta de upgrade converte mais.",
      rotulo: "renovação",
    });
  }

  // 9. Encontros extras vendidos
  {
    const comExtra = base.filter(m => m.etapas.some(e => e.nome.startsWith("extra:")));
    const semExtra = base.filter(m => !m.etapas.some(e => e.nome.startsWith("extra:")));
    const a = taxas(comExtra), b = taxas(semExtra);
    const titulos = new Map<string, number>();
    for (const m of comExtra) for (const e of m.etapas) if (e.nome.startsWith("extra:")) titulos.set(e.titulo || "Encontro extra", (titulos.get(e.titulo || "Encontro extra") ?? 0) + 1);
    out.push({
      id: "extras",
      setor: "vendas",
      titulo: "Encontros extras vendidos no fechamento",
      achado: comExtra.length
        ? `${comExtra.length} mentoradas receberam encontros extras. Renovação: ${a.renovacao ?? "—"}% com extra contra ${b.renovacao ?? "—"}% sem.`
        : "Nenhum encontro extra registrado ainda. Registre na aba Etapas quando o time de vendas incluir algo a mais na negociação.",
      linhas: [
        { label: "Com encontro extra", valor: a.renovacao, n: a.n, sufixo: "% renovaram" },
        { label: "Sem encontro extra", valor: b.renovacao, n: b.n, sufixo: "% renovaram" },
        ...[...titulos.entries()].sort((x, y) => y[1] - x[1]).slice(0, 5).map(([t, n]) => ({ label: t, valor: null, n, sufixo: "" })),
      ],
      confianca: confianca([a.n, b.n]),
      acao: "Se o extra eleva a renovação, ele pode virar parte fixa da oferta. Se não, revisar para não comprometer a agenda das mentoras.",
      rotulo: "renovação",
    });
  }

  // 10. DISC × jornada
  {
    const grupos = ["D", "I", "S", "C"].map(l => {
      const g = base.filter(m => primeiraLetra(m.disc) === l);
      const prog = g.map(progressoJornada).filter((x): x is number => x !== null);
      return { l, total: g.length, prog: media(prog), onb: media(g.map(m => diasAte(m, "onboarding")).filter((d): d is number => d !== null && d >= 0)), ...taxas(g) };
    });
    const comDisc = grupos.reduce((s, g) => s + g.total, 0);
    const validos = grupos.filter(g => g.total > 0 && g.prog !== null).sort((a, b) => (b.prog ?? 0) - (a.prog ?? 0));
    out.push({
      id: "disc",
      setor: "posvenda",
      titulo: "Perfil comportamental (DISC) × avanço na jornada",
      achado: validos.length >= 2
        ? `Perfis ${NOME_DISC[validos[0].l]} avançam mais na jornada (${validos[0].prog}% das etapas concluídas); perfis ${NOME_DISC[validos[validos.length - 1].l]} avançam menos (${validos[validos.length - 1].prog}%). Base: ${comDisc} mentoradas com DISC.`
        : `Só ${comDisc} mentoradas têm DISC preenchido. Com pelo menos 10 por perfil esta análise fica confiável.`,
      linhas: grupos.map(g => ({
        label: `${NOME_DISC[g.l]} · onboarding em ${g.onb ?? "—"}d · renovação ${g.renovacao ?? "—"}%`,
        valor: g.prog, n: g.total, sufixo: "% da jornada concluída",
        destaque: validos[0] && g.l === validos[0].l ? "bom" as const : validos.length > 1 && g.l === validos[validos.length - 1].l ? "ruim" as const : undefined,
      })),
      confianca: confianca(grupos.map(g => g.total)),
      acao: "Adaptar a comunicação ao perfil: metas e prazos claros para D, reconhecimento e interação para I, passo a passo e segurança para S, dados e estrutura para C.",
      rotulo: "jornada",
    });
  }

  // 11. Presença por período
  {
    const porMes = new Map<string, { p: number; t: number }>();
    const porTipo = new Map<string, { p: number; t: number }>();
    for (const m of base) for (const pr of m.presencas) {
      if (!contaNaAssiduidade(m.tipo, pr.encontro)) continue;
      const [ym, chave] = pr.encontro.split("|");
      const a = porMes.get(ym) ?? { p: 0, t: 0 }; a.t++; if (pr.presente) a.p++; porMes.set(ym, a);
      const nomeEnc = encontrosGrupo(m.tipo).find(e => e.key === chave)?.label ?? chave;
      const b = porTipo.get(nomeEnc) ?? { p: 0, t: 0 }; b.t++; if (pr.presente) b.p++; porTipo.set(nomeEnc, b);
    }
    const meses = [...porMes.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12);
    const melhor = [...meses].sort((a, b) => (b[1].p / b[1].t) - (a[1].p / a[1].t))[0];
    const pior = [...meses].sort((a, b) => (a[1].p / a[1].t) - (b[1].p / b[1].t))[0];
    const total = meses.reduce((s, [, v]) => s + v.t, 0);
    out.push({
      id: "presenca",
      setor: "posvenda",
      titulo: "Períodos com maior presença nos encontros",
      achado: total
        ? `A maior presença foi em ${MESES[+melhor[0].slice(5, 7) - 1]}/${melhor[0].slice(0, 4)} (${pct(melhor[1].p, melhor[1].t)}%) e a menor em ${MESES[+pior[0].slice(5, 7) - 1]}/${pior[0].slice(0, 4)} (${pct(pior[1].p, pior[1].t)}%).`
        : "Ainda não há presenças registradas. Marque as presenças na aba Presença do cadastro (ou peça na varredura) para liberar esta análise.",
      linhas: [
        ...meses.map(([ym, v]) => ({ label: `${MESES[+ym.slice(5, 7) - 1]}/${ym.slice(0, 4)}`, valor: pct(v.p, v.t), n: v.t, sufixo: "% de presença", destaque: melhor && ym === melhor[0] ? "bom" as const : pior && ym === pior[0] && meses.length > 1 ? "ruim" as const : undefined })),
        ...[...porTipo.entries()].map(([k, v]) => ({ label: `Encontro: ${k}`, valor: pct(v.p, v.t), n: v.t, sufixo: "% de presença" })),
      ],
      confianca: confianca([total]),
      acao: "Concentrar conteúdos-chave e anúncios de novidades nos meses de maior presença; nos de menor, reforçar lembretes e gravações.",
      rotulo: "presença",
    });
  }

  // 12. Qualidade dos dados
  {
    const n = ativas.length || 1;
    const campos: { label: string; f: (m: MentoradaInsight) => boolean; libera: string }[] = [
      { label: "Perfil DISC", f: m => !!norm(m.disc), libera: "perfil comportamental × jornada" },
      { label: "Origem", f: m => !!norm(m.origem), libera: "canais que trazem quem mais renova" },
      { label: "Área de atuação", f: m => !!norm(m.area), libera: "áreas com mais aprovação em vaga" },
      { label: "Localização", f: m => !!norm(m.localizacao), libera: "regiões que mais renovam" },
      { label: "Presença nos encontros", f: m => m.presencas.length > 0, libera: "períodos com maior presença" },
      { label: "Acompanhamento registrado", f: m => m.acompanhamentos > 0, libera: "temas e padrões das conversas" },
      { label: "Onboarding com data", f: m => etapasDoPrograma(m).some(e => e.nome === "onboarding" && e.data), libera: "velocidade do onboarding × renovação" },
    ];
    const linhas = campos.map(c => ({ label: `${c.label} → libera: ${c.libera}`, valor: pct(ativas.filter(c.f).length, n), n: ativas.filter(c.f).length, sufixo: "% das ativas" }));
    const piores = [...linhas].sort((a, b) => (a.valor ?? 0) - (b.valor ?? 0)).slice(0, 3);
    out.push({
      id: "dados",
      setor: "dados",
      titulo: "O que preencher para a central ficar mais inteligente",
      achado: `As lacunas que mais limitam as análises nas ${ativas.length} mentoradas ativas: ${piores.map(p => `${p.label.split(" →")[0].toLowerCase()} (${p.valor}%)`).join(", ")}.`,
      linhas: linhas.map(l => ({ ...l, destaque: (l.valor ?? 0) < 30 ? "ruim" as const : (l.valor ?? 0) >= 80 ? "bom" as const : undefined })),
      confianca: "alta",
      acao: "Completar esses campos no cadastro das ativas (começando pelas que estão em renovação). Cada campo preenchido destrava um cruzamento novo aqui.",
      rotulo: "cobertura",
    });
  }

  return out;
}
