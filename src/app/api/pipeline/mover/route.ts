import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirPilarApi } from "@/lib/auth";
import { registrarAtividade } from "@/lib/atividade";
import { hojeISO } from "@/lib/dias-uteis";
import { criarTarefaDaEtapa, negar, podeOperar } from "@/lib/pipeline-servidor";

// Move a mentorada de etapa. `data` = quando aconteceu (padrão: hoje); conta o prazo da tarefa automática.
export async function POST(req: NextRequest) {
  const usuario = await exigirPilarApi("posvenda");
  const negado = negar(usuario, podeOperar(usuario), ["jornada", "acompanhamento"]);
  if (negado) return negado;
  const { mentoradaId, faseId, data } = await req.json();
  const dia = typeof data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : hojeISO();

  const m = await prisma.mentorada.findUnique({ where: { id: mentoradaId }, select: { id: true, nome: true, pipelineFaseId: true } });
  if (!m) return NextResponse.json({ erro: "Mentorada não encontrada." }, { status: 404 });
  const fase = faseId ? await prisma.pipelineFase.findUnique({ where: { id: faseId } }) : null;
  if (faseId && !fase) return NextResponse.json({ erro: "Essa etapa não existe mais. Recarregue a página." }, { status: 404 });

  await prisma.mentorada.update({
    where: { id: m.id },
    data: { pipelineFaseId: fase?.id ?? null, pipelineFaseEm: fase ? new Date(dia) : null },
  });
  const tarefa = fase ? await criarTarefaDaEtapa(fase, m.id, dia, usuario.nome) : null;
  await registrarAtividade(usuario, {
    acao: "editou", entidade: "pipeline", mentoradaId: m.id,
    resumo: `Moveu ${m.nome} para ${fase ? `"${fase.nome}"` : "Sem etapa"} no Pipeline${tarefa ? ` (tarefa: ${tarefa.titulo})` : ""}`,
  });

  const tarefas = await prisma.tarefa.findMany({
    where: { mentoradaId: m.id, concluidaEm: null }, orderBy: { prazo: "asc" }, select: { id: true, titulo: true, prazo: true },
  });
  return NextResponse.json({
    pipelineFaseId: fase?.id ?? null,
    pipelineFaseEm: fase ? dia : null,
    tarefa: tarefa ? { titulo: tarefa.titulo, prazo: tarefa.prazo.toISOString().slice(0, 10) } : null,
    tarefas: tarefas.map(t => ({ ...t, prazo: t.prazo.toISOString().slice(0, 10) })),
  });
}
