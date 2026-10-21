import { prisma } from "@/lib/prisma";
import AssiduidadeCliente from "./AssiduidadeCliente";

export default async function AssiduidadePage() {
  const mentorados = await prisma.mentorada.findMany({
    orderBy: { nome: "asc" },
    select: {
      id: true, nome: true, tipo: true, status: true, codigo: true,
      presencas: { select: { presente: true } },
    },
  });

  const data = mentorados.map(({ presencas, ...m }) => ({
    ...m,
    total: presencas.length,
    presentes: presencas.filter(p => p.presente).length,
  }));

  return <AssiduidadeCliente data={data} />;
}
