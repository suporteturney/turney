import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirUsuario, semPermissao } from "@/lib/auth";
import { registrarAtividade } from "@/lib/atividade";
import { recalcularSaude } from "@/lib/saude-servidor";
import { encontrosGrupo } from "@/lib/jornada";
import { chaveDoEncontro, ehTurma2, programaDoEncontro, turmaDoEncontro } from "@/lib/agenda-regras";

// Presença das mentoradas num encontro em grupo da agenda.
// Grava no mesmo lugar da aba "Presença nos Encontros": chave "AAAA-MM|encontro|AAAA-MM-DD".

const ATIVOS = ["Ativo", "Em Andamento", "Em Renovação", "Congelado"];
const diaBrasil = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
const OPCOES = [
  { key: "hotseat", label: "Hotseat" },
  { key: "tutoria", label: "Tutoria" },
  { key: "masterclassDay", label: "Masterclass" },
  { key: "codigoAprovacao", label: "O Código da Aprovação" },
  { key: "evolutionDay", label: "Evolution Day" },
];

async function contexto(eventoId: string, chavePedida: string | null) {
  const ev = await prisma.eventoAgenda.findUnique({ where: { id: eventoId } });
  if (!ev) return null;
  const chave = chavePedida && OPCOES.some(o => o.key === chavePedida) ? chavePedida : chaveDoEncontro(ev.titulo);
  const data = diaBrasil(ev.inicio);
  return { ev, chave, data, presencaKey: chave ? `${data.slice(0, 7)}|${chave}|${data}` : null };
}

export async function GET(req: NextRequest) {
  await exigirUsuario();
  const q = req.nextUrl.searchParams;
  const c = await contexto(q.get("eventoId") ?? "", q.get("chave"));
  if (!c) return NextResponse.json({ erro: "Encontro não encontrado. Atualize a página." }, { status: 404 });
  if (!c.chave || !c.presencaKey) return NextResponse.json({ chave: null, opcoes: OPCOES, candidatos: [] });

  const programa = programaDoEncontro(c.ev.titulo, c.ev.agenda);
  const turma = turmaDoEncontro(c.ev.titulo, c.ev.agenda);
  const lista = await prisma.mentorada.findMany({
    where: { status: { in: ATIVOS } },
    orderBy: { nome: "asc" },
    select: {
      id: true, nome: true, tipo: true, status: true, turma: true, inicio: true,
      presencas: { where: { encontro: c.presencaKey }, select: { presente: true } },
    },
  });
  const doPrograma = lista.filter(m => encontrosGrupo(m.tipo).some(e => e.key === c.chave) && (!programa || m.tipo.startsWith(programa)));
  // Congeladas e quem entrou depois do encontro não levam falta (e não aparecem, a não ser que já tenham registro).
  const fora = (m: (typeof lista)[number]) => m.status === "Congelado" || (!!m.inicio && m.inicio.toISOString().slice(0, 10) > c.data);
  const candidatos = doPrograma
    .filter(m => !fora(m) || m.presencas.length)
    .map(m => ({
      id: m.id, nome: m.nome, tipo: m.tipo, presente: m.presencas[0]?.presente ?? null,
      // Encontro do Atlas: só a turma certa leva falta automática.
      daTurma: !fora(m) && (m.tipo !== "Atlas" || !turma || (turma === "Atlas 2.0") === ehTurma2(m.turma)),
    }));
  const excluidas = {
    congeladas: doPrograma.filter(m => m.status === "Congelado").length,
    depois: doPrograma.filter(m => m.status !== "Congelado" && fora(m)).length,
  };
  // Regra por programa (ex.: Masterclass é opcional no Atlas e obrigatória no Nexus).
  const regras: { programa: string; opcional: boolean }[] = [];
  for (const m of candidatos) {
    const prog = /^Nexus\b/.test(m.tipo) ? "Nexus" : m.tipo;
    if (regras.some(r => r.programa === prog)) continue;
    regras.push({ programa: prog, opcional: encontrosGrupo(m.tipo).find(e => e.key === c.chave)?.opcional === true });
  }
  return NextResponse.json({ chave: c.chave, opcoes: OPCOES, programa, turma, regras, data: c.data, candidatos, excluidas });
}

export async function POST(req: NextRequest) {
  const usuario = await exigirUsuario();
  const negado = semPermissao(usuario, "presencas");
  if (negado) return negado;
  const { eventoId, chave, marcacoes } = await req.json();
  const c = await contexto(String(eventoId), typeof chave === "string" ? chave : null);
  if (!c) return NextResponse.json({ erro: "Encontro não encontrado. Atualize a página." }, { status: 404 });
  if (!c.presencaKey) return NextResponse.json({ erro: "Escolha qual encontro é este (Hotseat, Tutoria…)." }, { status: 400 });
  if (!marcacoes || typeof marcacoes !== "object") return NextResponse.json({ erro: "Nada para salvar." }, { status: 400 });

  const ids: string[] = [];
  let presentes = 0, faltas = 0, limpos = 0;
  for (const [mentoradaId, v] of Object.entries(marcacoes as Record<string, boolean | null>)) {
    ids.push(mentoradaId);
    if (v === null) {
      await prisma.presenca.deleteMany({ where: { mentoradaId, encontro: c.presencaKey } });
      limpos++;
    } else {
      await prisma.presenca.upsert({
        where: { mentoradaId_encontro: { mentoradaId, encontro: c.presencaKey } },
        update: { presente: !!v, data: new Date(c.data) },
        create: { mentoradaId, encontro: c.presencaKey, presente: !!v, data: new Date(c.data) },
      });
      if (v) presentes++; else faltas++;
    }
  }
  if (ids.length) await recalcularSaude(ids);
  const nome = OPCOES.find(o => o.key === c.chave)?.label ?? c.chave;
  await registrarAtividade(usuario, {
    acao: "editou", entidade: "presenca",
    resumo: `Registrou presença de ${c.data.split("-").reverse().join("/")} (${nome}, pela agenda): ${presentes} presentes, ${faltas} faltas${limpos ? `, ${limpos} desmarcadas` : ""}`,
  });
  return NextResponse.json({ ok: true, presentes, faltas });
}
