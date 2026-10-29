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
  const { id } = await params;
  const body = await req.json();
  const { item, marco, marcoTitulo } = body;
  if (!item) return NextResponse.json({ erro: "Item ausente" }, { status: 400 });

  // Edição do texto: só quem escreveu ou uma administradora
  if ("texto" in body) {
    const atual = await prisma.acompanhamento.findFirst({ where: { id: item, mentoradaId: id } });
    if (!atual) return NextResponse.json({ erro: "Registro não encontrado." }, { status: 404 });
    if (atual.varreduraId) return NextResponse.json({ erro: "Registros da varredura não podem ser editados aqui." }, { status: 400 });
    const negado = semAutoria(usuario, atual.autor);
    if (negado) return negado;
    const texto = typeof body.texto === "string" ? body.texto.trim() : "";
    if (!texto) return NextResponse.json({ erro: "O registro não pode ficar vazio." }, { status: 400 });
    const tipo = typeof body.tipo === "string" ? body.tipo.trim() || null : atual.tipo;
    const data = body.data ? new Date(body.data) : atual.data;
    if (Number.isNaN(data.getTime())) return NextResponse.json({ erro: "Data inválida." }, { status: 400 });
    await prisma.acompanhamento.update({ where: { id: item }, data: { texto, tipo, data } });
    await registrarAtividade(usuario, {
      acao: "editou", entidade: "acompanhamento", mentoradaId: id,
      resumo: `Editou um acompanhamento de ${await nomeDaMentorada(id)}${atual.autor && atual.autor !== usuario.nome ? ` (escrito por ${atual.autor})` : ""}`,
      detalhe: {
        antes: { texto: atual.texto.slice(0, 300), tipo: atual.tipo, data: atual.data },
        depois: { texto: texto.slice(0, 300), tipo, data },
      },
    });
    return NextResponse.json({ ok: true });
  }

  const negado = semPermissao(usuario, "acompanhamento");
  if (negado) return negado;
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
  const { id } = await params;
  const item = new URL(req.url).searchParams.get("item");
  if (!item) return NextResponse.json({ erro: "Item ausente" }, { status: 400 });
  const apagado = await prisma.acompanhamento.findFirst({ where: { id: item, mentoradaId: id }, select: { texto: true, data: true, autor: true } });
  if (!apagado) return NextResponse.json({ ok: true });
  const negado = semAutoria(usuario, apagado.autor);
  if (negado) return negado;
  await prisma.acompanhamento.deleteMany({ where: { id: item, mentoradaId: id } });
  await registrarAtividade(usuario, { acao: "excluiu", entidade: "acompanhamento", mentoradaId: id, resumo: `Excluiu um acompanhamento de ${await nomeDaMentorada(id)}${apagado.autor && apagado.autor !== usuario.nome ? ` (escrito por ${apagado.autor})` : ""}`, detalhe: { texto: apagado.texto.slice(0, 300), data: apagado.data, autor: apagado.autor } });
  return NextResponse.json({ ok: true });
}
