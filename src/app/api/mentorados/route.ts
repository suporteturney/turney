import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";

export async function GET(req: NextRequest) {
  await exigirUsuario();
  const { searchParams } = new URL(req.url);
  const tipo = searchParams.get("tipo");
  const status = searchParams.get("status");
  const busca = searchParams.get("q");

  const where: Record<string, unknown> = {};
  if (tipo) where.tipo = tipo;
  if (status) where.status = status;
  if (busca) {
    where.OR = [
      { nome: { contains: busca, mode: "insensitive" } },
      { email: { contains: busca, mode: "insensitive" } },
      { codigo: { contains: busca, mode: "insensitive" } },
    ];
  }

  const mentorados = await prisma.mentorada.findMany({
    where,
    orderBy: { nome: "asc" },
    include: { etapas: true, presencas: true },
  });

  return NextResponse.json(mentorados);
}

export async function POST(req: NextRequest) {
  await exigirUsuario();
  const data = await req.json();

  const mentorado = await prisma.mentorada.create({
    data: {
      codigo: data.codigo,
      nome: data.nome,
      email: data.email,
      whatsapp: data.whatsapp,
      tipo: data.tipo,
      status: data.status ?? "Ativo",
      saude: data.saude,
      inicio: data.inicio ? new Date(data.inicio) : null,
      prazo: data.prazo ? new Date(data.prazo) : null,
      duracao: data.duracao,
      area: data.area,
      localizacao: data.localizacao,
      turma: data.turma,
      produtoAnterior: data.produtoAnterior,
      origem: data.origem,
      resp: data.resp,
      obs: data.obs,
    },
  });

  return NextResponse.json(mentorado, { status: 201 });
}
