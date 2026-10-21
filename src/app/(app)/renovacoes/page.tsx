import { prisma } from "@/lib/prisma";
import RenovacoesCliente from "./RenovacoesCliente";

export default async function RenovacoesPage() {
  const mentorados = await prisma.mentorada.findMany({
    where: { status: { in: ["Ativo", "Em Renovação", "Em Andamento"] }, prazo: { not: null } },
    orderBy: { prazo: "asc" },
    select: {
      id: true, nome: true, codigo: true, tipo: true, status: true, saude: true,
      inicio: true, prazo: true, negociacao: true, negociacaoEm: true, renovacaoStatus: true, duracao: true,
    },
  });

  const data = mentorados.map(m => ({
    ...m,
    inicio: m.inicio?.toISOString() ?? null,
    prazo: m.prazo?.toISOString() ?? null,
    negociacaoEm: m.negociacaoEm?.toISOString() ?? null,
  }));

  return <RenovacoesCliente data={data} />;
}
