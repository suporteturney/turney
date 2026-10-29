import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirUsuario, semPermissao } from "@/lib/auth";
import { diferencas, registrarAtividade } from "@/lib/atividade";
import { CAMPOS_COMERCIAIS } from "@/lib/permissoes";
import { recalcularSaude } from "@/lib/saude-servidor";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await exigirUsuario();
  const { id } = await params;

  const mentorado = await prisma.mentorada.findUnique({
    where: { id },
    include: {
      etapas: { orderBy: { createdAt: "asc" } },
      presencas: { orderBy: { encontro: "asc" } },
      acompanhamentos: { orderBy: { data: "desc" } },
      observacoes: { orderBy: { data: "desc" } },
      renovacoes: { orderBy: { data: "desc" } },
    },
  });

  if (!mentorado) return NextResponse.json({ erro: "Não encontrado" }, { status: 404 });
  return NextResponse.json(mentorado);
}

const CAMPOS_TEXTO = [
  "nome", "email", "whatsapp", "status", "saude", "area",
  "localizacao", "turma", "produtoAnterior", "origem", "origemDetalhe", "resp", "obs",
  "tipo", "linkedin", "drive", "asana", "disc", "vagaCargo", "vagaEmpresa",
  "negociacao", "saudeMotivo", "renovacaoStatus",
];
const CAMPOS_INT = ["duracao", "mesesAntes"];
const CAMPOS_DATA = ["inicio", "prazo", "cancelamento", "vagaData"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const usuario = await exigirUsuario();
  const { id } = await params;
  const data = await req.json();

  const updates: Record<string, unknown> = {};
  for (const campo of CAMPOS_TEXTO) {
    if (campo in data) {
      const v = typeof data[campo] === "string" ? data[campo].trim() : data[campo];
      updates[campo] = v === "" ? null : v;
    }
  }
  if (typeof updates.nome !== "string" || !updates.nome) delete updates.nome;
  if (!updates.tipo) delete updates.tipo;
  if (!updates.status) delete updates.status;

  for (const campo of CAMPOS_INT) {
    if (campo in data) {
      const n = parseInt(data[campo], 10);
      updates[campo] = Number.isFinite(n) ? n : null;
    }
  }
  for (const campo of CAMPOS_DATA) {
    if (campo in data) updates[campo] = data[campo] ? new Date(data[campo]) : null;
  }
  if (updates.cancelamento) updates.status = "Churn";
  const atual = await prisma.mentorada.findUnique({ where: { id } });
  if (!atual) return NextResponse.json({ erro: "Não encontrado" }, { status: 404 });

  // Só conta o que de fato mudou: campos comerciais pedem "comercial", o resto "cadastro".
  const mudancas = diferencas(atual as Record<string, unknown>, updates);
  if (!Object.keys(mudancas).length) return NextResponse.json(atual);
  const negado = semPermissao(
    usuario,
    ...(Object.keys(mudancas).some(c => CAMPOS_COMERCIAIS.has(c)) ? (["comercial"] as const) : []),
    ...(Object.keys(mudancas).some(c => !CAMPOS_COMERCIAIS.has(c)) ? (["cadastro"] as const) : []),
  );
  if (negado) return negado;
  if ("negociacao" in updates && updates.negociacao !== atual.negociacao)
    updates.negociacaoEm = updates.negociacao ? new Date() : null;
  if ("saudeMotivo" in updates && updates.saudeMotivo !== atual.saudeMotivo)
    updates.saudeMotivoEm = updates.saudeMotivo ? new Date() : null;

  const novaSaude = "saude" in updates ? (updates.saude as string | null) : undefined;
  const mudouSaude = novaSaude !== undefined && novaSaude !== atual.saude && ["Saudável", "Atenção", "Risco"].includes(novaSaude ?? "");
  // Escolher à mão uma saúde diferente da calculada vira ajuste manual (vale até a próxima varredura);
  // voltar para a calculada desfaz o ajuste.
  if (mudouSaude) updates.saudeAjusteEm = novaSaude === atual.saudeCalculada ? null : new Date();

  await prisma.mentorada.update({ where: { id }, data: updates });
  if (mudouSaude) {
    await prisma.saudeRegistro.create({
      data: {
        mentoradaId: id,
        saude: novaSaude!,
        motivo: (updates.saudeMotivo as string | null | undefined) ?? atual.saudeMotivo,
        origem: "cadastro",
      },
    });
  }
  await registrarAtividade(usuario, {
    acao: "editou",
    entidade: "mentorada",
    mentoradaId: id,
    resumo: `Editou ${Object.keys(mudancas).join(", ")} de ${atual.nome}`,
    detalhe: mudancas,
  });
  await recalcularSaude([id]);
  const mentorado = await prisma.mentorada.findUnique({ where: { id } });
  return NextResponse.json(mentorado);
}
