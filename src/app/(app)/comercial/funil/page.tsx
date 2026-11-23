import { prisma } from "@/lib/prisma";
import { exigirPilar } from "@/lib/auth";
import { equipeComercial } from "@/lib/comercial-servidor";
import { hojeISO } from "@/lib/dias-uteis";
import { pode } from "@/lib/permissoes";
import FunilCliente from "./FunilCliente";

const DIAS_FECHADOS = 45; // Fechado e Perdido mostram só os movimentos recentes

export default async function FunilPage({ searchParams }: { searchParams: Promise<{ lead?: string; novo?: string; de?: string; ate?: string; temp?: string }> }) {
  const usuario = await exigirPilar("comercial");
  const { lead = "", novo, de = "", ate = "", temp = "" } = await searchParams;
  const hoje = hojeISO();
  const desde = new Date(Date.parse(hoje) - DIAS_FECHADOS * 86_400_000);
  // Período escolhido no calendário: traz também os fechados e perdidos preenchidos nele.
  const DATA = /^\d{4}-\d{2}-\d{2}$/;
  const periodo = DATA.test(de) && DATA.test(ate) && de <= ate ? { de, ate } : null;
  const [etapas, leads, equipe] = await Promise.all([
    prisma.funilEtapa.findMany({ orderBy: { ordem: "asc" } }),
    prisma.lead.findMany({
      where: { OR: [{ etapa: { tipo: "aberta" } }, { etapaEm: { gte: desde } },
        ...(periodo ? [{ preenchidoEm: { gte: new Date(`${periodo.de}T00:00:00-03:00`), lte: new Date(`${periodo.ate}T23:59:59.999-03:00`) } }] : [])] },
      orderBy: [{ proximoPassoEm: { sort: "asc", nulls: "last" } }, { etapaEm: "desc" }],
      include: { respostas: { orderBy: { completa: "desc" }, take: 1, select: { completa: true } } },
    }),
    equipeComercial(),
  ]);
  const diaHora = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
  const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
  return (
    <FunilCliente
      key={lead}
      eu={usuario.nome}
      hoje={hoje}
      equipe={equipe}
      gestora={pode(usuario, "equipe") && !usuario.trocarSenha}
      leadInicial={lead || null}
      novoInicial={novo === "1"}
      periodoInicial={periodo}
      tempInicial={["quente", "morno", "frio"].includes(temp) ? temp : ""}
      etapas={etapas.map(e => ({ id: e.id, nome: e.nome, tipo: e.tipo }))}
      leads={leads.map(l => ({
        id: l.id, nome: l.nome, whatsapp: l.whatsapp, email: l.email, instagram: l.instagram, origem: l.origem, programa: l.programa,
        valor: l.valorCentavos, responsavel: l.responsavel, etapaId: l.etapaId, etapaEm: l.etapaEm.toISOString(),
        proximoPasso: l.proximoPasso, proximoPassoEm: iso(l.proximoPassoEm), motivoPerda: l.motivoPerda,
        formularios: l.formularios, preenchido: l.preenchidoEm ? diaHora.format(l.preenchidoEm) : null, temperatura: l.temperatura, pontuacao: l.pontuacao,
        incompleto: l.respostas.length > 0 && !l.respostas[0].completa,
      }))}
    />
  );
}
