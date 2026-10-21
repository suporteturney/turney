import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  await exigirUsuario();
  const { id } = await params;
  const { acao, destino, data, novoPrazo, obs } = await req.json();
  if (!acao || !destino || !data) {
    return NextResponse.json({ erro: "Informe ação, programa e data da renovação" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (acao === "RENOVAÇÃO") updates.status = "Ativo";
  if (novoPrazo) updates.prazo = new Date(novoPrazo);

  const [r] = await prisma.$transaction([
    prisma.renovacao.create({
      data: {
        mentoradaId: id,
        acao,
        destino,
        data: new Date(data),
        novoPrazo: novoPrazo ? new Date(novoPrazo) : null,
        obs: (obs || "").trim() || null,
      },
    }),
    prisma.mentorada.update({ where: { id }, data: updates }),
  ]);
  return NextResponse.json(r);
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  await exigirUsuario();
  const { id } = await params;
  const item = new URL(req.url).searchParams.get("item");
  if (!item) return NextResponse.json({ erro: "Item ausente" }, { status: 400 });
  await prisma.renovacao.deleteMany({ where: { id: item, mentoradaId: id } });
  return NextResponse.json({ ok: true });
}
