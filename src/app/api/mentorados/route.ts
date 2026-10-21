import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";

export async function GET(req: NextRequest) {
  await exigirUsuario();
  const { searchParams } = new URL(req.url);
  const tipo = searchParams.get("tipo");
  const status = searchParams.get("status");
  const busca = searchParams.get("q");

  const where: Record<string, unknown> = {};
  if (tipo) where.tipo = tipo;
  if (status) where.status = status;
  if (busca) {
    where.OR = [
      { nome: { contains: busca, mode: "insensitive" } },
      { email: { contains: busca, mode: "insensitive" } },
      { codigo: { contains: busca, mode: "insensitive" } },
    ];
  }

  const mentorados = await prisma.mentorada.findMany({
    where,
    orderBy: { nome: "asc" },
    include: { etapas: true, presencas: true },
  });

  return NextResponse.json(mentorados);
}

function prefixoCodigo(tipo: string) {
  if (tipo === "Atlas") return "AT";
  if (tipo === "Delta") return "D";
  const nx = tipo.match(/^Nexus (\d)$/);
  if (nx) return `NX${nx[1]}`;
  return "MT";
}

async function proximoCodigo(tipo: string) {
  const prefixo = prefixoCodigo(tipo);
  const existentes = await prisma.mentorada.findMany({
    where: { codigo: { startsWith: prefixo } },
    select: { codigo: true },
  });
  const nums = existentes
    .map(e => Number((e.codigo ?? "").slice(prefixo.length)))
    .filter(n => Number.isInteger(n));
  const prox = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefixo}${String(prox).padStart(3, "0")}`;
}

const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export async function POST(req: NextRequest) {
  const usuario = await exigirUsuario();
  const data = await req.json();

  const nome = texto(data.nome);
  const tipo = texto(data.tipo);
  if (!nome || !tipo) {
    return NextResponse.json({ erro: "Preencha o nome e o programa." }, { status: 400 });
  }
  const duracao = parseInt(data.duracao, 10);

  const mentorado = await prisma.mentorada.create({
    data: {
      codigo: texto(data.codigo) ?? (await proximoCodigo(tipo)),
      nome,
      tipo,
      status: texto(data.status) ?? "Ativo",
      saude: texto(data.saude) ?? "Saudável",
      email: texto(data.email),
      whatsapp: texto(data.whatsapp),
      inicio: data.inicio ? new Date(data.inicio) : null,
      prazo: data.prazo ? new Date(data.prazo) : null,
      duracao: Number.isFinite(duracao) ? duracao : null,
      area: texto(data.area),
      localizacao: texto(data.localizacao),
      turma: texto(data.turma),
      produtoAnterior: texto(data.produtoAnterior),
      origem: texto(data.origem),
      linkedin: texto(data.linkedin),
      drive: texto(data.drive),
      asana: texto(data.asana),
      resp: texto(data.resp) ?? usuario.nome,
      obs: texto(data.obs),
    },
  });

  return NextResponse.json(mentorado, { status: 201 });
}
