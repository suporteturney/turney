import "server-only";
import { prisma } from "@/lib/prisma";
import { registrarAtividade } from "@/lib/atividade";
import { recalcularSaude } from "@/lib/saude-servidor";

// Status que mudam sozinhos pelas datas (Churn e Encerrado nunca mudam sozinhos):
// - Congelado volta para Ativo no dia seguinte à data final do congelamento;
// - Ativo / Em Andamento vira Em Renovação quando faltam 30 dias ou menos para o encerramento;
// - Ativo / Em Andamento / Em Renovação vira Encerrado no dia seguinte ao encerramento.

const SISTEMA = { id: null, nome: "Status automático" };
const DIA = 86_400_000;
const INTERVALO = 5 * 60_000;
let ultimaVez = 0;

// Meia-noite (UTC) do dia de hoje no horário de Brasília — as datas do cadastro são gravadas assim.
function hojeBrasil() {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  return new Date(`${ymd}T00:00:00Z`);
}

// Sem `ids`, confere todas as mentoradas (no máximo a cada 5 minutos por servidor).
export async function atualizarStatusAutomatico(ids?: string[]) {
  if (!ids) {
    if (Date.now() - ultimaVez < INTERVALO) return;
    ultimaVez = Date.now();
  }
  const filtro = ids ? { id: { in: ids } } : {};
  const hoje = hojeBrasil();
  const limiteRenovacao = new Date(hoje.getTime() + 31 * DIA);

  try {
    const descongelar = await prisma.mentorada.findMany({
      where: { ...filtro, status: "Congelado", congelamentoAte: { lt: hoje } },
      select: { id: true, nome: true },
    });
    await mudar(descongelar, "Ativo", "Fim do congelamento");

    const encerrar = await prisma.mentorada.findMany({
      where: { ...filtro, status: { in: ["Ativo", "Em Andamento", "Em Renovação"] }, prazo: { lt: hoje } },
      select: { id: true, nome: true },
    });
    await mudar(encerrar, "Encerrado", "Ciclo terminou sem renovação");

    const renovar = await prisma.mentorada.findMany({
      where: { ...filtro, status: { in: ["Ativo", "Em Andamento"] }, prazo: { gte: hoje, lt: limiteRenovacao } },
      select: { id: true, nome: true },
    });
    await mudar(renovar, "Em Renovação", "Faltam 30 dias ou menos para o encerramento");

    if (descongelar.length) await recalcularSaude(descongelar.map(m => m.id));
  } catch (e) {
    console.error("Falha ao atualizar o status automático", e);
  }
}

async function mudar(lista: { id: string; nome: string }[], status: string, motivo: string) {
  if (!lista.length) return;
  await prisma.mentorada.updateMany({ where: { id: { in: lista.map(m => m.id) } }, data: { status } });
  for (const m of lista) {
    await registrarAtividade(SISTEMA, {
      acao: "editou", entidade: "mentorada", mentoradaId: m.id,
      resumo: `${m.nome} passou para ${status} (${motivo})`,
    });
  }
}
