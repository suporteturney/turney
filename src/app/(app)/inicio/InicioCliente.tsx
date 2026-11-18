"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import JornadaModal from "@/components/JornadaModal";
import MentoradaDrawer from "@/components/MentoradaDrawer";
import styles from "../shared.module.css";
import s from "./inicio.module.css";

type M = {
  id: string; nome: string; tipo: string; status: string; saude: string | null; saudeMotivo: string | null;
  prazo: string | null; congelamentoAte: string | null; renovacaoStatus: string | null;
  pipelineFaseId: string | null; ultimoAcompanhamento: string | null;
};
type T = {
  id: string; titulo: string; prazo: string; automatica: boolean; fase: string | null;
  mentorada: { id: string; nome: string; tipo: string } | null;
};
type Alerta = { chave: string; titulo: string; tom: "vermelho" | "amarelo" | "azul"; itens: { m: M; info: string }[] };

const fmt = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");
const DIA = 86_400_000;
const diasEntre = (de: string, ate: string) => Math.round((Date.parse(ate) - Date.parse(de)) / DIA);
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const MOSTRAR = 5;

export default function InicioCliente({
  nome, saudacao, hoje, carteiraPropria, podeConcluir, fases, mentoradas, tarefas: tarefasIni, limites,
}: {
  nome: string; saudacao: string; hoje: string; carteiraPropria: boolean; podeConcluir: boolean;
  fases: { id: string; nome: string }[]; mentoradas: M[]; tarefas: T[];
  limites: { em7: string; em15: string; ha30: string };
}) {
  const router = useRouter();
  const [tarefas, setTarefas] = useState(tarefasIni);
  const [origem, setOrigem] = useState(tarefasIni);
  if (origem !== tarefasIni) { setOrigem(tarefasIni); setTarefas(tarefasIni); }
  const [feitas, setFeitas] = useState<Set<string>>(new Set());
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [jornada, setJornada] = useState<string | null>(null);
  const [cadastro, setCadastro] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // ── Atividades (tarefas) ──
  const atrasadas = tarefas.filter(t => t.prazo < hoje);
  const deHoje = tarefas.filter(t => t.prazo === hoje);
  const proximas = tarefas.filter(t => t.prazo > hoje && t.prazo <= limites.em7);
  const depois = tarefas.filter(t => t.prazo > limites.em7).length;

  // ── O que precisa de atenção nas mentoradas ──
  const alertas: Alerta[] = [
    {
      chave: "risco", titulo: "Em risco", tom: "vermelho",
      itens: mentoradas.filter(m => m.saude === "Risco" && m.status !== "Congelado")
        .map(m => ({ m, info: m.saudeMotivo || "Sem motivo registrado" })),
    },
    {
      chave: "contrato", titulo: "Contrato acaba em até 15 dias", tom: "amarelo",
      itens: mentoradas.filter(m => m.status !== "Congelado" && m.prazo && m.prazo >= hoje && m.prazo <= limites.em15)
        .sort((a, b) => (a.prazo ?? "").localeCompare(b.prazo ?? ""))
        .map(m => ({ m, info: `Acaba em ${fmt(m.prazo)} (${plural(diasEntre(hoje, m.prazo!), "dia", "dias")})${m.renovacaoStatus ? ` · ${m.renovacaoStatus}` : " · renovação não iniciada"}` })),
    },
    {
      chave: "congelamento", titulo: "Congelamento termina em até 7 dias", tom: "azul",
      itens: mentoradas.filter(m => m.status === "Congelado" && m.congelamentoAte && m.congelamentoAte <= limites.em7)
        .map(m => ({ m, info: `Volta em ${fmt(m.congelamentoAte)} — combinar a retomada` })),
    },
    {
      chave: "contato", titulo: "Sem acompanhamento há mais de 30 dias", tom: "amarelo",
      itens: mentoradas.filter(m => m.status !== "Congelado" && (!m.ultimoAcompanhamento || m.ultimoAcompanhamento < limites.ha30))
        .sort((a, b) => (a.ultimoAcompanhamento ?? "").localeCompare(b.ultimoAcompanhamento ?? ""))
        .map(m => ({ m, info: m.ultimoAcompanhamento ? `Último em ${fmt(m.ultimoAcompanhamento)} (há ${diasEntre(m.ultimoAcompanhamento, hoje)} dias)` : "Nenhum acompanhamento registrado" })),
    },
  ].filter(a => a.itens.length) as Alerta[];
  const pontos = alertas.reduce((n, a) => n + a.itens.length, 0);

  // ── Carteira ──
  const ativas = mentoradas.filter(m => m.status !== "Congelado").length;
  const contar = (f: (m: M) => boolean) => mentoradas.filter(f).length;
  const porFase = fases.map(f => ({ ...f, n: contar(m => m.pipelineFaseId === f.id) }));
  const maxFase = Math.max(1, ...porFase.map(f => f.n));

  const resumo = [
    deHoje.length ? plural(deHoje.length, "atividade para hoje", "atividades para hoje") : "",
    atrasadas.length ? plural(atrasadas.length, "atividade atrasada", "atividades atrasadas") : "",
    pontos ? plural(pontos, "ponto de atenção", "pontos de atenção") : "",
  ].filter(Boolean);
  const dataExtenso = new Date(`${hoje}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  async function concluir(t: T) {
    setFeitas(f => new Set(f).add(t.id));
    try {
      const res = await fetch(`/api/tarefas/${t.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ concluida: true }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).erro ?? "Não foi possível concluir. Tente de novo.");
      setTimeout(() => { setTarefas(ts => ts.filter(x => x.id !== t.id)); router.refresh(); }, 600);
    } catch (e) {
      setFeitas(f => { const n = new Set(f); n.delete(t.id); return n; });
      setErro((e as Error).message);
    }
  }

  const alternar = (k: string) => setAbertos(a => { const n = new Set(a); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  const linhaTarefa = (t: T) => {
    const feita = feitas.has(t.id);
    const tom = t.prazo < hoje ? s.tAtrasada : t.prazo === hoje ? s.tHoje : "";
    return (
      <li key={t.id} className={`${s.tarefa} ${tom} ${feita ? s.tFeita : ""}`}>
        <input
          type="checkbox" className={s.check} checked={feita} disabled={!podeConcluir || feita}
          onChange={() => concluir(t)} aria-label={`Concluir "${t.titulo}"`}
        />
        <div className={s.tCorpo}>
          <div className={s.tTitulo}>{t.titulo}</div>
          <div className={s.tMeta}>
            {t.mentorada
              ? <button className={s.nome} onClick={() => setJornada(t.mentorada!.id)}>{t.mentorada.nome}</button>
              : <span>Tarefa geral</span>}
            {t.automatica && t.fase && <span>· {t.fase}</span>}
          </div>
        </div>
        <span className={s.tPrazo}>
          {t.prazo < hoje ? `atrasada ${plural(diasEntre(t.prazo, hoje), "dia", "dias")}` : t.prazo === hoje ? "hoje" : fmt(t.prazo).slice(0, 5)}
        </span>
      </li>
    );
  };

  const grupoTarefas = (titulo: string, lista: T[]) =>
    lista.length ? (
      <div className={s.tGrupo}>
        <h3 className={s.tGrupoTitulo}>{titulo} <span>{lista.length}</span></h3>
        <ul className={s.tLista}>{lista.map(linhaTarefa)}</ul>
      </div>
    ) : null;

  return (
    <>
      <div className={styles.content}>
        <header className={s.hero}>
          <p className={s.data}>{dataExtenso}</p>
          <h1 className={s.saudacao}>{saudacao}, {nome}</h1>
          <p className={s.resumo}>
            {resumo.length
              ? <>Você tem <strong>{resumo.join(", ").replace(/, ([^,]*)$/, " e $1")}</strong>.</>
              : "Tudo em dia por aqui. Nenhuma atividade pendente para hoje."}
          </p>
          {!carteiraPropria && (
            <p className={s.aviso}>Você ainda não é responsável nem tutora de nenhuma mentorada, então este painel mostra a base toda.</p>
          )}
        </header>

        <div className={s.grade}>
          <section className={s.bloco} aria-labelledby="urgente-titulo">
            <div className={s.blocoTopo}>
              <h2 id="urgente-titulo" className={s.blocoTitulo}>Precisa da sua atenção</h2>
              <span className={s.blocoConta}>{pontos}</span>
            </div>
            {!alertas.length && <p className={s.vazio}>Nada urgente nas suas mentoradas.</p>}
            {alertas.map(a => {
              const aberto = abertos.has(a.chave);
              const lista = aberto ? a.itens : a.itens.slice(0, MOSTRAR);
              return (
                <div key={a.chave} className={`${s.alerta} ${s[a.tom]}`}>
                  <h3 className={s.alertaTitulo}><span className={s.ponto} aria-hidden="true" />{a.titulo} <b>{a.itens.length}</b></h3>
                  <ul className={s.alertaLista}>
                    {lista.map(({ m, info }) => (
                      <li key={m.id}>
                        <button className={s.nome} onClick={() => setJornada(m.id)}>{m.nome}</button>
                        <span className={s.tipo}>{m.tipo}</span>
                        <div className={s.info}>{info}</div>
                      </li>
                    ))}
                  </ul>
                  {a.itens.length > MOSTRAR && (
                    <button className={s.mais} onClick={() => alternar(a.chave)}>
                      {aberto ? "Mostrar menos" : `Ver todas as ${a.itens.length}`}
                    </button>
                  )}
                </div>
              );
            })}
          </section>

          <section className={s.bloco} aria-labelledby="atividades-titulo">
            <div className={s.blocoTopo}>
              <h2 id="atividades-titulo" className={s.blocoTitulo}>Suas atividades</h2>
              <Link href="/tarefas" className={s.link}>Ver todas →</Link>
            </div>
            {!atrasadas.length && !deHoje.length && !proximas.length && (
              <p className={s.vazio}>Nenhuma atividade para os próximos 7 dias.</p>
            )}
            {grupoTarefas("Atrasadas", atrasadas)}
            {grupoTarefas("Hoje", deHoje)}
            {grupoTarefas("Próximos 7 dias", proximas)}
            {depois > 0 && <p className={s.depois}>E mais {plural(depois, "atividade", "atividades")} depois disso.</p>}
          </section>
        </div>

        <section className={`${s.bloco} ${s.carteira}`} aria-labelledby="carteira-titulo">
          <div className={s.blocoTopo}>
            <h2 id="carteira-titulo" className={s.blocoTitulo}>{carteiraPropria ? "Sua carteira" : "Base ativa"}</h2>
            <Link href="/pipeline" className={s.link}>Abrir Pipeline →</Link>
          </div>
          <div className={s.numeros}>
            <div><strong>{ativas}</strong><span>ativas</span></div>
            <div><strong>{contar(m => m.saude === "Risco")}</strong><span>em risco</span></div>
            <div><strong>{contar(m => m.status === "Em Renovação")}</strong><span>em renovação</span></div>
            <div><strong>{contar(m => m.status === "Congelado")}</strong><span>congeladas</span></div>
          </div>
          {porFase.some(f => f.n) && (
            <ul className={s.fases} aria-label="Mentoradas por etapa do Pipeline">
              {porFase.map(f => (
                <li key={f.id}>
                  <span className={s.faseNome}>{f.nome}</span>
                  <span className={s.faseTrilho}><span style={{ width: `${(f.n / maxFase) * 100}%` }} /></span>
                  <span className={s.faseN}>{f.n}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {erro && (
        <div className={s.erro} role="alert">
          <span>{erro}</span>
          <button onClick={() => setErro(null)} aria-label="Fechar aviso">×</button>
        </div>
      )}
      {jornada && (
        <JornadaModal key={jornada} id={jornada} onClose={() => setJornada(null)} onAbrirCadastro={() => { setCadastro(jornada); setJornada(null); }} />
      )}
      {cadastro && <MentoradaDrawer key={cadastro} id={cadastro} onClose={() => setCadastro(null)} onChanged={() => router.refresh()} />}
    </>
  );
}
