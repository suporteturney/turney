import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await exigirUsuario();
  const { id } = await params;
  await prisma.varredura.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
