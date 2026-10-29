"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PAPEIS, PERMISSOES, rotuloPapel, type Permissao } from "@/lib/permissoes";
import styles from "../shared.module.css";
import m from "../acompanhamento/importar.module.css";
import e from "./equipe.module.css";

type Pessoa = {
  id: string; nome: string; email: string; papel: string; permissoes: string[];
  ativo: boolean; trocarSenha: boolean; ultimoAcesso: string | null;
};
type Edicao = { id: string | null; nome: string; email: string; papel: string; permissoes: string[] };

const presetDe = (papel: string) => [...(PAPEIS.find(p => p.k === papel)?.permissoes ?? [])] as string[];
const quando = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Nunca entrou";

export default function EquipeCliente({ inicial, euId }: { inicial: Pessoa[]; euId: string }) {
  const router = useRouter();
  const [ed, setEd] = useState<Edicao | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [senha, setSenha] = useState<{ nome: string; email: string; senha: string } | null>(null);

  async function chamar(url: string, method: string, body: unknown) {
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.erro || "Não foi possível salvar.");
    return j;
  }

  async function salvar() {
    if (!ed) return;
    setSalvando(true);
    setErro(null);
    try {
      if (ed.id) {
        await chamar(`/api/equipe/${ed.id}`, "PATCH", { nome: ed.nome, email: ed.email, papel: ed.papel, permissoes: ed.permissoes });
      } else {
        const j = await chamar("/api/equipe", "POST", ed);
        setSenha({ nome: ed.nome, email: ed.email.trim().toLowerCase(), senha: j.senhaProvisoria });
      }
      setEd(null);
      router.refresh();
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo(p: Pessoa) {
    if (!window.confirm(p.ativo ? `Desativar o acesso de ${p.nome}? Ela sai da plataforma na hora.` : `Reativar o acesso de ${p.nome}?`)) return;
    try {
      await chamar(`/api/equipe/${p.id}`, "PATCH", { ativo: !p.ativo });
      router.refresh();
    } catch (err) {
      window.alert((err as Error).message);
    }
  }

  async function redefinir(p: Pessoa) {
    if (!window.confirm(`Gerar uma nova senha provisória para ${p.nome}? A senha atual deixa de funcionar.`)) return;
    try {
      const j = await chamar(`/api/equipe/${p.id}`, "PATCH", { redefinirSenha: true });
      setSenha({ nome: p.nome, email: p.email, senha: j.senhaProvisoria });
      router.refresh();
    } catch (err) {
      window.alert((err as Error).message);
    }
  }

  const togglePerm = (k: Permissao) =>
    setEd(x => x && ({ ...x, permissoes: x.permissoes.includes(k) ? x.permissoes.filter(p => p !== k) : [...x.permissoes, k] }));

  return (
    <>
      <div className={styles.topbar}>
        <div>
          <div className={styles.pageTitle}>Equipe</div>
          <div className={styles.pageSub}>Quem acessa a plataforma e o que cada pessoa pode fazer</div>
        </div>
        <button className={m.btnPrimary} onClick={() => { setErro(null); setEd({ id: null, nome: "", email: "", papel: "mentora", permissoes: presetDe("mentora") }); }}>
          + Novo acesso
        </button>
      </div>

      <div className={styles.content}>
        {senha && (
          <div className={e.senha} role="status">
            <div>
              <strong>Acesso de {senha.nome} pronto.</strong> Envie para ela o endereço da plataforma, o e-mail <b>{senha.email}</b> e a senha provisória abaixo.
              No primeiro acesso a plataforma pede para ela criar uma senha própria. <b>Esta senha não aparece de novo.</b>
            </div>
            <code>{senha.senha}</code>
            <div className={e.senhaAcoes}>
              <button className={m.btnGhost} onClick={() => navigator.clipboard.writeText(senha.senha)}>Copiar senha</button>
              <button className={m.btnGhost} onClick={() => setSenha(null)}>Fechar</button>
            </div>
          </div>
        )}

        <div className={styles.tblCard}>
          <div className={styles.tblHead}>
            <span className={styles.tblTitle}>Acessos</span>
            <span className={styles.tblCount}>{inicial.filter(p => p.ativo).length} ativos</span>
          </div>
          <div className={styles.tblWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Pessoa</th><th>Nível</th><th>Pode</th><th>Último acesso</th><th></th></tr>
              </thead>
              <tbody>
                {inicial.map(p => (
                  <tr key={p.id} className={p.ativo ? "" : e.inativo}>
                    <td>
                      <strong>{p.nome}</strong>{p.id === euId && <span className={e.voce}> (você)</span>}
                      <div className={e.email}>{p.email}</div>
                    </td>
                    <td>
                      {rotuloPapel(p.papel)}
                      {!p.ativo && <div className={e.tag}>Desativado</div>}
                      {p.ativo && p.trocarSenha && <div className={e.tag}>Aguardando 1º acesso</div>}
                    </td>
                    <td className={e.perms}>
                      {p.papel === "admin" ? "Tudo" : p.permissoes.length
                        ? PERMISSOES.filter(x => p.permissoes.includes(x.k)).map(x => x.label).join(" · ")
                        : "Só visualizar"}
                    </td>
                    <td>{quando(p.ultimoAcesso)}</td>
                    <td className={e.acoes}>
                      <button className={m.btnGhost} onClick={() => { setErro(null); setEd({ id: p.id, nome: p.nome, email: p.email, papel: p.papel, permissoes: [...p.permissoes] }); }}>Editar</button>
                      {p.id !== euId && (
                        <>
                          <button className={m.btnGhost} onClick={() => redefinir(p)}>Nova senha</button>
                          <button className={m.btnGhost} onClick={() => alternarAtivo(p)}>{p.ativo ? "Desativar" : "Reativar"}</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {ed && (
        <div className={m.backdrop} onClick={() => setEd(null)}>
          <div className={m.modal} onClick={ev => ev.stopPropagation()} role="dialog" aria-modal="true" aria-label={ed.id ? "Editar acesso" : "Novo acesso"}>
            <header className={m.header}>
              <div>
                <div className={m.title}>{ed.id ? `Editar acesso de ${ed.nome}` : "Novo acesso"}</div>
                <div className={m.sub}>O nível preenche as permissões; você pode ajustar uma a uma.</div>
              </div>
              <button className={m.close} onClick={() => setEd(null)} aria-label="Fechar">✕</button>
            </header>
            <div className={m.body}>
              <div className={m.row}>
                <label className={m.field}>
                  <span>Nome</span>
                  <input value={ed.nome} onChange={ev => setEd({ ...ed, nome: ev.target.value })} placeholder="Ex: Amanda Dutra" />
                </label>
                <label className={m.field}>
                  <span>E-mail de acesso</span>
                  <input type="email" value={ed.email} onChange={ev => setEd({ ...ed, email: ev.target.value })} placeholder="nome@turneyacademy.com" />
                </label>
              </div>
              {ed.id && ed.email.trim().toLowerCase() !== inicial.find(p => p.id === ed.id)?.email && (
                <div className={m.sub}>A senha continua a mesma. A partir de agora, {ed.id === euId ? "você entra" : `${ed.nome.split(" ")[0]} entra`} com o e-mail novo.</div>
              )}
              <label className={m.field}>
                <span>Nível</span>
                <select
                  value={ed.papel}
                  disabled={ed.id === euId}
                  onChange={ev => setEd({ ...ed, papel: ev.target.value, permissoes: presetDe(ev.target.value) })}
                >
                  {PAPEIS.map(p => <option key={p.k} value={p.k}>{p.label}</option>)}
                </select>
              </label>
              {ed.papel === "admin" ? (
                <div className={m.sub}>Administradora pode tudo, inclusive criar acessos e ver o registro de atividades.</div>
              ) : (
                PERMISSOES.map(p => (
                  <label key={p.k} className={m.check}>
                    <input type="checkbox" checked={ed.permissoes.includes(p.k)} onChange={() => togglePerm(p.k)} />
                    <span><strong>{p.label}</strong><small>{p.desc}</small></span>
                  </label>
                ))
              )}
              <div className={m.sub}>Todo mundo com acesso consegue visualizar as mentoradas. As permissões liberam o que cada pessoa pode alterar.</div>
            </div>
            <footer className={m.footer}>
              {erro && <span className={m.erro}>{erro}</span>}
              <button className={m.btnGhost} onClick={() => setEd(null)} disabled={salvando}>Cancelar</button>
              <button className={m.btnPrimary} onClick={salvar} disabled={salvando || !ed.nome.trim() || !ed.email.trim()}>
                {salvando ? "Salvando…" : ed.id ? "Salvar" : "Criar acesso"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
