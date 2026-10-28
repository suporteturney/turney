import { prisma } from "@/lib/prisma";
import InsightsCliente from "./InsightsCliente";

export default async function InsightsPage() {
  const mentoradas = await prisma.mentorada.findMany({
    select: {
      id: true, nome: true, tipo: true, status: true, saude: true, disc: true, area: true, localizacao: true,
      origem: true, origemDetalhe: true, produtoAnterior: true, inicio: true, prazo: true, cancelamento: true,
      vagaData: true, vagaCargo: true, renovacaoStatus: true, updatedAt: true,
      etapas: { select: { nome: true, data: true, programa: true, titulo: true } },
      renovacoes: { select: { acao: true, destino: true, data: true, programaAnterior: true } },
      presencas: { select: { encontro: true, presente: true } },
      _count: { select: { acompanhamentos: true } },
    },
  });

  const iso = (d: Date | null) => d?.toISOString() ?? null;
  const atualizado = mentoradas.reduce<Date | null>((max, m) => (!max || m.updatedAt > max ? m.updatedAt : max), null);

  return (
    <InsightsCliente
      atualizadoEm={iso(atualizado)}
      base={mentoradas.map(({ _count, ...m }) => ({
        ...m,
        updatedAt: undefined,
        inicio: iso(m.inicio), prazo: iso(m.prazo), cancelamento: iso(m.cancelamento), vagaData: iso(m.vagaData),
        etapas: m.etapas.map(e => ({ ...e, data: iso(e.data) })),
        renovacoes: m.renovacoes.map(r => ({ ...r, data: r.data.toISOString() })),
        acompanhamentos: _count.acompanhamentos,
      }))}
    />
  );
}
