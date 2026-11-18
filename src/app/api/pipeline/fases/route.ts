import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { registrarAtividade } from "@/lib/atividade";
import { negar, podeEditarEtapas } from "@/lib/pipeline-servidor";

// Nova etapa no fim do Pipeline.
export async function POST(req: NextRequest) {
  const usuario = await exigirUsuario();
  const negado = negar(usuario, podeEditarEtapas(usuario), ["equipe"]);
  if (negado) return negado;
  const { nome } = await req.json();
  const n = typeof nome === "string" ? nome.trim() : "";
  if (!n) return NextResponse.json({ erro: "Dê um nome para a etapa." }, { status: 400 });
  const ultima = await prisma.pipelineFase.aggregate({ _max: { ordem: true } });
  const fase = await prisma.pipelineFase.create({ data: { nome: n, ordem: (ultima._max.ordem ?? 0) + 1 } });
  await registrarAtividade(usuario, { acao: "criou", entidade: "pipeline", resumo: `Criou a etapa "${n}" no Pipeline` });
  return NextResponse.json(fase);
}

// Nova ordem das etapas: { ordem: [id, id, ...] }.
export async function PUT(req: NextRequest) {
  const usuario = await exigirUsuario();
  const negado = negar(usuario, podeEditarEtapas(usuario), ["equipe"]);
  if (negado) return negado;
  const { ordem } = await req.json();
  if (!Array.isArray(ordem) || ordem.some(x => typeof x !== "string")) {
    return NextResponse.json({ erro: "Ordem inválida." }, { status: 400 });
  }
  await prisma.$transaction(ordem.map((id: string, i: number) => prisma.pipelineFase.update({ where: { id }, data: { ordem: i + 1 } })));
  await registrarAtividade(usuario, { acao: "editou", entidade: "pipeline", resumo: "Mudou a ordem das etapas do Pipeline" });
  return NextResponse.json({ ok: true });
}
