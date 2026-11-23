import { prisma } from "@/lib/prisma";
import { exigirPilar } from "@/lib/auth";
import { equipeComercial } from "@/lib/comercial-servidor";
import { hojeISO } from "@/lib/dias-uteis";
import { pode } from "@/lib/permissoes";
import FunilCliente from "./FunilCliente";

const DIAS_FECHADOS = 45; // Fechado e Perdido mostram só os movimentos recentes

export default async function FunilPage({ searchParams }: { searchParams: Promise<{ lead?: string; novo?: string }> }) {
  const usuario = await exigirPilar("comercial");
  const { lead = "", novo } = await searchParams;
  const hoje = hojeISO();
  const desde = new Date(Date.parse(hoje) - DIAS_FECHADOS * 86_400_000);
  const [etapas, leads, equipe] = await Promise.all([
    prisma.funilEtapa.findMany({ orderBy: { ordem: "asc" } }),
    prisma.lead.findMany({
      where: { OR: [{ etapa: { tipo: "aberta" } }, { etapaEm: { gte: desde } }] },
      orderBy: [{ proximoPassoEm: { sort: "asc", nulls: "last" } }, { etapaEm: "desc" }],
    }),
    equipeComercial(),
  ]);
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
      etapas={etapas.map(e => ({ id: e.id, nome: e.nome, tipo: e.tipo }))}
      leads={leads.map(l => ({
        id: l.id, nome: l.nome, whatsapp: l.whatsapp, email: l.email, instagram: l.instagram, origem: l.origem, programa: l.programa,
        valor: l.valorCentavos, responsavel: l.responsavel, etapaId: l.etapaId, etapaEm: l.etapaEm.toISOString(),
        proximoPasso: l.proximoPasso, proximoPassoEm: iso(l.proximoPassoEm), motivoPerda: l.motivoPerda,
      }))}
    />
  );
}
