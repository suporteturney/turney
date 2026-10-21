import { prisma } from "@/lib/prisma";
import JornadaCliente from "./JornadaCliente";

export default async function JornadaPage() {
  const mentorados = await prisma.mentorada.findMany({
    orderBy: { nome: "asc" },
    select: {
      id: true, nome: true, tipo: true, status: true, inicio: true, codigo: true, vagaData: true,
      etapas: { select: { nome: true, data: true } },
    },
  });

  const data = mentorados.map(m => ({
    ...m,
    inicio: m.inicio?.toISOString() ?? null,
    vagaData: m.vagaData?.toISOString() ?? null,
    etapas: m.etapas.map(e => ({ id: e.nome, nome: e.nome, data: e.data?.toISOString() ?? null })),
  }));

  return <JornadaCliente data={data} />;
}
