"use client";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import c from "../comercial/comercial.module.css";
import { Aviso, enviar, type Msg } from "../comercial/ui";

type T = { id: string; titulo: string; prazo: string };
const br = (iso: string) => iso.split("-").reverse().join("/").slice(0, 5);

// Tarefas gerais da própria pessoa (quem não é do Pós Venda).
export default function MinhasTarefas({ eu, hoje, tarefas, podeCriar }: { eu: string; hoje: string; tarefas: T[]; podeCriar: boolean }) {
  const router = useRouter();
  const [feitas, setFeitas] = useState<Set<string>>(new Set());
  const [titulo, setTitulo] = useState("");
  const [prazo, setPrazo] = useState(hoje);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const fecharMsg = useCallback(() => setMsg(null), []);

  async function concluir(t: T) {
    setFeitas(f => new Set(f).add(t.id));
    try { await enviar(`/api/tarefas/${t.id}`, "PATCH", { concluida: true }); setMsg({ txt: `Concluída: ${t.titulo}` }); router.refresh(); }
    catch (e) { setFeitas(f => { const n = new Set(f); n.delete(t.id); return n; }); setMsg({ txt: (e as Error).message, erro: true }); }
  }
  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) return;
    setSalvando(true);
    try { await enviar("/api/tarefas", "POST", { titulo, prazo, responsavel: eu }); setTitulo(""); router.refresh(); }
    catch (err) { setMsg({ txt: (err as Error).message, erro: true }); }
    setSalvando(false);
  }
  const lista = tarefas.filter(t => !feitas.has(t.id));
  return (
    <section className={c.bloco}>
      <div className={c.blocoTopo}><h2 className={c.blocoTitulo}>Suas tarefas</h2><span className={c.nota}>{lista.length}</span></div>
      {!lista.length && <p className={c.vazio}>Nenhuma tarefa em aberto.</p>}
      <ul className={c.lista}>
        {lista.map(t => (
          <li key={t.id} className={c.item}>
            <input type="checkbox" checked={false} onChange={() => concluir(t)} aria-label={`Concluir ${t.titulo}`} />
            <div className={c.itemCorpo}><b>{t.titulo}</b></div>
            <span className={`${c.quando} ${t.prazo < hoje ? c.atrasado : t.prazo === hoje ? c.hoje : ""}`}>{t.prazo < hoje ? `era ${br(t.prazo)}` : t.prazo === hoje ? "hoje" : br(t.prazo)}</span>
          </li>
        ))}
      </ul>
      {podeCriar && (
        <form className={c.proximo} onSubmit={criar} style={{ marginTop: 12 }}>
          <label className={c.campo}>Nova tarefa<input value={titulo} onChange={e => setTitulo(e.target.value)} /></label>
          <label className={c.campo}>Prazo<input type="date" value={prazo} onChange={e => setPrazo(e.target.value)} required /></label>
          <button className={c.btnPrim} disabled={!titulo.trim() || salvando}>Criar</button>
        </form>
      )}
      <Aviso msg={msg} fechar={fecharMsg} />
    </section>
  );
}
