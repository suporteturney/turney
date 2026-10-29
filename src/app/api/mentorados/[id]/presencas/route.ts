import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirUsuario, semPermissao } from "@/lib/auth";
import { nomeDaMentorada, registrarAtividade } from "@/lib/atividade";
import { recalcularSaude } from "@/lib/saude-servidor";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const usuario = await exigirUsuario();
  const negado = semPermissao(usuario, "presencas");
  if (negado) return negado;
  const { id } = await params;
  const { encontro, presente } = await req.json();
  if (typeof encontro !== "string" || !encontro) {
    return NextResponse.json({ erro: "Encontro inválido" }, { status: 400 });
  }

  if (presente === null || presente === undefined) {
    await prisma.presenca.deleteMany({ where: { mentoradaId: id, encontro } });
    await registrarAtividade(usuario, { acao: "editou", entidade: "presenca", mentoradaId: id, resumo: `Removeu o registro de ${encontro} de ${await nomeDaMentorada(id)}` });
    await recalcularSaude([id]);
    return NextResponse.json({ ok: true });
  }

  const p = await prisma.presenca.upsert({
    where: { mentoradaId_encontro: { mentoradaId: id, encontro } },
    update: { presente: Boolean(presente) },
    create: { mentoradaId: id, encontro, presente: Boolean(presente) },
  });
  await registrarAtividade(usuario, { acao: "editou", entidade: "presenca", mentoradaId: id, resumo: `Marcou ${presente ? "presença" : "falta"} em ${encontro} para ${await nomeDaMentorada(id)}` });
  await recalcularSaude([id]);
  return NextResponse.json(p);
}
