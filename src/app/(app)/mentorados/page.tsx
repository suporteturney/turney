import { prisma } from "@/lib/prisma";
import { atualizarStatusAutomatico } from "@/lib/status-automatico";
import MentoradosCliente from "./MentoradosCliente";

export default async function MentoradosPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; status?: string; q?: string }>;
}) {
  await atualizarStatusAutomatico();
  const { tipo, status, q } = await searchParams;

  const mentorados = await prisma.mentorada.findMany({
    orderBy: { nome: "asc" },
  });

  return (
    <MentoradosCliente
      key={`${tipo ?? ""}|${status ?? ""}|${q ?? ""}`}
      mentorados={mentorados}
      tipoInicial={tipo ?? ""}
      statusInicial={status ?? ""}
      buscaInicial={q ?? ""}
    />
  );
}
