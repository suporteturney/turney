import "server-only";
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/lib/auth";

type Registro = {
  acao: "criou" | "editou" | "excluiu" | "importou" | "entrou" | "saiu";
  entidade: string;
  resumo: string;
  mentoradaId?: string | null;
  detalhe?: unknown;
};

// Grava no registro de atividades quem fez o quê. Nunca derruba a ação principal se falhar.
export async function registrarAtividade(usuario: Pick<UsuarioSessao, "id" | "nome"> | null, r: Registro) {
  try {
    await prisma.atividade.create({
      data: {
        usuarioId: usuario?.id ?? null,
        usuarioNome: usuario?.nome ?? "Sistema",
        acao: r.acao,
        entidade: r.entidade,
        resumo: r.resumo,
        mentoradaId: r.mentoradaId ?? null,
        detalhe: r.detalhe === undefined ? undefined : JSON.parse(JSON.stringify(r.detalhe)),
      },
    });
  } catch (e) {
    console.error("Falha ao registrar atividade", e);
  }
}

export async function nomeDaMentorada(id: string) {
  return (await prisma.mentorada.findUnique({ where: { id }, select: { nome: true } }))?.nome ?? "mentorada";
}

const fmtValor = (v: unknown) => {
  if (v === null || v === undefined || v === "") return "—";
  if (v instanceof Date) return v.toISOString().slice(0, 10).split("-").reverse().join("/");
  return String(v);
};

// Lista "campo: antes → depois" só dos campos que mudaram.
export function diferencas(antes: Record<string, unknown>, depois: Record<string, unknown>) {
  const mudou: Record<string, { de: string; para: string }> = {};
  for (const [k, v] of Object.entries(depois)) {
    const a = fmtValor(antes[k]);
    const b = fmtValor(v);
    if (a !== b) mudou[k] = { de: a, para: b };
  }
  return mudou;
}
