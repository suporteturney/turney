import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { pode } from "@/lib/permissoes";
import { registrarAtividade } from "@/lib/atividade";
import { negar } from "@/lib/pipeline-servidor";

// Ligar à mão um e-mail da Hubla a uma mentorada (vale também para os próximos avisos desse e-mail).
export async function POST(req: NextRequest) {
  const usuario = await exigirUsuario();
  const negado = negar(usuario, pode(usuario, "equipe") || pode(usuario, "cadastro"), ["cadastro"]);
  if (negado) return negado;
  const { email, mentoradaId } = await req.json();
  const e = typeof email === "string" ? email.trim().toLowerCase() : "";
  const m = typeof mentoradaId === "string" ? await prisma.mentorada.findUnique({ where: { id: mentoradaId }, select: { id: true, nome: true } }) : null;
  if (!e || !m) return NextResponse.json({ erro: "Escolha a mentorada pela lista." }, { status: 400 });
  const r = await prisma.eventoHubla.updateMany({ where: { email: e }, data: { mentoradaId: m.id } });
  await registrarAtividade(usuario, { acao: "editou", entidade: "integracao", mentoradaId: m.id, resumo: `Ligou o e-mail ${e} da Hubla a ${m.nome}` });
  return NextResponse.json({ ok: true, ligados: r.count });
}
