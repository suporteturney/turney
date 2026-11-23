import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { pode } from "@/lib/permissoes";
import { registrarAtividade } from "@/lib/atividade";
import { negar } from "@/lib/pipeline-servidor";
import { baixarAgenda, sincronizarAgendas } from "@/lib/agenda-servidor";

export const maxDuration = 60;
const DIA = 86_400_000;

// Cadastrar uma agenda do Google: testa o link antes de guardar e já lê os encontros.
export async function POST(req: NextRequest) {
  const usuario = await exigirUsuario();
  const negado = negar(usuario, pode(usuario, "equipe"), ["equipe"]);
  if (negado) return negado;
  const body = await req.json();
  const nome = typeof body.nome === "string" ? body.nome.trim().slice(0, 80) : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 120) : "";
  const url = typeof body.url === "string" ? body.url.trim().replace(/^webcal:\/\//i, "https://") : "";
  const pilar = body.pilar === "comercial" ? "comercial" : "posvenda";
  if (!nome) return NextResponse.json({ erro: "Escreva de quem é a agenda (ex.: Amanda Dutra)." }, { status: 400 });
  if (/calendar\/embed|calendar\/u\/\d|calendar\/r\b/i.test(url)) {
    return NextResponse.json({ erro: "Esse é o link de visualização. Precisa ser o “Endereço secreto no formato iCal” (termina em .ics)." }, { status: 400 });
  }
  if (!/^https:\/\/\S+$/i.test(url)) return NextResponse.json({ erro: "Cole o link completo, começando com https://" }, { status: 400 });
  if (await prisma.agendaFonte.findFirst({ where: { nome: { equals: nome, mode: "insensitive" } } })) {
    return NextResponse.json({ erro: `Já existe uma agenda com o nome “${nome}”. Use outro nome (ex.: “${nome} – Encontros”).` }, { status: 400 });
  }

  let total: number;
  try {
    const eventos = await baixarAgenda(url, new Date(Date.now() - 21 * DIA), new Date(Date.now() + 56 * DIA));
    total = eventos.length;
  } catch (e) {
    return NextResponse.json({ erro: `Não deu certo: ${(e as Error).message}.` }, { status: 400 });
  }

  const fonte = await prisma.agendaFonte.create({ data: { nome, email: email || null, url, pilar, criadaPor: usuario.nome } });
  await registrarAtividade(usuario, { acao: "criou", entidade: "agenda", resumo: `Ligou a agenda de ${nome} ao painel (${total} encontros encontrados)` });
  const r = await sincronizarAgendas({ forcar: true });
  return NextResponse.json({ id: fonte.id, encontrados: total, aplicados: r.aplicados.length });
}
