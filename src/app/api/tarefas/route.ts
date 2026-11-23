import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { registrarAtividade } from "@/lib/atividade";
import { negar, podeOperar } from "@/lib/pipeline-servidor";
import { temPilar } from "@/lib/permissoes";
import { nomeDaEquipe } from "@/lib/nomes-equipe";

const equipeAtiva = async () => (await prisma.usuario.findMany({ where: { ativo: true }, select: { nome: true } })).map(u => u.nome);

const DATA = /^\d{4}-\d{2}-\d{2}$/;

// Tarefa criada à mão (com ou sem mentorada).
export async function POST(req: NextRequest) {
  const usuario = await exigirUsuario();
  const { titulo, prazo, mentoradaId, responsavel } = await req.json();
  // Tarefa de mentorada é do Pós Venda; tarefa geral qualquer pessoa do Comercial ou do Marketing também cria.
  const operaPosVenda = temPilar(usuario, "posvenda") && podeOperar(usuario);
  const tarefaGeral = !mentoradaId && (temPilar(usuario, "comercial") || temPilar(usuario, "marketing"));
  const negado = negar(usuario, operaPosVenda || tarefaGeral, ["jornada", "acompanhamento"]);
  if (negado) return negado;
  const resp = typeof responsavel === "string" && responsavel.trim() ? nomeDaEquipe(responsavel.slice(0, 80), await equipeAtiva()) : null;
  const t = typeof titulo === "string" ? titulo.trim() : "";
  if (!t) return NextResponse.json({ erro: "Escreva o que precisa ser feito." }, { status: 400 });
  if (typeof prazo !== "string" || !DATA.test(prazo)) return NextResponse.json({ erro: "Escolha o prazo." }, { status: 400 });
  const m = mentoradaId ? await prisma.mentorada.findUnique({ where: { id: mentoradaId }, select: { id: true, nome: true } }) : null;
  const tarefa = await prisma.tarefa.create({
    data: { titulo: t, prazo: new Date(prazo), mentoradaId: m?.id ?? null, responsavel: resp, criadaPor: usuario.nome },
  });
  await registrarAtividade(usuario, {
    acao: "criou", entidade: "tarefa", mentoradaId: m?.id ?? null,
    resumo: `Criou a tarefa "${t}"${m ? ` de ${m.nome}` : ""}${resp ? ` para ${resp}` : ""}`,
  });
  return NextResponse.json({ ...tarefa, prazo: prazo });
}
