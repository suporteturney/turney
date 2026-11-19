import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { pode } from "@/lib/permissoes";
import { registrarAtividade } from "@/lib/atividade";
import { negar } from "@/lib/pipeline-servidor";
import { lerXlsx } from "@/lib/xlsx-simples";
import { lerConsumo } from "@/lib/hubla-consumo";

export const maxDuration = 60;
const MAX = 15 * 1024 * 1024;

// Importa o relatório "Consumo do membro por conteúdo" (xlsx) e substitui o que havia.
export async function POST(req: NextRequest) {
  const usuario = await exigirUsuario();
  const negado = negar(usuario, pode(usuario, "equipe") || pode(usuario, "acompanhamento"), ["acompanhamento"]);
  if (negado) return negado;

  const form = await req.formData().catch(() => null);
  const arq = form?.get("arquivo");
  if (!arq || typeof arq === "string") return NextResponse.json({ erro: "Escolha o arquivo .xlsx exportado da Hubla." }, { status: 400 });
  if (arq.size > MAX) return NextResponse.json({ erro: "Arquivo grande demais (máximo 15 MB)." }, { status: 400 });

  let linhas: string[][];
  try { linhas = lerXlsx(Buffer.from(await arq.arrayBuffer())); }
  catch (e) { return NextResponse.json({ erro: `${(e as Error).message} Exporte de novo em “xlsx”.` }, { status: 400 }); }
  const { registros, erro } = lerConsumo(linhas);
  if (erro) return NextResponse.json({ erro }, { status: 400 });
  if (!registros.length) return NextResponse.json({ erro: "Não achei nenhuma linha com e-mail na planilha." }, { status: 400 });

  // E-mail → mentorada: e-mail do cadastro ou ligação feita à mão na tela da Hubla.
  const [cadastro, ligados] = await Promise.all([
    prisma.mentorada.findMany({ where: { email: { not: null } }, orderBy: { updatedAt: "asc" }, select: { id: true, email: true } }),
    prisma.eventoHubla.findMany({ where: { mentoradaId: { not: null } }, distinct: ["email"], select: { email: true, mentoradaId: true } }),
  ]);
  const mapa = new Map<string, string>();
  for (const l of ligados) mapa.set(l.email.toLowerCase(), l.mentoradaId!);
  for (const m of cadastro) mapa.set(m.email!.trim().toLowerCase(), m.id);

  const dados = registros.map(r => ({ ...r, mentoradaId: mapa.get(r.email) ?? null }));
  await prisma.$transaction([
    prisma.consumoHubla.deleteMany({}),
    prisma.consumoHubla.createMany({ data: dados }),
  ], { timeout: 50_000 });

  const pessoas = new Set(dados.map(d => d.email)).size;
  const mentoradas = new Set(dados.map(d => d.mentoradaId).filter(Boolean)).size;
  const resumo = { em: new Date().toISOString(), por: usuario.nome, linhas: dados.length, pessoas, mentoradas, arquivo: arq.name };
  await prisma.configuracao.upsert({
    where: { chave: "hubla_consumo_importacao" },
    update: { valor: JSON.stringify(resumo), atualizadaPor: usuario.nome },
    create: { chave: "hubla_consumo_importacao", valor: JSON.stringify(resumo), atualizadaPor: usuario.nome },
  });
  await registrarAtividade(usuario, {
    acao: "importou", entidade: "integracao",
    resumo: `Importou o consumo de aulas da Hubla: ${dados.length} linhas, ${pessoas} pessoas, ${mentoradas} mentoradas reconhecidas`,
  });
  return NextResponse.json(resumo);
}
