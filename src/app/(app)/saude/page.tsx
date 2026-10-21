import { prisma } from "@/lib/prisma";
import SaudeCliente from "./SaudeCliente";

export default async function SaudePage() {
  const mentorados = await prisma.mentorada.findMany({
    where: { status: { in: ["Ativo", "Em Andamento", "Em Renovação"] } },
    orderBy: { nome: "asc" },
    select: {
      id: true, nome: true, codigo: true, tipo: true, status: true, saude: true,
      saudeMotivo: true, saudeMotivoEm: true, inicio: true, prazo: true,
      etapas: { where: { nome: "onboarding" }, select: { data: true } },
      acompanhamentos: { orderBy: { data: "desc" }, take: 1, select: { data: true } },
      presencas: { select: { presente: true } },
    },
  });

  const data = mentorados.map(({ etapas, acompanhamentos, presencas, ...m }) => ({
    ...m,
    inicio: m.inicio?.toISOString() ?? null,
    prazo: m.prazo?.toISOString() ?? null,
    saudeMotivoEm: m.saudeMotivoEm?.toISOString() ?? null,
    onboarding: etapas[0]?.data?.toISOString() ?? null,
    ultimoAcomp: acompanhamentos[0]?.data.toISOString() ?? null,
    presTotal: presencas.length,
    presOk: presencas.filter(p => p.presente).length,
  }));

  return <SaudeCliente data={data} />;
}
