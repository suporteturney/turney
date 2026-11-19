import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { podeOperar } from "@/lib/pipeline-servidor";
import { hojeISO } from "@/lib/dias-uteis";
import { nomeDaEquipe } from "@/lib/nomes-equipe";
import TarefasCliente from "./TarefasCliente";

const DIA = 86_400_000;

export default async function TarefasPage() {
  const usuario = await exigirUsuario();
  const desde = new Date(Date.parse(hojeISO()) - 30 * DIA);
  const [tarefas, mentoradas, usuarios] = await Promise.all([
    // Abertas e as concluídas nos últimos 30 dias.
    prisma.tarefa.findMany({
      where: { OR: [{ concluidaEm: null }, { concluidaEm: { gte: desde } }] },
      orderBy: [{ prazo: "asc" }, { createdAt: "asc" }],
      include: {
        mentorada: { select: { id: true, nome: true, tipo: true, whatsapp: true } },
        fase: { select: { nome: true } },
      },
    }),
    prisma.mentorada.findMany({
      where: { status: { in: ["Ativo", "Em Andamento", "Em Renovação", "Congelado"] } },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
    prisma.usuario.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { nome: true } }),
  ]);
  const ativos = [...new Set(usuarios.map(u => u.nome))];
  const resp = (t: { responsavel: string | null }) => nomeDaEquipe(t.responsavel, ativos);
  const equipe = [...new Set([...ativos, ...tarefas.map(resp).filter((x): x is string => !!x)])]
    .sort((a, b) => a.localeCompare(b, "pt-BR"));

  return (
    <TarefasCliente
      tarefas={tarefas.map(t => ({
        id: t.id,
        titulo: t.titulo,
        prazo: t.prazo.toISOString().slice(0, 10),
        automatica: t.automatica,
        fase: t.fase?.nome ?? null,
        criadaPor: t.criadaPor,
        responsavel: resp(t),
        concluidaEm: t.concluidaEm?.toISOString() ?? null,
        concluidaPor: t.concluidaPor,
        mentorada: t.mentorada,
      }))}
      mentoradas={mentoradas}
      equipe={equipe}
      eu={usuario.nome}
      podeEditar={podeOperar(usuario) && !usuario.trocarSenha}
    />
  );
}
