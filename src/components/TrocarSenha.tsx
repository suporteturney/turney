"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/app/(app)/shared.module.css";
import m from "@/app/(app)/acompanhamento/importar.module.css";

export default function TrocarSenha({ primeiroAcesso, nome }: { primeiroAcesso: boolean; nome: string }) {
  const router = useRouter();
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [repetir, setRepetir] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [salvando, setSalvando] = useState(false);

  async function salvar(ev: React.FormEvent) {
    ev.preventDefault();
    setErro(null);
    if (nova !== repetir) return setErro("As duas senhas novas não são iguais.");
    setSalvando(true);
    try {
      const r = await fetch("/api/conta/senha", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ atual, nova }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.erro || "Não foi possível trocar a senha.");
      setOk(true);
      setAtual(""); setNova(""); setRepetir("");
      router.refresh();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <div className={styles.topbar}>
        <div>
          <div className={styles.pageTitle}>{primeiroAcesso ? `Boas-vindas, ${nome.split(" ")[0]}!` : "Minha senha"}</div>
          <div className={styles.pageSub}>
            {primeiroAcesso ? "Antes de começar, crie a sua senha. A senha provisória que você recebeu deixa de valer." : "Troque a senha que você usa para entrar na plataforma"}
          </div>
        </div>
      </div>
      <div className={styles.content}>
        <form className={styles.card} style={{ maxWidth: 440, display: "flex", flexDirection: "column", gap: 12 }} onSubmit={salvar}>
          <label className={m.field}>
            <span>{primeiroAcesso ? "Senha provisória" : "Senha atual"}</span>
            <input type="password" autoComplete="current-password" value={atual} onChange={e => setAtual(e.target.value)} required />
          </label>
          <label className={m.field}>
            <span>Nova senha (mínimo 8 caracteres)</span>
            <input type="password" autoComplete="new-password" minLength={8} value={nova} onChange={e => setNova(e.target.value)} required />
          </label>
          <label className={m.field}>
            <span>Repita a nova senha</span>
            <input type="password" autoComplete="new-password" minLength={8} value={repetir} onChange={e => setRepetir(e.target.value)} required />
          </label>
          {erro && <div className={m.erro} role="alert">{erro}</div>}
          {ok && !primeiroAcesso && <div role="status" style={{ fontSize: 12, color: "#065F46", fontWeight: 600 }}>Senha trocada.</div>}
          <button className={m.btnPrimary} type="submit" disabled={salvando} style={{ alignSelf: "flex-start" }}>
            {salvando ? "Salvando…" : primeiroAcesso ? "Criar minha senha" : "Trocar senha"}
          </button>
        </form>
      </div>
    </>
  );
}
