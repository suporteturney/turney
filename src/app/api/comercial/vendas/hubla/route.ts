import { NextRequest, NextResponse } from "next/server";
import { exigirPilarApi, semPermissao } from "@/lib/auth";
import { registrarAtividade } from "@/lib/atividade";
import { erro } from "@/lib/comercial-servidor";
import { lerVendasPlanilhaHubla } from "@/lib/hubla-vendas";
import { registrarVendaHubla, type ResultadoVendaHubla } from "@/lib/hubla-vendas-servidor";
import { lerXlsx } from "@/lib/xlsx-simples";

export const maxDuration = 60;
const MAX = 10 * 1024 * 1024;

// Importa o relatório de Vendas exportado da Hubla. Mesmas regras do aviso automático: não duplica,
// liga com venda registrada à mão, fecha o cartão do funil e cancela as reembolsadas.
export async function POST(req: NextRequest) {
  const usuario = await exigirPilarApi("comercial");
  const negado = semPermissao(usuario, "equipe");
  if (negado) return negado;
  const form = await req.formData().catch(() => null);
  const arq = form?.get("arquivo");
  if (!arq || typeof arq === "string") return erro("Escolha o arquivo .xlsx exportado da Hubla.");
  if (arq.size > MAX) return erro("Arquivo grande demais (máximo 10 MB).");
  let linhas: string[][];
  try { linhas = lerXlsx(Buffer.from(await arq.arrayBuffer())); }
  catch (e) { return erro(`${(e as Error).message} Exporte de novo em xlsx.`); }
  const { vendas, ignoradas, erro: e } = lerVendasPlanilhaHubla(linhas);
  if (e) return erro(e);
  if (!vendas.length) return erro("Não achei nenhuma venda paga na planilha.");

  const conta: Record<ResultadoVendaHubla, number> = { criada: 0, ligada: 0, repetida: 0, cancelada: 0, ignorada: 0 };
  const inicio = new Date().getTime();
  let feitas = 0;
  for (const v of vendas) {
    conta[await registrarVendaHubla(v)]++;
    feitas++;
    if (new Date().getTime() - inicio > 50_000) break;
  }
  await registrarAtividade(usuario, {
    acao: "importou", entidade: "venda",
    resumo: `Importou vendas da Hubla: ${conta.criada} novas, ${conta.ligada} ligadas a vendas já registradas, ${conta.repetida} que já estavam, ${conta.cancelada} reembolsadas`,
  });
  return NextResponse.json({ ...conta, ignoradas, total: vendas.length, faltaram: vendas.length - feitas });
}
