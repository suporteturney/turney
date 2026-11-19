import "server-only";
import { prisma } from "@/lib/prisma";
import { registrarAtividade } from "@/lib/atividade";
import { recalcularSaude } from "@/lib/saude-servidor";
import { etapaFields } from "@/lib/jornada";
import { hojeISO, somarDiasUteis } from "@/lib/dias-uteis";
import { criarTarefaDaEtapa } from "@/lib/pipeline-servidor";
import { acharMentorada, classificar, ehMentoriaEstrategica, lerIcal, mentoradaDoEncontro, type EventoAgenda } from "@/lib/agenda-regras";

// Agendas do Google lidas pela plataforma:
// - cadastradas na tela Agendas (tabela AgendaFonte), e/ou
// - na variável AGENDAS_ICS da Vercel, uma por linha: "Nome | e-mail | link iCal secreto".
// A cada leitura:
// 1. Os encontros de 3 semanas atrás até 8 semanas à frente são guardados (EventoAgenda) para o painel.
// 2. Cada Mentoria Estratégica que já aconteceu vira a data da "Mentoria Individual" na Jornada
//    (só quando ainda estava vazia) e move o card no Pipeline.

type Fonte = { id: string | null; nome: string; email: string; url: string };
export type ResultadoAgenda = {
  configurado: boolean;
  lidos: number;
  encontros: number;
  aplicados: { mentorada: string; data: string; etapa: string }[];
  naoEncontrados: { titulo: string; data: string; motivo: string }[];
  erros: string[];
};

const DIA = 86_400_000;
const INTERVALO = 2 * 60 * 60_000; // no máximo a cada 2 horas por servidor
const JANELA_MENTORIA = 120; // dias para trás que marcam a Jornada
const GUARDAR_ANTES = 21;
const GUARDAR_DEPOIS = 56;
let ultimaVez = 0;

function fontesDaVercel(): Fonte[] {
  return (process.env.AGENDAS_ICS ?? "")
    .split(/\n|;;/)
    .map(l => l.split("|").map(x => x.trim()))
    .filter(p => p.length >= 3 && /^https:\/\//.test(p[2]))
    .map(([nome, email, url]) => ({ id: null, nome, email, url }));
}

export async function fontesConfiguradas(): Promise<Fonte[]> {
  const doBanco = await prisma.agendaFonte
    .findMany({ where: { ativo: true }, orderBy: { createdAt: "asc" } })
    .catch(() => []);
  const lista: Fonte[] = doBanco.map(f => ({ id: f.id, nome: f.nome, email: f.email ?? "", url: f.url }));
  for (const f of fontesDaVercel()) if (!lista.some(x => x.url === f.url)) lista.push(f);
  return lista;
}

const diaBrasil = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);

// Baixa e lê uma agenda. Erros em português para mostrar na tela.
export async function baixarAgenda(url: string, de: Date, ate: Date): Promise<EventoAgenda[]> {
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
  } catch {
    throw new Error("não consegui abrir o link (confira se copiou o endereço inteiro)");
  }
  if (res.status === 404 || res.status === 403) throw new Error("o Google recusou o link — copie de novo o “Endereço secreto no formato iCal”");
  if (!res.ok) throw new Error(`a agenda respondeu ${res.status}`);
  const texto = await res.text();
  if (!texto.includes("BEGIN:VCALENDAR")) throw new Error("o link não é de uma agenda iCal (precisa terminar em .ics)");
  return lerIcal(texto, de, ate);
}

export async function sincronizarAgendas({ forcar = false } = {}): Promise<ResultadoAgenda> {
  const fontes = await fontesConfiguradas();
  const r: ResultadoAgenda = { configurado: fontes.length > 0, lidos: 0, encontros: 0, aplicados: [], naoEncontrados: [], erros: [] };
  if (!fontes.length) return r;
  if (!forcar) {
    if (Date.now() - ultimaVez < INTERVALO) return r;
    ultimaVez = Date.now();
  }

  const agora = Date.now();
  const hoje = Date.parse(hojeISO());
  const de = new Date(Math.min(agora - JANELA_MENTORIA * DIA, hoje - GUARDAR_ANTES * DIA));
  const ate = new Date(hoje + GUARDAR_DEPOIS * DIA);
  const guardarDe = new Date(hoje - GUARDAR_ANTES * DIA);
  const lista = await prisma.mentorada.findMany({
    select: { id: true, nome: true, email: true, status: true, tipo: true, pipelineFaseId: true },
  });

  for (const fonte of fontes) {
    let eventos: EventoAgenda[];
    try {
      eventos = await baixarAgenda(fonte.url, de, ate);
    } catch (e) {
      const msg = (e as Error).message;
      r.erros.push(`Agenda de ${fonte.nome}: ${msg}`);
      if (fonte.id) await prisma.agendaFonte.update({ where: { id: fonte.id }, data: { ultimaLeitura: new Date(), ultimoErro: msg } }).catch(() => {});
      continue;
    }
    const dona = { nome: fonte.nome, email: fonte.email };

    // 1. Guarda os encontros da janela (troca tudo o que havia dessa agenda nessa janela).
    const daJanela = eventos.filter(ev => ev.inicio >= guardarDe && ev.inicio <= ate);
    const linhas = daJanela.map(ev => {
      const convidados = ev.emails.filter(e => e !== dona.email.toLowerCase()).length;
      const tipo = classificar(ev.titulo, convidados);
      return {
        agenda: fonte.nome, uid: ev.uid, titulo: ev.titulo.slice(0, 300), inicio: ev.inicio, fim: ev.fim, tipo,
        link: ev.link, convidados, mentoradaId: mentoradaDoEncontro(ev, dona, lista, tipo)?.id ?? null,
      };
    });
    await prisma.$transaction([
      prisma.eventoAgenda.deleteMany({ where: { agenda: fonte.nome, inicio: { gte: guardarDe, lte: ate } } }),
      prisma.eventoAgenda.createMany({ data: linhas }),
    ]);
    r.encontros += linhas.length;
    if (fonte.id) {
      await prisma.agendaFonte.update({ where: { id: fonte.id }, data: { ultimaLeitura: new Date(), ultimoErro: null, eventos: linhas.length } }).catch(() => {});
    }

    // 2. Mentorias Estratégicas que já aconteceram marcam a Jornada e o Pipeline.
    const mentorias = eventos.filter(ev => ev.inicio.getTime() < agora && ev.inicio.getTime() >= agora - JANELA_MENTORIA * DIA && ehMentoriaEstrategica(ev.titulo));
    r.lidos += mentorias.length;
    for (const ev of mentorias) {
      const data = diaBrasil(ev.inicio);
      const { mentorada: m, motivo } = acharMentorada(ev, dona, lista);
      if (!m) { r.naoEncontrados.push({ titulo: ev.titulo, data, motivo: motivo ?? "" }); continue; }
      try {
        const etapa = await aplicarMentoria(m, data, fonte.nome);
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
