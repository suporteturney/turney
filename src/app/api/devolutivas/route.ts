import { NextResponse } from "next/server";
import { exigirUsuario, semPermissao } from "@/lib/auth";
import { registrarAtividade } from "@/lib/atividade";
import { idDoLink } from "@/lib/devolutiva";
import { baixarPlanilha, configDaPlanilha, salvarConfigPlanilha, sincronizarDevolutivas } from "@/lib/devolutiva-servidor";
import { prisma } from "@/lib/prisma";
import { lerXlsxAbas } from "@/lib/xlsx-simples";
import { lerPlanilhaDevolutivas } from "@/lib/devolutiva";
import { hojeISO } from "@/lib/dias-uteis";

export const maxDuration = 60;

// Liga (ou desliga) a planilha de devolutivas: guarda só o código do arquivo e o nome da mentora.
export async function PUT(req: Request) {
  const usuario = await exigirUsuario();
  const negado = semPermissao(usuario, "equipe");
  if (negado) return negado;
  const b = await req.json().catch(() => ({}));
  if (b.desligar) {
    await salvarConfigPlanilha(null, usuario.nome);
    await registrarAtividade(usuario, { acao: "editou", entidade: "configuracao", resumo: "Desligou a planilha de devolutivas comportamentais" });
    return NextResponse.json({ ok: true });
  }
  // Só trocar quem recebe os avisos.
  if (Array.isArray(b.avisar) && !b.link) {
    const atual = await configDaPlanilha();
    if (!atual) return NextResponse.json({ erro: "Ligue a planilha primeiro." }, { status: 400 });
    const ok = await prisma.usuario.findMany({ where: { id: { in: b.avisar.map(String) }, ativo: true }, select: { id: true } });
    await salvarConfigPlanilha({ ...atual, avisar: ok.map(u => u.id) }, usuario.nome);
    return NextResponse.json({ ok: true });
  }
  const id = idDoLink(String(b.link ?? ""));
  if (!id) return NextResponse.json({ erro: "Cole o link da planilha (o endereço que aparece no navegador quando ela está aberta)." }, { status: 400 });
  const mentora = String(b.mentora ?? "").trim().slice(0, 60) || "Natalia";
  try {
    lerPlanilhaDevolutivas(lerXlsxAbas(await baixarPlanilha(id)), hojeISO());
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message }, { status: 400 });
  }
  const avisar = (await configDaPlanilha())?.avisar ?? [usuario.id];
  await salvarConfigPlanilha({ id, mentora, avisar }, usuario.nome);
  await registrarAtividade(usuario, { acao: "editou", entidade: "configuracao", resumo: `Ligou a planilha de devolutivas comportamentais (${mentora})` });
  const r = await sincronizarDevolutivas({ forcar: true });
  return NextResponse.json(r);
}

// Botão "Ler agora".
export async function POST() {
  const usuario = await exigirUsuario();
  const negado = semPermissao(usuario, "equipe");
  if (negado) return negado;
  const r = await sincronizarDevolutivas({ forcar: true });
  if (!r.configurado) return NextResponse.json({ erro: "Cole o link da planilha primeiro." }, { status: 400 });
  if (r.erro) return NextResponse.json({ erro: r.erro }, { status: 502 });
  return NextResponse.json(r);
}
