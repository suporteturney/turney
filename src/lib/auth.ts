import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NOME_PERMISSAO, ehAutora, pode, type Permissao } from "@/lib/permissoes";

export const COOKIE_SESSAO = "sessao";
const DURACAO_DIAS = 14;

export type UsuarioSessao = {
  id: string;
  nome: string;
  email: string;
  papel: string;
  permissoes: string[];
  trocarSenha: boolean;
};

const hashDoToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export async function criarSessao(usuarioId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiraEm = new Date(Date.now() + DURACAO_DIAS * 24 * 60 * 60 * 1000);
  await prisma.sessao.create({
    data: { tokenHash: hashDoToken(token), usuarioId, expiraEm },
  });
  await prisma.sessao.deleteMany({ where: { expiraEm: { lt: new Date() } } });
  (await cookies()).set(COOKIE_SESSAO, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiraEm,
  });
}

export async function encerrarSessao() {
  const jar = await cookies();
  const token = jar.get(COOKIE_SESSAO)?.value;
  if (token) {
    await prisma.sessao.deleteMany({
      where: { tokenHash: hashDoToken(token) },
    });
  }
  jar.delete(COOKIE_SESSAO);
}

export const usuarioAtual = cache(async (): Promise<UsuarioSessao | null> => {
  const token = (await cookies()).get(COOKIE_SESSAO)?.value;
  if (!token) return null;
  const sessao = await prisma.sessao.findUnique({
    where: { tokenHash: hashDoToken(token) },
    select: {
      expiraEm: true,
      usuario: {
        select: { id: true, nome: true, email: true, papel: true, permissoes: true, trocarSenha: true, ativo: true },
      },
    },
  });
  if (!sessao || sessao.expiraEm < new Date() || !sessao.usuario.ativo)
    return null;
  const { id, nome, email, papel, permissoes, trocarSenha } = sessao.usuario;
  return { id, nome, email, papel, permissoes, trocarSenha };
});

export async function exigirUsuario(): Promise<UsuarioSessao> {
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/login");
  return usuario;
}

// Nas rotas da API: devolve a resposta 403 quando falta a permissão, ou null quando pode seguir.
export function semAutoria(usuario: UsuarioSessao, autor: string | null) {
  if (usuario.trocarSenha) {
    return NextResponse.json({ erro: "Crie a sua senha antes de fazer alterações." }, { status: 403 });
  }
  if (ehAutora(usuario, autor)) return null;
  return NextResponse.json(
    { erro: "Só quem escreveu este registro ou uma administradora pode editar ou excluir." },
    { status: 403 },
  );
}

export function semPermissao(usuario: UsuarioSessao, ...necessarias: Permissao[]) {
  if (usuario.trocarSenha) {
    return NextResponse.json({ erro: "Crie a sua senha antes de fazer alterações." }, { status: 403 });
  }
  const faltam = necessarias.filter(p => !pode(usuario, p));
  if (!faltam.length) return null;
  return NextResponse.json(
    { erro: `Seu acesso não permite esta ação (${faltam.map(p => NOME_PERMISSAO[p]).join(", ")}). Fale com a administradora.` },
    { status: 403 },
  );
}
