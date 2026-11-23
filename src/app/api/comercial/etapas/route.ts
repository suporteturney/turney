import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirPilarApi, semPermissao } from "@/lib/auth";
import { registrarAtividade } from "@/lib/atividade";
import { erro, texto } from "@/lib/comercial-servidor";

// Criar etapa do funil (entra antes de Fechado e Perdido).
export async function POST(req: NextRequest) {
  const usuario = await exigirPilarApi("comercial");
  const negado = semPermissao(usuario, "equipe");
  if (negado) return negado;
  const nome = texto((await req.json()).nome, 60);
  if (!nome) return erro("Escreva o nome da etapa.");
  const ultima = await prisma.funilEtapa.findFirst({ where: { tipo: "aberta" }, orderBy: { ordem: "desc" } });
  const ordem = (ultima?.ordem ?? 0) + 1;
  await prisma.$transaction([
    prisma.funilEtapa.updateMany({ where: { ordem: { gte: ordem } }, data: { ordem: { increment: 1 } } }),
    prisma.funilEtapa.create({ data: { nome, ordem } }),
  ]);
  await registrarAtividade(usuario, { acao: "criou", entidade: "funil", resumo: `Criou a etapa “${nome}” no funil de vendas` });
  return NextResponse.json({ ok: true }, { status: 201 });
}

// Reordenar as etapas abertas: { ordem: [ids] }. Fechado e Perdido ficam sempre no fim.
export async function PUT(req: NextRequest) {
  const usuario = await exigirPilarApi("comercial");
  const negado = semPermissao(usuario, "equipe");
  if (negado) return negado;
  const { ordem } = await req.json();
  const etapas = await prisma.funilEtapa.findMany({ orderBy: { ordem: "asc" } });
  const abertas = etapas.filter(e => e.tipo === "aberta");
  if (!Array.isArray(ordem) || ordem.length !== abertas.length || !abertas.every(e => ordem.includes(e.id))) return erro("Ordem inválida. Atualize a página.");
  const final = [...ordem, ...etapas.filter(e => e.tipo !== "aberta").map(e => e.id)];
  await prisma.$transaction(final.map((id, i) => prisma.funilEtapa.update({ where: { id }, data: { ordem: i + 1 } })));
  return NextResponse.json({ ok: true });
}
