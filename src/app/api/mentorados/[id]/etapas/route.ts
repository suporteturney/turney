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

  if (!data) {
    await prisma.etapa.deleteMany({ where: { mentoradaId: id, nome } });
    return NextResponse.json({ ok: true });
  }

  const etapa = await prisma.etapa.upsert({
    where: { mentoradaId_nome: { mentoradaId: id, nome } },
    update: { data: new Date(data) },
    create: { mentoradaId: id, nome, data: new Date(data) },
  });
  return NextResponse.json(etapa);
}
