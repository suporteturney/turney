import { exigirUsuario } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import TrocarSenha from "@/components/TrocarSenha";
import styles from "./app.module.css";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await exigirUsuario();

  return (
    <div className={styles.shell}>
      <Sidebar usuario={usuario} />
      <div className={styles.main}>
        {/* Senha provisória: só libera a plataforma depois de criar a própria senha. */}
        {usuario.trocarSenha ? <TrocarSenha primeiroAcesso nome={usuario.nome} /> : children}
      </div>
    </div>
  );
}
