import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirPilarApi } from "@/lib/auth";
import { erro, semSenha, texto } from "@/lib/comercial-servidor";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirPilarApi("comercial");
  const negado = semSenha(usuario);
  if (negado) return negado;
  const { id } = await params;
  const t = texto((await req.json()).texto, 4000);
  if (!t) return erro("Escreva a anotação.");
  if (!(await prisma.lead.findUnique({ where: { id }, select: { id: true } }))) return erro("Lead não encontrado.", 404);
  const nota = await prisma.leadNota.create({ data: { leadId: id, texto: t, autor: usuario.nome } });
  return NextResponse.json(nota, { status: 201 });
}
