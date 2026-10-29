import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { exigirUsuario, semPermissao } from "@/lib/auth";
import { diferencas, registrarAtividade } from "@/lib/atividade";
import { PAPEIS, PERMISSOES } from "@/lib/permissoes";
import { limparPermissoes, senhaProvisoria } from "@/lib/equipe";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirUsuario();
  const negado = semPermissao(usuario, "equipe");
  if (negado) return negado;
  const { id } = await params;
  const body = await req.json();

  const atual = await prisma.usuario.findUnique({ where: { id } });
  if (!atual) return NextResponse.json({ erro: "Acesso não encontrado." }, { status: 404 });

  const dados: { nome?: string; papel?: string; permissoes?: string[]; ativo?: boolean } = {};
  if (typeof body.nome === "string" && body.nome.trim()) dados.nome = body.nome.trim();
  if (PAPEIS.some(p => p.k === body.papel)) dados.papel = body.papel;
  if ("permissoes" in body) dados.permissoes = limparPermissoes(body.permissoes);
  if (typeof body.ativo === "boolean") dados.ativo = body.ativo;
  if ((dados.papel ?? atual.papel) === "admin") dados.permissoes = PERMISSOES.map(p => p.k);

  // A administradora não pode se trancar fora.
  if (id === usuario.id && (dados.ativo === false || (dados.papel && dados.papel !== "admin"))) {
    return NextResponse.json({ erro: "Você não pode desativar nem tirar o seu próprio acesso de administradora." }, { status: 400 });
  }

  let senha: string | null = null;
  const extra: { senhaHash?: string; trocarSenha?: boolean } = {};
  if (body.redefinirSenha) {
    senha = senhaProvisoria();
    extra.senhaHash = await bcrypt.hash(senha, 10);
    extra.trocarSenha = true;
  }

  const mudancas = diferencas(
    { ...atual, permissoes: atual.permissoes.join(", ") },
    { ...dados, ...(dados.permissoes ? { permissoes: dados.permissoes.join(", ") } : {}) },
  );
  await prisma.usuario.update({ where: { id }, data: { ...dados, ...extra } });
  if (dados.ativo === false || extra.senhaHash) await prisma.sessao.deleteMany({ where: { usuarioId: id } });

  const partes = [...Object.keys(mudancas), ...(senha ? ["senha redefinida"] : [])];
  if (partes.length) {
    await registrarAtividade(usuario, {
      acao: "editou", entidade: "usuario",
      resumo: `Alterou o acesso de ${atual.nome}: ${partes.join(", ")}`,
      detalhe: mudancas,
    });
  }
  return NextResponse.json({ ok: true, senhaProvisoria: senha });
}
