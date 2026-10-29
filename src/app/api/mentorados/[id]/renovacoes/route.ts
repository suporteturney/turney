import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirUsuario, semPermissao } from "@/lib/auth";
import { nomeDaMentorada, registrarAtividade } from "@/lib/atividade";
import { recalcularSaude } from "@/lib/saude-servidor";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const usuario = await exigirUsuario();
  const negado = semPermissao(usuario, "comercial");
  if (negado) return negado;
  const { id } = await params;
  const { acao, destino, data, novoPrazo, obs, duracao, atualizarCadastro } = await req.json();
  if (!acao || !destino || !data) {
    return NextResponse.json({ erro: "Informe ação, programa e data da renovação" }, { status: 400 });
  }
  if (atualizarCadastro && !novoPrazo) {
    return NextResponse.json({ erro: "Informe a nova data de encerramento do acesso." }, { status: 400 });
  }

  const atual = await prisma.mentorada.findUnique({ where: { id }, select: { tipo: true } });
  if (!atual) return NextResponse.json({ erro: "Mentorada não encontrada" }, { status: 404 });
  const programaAnterior = atual.tipo && atual.tipo !== destino ? atual.tipo : null;

  const updates: Record<string, unknown> = {};
  if (acao === "RENOVAÇÃO") updates.status = "Ativo";
  if (novoPrazo) updates.prazo = new Date(novoPrazo);
  if (atualizarCadastro) {
    const meses = parseInt(duracao, 10);
    updates.status = "Ativo";
    updates.tipo = destino;
    updates.renovacaoStatus = "Renovou";
    updates.cancelamento = null;
    if (Number.isFinite(meses) && meses > 0) updates.duracao = meses;
  }

  const [r, mentorada] = await prisma.$transaction([
    prisma.renovacao.create({
      data: {
        mentoradaId: id,
        acao,
        destino,
        data: new Date(data),
        novoPrazo: novoPrazo ? new Date(novoPrazo) : null,
        programaAnterior,
        obs: (obs || "").trim() || null,
      },
    }),
    prisma.mentorada.update({
      where: { id },
      data: updates,
      select: { status: true, tipo: true, prazo: true, duracao: true, renovacaoStatus: true },
    }),
  ]);
  await registrarAtividade(usuario, {
    acao: "criou", entidade: "renovacao", mentoradaId: id,
    resumo: `Registrou ${acao} para ${destino} de ${await nomeDaMentorada(id)}`,
    detalhe: { acao, destino, data, novoPrazo, atualizarCadastro: Boolean(atualizarCadastro) },
  });
  await recalcularSaude([id]);
  return NextResponse.json({ ...r, mentorada });
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const usuario = await exigirUsuario();
  const negado = semPermissao(usuario, "comercial", "excluir");
  if (negado) return negado;
  const { id } = await params;
  const item = new URL(req.url).searchParams.get("item");
  if (!item) return NextResponse.json({ erro: "Item ausente" }, { status: 400 });
  const apagada = await prisma.renovacao.findFirst({ where: { id: item, mentoradaId: id }, select: { acao: true, destino: true, data: true } });
  await prisma.renovacao.deleteMany({ where: { id: item, mentoradaId: id } });
  if (apagada) await registrarAtividade(usuario, { acao: "excluiu", entidade: "renovacao", mentoradaId: id, resumo: `Excluiu a ${apagada.acao} para ${apagada.destino} de ${await nomeDaMentorada(id)}`, detalhe: apagada });
  await recalcularSaude([id]);
  return NextResponse.json({ ok: true });
}
