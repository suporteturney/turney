import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { lerAvisoHubla } from "@/lib/hubla";
import { mentoradaDoEmail } from "@/lib/hubla-servidor";

// Porta de entrada dos avisos da Hubla (sem login). Protegida pelo token do webhook,
// que a Hubla manda no cabeçalho "x-hubla-token" e que fica guardado na tela Administração › Hubla.

export async function POST(req: NextRequest) {
  const conf = await prisma.configuracao.findUnique({ where: { chave: "hubla_webhook_token" } });
  const esperado = conf?.valor ?? process.env.HUBLA_WEBHOOK_TOKEN ?? "";
  if (!esperado) return NextResponse.json({ erro: "Integração com a Hubla ainda não configurada." }, { status: 503 });
  const recebido = Buffer.from(req.headers.get("x-hubla-token") ?? "");
  const certo = Buffer.from(esperado);
  if (recebido.length !== certo.length || !timingSafeEqual(recebido, certo)) {
    return NextResponse.json({ erro: "Token inválido." }, { status: 401 });
  }

  let corpo: unknown;
  try { corpo = await req.json(); } catch { return NextResponse.json({ erro: "Corpo inválido." }, { status: 400 }); }
  const r = lerAvisoHubla(corpo);
  // Avisos que não usamos (financeiros etc.) recebem 200 para a Hubla não ficar reenviando.
  if (!r) return NextResponse.json({ ok: true, ignorado: true });

  await prisma.eventoHubla.upsert({
    where: { chave: r.chave },
    update: {},
    create: { ...r, mentoradaId: await mentoradaDoEmail(r.email) },
  });
  return NextResponse.json({ ok: true });
}
