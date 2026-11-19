import "server-only";
import { prisma } from "@/lib/prisma";

// Mentorada de um e-mail da Hubla: pelo e-mail do cadastro ou por uma ligação feita à mão antes
// (avisos anteriores desse e-mail que já foram ligados a alguém).
export async function mentoradaDoEmail(email: string): Promise<string | null> {
  const m = await prisma.mentorada.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  if (m) return m.id;
  const antes = await prisma.eventoHubla.findFirst({ where: { email, mentoradaId: { not: null } }, select: { mentoradaId: true } });
  if (antes) return antes.mentoradaId;
  const consumo = await prisma.consumoHubla.findFirst({ where: { email, mentoradaId: { not: null } }, select: { mentoradaId: true } }).catch(() => null);
  return consumo?.mentoradaId ?? null;
}

// Tenta de novo ligar avisos sem mentorada (ex.: o e-mail foi corrigido no cadastro depois).
export async function religarAvisosHubla() {
  // Relatório de aulas: liga pelo e-mail do cadastro quem ficou sem mentorada.
  const soltosConsumo = await prisma.consumoHubla.findMany({ where: { mentoradaId: null }, distinct: ["email"], select: { email: true } }).catch(() => []);
  for (const { email } of soltosConsumo) {
    const id = await mentoradaDoEmail(email);
    if (id) await prisma.consumoHubla.updateMany({ where: { email, mentoradaId: null }, data: { mentoradaId: id } });
  }
  const soltos = await prisma.eventoHubla.findMany({ where: { mentoradaId: null }, distinct: ["email"], select: { email: true } });
  for (const { email } of soltos) {
    const id = await mentoradaDoEmail(email);
    if (id) await prisma.eventoHubla.updateMany({ where: { email, mentoradaId: null }, data: { mentoradaId: id } });
  }
}
