import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { pode } from "@/lib/permissoes";
import { registrarAtividade } from "@/lib/atividade";
import { negar } from "@/lib/pipeline-servidor";

// Guardar ou apagar o token do webhook da Hubla.
export async function PUT(req: NextRequest) {
  const usuario = await exigirUsuario();
  const negado = negar(usuario, pode(usuario, "equipe"), ["equipe"]);
  if (negado) return negado;
  const { token } = await req.json();
  const t = typeof token === "string" ? token.trim() : "";
  if (t.length < 8 || /\s/.test(t)) return NextResponse.json({ erro: "Cole o token completo, como aparece na Hubla (sem espaços)." }, { status: 400 });
  await prisma.configuracao.upsert({
    where: { chave: "hubla_webhook_token" },
    update: { valor: t, atualizadaPor: usuario.nome },
    create: { chave: "hubla_webhook_token", valor: t, atualizadaPor: usuario.nome },
  });
  await registrarAtividade(usuario, { acao: "editou", entidade: "integracao", resumo: "Salvou o token do webhook da Hubla" });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const usuario = await exigirUsuario();
  const negado = negar(usuario, pode(usuario, "equipe"), ["equipe"]);
  if (negado) return negado;
  await prisma.configuracao.deleteMany({ where: { chave: "hubla_webhook_token" } });
  await registrarAtividade(usuario, { acao: "editou", entidade: "integracao", resumo: "Desligou o webhook da Hubla" });
  return NextResponse.json({ ok: true });
}
