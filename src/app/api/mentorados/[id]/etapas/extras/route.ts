import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export async function POST(req: NextRequest, { params }: Ctx) {
  await exigirUsuario();
  const { id } = await params;
  const { titulo, data, obs } = await req.json();
  if (!str(titulo)) return NextResponse.json({ erro: "Dê um nome ao encontro extra." }, { status: 400 });

  const mentorada = await prisma.mentorada.findUnique({ where: { id }, select: { tipo: true } });
  if (!mentorada) return NextResponse.json({ erro: "Mentorada não encontrada" }, { status: 404 });

  const etapa = await prisma.etapa.create({
    data: {
      mentoradaId: id,
      programa: mentorada.tipo ?? "",
      nome: `extra:${randomUUID().slice(0, 8)}`,
      titulo: str(titulo),
      obs: str(obs),
      data: data ? new Date(data) : null,
    },
  });
  return NextResponse.json(etapa, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  await exigirUsuario();
  const { id } = await params;
  const body = await req.json();
  const item = str(body.item);
  if (!item) return NextResponse.json({ erro: "Encontro inválido" }, { status: 400 });

  const dados: Record<string, unknown> = {};
  if ("data" in body) dados.data = body.data ? new Date(body.data) : null;
  if ("titulo" in body) {
    if (!str(body.titulo)) return NextResponse.json({ erro: "O encontro precisa de um nome." }, { status: 400 });
    dados.titulo = str(body.titulo);
  }
  if ("obs" in body) dados.obs = str(body.obs);

  const r = await prisma.etapa.updateMany({ where: { id: item, mentoradaId: id, nome: { startsWith: "extra:" } }, data: dados });
  if (!r.count) return NextResponse.json({ erro: "Encontro não encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  await exigirUsuario();
  const { id } = await params;
  const item = new URL(req.url).searchParams.get("item");
  if (!item) return NextResponse.json({ erro: "Encontro inválido" }, { status: 400 });
  await prisma.etapa.deleteMany({ where: { id: item, mentoradaId: id, nome: { startsWith: "extra:" } } });
  return NextResponse.json({ ok: true });
}
