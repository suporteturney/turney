import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirPilarApi, semPermissao } from "@/lib/auth";
import { registrarAtividade } from "@/lib/atividade";
import { CHAVE_TOKEN, novoToken } from "@/lib/respondi-servidor";

// Cria ou troca o endereço secreto que recebe os formulários.
export async function POST() {
  const usuario = await exigirPilarApi("comercial");
  const negado = semPermissao(usuario, "equipe");
  if (negado) return negado;
  const valor = novoToken();
  await prisma.configuracao.upsert({
    where: { chave: CHAVE_TOKEN },
    update: { valor, atualizadaPor: usuario.nome },
    create: { chave: CHAVE_TOKEN, valor, atualizadaPor: usuario.nome },
  });
  await registrarAtividade(usuario, { acao: "editou", entidade: "integracao", resumo: "Gerou um novo endereço para receber os formulários do Respondi" });
  return NextResponse.json({ ok: true });
}
