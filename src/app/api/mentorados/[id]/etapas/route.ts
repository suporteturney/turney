import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirUsuario, semPermissao } from "@/lib/auth";
import { nomeDaMentorada, registrarAtividade } from "@/lib/atividade";
import { nomeEtapa } from "@/lib/jornada";
import { recalcularSaude } from "@/lib/saude-servidor";
import { aoMarcarMentoriaEstrategica } from "@/lib/pipeline-servidor";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const usuario = await exigirUsuario();
  const negado = semPermissao(usuario, "jornada");
  if (negado) return negado;
  const { id } = await params;
  const { nome, data } = await req.json();
  if (typeof nome !== "string" || !nome) {
    return NextResponse.json({ erro: "Etapa inválida" }, { status: 400 });
  }

  const mentorada = await prisma.mentorada.findUnique({ where: { id }, select: { id: true, nome: true, tipo: true, status: true, pipelineFaseId: true } });
  if (!mentorada) return NextResponse.json({ erro: "Mentorada não encontrada" }, { status: 404 });
  const programa = mentorada.tipo ?? "";

  if (!data) {
    await prisma.etapa.deleteMany({ where: { mentoradaId: id, nome, programa: { in: [programa, ""] } } });
    await registrarAtividade(usuario, { acao: "editou", entidade: "etapa", mentoradaId: id, resumo: `Limpou a data de ${nomeEtapa(nome)} de ${await nomeDaMentorada(id)}` });
    await recalcularSaude([id]);
    return NextResponse.json({ ok: true });
  }

  const etapa = await prisma.etapa.upsert({
    where: { mentoradaId_programa_nome: { mentoradaId: id, programa, nome } },
    update: { data: new Date(data) },
    create: { mentoradaId: id, programa, nome, data: new Date(data) },
  });
  await registrarAtividade(usuario, {
    acao: "editou", entidade: "etapa", mentoradaId: id,
    resumo: `Marcou ${nomeEtapa(nome)} em ${String(data).slice(0, 10).split("-").reverse().join("/")} para ${await nomeDaMentorada(id)}`,
  });
  // Mentoria Estratégica marcada: Pipeline + tarefa "Enviar o roadmap" (5 dias úteis).
  if (nome === "sessao") await aoMarcarMentoriaEstrategica(mentorada, String(data), usuario);
  await recalcularSaude([id]);
  return NextResponse.json(etapa);
}
