"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import JornadaModal from "@/components/JornadaModal";
import Avatar from "@/components/Avatar";
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
type TipoEv = "individual" | "grupo" | "onboarding" | "pessoal" | "outro";
type Ev = {
  id: string; titulo: string; inicio: string; fim: string | null; tipo: string; link: string | null; agenda: string; convidados: number;
  mentorada: { id: string; nome: string; tipo: string } | null;
};
type Pessoa = { nome: string; papel: string; foto: string | null };
type Tom = "vermelho" | "amarelo" | "azul";
type Motivo = { txt: string; peso: number; tom: Tom };
type Janela = { modo: "nova"; prazo: string; responsavel: string; mentoradaId?: string } | { modo: "editar"; t: T };

const DIA = 86_400_000;
const TZ = "America/Sao_Paulo";
const fmt = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");
const somar = (iso: string, n: number) => new Date(Date.parse(iso) + n * DIA).toISOString().slice(0, 10);
const diasEntre = (de: string, ate: string) => Math.round((Date.parse(ate) - Date.parse(de)) / DIA);
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const diaDe = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso));
const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex"];
const MOSTRAR_PRIO = 6;
const TIPOS: { k: TipoEv; label: string }[] = [
  { k: "individual", label: "Individuais" },
  { k: "grupo", label: "Em grupo" },
  { k: "onboarding", label: "Onboarding" },
  { k: "pessoal", label: "Pessoais" },
  { k: "outro", label: "Outros" },
];
const ROTULO_TIPO: Record<string, string> = { individual: "Individual", grupo: "Grupo", onboarding: "Onboarding", pessoal: "Pessoal", outro: "Outro" };
const PAPEL: Record<string, string> = { admin: "Administradora", mentora: "Mentora", suporte: "Suporte", leitura: "Somente leitura", "sem acesso": "ainda sem acesso" };
const linkWhats = (n: string | null) => {
  const d = (n ?? "").replace(/\D/g, "");
  return d ? `https://wa.me/${d.length <= 11 ? `55${d}` : d}` : null;
};
const juntar = (xs: string[]) => xs.join(", ").replace(/, ([^,]*)$/, " e $1");
const tipoEv = (t: string): TipoEv => (["individual", "grupo", "onboarding", "pessoal"].includes(t) ? (t as TipoEv) : "outro");
const deTrabalho = (t: string) => !["pessoal", "outro"].includes(tipoEv(t));

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
  eu, nome, saudacao, hoje, segunda, agora: agoraIni, agendaLigada, carteiraPropria, gestora, podeEditar, podePresenca, equipe, fases,
  todasMentoradas, mentoradas, encerrando, encontros: encontrosIni, tarefas: tarefasIni,
}: {
  eu: string; nome: string; saudacao: string; hoje: string; segunda: string; agora: number; agendaLigada: boolean;
  carteiraPropria: boolean; gestora: boolean; podeEditar: boolean; podePresenca: boolean;
  equipe: Pessoa[]; fases: { id: string; nome: string }[]; todasMentoradas: { id: string; nome: string }[];
  mentoradas: M[]; encerrando: Enc[]; encontros: Ev[]; tarefas: T[];
}) {
  const router = useRouter();
  const conteudo = useRef<HTMLDivElement>(null);
  const [tarefas, setTarefas] = useState(tarefasIni);
  const [origem, setOrigem] = useState(tarefasIni);
  if (origem !== tarefasIni) { setOrigem(tarefasIni); setTarefas(tarefasIni); }

  const [agora, setAgora] = useState(agoraIni);
  const [pessoa, setPessoa] = useState<string>(eu); // tarefas da semana: um nome ou "" (equipe toda)
  const [agendaFiltro, setAgendaFiltro] = useState("");
  const [tiposOn, setTiposOn] = useState<Set<TipoEv>>(new Set(["individual", "grupo", "onboarding"]));
  const [verTarefas, setVerTarefas] = useState(true);
  const [semana, setSemana] = useState(0);
  const [janela, setJanela] = useState<Janela | null>(null);
  const [jornada, setJornada] = useState<string | null>(null);
  const [evento, setEvento] = useState<Ev | null>(null);
  const [encontros, setEncontros] = useState(encontrosIni);
  const [origemEnc, setOrigemEnc] = useState(encontrosIni);
  if (origemEnc !== encontrosIni) { setOrigemEnc(encontrosIni); setEncontros(encontrosIni); }
  const [cadastro, setCadastro] = useState<{ id: string; aba: Aba } | null>(null);
  const [aviso, setAviso] = useState<{ txt: string; erro?: boolean } | null>(null);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [prioTodas, setPrioTodas] = useState(false);
  const [encAba, setEncAba] = useState<"esta" | "proxima">("esta");
  const [lendoAgenda, setLendoAgenda] = useState(false);

  // Relógio para "agora" / "em 20 min" nos encontros de hoje.
  useEffect(() => {
    const x = setInterval(() => setAgora(new Date().getTime()), 60_000);
    return () => clearInterval(x);
  }, []);
  useEffect(() => {
    if (!aviso) return;
    const x = setTimeout(() => setAviso(null), aviso.erro ? 9000 : 4000);
    return () => clearTimeout(x);
  }, [aviso]);

  const trocar = (id: string, patch: Partial<T>) => setTarefas(ts => ts.map(x => (x.id === id ? { ...x, ...patch } : x)));
  const erro = (e: unknown) => setAviso({ txt: (e as Error).message, erro: true });

  // ── Encontros ──
  const agendas = [...new Set(encontros.map(e => e.agenda))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const encFiltrados = encontros.filter(e => tiposOn.has(tipoEv(e.tipo)) && (!agendaFiltro || e.agenda === agendaFiltro));
  const encHoje = encontros.filter(e => diaDe(e.inicio) === hoje && deTrabalho(e.tipo));
  const fimDe = (e: Ev) => (e.fim ? Date.parse(e.fim) : Date.parse(e.inicio) + 60 * 60_000);
  const proximo = encHoje.find(e => fimDe(e) > agora);

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
  const altas = prioridade.filter(p => p.peso >= 50).length;

  // ── Semana ──
  const inicio = somar(segunda, semana * 7);
  const dias = SEMANA.map((rot, i) => ({ rot, iso: somar(inicio, i) }));
  const sabado = somar(inicio, 5);
  const domingo = somar(inicio, 6);
  const tarefasSemana = verTarefas ? tarefas.filter(t => (pessoa ? t.dono === pessoa : true)) : [];
  const atrasadasQuadro = semana === 0 ? tarefasSemana.filter(t => !t.concluidaEm && t.prazo < inicio) : [];
  const rotuloSemana = `${fmt(inicio).slice(0, 5)} – ${fmt(domingo).slice(0, 5)}`;
  const encSemanaTotal = encFiltrados.filter(e => { const d = diaDe(e.inicio); return d >= inicio && d <= domingo; }).length;

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
  const euNum = porPessoa.find(p => p.nome === eu);

  // ── Carteira ──
  const contar = (f: (m: M) => boolean) => mentoradas.filter(f).length;
  const porFase = fases.map(f => ({ ...f, n: contar(m => m.pipelineFaseId === f.id) }));
  const maxFase = Math.max(1, ...porFase.map(f => f.n));

  const resumo = [
    encHoje.length ? plural(encHoje.length, "encontro", "encontros") : "",
    deHoje.length ? plural(deHoje.length, "tarefa para hoje", "tarefas para hoje") : "",
    atrasadas.length ? plural(atrasadas.length, "tarefa atrasada", "tarefas atrasadas") : "",
    altas ? plural(altas, "mentorada com prioridade alta", "mentoradas com prioridade alta") : "",
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

  async function lerAgenda() {
    setLendoAgenda(true);
    try {
      const r = await enviar("/api/agenda/sincronizar", "POST");
      setAviso({ txt: `Agenda atualizada: ${plural(r.encontros, "encontro", "encontros")}.${r.erros.length ? ` ${r.erros.join(" · ")}` : ""}`, erro: r.erros.length > 0 });
      router.refresh();
    } catch (e) { erro(e); }
    setLendoAgenda(false);
  }

  // Rola só a área do painel (sem mexer no menu lateral).
  const irPara = (id: string) => {
    const box = conteudo.current;
    const alvo = document.getElementById(id);
    if (!box || !alvo) return;
    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    box.scrollTo({ top: box.scrollTop + alvo.getBoundingClientRect().top - box.getBoundingClientRect().top - 12, behavior: reduzir ? "auto" : "smooth" });
  };

  const novaTarefa = (prazo = hoje, extra: { responsavel?: string; mentoradaId?: string } = {}) =>
    setJanela({ modo: "nova", prazo, responsavel: extra.responsavel ?? (pessoa || eu), mentoradaId: extra.mentoradaId });

  const alternarTipo = (k: TipoEv) => setTiposOn(set => { const n = new Set(set); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  // ── Peças ──
  const fotoDe = new Map(equipe.map(p => [p.nome, p.foto]));
  const avatar = (nomeP: string | null, peq = false) =>
    nomeP ? (
      <Avatar nome={nomeP} foto={fotoDe.get(nomeP)} tamanho={peq ? 20 : 30} />
    ) : (
      <span className={`${s.avatar} ${s.avatarVazio} ${peq ? s.avatarPeq : ""}`} title="Sem responsável" aria-hidden="true">?</span>
    );

  const statusEncontro = (e: Ev) => {
    const ini = Date.parse(e.inicio), fim = fimDe(e);
    if (agora >= fim) return { txt: "concluído", cls: s.stFeito };
    if (agora >= ini) return { txt: "agora", cls: s.stAgora };
    const min = Math.round((ini - agora) / 60_000);
    if (min <= 90) return { txt: `em ${min} min`, cls: s.stLogo };
    return null;
  };

  const linhaTarefa = (t: T) => {
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
        {whats && <a className={s.whats} href={whats} target="_blank" rel="noreferrer" aria-label={`WhatsApp de ${t.mentorada?.nome}`}>WhatsApp</a>}
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
          {t.mentorada && <span className={s.cSub}>{t.mentorada.nome}</span>}
          {atrasada && <span className={s.cAtraso}>venceu {fmt(t.prazo).slice(0, 5)}</span>}
        </div>
        {!pessoa && avatar(t.dono, true)}
      </li>
    );
  };

  const chipEncontro = (e: Ev) => {
    const tipo = tipoEv(e.tipo);
    const passou = fimDe(e) <= agora;
    return (
      <li key={e.id} className={`${s.ev} ${s[`ev_${tipo}`]} ${passou ? s.evPassou : ""}`}>
        <span className={s.evHora}>{hora(e.inicio)}</span>
        <span className={s.evTitulo} title={e.titulo}>{e.mentorada ? e.mentorada.nome : e.titulo}</span>
        <span className={s.evSub}>
          {ROTULO_TIPO[tipo]}{tipo === "grupo" && e.convidados ? ` · ${e.convidados} pessoas` : ""}{agendas.length > 1 ? ` · ${e.agenda.split(" ")[0]}` : ""}
        </span>
        <button className={s.evAbrir} onClick={() => setEvento(e)} aria-label={`Detalhes de ${e.titulo}`} />
        {e.link && !passou && <a className={s.evLink} href={e.link} target="_blank" rel="noreferrer" aria-label={`Entrar no encontro ${e.titulo}`}>↗</a>}
      </li>
    );
  };

  const coluna = (chave: string, titulo: React.ReactNode, lista: T[], evs: Ev[], destino: string | null, extra = "") => (
    <div
      key={chave}
      className={`${s.col} ${extra} ${sobre === chave ? s.colSobre : ""}`}
      onDragOver={destino && podeEditar ? e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (sobre !== chave) setSobre(chave); } : undefined}
      onDragLeave={destino ? e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setSobre(null); } : undefined}
      onDrop={destino ? e => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); setSobre(null); setArrastando(null); if (id) moverPara(id, destino); } : undefined}
    >
      <div className={s.colTopo}>{titulo}</div>
      {evs.length > 0 && <ul className={s.colEventos} aria-label="Encontros">{evs.map(chipEncontro)}</ul>}
      <ul className={s.colLista} aria-label="Tarefas">{lista.map(cartao)}</ul>
      {destino && podeEditar && verTarefas && (
        <button className={s.colAdd} onClick={() => novaTarefa(destino)}>+ Tarefa</button>
      )}
    </div>
  );

  const kpi = (alvo: string, valor: number, rotulo: string, sub: string, tom = "") => (
    <button className={`${s.kpi} ${tom}`} onClick={() => irPara(alvo)}>
      <span className={s.kpiValor}>{valor}</span>
      <span className={s.kpiRotulo}>{rotulo}</span>
      <span className={s.kpiSub}>{sub}</span>
    </button>
  );

  return (
    <>
      <div className={styles.content} ref={conteudo}>
        {/* ── Topo ── */}
        <header className={s.hero}>
          <div className={s.heroLinha}>
            <div className={s.heroTexto}>
              <p className={s.data}>{dataExtenso}</p>
              <h1 className={s.saudacao}>{saudacao}, {nome}</h1>
              <p className={s.resumo}>
                {resumo.length ? <>Hoje: <strong>{juntar(resumo)}</strong>.</> : "Tudo em dia. Nenhuma pendência para hoje."}
                {feitasHoje > 0 && <> Você já concluiu {plural(feitasHoje, "tarefa", "tarefas")} hoje.</>}
              </p>
            </div>
            <div className={s.heroAcoes}>
              {agendaLigada && (
                <button className={s.btnVidro} onClick={lerAgenda} disabled={lendoAgenda}>{lendoAgenda ? "Atualizando…" : "↻ Atualizar agenda"}</button>
              )}
              {podeEditar && <button className={s.btnOuro} onClick={() => novaTarefa()}>+ Nova tarefa</button>}
            </div>
          </div>
          <div className={s.kpis}>
            {kpi("hoje", encHoje.length, "Encontros hoje", proximo ? `próximo às ${hora(proximo.inicio)}` : agendaLigada ? "nenhum pela frente" : "agenda não ligada")}
            {kpi("hoje", deHoje.length, "Tarefas hoje", feitasHoje ? `${feitasHoje} já feitas` : "para concluir hoje")}
            {kpi("hoje", atrasadas.length, "Atrasadas", atrasadas.length ? "resolver primeiro" : "nada atrasado", atrasadas.length ? s.kpiAlerta : "")}
            {kpi("prioridade", prioridade.length, "Para acompanhar", altas ? `${altas} com prioridade alta` : "sem urgências")}
            {kpi("encerrando", encEsta.length, "Encerram na semana", encProx.length ? `+${encProx.length} na próxima` : "até domingo")}
          </div>
        </header>

        {/* ── Hoje + Prioridade ── */}
        <div className={s.linha1}>
          <section className={s.bloco} aria-labelledby="hoje-titulo" id="hoje">
            <div className={s.blocoTopo}>
              <h2 id="hoje-titulo" className={s.blocoTitulo}><span className={s.marca} />Seu dia</h2>
              {!carteiraPropria && <span className={s.dica}>Mostrando a base toda</span>}
            </div>

            <h3 className={s.subTitulo}>Agenda de hoje</h3>
            {!agendaLigada ? (
              <div className={s.cta}>
                <p>Ligue o Google Agenda para os encontros individuais, em grupo e onboardings aparecerem aqui sozinhos.</p>
                {gestora && <Link href="/agendas" className={s.ctaBtn}>Ligar agendas →</Link>}
              </div>
            ) : !encHoje.length ? (
              <p className={s.vazio}>Nenhum encontro na agenda hoje.</p>
            ) : (
              <ol className={s.timeline}>
                {encHoje.map(e => {
                  const st = statusEncontro(e);
                  const tipo = tipoEv(e.tipo);
                  return (
                    <li key={e.id} className={`${s.tl} ${s[`ev_${tipo}`]} ${st?.cls === s.stFeito ? s.tlFeito : ""}`}>
                      <span className={s.tlHora}>{hora(e.inicio)}{e.fim && <small>{hora(e.fim)}</small>}</span>
                      <span className={s.tlBarra} aria-hidden="true" />
                      <div className={s.tlCorpo}>
                        <div className={s.tlTopo}>
                          <span className={s.tlTipo}>{ROTULO_TIPO[tipo]}</span>
                          {st && <span className={`${s.st} ${st.cls}`}>{st.txt}</span>}
                        </div>
                        <button className={s.tlTitulo} onClick={() => setEvento(e)} title="Ver detalhes e trocar o tipo">{e.titulo}</button>
                        <p className={s.meta}>
                          {e.mentorada && <button className={s.nome} onClick={() => setJornada(e.mentorada!.id)}>{e.mentorada.nome}</button>}
                          <span>{e.mentorada ? "· " : ""}agenda de {e.agenda}</span>
                          {tipo === "grupo" && e.convidados > 0 && <span>· {e.convidados} convidados</span>}
                        </p>
                      </div>
                      {e.link && st?.cls !== s.stFeito && <a className={s.entrar} href={e.link} target="_blank" rel="noreferrer">Entrar</a>}
                    </li>
                  );
                })}
              </ol>
            )}

            <h3 className={s.subTitulo}>
              Tarefas {atrasadas.length + deHoje.length > 0 && <span className={s.conta}>{atrasadas.length + deHoje.length}</span>}
            </h3>
            {!atrasadas.length && !deHoje.length && (
              <p className={s.vazio}>
                Nenhuma tarefa sua para hoje.{" "}
                {podeEditar && <button className={s.linkBtn} onClick={() => novaTarefa()}>Criar uma tarefa</button>}
              </p>
            )}
            {(atrasadas.length > 0 || deHoje.length > 0) && <ul className={s.dLista}>{[...atrasadas, ...deHoje].map(linhaTarefa)}</ul>}
          </section>

          <section className={s.bloco} aria-labelledby="prio-titulo" id="prioridade">
            <div className={s.blocoTopo}>
              <h2 id="prio-titulo" className={s.blocoTitulo}><span className={s.marca} />Acompanhar hoje</h2>
              <span className={s.conta}>{prioridade.length}</span>
            </div>
            <p className={s.legenda}>
              Ordem de urgência: risco, contrato acabando, volta de congelamento, tempo sem acompanhamento e tarefas atrasadas.
              {jaHoje > 0 && <> {plural(jaHoje, "já acompanhada", "já acompanhadas")} hoje.</>}
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
                      <div className={s.pAcoes}>
                        {whats && <a className={s.whats} href={whats} target="_blank" rel="noreferrer">WhatsApp</a>}
                        <button className={s.btnMini} onClick={() => setCadastro({ id: m.id, aba: "acomp" })}>Registrar acompanhamento</button>
                      </div>
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

        {/* ── Semana ── */}
        <section className={`${s.bloco} ${s.semana}`} aria-labelledby="semana-titulo" id="semana">
          <div className={s.semanaTopo}>
            <h2 id="semana-titulo" className={s.blocoTitulo}><span className={s.marca} />Semana</h2>
            <div className={s.nav}>
              <button className={s.navBtn} onClick={() => setSemana(w => w - 1)} aria-label="Semana anterior">‹</button>
              <button className={s.navHoje} onClick={() => setSemana(0)} disabled={semana === 0}>Hoje</button>
              <button className={s.navBtn} onClick={() => setSemana(w => w + 1)} aria-label="Próxima semana">›</button>
              <span className={s.navRotulo}>{rotuloSemana}</span>
            </div>
            <span className={s.dica}>
              {agendaLigada ? plural(encSemanaTotal, "encontro", "encontros") : "agenda não ligada"} · {plural(tarefasSemana.filter(t => !t.concluidaEm && t.prazo >= inicio && t.prazo <= domingo).length, "tarefa", "tarefas")}
            </span>
          </div>

          <div className={s.filtros}>
            <div className={s.filtroGrupo} role="group" aria-label="Tipos de encontro">
              <span className={s.filtroRotulo}>Encontros</span>
              {TIPOS.map(t => (
                <button key={t.k} className={`${s.tog} ${s[`tog_${t.k}`]} ${tiposOn.has(t.k) ? s.togOn : ""}`} onClick={() => alternarTipo(t.k)} aria-pressed={tiposOn.has(t.k)}>
                  <span className={s.togPonto} aria-hidden="true" />{t.label}
                </button>
              ))}
              {agendas.length > 1 && (
                <select className={s.sel} value={agendaFiltro} onChange={e => setAgendaFiltro(e.target.value)} aria-label="Agenda">
                  <option value="">Todas as agendas</option>
                  {agendas.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              )}
            </div>
            <div className={s.filtroGrupo} role="group" aria-label="Tarefas de">
              <span className={s.filtroRotulo}>Tarefas</span>
              <button className={`${s.tog} ${!verTarefas ? s.togOn : ""}`} onClick={() => setVerTarefas(v => !v)} aria-pressed={!verTarefas}>Esconder</button>
              {verTarefas && gestora && equipe.length > 1 && (
                <>
                  {equipe.map(p => (
                    <button key={p.nome} className={`${s.pessoaBtn} ${pessoa === p.nome ? s.pessoaOn : ""}`} onClick={() => setPessoa(p.nome)} aria-pressed={pessoa === p.nome}>
                      {avatar(p.nome, true)} {p.nome === eu ? "Minhas" : p.nome.split(" ")[0]}
                    </button>
                  ))}
                  <button className={`${s.pessoaBtn} ${s.pessoaTodos} ${pessoa === "" ? s.pessoaOn : ""}`} onClick={() => setPessoa("")} aria-pressed={pessoa === ""}>
                    Equipe toda
                  </button>
                </>
              )}
            </div>
          </div>
          {podeEditar && verTarefas && <p className={s.legenda}>Arraste uma tarefa para outro dia para mudar o prazo · clique na tarefa para editar ou trocar o responsável · clique num encontro para ver detalhes ou trocar o tipo.</p>}

          <div className={s.quadro}>
            {atrasadasQuadro.length > 0 &&
              coluna("atrasadas", <><span className={s.colDia}>Atrasadas</span><span className={`${s.colNum} ${s.colNumAtraso}`}>{atrasadasQuadro.length}</span></>, atrasadasQuadro, [], null, s.colAtrasadas)}
            {dias.map(d =>
              coluna(
                d.iso,
                <>
                  <span className={s.colDia}>{d.rot}</span>
                  <span className={`${s.colNum} ${d.iso === hoje ? s.colHoje : ""}`}>{+d.iso.slice(8)}</span>
                </>,
                tarefasSemana.filter(t => t.prazo === d.iso).sort((a, b) => Number(!!a.concluidaEm) - Number(!!b.concluidaEm)),
                encFiltrados.filter(e => diaDe(e.inicio) === d.iso),
                d.iso,
                d.iso < hoje ? s.colPassado : d.iso === hoje ? s.colDeHoje : "",
              ),
            )}
            {coluna(
              "fds",
              <>
                <span className={s.colDia}>Sáb/Dom</span>
                <span className={`${s.colNum} ${hoje === sabado || hoje === domingo ? s.colHoje : ""}`}>{+sabado.slice(8)}–{+domingo.slice(8)}</span>
              </>,
              tarefasSemana.filter(t => t.prazo === sabado || t.prazo === domingo),
              encFiltrados.filter(e => { const d = diaDe(e.inicio); return d === sabado || d === domingo; }),
              sabado,
              s.colFds,
            )}
          </div>
          {!agendaLigada && (
            <p className={s.legenda}>
              Os encontros aparecem aqui quando o Google Agenda estiver ligado{gestora ? <> — <Link href="/agendas" className={s.link}>ligar agendas</Link></> : ""}.
            </p>
          )}
        </section>

        {/* ── Encerrando · Equipe · Carteira ── */}
        <div className={s.linha3}>
          <section className={s.bloco} aria-labelledby="enc-titulo" id="encerrando">
            <div className={s.blocoTopo}>
              <h2 id="enc-titulo" className={s.blocoTitulo}><span className={s.marca} />Encerrando a mentoria</h2>
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
                const quando = d < 0 ? "já encerrou" : d === 0 ? "encerra hoje" : `em ${plural(d, "dia", "dias")}`;
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
                      </div>
                      <div className={s.pAcoes}>
                        {whats && <a className={s.whats} href={whats} target="_blank" rel="noreferrer">WhatsApp</a>}
                        {podeEditar && <button className={s.btnMini} onClick={() => novaTarefa(hoje, { mentoradaId: m.id })}>Criar tarefa</button>}
                        {gestora && m.cuida && <span className={s.cuida}>com {m.cuida.split(" ")[0]}</span>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {gestora ? (
            <section className={s.bloco} aria-labelledby="equipe-titulo">
              <div className={s.blocoTopo}>
                <h2 id="equipe-titulo" className={s.blocoTitulo}><span className={s.marca} />Equipe</h2>
                <Link href="/equipe" className={s.link}>Acessos →</Link>
              </div>
              <ul className={s.equipe}>
                {porPessoa.map(p => (
                  <li key={p.nome} className={s.eqItem}>
                    <button className={s.pessoaLinha} onClick={() => { setPessoa(p.nome); setVerTarefas(true); setSemana(0); irPara("semana"); }} title="Ver a semana desta pessoa">
                      {avatar(p.nome)}
                      <span>
                        <b>{p.nome === eu ? `${p.nome.split(" ")[0]} (você)` : p.nome}</b>
                        <small>{PAPEL[p.papel] ?? p.papel}</small>
                      </span>
                    </button>
                    <div className={s.eqNums}>
                      <span className={p.atrasadas ? s.nVermelho : s.nZero} title="Atrasadas"><b>{p.atrasadas}</b>atrasadas</span>
                      <span className={p.hoje ? s.nAmarelo : s.nZero} title="Para hoje"><b>{p.hoje}</b>hoje</span>
                      <span className={p.semana ? "" : s.nZero} title="Resto da semana"><b>{p.semana}</b>semana</span>
                      <span className={p.feitas ? s.nVerde : s.nZero} title="Feitas desde segunda"><b>{p.feitas}</b>feitas</span>
                    </div>
                    {podeEditar && (
                      <button className={s.btnMini} onClick={() => novaTarefa(hoje, { responsavel: p.nome })} aria-label={`Criar tarefa para ${p.nome}`}>+ Tarefa</button>
                    )}
                  </li>
                ))}
              </ul>
              {semDono > 0 && <p className={s.legenda}>{plural(semDono, "tarefa aberta está", "tarefas abertas estão")} sem responsável.</p>}
              {!porPessoa.some(p => p.papel === "suporte" || p.papel === "sem acesso") && (
                <p className={s.legenda}>A Daryane aparece aqui quando ganhar acesso (Equipe › papel Suporte) ou quando tiver uma tarefa.</p>
              )}
            </section>
          ) : (
            <section className={s.bloco} aria-labelledby="numeros-titulo">
              <div className={s.blocoTopo}>
                <h2 id="numeros-titulo" className={s.blocoTitulo}><span className={s.marca} />Sua semana em números</h2>
              </div>
              <div className={s.numeros}>
                <div><strong>{euNum?.atrasadas ?? 0}</strong><span>atrasadas</span></div>
                <div><strong>{euNum?.hoje ?? 0}</strong><span>para hoje</span></div>
                <div><strong>{euNum?.semana ?? 0}</strong><span>resto da semana</span></div>
                <div><strong>{euNum?.feitas ?? 0}</strong><span>feitas na semana</span></div>
              </div>
            </section>
          )}

          <section className={s.bloco} aria-labelledby="carteira-titulo">
            <div className={s.blocoTopo}>
              <h2 id="carteira-titulo" className={s.blocoTitulo}><span className={s.marca} />{carteiraPropria ? "Sua carteira" : "Base ativa"}</h2>
              <Link href="/pipeline" className={s.link}>Pipeline →</Link>
            </div>
            <div className={s.numeros}>
              <div><strong>{contar(m => m.status !== "Congelado")}</strong><span>ativas</span></div>
              <div><strong className={s.nVermelho}>{contar(m => m.saude === "Risco" && m.status !== "Congelado")}</strong><span>em risco</span></div>
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
      {evento && (
        <JanelaEncontro
          key={evento.id}
          ev={evento}
          podeEditar={podeEditar}
          podePresenca={podePresenca}
          onAviso={txt => setAviso({ txt })}
          onFechar={() => setEvento(null)}
          onJornada={id => { setEvento(null); setJornada(id); }}
          onSalvo={(txt, tipo, escopo) => {
            const alvo = evento;
            setEncontros(es => es.map(x => {
              const mesmo = escopo === "titulo" ? x.titulo.trim().toLowerCase() === alvo.titulo.trim().toLowerCase() : x.id === alvo.id;
              return mesmo && tipo !== "auto" ? { ...x, tipo } : x;
            }));
            setEvento(null);
            setAviso({ txt });
            router.refresh();
          }}
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

// Detalhes de um encontro + trocar o tipo à mão.
function JanelaEncontro({
  ev, podeEditar, podePresenca, onAviso, onFechar, onJornada, onSalvo,
}: {
  ev: Ev; podeEditar: boolean; podePresenca: boolean; onAviso: (txt: string) => void; onFechar: () => void; onJornada: (id: string) => void;
  onSalvo: (txt: string, tipo: string, escopo: "evento" | "titulo") => void;
}) {
  const [tipo, setTipo] = useState<string>(tipoEv(ev.tipo));
  const [escopo, setEscopo] = useState<"evento" | "titulo">("evento");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onFechar]);

  const quando = new Date(ev.inicio).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });

  async function salvar(t: string) {
    setErro(null);
    setSalvando(true);
    try {
      const r = await enviar("/api/agenda/tipo", "POST", { eventoId: ev.id, tipo: t, escopo });
      const qtd = escopo === "titulo" ? ` (${plural(r.alterados, "encontro", "encontros")} com esse nome)` : "";
      onSalvo(t === "auto" ? `Voltou para o tipo automático${qtd}` : `Marcado como ${ROTULO_TIPO[t]}${qtd}`, t, escopo);
    } catch (e) { setErro((e as Error).message); }
    setSalvando(false);
  }

  return (
    <div className={s.fundo} onClick={onFechar}>
      <div className={s.modal} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="encontro-titulo">
        <div className={s.modalTopo}>
          <h2 id="encontro-titulo" className={s.modalTitulo}>{ev.titulo}</h2>
          <button type="button" className={s.fechar} onClick={onFechar} aria-label="Fechar">×</button>
        </div>
        <p className={s.modalInfo}>
          <span className={s.primeiraMaiuscula}>{quando}</span>, {hora(ev.inicio)}{ev.fim ? `–${hora(ev.fim)}` : ""} · agenda de {ev.agenda}
          {ev.convidados > 0 ? ` · ${plural(ev.convidados, "convidado", "convidados")}` : ""}
        </p>
        <div className={s.encAcoes}>
          {ev.mentorada && <button className={s.btn} onClick={() => onJornada(ev.mentorada!.id)}>Abrir jornada de {ev.mentorada.nome.split(" ")[0]}</button>}
          {ev.link && <a className={s.btn} href={ev.link} target="_blank" rel="noreferrer">Entrar no encontro ↗</a>}
        </div>

        {tipoEv(ev.tipo) === "grupo" && <Participantes ev={ev} podeMarcar={podePresenca} onSalvo={txt => { onAviso(txt); onFechar(); }} />}

        {podeEditar && (
          <>
            <fieldset className={s.grupoOpcoes}>
              <legend>Tipo do encontro</legend>
              <div className={s.opcoesTipo}>
                {TIPOS.map(t => (
                  <label key={t.k} className={`${s.opTipo} ${s[`tog_${t.k}`]} ${tipo === t.k ? s.opOn : ""}`}>
                    <input type="radio" name="tipo" value={t.k} checked={tipo === t.k} onChange={() => setTipo(t.k)} />
                    <span className={s.togPonto} aria-hidden="true" />{ROTULO_TIPO[t.k]}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className={s.grupoOpcoes}>
              <legend>Vale para</legend>
              <label className={s.opEscopo}>
                <input type="radio" name="escopo" checked={escopo === "evento"} onChange={() => setEscopo("evento")} />
                Só este encontro
              </label>
              <label className={s.opEscopo}>
                <input type="radio" name="escopo" checked={escopo === "titulo"} onChange={() => setEscopo("titulo")} />
                Todos os encontros chamados “{ev.titulo}” (inclusive os próximos)
              </label>
            </fieldset>
            {tipo === "pessoal" && <p className={s.legenda}>Compromissos pessoais ficam escondidos no painel e só aparecem para a dona da agenda, ligando o filtro “Pessoais”.</p>}
            {erro && <p className={s.modalErro} role="alert">{erro}</p>}
            <div className={s.modalAcoes}>
              <button type="button" className={s.btn} onClick={() => salvar("auto")} disabled={salvando} title="Deixa o sistema decidir pelo título de novo">Voltar ao automático</button>
              <span className={s.espaco} />
              <button type="button" className={s.btn} onClick={onFechar}>Cancelar</button>
              <button type="button" className={s.btnPrim} onClick={() => salvar(tipo)} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

type Candidata = { id: string; nome: string; tipo: string; presente: boolean | null };
type DadosPresenca = {
  chave: string | null; opcoes: { key: string; label: string }[]; programa?: string | null; opcional?: boolean; data?: string; candidatos: Candidata[];
};

// Quem participou de um encontro em grupo — grava na aba "Presença nos Encontros" de cada mentorada.
function Participantes({ ev, podeMarcar, onSalvo }: { ev: Ev; podeMarcar: boolean; onSalvo: (txt: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const [dados, setDados] = useState<DadosPresenca | null>(null);
  const [marc, setMarc] = useState<Record<string, boolean | null>>({});
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar(chave?: string) {
    setCarregando(true); setErro(null);
    try {
      const qs = new URLSearchParams({ eventoId: ev.id, ...(chave ? { chave } : {}) });
      const res = await fetch(`/api/agenda/participantes?${qs}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.erro ?? "Não foi possível carregar a lista.");
      setDados(j);
      setMarc(Object.fromEntries((j.candidatos as Candidata[]).map(c => [c.id, c.presente])));
    } catch (e) { setErro((e as Error).message); }
    setCarregando(false);
  }

  const abrir = () => { setAberto(true); if (!dados) carregar(); };
  const original = Object.fromEntries((dados?.candidatos ?? []).map(c => [c.id, c.presente]));
  const mudadas = Object.keys(marc).filter(id => marc[id] !== original[id]);
  const q = busca.trim().toLowerCase();
  const lista = (dados?.candidatos ?? []).filter(c => !q || c.nome.toLowerCase().includes(q));
  const nPres = Object.values(marc).filter(v => v === true).length;
  const nFalta = Object.values(marc).filter(v => v === false).length;
  const ciclo = (v: boolean | null) => (v === null ? true : v === true ? false : null);

  async function salvar() {
    setSalvando(true); setErro(null);
    try {
      const r = await enviar("/api/agenda/participantes", "POST", {
        eventoId: ev.id, chave: dados?.chave, marcacoes: Object.fromEntries(mudadas.map(id => [id, marc[id]])),
      });
      onSalvo(`Presença salva: ${plural(r.presentes, "presente", "presentes")}${r.faltas ? `, ${plural(r.faltas, "falta", "faltas")}` : ""}`);
    } catch (e) { setErro((e as Error).message); }
    setSalvando(false);
  }

  if (!aberto) {
    return (
      <button className={s.btnPresenca} onClick={abrir}>
        ✓ Marcar quem participou
      </button>
    );
  }

  return (
    <fieldset className={s.grupoOpcoes}>
      <legend>Quem participou</legend>
      {carregando && <p className={s.vazio}>Carregando…</p>}
      {dados && (
        <>
          <label className={s.campoLinha}>
            Encontro
            <select value={dados.chave ?? ""} onChange={e => carregar(e.target.value)} disabled={!podeMarcar}>
              {!dados.chave && <option value="">Escolha qual encontro é este…</option>}
              {dados.opcoes.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
            {dados.programa && <small>só mentoradas do {dados.programa}</small>}
          </label>
          {dados.opcional && <p className={s.legenda}>Este encontro é opcional: falta aqui não conta na assiduidade.</p>}
          {dados.chave && !dados.candidatos.length && <p className={s.vazio}>Nenhuma mentorada ativa tem esse encontro no programa.</p>}
          {dados.candidatos.length > 0 && (
            <>
              <div className={s.presTopo}>
                <input className={s.presBusca} type="search" placeholder="Buscar mentorada…" value={busca} onChange={e => setBusca(e.target.value)} aria-label="Buscar mentorada" />
                <span className={s.dica}>{plural(nPres, "presente", "presentes")} · {plural(nFalta, "falta", "faltas")} · {dados.candidatos.length - nPres - nFalta} sem registro</span>
              </div>
              {podeMarcar && (
                <div className={s.presMassa}>
                  <button type="button" className={s.btnMini} onClick={() => setMarc(m => Object.fromEntries(Object.keys(m).map(id => [id, m[id] ?? false])))}>
                    Falta para quem não foi marcada
                  </button>
                  <button type="button" className={s.btnMini} onClick={() => setMarc(Object.fromEntries((dados.candidatos).map(c => [c.id, null])))}>
                    Limpar tudo
                  </button>
                </div>
              )}
              <ul className={s.presLista}>
                {lista.map(c => {
                  const v = marc[c.id];
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        className={`${s.presItem} ${v === true ? s.presSim : v === false ? s.presNao : ""}`}
                        onClick={() => podeMarcar && setMarc(m => ({ ...m, [c.id]: ciclo(m[c.id]) }))}
                        disabled={!podeMarcar}
                        aria-label={`${c.nome}: ${v === true ? "presente" : v === false ? "falta" : "sem registro"}. Clique para mudar.`}
                      >
                        <span className={s.presMarca} aria-hidden="true">{v === true ? "✓" : v === false ? "✗" : ""}</span>
                        <span className={s.presNome}>{c.nome}</span>
                        <span className={s.presEstado}>{v === true ? "Presente" : v === false ? "Falta" : "—"}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className={s.legenda}>Clique no nome para alternar: presente → falta → sem registro. Fica salvo na aba “Presença nos Encontros” de cada mentorada.</p>
            </>
          )}
        </>
      )}
      {erro && <p className={s.modalErro} role="alert">{erro}</p>}
      {podeMarcar && dados?.candidatos.length ? (
        <div className={s.modalAcoes}>
          <span className={s.espaco} />
          <button type="button" className={s.btnPrim} onClick={salvar} disabled={!mudadas.length || salvando}>
            {salvando ? "Salvando…" : mudadas.length ? `Salvar presenças (${mudadas.length})` : "Nada mudou"}
          </button>
        </div>
      ) : null}
      {!podeMarcar && <p className={s.legenda}>Seu acesso só permite ver. Para marcar presença, precisa da permissão Presenças.</p>}
    </fieldset>
  );
}
