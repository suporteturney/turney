import { prisma } from "@/lib/prisma";
import MentoradosCliente from "./MentoradosCliente";

export default async function MentoradosPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; status?: string; q?: string }>;
}) {
  const { tipo, status, q } = await searchParams;

  const where: Record<string, unknown> = {};
  if (tipo) where.tipo = tipo;
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { nome: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { codigo: { contains: q, mode: "insensitive" } },
    ];
  }

  const mentorados = await prisma.mentorada.findMany({
    where,
    orderBy: { nome: "asc" },
  });

  return <MentoradosCliente mentorados={mentorados} filtroTipo={tipo} />;
}
