import "server-only";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NOME_PERMISSAO, pode, type Permissao } from "@/lib/permissoes";
import type { UsuarioSessao } from "@/lib/auth";
import { hojeISO, somarDiasUteis } from "@/lib/dias-uteis";
import { registrarAtividade } from "@/lib/atividade";

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

// Mentoria Estratégica (etapa "sessao" — Mentoria Individual) marcada, seja à mão, pela agenda ou pelo Make:
// - quem está antes da etapa "Mentoria Estratégica" no Pipeline vai para ela (prazo do roadmap correndo)
//   ou direto para "Aplicações" (prazo já passou);
// - enquanto o prazo do roadmap ainda estiver correndo, cria (ou atualiza) a tarefa "Enviar o roadmap"
//   com prazo em dias úteis a partir da data da mentoria — mesmo se o card já estiver mais à frente.
// Devolve o nome da etapa do Pipeline em que a mentorada ficou (ou null se nada mudou).
export async function aoMarcarMentoriaEstrategica(
  m: { id: string; nome: string; status: string; pipelineFaseId: string | null },
  data: string,
  autor: { id: string | null; nome: string },
): Promise<string | null> {
  const fases = await prisma.pipelineFase.findMany({ orderBy: { ordem: "asc" } });
  const porNome = (n: string) => fases.find(f => f.nome.toLowerCase() === n.toLowerCase());
  const estrategica = fases.find(f => f.id === "fase_mentoria_estrategica") ?? porNome("Mentoria Estratégica");
  if (!estrategica) return null;
  const aplicacoes = fases.find(f => f.id === "fase_aplicacoes") ?? porNome("Aplicações");
  const atual = fases.find(f => f.id === m.pipelineFaseId);
  const ativa = ["Ativo", "Em Andamento", "Em Renovação", "Congelado"].includes(m.status);
  if (!ativa) return null;
  const dia = data.slice(0, 10);
  const prazoCorrendo = somarDiasUteis(dia, estrategica.tarefaDiasUteis ?? 5) >= hojeISO();
  const dataBR = dia.split("-").reverse().join("/");

  if (!atual || atual.ordem < estrategica.ordem) {
    const destino = prazoCorrendo || !aplicacoes ? estrategica : aplicacoes;
    await prisma.mentorada.update({ where: { id: m.id }, data: { pipelineFaseId: destino.id, pipelineFaseEm: new Date(dia) } });
    if (destino.id === estrategica.id) await criarTarefaDaEtapa(estrategica, m.id, dia, autor.nome);
    await registrarAtividade(autor, {
      acao: "editou", entidade: "pipeline", mentoradaId: m.id,
      resumo: `Moveu ${m.nome} para "${destino.nome}" no Pipeline (Mentoria Estratégica em ${dataBR})`,
    });
    return destino.nome;
  }
  // Já está na etapa ou depois dela: só garante a tarefa do roadmap enquanto o prazo corre.
  if (prazoCorrendo && estrategica.tarefaTexto) {
    const t = await criarTarefaDaEtapa(estrategica, m.id, dia, autor.nome);
    if (t) {
      await registrarAtividade(autor, {
        acao: "criou", entidade: "tarefa", mentoradaId: m.id,
        resumo: `Tarefa "${estrategica.tarefaTexto}" de ${m.nome} até ${t.prazo.toISOString().slice(0, 10).split("-").reverse().join("/")} (Mentoria Estratégica em ${dataBR})`,
      });
    }
    return atual.nome;
  }
  return null;
}
