import "server-only";
import { prisma } from "@/lib/prisma";

function prefixoCodigo(tipo: string) {
  if (tipo === "Atlas") return "AT";
  if (tipo === "Delta") return "D";
  const nx = tipo.match(/^Nexus (\d)$/);
  if (nx) return `NX${nx[1]}`;
  return "MT";
}

// Próximo código livre do programa (ex: NX1042).
export async function proximoCodigo(tipo: string) {
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
