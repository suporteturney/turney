import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { atualizarStatusAutomatico } from "@/lib/status-automatico";
import { podeOperar } from "@/lib/pipeline-servidor";
import { hojeISO } from "@/lib/dias-uteis";
import InicioCliente from "./InicioCliente";

// "Meu painel": o que cada pessoa da equipe precisa ver ao entrar.
// As mentoradas "dela" são as que têm o nome dela como responsável ou tutora.
// Quem ainda não tem mentoradas próprias vê a base toda.

const ATIVOS = ["Ativo", "Em Andamento", "Em Renovação", "Congelado"];
const DIA = 86_400_000;
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function ehDela(nomeUsuario: string, campo: string | null) {
  if (!campo) return false;
  const u = norm(nomeUsuario).split(/\s+/);
  const c = norm(campo).split(/\s+/).filter(Boolean);
  return c.length > 0 && c.every(p => u.includes(p));
}

export default async function InicioPage() {
  await atualizarStatusAutomatico();
  const usuario = await exigirUsuario();
  const hoje = hojeISO();
  const hora = +new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "numeric", hour12: false }).format(new Date());

  const [mentoradas, tarefas, fases] = await Promise.all([
    prisma.mentorada.findMany({
      where: { status: { in: ATIVOS } },
      orderBy: { nome: "asc" },
      select: {
        id: true, nome: true, tipo: true, status: true, saude: true, saudeMotivo: true,
        resp: true, tutora: true, prazo: true, congelamentoAte: true, renovacaoStatus: true, pipelineFaseId: true,
        acompanhamentos: { orderBy: { data: "desc" }, take: 1, select: { data: true } },
      },
    }),
    prisma.tarefa.findMany({
      where: { concluidaEm: null },
      orderBy: [{ prazo: "asc" }, { createdAt: "asc" }],
      include: { mentorada: { select: { id: true, nome: true, tipo: true, resp: true, tutora: true } }, fase: { select: { nome: true } } },
    }),
    prisma.pipelineFase.findMany({ orderBy: { ordem: "asc" }, select: { id: true, nome: true } }),
  ]);

  const minhas = mentoradas.filter(m => ehDela(usuario.nome, m.resp) || ehDela(usuario.nome, m.tutora));
  const carteiraPropria = minhas.length > 0;
  const base = carteiraPropria ? minhas : mentoradas;
  const idsBase = new Set(base.map(m => m.id));
  const minhasTarefas = tarefas.filter(t =>
    t.mentorada ? (carteiraPropria ? idsBase.has(t.mentorada.id) : true) : (carteiraPropria ? t.criadaPor === usuario.nome : true)
  );

  const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
  const ate = (dias: number) => new Date(Date.parse(hoje) + dias * DIA).toISOString().slice(0, 10);

  return (
    <InicioCliente
      nome={usuario.nome.split(" ")[0]}
      saudacao={hora < 5 ? "Boa noite" : hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite"}
      hoje={hoje}
      carteiraPropria={carteiraPropria}
      podeConcluir={podeOperar(usuario) && !usuario.trocarSenha}
      fases={fases}
      mentoradas={base.map(m => ({
        id: m.id, nome: m.nome, tipo: m.tipo, status: m.status, saude: m.saude, saudeMotivo: m.saudeMotivo,
        prazo: iso(m.prazo), congelamentoAte: iso(m.congelamentoAte), renovacaoStatus: m.renovacaoStatus,
        pipelineFaseId: m.pipelineFaseId, ultimoAcompanhamento: iso(m.acompanhamentos[0]?.data ?? null),
      }))}
      tarefas={minhasTarefas.map(t => ({
        id: t.id, titulo: t.titulo, prazo: t.prazo.toISOString().slice(0, 10), automatica: t.automatica, fase: t.fase?.nome ?? null,
        mentorada: t.mentorada ? { id: t.mentorada.id, nome: t.mentorada.nome, tipo: t.mentorada.tipo } : null,
      }))}
      limites={{ em7: ate(7), em15: ate(15), ha30: ate(-30) }}
    />
  );
}
