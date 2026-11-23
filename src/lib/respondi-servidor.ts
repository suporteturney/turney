import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { classificar, type Preenchimento } from "@/lib/respondi";

export const CHAVE_TOKEN = "respondi_token";
export const CHAVE_ULTIMO = "respondi_ultimo_aviso";
export const CHAVE_IMPORTACAO = "respondi_importacao";

export const novoToken = () => randomBytes(24).toString("base64url");
export async function tokenCerto(recebido: string) {
  const conf = await prisma.configuracao.findUnique({ where: { chave: CHAVE_TOKEN } });
  if (!conf) return null;
  const a = Buffer.from(recebido), b = Buffer.from(conf.valor);
  return a.length === b.length && timingSafeEqual(a, b);
}

const DIA = 86_400_000;
const br = (d: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
export type ResultadoLead = "novo" | "atualizado" | "repetido";

// Um preenchimento vira cartão no funil (primeira etapa). Se a pessoa já tem cartão em aberto, o cartão é atualizado.
export async function receberPreenchimento(f: Preenchimento, autor: string): Promise<ResultadoLead> {
  const { temperatura, pontuacao } = classificar(f.respostas);
  const dados = { formulario: f.formulario, completa: f.completa, pontuacao, temperatura, respostas: f.respostas, utms: f.utms ?? undefined };
  const contato = [...(f.email ? [{ email: f.email }] : []), ...(f.whatsapp ? [{ whatsapp: f.whatsapp }] : [])];

  return prisma.$transaction(async tx => {
    // Um preenchimento por vez: a mesma pessoa mandando duas respostas juntas não vira dois cartões.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(7301122)`;

    // Mesma resposta chegando de novo (reenvio, planilha importada duas vezes ou parcial que foi concluída).
    const igual = await tx.respostaFormulario.findUnique({ where: { id: f.id }, include: { lead: true } });
    if (igual) {
      const melhorou = f.respostas.length > (igual.respostas as unknown[]).length || (f.completa && !igual.completa);
      if (!melhorou) return "repetido";
      await tx.respostaFormulario.update({ where: { id: f.id }, data: dados });
      if (f.completa && !igual.completa) await tx.leadNota.create({ data: { leadId: igual.leadId, tipo: "form", texto: `Terminou o forms ${f.formulario}`, autor } });
      const maisNova = await tx.respostaFormulario.findFirst({ where: { leadId: igual.leadId, completa: true }, orderBy: { preenchidoEm: "desc" } });
      if (!maisNova || maisNova.id === f.id) {
        await tx.lead.update({ where: { id: igual.leadId }, data: atualizacao(igual.lead) });
      }
      return "atualizado";
    }

    const abertos = await tx.lead.findMany({ where: { OR: contato, etapa: { tipo: "aberta" } }, orderBy: { updatedAt: "desc" }, take: 1 });
    let lead: (typeof abertos)[number] | null = abertos[0] ?? null;
    // Resposta parcial de quem preencheu há pouco (o Respondi manda a parcial 1 h depois): não abre outro cartão.
    if (!lead && !f.completa) {
      lead = await tx.lead.findFirst({
        where: { OR: contato, preenchidoEm: { gte: new Date(f.preenchidoEm.getTime() - 2 * DIA), lte: new Date(f.preenchidoEm.getTime() + 2 * DIA) } },
        orderBy: { preenchidoEm: "desc" },
      });
    }
    if (lead) {
      const anteriores = await tx.respostaFormulario.findMany({ where: { leadId: lead.id }, select: { completa: true, preenchidoEm: true } });
      await tx.respostaFormulario.create({ data: { id: f.id, leadId: lead.id, preenchidoEm: f.preenchidoEm, ...dados } });
      // A resposta completa e mais recente é a que classifica o lead.
      const manda = !anteriores.some(a => (a.completa && !f.completa) || (a.completa === f.completa && a.preenchidoEm > f.preenchidoEm));
      const mudou = manda && !lead.temperaturaManual && lead.temperatura && temperatura && lead.temperatura !== temperatura ? ` (era ${lead.temperatura}, agora ${temperatura})` : "";
      await tx.lead.update({
        where: { id: lead.id },
        data: {
          ...(manda ? atualizacao(lead) : {}),
          formularios: [...new Set([...lead.formularios, f.formulario])],
          preenchidoEm: lead.preenchidoEm && lead.preenchidoEm > f.preenchidoEm ? lead.preenchidoEm : f.preenchidoEm,
          email: lead.email ?? f.email, whatsapp: lead.whatsapp ?? f.whatsapp, origem: lead.origem ?? f.origem,
        },
      });
      if (f.completa || !anteriores.length) {
        await tx.leadNota.create({ data: { leadId: lead.id, tipo: "form", texto: `Preencheu o forms ${f.formulario} em ${br(f.preenchidoEm)}${mudou}`, autor } });
      }
      return "atualizado";
    }

    const etapa = await tx.funilEtapa.findFirst({ where: { tipo: "aberta" }, orderBy: { ordem: "asc" } });
    if (!etapa) throw new Error("O funil está sem etapas abertas.");
    const antes = await tx.lead.findFirst({ where: { OR: contato }, orderBy: { updatedAt: "desc" }, include: { etapa: true } });
    const cliente = f.email
      ? await tx.mentorada.findFirst({ where: { email: { equals: f.email, mode: "insensitive" } }, select: { tipo: true, status: true } })
      : null;
    await tx.lead.create({
      data: {
        nome: f.nome, email: f.email, whatsapp: f.whatsapp, origem: f.origem, etapaId: etapa.id, criadoPor: autor,
        formularios: [f.formulario], preenchidoEm: f.preenchidoEm, temperatura, pontuacao,
        respostas: { create: { id: f.id, preenchidoEm: f.preenchidoEm, ...dados } },
        notas: {
          create: [
            { tipo: "form", texto: `Entrou no funil pelo forms ${f.formulario}, preenchido em ${br(f.preenchidoEm)}${f.completa ? "" : " (não terminou o formulário)"}`, autor },
            ...(antes ? [{ tipo: "form", texto: `Já passou pelo funil antes: ${antes.etapa.nome}${antes.motivoPerda ? ` (${antes.motivoPerda})` : ""}${antes.responsavel ? `, com ${antes.responsavel}` : ""}`, autor }] : []),
            ...(cliente ? [{ tipo: "form", texto: `Atenção: este e-mail já está no Pós Venda (${cliente.tipo || "sem programa"}, ${cliente.status})`, autor }] : []),
          ],
        },
      },
    });
    return "novo";
  }, { timeout: 15_000, maxWait: 15_000 });

  function atualizacao(lead: { temperaturaManual: boolean }) {
    return lead.temperaturaManual ? { pontuacao } : { pontuacao, temperatura };
  }
}
