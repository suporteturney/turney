import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { registrarAtividade } from "@/lib/atividade";
import { negar, podeOperar } from "@/lib/pipeline-servidor";
import { casaNome, nomeDaEquipe } from "@/lib/nomes-equipe";
import { temPilar } from "@/lib/permissoes";
import type { UsuarioSessao } from "@/lib/auth";

const equipeAtiva = async () => (await prisma.usuario.findMany({ where: { ativo: true }, select: { nome: true } })).map(u => u.nome);

// Pós Venda cuida de todas; os outros pilares, só das tarefas gerais que são deles (responsável ou quem criou).
const podeMexer = (u: UsuarioSessao, t: { mentoradaId: string | null; responsavel: string | null; criadaPor: string | null }) =>
  (temPilar(u, "posvenda") && podeOperar(u)) ||
  (!t.mentoradaId && (casaNome(u.nome, t.responsavel) || t.criadaPor === u.nome));

const DATA = /^\d{4}-\d{2}-\d{2}$/;

// Concluir / reabrir, mudar o texto ou o prazo.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirUsuario();
  const { id } = await params;
  const body = await req.json();
  const atual = await prisma.tarefa.findUnique({ where: { id }, include: { mentorada: { select: { nome: true } } } });
  if (!atual) return NextResponse.json({ erro: "Tarefa não encontrada." }, { status: 404 });
  const negado = negar(usuario, podeMexer(usuario, atual), ["jornada", "acompanhamento"]);
  if (negado) return negado;

  const data: { titulo?: string; prazo?: Date; responsavel?: string | null; concluidaEm?: Date | null; concluidaPor?: string | null } = {};
  if ("responsavel" in body) {
    data.responsavel = typeof body.responsavel === "string" && body.responsavel.trim() ? nomeDaEquipe(body.responsavel.slice(0, 80), await equipeAtiva()) : null;
  }
  if ("titulo" in body) {
    const t = typeof body.titulo === "string" ? body.titulo.trim() : "";
    if (!t) return NextResponse.json({ erro: "A tarefa precisa de um texto." }, { status: 400 });
    data.titulo = t;
  }
  if ("prazo" in body) {
    if (typeof body.prazo !== "string" || !DATA.test(body.prazo)) return NextResponse.json({ erro: "Prazo inválido." }, { status: 400 });
    data.prazo = new Date(body.prazo);
  }
  if ("concluida" in body) {
    data.concluidaEm = body.concluida ? new Date() : null;
    data.concluidaPor = body.concluida ? usuario.nome : null;
  }
  const t = await prisma.tarefa.update({ where: { id }, data });
  const de = atual.mentorada ? ` de ${atual.mentorada.nome}` : "";
  await registrarAtividade(usuario, {
    acao: "editou", entidade: "tarefa", mentoradaId: atual.mentoradaId,
    resumo: "concluida" in body
      ? `${body.concluida ? "Concluiu" : "Reabriu"} a tarefa "${t.titulo}"${de}`
      : "responsavel" in body && Object.keys(body).length === 1
        ? `Passou a tarefa "${t.titulo}"${de} para ${t.responsavel ?? "sem responsável"}`
        : `Editou a tarefa "${t.titulo}"${de}`,
  });
  return NextResponse.json({ ...t, prazo: t.prazo.toISOString().slice(0, 10), concluidaEm: t.concluidaEm?.toISOString() ?? null });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirUsuario();
  const { id } = await params;
  const atual = await prisma.tarefa.findUnique({ where: { id }, include: { mentorada: { select: { nome: true } } } });
  if (!atual) return NextResponse.json({ erro: "Tarefa não encontrada." }, { status: 404 });
  const negado = negar(usuario, podeMexer(usuario, atual), ["jornada", "acompanhamento"]);
  if (negado) return negado;
  await prisma.tarefa.delete({ where: { id } });
  await registrarAtividade(usuario, {
    acao: "excluiu", entidade: "tarefa", mentoradaId: atual.mentoradaId,
    resumo: `Excluiu a tarefa "${atual.titulo}"${atual.mentorada ? ` de ${atual.mentorada.nome}` : ""}`,
  });
  return NextResponse.json({ ok: true });
}
