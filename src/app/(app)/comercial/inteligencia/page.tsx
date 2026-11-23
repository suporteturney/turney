import { prisma } from "@/lib/prisma";
import { exigirPilar } from "@/lib/auth";
import { hojeISO } from "@/lib/dias-uteis";
import { inicioDasAplicacoes } from "@/lib/comercial-aplicacoes";
import { analisar, type Linha } from "@/lib/inteligencia";
import { FORM_HUB, FORM_PRE, type Resposta } from "@/lib/respondi";
import InteligenciaCliente from "./InteligenciaCliente";

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const DIA = 86_400_000;
const SEGMENTOS = ["quente", "morno", "frio", "comprou"] as const;

export default async function InteligenciaPage({ searchParams }: { searchParams: Promise<{ de?: string; ate?: string; form?: string; seg?: string }> }) {
  await exigirPilar("comercial");
  const q = await searchParams;
  const hoje = hojeISO();
  const valido = DATA.test(q.de ?? "") && DATA.test(q.ate ?? "") && q.de! <= q.ate! && !Number.isNaN(Date.parse(q.de!)) && !Number.isNaN(Date.parse(q.ate!));
  const de = valido ? q.de! : new Date(Date.parse(hoje) - 29 * DIA).toISOString().slice(0, 10);
  const ate = valido ? (q.ate! > hoje ? hoje : q.ate!) : hoje;
  const form = q.form === FORM_HUB || q.form === FORM_PRE ? q.form : "";
  const seg = (SEGMENTOS as readonly string[]).includes(q.seg ?? "") ? q.seg! : "";

  const [rs, inicio] = await Promise.all([
    prisma.respostaFormulario.findMany({
      where: { preenchidoEm: { gte: new Date(`${de}T00:00:00-03:00`), lte: new Date(`${ate}T23:59:59.999-03:00`) }, ...(form ? { formulario: form } : {}) },
      orderBy: [{ completa: "desc" }, { preenchidoEm: "desc" }],
      select: {
        leadId: true, formulario: true, completa: true, temperatura: true, preenchidoEm: true, respostas: true,
        lead: { select: { nome: true, vendas: { where: { cancelada: false }, select: { id: true }, take: 1 } } },
      },
    }),
    inicioDasAplicacoes(),
  ]);
  // Uma pessoa conta uma vez: vale o formulário terminado mais recente (ou o mais recente, se não terminou nenhum).
  const vistos = new Set<string>();
  const todas: Linha[] = [];
  for (const r of rs) {
    if (vistos.has(r.leadId)) continue;
    vistos.add(r.leadId);
    todas.push({
      leadId: r.leadId, nome: r.lead.nome, formulario: r.formulario, completa: r.completa, temperatura: r.temperatura,
      comprou: r.lead.vendas.length > 0, preenchidoEm: r.preenchidoEm, respostas: Array.isArray(r.respostas) ? (r.respostas as Resposta[]) : [],
    });
  }
  const linhas = seg === "comprou" ? todas.filter(l => l.comprou) : seg ? todas.filter(l => l.temperatura === seg) : todas;
  const resultado = analisar(linhas);
  return (
    <InteligenciaCliente
      r={resultado} hoje={hoje} inicio={inicio} de={de} ate={ate} form={form} seg={seg}
      totais={{ pessoas: todas.length, quente: todas.filter(l => l.temperatura === "quente").length, morno: todas.filter(l => l.temperatura === "morno").length, frio: todas.filter(l => l.temperatura === "frio").length, comprou: todas.filter(l => l.comprou).length }}
    />
  );
}
