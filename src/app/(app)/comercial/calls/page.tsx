import { prisma } from "@/lib/prisma";
import { exigirPilar } from "@/lib/auth";
import { callsEntre } from "@/lib/comercial-calls";
import { equipeComercial } from "@/lib/comercial-servidor";
import { hojeISO } from "@/lib/dias-uteis";
import { pode } from "@/lib/permissoes";
import CallsCliente from "./CallsCliente";

const DIA = 86_400_000;

export default async function CallsPage({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  const usuario = await exigirPilar("comercial");
  const hoje = hojeISO();
  const q = (await searchParams).semana ?? "";
  const base = /^\d{4}-\d{2}-\d{2}$/.test(q) && !Number.isNaN(Date.parse(q)) ? q : hoje;
  const segunda = new Date(Date.parse(base) - ((new Date(`${base}T12:00:00Z`).getUTCDay() + 6) % 7) * DIA).toISOString().slice(0, 10);
  const de = new Date(`${segunda}T00:00:00-03:00`);
  const [{ calls, semTipo }, leads, equipe, ligadas] = await Promise.all([
    callsEntre(de, new Date(de.getTime() + 7 * DIA), usuario),
    prisma.lead.findMany({ where: { etapa: { tipo: "aberta" } }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    equipeComercial(),
    prisma.agendaFonte.count({ where: { ativo: true, pilar: "comercial" } }),
  ]);
  return (
    <CallsCliente
      key={segunda} eu={usuario.nome} hoje={hoje} agora={new Date().getTime()} segunda={segunda} calls={calls} semTipo={semTipo} leads={leads} equipe={equipe}
      agendaLigada={ligadas > 0} gestora={pode(usuario, "equipe")}
    />
  );
}
