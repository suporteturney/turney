import { exigirUsuario } from "@/lib/auth";
import TrocarSenha from "@/components/TrocarSenha";

export default async function ContaPage() {
  const usuario = await exigirUsuario();
  return <TrocarSenha primeiroAcesso={false} nome={usuario.nome} />;
}
