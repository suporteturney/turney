import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { lerAvisoRespondi } from "@/lib/respondi";
import { CHAVE_ULTIMO, receberPreenchimento, tokenCerto } from "@/lib/respondi-servidor";

// Porta de entrada dos formulários do Respondi (sem login). O Respondi só aceita um endereço, sem cabeçalho de senha,
// então o código secreto vai no próprio endereço — gerado e trocado em Administração › Formulários.
type Ctx = { params: Promise<{ token: string }> };
const MAX = 300_000;

export async function POST(req: NextRequest, { params }: Ctx) {
  const { token } = await params;
  const certo = await tokenCerto(token);
  if (!certo) return NextResponse.json({ erro: "Endereço inválido." }, { status: 404 });
  const txt = await req.text();
  if (txt.length > MAX) return NextResponse.json({ erro: "Resposta grande demais." }, { status: 413 });
  let corpo: unknown;
  try { corpo = JSON.parse(txt); } catch { return NextResponse.json({ erro: "Corpo inválido." }, { status: 400 }); }

  const agora = new Date();
  const f = lerAvisoRespondi(corpo, agora);
  const resultado = f ? await receberPreenchimento(f, `Respondi (${f.formulario})`) : "sem_contato";
  const valor = JSON.stringify({ em: agora.toISOString(), formulario: f?.formulario ?? null, resultado });
  await prisma.configuracao.upsert({ where: { chave: CHAVE_ULTIMO }, update: { valor }, create: { chave: CHAVE_ULTIMO, valor } }).catch(() => {}); // só informa a tela
  return NextResponse.json({ ok: true, resultado });
}
// Alguns testes de endereço usam GET.
export async function GET(_req: NextRequest, { params }: Ctx) {
  const certo = await tokenCerto((await params).token);
  return certo ? NextResponse.json({ ok: true }) : NextResponse.json({ erro: "Endereço inválido." }, { status: 404 });
}
