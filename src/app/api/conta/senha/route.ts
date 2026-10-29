import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { registrarAtividade } from "@/lib/atividade";

export async function POST(req: NextRequest) {
  const usuario = await exigirUsuario();
  const { atual, nova } = await req.json();
  if (typeof nova !== "string" || nova.length < 8) {
    return NextResponse.json({ erro: "A nova senha precisa ter pelo menos 8 caracteres." }, { status: 400 });
  }
  const u = await prisma.usuario.findUnique({ where: { id: usuario.id }, select: { senhaHash: true } });
  if (!u || typeof atual !== "string" || !(await bcrypt.compare(atual, u.senhaHash))) {
    return NextResponse.json({ erro: "A senha atual não confere." }, { status: 400 });
  }
  if (await bcrypt.compare(nova, u.senhaHash)) {
    return NextResponse.json({ erro: "Escolha uma senha diferente da atual." }, { status: 400 });
  }
  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { senhaHash: await bcrypt.hash(nova, 10), trocarSenha: false },
  });
  await registrarAtividade(usuario, { acao: "editou", entidade: "usuario", resumo: `${usuario.nome} trocou a própria senha` });
  return NextResponse.json({ ok: true });
}
