import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirPilarApi } from "@/lib/auth";
import { registrarAtividade } from "@/lib/atividade";
import { centavos, reais } from "@/lib/comercial";
import { dataOuNula, erro, nomeCompleto, semSenha, texto } from "@/lib/comercial-servidor";
import { whatsappComDDI } from "@/lib/whatsapp";
import { pode } from "@/lib/permissoes";

// Corrigir, cancelar (ou desfazer o cancelamento) de uma venda. Só quem registrou, quem vendeu ou uma administradora.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirPilarApi("comercial");
  const negado = semSenha(usuario);
  if (negado) return negado;
  const { id } = await params;
  const b = await req.json();
  const v = await prisma.venda.findUnique({ where: { id } });
  if (!v) return erro("Venda não encontrada.", 404);
  if (!pode(usuario, "equipe") && v.criadoPor !== usuario.nome && v.vendedora !== usuario.nome) {
    return erro("Só quem registrou a venda ou uma administradora pode alterar.", 403);
  }

  const data: Parameters<typeof prisma.venda.update>[0]["data"] = {};
  if ("cliente" in b) { const t = texto(b.cliente); if (!t) return erro("Escreva o nome da cliente."); data.cliente = t; }
  if ("programa" in b) { const t = texto(b.programa, 60); if (!t) return erro("Escolha o programa."); data.programa = t; }
  if ("valor" in b) { const n = centavos(b.valor); if (!n) return erro("Escreva o valor da venda."); data.valorCentavos = n; }
  if ("data" in b) { const d = dataOuNula(b.data); if (!d) return erro("Data inválida."); data.data = d; }
  if ("vendedora" in b) { const n = await nomeCompleto(b.vendedora); if (!n) return erro("Escolha quem vendeu."); data.vendedora = n; }
  if ("email" in b) data.email = texto(b.email)?.toLowerCase() ?? null;
  if ("whatsapp" in b) data.whatsapp = whatsappComDDI(texto(b.whatsapp, 40));
  if ("pagamento" in b) data.pagamento = texto(b.pagamento, 80);
  if ("origem" in b) data.origem = texto(b.origem, 80);
  if ("inicio" in b) data.inicio = dataOuNula(b.inicio);
  if ("duracao" in b) { const n = parseInt(String(b.duracao ?? ""), 10); data.duracao = Number.isFinite(n) && n > 0 ? n : null; }
  if ("combinados" in b) data.combinados = texto(b.combinados, 4000);
  if (b.passagem === "nao_precisa" || b.passagem === "pendente") {
    if (v.passagem === "enviada") return erro("Esta venda já foi passada para o Pós Venda.", 409);
    data.passagem = b.passagem;
  }
  if (typeof b.cancelada === "boolean") {
    data.cancelada = b.cancelada;
    data.motivoCancelamento = b.cancelada ? texto(b.motivoCancelamento, 300) : null;
    if (b.cancelada && !data.motivoCancelamento) return erro("Escreva o motivo do cancelamento.");
  }
  const n = await prisma.venda.update({ where: { id }, data });
  await registrarAtividade(usuario, {
    acao: "editou", entidade: "venda",
    resumo: typeof b.cancelada === "boolean"
      ? `${b.cancelada ? "Cancelou" : "Reativou"} a venda de ${n.cliente} (${reais(n.valorCentavos)})${n.motivoCancelamento ? `: ${n.motivoCancelamento}` : ""}`
      : `Editou a venda de ${n.cliente}`,
  });
  return NextResponse.json({ ok: true });
}
