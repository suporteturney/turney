import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const COOKIE_SESSAO = "sessao";
const DURACAO_DIAS = 14;

export type UsuarioSessao = {
  id: string;
  nome: string;
  email: string;
  papel: string;
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
        select: { id: true, nome: true, email: true, papel: true, ativo: true },
      },
    },
  });
  if (!sessao || sessao.expiraEm < new Date() || !sessao.usuario.ativo)
    return null;
  const { id, nome, email, papel } = sessao.usuario;
  return { id, nome, email, papel };
});

export async function exigirUsuario(): Promise<UsuarioSessao> {
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/login");
  return usuario;
}
