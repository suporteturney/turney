import { exigirUsuario } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
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
      <div className={styles.main}>{children}</div>
    </div>
  );
}
