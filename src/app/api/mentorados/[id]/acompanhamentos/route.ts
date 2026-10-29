import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirUsuario, semPermissao } from "@/lib/auth";
import { nomeDaMentorada, registrarAtividade } from "@/lib/atividade";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const usuario = await exigirUsuario();
  const negado = semPermissao(usuario, "acompanhamento");
  if (negado) return negado;
  const { id } = await params;
  const { data, tipo, texto, autor, marco, marcoTitulo } = await req.json();
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
      marco: Boolean(marco),
      marcoTitulo: marco ? (marcoTitulo || "").trim() || null : null,
    },
  });
  await registrarAtividade(usuario, { acao: "criou", entidade: "acompanhamento", mentoradaId: id, resumo: `Registrou acompanhamento${a.tipo ? ` (${a.tipo})` : ""} de ${await nomeDaMentorada(id)}`, detalhe: { texto: a.texto.slice(0, 300) } });
  return NextResponse.json(a);
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const usuario = await exigirUsuario();
  const negado = semPermissao(usuario, "acompanhamento");
  if (negado) return negado;
  const { id } = await params;
  const { item, marco, marcoTitulo } = await req.json();
  if (!item) return NextResponse.json({ erro: "Item ausente" }, { status: 400 });
  await prisma.acompanhamento.updateMany({
    where: { id: item, mentoradaId: id },
    data: {
      marco: Boolean(marco),
      marcoTitulo: marco ? (marcoTitulo || "").trim() || null : null,
    },
  });
  await registrarAtividade(usuario, { acao: "editou", entidade: "acompanhamento", mentoradaId: id, resumo: `${marco ? "Marcou" : "Desmarcou"} um acompanhamento como marco de ${await nomeDaMentorada(id)}` });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const usuario = await exigirUsuario();
  const negado = semPermissao(usuario, "excluir");
  if (negado) return negado;
  const { id } = await params;
  const item = new URL(req.url).searchParams.get("item");
  if (!item) return NextResponse.json({ erro: "Item ausente" }, { status: 400 });
  const apagado = await prisma.acompanhamento.findFirst({ where: { id: item, mentoradaId: id }, select: { texto: true, data: true } });
  await prisma.acompanhamento.deleteMany({ where: { id: item, mentoradaId: id } });
  if (apagado) await registrarAtividade(usuario, { acao: "excluiu", entidade: "acompanhamento", mentoradaId: id, resumo: `Excluiu um acompanhamento de ${await nomeDaMentorada(id)}`, detalhe: { texto: apagado.texto.slice(0, 300), data: apagado.data } });
  return NextResponse.json({ ok: true });
}
