import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirPilarApi } from "@/lib/auth";
import { pode } from "@/lib/permissoes";
import { registrarAtividade } from "@/lib/atividade";
import { negar } from "@/lib/pipeline-servidor";

// Ligar à mão um e-mail da Hubla a uma mentorada (vale também para os próximos avisos desse e-mail).
export async function POST(req: NextRequest) {
  const usuario = await exigirPilarApi("posvenda");
  const negado = negar(usuario, pode(usuario, "equipe") || pode(usuario, "cadastro"), ["cadastro"]);
  if (negado) return negado;
  const { email, mentoradaId } = await req.json();
  const e = typeof email === "string" ? email.trim().toLowerCase() : "";
  const m = typeof mentoradaId === "string" ? await prisma.mentorada.findUnique({ where: { id: mentoradaId }, select: { id: true, nome: true } }) : null;
  if (!e || !m) return NextResponse.json({ erro: "Escolha a mentorada pela lista." }, { status: 400 });
  const r = await prisma.eventoHubla.updateMany({ where: { email: e }, data: { mentoradaId: m.id } });
  const c = await prisma.consumoHubla.updateMany({ where: { email: e }, data: { mentoradaId: m.id } });
  if (!r.count && !c.count) {
    return NextResponse.json({ erro: "Esse e-mail não apareceu em nenhum aviso nem no relatório importado." }, { status: 404 });
  }
  await registrarAtividade(usuario, { acao: "editou", entidade: "integracao", mentoradaId: m.id, resumo: `Ligou o e-mail ${e} da Hubla a ${m.nome}` });
  return NextResponse.json({ ok: true, ligados: r.count + c.count });
}
