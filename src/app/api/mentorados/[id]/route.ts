import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await exigirUsuario();
  const { id } = await params;

  const mentorado = await prisma.mentorada.findUnique({
    where: { id },
    include: {
      etapas: { orderBy: { createdAt: "asc" } },
      presencas: { orderBy: { encontro: "asc" } },
      acompanhamentos: { orderBy: { data: "desc" } },
    },
  });

  if (!mentorado) return NextResponse.json({ erro: "Não encontrado" }, { status: 404 });
  return NextResponse.json(mentorado);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await exigirUsuario();
  const { id } = await params;
  const data = await req.json();

  const updates: Record<string, unknown> = {};
  const campos = [
    "nome", "email", "whatsapp", "status", "saude", "area",
    "localizacao", "turma", "produtoAnterior", "origem", "resp", "obs",
    "tipo", "duracao",
  ];
  for (const campo of campos) {
    if (campo in data) updates[campo] = data[campo];
  }
  if ("inicio" in data) updates.inicio = data.inicio ? new Date(data.inicio) : null;
  if ("prazo" in data) updates.prazo = data.prazo ? new Date(data.prazo) : null;

  const mentorado = await prisma.mentorada.update({ where: { id }, data: updates });
  return NextResponse.json(mentorado);
}
