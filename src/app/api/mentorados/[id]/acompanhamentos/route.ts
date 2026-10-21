import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const usuario = await exigirUsuario();
  const { id } = await params;
  const { data, tipo, texto, autor } = await req.json();
  if (typeof texto !== "string" || !texto.trim()) {
    return NextResponse.json({ erro: "Escreva o resumo do acompanhamento" }, { status: 400 });
  }
  const a = await prisma.acompanhamento.create({
    data: {
      mentoradaId: id,
      data: data ? new Date(data) : new Date(),
      tipo: tipo || null,
      texto: texto.trim(),
      autor: (autor || "").trim() || usuario.nome,
    },
  });
  return NextResponse.json(a);
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  await exigirUsuario();
  const { id } = await params;
  const item = new URL(req.url).searchParams.get("item");
  if (!item) return NextResponse.json({ erro: "Item ausente" }, { status: 400 });
  await prisma.acompanhamento.deleteMany({ where: { id: item, mentoradaId: id } });
  return NextResponse.json({ ok: true });
}
