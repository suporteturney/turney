import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirPilarApi, semPermissao } from "@/lib/auth";
import { registrarAtividade } from "@/lib/atividade";
import { erro } from "@/lib/comercial-servidor";
import { CHAVE_TOKEN, FORMS_REPASSE, chaveRepasse, novoToken, urlRepasseValida } from "@/lib/respondi-servidor";

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

// Guarda (ou apaga, se vazio) o endereço que já estava no formulário, para o painel repassar uma cópia.
export async function PUT(req: NextRequest) {
  const usuario = await exigirPilarApi("comercial");
  const negado = semPermissao(usuario, "equipe");
  if (negado) return negado;
  const b = await req.json().catch(() => ({}));
  const alvo = FORMS_REPASSE.find(f => f.k === b.form);
  if (!alvo) return erro("Formulário não reconhecido.");
  const url = typeof b.url === "string" ? b.url.trim() : "";
  const chave = chaveRepasse(alvo.k);
  if (!url) {
    await prisma.configuracao.deleteMany({ where: { chave } });
    await registrarAtividade(usuario, { acao: "editou", entidade: "integracao", resumo: `Desligou o repasse do forms ${alvo.formulario}` });
    return NextResponse.json({ ok: true });
  }
  if (url.length > 400 || !urlRepasseValida(url)) return erro("Cole o endereço completo que estava no Respondi (do Make, Zapier, Pluga ou n8n, começando com https://).");
  const valor = JSON.stringify({ url });
  await prisma.configuracao.upsert({ where: { chave }, update: { valor, atualizadaPor: usuario.nome }, create: { chave, valor, atualizadaPor: usuario.nome } });
  await registrarAtividade(usuario, { acao: "editou", entidade: "integracao", resumo: `Ligou o repasse do forms ${alvo.formulario} para a automação que já existia` });
  return NextResponse.json({ ok: true });
}
