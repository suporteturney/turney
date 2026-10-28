import { prisma } from "@/lib/prisma";
import { contaNaAssiduidade, inicioCiclo } from "@/lib/jornada";
import SaudeCliente from "./SaudeCliente";

export default async function SaudePage() {
  const mentorados = await prisma.mentorada.findMany({
    orderBy: { nome: "asc" },
    select: {
      id: true, nome: true, codigo: true, tipo: true, status: true, saude: true,
      saudeMotivo: true, saudeMotivoEm: true, inicio: true, prazo: true, cancelamento: true,
      saudeRegistros: { orderBy: { data: "asc" }, select: { saude: true, data: true, motivo: true } },
      etapas: { where: { nome: "onboarding" }, select: { data: true, programa: true } },
      renovacoes: { select: { acao: true, destino: true, data: true } },
      acompanhamentos: { orderBy: { data: "desc" }, take: 1, select: { data: true } },
      presencas: { select: { presente: true, encontro: true } },
    },
  });

  const data = mentorados.map(({ etapas, acompanhamentos, presencas, renovacoes, saudeRegistros, ...m }) => ({
    ...m,
    inicio: m.inicio?.toISOString() ?? null,
    prazo: m.prazo?.toISOString() ?? null,
    cancelamento: m.cancelamento?.toISOString() ?? null,
    registros: saudeRegistros.map(r => ({ ...r, data: r.data.toISOString() })),
    saudeMotivoEm: m.saudeMotivoEm?.toISOString() ?? null,
    onboarding: etapas.find(e => !e.programa || e.programa === m.tipo)?.data?.toISOString() ?? null,
    inicioCiclo: inicioCiclo({ inicio: m.inicio?.toISOString() ?? null, tipo: m.tipo, renovacoes: renovacoes.map(r => ({ ...r, data: r.data.toISOString() })) }),
    ultimoAcomp: acompanhamentos[0]?.data.toISOString() ?? null,
    presTotal: presencas.filter(p => contaNaAssiduidade(m.tipo, p.encontro)).length,
    presOk: presencas.filter(p => p.presente && contaNaAssiduidade(m.tipo, p.encontro)).length,
  }));

  return <SaudeCliente data={data} />;
}
