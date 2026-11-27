import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AvisosCliente from "./AvisosCliente";

export default async function AvisosPage() {
  const usuario = await exigirUsuario();
  const avisos = await prisma.notificacao.findMany({ where: { usuarioId: usuario.id }, orderBy: { createdAt: "desc" }, take: 80 });
  return (
    <AvisosCliente
      avisos={avisos.map(a => ({ id: a.id, titulo: a.titulo, texto: a.texto, link: a.link, lida: !!a.lidaEm, em: a.createdAt.toISOString() }))}
    />
  );
}
