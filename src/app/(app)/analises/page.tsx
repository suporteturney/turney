import { prisma } from "@/lib/prisma";
import AnalisesCliente from "./AnalisesCliente";

export default async function AnalisesPage() {
  const [mentoradas, renovacoes, acompanhamentos, varreduras] = await Promise.all([
    prisma.mentorada.findMany({
      select: {
        id: true, nome: true, tipo: true, status: true, saude: true, inicio: true, prazo: true,
        cancelamento: true, vagaData: true, negociacao: true, renovacaoStatus: true,
        etapas: { select: { nome: true, data: true } },
      },
    }),
    prisma.renovacao.findMany({ select: { mentoradaId: true, acao: true, data: true } }),
    prisma.acompanhamento.findMany({ select: { mentoradaId: true, data: true, marco: true, marcoTitulo: true, varreduraId: true } }),
    prisma.varredura.findMany({
      orderBy: { data: "asc" },
      select: {
        id: true, data: true, programa: true, bom: true, ruim: true, invisivel: true, melhorias: true,
        itens: { select: { mentoradaId: true, nome: true, banda: true, tag: true, status: true, atencao: true, pendencias: true, retornos: true } },
      },
    }),
  ]);

  const iso = (d: Date | null) => d?.toISOString() ?? null;

  return (
    <AnalisesCliente
      mentoradas={mentoradas.map(m => ({
        ...m,
        inicio: iso(m.inicio), prazo: iso(m.prazo), cancelamento: iso(m.cancelamento), vagaData: iso(m.vagaData),
        etapas: m.etapas.map(e => ({ nome: e.nome, data: iso(e.data) })),
      }))}
      renovacoes={renovacoes.map(r => ({ ...r, data: r.data.toISOString() }))}
      acompanhamentos={acompanhamentos.map(a => ({ ...a, data: a.data.toISOString() }))}
      varreduras={varreduras.map(v => ({ ...v, data: v.data.toISOString() }))}
    />
  );
}
