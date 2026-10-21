import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await exigirUsuario();
  const { id } = await params;
  const { encontro, presente } = await req.json();
  if (typeof encontro !== "string" || !encontro) {
    return NextResponse.json({ erro: "Encontro inválido" }, { status: 400 });
  }

  if (presente === null || presente === undefined) {
    await prisma.presenca.deleteMany({ where: { mentoradaId: id, encontro } });
    return NextResponse.json({ ok: true });
  }

  const p = await prisma.presenca.upsert({
    where: { mentoradaId_encontro: { mentoradaId: id, encontro } },
    update: { presente: Boolean(presente) },
    create: { mentoradaId: id, encontro, presente: Boolean(presente) },
  });
  return NextResponse.json(p);
}
