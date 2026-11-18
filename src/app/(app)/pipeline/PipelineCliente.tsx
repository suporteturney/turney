"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MentoradaDrawer from "@/components/MentoradaDrawer";
import { hojeISO, somarDiasUteis } from "@/lib/dias-uteis";
import styles from "../shared.module.css";
import f from "../filtros.module.css";
import p from "./pipeline.module.css";

type Fase = { id: string; nome: string; tarefaTexto: string | null; tarefaDiasUteis: number | null };
type TarefaAberta = { id: string; titulo: string; prazo: string };
type Card = {
  id: string; nome: string; codigo: string | null; tipo: string; status: string; saude: string | null;
  pipelineFaseId: string | null; pipelineFaseEm: string | null; tarefas: TarefaAberta[];
};

const SEM = "__sem__";
const SEM_SAUDE = "__sem_saude__";
const DIA = 86_400_000;
const fmt = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const casaTipo = (tipo: string, filtro: string) => tipo === filtro || tipo.startsWith(`${filtro} `);
const SAUDE_CLS: Record<string, string> = { "Saudável": styles.bSau, "Atenção": styles.bAte, "Risco": styles.bRis };
const STATUS_CLS: Record<string, string> = { "Em Renovação": styles.bRenov, "Congelado": styles.bCong };
const temTarefa = (fase: Fase | undefined) => !!fase?.tarefaTexto && fase.tarefaDiasUteis != null;

function tempoNaEtapa(desde: string | null) {
  if (!desde) return null;
  const n = Math.round((Date.parse(hojeISO()) - Date.parse(desde)) / DIA);
  if (n < 0) return `entra em ${fmt(desde)}`;
  return n === 0 ? "entrou hoje" : n === 1 ? "na etapa há 1 dia" : `na etapa há ${n} dias`;
}

async function enviar(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.erro ?? "Não foi possível salvar. Tente de novo.");
  return j;
}

export default function PipelineCliente({
  fases: fasesIni, cards: cardsIni, podeMover, podeEditar,
}: { fases: Fase[]; cards: Card[]; podeMover: boolean; podeEditar: boolean }) {
  const router = useRouter();
  const [fases, setFases] = useState(fasesIni);
  const [cards, setCards] = useState(cardsIni);
  // Quando a página recarrega os dados do servidor, a tela passa a usar os novos.
  const [origem, setOrigem] = useState({ fasesIni, cardsIni });
  if (origem.fasesIni !== fasesIni || origem.cardsIni !== cardsIni) {
    setOrigem({ fasesIni, cardsIni });
    setFases(fasesIni);
    setCards(cardsIni);
  }

  const [busca, setBusca] = useState("");
  const [filtTipo, setFiltTipo] = useState("");
  const [filtSaude, setFiltSaude] = useState("");
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [pendente, setPendente] = useState<{ card: Card; fase: Fase; data: string } | null>(null);
  const [aviso, setAviso] = useState<{ erro: boolean; texto: string } | null>(null);
  const [cadastro, setCadastro] = useState<string | null>(null);
  const [gerenciar, setGerenciar] = useState(false);
  const [buscandoAgenda, setBuscandoAgenda] = useState(false);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), aviso.erro ? 9000 : 7000);
    return () => clearTimeout(t);
  }, [aviso]);

  const tipos = useMemo(() => {
    const set = [...new Set(cards.map(m => m.tipo).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    const grupos = [...new Set(set.filter(t => / \d+$/.test(t)).map(t => t.replace(/ \d+$/, "")))];
    return { set, grupos };
  }, [cards]);
  const saudes = useMemo(
    () => [...new Set(cards.map(m => m.saude).filter((s): s is string => !!s))]
      .sort((a, b) => ["Saudável", "Atenção", "Risco"].indexOf(a) - ["Saudável", "Atenção", "Risco"].indexOf(b) || a.localeCompare(b)),
    [cards]
  );

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return cards.filter(m =>
      (!filtTipo || casaTipo(m.tipo, filtTipo)) &&
      (!filtSaude || (filtSaude === SEM_SAUDE ? !m.saude : m.saude === filtSaude)) &&
      (!q || m.nome.toLowerCase().includes(q) || (m.codigo ?? "").toLowerCase().includes(q))
    );
  }, [cards, filtTipo, filtSaude, busca]);

  const idsFases = new Set(fases.map(x => x.id));
  const colunas: (Fase & { sem?: boolean })[] = [
    { id: SEM, nome: "Sem etapa", tarefaTexto: null, tarefaDiasUteis: null, sem: true },
    ...fases,
  ];
  const daColuna = (colId: string) =>
    visiveis.filter(m => (colId === SEM ? !m.pipelineFaseId || !idsFases.has(m.pipelineFaseId) : m.pipelineFaseId === colId));
  const naEtapa = (faseId: string) => cards.filter(m => m.pipelineFaseId === faseId).length;
  const temFiltro = !!(busca || filtTipo || filtSaude);

  async function mover(card: Card, faseId: string | null, data?: string) {
    const antes = card;
    setCards(cs => cs.map(c => (c.id === card.id ? { ...c, pipelineFaseId: faseId, pipelineFaseEm: faseId ? data ?? hojeISO() : null } : c)));
    try {
      const j = await enviar("/api/pipeline/mover", "POST", { mentoradaId: card.id, faseId, data });
      setCards(cs => cs.map(c => (c.id === card.id ? { ...c, pipelineFaseId: j.pipelineFaseId, pipelineFaseEm: j.pipelineFaseEm, tarefas: j.tarefas } : c)));
      if (j.tarefa) {
        setAviso({ erro: false, texto: `Tarefa criada: "${j.tarefa.titulo}" de ${card.nome}, até ${fmt(j.tarefa.prazo)}. Ela aparece em Tarefas.` });
        router.refresh();
      }
    } catch (e) {
      setCards(cs => cs.map(c => (c.id === card.id ? antes : c)));
      setAviso({ erro: true, texto: (e as Error).message });
    }
  }

  async function buscarAgenda() {
    setBuscandoAgenda(true);
    try {
      const r = await enviar("/api/agenda/sincronizar", "POST");
      const feitos = r.aplicados as { mentorada: string; data: string; etapa: string }[];
      const partes = [
        feitos.length
          ? `${feitos.length} atualizada(s): ${feitos.map(a => `${a.mentorada} (${fmt(a.data)} → ${a.etapa})`).join("; ")}.`
          : "Nenhuma mentoria nova na agenda.",
        r.naoEncontrados.length
          ? `Não identifiquei: ${(r.naoEncontrados as { titulo: string; data: string; motivo: string }[]).map(x => `"${x.titulo}" em ${fmt(x.data)} (${x.motivo})`).join("; ")}.`
          : "",
        r.erros.length ? `Erro: ${r.erros.join("; ")}` : "",
      ].filter(Boolean);
      setAviso({ erro: r.erros.length > 0, texto: partes.join(" ") });
      if (feitos.length) router.refresh();
    } catch (e) {
      setAviso({ erro: true, texto: (e as Error).message });
    }
    setBuscandoAgenda(false);
  }

  function soltar(card: Card, colId: string) {
    const faseId = colId === SEM ? null : colId;
    if ((card.pipelineFaseId ?? null) === faseId) return;
    const fase = fases.find(x => x.id === faseId);
    if (fase && temTarefa(fase)) { setPendente({ card, fase, data: hojeISO() }); return; }
    mover(card, faseId);
  }

  return (
    <>
      <div className={styles.topbar}>
        <div>
          <div className={styles.pageTitle}>Pipeline</div>
          <div className={styles.pageSub}>Em que etapa da jornada está cada mentorada ativa — arraste o card para mudar de etapa</div>
        </div>
        <div className={p.topoAcoes}>
          {podeMover && (
            <button className={p.btn} onClick={buscarAgenda} disabled={buscandoAgenda} title="Procura Mentorias Estratégicas na agenda das mentoras">
              {buscandoAgenda ? "Buscando…" : "Buscar na agenda agora"}
            </button>
          )}
          {podeEditar && (
            <button className={p.btn} onClick={() => setGerenciar(true)}>Gerenciar etapas</button>
          )}
        </div>
      </div>

      <div className={`${styles.content} ${p.content}`}>
        <div className={`${f.bar} ${p.toolbar}`}>
          <input
            className={`${f.select} ${p.busca}`}
            type="search"
            placeholder="Buscar mentorada…"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            aria-label="Buscar mentorada"
          />
          <select className={f.select} value={filtTipo} onChange={e => setFiltTipo(e.target.value)} aria-label="Filtrar por mentoria">
            <option value="">Todas as mentorias</option>
            {tipos.grupos.map(g => <option key={`g-${g}`} value={g}>{g} (todos)</option>)}
            {tipos.set.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className={f.select} value={filtSaude} onChange={e => setFiltSaude(e.target.value)} aria-label="Filtrar por saúde">
            <option value="">Todas as saúdes</option>
            {saudes.map(s => <option key={s} value={s}>{s}</option>)}
            <option value={SEM_SAUDE}>Sem saúde</option>
          </select>
          {temFiltro && (
            <button className={f.clear} onClick={() => { setBusca(""); setFiltTipo(""); setFiltSaude(""); }}>Limpar filtros</button>
          )}
          <span className={f.count}>{visiveis.length} de {cards.length} mentoradas ativas</span>
        </div>

        <div className={p.board}>
          {colunas.map(col => {
            const lista = daColuna(col.id);
            if (col.sem && !lista.length && !arrastando) return null;
            return (
              <section
                key={col.id}
                className={`${p.col} ${col.sem ? p.colSem : ""} ${sobre === col.id ? p.colSobre : ""}`}
                onDragOver={e => { if (!arrastando) return; e.preventDefault(); if (sobre !== col.id) setSobre(col.id); }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setSobre(s => (s === col.id ? null : s)); }}
                onDrop={e => {
                  e.preventDefault();
                  const card = cards.find(c => c.id === e.dataTransfer.getData("text/plain"));
                  setSobre(null); setArrastando(null);
                  if (card) soltar(card, col.id);
                }}
                aria-label={`Etapa ${col.nome}`}
              >
                <header className={p.colHead}>
                  <div className={p.colNome}>
                    <span>{col.nome}</span>
                    <span className={p.colCount}>{lista.length}</span>
                  </div>
                  {temTarefa(col) && (
                    <div className={p.colAuto} title="Ao entrar nesta etapa, a tarefa é criada sozinha">
                      Cria tarefa: {col.tarefaTexto} · {col.tarefaDiasUteis} {col.tarefaDiasUteis === 1 ? "dia útil" : "dias úteis"}
                    </div>
                  )}
                </header>
                <div className={p.colBody}>
                  {!lista.length && (
                    <div className={p.vazio}>{temFiltro ? "Ninguém com esses filtros" : podeMover ? "Arraste uma mentorada para cá" : "Ninguém nesta etapa"}</div>
                  )}
                  {lista.map(m => {
                    const t = m.tarefas[0];
                    const hoje = hojeISO();
                    const tCls = t ? (t.prazo < hoje ? p.tarefaAtrasada : t.prazo === hoje ? p.tarefaHoje : "") : "";
                    const tempo = m.pipelineFaseId ? tempoNaEtapa(m.pipelineFaseEm) : null;
                    return (
                      <article
                        key={m.id}
                        className={`${p.card} ${arrastando === m.id ? p.cardArrastando : ""} ${podeMover ? p.cardMovel : ""}`}
                        draggable={podeMover}
                        onDragStart={e => { e.dataTransfer.setData("text/plain", m.id); e.dataTransfer.effectAllowed = "move"; setArrastando(m.id); }}
                        onDragEnd={() => { setArrastando(null); setSobre(null); }}
                      >
                        <button className={f.nomeBtn} onClick={() => setCadastro(m.id)}>{m.nome}</button>
                        <div className={p.tags}>
                          <span className={p.tipo}>{m.tipo}</span>
                          {m.saude && <span className={`${styles.badge} ${SAUDE_CLS[m.saude] ?? styles.bSilver}`}>{m.saude}</span>}
                          {STATUS_CLS[m.status] && <span className={`${styles.badge} ${STATUS_CLS[m.status]}`}>{m.status}</span>}
                        </div>
                        {tempo && <div className={p.tempo}>{tempo}</div>}
                        {t && (
                          <div className={`${p.tarefa} ${tCls}`}>
                            {t.titulo} · {t.prazo < hoje ? "atrasada desde" : t.prazo === hoje ? "vence hoje" : "até"} {t.prazo === hoje ? "" : fmt(t.prazo)}
                            {m.tarefas.length > 1 && <span className={p.mais}> +{m.tarefas.length - 1}</span>}
                          </div>
                        )}
                        {podeMover && (
                          <select
                            className={p.mover}
                            value={m.pipelineFaseId && idsFases.has(m.pipelineFaseId) ? m.pipelineFaseId : SEM}
                            onChange={e => soltar(m, e.target.value)}
                            aria-label={`Mover ${m.nome} para outra etapa`}
                          >
                            <option value={SEM}>Sem etapa</option>
                            {fases.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}
                          </select>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
          {!fases.length && (
            <div className={p.semFases}>
              Nenhuma etapa criada ainda.{podeEditar ? " Clique em “Gerenciar etapas” para criar." : ""}
            </div>
          )}
        </div>
      </div>

      {pendente && (
        <ConfirmarData
          pendente={pendente}
          onData={data => setPendente(x => (x ? { ...x, data } : x))}
          onCancelar={() => setPendente(null)}
          onConfirmar={() => { mover(pendente.card, pendente.fase.id, pendente.data); setPendente(null); }}
        />
      )}

      {gerenciar && (
        <GerenciarEtapas
          fases={fases}
          naEtapa={naEtapa}
          onFases={setFases}
          onErro={texto => setAviso({ erro: true, texto })}
          onFechar={() => { setGerenciar(false); router.refresh(); }}
        />
      )}

      {aviso && (
        <div className={`${p.aviso} ${aviso.erro ? p.avisoErro : ""}`} role="status">
          <span>{aviso.texto}</span>
          <button onClick={() => setAviso(null)} aria-label="Fechar aviso">×</button>
        </div>
      )}

      {cadastro && (
        <MentoradaDrawer key={cadastro} id={cadastro} onClose={() => setCadastro(null)} onChanged={() => router.refresh()} />
      )}
    </>
  );
}

// Ao entrar numa etapa que cria tarefa: pergunta quando aconteceu, porque o prazo conta a partir dessa data.
function ConfirmarData({
  pendente, onData, onCancelar, onConfirmar,
}: {
  pendente: { card: Card; fase: Fase; data: string };
  onData: (d: string) => void;
  onCancelar: () => void;
  onConfirmar: () => void;
}) {
  const { card, fase, data } = pendente;
  const dias = fase.tarefaDiasUteis ?? 0;
  const prazo = data ? somarDiasUteis(data, dias) : null;
  return (
    <div className={p.fundo} onClick={onCancelar}>
      <div className={p.modal} role="dialog" aria-modal="true" aria-labelledby="confirmar-titulo" onClick={e => e.stopPropagation()}>
        <div id="confirmar-titulo" className={p.modalTitulo}>{card.nome} → {fase.nome}</div>
        <label className={p.campo}>
          <span>Quando foi a {fase.nome}?</span>
          <input type="date" value={data} onChange={e => onData(e.target.value)} autoFocus />
        </label>
        {prazo && (
          <p className={p.modalTexto}>
            Vai ser criada a tarefa <strong>“{fase.tarefaTexto}”</strong> com prazo até <strong>{fmt(prazo)}</strong>
            {" "}({dias} {dias === 1 ? "dia útil" : "dias úteis"} depois, sem contar fins de semana e feriados).
          </p>
        )}
        <div className={p.acoes}>
          <button className={p.btn} onClick={onCancelar}>Cancelar</button>
          <button className={p.btnPrim} onClick={onConfirmar} disabled={!data}>Mover e criar tarefa</button>
        </div>
      </div>
    </div>
  );
}

function GerenciarEtapas({
  fases, naEtapa, onFases, onErro, onFechar,
}: {
  fases: Fase[];
  naEtapa: (id: string) => number;
  onFases: (f: Fase[]) => void;
  onErro: (t: string) => void;
  onFechar: () => void;
}) {
  const [nova, setNova] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function criar() {
    if (!nova.trim()) return;
    setSalvando(true);
    try {
      const fase = await enviar("/api/pipeline/fases", "POST", { nome: nova });
      onFases([...fases, { id: fase.id, nome: fase.nome, tarefaTexto: null, tarefaDiasUteis: null }]);
      setNova("");
    } catch (e) { onErro((e as Error).message); }
    setSalvando(false);
  }

  async function trocar(i: number, j: number) {
    if (j < 0 || j >= fases.length) return;
    const nova = [...fases];
    [nova[i], nova[j]] = [nova[j], nova[i]];
    onFases(nova);
    try { await enviar("/api/pipeline/fases", "PUT", { ordem: nova.map(x => x.id) }); }
    catch (e) { onFases(fases); onErro((e as Error).message); }
  }

  async function excluir(fase: Fase) {
    const n = naEtapa(fase.id);
    const msg = `Excluir a etapa "${fase.nome}"?` +
      (n ? `\n\n${n} mentorada(s) estão nela e vão voltar para "Sem etapa".` : "") +
      "\n\nAs tarefas já criadas continuam.";
    if (!window.confirm(msg)) return;
    try {
      await enviar(`/api/pipeline/fases/${fase.id}`, "DELETE");
      onFases(fases.filter(x => x.id !== fase.id));
    } catch (e) { onErro((e as Error).message); }
  }

  return (
    <div className={p.fundo} onClick={onFechar}>
      <div className={`${p.modal} ${p.modalLargo}`} role="dialog" aria-modal="true" aria-labelledby="etapas-titulo" onClick={e => e.stopPropagation()}>
        <div className={p.modalTopo}>
          <div id="etapas-titulo" className={p.modalTitulo}>Etapas do Pipeline</div>
          <button className={p.fechar} onClick={onFechar} aria-label="Fechar">×</button>
        </div>
        <p className={p.modalTexto}>
          Renomeie, mude a ordem, crie ou exclua etapas. Em cada etapa dá para ligar uma <strong>tarefa automática</strong>:
          quando a mentorada entra na etapa, a tarefa nasce com prazo em dias úteis.
        </p>
        <div className={p.etapas}>
          {fases.map((fase, i) => (
            <LinhaEtapa
              key={fase.id}
              fase={fase}
              qtd={naEtapa(fase.id)}
              primeira={i === 0}
              ultima={i === fases.length - 1}
              onSubir={() => trocar(i, i - 1)}
              onDescer={() => trocar(i, i + 1)}
              onExcluir={() => excluir(fase)}
              onSalvo={x => onFases(fases.map(y => (y.id === x.id ? x : y)))}
              onErro={onErro}
            />
          ))}
        </div>
        <div className={p.novaEtapa}>
          <input
            value={nova}
            onChange={e => setNova(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") criar(); }}
            placeholder="Nome da nova etapa"
            aria-label="Nome da nova etapa"
          />
          <button className={p.btnPrim} onClick={criar} disabled={!nova.trim() || salvando}>Adicionar etapa</button>
        </div>
      </div>
    </div>
  );
}

function LinhaEtapa({
  fase, qtd, primeira, ultima, onSubir, onDescer, onExcluir, onSalvo, onErro,
}: {
  fase: Fase; qtd: number; primeira: boolean; ultima: boolean;
  onSubir: () => void; onDescer: () => void; onExcluir: () => void;
  onSalvo: (f: Fase) => void; onErro: (t: string) => void;
}) {
  const [nome, setNome] = useState(fase.nome);
  const [texto, setTexto] = useState(fase.tarefaTexto ?? "");
  const [dias, setDias] = useState(fase.tarefaDiasUteis != null ? String(fase.tarefaDiasUteis) : "");
  const [salvando, setSalvando] = useState(false);
  const mudou = nome.trim() !== fase.nome || texto.trim() !== (fase.tarefaTexto ?? "") ||
    (texto.trim() ? dias !== String(fase.tarefaDiasUteis ?? "") : false);

  async function salvar() {
    setSalvando(true);
    try {
      const x = await enviar(`/api/pipeline/fases/${fase.id}`, "PATCH", { nome, tarefaTexto: texto, tarefaDiasUteis: dias });
      onSalvo({ id: x.id, nome: x.nome, tarefaTexto: x.tarefaTexto, tarefaDiasUteis: x.tarefaDiasUteis });
      setNome(x.nome); setTexto(x.tarefaTexto ?? ""); setDias(x.tarefaDiasUteis != null ? String(x.tarefaDiasUteis) : "");
    } catch (e) { onErro((e as Error).message); }
    setSalvando(false);
  }

  return (
    <div className={p.etapa}>
      <div className={p.etapaTopo}>
        <div className={p.ordem}>
          <button onClick={onSubir} disabled={primeira} aria-label={`Subir ${fase.nome}`}>↑</button>
          <button onClick={onDescer} disabled={ultima} aria-label={`Descer ${fase.nome}`}>↓</button>
        </div>
        <input className={p.etapaNome} value={nome} onChange={e => setNome(e.target.value)} aria-label="Nome da etapa" />
        <span className={p.etapaQtd}>{qtd} {qtd === 1 ? "mentorada" : "mentoradas"}</span>
        <button className={p.btnPerigo} onClick={onExcluir}>Excluir</button>
      </div>
      <div className={p.etapaTarefa}>
        <span>Tarefa automática:</span>
        <input value={texto} onChange={e => setTexto(e.target.value)} placeholder="ex: Enviar o roadmap (vazio = sem tarefa)" aria-label="Texto da tarefa automática" />
        <input
          className={p.dias} type="number" min={0} max={365} value={dias}
          onChange={e => setDias(e.target.value)} disabled={!texto.trim()} aria-label="Prazo em dias úteis"
        />
        <span>dias úteis</span>
        <button className={p.btnPrim} onClick={salvar} disabled={!mudou || salvando}>{salvando ? "Salvando…" : "Salvar"}</button>
      </div>
    </div>
  );
}
