import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirPilarApi } from "@/lib/auth";
import { registrarAtividade } from "@/lib/atividade";
import { negar, podeEditarEtapas } from "@/lib/pipeline-servidor";

// Renomear a etapa ou mudar a tarefa automática dela.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirPilarApi("posvenda");
  const negado = negar(usuario, podeEditarEtapas(usuario), ["equipe"]);
  if (negado) return negado;
  const { id } = await params;
  const body = await req.json();
  const data: { nome?: string; tarefaTexto?: string | null; tarefaDiasUteis?: number | null } = {};
  if ("nome" in body) {
    const n = typeof body.nome === "string" ? body.nome.trim() : "";
    if (!n) return NextResponse.json({ erro: "A etapa precisa de um nome." }, { status: 400 });
    data.nome = n;
  }
  if ("tarefaTexto" in body || "tarefaDiasUteis" in body) {
    const texto = typeof body.tarefaTexto === "string" ? body.tarefaTexto.trim() : "";
    const dias = parseInt(body.tarefaDiasUteis, 10);
    if (texto && !(Number.isFinite(dias) && dias >= 0 && dias <= 365)) {
      return NextResponse.json({ erro: "Informe o prazo da tarefa em dias úteis (0 a 365)." }, { status: 400 });
    }
    data.tarefaTexto = texto || null;
    data.tarefaDiasUteis = texto ? dias : null;
  }
  const antes = await prisma.pipelineFase.findUnique({ where: { id } });
  if (!antes) return NextResponse.json({ erro: "Etapa não encontrada." }, { status: 404 });
  const fase = await prisma.pipelineFase.update({ where: { id }, data });
  await registrarAtividade(usuario, { acao: "editou", entidade: "pipeline", resumo: `Editou a etapa "${fase.nome}" do Pipeline` });
  return NextResponse.json(fase);
}

// Excluir a etapa: as mentoradas dela voltam para "Sem etapa"; as tarefas continuam.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirPilarApi("posvenda");
  const negado = negar(usuario, podeEditarEtapas(usuario), ["equipe"]);
  if (negado) return negado;
  const { id } = await params;
  const fase = await prisma.pipelineFase.findUnique({ where: { id }, include: { _count: { select: { mentoradas: true } } } });
  if (!fase) return NextResponse.json({ erro: "Etapa não encontrada." }, { status: 404 });
  await prisma.$transaction([
    prisma.mentorada.updateMany({ where: { pipelineFaseId: id }, data: { pipelineFaseId: null, pipelineFaseEm: null } }),
    prisma.pipelineFase.delete({ where: { id } }),
  ]);
  await registrarAtividade(usuario, {
    acao: "excluiu", entidade: "pipeline",
    resumo: `Excluiu a etapa "${fase.nome}" do Pipeline (${fase._count.mentoradas} mentorada(s) voltaram para Sem etapa)`,
  });
  return NextResponse.json({ ok: true });
}
