import "server-only";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NOME_PERMISSAO, pode, type Permissao } from "@/lib/permissoes";
import type { UsuarioSessao } from "@/lib/auth";
import { somarDiasUteis } from "@/lib/dias-uteis";

// Pipeline e tarefas: mover cards e cuidar das tarefas pede Jornada ou Acompanhamento;
// criar, renomear e excluir etapas pede Equipe (administradoras).
export const podeOperar = (u: UsuarioSessao) => pode(u, "jornada") || pode(u, "acompanhamento");
export const podeEditarEtapas = (u: UsuarioSessao) => pode(u, "equipe");

export function negar(usuario: UsuarioSessao, ok: boolean, precisa: Permissao[]) {
  if (usuario.trocarSenha) return NextResponse.json({ erro: "Crie a sua senha antes de fazer alterações." }, { status: 403 });
  if (ok) return null;
  return NextResponse.json(
    { erro: `Seu acesso não permite esta ação (${precisa.map(p => NOME_PERMISSAO[p]).join(" ou ")}). Fale com a administradora.` },
    { status: 403 },
  );
}

// Tarefa automática da etapa: uma por mentorada e etapa enquanto estiver aberta (entrar de novo só atualiza o prazo).
export async function criarTarefaDaEtapa(
  fase: { id: string; nome: string; tarefaTexto: string | null; tarefaDiasUteis: number | null },
  mentoradaId: string,
  dataEntrada: string,
  criadaPor: string,
) {
  if (!fase.tarefaTexto || fase.tarefaDiasUteis == null) return null;
  const prazo = new Date(somarDiasUteis(dataEntrada, fase.tarefaDiasUteis));
  const aberta = await prisma.tarefa.findFirst({ where: { mentoradaId, faseId: fase.id, concluidaEm: null } });
  if (aberta) return prisma.tarefa.update({ where: { id: aberta.id }, data: { prazo, titulo: fase.tarefaTexto } });
  return prisma.tarefa.create({
    data: { titulo: fase.tarefaTexto, prazo, mentoradaId, faseId: fase.id, automatica: true, criadaPor },
  });
}
