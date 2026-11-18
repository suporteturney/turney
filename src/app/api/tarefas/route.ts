import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { registrarAtividade } from "@/lib/atividade";
import { negar, podeOperar } from "@/lib/pipeline-servidor";

const DATA = /^\d{4}-\d{2}-\d{2}$/;

// Tarefa criada à mão (com ou sem mentorada).
export async function POST(req: NextRequest) {
  const usuario = await exigirUsuario();
  const negado = negar(usuario, podeOperar(usuario), ["jornada", "acompanhamento"]);
  if (negado) return negado;
  const { titulo, prazo, mentoradaId } = await req.json();
  const t = typeof titulo === "string" ? titulo.trim() : "";
  if (!t) return NextResponse.json({ erro: "Escreva o que precisa ser feito." }, { status: 400 });
  if (typeof prazo !== "string" || !DATA.test(prazo)) return NextResponse.json({ erro: "Escolha o prazo." }, { status: 400 });
  const m = mentoradaId ? await prisma.mentorada.findUnique({ where: { id: mentoradaId }, select: { id: true, nome: true } }) : null;
  const tarefa = await prisma.tarefa.create({
    data: { titulo: t, prazo: new Date(prazo), mentoradaId: m?.id ?? null, criadaPor: usuario.nome },
  });
  await registrarAtividade(usuario, {
    acao: "criou", entidade: "tarefa", mentoradaId: m?.id ?? null,
    resumo: `Criou a tarefa "${t}"${m ? ` de ${m.nome}` : ""}`,
  });
  return NextResponse.json({ ...tarefa, prazo: prazo });
}
