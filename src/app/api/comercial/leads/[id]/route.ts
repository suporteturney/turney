import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirPilarApi } from "@/lib/auth";
import { registrarAtividade } from "@/lib/atividade";
import { centavos } from "@/lib/comercial";
import { dataOuNula, erro, nomeCompleto, semSenha, texto } from "@/lib/comercial-servidor";
import { pode } from "@/lib/permissoes";
import { whatsappComDDI } from "@/lib/whatsapp";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  await exigirPilarApi("comercial");
  const { id } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      notas: { orderBy: { createdAt: "desc" } },
      calls: { orderBy: { inicio: "desc" }, select: { id: true, titulo: true, inicio: true, resultado: true, responsavel: true } },
      vendas: { orderBy: { data: "desc" }, select: { id: true, programa: true, valorCentavos: true, data: true, cancelada: true, passagem: true } },
    },
  });
  return lead ? NextResponse.json(lead) : erro("Lead não encontrado.", 404);
}

// Editar os dados ou mover de etapa. "Fechado" só pela venda (POST /api/comercial/vendas).
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const usuario = await exigirPilarApi("comercial");
  const negado = semSenha(usuario);
  if (negado) return negado;
  const { id } = await params;
  const b = await req.json();
  const atual = await prisma.lead.findUnique({ where: { id }, include: { etapa: true } });
  if (!atual) return erro("Lead não encontrado.", 404);

  const data: Parameters<typeof prisma.lead.update>[0]["data"] = {};
  if ("nome" in b) { const n = texto(b.nome); if (!n) return erro("O lead precisa de um nome."); data.nome = n; }
  if ("email" in b) data.email = texto(b.email)?.toLowerCase() ?? null;
  if ("whatsapp" in b) data.whatsapp = whatsappComDDI(texto(b.whatsapp, 40));
  if ("instagram" in b) data.instagram = texto(b.instagram, 80);
  if ("origem" in b) data.origem = texto(b.origem, 80);
  if ("programa" in b) data.programa = texto(b.programa, 60);
  if ("valor" in b) data.valorCentavos = centavos(b.valor);
  if ("responsavel" in b) data.responsavel = await nomeCompleto(b.responsavel);
  if ("proximoPasso" in b) data.proximoPasso = texto(b.proximoPasso);
  if ("proximoPassoEm" in b) data.proximoPassoEm = dataOuNula(b.proximoPassoEm);
  if ("obs" in b) data.obs = texto(b.obs, 4000);

  let nota: string | null = null;
  if (typeof b.etapaId === "string" && b.etapaId !== atual.etapaId) {
    const destino = await prisma.funilEtapa.findUnique({ where: { id: b.etapaId } });
    if (!destino) return erro("Essa etapa não existe mais. Atualize a página.", 404);
    if (destino.tipo === "ganho") return erro("Para fechar, registre a venda.");
    if (destino.tipo === "perdido") {
      const motivo = texto(b.motivoPerda, 120);
      if (!motivo) return erro("Escolha o motivo da perda.");
      data.motivoPerda = motivo;
      data.proximoPasso = null; data.proximoPassoEm = null;
    } else data.motivoPerda = null;
    data.etapa = { connect: { id: destino.id } };
    data.etapaEm = new Date();
    nota = `${atual.etapa.nome} → ${destino.nome}${destino.tipo === "perdido" ? ` (${data.motivoPerda})` : ""}`;
  }
  const lead = await prisma.lead.update({ where: { id }, data });
  if (nota) {
    await prisma.leadNota.create({ data: { leadId: id, tipo: "etapa", texto: nota, autor: usuario.nome } });
    await registrarAtividade(usuario, { acao: "editou", entidade: "lead", resumo: `Moveu o lead ${lead.nome}: ${nota}` });
  } else {
    await registrarAtividade(usuario, { acao: "editou", entidade: "lead", resumo: `Editou o lead ${lead.nome}` });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const usuario = await exigirPilarApi("comercial");
  const negado = semSenha(usuario);
  if (negado) return negado;
  const { id } = await params;
  const lead = await prisma.lead.findUnique({ where: { id }, select: { nome: true, criadoPor: true, _count: { select: { vendas: true } } } });
  if (!lead) return erro("Lead não encontrado.", 404);
  if (!pode(usuario, "excluir") && lead.criadoPor !== usuario.nome) return erro("Só quem cadastrou o lead ou uma administradora pode excluir.", 403);
  if (lead._count.vendas) return erro("Este lead tem venda registrada e não pode ser excluído.");
  await prisma.lead.delete({ where: { id } });
  await registrarAtividade(usuario, { acao: "excluiu", entidade: "lead", resumo: `Excluiu o lead ${lead.nome}` });
  return NextResponse.json({ ok: true });
}
