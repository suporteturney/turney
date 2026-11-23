import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirPilarApi } from "@/lib/auth";
import { registrarAtividade } from "@/lib/atividade";
import { centavos } from "@/lib/comercial";
import { dataOuNula, erro, nomeCompleto, semSenha, texto } from "@/lib/comercial-servidor";
import { whatsappComDDI } from "@/lib/whatsapp";

export async function POST(req: NextRequest) {
  const usuario = await exigirPilarApi("comercial");
  const negado = semSenha(usuario);
  if (negado) return negado;
  const b = await req.json();
  const nome = texto(b.nome);
  if (!nome) return erro("Escreva o nome do lead.");
  const email = texto(b.email)?.toLowerCase() ?? null;
  const whatsapp = whatsappComDDI(texto(b.whatsapp, 40));

  // Evita dois cards da mesma pessoa em aberto.
  if (!b.mesmoAssim && (email || whatsapp)) {
    const igual = await prisma.lead.findFirst({
      where: { etapa: { tipo: "aberta" }, OR: [...(email ? [{ email }] : []), ...(whatsapp ? [{ whatsapp }] : [])] },
      include: { etapa: { select: { nome: true } } },
    });
    if (igual) return NextResponse.json({ erro: `${igual.nome} já está no funil, em “${igual.etapa.nome}”${igual.responsavel ? ` com ${igual.responsavel}` : ""}.`, repetido: true }, { status: 409 });
  }
  const etapa = (typeof b.etapaId === "string" ? await prisma.funilEtapa.findFirst({ where: { id: b.etapaId, tipo: "aberta" } }) : null)
    ?? await prisma.funilEtapa.findFirst({ where: { tipo: "aberta" }, orderBy: { ordem: "asc" } });
  if (!etapa) return erro("Crie uma etapa no funil primeiro.");

  const lead = await prisma.lead.create({
    data: {
      nome, email, whatsapp, instagram: texto(b.instagram, 80), origem: texto(b.origem, 80), programa: texto(b.programa, 60),
      valorCentavos: centavos(b.valor), responsavel: (await nomeCompleto(b.responsavel)) ?? usuario.nome, etapaId: etapa.id,
      proximoPasso: texto(b.proximoPasso), proximoPassoEm: dataOuNula(b.proximoPassoEm), obs: texto(b.obs, 4000), criadoPor: usuario.nome,
      notas: { create: { tipo: "etapa", texto: `Entrou no funil em “${etapa.nome}”`, autor: usuario.nome } },
    },
  });
  await registrarAtividade(usuario, { acao: "criou", entidade: "lead", resumo: `Cadastrou o lead ${nome}` });
  return NextResponse.json({ id: lead.id }, { status: 201 });
}
