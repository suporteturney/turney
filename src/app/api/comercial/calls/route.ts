import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirPilarApi } from "@/lib/auth";
import { registrarAtividade } from "@/lib/atividade";
import { NOME_RESULTADO } from "@/lib/comercial";
import { erro, nomeCompleto, semSenha, texto } from "@/lib/comercial-servidor";

// Data e hora da tela são de Brasília (-03:00).
const quando = (data: unknown, hora: unknown) => {
  if (typeof data !== "string" || typeof hora !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data) || !/^\d{2}:\d{2}$/.test(hora)) return null;
  const d = new Date(`${data}T${hora}:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

// Salvar uma call: manual ({ data, hora, titulo }) ou da agenda ({ eventoId }). Também guarda lead, resultado e anotação.
export async function POST(req: NextRequest) {
  const usuario = await exigirPilarApi("comercial");
  const negado = semSenha(usuario);
  if (negado) return negado;
  const b = await req.json();
  const lead = typeof b.leadId === "string" && b.leadId ? await prisma.lead.findUnique({ where: { id: b.leadId }, select: { id: true, nome: true } }) : null;
  if (b.leadId && !lead) return erro("Lead não encontrado.", 404);
  const resultado = typeof b.resultado === "string" && b.resultado in NOME_RESULTADO ? b.resultado : null;
  const obs = texto(b.obs, 2000);

  let chave: string | null = null;
  let base: { titulo: string; inicio: Date; link: string | null; responsavel: string | null };
  const ev = typeof b.eventoId === "string" ? await prisma.eventoAgenda.findFirst({ where: { id: b.eventoId, pilar: "comercial" } }) : null;
  if (b.eventoId && !ev) return erro("Essa call saiu da agenda. Atualize a página.", 404);
  if (ev) {
    chave = `${ev.agenda}|${ev.uid}`;
    base = { titulo: ev.titulo, inicio: ev.inicio, link: ev.link, responsavel: ev.agenda };
  } else {
    const inicio = quando(b.data, b.hora);
    if (!inicio) return erro("Escolha o dia e o horário da call.");
    const titulo = texto(b.titulo) ?? (lead ? `Call com ${lead.nome}` : null);
    if (!titulo) return erro("Escreva o título ou escolha o lead.");
    base = { titulo, inicio, link: texto(b.link, 400), responsavel: (await nomeCompleto(b.responsavel)) ?? usuario.nome };
    if (base.link && !/^https:\/\//i.test(base.link)) return erro("O link da call precisa começar com https://");
  }
  const dados = { leadId: lead?.id ?? null, resultado, obs, registradoPor: usuario.nome };
  const antes = chave ? await prisma.call.findUnique({ where: { eventoChave: chave } }) : null;
  const call = antes
    ? await prisma.call.update({ where: { id: antes.id }, data: { ...dados, titulo: base.titulo, inicio: base.inicio, link: base.link } })
    : await prisma.call.create({ data: { ...base, ...dados, eventoChave: chave } });
  if (lead && resultado && antes?.resultado !== resultado) {
    await prisma.leadNota.create({ data: { leadId: lead.id, tipo: "call", texto: `Call: ${NOME_RESULTADO[resultado]}${obs ? `. ${obs}` : ""}`, autor: usuario.nome } });
  }
  await registrarAtividade(usuario, { acao: antes ? "editou" : "criou", entidade: "call", resumo: `${antes ? "Atualizou" : "Registrou"} a call “${call.titulo}”${resultado ? ` (${NOME_RESULTADO[resultado]})` : ""}` });
  return NextResponse.json({ id: call.id });
}
