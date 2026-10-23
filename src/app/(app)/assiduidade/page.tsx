import { prisma } from "@/lib/prisma";
import { contaNaAssiduidade } from "@/lib/jornada";
import AssiduidadeCliente from "./AssiduidadeCliente";

export default async function AssiduidadePage() {
  const mentorados = await prisma.mentorada.findMany({
    orderBy: { nome: "asc" },
    select: {
      id: true, nome: true, tipo: true, status: true, codigo: true,
      presencas: { select: { presente: true, encontro: true } },
    },
  });

  const data = mentorados.map(({ presencas, ...m }) => {
    const obrigatorias = presencas.filter(p => contaNaAssiduidade(m.tipo, p.encontro));
    return {
      ...m,
      total: obrigatorias.length,
      presentes: obrigatorias.filter(p => p.presente).length,
    };
  });

  return <AssiduidadeCliente data={data} />;
}
