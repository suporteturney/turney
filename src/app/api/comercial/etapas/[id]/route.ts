import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirPilarApi, semPermissao } from "@/lib/auth";
import { registrarAtividade } from "@/lib/atividade";
import { erro, texto } from "@/lib/comercial-servidor";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const usuario = await exigirPilarApi("comercial");
  const negado = semPermissao(usuario, "equipe");
  if (negado) return negado;
  const { id } = await params;
  const nome = texto((await req.json()).nome, 60);
  if (!nome) return erro("A etapa precisa de um nome.");
  const r = await prisma.funilEtapa.updateMany({ where: { id }, data: { nome } });
  return r.count ? NextResponse.json({ ok: true }) : erro("Etapa não encontrada.", 404);
}

// Excluir etapa aberta: os leads dela vão para a primeira etapa que sobrar.
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const usuario = await exigirPilarApi("comercial");
  const negado = semPermissao(usuario, "equipe");
  if (negado) return negado;
  const { id } = await params;
  const etapa = await prisma.funilEtapa.findUnique({ where: { id } });
  if (!etapa) return erro("Etapa não encontrada.", 404);
  if (etapa.tipo !== "aberta") return erro("As etapas de fechado e perdido não podem ser excluídas (dá para renomear).");
  const destino = await prisma.funilEtapa.findFirst({ where: { tipo: "aberta", id: { not: id } }, orderBy: { ordem: "asc" } });
  if (!destino) return erro("O funil precisa de pelo menos uma etapa aberta.");
  const [movidos] = await prisma.$transaction([
    prisma.lead.updateMany({ where: { etapaId: id }, data: { etapaId: destino.id, etapaEm: new Date() } }),
    prisma.funilEtapa.delete({ where: { id } }),
  ]);
  await registrarAtividade(usuario, { acao: "excluiu", entidade: "funil", resumo: `Excluiu a etapa “${etapa.nome}” do funil (${movidos.count} leads foram para “${destino.nome}”)` });
  return NextResponse.json({ ok: true, movidos: movidos.count, destino: destino.nome });
}
