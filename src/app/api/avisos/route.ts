import { NextResponse } from "next/server";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Marca um aviso (ou todos) como lido. Cada pessoa só mexe nos próprios avisos.
export async function PATCH(req: Request) {
  const usuario = await exigirUsuario();
  const b = await req.json().catch(() => ({}));
  const where = b.todas ? { usuarioId: usuario.id, lidaEm: null } : { id: String(b.id ?? ""), usuarioId: usuario.id };
  const r = await prisma.notificacao.updateMany({ where, data: { lidaEm: b.naoLida ? null : new Date() } });
  return NextResponse.json({ ok: true, alterados: r.count });
}
