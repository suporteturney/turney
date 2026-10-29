// Cálculo da saúde da mentorada (0 a 100) a partir de três partes:
//   jornada (etapas no prazo), encontros (presença nos obrigatórios) e acompanhamento (cor da última varredura).
// Arquivo sem imports para poder ser usado também pelos scripts em /scripts (Node puro).

export type Nivel = "Saudável" | "Atenção" | "Risco";
export type Parte = "jornada" | "encontros" | "acompanhamento";

export const PESOS: Record<Parte, number> = { jornada: 40, encontros: 30, acompanhamento: 30 };
export const ROTULO_PARTE: Record<Parte, string> = { jornada: "Jornada", encontros: "Encontros", acompanhamento: "Acompanhamento" };

// Prazo esperado (dias desde o início do ciclo) das etapas que dependem do CS e da mentorada.
// 1ª entrevista e aprovação dependem do mercado: não tiram nota, só dão bônus.
export const PRAZOS: Record<string, Record<string, number>> = {
  Atlas: { onboarding: 5, devolutiva: 21, sessao: 30 },
  "Nexus 1": { onboarding: 5, sessao: 30, correcao: 45 },
  "Nexus 2": { onboarding: 5, sessao: 30 },
  "Nexus 3": { onboarding: 5, analise: 45 },
  Delta: { onboarding: 5 },
};
const BONUS = { entrevista: 10, aprovacao: 10 };
const TOLERANCIA_ATRASO = 15;

// Encontros em grupo que contam na assiduidade (mesma regra de encontrosGrupo em jornada.ts).
const OBRIGATORIOS = (tipo: string) =>
  tipo === "Atlas" ? ["hotseat", "tutoria"] : /^Nexus\b/.test(tipo) ? ["evolutionDay", "masterclassDay"] : [];
export const JANELA_ENCONTROS_DIAS = 60;

export const NOTA_BANDA: Record<string, number> = { verde: 100, amarelo: 60, vermelho: 20 };
export const VALIDADE_VARREDURA_DIAS = 21;

export const nivelDaNota = (nota: number): Nivel => (nota >= 70 ? "Saudável" : nota >= 45 ? "Atenção" : "Risco");

export type EntradaSaude = {
  tipo: string;
  inicio: string | null;
  vagaData: string | null;
  renovacoes: { acao: string; destino: string; data: string }[];
  etapas: { nome: string; data: string | null; programa?: string | null }[];
  presencas: { encontro: string; presente: boolean }[];
  varredura: { banda: string; data: string } | null;
};

export type ResultadoSaude = {
  nota: number | null;
  nivel: Nivel | null;
  partes: Record<Parte, { nota: number | null; detalhe: string }>;
  trava: string | null;
};

const dia = (iso: string) => iso.slice(0, 10);
const somaDias = (iso: string, n: number) => new Date(Date.parse(dia(iso)) + n * 86400000).toISOString().slice(0, 10);
const diasEntre = (a: string, b: string) => Math.round((Date.parse(dia(b)) - Date.parse(dia(a))) / 86400000);

function inicioDoCiclo(e: EntradaSaude) {
  const mudanca = [...e.renovacoes]
    .filter(r => ["UPGRADE", "DOWNGRADE", "CROSS"].includes(r.acao) && r.destino === e.tipo)
    .sort((a, b) => b.data.localeCompare(a.data))[0];
  return mudanca?.data ?? e.inicio;
}

function notaJornada(e: EntradaSaude, hoje: string) {
  const ini = inicioDoCiclo(e);
  const prazos = PRAZOS[e.tipo];
  if (!ini || !prazos) return { nota: null, detalhe: "Sem início do ciclo ou programa sem prazos definidos" };
  const datas = new Map(e.etapas.filter(x => !x.programa || x.programa === e.tipo).map(x => [x.nome, x.data]));
  const notas: number[] = [];
  const atrasos: string[] = [];
  for (const [etapa, prazo] of Object.entries(prazos)) {
    const limite = somaDias(ini, prazo);
    const feita = datas.get(etapa);
    if (feita) {
      const atraso = diasEntre(limite, feita);
      notas.push(atraso <= 0 ? 100 : atraso <= TOLERANCIA_ATRASO ? 70 : 40);
      if (atraso > 0) atrasos.push(`${etapa} feita com ${atraso} dias de atraso`);
    } else if (hoje > limite) {
      notas.push(0);
      atrasos.push(`${etapa} vencida há ${diasEntre(limite, hoje)} dias`);
    }
  }
  if (!notas.length) return { nota: null, detalhe: "Nenhuma etapa com prazo vencido ainda" };
  let nota = notas.reduce((a, b) => a + b, 0) / notas.length;
  if (datas.get("entrevista")) nota += BONUS.entrevista;
  if (e.vagaData || datas.get("aprovacao")) nota += BONUS.aprovacao;
  return {
    nota: Math.min(100, Math.round(nota)),
    detalhe: atrasos.length ? atrasos.join("; ") : `${notas.length} etapa(s) no prazo`,
  };
}

function notaEncontros(e: EntradaSaude, hoje: string) {
  const obrig = OBRIGATORIOS(e.tipo);
  const desde = somaDias(hoje, -JANELA_ENCONTROS_DIAS);
  const ini = inicioDoCiclo(e);
  const validos = e.presencas.filter(p => {
    const [ym, chave, data] = p.encontro.split("|");
    const quando = data ?? `${ym}-15`;
    return obrig.includes(chave) && quando >= desde && quando <= hoje && (!ini || quando >= dia(ini));
  });
  if (!validos.length) return { nota: null, detalhe: `Sem encontros obrigatórios registrados nos últimos ${JANELA_ENCONTROS_DIAS} dias` };
  const pres = validos.filter(p => p.presente).length;
  return {
    nota: Math.round((pres / validos.length) * 100),
    detalhe: `${pres} de ${validos.length} encontros obrigatórios nos últimos ${JANELA_ENCONTROS_DIAS} dias`,
  };
}

function notaAcompanhamento(e: EntradaSaude, hoje: string) {
  const v = e.varredura;
  if (!v || !(v.banda in NOTA_BANDA)) return { nota: null, detalhe: "Sem varredura de acompanhamento" };
  const idade = diasEntre(v.data, hoje);
  if (idade > VALIDADE_VARREDURA_DIAS) return { nota: null, detalhe: `Última varredura há ${idade} dias (vale por ${VALIDADE_VARREDURA_DIAS})` };
  return { nota: NOTA_BANDA[v.banda], detalhe: `Varredura de ${dia(v.data).split("-").reverse().join("/")}: ${v.banda}` };
}

export function calcularSaude(e: EntradaSaude, hoje: string): ResultadoSaude {
  const partes = {
    jornada: notaJornada(e, hoje),
    encontros: notaEncontros(e, hoje),
    acompanhamento: notaAcompanhamento(e, hoje),
  };
  const com = (Object.keys(partes) as Parte[]).filter(k => partes[k].nota !== null);
  if (!com.length) return { nota: null, nivel: null, partes, trava: null };
  const pesoTotal = com.reduce((a, k) => a + PESOS[k], 0);
  const nota = Math.round(com.reduce((a, k) => a + partes[k].nota! * PESOS[k], 0) / pesoTotal);
  let nivel = nivelDaNota(nota);
  let trava: string | null = null;
  if (nivel === "Saudável" && partes.acompanhamento.nota === NOTA_BANDA.vermelho) {
    nivel = "Atenção";
    trava = "Varredura vermelha não permite Saudável";
  }
  return { nota, nivel, partes, trava };
}

// O ajuste manual vale até chegar uma varredura mais nova que ele.
export function ajusteVigente(ajusteEm: string | null, ultimaVarreduraEm: string | null) {
  return !!ajusteEm && (!ultimaVarreduraEm || dia(ultimaVarreduraEm) <= dia(ajusteEm));
}

export function resumoSaude(r: ResultadoSaude) {
  const partes = (Object.keys(r.partes) as Parte[])
    .map(k => `${ROTULO_PARTE[k]} ${r.partes[k].nota ?? "—"}`)
    .join(" · ");
  return `Nota ${r.nota ?? "—"} (${partes})${r.trava ? ` — ${r.trava}` : ""}`;
}
