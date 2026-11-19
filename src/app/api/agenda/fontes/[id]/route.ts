import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { pode } from "@/lib/permissoes";
import { registrarAtividade } from "@/lib/atividade";
import { negar } from "@/lib/pipeline-servidor";

// Pausar / religar uma agenda.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirUsuario();
  const negado = negar(usuario, pode(usuario, "equipe"), ["equipe"]);
  if (negado) return negado;
  const { id } = await params;
  const { ativo } = await req.json();
  const f = await prisma.agendaFonte.update({ where: { id }, data: { ativo: !!ativo } }).catch(() => null);
  if (!f) return NextResponse.json({ erro: "Agenda não encontrada." }, { status: 404 });
  if (!f.ativo) await prisma.eventoAgenda.deleteMany({ where: { agenda: f.nome } });
  await registrarAtividade(usuario, { acao: "editou", entidade: "agenda", resumo: `${f.ativo ? "Religou" : "Pausou"} a agenda de ${f.nome}` });
  return NextResponse.json({ ok: true });
}

// Desligar de vez: apaga o link e os encontros guardados dessa agenda (nada muda no Google).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirUsuario();
  const negado = negar(usuario, pode(usuario, "equipe"), ["equipe"]);
  if (negado) return negado;
  const { id } = await params;
  const f = await prisma.agendaFonte.findUnique({ where: { id } });
  if (!f) return NextResponse.json({ erro: "Agenda não encontrada." }, { status: 404 });
  await prisma.$transaction([
    prisma.eventoAgenda.deleteMany({ where: { agenda: f.nome } }),
    prisma.agendaFonte.delete({ where: { id } }),
  ]);
  await registrarAtividade(usuario, { acao: "excluiu", entidade: "agenda", resumo: `Desligou a agenda de ${f.nome} do painel` });
  return NextResponse.json({ ok: true });
}
