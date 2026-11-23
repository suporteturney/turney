import { NextRequest, NextResponse } from "next/server";
import { exigirPilarApi } from "@/lib/auth";
import { passarParaPosVenda, semSenha } from "@/lib/comercial-servidor";

export const maxDuration = 30;

// Passar a venda para o Pós Venda. { ligar: true } liga ao cadastro ativo que já existe.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirPilarApi("comercial");
  const negado = semSenha(usuario);
  if (negado) return negado;
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const r = await passarParaPosVenda(id, usuario, b.ligar === true);
  return r.ok ? NextResponse.json(r) : NextResponse.json({ erro: r.erro, existente: r.existente }, { status: r.status });
}
