import { prisma } from "@/lib/prisma";
import DashboardCliente from "./DashboardCliente";

export default async function DashboardPage() {
  const mentorados = await prisma.mentorada.findMany({
    orderBy: { nome: "asc" },
    select: {
      id: true,
      codigo: true,
      nome: true,
      tipo: true,
      status: true,
      saude: true,
      inicio: true,
      prazo: true,
      duracao: true,
      resp: true,
      obs: true,
      negociacao: true,
    },
  });

  const serialized = mentorados.map(m => ({
    ...m,
    inicio: m.inicio?.toISOString() ?? null,
    prazo: m.prazo?.toISOString() ?? null,
  }));

  return <DashboardCliente data={serialized} />;
}
