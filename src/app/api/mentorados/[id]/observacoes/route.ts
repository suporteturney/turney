import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const usuario = await exigirUsuario();
  const { id } = await params;
  const { texto } = await req.json();
  if (typeof texto !== "string" || !texto.trim()) {
    return NextResponse.json({ erro: "Digite uma observação antes de salvar" }, { status: 400 });
  }
  const o = await prisma.observacao.create({
    data: { mentoradaId: id, data: new Date(), texto: texto.trim(), autor: usuario.nome },
  });
  return NextResponse.json(o);
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  await exigirUsuario();
  const { id } = await params;
  const item = new URL(req.url).searchParams.get("item");
  if (!item) return NextResponse.json({ erro: "Item ausente" }, { status: 400 });
  await prisma.observacao.deleteMany({ where: { id: item, mentoradaId: id } });
  return NextResponse.json({ ok: true });
}
