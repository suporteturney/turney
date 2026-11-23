import "server-only";
import { prisma } from "@/lib/prisma";
import { registrarAtividade } from "@/lib/atividade";
import { duracaoPadrao, reais } from "@/lib/comercial";
import { origemDoForm } from "@/lib/respondi";
import { whatsappComDDI } from "@/lib/whatsapp";
import { SEM_VENDEDORA, type VendaHubla } from "@/lib/hubla-vendas";
const DIA = 86_400_000;
const JANELA = 15 * DIA; // venda registrada à mão até 15 dias antes/depois é a mesma da Hubla
const SISTEMA = { id: null, nome: "Hubla" } as const;
export type ResultadoVendaHubla = "criada" | "ligada" | "repetida" | "cancelada" | "ignorada";

// Pagamento aprovado vira venda em Vendas e metas (e o cartão do funil vai para Fechado); reembolso cancela a venda.
// A passagem para o Pós Venda fica pendente: o cadastro da mentorada pode já ter sido criado por outra automação (Make).
export async function registrarVendaHubla(v: VendaHubla): Promise<ResultadoVendaHubla> {
  const whatsapp = whatsappComDDI(v.whatsapp);
  // As vendas guardam só o dia (meia-noite UTC do dia de Brasília), como as registradas à mão.
  const dia = new Date(`${new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(v.data)}T00:00:00Z`);
  const contato = [...(v.email ? [{ email: v.email }] : []), ...(whatsapp ? [{ whatsapp }] : [])];

  const r = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(7301123)`;
    const ja = await tx.venda.findUnique({ where: { hublaFatura: v.fatura } });

    if (v.tipo === "reembolsada") {
      if (!ja || ja.cancelada) return { r: "ignorada" as const };
      await tx.venda.update({ where: { id: ja.id }, data: { cancelada: true, motivoCancelamento: "Reembolsada na Hubla" } });
      if (ja.leadId) await tx.leadNota.create({ data: { leadId: ja.leadId, tipo: "venda", texto: `Venda reembolsada na Hubla (${reais(ja.valorCentavos)})`, autor: "Hubla" } });
      return { r: "cancelada" as const, cliente: ja.cliente, valor: ja.valorCentavos };
    }
    if (ja) return { r: "repetida" as const };

    // Já registrada à mão pela equipe? Liga em vez de duplicar.
    const manual = contato.length ? await tx.venda.findFirst({
      where: { hublaFatura: null, cancelada: false, OR: contato, data: { gte: new Date(dia.getTime() - JANELA), lte: new Date(dia.getTime() + JANELA) } },
      orderBy: { data: "desc" },
    }) : null;
    if (manual) {
      await tx.venda.update({
        where: { id: manual.id },
        data: { hublaFatura: v.fatura, hublaProduto: v.produto, email: manual.email ?? v.email, whatsapp: manual.whatsapp ?? whatsapp, pagamento: manual.pagamento ?? v.pagamento },
      });
      return { r: "ligada" as const, cliente: manual.cliente, valor: manual.valorCentavos };
    }

    // Cartão no funil: o mais recente da pessoa (aberto primeiro).
    const leads = contato.length ? await tx.lead.findMany({ where: { OR: contato }, include: { etapa: true }, orderBy: { updatedAt: "desc" } }) : [];
    const lead = leads.find(l => l.etapa.tipo === "aberta") ?? leads.find(l => l.etapa.tipo === "perdido") ?? leads[0] ?? null;
    const u = v.utm;
    const venda = await tx.venda.create({
      data: {
        leadId: lead?.id ?? null, cliente: lead?.nome ?? v.cliente, email: v.email, whatsapp, programa: v.programa, valorCentavos: v.valorCentavos,
        pagamento: v.pagamento, vendedora: lead?.responsavel ?? SEM_VENDEDORA, data: dia,
        origem: lead?.origem ?? (u?.source ? origemDoForm(u.source) : null), inicio: dia, duracao: duracaoPadrao(v.programa),
        passagem: "pendente", criadoPor: "Hubla", hublaFatura: v.fatura, hublaProduto: v.produto,
        combinados: u ? `Veio da Hubla${u.source ? ` · utm_source ${u.source}` : ""}${u.campaign ? ` · utm_campaign ${u.campaign}` : ""}` : null,
      },
    });
    if (lead && lead.etapa.tipo !== "ganho") {
      const ganho = await tx.funilEtapa.findFirst({ where: { tipo: "ganho" }, orderBy: { ordem: "asc" } });
      await tx.lead.update({
        where: { id: lead.id },
        data: { ...(ganho ? { etapaId: ganho.id, etapaEm: new Date() } : {}), programa: v.programa, valorCentavos: v.valorCentavos, motivoPerda: null, proximoPasso: null, proximoPassoEm: null },
      });
    }
    if (lead) await tx.leadNota.create({ data: { leadId: lead.id, tipo: "venda", texto: `Comprou na Hubla: ${v.produto}, ${reais(v.valorCentavos)}${v.pagamento ? ` (${v.pagamento})` : ""}`, autor: "Hubla" } });
    return { r: "criada" as const, cliente: venda.cliente, valor: venda.valorCentavos, comLead: !!lead };
  }, { timeout: 15_000, maxWait: 15_000 });

  if (r.r === "criada") await registrarAtividade(SISTEMA, { acao: "criou", entidade: "venda", resumo: `Venda na Hubla: ${r.cliente}, ${v.programa}, ${reais(r.valor)}${r.comLead ? " (cartão do funil foi para Fechado)" : ""}` });
  if (r.r === "ligada") await registrarAtividade(SISTEMA, { acao: "editou", entidade: "venda", resumo: `A Hubla confirmou o pagamento da venda de ${r.cliente} (${reais(r.valor)}), que já estava registrada` });
  if (r.r === "cancelada") await registrarAtividade(SISTEMA, { acao: "editou", entidade: "venda", resumo: `Venda de ${r.cliente} (${reais(r.valor)}) reembolsada na Hubla e cancelada` });
  return r.r;
}
