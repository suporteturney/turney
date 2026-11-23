import "server-only";
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/lib/auth";
import { callsEntre } from "@/lib/comercial-calls";
import { somarMes } from "@/lib/comercial";
import { hojeISO } from "@/lib/dias-uteis";

const DIA = 86_400_000;

// O que o Comercial precisa ver hoje. `so` limita aos leads e calls da própria pessoa (Meu painel).
export async function resumoComercial(usuario: UsuarioSessao, so: boolean) {
  const hoje = hojeISO();
  const mes = hoje.slice(0, 7);
  const inicioDia = new Date(`${hoje}T00:00:00-03:00`);
  const [passos, semPasso, abertos, valorAberto, vendas, metas, pendentes, { calls }] = await Promise.all([
    prisma.lead.findMany({
      where: { etapa: { tipo: "aberta" }, proximoPassoEm: { lte: new Date(hoje) }, ...(so ? { responsavel: usuario.nome } : {}) },
      orderBy: { proximoPassoEm: "asc" }, take: 60,
      select: { id: true, nome: true, whatsapp: true, programa: true, responsavel: true, proximoPasso: true, proximoPassoEm: true, etapa: { select: { nome: true } } },
    }),
    prisma.lead.count({ where: { etapa: { tipo: "aberta" }, proximoPassoEm: null, ...(so ? { responsavel: usuario.nome } : {}) } }),
    prisma.lead.count({ where: { etapa: { tipo: "aberta" } } }),
    prisma.lead.aggregate({ where: { etapa: { tipo: "aberta" } }, _sum: { valorCentavos: true } }),
    prisma.venda.findMany({ where: { cancelada: false, data: { gte: new Date(`${mes}-01`), lt: new Date(`${somarMes(mes, 1)}-01`) } }, select: { valorCentavos: true, vendedora: true } }),
    prisma.metaVenda.findMany({ where: { mes, vendedora: { in: ["", usuario.nome] } } }),
    prisma.venda.count({ where: { cancelada: false, passagem: "pendente" } }),
    callsEntre(inicioDia, new Date(inicioDia.getTime() + DIA), usuario),
  ]);
  const soma = (l: { valorCentavos: number }[]) => l.reduce((n, v) => n + v.valorCentavos, 0);
  const minhas = vendas.filter(v => v.vendedora === usuario.nome);
  return {
    hoje, mes, semPasso, abertos, pendentes,
    emJogo: valorAberto._sum.valorCentavos ?? 0,
    vendido: soma(vendas), nVendas: vendas.length, meta: metas.find(m => m.vendedora === "")?.valorCentavos ?? null,
    meuVendido: soma(minhas), minhasVendas: minhas.length, minhaMeta: metas.find(m => m.vendedora === usuario.nome)?.valorCentavos ?? null,
    passos: passos.map(p => ({ ...p, etapa: p.etapa.nome, proximoPassoEm: p.proximoPassoEm!.toISOString().slice(0, 10) })),
    calls: calls.filter(c => !so || c.responsavel === usuario.nome || !c.responsavel),
  };
}
export type ResumoComercial = Awaited<ReturnType<typeof resumoComercial>>;
