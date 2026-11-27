import "server-only";
import { prisma } from "@/lib/prisma";

// Avisos para pessoas da equipe (item "Avisos" no menu). Sem ninguém escolhido, vão para as administradoras.
export async function avisarPessoas(ids: string[], avisos: { titulo: string; texto?: string | null; link?: string | null }[]) {
  if (!avisos.length) return 0;
  const quem = await prisma.usuario.findMany({
    where: { ativo: true, ...(ids.length ? { id: { in: ids } } : { papel: "admin" }) }, select: { id: true },
  });
  if (!quem.length) return 0;
  const r = await prisma.notificacao.createMany({
    data: quem.flatMap(u => avisos.map(a => ({ usuarioId: u.id, titulo: a.titulo, texto: a.texto ?? null, link: a.link ?? null }))),
  });
  return r.count;
}

export async function avisosNaoLidos(usuarioId: string) {
  return prisma.notificacao.count({ where: { usuarioId, lidaEm: null } }).catch(() => 0);
}
