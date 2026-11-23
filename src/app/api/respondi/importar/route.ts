import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirPilarApi, semPermissao } from "@/lib/auth";
import { registrarAtividade } from "@/lib/atividade";
import { erro } from "@/lib/comercial-servidor";
import { lerPlanilhaRespondi } from "@/lib/respondi";
import { CHAVE_IMPORTACAO, receberPreenchimento } from "@/lib/respondi-servidor";
import { lerXlsx } from "@/lib/xlsx-simples";

export const maxDuration = 60;
const MAX = 15 * 1024 * 1024;
const POR_VEZ = 400; // cabe no tempo do servidor; a tela chama de novo até acabar

// Importa os preenchimentos antigos da planilha do Respondi, a partir de uma data. Repetir não duplica.
export async function POST(req: NextRequest) {
  const usuario = await exigirPilarApi("comercial");
  const negado = semPermissao(usuario, "equipe");
  if (negado) return negado;
  const form = await req.formData().catch(() => null);
  const arq = form?.get("arquivo");
  if (!arq || typeof arq === "string") return erro("Escolha a planilha (.xlsx).");
  if (arq.size > MAX) return erro("Arquivo grande demais (máximo 15 MB).");
  const desde = String(form!.get("desde") ?? ""), ate = String(form!.get("ate") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || (ate && !/^\d{4}-\d{2}-\d{2}$/.test(ate))) return erro("Escolha a partir de qual data importar.");
  const pular = Math.max(0, Number(form!.get("pular")) || 0);
  const soContar = form!.get("contar") === "1";

  let linhas: string[][];
  try { linhas = lerXlsx(Buffer.from(await arq.arrayBuffer())); }
  catch (e) { return erro(`${(e as Error).message} Baixe de novo em “Microsoft Excel (.xlsx)”.`); }
  const { lidos, erro: e } = lerPlanilhaRespondi(linhas, arq.name);
  if (e) return erro(e);
  const de = Date.parse(`${desde}T00:00:00-03:00`), fim = ate ? Date.parse(`${ate}T23:59:59-03:00`) : Infinity;
  const escolhidos = lidos.filter(f => f.preenchidoEm.getTime() >= de && f.preenchidoEm.getTime() <= fim)
    .sort((a, b) => a.preenchidoEm.getTime() - b.preenchidoEm.getTime());
  if (!escolhidos.length) return erro("Não achei preenchimentos com contato nesse período.");
  const formulario = escolhidos[0].formulario;
  if (soContar) return NextResponse.json({ total: escolhidos.length, pessoas: new Set(escolhidos.map(f => f.whatsapp ?? f.email)).size, formulario });

  const r = { novo: 0, atualizado: 0, repetido: 0 };
  const lote = escolhidos.slice(pular, pular + POR_VEZ);
  const inicio = new Date().getTime();
  let feitos = 0;
  for (const f of lote) {
    r[await receberPreenchimento(f, `Planilha (${f.formulario})`)]++;
    feitos++;
    if (new Date().getTime() - inicio > 45_000) break;
  }
  const proximo = pular + feitos;
  const acabou = proximo >= escolhidos.length;
  if (acabou) {
    const valor = JSON.stringify({ em: new Date().toISOString(), por: usuario.nome, formulario, desde, total: escolhidos.length });
    await prisma.configuracao.upsert({ where: { chave: CHAVE_IMPORTACAO }, update: { valor, atualizadaPor: usuario.nome }, create: { chave: CHAVE_IMPORTACAO, valor, atualizadaPor: usuario.nome } });
    await registrarAtividade(usuario, { acao: "importou", entidade: "lead", resumo: `Importou ${escolhidos.length} preenchimentos do forms ${formulario} a partir de ${desde.split("-").reverse().join("/")}` });
  }
  return NextResponse.json({ ...r, total: escolhidos.length, proximo, acabou, formulario });
}
