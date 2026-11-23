import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { registrarAtividade } from "@/lib/atividade";
import { negar, podeOperar } from "@/lib/pipeline-servidor";
import { temPilar } from "@/lib/permissoes";
import { carregarManuais } from "@/lib/agenda-servidor";
import { chaveTitulo, TIPOS_DO_PILAR, TIPOS_MANUAIS, tipoFinal } from "@/lib/agenda-regras";

const NOME: Record<string, string> = { individual: "Individual", grupo: "Grupo", onboarding: "Onboarding", pessoal: "Pessoal", outro: "Outro", call: "Call de venda" };

// Trocar o tipo de um encontro à mão: só este (escopo "evento") ou todos com o mesmo nome ("titulo").
// tipo "auto" volta para a regra automática.
export async function POST(req: NextRequest) {
  const usuario = await exigirUsuario();
  const { eventoId, tipo, escopo } = await req.json();
  if (tipo !== "auto" && !TIPOS_MANUAIS.includes(tipo)) return NextResponse.json({ erro: "Tipo inválido." }, { status: 400 });
  if (escopo !== "evento" && escopo !== "titulo") return NextResponse.json({ erro: "Escolha se vale só para este encontro ou para todos." }, { status: 400 });
  const ev = await prisma.eventoAgenda.findUnique({ where: { id: String(eventoId) } });
  if (!ev) return NextResponse.json({ erro: "Encontro não encontrado. Atualize a página." }, { status: 404 });

  // Agenda do Comercial: quem é do Comercial. Agenda do Pós Venda: quem cuida da jornada ou do acompanhamento.
  const pode = ev.pilar === "comercial" ? temPilar(usuario, "comercial") : temPilar(usuario, "posvenda") && podeOperar(usuario);
  const negado = negar(usuario, pode, ["jornada", "acompanhamento"]);
  if (negado) return negado;
  if (tipo !== "auto" && !(TIPOS_DO_PILAR[ev.pilar] ?? []).includes(tipo)) {
    return NextResponse.json({ erro: "Esse tipo não vale para esta agenda." }, { status: 400 });
  }

  const chaveT = chaveTitulo(ev.titulo);
  // Encontros afetados (as janelas guardadas são pequenas, então dá para filtrar aqui).
  const mesmos = (await prisma.eventoAgenda.findMany({ where: { pilar: ev.pilar }, select: { id: true, uid: true, titulo: true, convidados: true, pilar: true } }))
    .filter(e => chaveTitulo(e.titulo) === chaveT);
  const afetados = escopo === "evento" ? mesmos.filter(e => e.uid === ev.uid) : mesmos;

  if (tipo === "auto") {
    await prisma.tipoEncontroManual.deleteMany({
      where: escopo === "evento" ? { escopo: "evento", chave: ev.uid } : { OR: [{ escopo: "titulo", chave: chaveT }, { escopo: "evento", chave: { in: mesmos.map(e => e.uid) } }] },
    });
  } else {
    if (escopo === "titulo") {
      // "Todos": a escolha individual anterior desses encontros deixa de valer.
      await prisma.tipoEncontroManual.deleteMany({ where: { escopo: "evento", chave: { in: mesmos.map(e => e.uid) } } });
    }
    const chave = escopo === "evento" ? ev.uid : chaveT;
    await prisma.tipoEncontroManual.upsert({
      where: { escopo_chave: { escopo, chave } },
      update: { tipo, titulo: ev.titulo, criadaPor: usuario.nome },
      create: { escopo, chave, tipo, titulo: ev.titulo, criadaPor: usuario.nome },
    });
  }

  // Atualiza na hora o que já está guardado.
  const manuais = await carregarManuais();
  for (const e of afetados) {
    const novo = tipoFinal(e, e.convidados, manuais, e.pilar);
    await prisma.eventoAgenda.update({ where: { id: e.id }, data: { tipo: novo, ...(novo === "pessoal" || novo === "grupo" ? { mentoradaId: null } : {}) } });
  }

  await registrarAtividade(usuario, {
    acao: "editou", entidade: "agenda",
    resumo: tipo === "auto"
      ? `Voltou "${ev.titulo}" para o tipo automático${escopo === "titulo" ? " (todos com esse nome)" : ""}`
      : `Marcou "${ev.titulo}" como ${NOME[tipo]}${escopo === "titulo" ? " (todos com esse nome)" : " (só este encontro)"}`,
  });
  return NextResponse.json({ ok: true, alterados: afetados.length });
}
