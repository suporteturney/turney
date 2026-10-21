import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await exigirUsuario();
  const { id } = await params;

  const mentorado = await prisma.mentorada.findUnique({
    where: { id },
    include: {
      etapas: { orderBy: { createdAt: "asc" } },
      presencas: { orderBy: { encontro: "asc" } },
      acompanhamentos: { orderBy: { data: "desc" } },
      observacoes: { orderBy: { data: "desc" } },
      renovacoes: { orderBy: { data: "desc" } },
    },
  });

  if (!mentorado) return NextResponse.json({ erro: "Não encontrado" }, { status: 404 });
  return NextResponse.json(mentorado);
}

const CAMPOS_TEXTO = [
  "nome", "email", "whatsapp", "status", "saude", "area",
  "localizacao", "turma", "produtoAnterior", "origem", "resp", "obs",
  "tipo", "linkedin", "drive", "asana", "disc", "vagaCargo", "vagaEmpresa",
  "negociacao",
];
const CAMPOS_INT = ["duracao", "mesesAntes"];
const CAMPOS_DATA = ["inicio", "prazo", "cancelamento", "vagaData"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await exigirUsuario();
  const { id } = await params;
  const data = await req.json();

  const updates: Record<string, unknown> = {};
  for (const campo of CAMPOS_TEXTO) {
    if (campo in data) {
      const v = typeof data[campo] === "string" ? data[campo].trim() : data[campo];
      updates[campo] = v === "" ? null : v;
    }
  }
  if (typeof updates.nome !== "string" || !updates.nome) delete updates.nome;
  if (!updates.tipo) delete updates.tipo;
  if (!updates.status) delete updates.status;

  for (const campo of CAMPOS_INT) {
    if (campo in data) {
      const n = parseInt(data[campo], 10);
      updates[campo] = Number.isFinite(n) ? n : null;
    }
  }
  for (const campo of CAMPOS_DATA) {
    if (campo in data) updates[campo] = data[campo] ? new Date(data[campo]) : null;
  }
  if (updates.cancelamento) updates.status = "Churn";
  if ("negociacao" in updates) updates.negociacaoEm = updates.negociacao ? new Date() : null;

  const mentorado = await prisma.mentorada.update({ where: { id }, data: updates });
  return NextResponse.json(mentorado);
}
