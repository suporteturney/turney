import { prisma } from "@/lib/prisma";
import { exigirPilar } from "@/lib/auth";
import { temPilar } from "@/lib/permissoes";
import PassagemCliente from "./PassagemCliente";

export default async function PassagemPage() {
  const usuario = await exigirPilar("comercial");
  const vendas = await prisma.venda.findMany({
    where: { cancelada: false, passagem: { not: "nao_precisa" } },
    orderBy: { data: "desc" }, take: 120,
    include: { mentorada: { select: { nome: true, status: true, pipelineFase: { select: { nome: true } } } } },
  });
  const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
  return (
    <PassagemCliente
      verCadastro={temPilar(usuario, "posvenda")}
      vendas={vendas.map(v => ({
        id: v.id, cliente: v.cliente, email: v.email, whatsapp: v.whatsapp, programa: v.programa, vendedora: v.vendedora, data: iso(v.data)!,
        inicio: iso(v.inicio), duracao: v.duracao, combinados: v.combinados, passagem: v.passagem, passagemEm: v.passagemEm?.toISOString() ?? null, passagemPor: v.passagemPor,
        mentoradaId: v.mentoradaId, fase: v.mentorada?.pipelineFase?.nome ?? null, status: v.mentorada?.status ?? null,
      }))}
    />
  );
}
