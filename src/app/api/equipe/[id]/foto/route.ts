import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { pode } from "@/lib/permissoes";
import { registrarAtividade } from "@/lib/atividade";

// Foto de perfil de quem é da equipe.
// GET: qualquer pessoa logada vê. PUT/DELETE: a própria pessoa ou quem administra a equipe.

const MAX = 300 * 1024;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await exigirUsuario();
  const { id } = await params;
  const f = await prisma.fotoUsuario.findUnique({ where: { usuarioId: id } });
  if (!f) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(f.dados), {
    headers: { "Content-Type": f.tipo, "Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff" },
  });
}

async function checar(id: string) {
  const usuario = await exigirUsuario();
  if (usuario.trocarSenha) return { usuario, erro: NextResponse.json({ erro: "Crie a sua senha antes de fazer alterações." }, { status: 403 }) };
  if (usuario.id !== id && !pode(usuario, "equipe")) {
    return { usuario, erro: NextResponse.json({ erro: "Você só pode trocar a sua própria foto." }, { status: 403 }) };
  }
  const alvo = await prisma.usuario.findUnique({ where: { id }, select: { id: true, nome: true } });
  if (!alvo) return { usuario, erro: NextResponse.json({ erro: "Pessoa não encontrada." }, { status: 404 }) };
  return { usuario, alvo, erro: null };
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await checar(id);
  if (c.erro) return c.erro;
  const { imagem } = await req.json();
  const m = typeof imagem === "string" ? imagem.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/) : null;
  if (!m) return NextResponse.json({ erro: "Escolha uma imagem (JPG ou PNG)." }, { status: 400 });
  const dados = Buffer.from(m[2], "base64");
  if (dados.length > MAX) return NextResponse.json({ erro: "Imagem grande demais. Tente outra foto." }, { status: 400 });
  const f = await prisma.fotoUsuario.upsert({
    where: { usuarioId: id },
    update: { dados, tipo: m[1] },
    create: { usuarioId: id, dados, tipo: m[1] },
  });
  await registrarAtividade(c.usuario, { acao: "editou", entidade: "usuario", resumo: `Trocou a foto de ${c.alvo!.nome}` });
  return NextResponse.json({ ok: true, url: `/api/equipe/${id}/foto?v=${f.atualizadaEm.getTime()}` });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await checar(id);
  if (c.erro) return c.erro;
  await prisma.fotoUsuario.deleteMany({ where: { usuarioId: id } });
  await registrarAtividade(c.usuario, { acao: "editou", entidade: "usuario", resumo: `Removeu a foto de ${c.alvo!.nome}` });
  return NextResponse.json({ ok: true });
}
