import { after } from "next/server";
import { exigirUsuario } from "@/lib/auth";
import { sincronizarAgendas } from "@/lib/agenda-servidor";
import { sincronizarDevolutivas } from "@/lib/devolutiva-servidor";
import { avisosNaoLidos } from "@/lib/notificacoes";
import { prisma } from "@/lib/prisma";
import { hojeISO } from "@/lib/dias-uteis";
import Sidebar from "@/components/Sidebar";
import TrocarSenha from "@/components/TrocarSenha";
import { urlFoto } from "@/lib/foto";
import { temPilar } from "@/lib/permissoes";
import styles from "./app.module.css";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await exigirUsuario();
  // Lê as agendas das mentoras depois de mostrar a página (no máximo a cada 3 horas).
  after(() => sincronizarAgendas().catch(e => console.error("Falha ao ler as agendas", e)));
  // Lê a planilha de devolutivas comportamentais (no máximo a cada 15 minutos).
  after(() => sincronizarDevolutivas().catch(e => console.error("Falha ao ler a planilha de devolutivas", e)));
  // Contador do menu: tarefas abertas com prazo até hoje (atrasadas ou do dia).
  const tarefasVencendo = await prisma.tarefa
    .count({
      where: {
        concluidaEm: null, prazo: { lte: new Date(hojeISO()) },
        // Fora do Pós Venda, conta só as tarefas gerais da própria pessoa.
        ...(temPilar(usuario, "posvenda") ? {} : { mentoradaId: null, OR: [{ responsavel: usuario.nome }, { responsavel: null, criadaPor: usuario.nome }] }),
      },
    })
    .catch(() => 0);

  const avisos = await avisosNaoLidos(usuario.id);
  const foto = await prisma.fotoUsuario.findUnique({ where: { usuarioId: usuario.id }, select: { atualizadaEm: true } }).catch(() => null);

  return (
    <div className={styles.shell}>
      <Sidebar usuario={usuario} tarefasVencendo={tarefasVencendo} avisos={avisos} foto={urlFoto(usuario.id, foto)} />
      <div className={styles.main}>
        {/* Senha provisória: só libera a plataforma depois de criar a própria senha. */}
        {usuario.trocarSenha ? <TrocarSenha primeiroAcesso nome={usuario.nome} /> : children}
      </div>
    </div>
  );
}
