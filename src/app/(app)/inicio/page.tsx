import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { pode } from "@/lib/permissoes";
import { atualizarStatusAutomatico } from "@/lib/status-automatico";
import { podeOperar } from "@/lib/pipeline-servidor";
import { hojeISO } from "@/lib/dias-uteis";
import { casaNome } from "@/lib/nomes-equipe";
import { urlFoto } from "@/lib/foto";
import InicioCliente from "./InicioCliente";

// "Meu painel": o que cada pessoa da equipe precisa ver ao entrar.
// - As mentoradas "dela" são as que têm o nome dela como responsável ou tutora
//   (quem ainda não tem mentoradas próprias vê a base toda).
// - O dono de cada tarefa é o responsável escolhido; se não tiver, quem cuida da mentorada; se não, quem criou.
// - Quem tem a permissão Equipe (gestora) vê também as tarefas de cada pessoa da equipe.

const ATIVOS = ["Ativo", "Em Andamento", "Em Renovação", "Congelado"];
const DIA = 86_400_000;
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const ehDela = casaNome;

export default async function InicioPage() {
  await atualizarStatusAutomatico();
  const usuario = await exigirUsuario();
  const hoje = hojeISO();
  const hora = +new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "numeric", hour12: false }).format(new Date());
  const ate = (dias: number) => new Date(Date.parse(hoje) + dias * DIA).toISOString().slice(0, 10);

  // Semana de segunda a domingo.
  const diaSemana = (new Date(`${hoje}T12:00:00Z`).getUTCDay() + 6) % 7; // 0 = segunda
  const segunda = ate(-diaSemana);
  const domingoQueVem = ate(13 - diaSemana);

  const [mentoradas, tarefas, fases, usuarios, encerrando, eventos, fontes] = await Promise.all([
    prisma.mentorada.findMany({
      where: { status: { in: ATIVOS } },
      orderBy: { nome: "asc" },
      select: {
        id: true, nome: true, tipo: true, status: true, saude: true, saudeMotivo: true, whatsapp: true,
        resp: true, tutora: true, prazo: true, congelamentoAte: true, renovacaoStatus: true, pipelineFaseId: true,
        acompanhamentos: { orderBy: { data: "desc" }, take: 1, select: { data: true } },
      },
    }),
    // Abertas e as concluídas nas últimas 3 semanas (para a semana mostrar o que já foi feito).
    prisma.tarefa.findMany({
      where: { OR: [{ concluidaEm: null }, { concluidaEm: { gte: new Date(Date.parse(hoje) - 21 * DIA) } }] },
      orderBy: [{ prazo: "asc" }, { createdAt: "asc" }],
      include: {
        mentorada: { select: { id: true, nome: true, tipo: true, whatsapp: true, resp: true, tutora: true } },
        fase: { select: { nome: true } },
      },
    }),
    prisma.pipelineFase.findMany({ orderBy: { ordem: "asc" }, select: { id: true, nome: true } }),
    prisma.usuario.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true, papel: true, foto: { select: { atualizadaEm: true } } } }),
    prisma.mentorada.findMany({
      where: { prazo: { gte: new Date(segunda), lte: new Date(domingoQueVem) }, status: { notIn: ["Churn", "Congelado"] } },
      orderBy: { prazo: "asc" },
      select: { id: true, nome: true, tipo: true, status: true, prazo: true, renovacaoStatus: true, saude: true, whatsapp: true, resp: true, tutora: true },
    }),
    // Encontros das agendas do Google (semana passada até 4 semanas à frente).
    prisma.eventoAgenda.findMany({
      where: { inicio: { gte: new Date(Date.parse(segunda) - 7 * DIA), lt: new Date(Date.parse(segunda) + 35 * DIA) } },
      orderBy: { inicio: "asc" },
      include: { mentorada: { select: { id: true, nome: true, tipo: true } } },
    }).catch(() => []),
    prisma.agendaFonte.count({ where: { ativo: true } }).catch(() => 0),
  ]);

  // O mesmo encontro pode estar em mais de uma agenda (ex.: agenda do grupo + convite na agenda pessoal):
  // mostra uma vez só, ficando com a cópia que tem mais informação (a pessoal às vezes só diz "Busy").
  const nota = (e: (typeof eventos)[number]) =>
    (/^(busy|ocupad[oa])$/i.test(e.titulo.trim()) ? 0 : 2) + (e.tipo === "outro" ? 0 : 1) + (e.mentoradaId ? 1 : 0);
  const melhores = new Map<string, (typeof eventos)[number]>();
  for (const e of eventos) {
    // Compromisso pessoal só aparece para a dona da agenda.
    if (e.tipo === "pessoal" && !ehDela(usuario.nome, e.agenda)) continue;
    const chave = `${e.uid.split("|")[0]}|${e.inicio.getTime()}`;
    const atual = melhores.get(chave);
    if (!atual || nota(e) > nota(atual)) melhores.set(chave, e);
  }
  const encontros = [...melhores.values()].sort((a, b) => a.inicio.getTime() - b.inicio.getTime());

  // Equipe: acessos ativos (sem repetir nomes).
  const equipe: { nome: string; papel: string; foto: string | null }[] = [];
  for (const u of usuarios) {
    const ja = equipe.find(e => norm(e.nome) === norm(u.nome));
    if (!ja) equipe.push({ nome: u.nome, papel: u.papel, foto: urlFoto(u.id, u.foto) });
    else if (!ja.foto) ja.foto = urlFoto(u.id, u.foto);
  }

  // Nome escrito na tarefa ou na mentorada → nome completo de quem tem acesso (se achar).
  const nomeDaEquipe = (campo: string | null) => {
    if (!campo || /^agenda\b/i.test(campo)) return null;
    const achados = equipe.filter(e => ehDela(e.nome, campo));
    return achados.length === 1 ? achados[0].nome : campo.trim();
  };
  const dono = (t: (typeof tarefas)[number]) =>
    nomeDaEquipe(t.responsavel) ?? nomeDaEquipe(t.mentorada?.tutora ?? null) ?? nomeDaEquipe(t.mentorada?.resp ?? null) ?? nomeDaEquipe(t.criadaPor);

  // Quem aparece como responsável mas ainda não tem acesso (ex.: Daryane antes de ganhar login).
  for (const t of tarefas) {
    const d = dono(t);
    if (d && !equipe.some(e => norm(e.nome) === norm(d))) equipe.push({ nome: d, papel: "sem acesso", foto: null });
  }
  const eu = equipe.find(e => norm(e.nome) === norm(usuario.nome))?.nome ?? usuario.nome;
  equipe.sort((a, b) => (a.nome === eu ? -1 : b.nome === eu ? 1 : a.nome.localeCompare(b.nome, "pt-BR")));

  const minhas = mentoradas.filter(m => ehDela(usuario.nome, m.resp) || ehDela(usuario.nome, m.tutora));
  const carteiraPropria = minhas.length > 0;
  const base = carteiraPropria ? minhas : mentoradas;

  const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
  const gestora = pode(usuario, "equipe");

  return (
    <InicioCliente
      eu={eu}
      agora={new Date().getTime()}
      agendaLigada={fontes > 0 || !!process.env.AGENDAS_ICS?.trim()}
      encontros={encontros.map(e => ({
        id: e.id, titulo: e.titulo, inicio: e.inicio.toISOString(), fim: e.fim?.toISOString() ?? null, tipo: e.tipo,
        link: e.link, agenda: e.agenda, convidados: e.convidados, mentorada: e.mentorada,
      }))}
      nome={usuario.nome.split(" ")[0]}
      saudacao={hora < 5 ? "Boa noite" : hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite"}
      hoje={hoje}
      segunda={segunda}
      carteiraPropria={carteiraPropria}
      gestora={gestora}
      podeEditar={podeOperar(usuario) && !usuario.trocarSenha}
      podePresenca={pode(usuario, "presencas") && !usuario.trocarSenha}
      equipe={gestora ? equipe : equipe.filter(e => e.nome === eu)}
      fases={fases}
      todasMentoradas={mentoradas.map(m => ({ id: m.id, nome: m.nome }))}
      mentoradas={base.map(m => ({
        id: m.id, nome: m.nome, tipo: m.tipo, status: m.status, saude: m.saude, saudeMotivo: m.saudeMotivo, whatsapp: m.whatsapp,
        prazo: iso(m.prazo), congelamentoAte: iso(m.congelamentoAte), renovacaoStatus: m.renovacaoStatus,
        pipelineFaseId: m.pipelineFaseId, ultimoAcompanhamento: iso(m.acompanhamentos[0]?.data ?? null),
      }))}
      encerrando={encerrando
        .filter(m => gestora || !carteiraPropria || ehDela(usuario.nome, m.resp) || ehDela(usuario.nome, m.tutora))
        .map(m => ({
          id: m.id, nome: m.nome, tipo: m.tipo, status: m.status, prazo: iso(m.prazo)!, renovacaoStatus: m.renovacaoStatus,
          saude: m.saude, whatsapp: m.whatsapp, cuida: nomeDaEquipe(m.tutora) ?? nomeDaEquipe(m.resp),
        }))}
      tarefas={tarefas.map(t => ({
        id: t.id, titulo: t.titulo, prazo: t.prazo.toISOString().slice(0, 10), automatica: t.automatica, fase: t.fase?.nome ?? null,
        responsavel: nomeDaEquipe(t.responsavel), dono: dono(t), criadaPor: t.criadaPor,
        concluidaEm: iso(t.concluidaEm), concluidaPor: t.concluidaPor,
        mentorada: t.mentorada ? { id: t.mentorada.id, nome: t.mentorada.nome, tipo: t.mentorada.tipo, whatsapp: t.mentorada.whatsapp } : null,
      }))}
    />
  );
}
