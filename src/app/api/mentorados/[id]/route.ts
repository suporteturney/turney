import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirPilarApi, semPermissao } from "@/lib/auth";
import { diferencas, registrarAtividade } from "@/lib/atividade";
import { CAMPOS_COMERCIAIS } from "@/lib/permissoes";
import { recalcularSaude } from "@/lib/saude-servidor";
import { atualizarStatusAutomatico } from "@/lib/status-automatico";
import { prazoComCongelamento } from "@/lib/congelamento";

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await exigirPilarApi("posvenda");
  const { id } = await params;

  const mentorado = await prisma.mentorada.findUnique({
    where: { id },
    include: {
      etapas: { orderBy: { createdAt: "asc" } },
      presencas: { orderBy: { encontro: "asc" } },
      acompanhamentos: { orderBy: { data: "desc" } },
      observacoes: { orderBy: { data: "desc" } },
      renovacoes: { orderBy: { data: "desc" } },
      eventosHubla: { orderBy: { data: "desc" }, select: { id: true, tipo: true, produto: true, modulo: true, data: true } },
      consumoHubla: {
        orderBy: [{ modulo: "asc" }, { ultimo: "desc" }],
        select: { id: true, modulo: true, conteudo: true, tipo: true, visualizacoes: true, conclusao: true, primeiro: true, ultimo: true },
      },
    },
  });

  if (!mentorado) return NextResponse.json({ erro: "Não encontrado" }, { status: 404 });
  // Avisos da Hubla chegam com hora exata (UTC): mostra no dia de Brasília, como as outras datas da jornada.
  const diaBR = (d: Date) => `${new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d)}T12:00:00.000Z`;
  // Quantas aulas diferentes cada módulo tem (pelo que todas as alunas já abriram) — base do progresso por módulo.
  const modulos = [...new Set(mentorado.consumoHubla.map(c => c.modulo))];
  const catalogo = modulos.length
    ? await prisma.consumoHubla.groupBy({ by: ["modulo", "conteudo"], where: { modulo: { in: modulos } } })
    : [];
  const aulasPorModulo: Record<string, number> = {};
  for (const c of catalogo) aulasPorModulo[c.modulo] = (aulasPorModulo[c.modulo] ?? 0) + 1;
  const importacao = await prisma.configuracao.findUnique({ where: { chave: "hubla_consumo_importacao" }, select: { valor: true } });
  return NextResponse.json({
    ...mentorado,
    eventosHubla: mentorado.eventosHubla.map(h => ({ ...h, data: diaBR(h.data) })),
    aulasPorModulo,
    consumoImportadoEm: importacao ? diaBR(new Date(JSON.parse(importacao.valor).em as string)) : null,
  });
}

const CAMPOS_TEXTO = [
  "nome", "email", "whatsapp", "status", "saude", "area",
  "localizacao", "turma", "produtoAnterior", "origem", "origemDetalhe", "resp", "tutora", "obs",
  "tipo", "linkedin", "drive", "asana", "disc", "vagaCargo", "vagaEmpresa",
  "negociacao", "saudeMotivo", "renovacaoStatus", "congelamentoMotivo",
];
const CAMPOS_INT = ["duracao", "mesesAntes"];
const CAMPOS_DATA = ["inicio", "prazo", "cancelamento", "congelamentoPedido", "congelamentoAte", "vagaData"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const usuario = await exigirPilarApi("posvenda");
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

  // O tempo congelado vira tempo a mais de mentoria; mudar ou apagar as datas ajusta só a diferença.
  const pedido = ("congelamentoPedido" in updates ? updates.congelamentoPedido : atual.congelamentoPedido) as Date | null;
  const ate = ("congelamentoAte" in updates ? updates.congelamentoAte : atual.congelamentoAte) as Date | null;
  const motivo = "congelamentoMotivo" in updates ? updates.congelamentoMotivo : atual.congelamentoMotivo;
  if (updates.status === "Congelado" && atual.status !== "Congelado" && (!pedido || !ate || !motivo)) {
    return NextResponse.json({ erro: "Para congelar, preencha o motivo, a data de início e a data de término do congelamento." }, { status: 400 });
  }
  const base = ("prazo" in updates ? updates.prazo : atual.prazo) as Date | null;
  if (base && ("congelamentoPedido" in updates || "congelamentoAte" in updates)) {
    const novoPrazo = prazoComCongelamento(
      iso(base)!,
      { de: iso(atual.congelamentoPedido), ate: iso(atual.congelamentoAte) },
      { de: iso(pedido), ate: iso(ate) },
    );
    if (novoPrazo !== iso(base)) updates.prazo = new Date(novoPrazo);
  }

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
  await atualizarStatusAutomatico([id]);
  await recalcularSaude([id]);
  const mentorado = await prisma.mentorada.findUnique({ where: { id } });
  return NextResponse.json(mentorado);
}
