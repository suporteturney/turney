import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { registrarAtividade } from "@/lib/atividade";
import { negar, podeOperar } from "@/lib/pipeline-servidor";

const DATA = /^\d{4}-\d{2}-\d{2}$/;

// Concluir / reabrir, mudar o texto ou o prazo.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirUsuario();
  const negado = negar(usuario, podeOperar(usuario), ["jornada", "acompanhamento"]);
  if (negado) return negado;
  const { id } = await params;
  const body = await req.json();
  const atual = await prisma.tarefa.findUnique({ where: { id }, include: { mentorada: { select: { nome: true } } } });
  if (!atual) return NextResponse.json({ erro: "Tarefa não encontrada." }, { status: 404 });

  const data: { titulo?: string; prazo?: Date; concluidaEm?: Date | null; concluidaPor?: string | null } = {};
  if ("titulo" in body) {
    const t = typeof body.titulo === "string" ? body.titulo.trim() : "";
    if (!t) return NextResponse.json({ erro: "A tarefa precisa de um texto." }, { status: 400 });
    data.titulo = t;
  }
  if ("prazo" in body) {
    if (typeof body.prazo !== "string" || !DATA.test(body.prazo)) return NextResponse.json({ erro: "Prazo inválido." }, { status: 400 });
    data.prazo = new Date(body.prazo);
  }
  if ("concluida" in body) {
    data.concluidaEm = body.concluida ? new Date() : null;
    data.concluidaPor = body.concluida ? usuario.nome : null;
  }
  const t = await prisma.tarefa.update({ where: { id }, data });
  const de = atual.mentorada ? ` de ${atual.mentorada.nome}` : "";
  await registrarAtividade(usuario, {
    acao: "editou", entidade: "tarefa", mentoradaId: atual.mentoradaId,
    resumo: "concluida" in body
      ? `${body.concluida ? "Concluiu" : "Reabriu"} a tarefa "${t.titulo}"${de}`
      : `Editou a tarefa "${t.titulo}"${de}`,
  });
  return NextResponse.json({ ...t, prazo: t.prazo.toISOString().slice(0, 10), concluidaEm: t.concluidaEm?.toISOString() ?? null });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirUsuario();
  const negado = negar(usuario, podeOperar(usuario), ["jornada", "acompanhamento"]);
  if (negado) return negado;
  const { id } = await params;
  const atual = await prisma.tarefa.findUnique({ where: { id }, include: { mentorada: { select: { nome: true } } } });
  if (!atual) return NextResponse.json({ erro: "Tarefa não encontrada." }, { status: 404 });
  await prisma.tarefa.delete({ where: { id } });
  await registrarAtividade(usuario, {
    acao: "excluiu", entidade: "tarefa", mentoradaId: atual.mentoradaId,
    resumo: `Excluiu a tarefa "${atual.titulo}"${atual.mentorada ? ` de ${atual.mentorada.nome}` : ""}`,
  });
  return NextResponse.json({ ok: true });
}
