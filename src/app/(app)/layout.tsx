import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hojeISO } from "@/lib/dias-uteis";
import Sidebar from "@/components/Sidebar";
import TrocarSenha from "@/components/TrocarSenha";
import styles from "./app.module.css";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await exigirUsuario();
  // Contador do menu: tarefas abertas com prazo até hoje (atrasadas ou do dia).
  const tarefasVencendo = await prisma.tarefa
    .count({ where: { concluidaEm: null, prazo: { lte: new Date(hojeISO()) } } })
    .catch(() => 0);

  return (
    <div className={styles.shell}>
      <Sidebar usuario={usuario} tarefasVencendo={tarefasVencendo} />
      <div className={styles.main}>
        {/* Senha provisória: só libera a plataforma depois de criar a própria senha. */}
        {usuario.trocarSenha ? <TrocarSenha primeiroAcesso nome={usuario.nome} /> : children}
      </div>
    </div>
  );
}
