import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { pode } from "@/lib/permissoes";
import { religarAvisosHubla } from "@/lib/hubla-servidor";
import HublaCliente from "./HublaCliente";
import styles from "../shared.module.css";

const DIA = 86_400_000;

export default async function HublaPage() {
  const usuario = await exigirUsuario();
  if (!pode(usuario, "equipe")) {
    return (
      <div className={styles.content}>
        <div className={styles.card}>Esta área é só para quem administra a equipe.</div>
      </div>
    );
  }
  await religarAvisosHubla();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "painel.turneyacademy.com";
  const protocolo = host.startsWith("localhost") ? "http" : "https";

  const desde = new Date(new Date().getTime() - 30 * DIA);
  const [conf, recentes, porTipo, soltos, ultimo, mentoradas, importacao, comConsumo] = await Promise.all([
    prisma.configuracao.findUnique({ where: { chave: "hubla_webhook_token" } }),
    prisma.eventoHubla.findMany({ orderBy: { data: "desc" }, take: 40, include: { mentorada: { select: { id: true, nome: true } } } }),
    prisma.eventoHubla.groupBy({ by: ["tipo"], where: { data: { gte: desde } }, _count: { _all: true } }),
    prisma.eventoHubla.groupBy({ by: ["email"], where: { mentoradaId: null }, _count: { _all: true }, _max: { data: true, nome: true } }),
    prisma.eventoHubla.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    prisma.mentorada.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true, status: true, email: true, tipo: true } }),
    prisma.configuracao.findUnique({ where: { chave: "hubla_consumo_importacao" } }),
    prisma.consumoHubla.findMany({ where: { mentoradaId: { not: null } }, distinct: ["mentoradaId"], select: { mentoradaId: true } }),
  ]);
  const temConsumo = new Set(comConsumo.map(c => c.mentoradaId));
  const ATIVOS = ["Ativo", "Em Andamento", "Em Renovação", "Congelado"];
  const semAulas = importacao
    ? mentoradas.filter(m => ATIVOS.includes(m.status) && !temConsumo.has(m.id)).map(m => ({ id: m.id, nome: m.nome, email: m.email, tipo: m.tipo }))
    : [];

  return (
    <HublaCliente
      url={`${protocolo}://${host}/api/hubla/webhook`}
      configurado={!!conf || !!process.env.HUBLA_WEBHOOK_TOKEN}
      finalToken={conf ? conf.valor.slice(-4) : null}
      configuradoEm={conf?.atualizadaEm.toISOString() ?? null}
      ultimoAviso={ultimo?.createdAt.toISOString() ?? null}
      contagem={Object.fromEntries(porTipo.map(x => [x.tipo, x._count._all]))}
      soltos={soltos
        .map(x => ({ email: x.email, nome: x._max.nome, total: x._count._all, data: x._max.data?.toISOString() ?? null }))
        .sort((a, b) => (b.data ?? "").localeCompare(a.data ?? ""))}
      recentes={recentes.map(e => ({
        id: e.id, tipo: e.tipo, nome: e.nome, email: e.email, produto: e.produto, modulo: e.modulo,
        data: e.data.toISOString(), mentorada: e.mentorada,
      }))}
      mentoradas={mentoradas.map(m => ({ id: m.id, nome: m.nome }))}
      importacao={importacao ? JSON.parse(importacao.valor) : null}
      semAulas={semAulas}
    />
  );
}
