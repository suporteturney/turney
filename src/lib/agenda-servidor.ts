import "server-only";
import { prisma } from "@/lib/prisma";
import { registrarAtividade } from "@/lib/atividade";
import { recalcularSaude } from "@/lib/saude-servidor";
import { etapaFields } from "@/lib/jornada";
import { hojeISO, somarDiasUteis } from "@/lib/dias-uteis";
import { criarTarefaDaEtapa } from "@/lib/pipeline-servidor";
import { acharMentorada, ehMentoriaEstrategica, lerIcal, type EventoAgenda } from "@/lib/agenda-regras";

// Agendas lidas todo dia. Variável AGENDAS_ICS na Vercel, uma por linha: "Nome da mentora | e-mail | link iCal secreto".
// Cada Mentoria Estratégica que já aconteceu vira a data da "Mentoria Individual" na Jornada da mentorada
// (só quando ainda estava vazia) e move o card no Pipeline.

type Mentora = { nome: string; email: string; url: string };
export type ResultadoAgenda = {
  configurado: boolean;
  lidos: number;
  aplicados: { mentorada: string; data: string; etapa: string }[];
  naoEncontrados: { titulo: string; data: string; motivo: string }[];
  erros: string[];
};

const INTERVALO = 3 * 60 * 60_000; // no máximo a cada 3 horas por servidor
const JANELA_DIAS = 120;
let ultimaVez = 0;

export function mentorasConfiguradas(): Mentora[] {
  return (process.env.AGENDAS_ICS ?? "")
    .split(/\n|;;/)
    .map(l => l.split("|").map(x => x.trim()))
    .filter(p => p.length >= 3 && /^https:\/\//.test(p[2]))
    .map(([nome, email, url]) => ({ nome, email, url }));
}

const diaBrasil = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);

export async function sincronizarAgendas({ forcar = false } = {}): Promise<ResultadoAgenda> {
  const mentoras = mentorasConfiguradas();
  const r: ResultadoAgenda = { configurado: mentoras.length > 0, lidos: 0, aplicados: [], naoEncontrados: [], erros: [] };
  if (!mentoras.length) return r;
  if (!forcar) {
    if (Date.now() - ultimaVez < INTERVALO) return r;
    ultimaVez = Date.now();
  }

  const agora = Date.now();
  const desde = agora - JANELA_DIAS * 86_400_000;
  const lista = await prisma.mentorada.findMany({
    select: { id: true, nome: true, email: true, status: true, tipo: true, pipelineFaseId: true },
  });

  for (const mentora of mentoras) {
    let eventos: EventoAgenda[];
    try {
      const res = await fetch(mentora.url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
      if (!res.ok) throw new Error(`a agenda respondeu ${res.status}`);
      eventos = lerIcal(await res.text());
    } catch (e) {
      r.erros.push(`Agenda de ${mentora.nome}: ${(e as Error).message}`);
      continue;
    }
    const encontros = eventos
      .filter(ev => ev.inicio.getTime() < agora && ev.inicio.getTime() >= desde && ehMentoriaEstrategica(ev.titulo))
      .sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
    r.lidos += encontros.length;

    for (const ev of encontros) {
      const data = diaBrasil(ev.inicio);
      const { mentorada: m, motivo } = acharMentorada(ev, mentora, lista);
      if (!m) { r.naoEncontrados.push({ titulo: ev.titulo, data, motivo: motivo ?? "" }); continue; }
      try {
        const etapa = await aplicarMentoria(m, data, mentora.nome);
        if (etapa) r.aplicados.push({ mentorada: m.nome, data, etapa });
      } catch (e) {
        r.erros.push(`${m.nome}: ${(e as Error).message}`);
      }
    }
  }
  return r;
}

// Grava a data (se ainda não tinha) e leva o card do Pipeline para a etapa certa.
async function aplicarMentoria(
  m: { id: string; nome: string; tipo: string; status: string; pipelineFaseId: string | null },
  data: string,
  mentora: string,
): Promise<string | null> {
  if (!etapaFields(m.tipo).some(f => f.key === "sessao")) return null;
  const programa = m.tipo ?? "";
  const ja = await prisma.etapa.findFirst({
    where: { mentoradaId: m.id, nome: "sessao", programa: { in: [programa, ""] }, data: { not: null } },
  });
  if (ja) return null;

  await prisma.etapa.upsert({
    where: { mentoradaId_programa_nome: { mentoradaId: m.id, programa, nome: "sessao" } },
    update: { data: new Date(data) },
    create: { mentoradaId: m.id, programa, nome: "sessao", data: new Date(data) },
  });
  const sistema = { id: null, nome: `Agenda (${mentora})` };
  await registrarAtividade(sistema, {
    acao: "editou", entidade: "etapa", mentoradaId: m.id,
    resumo: `Marcou Mentoria Individual em ${data.split("-").reverse().join("/")} para ${m.nome} (Mentoria Estratégica na agenda de ${mentora})`,
  });

  let etapa = "Jornada";
  const fases = await prisma.pipelineFase.findMany({ orderBy: { ordem: "asc" } });
  const porNome = (n: string) => fases.find(f => f.nome.toLowerCase() === n.toLowerCase());
  const estrategica = fases.find(f => f.id === "fase_mentoria_estrategica") ?? porNome("Mentoria Estratégica");
  const aplicacoes = fases.find(f => f.id === "fase_aplicacoes") ?? porNome("Aplicações");
  const atual = fases.find(f => f.id === m.pipelineFaseId);
  const ativa = ["Ativo", "Em Andamento", "Em Renovação", "Congelado"].includes(m.status);
  // Só avança quem ainda está antes da Mentoria Estratégica (ou sem etapa).
  if (ativa && estrategica && (!atual || atual.ordem < estrategica.ordem)) {
    const prazo = somarDiasUteis(data, estrategica.tarefaDiasUteis ?? 5);
    // Prazo do roadmap ainda correndo: fica em Mentoria Estratégica com a tarefa. Já passou: segue para Aplicações.
    const destino = prazo >= hojeISO() || !aplicacoes ? estrategica : aplicacoes;
    await prisma.mentorada.update({ where: { id: m.id }, data: { pipelineFaseId: destino.id, pipelineFaseEm: new Date(data) } });
    if (destino.id === estrategica.id) await criarTarefaDaEtapa(estrategica, m.id, data, sistema.nome);
    await registrarAtividade(sistema, {
      acao: "editou", entidade: "pipeline", mentoradaId: m.id,
      resumo: `Moveu ${m.nome} para "${destino.nome}" no Pipeline (Mentoria Estratégica em ${data.split("-").reverse().join("/")})`,
    });
    etapa = destino.nome;
  }
  await recalcularSaude([m.id]);
  return etapa;
}
