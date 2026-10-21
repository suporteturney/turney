import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { criarSessao } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email, senha } = await req.json();

  if (!email || !senha) {
    return NextResponse.json({ erro: "Campos obrigatórios" }, { status: 400 });
  }

  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario || !usuario.ativo) {
    return NextResponse.json({ erro: "Credenciais inválidas" }, { status: 401 });
  }

  const ok = await bcrypt.compare(senha, usuario.senhaHash);
  if (!ok) {
    return NextResponse.json({ erro: "Credenciais inválidas" }, { status: 401 });
  }

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { ultimoAcesso: new Date() },
  });

  await criarSessao(usuario.id);
  return NextResponse.json({ ok: true });
}
