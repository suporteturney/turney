import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirPilarApi, semPermissao } from "@/lib/auth";
import { registrarAtividade } from "@/lib/atividade";
import { centavos, nomeMes, reais } from "@/lib/comercial";
import { erro, nomeCompleto } from "@/lib/comercial-servidor";

// Meta do mês, da equipe (vendedora vazia) ou de uma pessoa. Valor vazio apaga a meta.
export async function PUT(req: NextRequest) {
  const usuario = await exigirPilarApi("comercial");
  const negado = semPermissao(usuario, "equipe");
  if (negado) return negado;
  const b = await req.json();
  if (typeof b.mes !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(b.mes)) return erro("Mês inválido.");
  const mes: string = b.mes;
  const vendedora = (await nomeCompleto(b.vendedora)) ?? "";
  const valor = centavos(b.valor);
  const q = parseInt(String(b.quantidade ?? ""), 10);
  const quantidade = Number.isFinite(q) && q > 0 ? q : null;
  const quem = vendedora || "equipe";
  if (!valor) {
    await prisma.metaVenda.deleteMany({ where: { mes, vendedora } });
    await registrarAtividade(usuario, { acao: "excluiu", entidade: "meta", resumo: `Tirou a meta de ${nomeMes(mes)} (${quem})` });
    return NextResponse.json({ ok: true });
  }
  await prisma.metaVenda.upsert({
    where: { mes_vendedora: { mes, vendedora } },
    update: { valorCentavos: valor, quantidade }, create: { mes, vendedora, valorCentavos: valor, quantidade },
  });
  await registrarAtividade(usuario, { acao: "editou", entidade: "meta", resumo: `Definiu a meta de ${nomeMes(mes)} (${quem}): ${reais(valor)}` });
  return NextResponse.json({ ok: true });
}
