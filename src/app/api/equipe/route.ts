import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { exigirUsuario, semPermissao } from "@/lib/auth";
import { registrarAtividade } from "@/lib/atividade";
import { limparPermissoes, senhaProvisoria } from "@/lib/equipe";
import { PAPEIS, PERMISSOES, rotuloPapel } from "@/lib/permissoes";

export async function GET() {
  const usuario = await exigirUsuario();
  const negado = semPermissao(usuario, "equipe");
  if (negado) return negado;
  const lista = await prisma.usuario.findMany({
    orderBy: { nome: "asc" },
    select: { id: true, nome: true, email: true, papel: true, permissoes: true, ativo: true, trocarSenha: true, ultimoAcesso: true, createdAt: true },
  });
  return NextResponse.json(lista);
}

export async function POST(req: NextRequest) {
  const usuario = await exigirUsuario();
  const negado = semPermissao(usuario, "equipe");
  if (negado) return negado;

  const body = await req.json();
  const nome = typeof body.nome === "string" ? body.nome.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const papel = PAPEIS.some(p => p.k === body.papel) ? String(body.papel) : "leitura";
  if (!nome || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ erro: "Preencha nome e um e-mail válido." }, { status: 400 });
  }
  if (await prisma.usuario.findUnique({ where: { email } })) {
    return NextResponse.json({ erro: "Já existe um acesso com esse e-mail." }, { status: 409 });
  }

  const senha = senhaProvisoria();
  const novo = await prisma.usuario.create({
    data: {
      nome, email, papel,
      permissoes: papel === "admin" ? PERMISSOES.map(p => p.k) : limparPermissoes(body.permissoes),
      senhaHash: await bcrypt.hash(senha, 10),
      trocarSenha: true,
    },
    select: { id: true, nome: true, email: true, papel: true, permissoes: true },
  });
  await registrarAtividade(usuario, {
    acao: "criou", entidade: "usuario",
    resumo: `Criou o acesso de ${nome} (${rotuloPapel(papel)})`,
    detalhe: { email, papel, permissoes: novo.permissoes },
  });
  // A senha provisória só aparece nesta resposta, para a administradora repassar.
  return NextResponse.json({ usuario: novo, senhaProvisoria: senha }, { status: 201 });
}
