import { prisma } from "@/lib/prisma";
import DashboardCliente from "./DashboardCliente";

export default async function DashboardPage() {
  const [mentorados, renovacoes] = await Promise.all([
    prisma.mentorada.findMany({
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
        negociacaoEm: true,
        renovacaoStatus: true,
        saudeMotivo: true,
        vagaData: true,
        vagaCargo: true,
        vagaEmpresa: true,
      },
    }),
    prisma.renovacao.findMany({ select: { mentoradaId: true, acao: true, data: true } }),
  ]);

  const emRisco = mentorados.filter(m => m.saude === "Risco").map(m => m.id);
  const sinaisVarredura = emRisco.length
    ? await prisma.varreduraItem.findMany({
        where: { mentoradaId: { in: emRisco } },
        orderBy: { varredura: { data: "desc" } },
        select: { mentoradaId: true, tag: true, status: true },
      })
    : [];
  const motivoVarredura = new Map<string, string>();
  for (const s of sinaisVarredura) {
    if (s.mentoradaId && !motivoVarredura.has(s.mentoradaId)) {
      const t = s.tag ?? s.status;
      if (t) motivoVarredura.set(s.mentoradaId, t);
    }
  }

  const serialized = mentorados.map(m => ({
    ...m,
    inicio: m.inicio?.toISOString() ?? null,
    prazo: m.prazo?.toISOString() ?? null,
    vagaData: m.vagaData?.toISOString() ?? null,
    negociacaoEm: m.negociacaoEm?.toISOString() ?? null,
    motivoVarredura: motivoVarredura.get(m.id) ?? null,
  }));
  const renovs = renovacoes.map(r => ({ ...r, data: r.data.toISOString() }));

  return <DashboardCliente data={serialized} renovacoes={renovs} />;
}
