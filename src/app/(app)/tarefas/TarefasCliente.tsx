"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MentoradaDrawer from "@/components/MentoradaDrawer";
import { hojeISO } from "@/lib/dias-uteis";
import styles from "../shared.module.css";
import f from "../filtros.module.css";
import t from "./tarefas.module.css";

type Tarefa = {
  id: string; titulo: string; prazo: string; automatica: boolean; fase: string | null; criadaPor: string | null; responsavel: string | null;
  concluidaEm: string | null; concluidaPor: string | null;
  mentorada: { id: string; nome: string; tipo: string; whatsapp: string | null } | null;
};

const DIA = 86_400_000;
const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const fmt = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const casaTipo = (tipo: string, filtro: string) => tipo === filtro || tipo.startsWith(`${filtro} `);
const dias = (de: string, ate: string) => Math.round((Date.parse(ate) - Date.parse(de)) / DIA);
const linkWhats = (n: string) => {
  const d = n.replace(/\D/g, "");
  return d ? `https://wa.me/${d.length <= 11 ? `55${d}` : d}` : null;
};

function textoPrazo(prazo: string, hoje: string) {
  const n = dias(hoje, prazo);
  if (n < 0) return `Atrasada há ${-n} ${n === -1 ? "dia" : "dias"} (${fmt(prazo)})`;
  if (n === 0) return "Vence hoje";
  if (n === 1) return "Vence amanhã";
  return `Até ${fmt(prazo)} (${SEMANA[new Date(prazo).getUTCDay()]})`;
}

async function enviar(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.erro ?? "Não foi possível salvar. Tente de novo.");
  return j;
}

export default function TarefasCliente({
  tarefas: tarefasIni, mentoradas, podeEditar, equipe, eu,
}: { tarefas: Tarefa[]; mentoradas: { id: string; nome: string }[]; podeEditar: boolean; equipe: string[]; eu: string }) {
  const router = useRouter();
  const [tarefas, setTarefas] = useState(tarefasIni);
  const [origem, setOrigem] = useState(tarefasIni);
  if (origem !== tarefasIni) { setOrigem(tarefasIni); setTarefas(tarefasIni); }

  const [busca, setBusca] = useState("");
  const [filtTipo, setFiltTipo] = useState("");
  const [filtResp, setFiltResp] = useState("");
  const [verConcluidas, setVerConcluidas] = useState(false);
  const [cadastro, setCadastro] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const [novoTitulo, setNovoTitulo] = useState("");
  const [novaMentorada, setNovaMentorada] = useState("");
  const [novoPrazo, setNovoPrazo] = useState(hojeISO());
  const [novoResp, setNovoResp] = useState(eu);
  const [criando, setCriando] = useState(false);

  useEffect(() => {
    if (!erro) return;
    const x = setTimeout(() => setErro(null), 9000);
    return () => clearTimeout(x);
  }, [erro]);

  const hoje = hojeISO();
  const tipos = useMemo(() => {
    const set = [...new Set(tarefas.map(x => x.mentorada?.tipo).filter((s): s is string => !!s))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    const grupos = [...new Set(set.filter(x => / \d+$/.test(x)).map(x => x.replace(/ \d+$/, "")))];
    return { set, grupos };
  }, [tarefas]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return tarefas.filter(x =>
      (!filtTipo || (x.mentorada && casaTipo(x.mentorada.tipo, filtTipo))) &&
      (!filtResp || (filtResp === "-" ? !x.responsavel : x.responsavel === filtResp)) &&
      (!q || x.titulo.toLowerCase().includes(q) || (x.mentorada?.nome ?? "").toLowerCase().includes(q))
    );
  }, [tarefas, busca, filtTipo, filtResp]);

  const abertas = filtradas.filter(x => !x.concluidaEm);
  const atrasadas = abertas.filter(x => x.prazo < hoje);
  const deHoje = abertas.filter(x => x.prazo === hoje);
  const proximas = abertas.filter(x => x.prazo > hoje);
  const em7 = proximas.filter(x => dias(hoje, x.prazo) <= 7).length;
  const concluidas = filtradas
    .filter(x => x.concluidaEm)
    .sort((a, b) => (b.concluidaEm ?? "").localeCompare(a.concluidaEm ?? ""));

  const trocar = (id: string, patch: Partial<Tarefa>) => setTarefas(ts => ts.map(x => (x.id === id ? { ...x, ...patch } : x)));

  async function concluir(x: Tarefa, feita: boolean) {
    trocar(x.id, { concluidaEm: feita ? new Date().toISOString() : null, concluidaPor: feita ? "você" : null });
    try {
      const r = await enviar(`/api/tarefas/${x.id}`, "PATCH", { concluida: feita });
      trocar(x.id, { concluidaEm: r.concluidaEm, concluidaPor: r.concluidaPor });
      router.refresh();
    } catch (e) {
      trocar(x.id, { concluidaEm: x.concluidaEm, concluidaPor: x.concluidaPor });
      setErro((e as Error).message);
    }
  }

  async function mudarPrazo(x: Tarefa, prazo: string) {
    if (!prazo || prazo === x.prazo) return;
    trocar(x.id, { prazo });
    try { await enviar(`/api/tarefas/${x.id}`, "PATCH", { prazo }); router.refresh(); }
    catch (e) { trocar(x.id, { prazo: x.prazo }); setErro((e as Error).message); }
  }

  async function mudarResp(x: Tarefa, responsavel: string) {
    const novo = responsavel.trim() || null;
    if (novo === x.responsavel) return;
    trocar(x.id, { responsavel: novo });
    try { await enviar(`/api/tarefas/${x.id}`, "PATCH", { responsavel: novo ?? "" }); router.refresh(); }
    catch (e) { trocar(x.id, { responsavel: x.responsavel }); setErro((e as Error).message); }
  }

  async function excluir(x: Tarefa) {
    if (!window.confirm(`Excluir a tarefa "${x.titulo}"${x.mentorada ? ` de ${x.mentorada.nome}` : ""}?`)) return;
    try {
      await enviar(`/api/tarefas/${x.id}`, "DELETE");
      setTarefas(ts => ts.filter(y => y.id !== x.id));
      router.refresh();
    } catch (e) { setErro((e as Error).message); }
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    const nome = novaMentorada.trim().toLowerCase();
    const m = nome ? mentoradas.find(x => x.nome.toLowerCase() === nome) : null;
    if (nome && !m) { setErro("Escolha a mentorada pela lista (ou deixe em branco para uma tarefa geral)."); return; }
    setCriando(true);
    try {
      await enviar("/api/tarefas", "POST", { titulo: novoTitulo, prazo: novoPrazo, mentoradaId: m?.id ?? null, responsavel: novoResp });
      setNovoTitulo(""); setNovaMentorada(""); setNovoPrazo(hojeISO()); setNovoResp(eu);
      router.refresh();
    } catch (err) { setErro((err as Error).message); }
    setCriando(false);
  }

  const linha = (x: Tarefa) => {
    const feita = !!x.concluidaEm;
    const cls = feita ? t.feita : x.prazo < hoje ? t.atrasada : x.prazo === hoje ? t.hoje : "";
    const whats = !feita && x.mentorada?.whatsapp ? linkWhats(x.mentorada.whatsapp) : null;
    return (
      <li key={x.id} className={`${t.item} ${cls}`}>
        <input
          type="checkbox"
          className={t.check}
          checked={feita}
          disabled={!podeEditar}
          onChange={e => concluir(x, e.target.checked)}
          aria-label={feita ? `Reabrir "${x.titulo}"` : `Concluir "${x.titulo}"`}
        />
        <div className={t.corpo}>
          <div className={t.titulo}>{x.titulo}</div>
          <div className={t.meta}>
            {x.mentorada ? (
              <>
                <button className={f.nomeBtn} onClick={() => setCadastro(x.mentorada!.id)}>{x.mentorada.nome}</button>
                <span className={t.tipo}>{x.mentorada.tipo}</span>
              </>
            ) : (
              <span>Tarefa geral</span>
            )}
            <span className={t.origem}>Responsável: {x.responsavel ?? "não definido"}</span>
            <span className={t.origem}>
              {x.automatica ? `Automática${x.fase ? ` · ${x.fase}` : ""}` : x.criadaPor ? `Criada por ${x.criadaPor}` : "Manual"}
            </span>
            {feita && x.concluidaEm && (
              <span className={t.origem}>Concluída em {fmt(x.concluidaEm)}{x.concluidaPor ? ` por ${x.concluidaPor}` : ""}</span>
            )}
          </div>
        </div>
        <div className={t.lado}>
          {!feita && <span className={t.prazo}>{textoPrazo(x.prazo, hoje)}</span>}
          <div className={t.acoes}>
            {whats && <a className={t.whats} href={whats} target="_blank" rel="noreferrer">WhatsApp</a>}
            {podeEditar && !feita && (
              <select
                className={t.data}
                value={x.responsavel ?? ""}
                onChange={e => mudarResp(x, e.target.value)}
                aria-label={`Responsável por "${x.titulo}"`}
              >
                <option value="">Sem responsável</option>
                {equipe.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            )}
            {podeEditar && !feita && (
              <input
                type="date"
                className={t.data}
                value={x.prazo}
                onChange={e => mudarPrazo(x, e.target.value)}
                aria-label={`Mudar prazo de "${x.titulo}"`}
              />
            )}
            {podeEditar && (
              <button className={t.excluir} onClick={() => excluir(x)} aria-label={`Excluir "${x.titulo}"`}>Excluir</button>
            )}
          </div>
        </div>
      </li>
    );
  };

  const grupo = (titulo: string, lista: Tarefa[], vazio: string, cls = "") => (
    <section className={t.grupo}>
      <h2 className={`${t.grupoTitulo} ${cls}`}>{titulo} <span>{lista.length}</span></h2>
      {lista.length ? <ul className={t.lista}>{lista.map(linha)}</ul> : <p className={t.vazio}>{vazio}</p>}
    </section>
  );

  return (
    <>
      <div className={styles.topbar}>
        <div>
          <div className={styles.pageTitle}>Tarefas</div>
          <div className={styles.pageSub}>O que a equipe precisa fazer e até quando — as automáticas nascem quando a mentorada muda de etapa no Pipeline</div>
        </div>
      </div>
      <div className={styles.content}>
        <div className={`${styles.kpiGrid} ${styles.kpi4} ${t.kpis}`}>
          <div className={styles.kpi} style={{ "--kpi-color": "#EF4444" } as React.CSSProperties}>
            <div className={styles.kpiLabel}>Atrasadas</div>
            <div className={styles.kpiValue}>{atrasadas.length}</div>
            <div className={styles.kpiDelta}>Passaram do prazo</div>
          </div>
          <div className={styles.kpi} style={{ "--kpi-color": "#F59E0B" } as React.CSSProperties}>
            <div className={styles.kpiLabel}>Para hoje</div>
            <div className={styles.kpiValue}>{deHoje.length}</div>
            <div className={styles.kpiDelta}>Vencem hoje</div>
          </div>
          <div className={styles.kpi} style={{ "--kpi-color": "#C9A876" } as React.CSSProperties}>
            <div className={styles.kpiLabel}>Próximos 7 dias</div>
            <div className={styles.kpiValue}>{em7}</div>
            <div className={styles.kpiDelta}>Para se organizar</div>
          </div>
          <div className={styles.kpi} style={{ "--kpi-color": "#10B981" } as React.CSSProperties}>
            <div className={styles.kpiLabel}>Concluídas</div>
            <div className={styles.kpiValue}>{concluidas.length}</div>
            <div className={styles.kpiDelta}>Nos últimos 30 dias</div>
          </div>
        </div>

        {podeEditar && (
          <form className={t.nova} onSubmit={criar}>
            <input
              className={t.novaTitulo}
              value={novoTitulo}
              onChange={e => setNovoTitulo(e.target.value)}
              placeholder="Nova tarefa: o que precisa ser feito?"
              aria-label="O que precisa ser feito"
            />
            <input
              className={t.novaMentorada}
              list="tarefas-mentoradas"
              value={novaMentorada}
              onChange={e => setNovaMentorada(e.target.value)}
              placeholder="Mentorada (opcional)"
              aria-label="Mentorada"
            />
            <datalist id="tarefas-mentoradas">
              {mentoradas.map(m => <option key={m.id} value={m.nome} />)}
            </datalist>
            <input
              className={t.novaMentorada}
              list="tarefas-equipe"
              value={novoResp}
              onChange={e => setNovoResp(e.target.value)}
              placeholder="Responsável"
              aria-label="Responsável"
            />
            <datalist id="tarefas-equipe">
              {equipe.map(n => <option key={n} value={n} />)}
            </datalist>
            <input type="date" value={novoPrazo} onChange={e => setNovoPrazo(e.target.value)} aria-label="Prazo" />
            <button type="submit" className={t.btnPrim} disabled={!novoTitulo.trim() || !novoPrazo || criando}>
              {criando ? "Criando…" : "Criar tarefa"}
            </button>
          </form>
        )}

        <div className={`${f.bar} ${t.filtros}`}>
          <input
            className={`${f.select} ${t.busca}`}
            type="search"
            placeholder="Buscar tarefa ou mentorada…"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            aria-label="Buscar tarefa ou mentorada"
          />
          <select className={f.select} value={filtTipo} onChange={e => setFiltTipo(e.target.value)} aria-label="Filtrar por mentoria">
            <option value="">Todas as mentorias</option>
            {tipos.grupos.map(g => <option key={`g-${g}`} value={g}>{g} (todos)</option>)}
            {tipos.set.map(x => <option key={x} value={x}>{x}</option>)}
          </select>
          <select className={f.select} value={filtResp} onChange={e => setFiltResp(e.target.value)} aria-label="Filtrar por responsável">
            <option value="">Todos os responsáveis</option>
            {equipe.map(n => <option key={n} value={n}>{n}</option>)}
            <option value="-">Sem responsável</option>
          </select>
          <label className={t.toggle}>
            <input type="checkbox" checked={verConcluidas} onChange={e => setVerConcluidas(e.target.checked)} />
            Mostrar concluídas
          </label>
        </div>

        {grupo("Atrasadas", atrasadas, "Nenhuma tarefa atrasada.", t.tAtrasada)}
        {grupo("Para hoje", deHoje, "Nada vence hoje.", t.tHoje)}
        {grupo("Próximas", proximas, "Nenhuma tarefa para os próximos dias.")}
        {verConcluidas && grupo("Concluídas (últimos 30 dias)", concluidas, "Nenhuma tarefa concluída nos últimos 30 dias.")}
      </div>

      {erro && (
        <div className={t.aviso} role="alert">
          <span>{erro}</span>
          <button onClick={() => setErro(null)} aria-label="Fechar aviso">×</button>
        </div>
      )}

      {cadastro && (
        <MentoradaDrawer key={cadastro} id={cadastro} onClose={() => setCadastro(null)} onChanged={() => router.refresh()} />
      )}
    </>
  );
}
