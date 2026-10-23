import { prisma } from "@/lib/prisma";
import JornadaCliente from "./JornadaCliente";

export default async function JornadaPage() {
  const mentorados = await prisma.mentorada.findMany({
    orderBy: { nome: "asc" },
    select: {
      id: true, nome: true, tipo: true, status: true, inicio: true, codigo: true, vagaData: true,
      etapas: { select: { nome: true, data: true, programa: true } },
      renovacoes: { select: { acao: true, destino: true, data: true } },
    },
  });

  const data = mentorados.map(m => ({
    ...m,
    inicio: m.inicio?.toISOString() ?? null,
    vagaData: m.vagaData?.toISOString() ?? null,
    etapas: m.etapas.map(e => ({ id: `${e.programa}:${e.nome}`, nome: e.nome, programa: e.programa, data: e.data?.toISOString() ?? null })),
    renovacoes: m.renovacoes.map(r => ({ ...r, data: r.data.toISOString() })),
  }));

  return <JornadaCliente data={data} />;
}
