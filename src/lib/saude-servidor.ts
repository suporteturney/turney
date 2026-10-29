import { prisma } from "@/lib/prisma";
import { ajusteVigente, calcularSaude, resumoSaude } from "@/lib/saude";

const ATIVOS = ["Ativo", "Em Renovação"];
const hojeISO = () => new Date().toISOString().slice(0, 10);
const iso = (d: Date | null) => (d ? d.toISOString() : null);

// Recalcula a saúde das mentoradas ativas (todas, ou só as `ids`) e grava o resultado.
// A saúde exibida passa a ser a calculada, exceto quando há ajuste manual ainda vigente.
export async function recalcularSaude(ids?: string[]) {
  const ms = await prisma.mentorada.findMany({
    where: { status: { in: ATIVOS }, ...(ids ? { id: { in: ids } } : {}) },
    select: {
      id: true, tipo: true, inicio: true, vagaData: true, saude: true, saudeAjusteEm: true,
      renovacoes: { select: { acao: true, destino: true, data: true } },
      etapas: { select: { nome: true, data: true, programa: true } },
      presencas: { select: { encontro: true, presente: true } },
      varreduraItens: {
        select: { banda: true, varredura: { select: { data: true } } },
        orderBy: { varredura: { data: "desc" } },
        take: 1,
      },
    },
  });

  const hoje = hojeISO();
  for (const m of ms) {
    const ultima = m.varreduraItens[0];
    const r = calcularSaude(
      {
        tipo: m.tipo,
        inicio: iso(m.inicio),
        vagaData: iso(m.vagaData),
        renovacoes: m.renovacoes.map(x => ({ ...x, data: x.data.toISOString() })),
        etapas: m.etapas.map(x => ({ ...x, data: iso(x.data) })),
        presencas: m.presencas,
        varredura: ultima ? { banda: ultima.banda, data: ultima.varredura.data.toISOString() } : null,
      },
      hoje,
    );
    const manual = ajusteVigente(iso(m.saudeAjusteEm), ultima ? ultima.varredura.data.toISOString() : null);
    const saude = manual ? m.saude : r.nivel ?? m.saude;

    await prisma.mentorada.update({
      where: { id: m.id },
      data: {
        saudeNota: r.nota,
        saudeCalculada: r.nivel,
        saudeDetalhe: { partes: r.partes, trava: r.trava, calculadoEm: hoje },
        saude,
        ...(manual ? {} : { saudeAjusteEm: null }),
      },
    });
    if (saude && saude !== m.saude) {
      await prisma.saudeRegistro.create({
        data: { mentoradaId: m.id, saude, motivo: resumoSaude(r), origem: "calculo" },
      });
    }
  }
  return ms.length;
}
