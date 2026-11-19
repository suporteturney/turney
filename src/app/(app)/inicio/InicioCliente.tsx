"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import JornadaModal from "@/components/JornadaModal";
import MentoradaDrawer, { type Aba } from "@/components/MentoradaDrawer";
import styles from "../shared.module.css";
import s from "./inicio.module.css";

type M = {
  id: string; nome: string; tipo: string; status: string; saude: string | null; saudeMotivo: string | null; whatsapp: string | null;
  prazo: string | null; congelamentoAte: string | null; renovacaoStatus: string | null;
  pipelineFaseId: string | null; ultimoAcompanhamento: string | null;
};
type T = {
  id: string; titulo: string; prazo: string; automatica: boolean; fase: string | null;
  responsavel: string | null; dono: string | null; criadaPor: string | null;
  concluidaEm: string | null; concluidaPor: string | null;
  mentorada: { id: string; nome: string; tipo: string; whatsapp: string | null } | null;
};
type Enc = {
  id: string; nome: string; tipo: string; status: string; prazo: string; renovacaoStatus: string | null;
  saude: string | null; whatsapp: string | null; cuida: string | null;
};
type Pessoa = { nome: string; papel: string };
type Tom = "vermelho" | "amarelo" | "azul";
type Motivo = { txt: string; peso: number; tom: Tom };
type Janela = { modo: "nova"; prazo: string; responsavel: string; mentoradaId?: string } | { modo: "editar"; t: T };

const DIA = 86_400_000;
const fmt = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");
const somar = (iso: string, n: number) => new Date(Date.parse(iso) + n * DIA).toISOString().slice(0, 10);
const diasEntre = (de: string, ate: string) => Math.round((Date.parse(ate) - Date.parse(de)) / DIA);
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex"];
const MOSTRAR_PRIO = 8;
const PAPEL: Record<string, string> = { admin: "Administradora", mentora: "Mentora", suporte: "Suporte", leitura: "Somente leitura", "sem acesso": "ainda sem acesso à plataforma" };
const linkWhats = (n: string | null) => {
  const d = (n ?? "").replace(/\D/g, "");
  return d ? `https://wa.me/${d.length <= 11 ? `55${d}` : d}` : null;
};
const iniciais = (nome: string) => nome.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join("").toUpperCase();
const CORES = ["#73452B", "#2F4A6B", "#5B6B3A", "#7A3E5C", "#3F6E6A", "#8A5A1F"];
const corDe = (nome: string) => CORES[[...nome].reduce((a, c) => a + c.charCodeAt(0), 0) % CORES.length];
const juntar = (xs: string[]) => xs.join(", ").replace(/, ([^,]*)$/, " e $1");

async function enviar(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.erro ?? "Não foi possível salvar. Tente de novo.");
  return j;
}

// Por que a mentorada precisa de contato hoje (quanto maior o peso, mais urgente).
function motivosDe(m: M, hoje: string, tarefas: T[]): Motivo[] {
  const r: Motivo[] = [];
  const congelada = m.status === "Congelado";
  if (!congelada && m.saude === "Risco") r.push({ txt: "Em risco", peso: 50, tom: "vermelho" });
  else if (!congelada && m.saude === "Atenção") r.push({ txt: "Saúde em atenção", peso: 15, tom: "amarelo" });
  if (!congelada && m.prazo && m.prazo >= hoje) {
    const d = diasEntre(hoje, m.prazo);
    if (d <= 15) {
      r.push({ txt: d === 0 ? "Contrato acaba hoje" : `Contrato acaba em ${plural(d, "dia", "dias")}`, peso: d <= 7 ? 40 : 25, tom: d <= 7 ? "vermelho" : "amarelo" });
      if (!m.renovacaoStatus) r.push({ txt: "Renovação não iniciada", peso: 10, tom: "amarelo" });
    }
  }
  if (congelada && m.congelamentoAte && diasEntre(hoje, m.congelamentoAte) <= 7) {
    r.push({ txt: `Volta do congelamento em ${fmt(m.congelamentoAte).slice(0, 5)}`, peso: 30, tom: "azul" });
  }
  if (!congelada) {
    if (!m.ultimoAcompanhamento) r.push({ txt: "Nenhum acompanhamento registrado", peso: 25, tom: "amarelo" });
    else {
      const d = diasEntre(m.ultimoAcompanhamento, hoje);
      if (d > 30) r.push({ txt: `Sem acompanhamento há ${d} dias`, peso: 20 + Math.min(20, Math.floor((d - 30) / 3)), tom: "amarelo" });
    }
  }
  const abertas = tarefas.filter(t => !t.concluidaEm && t.mentorada?.id === m.id);
  const atrasadas = abertas.filter(t => t.prazo < hoje).length;
  if (atrasadas) r.push({ txt: plural(atrasadas, "tarefa atrasada", "tarefas atrasadas"), peso: 15 * Math.min(atrasadas, 2), tom: "vermelho" });
  else if (abertas.some(t => t.prazo === hoje)) r.push({ txt: "Tarefa para hoje", peso: 10, tom: "amarelo" });
  return r;
}

export default function InicioCliente({
  eu, nome, saudacao, hoje, segunda, carteiraPropria, gestora, podeEditar, equipe, fases, todasMentoradas, mentoradas, encerrando, tarefas: tarefasIni,
}: {
  eu: string; nome: string; saudacao: string; hoje: string; segunda: string; carteiraPropria: boolean; gestora: boolean; podeEditar: boolean;
  equipe: Pessoa[]; fases: { id: string; nome: string }[]; todasMentoradas: { id: string; nome: string }[];
  mentoradas: M[]; encerrando: Enc[]; tarefas: T[];
}) {
  const router = useRouter();
  const conteudo = useRef<HTMLDivElement>(null);
  const [tarefas, setTarefas] = useState(tarefasIni);
  const [origem, setOrigem] = useState(tarefasIni);
  if (origem !== tarefasIni) { setOrigem(tarefasIni); setTarefas(tarefasIni); }

  const [pessoa, setPessoa] = useState<string>(eu); // filtro da semana: um nome ou "" (equipe toda)
  const [semana, setSemana] = useState(0);
  const [janela, setJanela] = useState<Janela | null>(null);
  const [jornada, setJornada] = useState<string | null>(null);
  const [cadastro, setCadastro] = useState<{ id: string; aba: Aba } | null>(null);
  const [aviso, setAviso] = useState<{ txt: string; erro?: boolean } | null>(null);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [prioTodas, setPrioTodas] = useState(false);
  const [encAba, setEncAba] = useState<"esta" | "proxima">("esta");

  useEffect(() => {
    if (!aviso) return;
    const x = setTimeout(() => setAviso(null), aviso.erro ? 9000 : 4000);
    return () => clearTimeout(x);
  }, [aviso]);

  const trocar = (id: string, patch: Partial<T>) => setTarefas(ts => ts.map(x => (x.id === id ? { ...x, ...patch } : x)));
  const erro = (e: unknown) => setAviso({ txt: (e as Error).message, erro: true });

  // ── Seu dia ──
  const minhas = tarefas.filter(t => t.dono === eu);
  const minhasAbertas = minhas.filter(t => !t.concluidaEm);
  const atrasadas = minhasAbertas.filter(t => t.prazo < hoje);
  const deHoje = minhasAbertas.filter(t => t.prazo === hoje);
  const feitasHoje = minhas.filter(t => t.concluidaEm === hoje).length;

  // ── Mentoradas para acompanhar hoje, por prioridade ──
  const jaHoje = mentoradas.filter(m => m.ultimoAcompanhamento === hoje).length;
  const prioridade = mentoradas
    .filter(m => m.ultimoAcompanhamento !== hoje)
    .map(m => {
      const motivos = motivosDe(m, hoje, tarefas).sort((a, b) => b.peso - a.peso);
      return { m, motivos, peso: motivos.reduce((n, x) => n + x.peso, 0) };
    })
    .filter(p => p.peso > 0)
    .sort((a, b) => b.peso - a.peso || a.m.nome.localeCompare(b.m.nome, "pt-BR"));
  const nivel = (peso: number) => (peso >= 50 ? { txt: "Alta", cls: s.pAlta } : peso >= 25 ? { txt: "Média", cls: s.pMedia } : { txt: "Baixa", cls: s.pBaixa });

  // ── Semana (estilo calendário) ──
  const inicio = somar(segunda, semana * 7);
  const dias = SEMANA.map((rot, i) => ({ rot, iso: somar(inicio, i) }));
  const sabado = somar(inicio, 5);
  const domingo = somar(inicio, 6);
  const naSemana = tarefas.filter(t => (pessoa ? t.dono === pessoa : true));
  const atrasadasQuadro = semana === 0 ? naSemana.filter(t => !t.concluidaEm && t.prazo < inicio) : [];
  const fimDeSemana = naSemana.filter(t => t.prazo === sabado || t.prazo === domingo);
  const rotuloSemana = `${fmt(inicio).slice(0, 5)} a ${fmt(domingo).slice(0, 5)}`;

  // ── Encerrando ──
  const fimEsta = somar(segunda, 6);
  const encEsta = encerrando.filter(m => m.prazo <= fimEsta);
  const encProx = encerrando.filter(m => m.prazo > fimEsta);
  const encLista = encAba === "esta" ? encEsta : encProx;

  // ── Equipe ──
  const porPessoa = equipe.map(p => {
    const ts = tarefas.filter(t => t.dono === p.nome);
    const ab = ts.filter(t => !t.concluidaEm);
    return {
      ...p,
      atrasadas: ab.filter(t => t.prazo < hoje).length,
      hoje: ab.filter(t => t.prazo === hoje).length,
      semana: ab.filter(t => t.prazo > hoje && t.prazo <= fimEsta).length,
      feitas: ts.filter(t => t.concluidaEm && t.concluidaEm >= segunda).length,
    };
  });
  const semDono = tarefas.filter(t => !t.concluidaEm && !t.dono).length;
  const eu4 = porPessoa.find(p => p.nome === eu);

  // ── Carteira ──
  const contar = (f: (m: M) => boolean) => mentoradas.filter(f).length;
  const porFase = fases.map(f => ({ ...f, n: contar(m => m.pipelineFaseId === f.id) }));
  const maxFase = Math.max(1, ...porFase.map(f => f.n));

  const resumo = [
    deHoje.length ? plural(deHoje.length, "tarefa para hoje", "tarefas para hoje") : "",
    atrasadas.length ? plural(atrasadas.length, "tarefa atrasada", "tarefas atrasadas") : "",
    prioridade.length ? plural(prioridade.length, "mentorada para acompanhar", "mentoradas para acompanhar") : "",
    encEsta.length ? `${plural(encEsta.length, "mentorada encerrando", "mentoradas encerrando")} a mentoria esta semana` : "",
  ].filter(Boolean);
  const dataExtenso = new Date(`${hoje}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  // ── Ações ──
  async function concluir(t: T, feita: boolean) {
    const antes = { concluidaEm: t.concluidaEm, concluidaPor: t.concluidaPor };
    trocar(t.id, { concluidaEm: feita ? hoje : null, concluidaPor: feita ? eu : null });
    try {
      await enviar(`/api/tarefas/${t.id}`, "PATCH", { concluida: feita });
      if (feita) setAviso({ txt: `Concluída: ${t.titulo}` });
      router.refresh();
    } catch (e) { trocar(t.id, antes); erro(e); }
  }

  async function moverPara(id: string, prazo: string) {
    const t = tarefas.find(x => x.id === id);
    if (!t || t.prazo === prazo) return;
    trocar(id, { prazo });
    try {
      await enviar(`/api/tarefas/${id}`, "PATCH", { prazo });
      setAviso({ txt: `"${t.titulo}" passou para ${fmt(prazo).slice(0, 5)}` });
      router.refresh();
    } catch (e) { trocar(id, { prazo: t.prazo }); erro(e); }
  }

  // Rola só a área do painel até a semana (sem mexer no menu lateral).
  const verSemana = () => {
    const box = conteudo.current;
    const alvo = document.getElementById("semana");
    if (!box || !alvo) return;
    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    box.scrollTo({ top: box.scrollTop + alvo.getBoundingClientRect().top - box.getBoundingClientRect().top - 12, behavior: reduzir ? "auto" : "smooth" });
  };

  const novaTarefa = (prazo = hoje, extra: { responsavel?: string; mentoradaId?: string } = {}) =>
    setJanela({ modo: "nova", prazo, responsavel: extra.responsavel ?? (pessoa || eu), mentoradaId: extra.mentoradaId });

  // ── Peças ──
  const avatar = (nomeP: string | null, peq = false) =>
    nomeP ? (
      <span className={`${s.avatar} ${peq ? s.avatarPeq : ""}`} style={{ background: corDe(nomeP) }} title={nomeP} aria-hidden="true">
        {iniciais(nomeP)}
      </span>
    ) : (
      <span className={`${s.avatar} ${s.avatarVazio} ${peq ? s.avatarPeq : ""}`} title="Sem responsável" aria-hidden="true">?</span>
    );

  const linhaDia = (t: T) => {
    const whats = linkWhats(t.mentorada?.whatsapp ?? null);
    const atrasada = t.prazo < hoje;
    return (
      <li key={t.id} className={`${s.dLinha} ${atrasada ? s.dAtrasada : s.dHoje}`}>
        <input
          type="checkbox" className={s.check} checked={false} disabled={!podeEditar}
          onChange={() => concluir(t, true)} aria-label={`Concluir "${t.titulo}"`}
        />
        <div className={s.dCorpo}>
          <button className={s.dTitulo} onClick={() => setJanela({ modo: "editar", t })}>{t.titulo}</button>
          <div className={s.meta}>
            {t.mentorada
              ? <button className={s.nome} onClick={() => setJornada(t.mentorada!.id)}>{t.mentorada.nome}</button>
              : <span>Tarefa geral</span>}
            {t.automatica && t.fase && <span>· {t.fase}</span>}
          </div>
        </div>
        {whats && <a className={s.whats} href={whats} target="_blank" rel="noreferrer">WhatsApp</a>}
        <span className={s.dPrazo}>{atrasada ? `há ${plural(diasEntre(t.prazo, hoje), "dia", "dias")}` : "hoje"}</span>
      </li>
    );
  };

  const cartao = (t: T) => {
    const feita = !!t.concluidaEm;
    const atrasada = !feita && t.prazo < hoje;
    return (
      <li
        key={t.id}
        className={`${s.cartao} ${feita ? s.cFeita : ""} ${atrasada ? s.cAtrasada : ""} ${arrastando === t.id ? s.cArrastando : ""}`}
        draggable={podeEditar && !feita}
        onDragStart={e => { e.dataTransfer.setData("text/plain", t.id); e.dataTransfer.effectAllowed = "move"; setArrastando(t.id); }}
        onDragEnd={() => { setArrastando(null); setSobre(null); }}
      >
        <input
          type="checkbox" className={s.check} checked={feita} disabled={!podeEditar}
          onChange={e => concluir(t, e.target.checked)} aria-label={feita ? `Reabrir "${t.titulo}"` : `Concluir "${t.titulo}"`}
        />
        <div className={s.cCorpo}>
          <button className={s.cTitulo} onClick={() => setJanela({ modo: "editar", t })}>{t.titulo}</button>
          {t.mentorada && <span className={s.cMentorada}>{t.mentorada.nome}</span>}
          {atrasada && <span className={s.cAtraso}>venceu {fmt(t.prazo).slice(0, 5)}</span>}
        </div>
        {!pessoa && avatar(t.dono, true)}
      </li>
    );
  };

  const coluna = (chave: string, titulo: React.ReactNode, lista: T[], destino: string | null, extra = "") => (
    <div
      key={chave}
      className={`${s.col} ${extra} ${sobre === chave ? s.colSobre : ""}`}
      onDragOver={destino && podeEditar ? e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (sobre !== chave) setSobre(chave); } : undefined}
      onDragLeave={destino ? e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setSobre(null); } : undefined}
      onDrop={destino ? e => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); setSobre(null); setArrastando(null); if (id) moverPara(id, destino); } : undefined}
    >
      <div className={s.colTopo}>{titulo}</div>
      <ul className={s.colLista}>{lista.map(cartao)}</ul>
      {destino && podeEditar && (
        <button className={s.colAdd} onClick={() => novaTarefa(destino)}>+ Adicionar</button>
      )}
    </div>
  );

  return (
    <>
      <div className={styles.content} ref={conteudo}>
        <header className={s.hero}>
          <div className={s.heroTexto}>
            <p className={s.data}>{dataExtenso}</p>
            <h1 className={s.saudacao}>{saudacao}, {nome}</h1>
            <p className={s.resumo}>
              {resumo.length
                ? <>Hoje você tem <strong>{juntar(resumo)}</strong>.</>
                : "Tudo em dia por aqui. Nenhuma tarefa pendente para hoje."}
              {feitasHoje > 0 && <> Você já concluiu {plural(feitasHoje, "tarefa", "tarefas")} hoje.</>}
            </p>
            {!carteiraPropria && (
              <p className={s.aviso}>Você ainda não é responsável nem tutora de nenhuma mentorada, então a lista de mentoradas mostra a base toda.</p>
            )}
          </div>
          {podeEditar && <button className={s.btnPrim} onClick={() => novaTarefa()}>+ Nova tarefa</button>}
        </header>

        {/* Seu dia */}
        <div className={s.grade}>
          <section className={s.bloco} aria-labelledby="dia-titulo">
            <div className={s.blocoTopo}>
              <h2 id="dia-titulo" className={s.blocoTitulo}>Para fazer hoje</h2>
              <span className={s.blocoConta}>{atrasadas.length + deHoje.length}</span>
            </div>
            {!atrasadas.length && !deHoje.length && (
              <p className={s.vazio}>
                Nenhuma tarefa sua para hoje.{" "}
                {podeEditar && <button className={s.linkBtn} onClick={() => novaTarefa()}>Criar uma tarefa</button>}
              </p>
            )}
            {atrasadas.length > 0 && (
              <div className={s.dGrupo}>
                <h3 className={`${s.dGrupoTitulo} ${s.tVermelho}`}>Atrasadas <span>{atrasadas.length}</span></h3>
                <ul className={s.dLista}>{atrasadas.map(linhaDia)}</ul>
              </div>
            )}
            {deHoje.length > 0 && (
              <div className={s.dGrupo}>
                <h3 className={`${s.dGrupoTitulo} ${s.tAmarelo}`}>Hoje <span>{deHoje.length}</span></h3>
                <ul className={s.dLista}>{deHoje.map(linhaDia)}</ul>
              </div>
            )}
          </section>

          <section className={s.bloco} aria-labelledby="prio-titulo">
            <div className={s.blocoTopo}>
              <h2 id="prio-titulo" className={s.blocoTitulo}>Mentoradas para acompanhar hoje</h2>
              <span className={s.blocoConta}>{prioridade.length}</span>
            </div>
            <p className={s.legenda}>
              Da mais urgente para a menos urgente: risco, contrato acabando, volta de congelamento, tempo sem acompanhamento e tarefas atrasadas.
              {jaHoje > 0 && <> {plural(jaHoje, "mentorada já foi acompanhada", "mentoradas já foram acompanhadas")} hoje.</>}
            </p>
            {!prioridade.length && <p className={s.vazio}>Ninguém precisa de contato urgente hoje.</p>}
            <ol className={s.prio}>
              {(prioTodas ? prioridade : prioridade.slice(0, MOSTRAR_PRIO)).map(({ m, motivos, peso }) => {
                const nv = nivel(peso);
                const whats = linkWhats(m.whatsapp);
                return (
                  <li key={m.id} className={s.pItem}>
                    <span className={`${s.pNivel} ${nv.cls}`}>{nv.txt}</span>
                    <div className={s.pCorpo}>
                      <div className={s.pTopo}>
                        <button className={s.nome} onClick={() => setJornada(m.id)}>{m.nome}</button>
                        <span className={s.tipo}>{m.tipo}</span>
                      </div>
                      <div className={s.chips}>
                        {motivos.map(x => <span key={x.txt} className={`${s.chip} ${s[x.tom]}`}>{x.txt}</span>)}
                      </div>
                      {m.saude === "Risco" && m.saudeMotivo && <p className={s.pMotivo}>{m.saudeMotivo}</p>}
                    </div>
                    <div className={s.pAcoes}>
                      {whats && <a className={s.whats} href={whats} target="_blank" rel="noreferrer">WhatsApp</a>}
                      <button className={s.btnMini} onClick={() => setCadastro({ id: m.id, aba: "acomp" })}>Registrar</button>
                    </div>
                  </li>
                );
              })}
            </ol>
            {prioridade.length > MOSTRAR_PRIO && (
              <button className={s.mais} onClick={() => setPrioTodas(v => !v)}>
                {prioTodas ? "Mostrar menos" : `Ver todas as ${prioridade.length}`}
              </button>
            )}
          </section>
        </div>

        {/* Semana */}
        <section className={`${s.bloco} ${s.semana}`} aria-labelledby="semana-titulo" id="semana">
          <div className={s.semanaTopo}>
            <h2 id="semana-titulo" className={s.blocoTitulo}>
              {pessoa === eu ? "Sua semana" : pessoa ? `Semana de ${pessoa.split(" ")[0]}` : "Semana da equipe"}
            </h2>
            <div className={s.nav}>
              <button className={s.navBtn} onClick={() => setSemana(w => w - 1)} aria-label="Semana anterior">‹</button>
              <button className={s.navHoje} onClick={() => setSemana(0)} disabled={semana === 0}>Hoje</button>
              <button className={s.navBtn} onClick={() => setSemana(w => w + 1)} aria-label="Próxima semana">›</button>
              <span className={s.navRotulo}>{rotuloSemana}</span>
            </div>
            {gestora && equipe.length > 1 && (
              <div className={s.pessoas} role="group" aria-label="Ver tarefas de">
                {equipe.map(p => (
                  <button key={p.nome} className={`${s.pessoaBtn} ${pessoa === p.nome ? s.pessoaOn : ""}`} onClick={() => setPessoa(p.nome)} aria-pressed={pessoa === p.nome}>
                    {avatar(p.nome, true)} {p.nome === eu ? "Minhas" : p.nome.split(" ")[0]}
                  </button>
                ))}
                <button className={`${s.pessoaBtn} ${pessoa === "" ? s.pessoaOn : ""}`} onClick={() => setPessoa("")} aria-pressed={pessoa === ""}>
                  Equipe toda
                </button>
              </div>
            )}
          </div>
          {podeEditar && <p className={s.legenda}>Arraste uma tarefa para outro dia para mudar o prazo. Clique no texto da tarefa para editar ou trocar o responsável.</p>}
          <div className={s.quadro}>
            {atrasadasQuadro.length > 0 &&
              coluna("atrasadas", <><span className={s.colDia}>Atrasadas</span><span className={`${s.colNum} ${s.colNumAtraso}`}>{atrasadasQuadro.length}</span></>, atrasadasQuadro, null, s.colAtrasadas)}
            {dias.map(d =>
              coluna(
                d.iso,
                <>
                  <span className={s.colDia}>{d.rot}</span>
                  <span className={`${s.colNum} ${d.iso === hoje ? s.colHoje : ""}`}>{+d.iso.slice(8)}</span>
                </>,
                naSemana.filter(t => t.prazo === d.iso).sort((a, b) => Number(!!a.concluidaEm) - Number(!!b.concluidaEm)),
                d.iso,
                d.iso < hoje ? s.colPassado : "",
              ),
            )}
            {coluna(
              "fds",
              <>
                <span className={s.colDia}>Sáb/Dom</span>
                <span className={`${s.colNum} ${hoje === sabado || hoje === domingo ? s.colHoje : ""}`}>{+sabado.slice(8)}–{+domingo.slice(8)}</span>
              </>,
              fimDeSemana,
              sabado,
              s.colFds,
            )}
          </div>
        </section>

        <div className={s.grade}>
          {/* Encerrando */}
          <section className={s.bloco} aria-labelledby="enc-titulo">
            <div className={s.blocoTopo}>
              <h2 id="enc-titulo" className={s.blocoTitulo}>Encerrando a mentoria</h2>
              <div className={s.abas} role="tablist">
                <button role="tab" aria-selected={encAba === "esta"} className={`${s.aba} ${encAba === "esta" ? s.abaOn : ""}`} onClick={() => setEncAba("esta")}>
                  Esta semana <b>{encEsta.length}</b>
                </button>
                <button role="tab" aria-selected={encAba === "proxima"} className={`${s.aba} ${encAba === "proxima" ? s.abaOn : ""}`} onClick={() => setEncAba("proxima")}>
                  Próxima <b>{encProx.length}</b>
                </button>
              </div>
            </div>
            {!encLista.length && <p className={s.vazio}>Ninguém encerra a mentoria {encAba === "esta" ? "esta semana" : "na próxima semana"}.</p>}
            <ul className={s.encLista}>
              {encLista.map(m => {
                const whats = linkWhats(m.whatsapp);
                const d = diasEntre(hoje, m.prazo);
                const quando = d < 0 ? `encerrou ${fmt(m.prazo).slice(0, 5)}` : d === 0 ? "encerra hoje" : `encerra ${fmt(m.prazo).slice(0, 5)} (${plural(d, "dia", "dias")})`;
                return (
                  <li key={m.id} className={s.encItem}>
                    <div className={s.encData}>
                      <strong>{+m.prazo.slice(8)}</strong>
                      <span>{new Date(`${m.prazo}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}</span>
                    </div>
                    <div className={s.pCorpo}>
                      <div className={s.pTopo}>
                        <button className={s.nome} onClick={() => setJornada(m.id)}>{m.nome}</button>
                        <span className={s.tipo}>{m.tipo}</span>
                      </div>
                      <div className={s.chips}>
                        <span className={`${s.chip} ${d <= 0 ? s.vermelho : s.amarelo}`}>{quando}</span>
                        <span className={`${s.chip} ${m.renovacaoStatus ? s.neutro : s.vermelho}`}>{m.renovacaoStatus ?? "Renovação não iniciada"}</span>
                        {m.saude === "Risco" && <span className={`${s.chip} ${s.vermelho}`}>Em risco</span>}
                        {gestora && m.cuida && <span className={s.cuida}>com {m.cuida.split(" ")[0]}</span>}
                      </div>
                    </div>
                    <div className={s.pAcoes}>
                      {whats && <a className={s.whats} href={whats} target="_blank" rel="noreferrer">WhatsApp</a>}
                      {podeEditar && (
                        <button className={s.btnMini} onClick={() => novaTarefa(hoje, { mentoradaId: m.id })}>Criar tarefa</button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Equipe (gestora) ou os números da própria pessoa */}
          {gestora ? (
            <section className={s.bloco} aria-labelledby="equipe-titulo">
              <div className={s.blocoTopo}>
                <h2 id="equipe-titulo" className={s.blocoTitulo}>Sua equipe</h2>
                <Link href="/equipe" className={s.link}>Gerenciar acessos →</Link>
              </div>
              <div className={s.tabelaWrap}>
                <table className={s.tabela}>
                  <thead>
                    <tr>
                      <th scope="col">Pessoa</th><th scope="col">Atrasadas</th><th scope="col">Hoje</th>
                      <th scope="col" title="Vencem até domingo">Semana</th><th scope="col" title="Concluídas desde segunda">Feitas</th><th scope="col"><span className={s.sr}>Ações</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {porPessoa.map(p => (
                      <tr key={p.nome}>
                        <th scope="row">
                          <button
                            className={s.pessoaLinha}
                            onClick={() => { setPessoa(p.nome); setSemana(0); verSemana(); }}
                            title="Ver a semana desta pessoa"
                          >
                            {avatar(p.nome)}
                            <span>
                              <b>{p.nome === eu ? `${p.nome.split(" ")[0]} (você)` : p.nome}</b>
                              <small>{PAPEL[p.papel] ?? p.papel}</small>
                            </span>
                          </button>
                        </th>
                        <td className={p.atrasadas ? s.nVermelho : s.nZero}>{p.atrasadas}</td>
                        <td className={p.hoje ? s.nAmarelo : s.nZero}>{p.hoje}</td>
                        <td className={p.semana ? "" : s.nZero}>{p.semana}</td>
                        <td className={p.feitas ? s.nVerde : s.nZero}>{p.feitas}</td>
                        <td>
                          {podeEditar && (
                            <button className={s.btnMini} onClick={() => novaTarefa(hoje, { responsavel: p.nome })} aria-label={`Criar tarefa para ${p.nome}`}>+ Tarefa</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {semDono > 0 && <p className={s.legenda}>{plural(semDono, "tarefa aberta está", "tarefas abertas estão")} sem responsável. Veja em “Equipe toda”.</p>}
              {!porPessoa.some(p => p.papel === "suporte" || p.papel === "sem acesso") && (
                <p className={s.legenda}>Para a Daryane aparecer aqui, crie o acesso dela em Equipe (papel Suporte) ou crie uma tarefa com ela como responsável.</p>
              )}
            </section>
          ) : (
            <section className={s.bloco} aria-labelledby="numeros-titulo">
              <div className={s.blocoTopo}>
                <h2 id="numeros-titulo" className={s.blocoTitulo}>Sua semana em números</h2>
              </div>
              <div className={s.numeros}>
                <div><strong>{eu4?.atrasadas ?? 0}</strong><span>atrasadas</span></div>
                <div><strong>{eu4?.hoje ?? 0}</strong><span>para hoje</span></div>
                <div><strong>{eu4?.semana ?? 0}</strong><span>no resto da semana</span></div>
                <div><strong>{eu4?.feitas ?? 0}</strong><span>feitas na semana</span></div>
              </div>
            </section>
          )}
        </div>

        {/* Carteira */}
        <section className={s.bloco} aria-labelledby="carteira-titulo">
          <div className={s.blocoTopo}>
            <h2 id="carteira-titulo" className={s.blocoTitulo}>{carteiraPropria ? "Sua carteira" : "Base ativa"}</h2>
            <Link href="/pipeline" className={s.link}>Abrir Pipeline →</Link>
          </div>
          <div className={s.numeros}>
            <div><strong>{contar(m => m.status !== "Congelado")}</strong><span>ativas</span></div>
            <div><strong>{contar(m => m.saude === "Risco" && m.status !== "Congelado")}</strong><span>em risco</span></div>
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

      {aviso && (
        <div className={`${s.toast} ${aviso.erro ? s.toastErro : ""}`} role={aviso.erro ? "alert" : "status"}>
          <span>{aviso.txt}</span>
          <button onClick={() => setAviso(null)} aria-label="Fechar aviso">×</button>
        </div>
      )}
      {janela && (
        <JanelaTarefa
          key={janela.modo === "editar" ? janela.t.id : "nova"}
          janela={janela}
          eu={eu}
          equipe={equipe}
          mentoradas={todasMentoradas}
          podeEditar={podeEditar}
          onFechar={() => setJanela(null)}
          onPronto={(txt, patch) => {
            if (patch?.id) trocar(patch.id, patch);
            setJanela(null);
            setAviso({ txt });
            router.refresh();
          }}
          onRemovida={id => { setTarefas(ts => ts.filter(x => x.id !== id)); setJanela(null); setAviso({ txt: "Tarefa excluída" }); router.refresh(); }}
          onConcluir={t => { setJanela(null); concluir(t, !t.concluidaEm); }}
        />
      )}
      {jornada && (
        <JornadaModal key={jornada} id={jornada} onClose={() => setJornada(null)} onAbrirCadastro={() => { setCadastro({ id: jornada, aba: "dados" }); setJornada(null); }} />
      )}
      {cadastro && (
        <MentoradaDrawer key={cadastro.id} id={cadastro.id} abaInicial={cadastro.aba} onClose={() => setCadastro(null)} onChanged={() => router.refresh()} />
      )}
    </>
  );
}

// Criar ou editar uma tarefa.
function JanelaTarefa({
  janela, eu, equipe, mentoradas, podeEditar, onFechar, onPronto, onRemovida, onConcluir,
}: {
  janela: Janela; eu: string; equipe: Pessoa[]; mentoradas: { id: string; nome: string }[]; podeEditar: boolean;
  onFechar: () => void; onPronto: (txt: string, patch?: Partial<T>) => void; onRemovida: (id: string) => void; onConcluir: (t: T) => void;
}) {
  const editando = janela.modo === "editar" ? janela.t : null;
  const [titulo, setTitulo] = useState(editando?.titulo ?? "");
  const [prazo, setPrazo] = useState(janela.modo === "editar" ? janela.t.prazo : janela.prazo);
  const [resp, setResp] = useState(janela.modo === "editar" ? (janela.t.responsavel ?? janela.t.dono ?? "") : janela.responsavel);
  const [mentorada, setMentorada] = useState(
    janela.modo === "nova" && janela.mentoradaId ? (mentoradas.find(m => m.id === janela.mentoradaId)?.nome ?? "") : "",
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onFechar]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      if (editando) {
        const r = await enviar(`/api/tarefas/${editando.id}`, "PATCH", { titulo, prazo, responsavel: resp });
        onPronto("Tarefa salva", { id: editando.id, titulo: r.titulo, prazo: r.prazo, responsavel: r.responsavel, dono: r.responsavel ?? editando.dono });
      } else {
        const n = mentorada.trim().toLowerCase();
        const m = n ? mentoradas.find(x => x.nome.toLowerCase() === n) : null;
        if (n && !m) throw new Error("Escolha a mentorada pela lista (ou deixe em branco para uma tarefa geral).");
        await enviar("/api/tarefas", "POST", { titulo, prazo, mentoradaId: m?.id ?? null, responsavel: resp });
        onPronto(resp.trim() && resp.trim() !== eu ? `Tarefa criada para ${resp.trim().split(" ")[0]}` : "Tarefa criada");
      }
    } catch (err) { setErro((err as Error).message); }
    setSalvando(false);
  }

  async function excluir() {
    if (!editando || !window.confirm(`Excluir a tarefa "${editando.titulo}"?`)) return;
    try { await enviar(`/api/tarefas/${editando.id}`, "DELETE"); onRemovida(editando.id); }
    catch (err) { setErro((err as Error).message); }
  }

  return (
    <div className={s.fundo} onClick={onFechar}>
      <form className={s.modal} onClick={e => e.stopPropagation()} onSubmit={salvar} role="dialog" aria-modal="true" aria-labelledby="janela-titulo">
        <div className={s.modalTopo}>
          <h2 id="janela-titulo" className={s.modalTitulo}>{editando ? "Tarefa" : "Nova tarefa"}</h2>
          <button type="button" className={s.fechar} onClick={onFechar} aria-label="Fechar">×</button>
        </div>
        {editando && (
          <p className={s.modalInfo}>
            {editando.mentorada ? editando.mentorada.nome : "Tarefa geral"}
            {editando.automatica ? ` · automática${editando.fase ? ` (${editando.fase})` : ""}` : editando.criadaPor ? ` · criada por ${editando.criadaPor}` : ""}
            {editando.concluidaEm ? ` · concluída em ${fmt(editando.concluidaEm)}${editando.concluidaPor ? ` por ${editando.concluidaPor}` : ""}` : ""}
          </p>
        )}
        <label className={s.campo}>
          O que precisa ser feito
          <input autoFocus value={titulo} onChange={e => setTitulo(e.target.value)} disabled={!podeEditar} placeholder="Ex.: Subir gravação do encontro na plataforma" />
        </label>
        {!editando && (
          <label className={s.campo}>
            <span>Mentorada <small>(opcional)</small></span>
            <input list="janela-mentoradas" value={mentorada} onChange={e => setMentorada(e.target.value)} placeholder="Deixe em branco para uma tarefa geral" />
            <datalist id="janela-mentoradas">{mentoradas.map(m => <option key={m.id} value={m.nome} />)}</datalist>
          </label>
        )}
        <div className={s.campos2}>
          <label className={s.campo}>
            Responsável
            <input list="janela-equipe" value={resp} onChange={e => setResp(e.target.value)} disabled={!podeEditar} placeholder="Nome de quem vai fazer" />
            <datalist id="janela-equipe">{equipe.map(p => <option key={p.nome} value={p.nome} />)}</datalist>
          </label>
          <label className={s.campo}>
            Prazo
            <input type="date" value={prazo} onChange={e => setPrazo(e.target.value)} disabled={!podeEditar} />
          </label>
        </div>
        {erro && <p className={s.modalErro} role="alert">{erro}</p>}
        {podeEditar && (
          <div className={s.modalAcoes}>
            {editando && (
              <>
                <button type="button" className={s.btnPerigo} onClick={excluir}>Excluir</button>
                <button type="button" className={s.btn} onClick={() => onConcluir(editando)}>{editando.concluidaEm ? "Reabrir" : "Marcar como feita"}</button>
              </>
            )}
            <span className={s.espaco} />
            <button type="button" className={s.btn} onClick={onFechar}>Cancelar</button>
            <button type="submit" className={s.btnPrim} disabled={!titulo.trim() || !prazo || salvando}>
              {salvando ? "Salvando…" : editando ? "Salvar" : "Criar tarefa"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
