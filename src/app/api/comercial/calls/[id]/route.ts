import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirPilarApi } from "@/lib/auth";
import { registrarAtividade } from "@/lib/atividade";
import { NOME_RESULTADO } from "@/lib/comercial";
import { erro, semSenha, texto } from "@/lib/comercial-servidor";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const usuario = await exigirPilarApi("comercial");
  const negado = semSenha(usuario);
  if (negado) return negado;
  const { id } = await params;
  const b = await req.json();
  const antes = await prisma.call.findUnique({ where: { id } });
  if (!antes) return erro("Call não encontrada.", 404);
  const data: Parameters<typeof prisma.call.update>[0]["data"] = { registradoPor: usuario.nome };
  if ("resultado" in b) data.resultado = typeof b.resultado === "string" && b.resultado in NOME_RESULTADO ? b.resultado : null;
  if ("obs" in b) data.obs = texto(b.obs, 2000);
  if ("leadId" in b) {
    const lead = typeof b.leadId === "string" && b.leadId ? await prisma.lead.findUnique({ where: { id: b.leadId }, select: { id: true } }) : null;
    if (b.leadId && !lead) return erro("Lead não encontrado.", 404);
    data.lead = lead ? { connect: { id: lead.id } } : { disconnect: true };
  }
  const call = await prisma.call.update({ where: { id }, data });
  if (call.leadId && call.resultado && call.resultado !== antes.resultado) {
    await prisma.leadNota.create({ data: { leadId: call.leadId, tipo: "call", texto: `Call: ${NOME_RESULTADO[call.resultado]}${call.obs ? `. ${call.obs}` : ""}`, autor: usuario.nome } });
  }
  await registrarAtividade(usuario, { acao: "editou", entidade: "call", resumo: `Atualizou a call “${call.titulo}”${call.resultado ? ` (${NOME_RESULTADO[call.resultado]})` : ""}` });
  return NextResponse.json({ ok: true });
}

// Só as calls criadas à mão (as da agenda saem quando saem do Google).
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const usuario = await exigirPilarApi("comercial");
  const negado = semSenha(usuario);
  if (negado) return negado;
  const { id } = await params;
  const call = await prisma.call.findUnique({ where: { id } });
  if (!call) return erro("Call não encontrada.", 404);
  if (call.eventoChave) return erro("Esta call veio do Google Agenda. Para tirar, cancele no Google.");
  await prisma.call.delete({ where: { id } });
  await registrarAtividade(usuario, { acao: "excluiu", entidade: "call", resumo: `Excluiu a call “${call.titulo}”` });
  return NextResponse.json({ ok: true });
}
