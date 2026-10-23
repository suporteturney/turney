import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await exigirUsuario();
  const { id } = await params;
  const { nome, data } = await req.json();
  if (typeof nome !== "string" || !nome) {
    return NextResponse.json({ erro: "Etapa inválida" }, { status: 400 });
  }

  const mentorada = await prisma.mentorada.findUnique({ where: { id }, select: { tipo: true } });
  if (!mentorada) return NextResponse.json({ erro: "Mentorada não encontrada" }, { status: 404 });
  const programa = mentorada.tipo ?? "";

  if (!data) {
    await prisma.etapa.deleteMany({ where: { mentoradaId: id, nome, programa: { in: [programa, ""] } } });
    return NextResponse.json({ ok: true });
  }

  const etapa = await prisma.etapa.upsert({
    where: { mentoradaId_programa_nome: { mentoradaId: id, programa, nome } },
    update: { data: new Date(data) },
    create: { mentoradaId: id, programa, nome, data: new Date(data) },
  });
  return NextResponse.json(etapa);
}
