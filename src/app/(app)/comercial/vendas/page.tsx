import { prisma } from "@/lib/prisma";
import { exigirPilar } from "@/lib/auth";
import { somarMes } from "@/lib/comercial";
import { equipeComercial } from "@/lib/comercial-servidor";
import { hojeISO } from "@/lib/dias-uteis";
import { pode } from "@/lib/permissoes";
import VendasCliente from "./VendasCliente";

export default async function VendasPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const usuario = await exigirPilar("comercial");
  const hoje = hojeISO();
  const q = (await searchParams).mes ?? "";
  const mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(q) ? q : hoje.slice(0, 7);
  const entre = (m: string) => ({ gte: new Date(`${m}-01`), lt: new Date(`${somarMes(m, 1)}-01`) });
  const [vendas, metas, equipe, anterior] = await Promise.all([
    prisma.venda.findMany({ where: { data: entre(mes) }, orderBy: [{ data: "desc" }, { createdAt: "desc" }] }),
    prisma.metaVenda.findMany({ where: { mes } }),
    equipeComercial(),
    prisma.venda.aggregate({ where: { data: entre(somarMes(mes, -1)), cancelada: false }, _sum: { valorCentavos: true }, _count: { _all: true } }),
  ]);
  return (
    <VendasCliente
      key={mes}
      eu={usuario.nome} mes={mes} hoje={hoje} equipe={equipe}
      gestora={pode(usuario, "equipe") && !usuario.trocarSenha}
      anterior={{ valor: anterior._sum.valorCentavos ?? 0, n: anterior._count._all }}
      metas={metas.map(m => ({ vendedora: m.vendedora, valor: m.valorCentavos, quantidade: m.quantidade }))}
      vendas={vendas.map(v => ({
        id: v.id, cliente: v.cliente, programa: v.programa, valor: v.valorCentavos, pagamento: v.pagamento, vendedora: v.vendedora,
        data: v.data.toISOString().slice(0, 10), origem: v.origem, cancelada: v.cancelada, motivo: v.motivoCancelamento, passagem: v.passagem, leadId: v.leadId, hubla: !!v.hublaFatura,
      }))}
    />
  );
}
