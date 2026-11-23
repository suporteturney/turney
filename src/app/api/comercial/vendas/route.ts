import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirPilarApi } from "@/lib/auth";
import { registrarAtividade } from "@/lib/atividade";
import { centavos, reais } from "@/lib/comercial";
import { dataOuNula, erro, nomeCompleto, passarParaPosVenda, semSenha, texto } from "@/lib/comercial-servidor";
import { whatsappComDDI } from "@/lib/whatsapp";

export const maxDuration = 30;

// Registrar uma venda (do funil ou avulsa). Com leadId, o card vai para "Fechado".
// Venda de lead do funil vai sempre direto para o Pós Venda; a avulsa, quando vier passar: true.
export async function POST(req: NextRequest) {
  const usuario = await exigirPilarApi("comercial");
  const negado = semSenha(usuario);
  if (negado) return negado;
  const b = await req.json();
  const lead = typeof b.leadId === "string" ? await prisma.lead.findUnique({ where: { id: b.leadId }, include: { etapa: true } }) : null;
  if (b.leadId && !lead) return erro("Lead não encontrado.", 404);
  if (lead?.etapa.tipo === "ganho") return erro("Este lead já está fechado.", 409);

  const cliente = texto(b.cliente) ?? lead?.nome;
  const programa = texto(b.programa, 60);
  const valor = centavos(b.valor);
  const data = dataOuNula(b.data);
  const vendedora = await nomeCompleto(b.vendedora);
  if (!cliente) return erro("Escreva o nome da cliente.");
  if (!programa) return erro("Escolha o programa.");
  if (!valor) return erro("Escreva o valor da venda.");
  if (!data) return erro("Escolha a data da venda.");
  if (!vendedora) return erro("Escolha quem vendeu.");
  const duracao = parseInt(String(b.duracao ?? ""), 10);
  const email = texto(b.email)?.toLowerCase() ?? null;
  const whatsapp = whatsappComDDI(texto(b.whatsapp, 40));

  const ganho = lead ? await prisma.funilEtapa.findFirst({ where: { tipo: "ganho" }, orderBy: { ordem: "asc" } }) : null;
  const venda = await prisma.$transaction(async tx => {
    const v = await tx.venda.create({
      data: {
        leadId: lead?.id ?? null, cliente, programa, valorCentavos: valor, data, vendedora, email, whatsapp,
        pagamento: texto(b.pagamento, 80), origem: texto(b.origem, 80) ?? lead?.origem ?? null, inicio: dataOuNula(b.inicio),
        duracao: Number.isFinite(duracao) && duracao > 0 ? duracao : null, combinados: texto(b.combinados, 4000),
        passagem: !lead && b.passagem === "nao_precisa" ? "nao_precisa" : "pendente", criadoPor: usuario.nome,
      },
    });
    if (lead) {
      await tx.lead.update({
        where: { id: lead.id },
        data: {
          ...(ganho ? { etapaId: ganho.id, etapaEm: new Date() } : {}), programa, valorCentavos: valor, motivoPerda: null, proximoPasso: null, proximoPassoEm: null,
          ...(email ? { email } : {}), ...(whatsapp ? { whatsapp } : {}),
        },
      });
      await tx.leadNota.create({ data: { leadId: lead.id, tipo: "venda", texto: `Venda registrada: ${programa}, ${reais(valor)}`, autor: usuario.nome } });
    }
    return v;
  });
  await registrarAtividade(usuario, { acao: "criou", entidade: "venda", resumo: `Registrou a venda de ${cliente}: ${programa}, ${reais(valor)} (${vendedora})` });

  // A venda fica salva mesmo se a passagem não puder ser feita agora.
  const passagem = lead || b.passar ? await passarParaPosVenda(venda.id, usuario) : null;
  return NextResponse.json({ id: venda.id, passagem }, { status: 201 });
}
