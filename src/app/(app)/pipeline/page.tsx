import { prisma } from "@/lib/prisma";
import { exigirPilar } from "@/lib/auth";
import { atualizarStatusAutomatico } from "@/lib/status-automatico";
import { podeEditarEtapas, podeOperar } from "@/lib/pipeline-servidor";
import PipelineCliente from "./PipelineCliente";

// Só quem está com a mentoria em andamento aparece no Kanban.
const ATIVOS = ["Ativo", "Em Andamento", "Em Renovação", "Congelado"];

export default async function PipelinePage() {
  const usuario = await exigirPilar("posvenda");
  await atualizarStatusAutomatico();
  const [fases, mentoradas] = await Promise.all([
    prisma.pipelineFase.findMany({ orderBy: { ordem: "asc" } }),
    prisma.mentorada.findMany({
      where: { status: { in: ATIVOS } },
      orderBy: { nome: "asc" },
      select: {
        id: true, nome: true, codigo: true, tipo: true, status: true, saude: true,
        pipelineFaseId: true, pipelineFaseEm: true,
        tarefas: { where: { concluidaEm: null }, orderBy: { prazo: "asc" }, select: { id: true, titulo: true, prazo: true } },
      },
    }),
  ]);

  return (
    <PipelineCliente
      fases={fases.map(f => ({ id: f.id, nome: f.nome, tarefaTexto: f.tarefaTexto, tarefaDiasUteis: f.tarefaDiasUteis }))}
      cards={mentoradas.map(m => ({
        ...m,
        pipelineFaseEm: m.pipelineFaseEm?.toISOString().slice(0, 10) ?? null,
        tarefas: m.tarefas.map(t => ({ ...t, prazo: t.prazo.toISOString().slice(0, 10) })),
      }))}
      podeMover={podeOperar(usuario) && !usuario.trocarSenha}
      podeEditar={podeEditarEtapas(usuario) && !usuario.trocarSenha}
    />
  );
}
