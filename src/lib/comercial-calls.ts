import "server-only";
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/lib/auth";
import { casaNome } from "@/lib/nomes-equipe";

export type CallTela = {
  id: string | null; eventoId: string | null; titulo: string; inicio: string; link: string | null; responsavel: string | null;
  resultado: string | null; obs: string | null; lead: { id: string; nome: string } | null; daAgenda: boolean;
};

// Calls entre duas datas: as da agenda do Google (agendas do Comercial) e as registradas à mão.
// `semTipo`: compromissos que o sistema não reconheceu como call — só os da própria agenda (ou todos, para a administradora).
export async function callsEntre(de: Date, ate: Date, usuario: UsuarioSessao) {
  const [eventos, salvas] = await Promise.all([
    prisma.eventoAgenda.findMany({ where: { pilar: "comercial", inicio: { gte: de, lt: ate } }, orderBy: { inicio: "asc" } }),
    prisma.call.findMany({ where: { inicio: { gte: de, lt: ate } }, include: { lead: { select: { id: true, nome: true } } } }),
  ]);
  const porChave = new Map(salvas.filter(s => s.eventoChave).map(s => [s.eventoChave!, s]));
  const usadas = new Set<string>();
  const vistos = new Set<string>(); // a mesma call na agenda de duas pessoas aparece uma vez
  const calls: CallTela[] = [];
  for (const e of eventos) {
    const salva = porChave.get(`${e.agenda}|${e.uid}`);
    if (e.tipo !== "call") { if (salva) usadas.add(salva.id); continue; }
    const mesma = `${e.uid.split("|")[0]}|${e.inicio.getTime()}`;
    if (vistos.has(mesma)) { if (salva) usadas.add(salva.id); continue; }
    vistos.add(mesma);
    if (salva) usadas.add(salva.id);
    calls.push({
      id: salva?.id ?? null, eventoId: e.id, titulo: e.titulo, inicio: e.inicio.toISOString(), link: e.link, responsavel: e.agenda,
      resultado: salva?.resultado ?? null, obs: salva?.obs ?? null, lead: salva?.lead ?? null, daAgenda: true,
    });
  }
  for (const s of salvas) {
    if (usadas.has(s.id)) continue;
    calls.push({
      id: s.id, eventoId: null, titulo: s.titulo, inicio: s.inicio.toISOString(), link: s.link, responsavel: s.responsavel,
      resultado: s.resultado, obs: s.obs, lead: s.lead, daAgenda: !!s.eventoChave,
    });
  }
  calls.sort((a, b) => a.inicio.localeCompare(b.inicio));
  const semTipo = eventos
    .filter(e => e.tipo === "outro" && !/^(busy|ocupad[oa])$/i.test(e.titulo.trim()) && (usuario.papel === "admin" || casaNome(usuario.nome, e.agenda)))
    .map(e => ({ id: e.id, titulo: e.titulo, inicio: e.inicio.toISOString(), agenda: e.agenda }));
  return { calls, semTipo };
}
