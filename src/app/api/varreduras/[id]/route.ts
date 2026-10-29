import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirUsuario, semPermissao } from "@/lib/auth";
import { registrarAtividade } from "@/lib/atividade";
import { recalcularSaude } from "@/lib/saude-servidor";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirUsuario();
  const negado = semPermissao(usuario, "excluir");
  if (negado) return negado;
  const { id } = await params;
  const v = await prisma.varredura.findUnique({ where: { id }, select: { programa: true, data: true } });
  const itens = await prisma.varreduraItem.findMany({ where: { varreduraId: id }, select: { mentoradaId: true } });
  await prisma.varredura.deleteMany({ where: { id } });
  await recalcularSaude(itens.map(i => i.mentoradaId).filter((x): x is string => !!x));
  if (v) await registrarAtividade(usuario, { acao: "excluiu", entidade: "varredura", resumo: `Excluiu a varredura ${v.programa ?? ""} de ${v.data.toISOString().slice(0, 10).split("-").reverse().join("/")}` });
  return NextResponse.json({ ok: true });
}
