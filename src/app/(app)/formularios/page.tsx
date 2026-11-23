import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { exigirPilar } from "@/lib/auth";
import { hojeISO } from "@/lib/dias-uteis";
import { pode } from "@/lib/permissoes";
import { CHAVE_IMPORTACAO, CHAVE_TOKEN, CHAVE_ULTIMO } from "@/lib/respondi-servidor";
import FormulariosCliente from "./FormulariosCliente";
import styles from "../shared.module.css";

export default async function FormulariosPage() {
  const usuario = await exigirPilar("comercial");
  if (!pode(usuario, "equipe")) {
    return <div className={styles.content}><div className={styles.card}>Esta área é só para quem administra a equipe.</div></div>;
  }
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "painel.turneyacademy.com";
  const protocolo = host.startsWith("localhost") ? "http" : "https";
  const hoje = hojeISO();
  const desde = new Date(Date.parse(hoje) - 30 * 86_400_000);
  const [conf, porForm, recentes] = await Promise.all([
    prisma.configuracao.findMany({ where: { chave: { in: [CHAVE_TOKEN, CHAVE_ULTIMO, CHAVE_IMPORTACAO] } } }),
    prisma.respostaFormulario.groupBy({ by: ["formulario", "temperatura"], where: { preenchidoEm: { gte: desde } }, _count: { _all: true } }),
    prisma.respostaFormulario.findMany({
      orderBy: { preenchidoEm: "desc" }, take: 25,
      select: { id: true, formulario: true, completa: true, preenchidoEm: true, temperatura: true, lead: { select: { id: true, nome: true } } },
    }),
  ]);
  const valor = (k: string) => conf.find(x => x.chave === k)?.valor ?? null;
  const token = valor(CHAVE_TOKEN), ultimo = valor(CHAVE_ULTIMO), imp = valor(CHAVE_IMPORTACAO);
  return (
    <FormulariosCliente
      hoje={hoje}
      url={token ? `${protocolo}://${host}/api/respondi/webhook/${token}` : null}
      ultimo={ultimo ? JSON.parse(ultimo) : null}
      importacao={imp ? JSON.parse(imp) : null}
      porForm={porForm.map(x => ({ formulario: x.formulario, temperatura: x.temperatura, n: x._count._all }))}
      recentes={recentes.map(r => ({ ...r, preenchidoEm: r.preenchidoEm.toISOString() }))}
    />
  );
}
