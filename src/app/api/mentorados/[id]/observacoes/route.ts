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
  const { texto } = await req.json();
  if (typeof texto !== "string" || !texto.trim()) {
    return NextResponse.json({ erro: "Digite uma observação antes de salvar" }, { status: 400 });
  }
  const o = await prisma.observacao.create({
    data: { mentoradaId: id, data: new Date(), texto: texto.trim(), autor: usuario.nome },
  });
  await registrarAtividade(usuario, { acao: "criou", entidade: "observacao", mentoradaId: id, resumo: `Escreveu uma observação sobre ${await nomeDaMentorada(id)}`, detalhe: { texto: o.texto.slice(0, 300) } });
  return NextResponse.json(o);
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const usuario = await exigirUsuario();
  const negado = semPermissao(usuario, "excluir");
  if (negado) return negado;
  const { id } = await params;
  const item = new URL(req.url).searchParams.get("item");
  if (!item) return NextResponse.json({ erro: "Item ausente" }, { status: 400 });
  const apagada = await prisma.observacao.findFirst({ where: { id: item, mentoradaId: id }, select: { texto: true } });
  await prisma.observacao.deleteMany({ where: { id: item, mentoradaId: id } });
  if (apagada) await registrarAtividade(usuario, { acao: "excluiu", entidade: "observacao", mentoradaId: id, resumo: `Excluiu uma observação de ${await nomeDaMentorada(id)}`, detalhe: { texto: apagada.texto.slice(0, 300) } });
  return NextResponse.json({ ok: true });
}
