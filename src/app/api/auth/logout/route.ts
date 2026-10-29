import { NextResponse } from "next/server";
import { encerrarSessao, usuarioAtual } from "@/lib/auth";
import { registrarAtividade } from "@/lib/atividade";

export async function POST() {
  const usuario = await usuarioAtual();
  if (usuario) await registrarAtividade(usuario, { acao: "saiu", entidade: "sessao", resumo: `${usuario.nome} saiu da plataforma` });
  await encerrarSessao();
  return NextResponse.json({ ok: true });
}
