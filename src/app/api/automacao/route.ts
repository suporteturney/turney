import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { Mentorada } from "@/lib/generated/prisma";
import { prisma } from "@/lib/prisma";
import { diferencas, registrarAtividade } from "@/lib/atividade";
import { proximoCodigo } from "@/lib/codigo";
import { etapaFields, nomeEtapa } from "@/lib/jornada";
import { recalcularSaude } from "@/lib/saude-servidor";
import { whatsappComDDI } from "@/lib/whatsapp";

// Porta de entrada do Make (sem login). Protegida pela chave AUTOMACAO_CHAVE, que o Make
// manda no cabeçalho "x-chave-automacao". O guia de uso está em docs/automacao-make.md.

const MAKE = { id: null, nome: "Automação (Make)" };
const STATUS_ATIVOS = ["Ativo", "Em Andamento", "Em Renovação"];
const DIA = 86_400_000;

function chaveInvalida(req: NextRequest) {
  const esperada = process.env.AUTOMACAO_CHAVE;
  if (!esperada) {
    return NextResponse.json({ erro: "Automação desligada: falta a variável AUTOMACAO_CHAVE na Vercel." }, { status: 503 });
  }
  const recebida = Buffer.from(req.headers.get("x-chave-automacao") ?? "");
  const certa = Buffer.from(esperada);
  if (recebida.length !== certa.length || !timingSafeEqual(recebida, certa)) {
    return NextResponse.json({ erro: "Chave da automação inválida." }, { status: 401 });
  }
  return null;
}

const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const data = (v: unknown) => {
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

function resumo(m: Mentorada) {
  return {
    id: m.id, codigo: m.codigo, nome: m.nome, email: m.email,
    whatsapp: m.whatsapp, whatsappDDI: whatsappComDDI(m.whatsapp),
    tipo: m.tipo, status: m.status, tutora: m.tutora, resp: m.resp,
    drive: m.drive, asana: m.asana, inicio: m.inicio, prazo: m.prazo,
    jornadaEtapa: m.jornadaEtapa, jornadaEtapaEm: m.jornadaEtapaEm,
    diasNaEtapa: m.jornadaEtapaEm ? Math.floor((Date.now() - m.jornadaEtapaEm.getTime()) / DIA) : null,
    saude: m.saude, saudeNota: m.saudeNota,
  };
}

// Acha a mentorada por id, código, e-mail ou WhatsApp (nessa ordem).
async function acharMentorada(d: Record<string, unknown>) {
  const id = texto(d.id), codigo = texto(d.codigo), email = texto(d.email), whats = whatsappComDDI(texto(d.whatsapp));
  if (id) return prisma.mentorada.findUnique({ where: { id } });
  if (codigo) return prisma.mentorada.findUnique({ where: { codigo } });
  if (email) {
    return prisma.mentorada.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      orderBy: { createdAt: "desc" },
    });
  }
  if (whats) {
    // O WhatsApp é gravado em formatos variados; busca pelos 4 últimos dígitos e confere o número inteiro.
    const candidatas = await prisma.mentorada.findMany({
      where: { whatsapp: { contains: whats.slice(-4) } },
      orderBy: { createdAt: "desc" },
    });
    return candidatas.find(m => whatsappComDDI(m.whatsapp) === whats) ?? null;
  }
  return null;
}

const naoAchou = () =>
  NextResponse.json({ erro: "Mentorada não encontrada. Envie id, codigo, email ou whatsapp." }, { status: 404 });

// Consulta: ?email= | ?codigo= | ?whatsapp= | ?id=  →  uma mentorada
//           ?lista=ativas (&tipo=Nexus 1)          →  todas as ativas, para o agente diário
export async function GET(req: NextRequest) {
  const negado = chaveInvalida(req);
  if (negado) return negado;
  const q = Object.fromEntries(new URL(req.url).searchParams);

  if (q.lista === "ativas") {
    const lista = await prisma.mentorada.findMany({
      where: { status: { in: STATUS_ATIVOS }, ...(q.tipo ? { tipo: q.tipo } : {}) },
      orderBy: { nome: "asc" },
    });
    return NextResponse.json(lista.map(resumo));
  }

  const m = await acharMentorada(q);
  return m ? NextResponse.json(resumo(m)) : naoAchou();
}

const CAMPOS_ATUALIZAVEIS = ["email", "whatsapp", "tutora", "resp", "drive", "asana", "turma", "linkedin"] as const;

// Ações (campo "acao" no corpo):
//   cadastrar  — aluna nova (venda da Hubla ou formulário de Pix)
//   atualizar  — completa o cadastro (link da pasta, do Asana, tutora…)
//   avancar    — muda a etapa da jornada e, se vier "marco", marca a data de uma etapa do painel
export async function POST(req: NextRequest) {
  const negado = chaveInvalida(req);
  if (negado) return negado;
  const d = await req.json().catch(() => null);
  if (!d || typeof d !== "object") return NextResponse.json({ erro: "Corpo inválido: envie JSON." }, { status: 400 });

  if (d.acao === "cadastrar") return cadastrar(d);
  if (d.acao === "atualizar") return atualizar(d);
  if (d.acao === "avancar") return avancar(d);
  return NextResponse.json({ erro: "Ação inválida. Use cadastrar, atualizar ou avancar." }, { status: 400 });
}

async function cadastrar(d: Record<string, unknown>) {
  const nome = texto(d.nome), tipo = texto(d.tipo);
  if (!nome || !tipo || (!texto(d.email) && !texto(d.whatsapp))) {
    return NextResponse.json({ erro: "Para cadastrar, envie nome, tipo (programa) e email ou whatsapp." }, { status: 400 });
  }

  // A Hubla pode mandar o mesmo aviso mais de uma vez: se ela já está ativa no mesmo programa, não duplica.
  const existente = await acharMentorada({ email: d.email, whatsapp: texto(d.email) ? null : d.whatsapp });
  if (existente && STATUS_ATIVOS.includes(existente.status)) {
    if (existente.tipo === tipo) return NextResponse.json({ criada: false, mentorada: resumo(existente) });
    return NextResponse.json({
      erro: `${existente.nome} já está ativa no ${existente.tipo}. Se for upgrade, registre pelo painel.`,
      mentorada: resumo(existente),
    }, { status: 409 });
  }

  const inicio = data(d.inicio) ?? new Date();
  const duracao = parseInt(String(d.duracao ?? ""), 10);
  let prazo = data(d.prazo);
  if (!prazo && Number.isFinite(duracao)) {
    prazo = new Date(inicio);
    prazo.setMonth(prazo.getMonth() + duracao);
  }
  const jornadaEtapa = texto(d.etapa);

  const m = await prisma.mentorada.create({
    data: {
      codigo: await proximoCodigo(tipo),
      nome, tipo,
      status: "Ativo",
      saude: "Saudável",
      email: texto(d.email),
      whatsapp: whatsappComDDI(texto(d.whatsapp)),
      inicio, prazo,
      duracao: Number.isFinite(duracao) ? duracao : null,
      origem: texto(d.origem),
      tutora: texto(d.tutora),
      resp: texto(d.resp),
      drive: texto(d.drive),
      asana: texto(d.asana),
      obs: texto(d.obs),
      jornadaEtapa,
      jornadaEtapaEm: jornadaEtapa ? new Date() : null,
    },
  });
  await prisma.saudeRegistro.create({ data: { mentoradaId: m.id, saude: "Saudável", origem: "cadastro" } });
  await registrarAtividade(MAKE, {
    acao: "criou", entidade: "mentorada", mentoradaId: m.id,
    resumo: `Cadastrou ${m.nome} (${m.tipo}) pela automação`,
  });
  await recalcularSaude([m.id]);
  return NextResponse.json({ criada: true, mentorada: resumo(m) }, { status: 201 });
}

async function atualizar(d: Record<string, unknown>) {
  // Para trocar o próprio e-mail ou WhatsApp, a aluna é identificada pelo objeto "busca".
  const atual = await acharMentorada(d.busca && typeof d.busca === "object" ? d.busca as Record<string, unknown> : d);
  if (!atual) return naoAchou();

  const updates: Record<string, string | null> = {};
  for (const campo of CAMPOS_ATUALIZAVEIS) {
    if (campo in d) updates[campo] = campo === "whatsapp" ? whatsappComDDI(texto(d[campo])) : texto(d[campo]);
  }
  const mudancas = diferencas(atual as Record<string, unknown>, updates);
  if (!Object.keys(mudancas).length) return NextResponse.json({ mudou: false, mentorada: resumo(atual) });

  const m = await prisma.mentorada.update({ where: { id: atual.id }, data: updates });
  await registrarAtividade(MAKE, {
    acao: "editou", entidade: "mentorada", mentoradaId: m.id,
    resumo: `Editou ${Object.keys(mudancas).join(", ")} de ${m.nome} pela automação`,
    detalhe: mudancas,
  });
  return NextResponse.json({ mudou: true, mentorada: resumo(m) });
}

async function avancar(d: Record<string, unknown>) {
  const etapa = texto(d.etapa);
  if (!etapa) return NextResponse.json({ erro: "Envie a etapa (id da linha da Config_Jornada)." }, { status: 400 });
  const atual = await acharMentorada(d);
  if (!atual) return naoAchou();

  // Marco: data de uma etapa que o painel acompanha (onboarding, sessao, correcao…), usada na saúde.
  const marco = texto(d.marco);
  const campoMarco = marco ? etapaFields(atual.tipo).find(c => c.key === marco) : null;
  if (marco && !campoMarco) {
    const validos = etapaFields(atual.tipo).map(c => c.key).join(", ");
    return NextResponse.json({ erro: `Marco "${marco}" não existe no ${atual.tipo}. Use: ${validos}.` }, { status: 400 });
  }

  // Repetir a mesma etapa não muda nada: o Make usa "mudou" para não mandar a mensagem duas vezes.
  const mudou = atual.jornadaEtapa !== etapa;
  const quando = data(d.data) ?? new Date();
  const m = mudou
    ? await prisma.mentorada.update({ where: { id: atual.id }, data: { jornadaEtapa: etapa, jornadaEtapaEm: quando } })
    : atual;

  if (campoMarco) {
    if (campoMarco.campoMentorada) {
      await prisma.mentorada.update({ where: { id: m.id }, data: { [campoMarco.campoMentorada]: quando } });
    } else {
      const programa = m.tipo ?? "";
      await prisma.etapa.upsert({
        where: { mentoradaId_programa_nome: { mentoradaId: m.id, programa, nome: campoMarco.key } },
        update: { data: quando },
        create: { mentoradaId: m.id, programa, nome: campoMarco.key, data: quando },
      });
    }
  }

  if (mudou || campoMarco) {
    await registrarAtividade(MAKE, {
      acao: "editou", entidade: "etapa", mentoradaId: m.id,
      resumo: [
        mudou ? `Passou ${m.nome} para a etapa ${etapa}` : null,
        campoMarco ? `marcou ${nomeEtapa(campoMarco.key)} em ${quando.toISOString().slice(0, 10).split("-").reverse().join("/")}` : null,
      ].filter(Boolean).join(" e ") + " pela automação",
    });
  }
  if (campoMarco) await recalcularSaude([m.id]);
  return NextResponse.json({ mudou, mentorada: resumo(m) });
}
