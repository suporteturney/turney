import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirUsuario, semAutoria, semPermissao } from "@/lib/auth";
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

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const usuario = await exigirUsuario();
  const { id } = await params;
  const { item, texto } = await req.json();
  if (!item) return NextResponse.json({ erro: "Item ausente" }, { status: 400 });
  const atual = await prisma.observacao.findFirst({ where: { id: item, mentoradaId: id } });
  if (!atual) return NextResponse.json({ erro: "Observação não encontrada." }, { status: 404 });
  const negado = semAutoria(usuario, atual.autor);
  if (negado) return negado;
  const novo = typeof texto === "string" ? texto.trim() : "";
  if (!novo) return NextResponse.json({ erro: "A observação não pode ficar vazia." }, { status: 400 });
  await prisma.observacao.update({ where: { id: item }, data: { texto: novo } });
  await registrarAtividade(usuario, {
    acao: "editou", entidade: "observacao", mentoradaId: id,
    resumo: `Editou uma observação de ${await nomeDaMentorada(id)}${atual.autor && atual.autor !== usuario.nome ? ` (escrita por ${atual.autor})` : ""}`,
    detalhe: { antes: atual.texto.slice(0, 300), depois: novo.slice(0, 300) },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const usuario = await exigirUsuario();
  const { id } = await params;
  const item = new URL(req.url).searchParams.get("item");
  if (!item) return NextResponse.json({ erro: "Item ausente" }, { status: 400 });
  const apagada = await prisma.observacao.findFirst({ where: { id: item, mentoradaId: id }, select: { texto: true, autor: true } });
  if (!apagada) return NextResponse.json({ ok: true });
  const negado = semAutoria(usuario, apagada.autor);
  if (negado) return negado;
  await prisma.observacao.deleteMany({ where: { id: item, mentoradaId: id } });
  await registrarAtividade(usuario, { acao: "excluiu", entidade: "observacao", mentoradaId: id, resumo: `Excluiu uma observação de ${await nomeDaMentorada(id)}${apagada.autor && apagada.autor !== usuario.nome ? ` (escrita por ${apagada.autor})` : ""}`, detalhe: { texto: apagada.texto.slice(0, 300), autor: apagada.autor } });
  return NextResponse.json({ ok: true });
}
