import "server-only";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/lib/auth";
import { registrarAtividade } from "@/lib/atividade";
import { proximoCodigo } from "@/lib/codigo";
import { fimDoContrato, reais } from "@/lib/comercial";
import { hojeISO, somarDiasUteis } from "@/lib/dias-uteis";
import { nomeDaEquipe } from "@/lib/nomes-equipe";
import { recalcularSaude } from "@/lib/saude-servidor";
import { whatsappComDDI } from "@/lib/whatsapp";

const DATA = /^\d{4}-\d{2}-\d{2}$/;
export const texto = (v: unknown, max = 200) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
export const dataOuNula = (v: unknown) => (typeof v === "string" && DATA.test(v) && !Number.isNaN(Date.parse(v)) ? new Date(v) : null);
export const erro = (msg: string, status = 400) => NextResponse.json({ erro: msg }, { status });
export const semSenha = (u: UsuarioSessao) => (u.trocarSenha ? erro("Crie a sua senha antes de fazer alterações.", 403) : null);

// Nome curto vira o nome completo de quem tem acesso ("Andressa" → "Andressa Bordon").
export async function nomeCompleto(v: unknown) {
  const t = texto(v, 80);
  if (!t) return null;
  const equipe = [...new Set((await prisma.usuario.findMany({ where: { ativo: true }, select: { nome: true } })).map(u => u.nome))];
  return nomeDaEquipe(t, equipe);
}

// Quem atende no Comercial: acessos com o pilar (administradoras entram só se já atendem alguém) — para sugerir nos campos.
export async function equipeComercial() {
  const [usuarios, leads, vendas] = await Promise.all([
    prisma.usuario.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { nome: true, papel: true, pilares: true } }),
    prisma.lead.findMany({ where: { responsavel: { not: null } }, distinct: ["responsavel"], select: { responsavel: true } }),
    prisma.venda.findMany({ distinct: ["vendedora"], select: { vendedora: true } }),
  ]);
  return [...new Set([
    ...usuarios.filter(u => u.papel === "admin" || u.pilares.includes("comercial")).map(u => u.nome),
    ...leads.map(l => l.responsavel!), ...vendas.map(v => v.vendedora),
  ])].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

const ATIVOS = ["Ativo", "Em Andamento", "Em Renovação", "Congelado"];

export type Passagem =
  | { ok: true; mentoradaId: string; nome: string; criada: boolean }
  | { ok: false; status: number; erro: string; existente?: { id: string; nome: string; tipo: string; status: string } };

// Venda fechada → Pós Venda. Cria o cadastro da mentorada, que entra no Pipeline em "Sem etapa", e avisa a equipe com uma tarefa.
// Se já houver cadastro ativo da mesma pessoa, devolve 409 para quem vendeu decidir:
//   "ligar" = é ela (renovação, upgrade ou venda que o Make já cadastrou); "novo" = é outra pessoa, cria o cadastro.
export type ModoPassagem = "auto" | "ligar" | "novo";
const partesNome = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
export async function passarParaPosVenda(vendaId: string, usuario: UsuarioSessao, modo: ModoPassagem = "auto"): Promise<Passagem> {
  const v = await prisma.venda.findUnique({ where: { id: vendaId } });
  if (!v) return { ok: false, status: 404, erro: "Venda não encontrada." };
  if (v.cancelada) return { ok: false, status: 400, erro: "Esta venda foi cancelada." };
  if (v.passagem === "enviada") return { ok: false, status: 409, erro: "Esta venda já foi passada para o Pós Venda." };
  const whats = whatsappComDDI(v.whatsapp);
  const ativas = await prisma.mentorada.findMany({
    where: { status: { in: ATIVOS } },
    select: { id: true, nome: true, tipo: true, status: true, email: true, whatsapp: true },
  });
  // Mesmo e-mail, mesmo WhatsApp ou mesmo nome completo.
  const nome = partesNome(v.cliente);
  const existente = modo === "novo" ? undefined
    : ativas.find(m => (v.email && m.email?.trim().toLowerCase() === v.email.toLowerCase()) || (whats && whatsappComDDI(m.whatsapp) === whats))
      ?? (nome.includes(" ") ? ativas.find(m => partesNome(m.nome) === nome) : undefined);
  if (existente && modo !== "ligar") {
    return {
      ok: false, status: 409,
      erro: `${existente.nome} já tem cadastro ativo no ${existente.tipo}. Se for a mesma pessoa (renovação, upgrade ou cadastro feito pela automação), ligue a venda a esse cadastro.`,
      existente: { id: existente.id, nome: existente.nome, tipo: existente.tipo, status: existente.status },
    };
  }

  // Reserva a venda antes de criar (dois cliques ao mesmo tempo não geram dois cadastros).
  const reserva = await prisma.venda.updateMany({ where: { id: vendaId, passagem: "pendente" }, data: { passagem: "enviando" } });
  if (!reserva.count) return { ok: false, status: 409, erro: "Esta venda já está sendo passada. Atualize a página." };

  try {
    let m: { id: string; nome: string };
    const inicio = (v.inicio ?? v.data).toISOString().slice(0, 10);
    const resumoVenda = `Venda de ${v.data.toISOString().slice(0, 10).split("-").reverse().join("/")} por ${v.vendedora}: ${v.programa}${v.pagamento ? `, ${v.pagamento}` : ""}.`;
    if (existente) {
      m = existente;
    } else {
      m = await prisma.mentorada.create({
        data: {
          codigo: await proximoCodigo(v.programa),
          nome: v.cliente, tipo: v.programa, status: "Ativo", saude: "Saudável",
          email: v.email, whatsapp: whats ?? v.whatsapp,
          inicio: new Date(inicio),
          prazo: v.duracao ? fimDoContrato(inicio, v.duracao) : null,
          duracao: v.duracao, origem: v.origem,
          resp: await responsavelPadrao(),
          obs: [resumoVenda, v.combinados].filter(Boolean).join("\n\n"),
        },
        select: { id: true, nome: true },
      });
      await prisma.saudeRegistro.create({ data: { mentoradaId: m.id, saude: "Saudável", origem: "cadastro" } });
    }
    if (existente && v.combinados) {
      await prisma.observacao.create({ data: { mentoradaId: m.id, data: new Date(hojeISO()), texto: `${resumoVenda}\n\n${v.combinados}`, autor: v.vendedora } });
    }
    await prisma.tarefa.create({
      data: {
        titulo: existente
          ? `Registrar a venda nova no cadastro (${v.programa}): renovação ou upgrade`
          : `Dar as boas-vindas e agendar o onboarding${!v.email && !v.whatsapp ? " (falta e-mail e WhatsApp: pedir ao Comercial)" : ""}`,
        prazo: new Date(somarDiasUteis(hojeISO(), 2)), mentoradaId: m.id, automatica: true, criadaPor: `Comercial (${usuario.nome})`,
      },
    });
    await prisma.venda.update({ where: { id: v.id }, data: { passagem: "enviada", passagemEm: new Date(), passagemPor: usuario.nome, mentoradaId: m.id } });
    if (v.leadId) {
      await prisma.leadNota.create({ data: { leadId: v.leadId, tipo: "venda", texto: existente ? `Venda ligada ao cadastro de ${m.nome} no Pós Venda` : "Entrou no Pipeline do Pós Venda, em “Sem etapa”", autor: usuario.nome } });
    }
    await registrarAtividade(usuario, {
      acao: existente ? "editou" : "criou", entidade: "mentorada", mentoradaId: m.id,
      resumo: existente
        ? `Ligou a venda de ${v.programa} (${reais(v.valorCentavos)}) ao cadastro de ${m.nome}`
        : `Passou ${m.nome} (${v.programa}) do Comercial para o Pós Venda`,
    });
    await recalcularSaude([m.id]);
    return { ok: true, mentoradaId: m.id, nome: m.nome, criada: !existente };
  } catch (e) {
    await prisma.venda.updateMany({ where: { id: vendaId, passagem: "enviando" }, data: { passagem: "pendente" } });
    throw e;
  }
}

// Quem mais aparece como responsável nas mentoradas ativas (hoje, a gestora do Pós Venda).
async function responsavelPadrao() {
  const g = await prisma.mentorada.groupBy({
    by: ["resp"], where: { status: { in: ATIVOS }, resp: { not: null } }, _count: { _all: true }, orderBy: { _count: { resp: "desc" } }, take: 1,
  });
  return g[0]?.resp ?? null;
}
