import { NextRequest, NextResponse } from "next/server";
import { exigirPilarApi } from "@/lib/auth";
import { passarParaPosVenda, semSenha } from "@/lib/comercial-servidor";

export const maxDuration = 30;

// Passar a venda para o Pós Venda. modo "ligar" usa o cadastro ativo que já existe; "novo" cria mesmo assim (é outra pessoa).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirPilarApi("comercial");
  const negado = semSenha(usuario);
  if (negado) return negado;
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const r = await passarParaPosVenda(id, usuario, b.modo === "ligar" || b.modo === "novo" ? b.modo : "auto");
  return r.ok ? NextResponse.json(r) : NextResponse.json({ erro: r.erro, existente: r.existente }, { status: r.status });
}
