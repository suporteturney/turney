"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import JornadaModal from "@/components/JornadaModal";
import ImportarVarreduraModal from "./ImportarVarreduraModal";
import { BANDAS, PESO_BANDA, type Banda, type MentoradaRef } from "@/lib/varredura";
import styles from "../shared.module.css";
import a from "./acompanhamento.module.css";

type Item = {
  id: string; nome: string; banda: string; tag: string | null; etapa: string | null; status: string | null;
  concluido: string[]; pendencias: string[]; atencao: string[]; acompanhar: string[]; perguntar: string[];
  retornos: string[]; proximos: string[]; mensagem: string | null; prioridade: number | null; prioridadeMotivo: string | null;
  mentoradaId: string | null;
  varredura: { id: string; data: string; programa: string | null };
  mentorada: { id: string; tipo: string; status: string; codigo: string | null; whatsapp: string | null; prazo: string | null } | null;
  anterior: { banda: string; tag: string | null; data: string } | null;
};
type VarreduraMeta = { id: string; data: string; programa: string | null; titulo: string | null; autor: string | null; total: number };
type Registro = {
  id: string; data: string; tipo: string | null; texto: string; autor: string | null; marco: boolean; marcoTitulo: string | null;
  mentorada: { id: string; nome: string; tipo: string };
};

const fmt = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");
const bandaInfo = (b: string) => BANDAS.find(x => x.k === b) ?? BANDAS[1];
const linkWhats = (num: string | null, texto: string | null) => {
  const n = (num ?? "").replace(/\D/g, "");
  if (n.length < 8) return null;
  return `https://wa.me/${n}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`;
};

export default function AcompanhamentoCliente(props: {
  programa: string;
  assinatura: string;
  varreduras: VarreduraMeta[];
  selecionadaId: string | null;
  programasVista: { programa: string; id: string; data: string }[];
  itens: Item[];
  semVarredura: { id: string; nome: string; tipo: string; status: string }[];
  base: MentoradaRef[];
  ultimas: { programa: string; data: string; itens: { nome: string; banda: string; tag: string | null }[] }[];
  registros: Registro[];
}) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<Banda | "">("");
  const [busca, setBusca] = useState("");
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [jornada, setJornada] = useState<string | null>(null);
  const [importar, setImportar] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const avisar = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(t => (t === msg ? null : t)), 2400);
  };

  const programas = useMemo(
    () => [...new Set(props.varreduras.map(v => v.programa ?? "Sem programa"))].sort((x, y) => x.localeCompare(y, "pt-BR")),
    [props.varreduras]
  );
  const semanas = props.programa ? props.varreduras.filter(v => (v.programa ?? "Sem programa") === props.programa) : [];
  const sel = props.varreduras.find(v => v.id === props.selecionadaId) ?? null;

  const ir = (programa: string, v?: string) => {
    const q = new URLSearchParams();
    if (programa) q.set("programa", programa);
    if (v) q.set("v", v);
    router.push(`/acompanhamento${q.toString() ? `?${q}` : ""}`);
  };

  const cont = { vermelho: 0, amarelo: 0, verde: 0 } as Record<Banda, number>;
  for (const i of props.itens) cont[(i.banda as Banda)] = (cont[i.banda as Banda] ?? 0) + 1;
  const total = props.itens.length;

  const visiveis = props.itens
    .filter(i => !filtro || i.banda === filtro)
    .filter(i => !busca || i.nome.toLowerCase().includes(busca.toLowerCase()));

  const prioridade = [...props.itens]
    .filter(i => i.prioridade !== null || i.banda === "vermelho")
    .sort((x, y) => (x.prioridade ?? 99) - (y.prioridade ?? 99) || x.nome.localeCompare(y.nome, "pt-BR"));

  const retornosEquipe = props.itens.reduce((n, i) => n + i.retornos.length, 0);
  const melhoraram = props.itens.filter(i => i.anterior && PESO_BANDA[i.banda as Banda] > PESO_BANDA[i.anterior.banda as Banda]).length;
  const pioraram = props.itens.filter(i => i.anterior && PESO_BANDA[i.banda as Banda] < PESO_BANDA[i.anterior.banda as Banda]).length;

  const toggle = (id: string) =>
    setAbertos(s => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const abrirCard = (id: string) => {
    setFiltro("");
    setAbertos(s => new Set(s).add(id));
    window.setTimeout(() => document.getElementById(`card-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  };

  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      avisar("Mensagem copiada");
    } catch {
      window.prompt("Copie a mensagem:", texto);
    }
  }

  async function excluirVarredura() {
    if (!sel) return;
    if (!window.confirm(`Excluir a varredura de ${fmt(sel.data)} (${sel.programa ?? "sem programa"})? Os acompanhamentos que ela criou na jornada também saem. A saúde das mentoradas não volta ao valor anterior.`)) return;
    setExcluindo(true);
    const r = await fetch(`/api/varreduras/${sel.id}`, { method: "DELETE" });
    setExcluindo(false);
    if (!r.ok) return avisar("Não foi possível excluir. Tente novamente.");
    avisar("Varredura excluída");
    ir(props.programa);
    router.refresh();
  }

  const subtitulo = props.programa
    ? sel
      ? `Varredura de WhatsApp de ${fmt(sel.data)} · ${sel.total} mentorada${sel.total !== 1 ? "s" : ""}${sel.autor ? ` · importada por ${sel.autor}` : ""}`
      : "Nenhuma varredura deste programa ainda"
    : props.programasVista.length
      ? `Última varredura de cada programa: ${props.programasVista.map(p => `${p.programa} (${fmt(p.data)})`).join(" · ")}`
      : "Nenhuma varredura importada ainda";

  return (
    <>
      <div className={styles.topbar}>
        <div>
          <div className={styles.pageTitle}>Acompanhamento</div>
          <div className={styles.pageSub}>{subtitulo}</div>
        </div>
        <div className={a.topActions}>
          <button className={a.btnPrimary} onClick={() => setImportar(true)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Importar varredura
          </button>
        </div>
      </div>

      <div className={styles.content}>
        <div className={a.nav}>
          <div className={a.progTabs} role="tablist" aria-label="Programa">
            <button className={!props.programa ? a.tabOn : ""} onClick={() => ir("")} role="tab" aria-selected={!props.programa}>
              Todos os programas
            </button>
            {programas.map(p => (
              <button key={p} className={props.programa === p ? a.tabOn : ""} onClick={() => ir(p)} role="tab" aria-selected={props.programa === p}>
                {p}
              </button>
            ))}
          </div>
          {props.programa && semanas.length > 0 && (
            <div className={a.semana}>
              <select value={sel?.id ?? ""} onChange={e => ir(props.programa, e.target.value)} aria-label="Escolher semana">
                {semanas.map((s, idx) => (
                  <option key={s.id} value={s.id}>
                    {fmt(s.data)}{idx === 0 ? " · mais recente" : ""} · {s.total} mentoradas
                  </option>
                ))}
              </select>
              {sel && (
                <button className={a.btnDanger} onClick={excluirVarredura} disabled={excluindo}>
                  {excluindo ? "Excluindo…" : "Excluir esta varredura"}
                </button>
              )}
            </div>
          )}
        </div>

        {total === 0 ? (
          <div className={a.vazio}>
            <div className={a.vazioTitulo}>Nenhuma varredura {props.programa ? `do ${props.programa} ` : ""}importada ainda</div>
            <p>
              Peça ao Claude a varredura semanal do WhatsApp e importe aqui. Use <strong>Importar varredura</strong> → <strong>Copiar instruções para o Claude</strong>:
              as instruções já trazem a lista de mentoradas e a varredura anterior, para ele comparar semana a semana.
            </p>
            <button className={a.btnPrimary} onClick={() => setImportar(true)}>Importar a primeira varredura</button>
          </div>
        ) : (
          <>
            <div className={a.stats}>
              {BANDAS.map(b => (
                <button
                  key={b.k}
                  className={`${a.stat} ${filtro === b.k ? a.statOn : ""}`}
                  style={{ "--c": b.cor } as React.CSSProperties}
                  onClick={() => setFiltro(f => (f === b.k ? "" : b.k))}
                  aria-pressed={filtro === b.k}
                >
                  <span className={a.statN}>{cont[b.k] ?? 0}</span>
                  <span className={a.statL}>{b.titulo}</span>
                  <span className={a.statBar}><i style={{ width: `${total ? ((cont[b.k] ?? 0) / total) * 100 : 0}%` }} /></span>
                </button>
              ))}
            </div>

            <div className={a.pulse}>
              <span><strong>{melhoraram}</strong> melhoraram desde a varredura anterior</span>
              <span className={pioraram ? a.pulseBad : ""}><strong>{pioraram}</strong> pioraram</span>
              <span className={retornosEquipe ? a.pulseWarn : ""}><strong>{retornosEquipe}</strong> retornos que a equipe deve</span>
              {props.semVarredura.length > 0 && (
                <span className={a.pulseWarn}><strong>{props.semVarredura.length}</strong> ativas ficaram fora da varredura</span>
              )}
            </div>

            {prioridade.length > 0 && (
              <div className={a.priority}>
                <h2>Contato prioritário agora</h2>
                <ol>
                  {prioridade.map(i => (
                    <li key={i.id}>
                      <button onClick={() => abrirCard(i.id)}>{i.nome}</button>
                      {!props.programa && i.varredura.programa && <span className={a.progMini}>{i.varredura.programa}</span>}
                      {" — "}
                      <span className={a.why}>{i.prioridadeMotivo ?? i.tag ?? i.status ?? "marcada como vermelho"}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <div className={a.filterbar}>
              <span className={a.label}>Filtrar</span>
              <button className={`${a.chip} ${!filtro ? a.chipOn : ""}`} onClick={() => setFiltro("")}>Todas · {total}</button>
              {BANDAS.map(b => (
                <button key={b.k} className={`${a.chip} ${filtro === b.k ? a.chipOn : ""}`} onClick={() => setFiltro(b.k)}>
                  <i style={{ background: b.cor }} />{b.label} {cont[b.k] ?? 0}
                </button>
              ))}
              <input className={a.busca} type="search" placeholder="Buscar mentorada…" value={busca} onChange={e => setBusca(e.target.value)} aria-label="Buscar mentorada" />
              <button className={a.linkBtn} onClick={() => setAbertos(s => (s.size ? new Set() : new Set(visiveis.map(i => i.id))))}>
                {abertos.size ? "Recolher todas" : "Expandir todas"}
              </button>
            </div>

            {BANDAS.map(b => {
              const doGrupo = visiveis
                .filter(i => i.banda === b.k)
                .sort((x, y) => (x.prioridade ?? 99) - (y.prioridade ?? 99) || x.nome.localeCompare(y.nome, "pt-BR"));
              if (!doGrupo.length) return null;
              return (
                <section key={b.k} className={a.band}>
                  <div className={a.bandHead} style={{ color: b.cor }}>
                    <h2>{b.titulo}</h2>
                    <span>{doGrupo.length} mentorada{doGrupo.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className={a.cards}>
                    {doGrupo.map(i => (
                      <Card
                        key={i.id}
                        i={i}
                        aberto={abertos.has(i.id)}
                        mostrarPrograma={!props.programa}
                        onToggle={() => toggle(i.id)}
                        onJornada={() => i.mentoradaId && setJornada(i.mentoradaId)}
                        onCopiar={copiar}
                      />
                    ))}
                  </div>
                </section>
              );
            })}

            {props.semVarredura.length > 0 && (
              <div className={a.fora}>
                <div className={a.foraHead}>
                  <h3>Ativas que não apareceram {props.programa ? "nesta varredura" : "nas últimas varreduras"}</h3>
                  <span>Inclua na próxima varredura para não perder ninguém de vista</span>
                </div>
                <div className={a.foraLista}>
                  {props.semVarredura.map(m => (
                    <button key={m.id} onClick={() => setJornada(m.id)}>
                      {m.nome}<small>{m.tipo} · {m.status}</small>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {props.registros.length > 0 && (
          <details className={a.registros}>
            <summary>Registros individuais recentes ({props.registros.length})</summary>
            <div className={a.regLista}>
              {props.registros.map(r => (
                <div key={r.id} className={`${a.reg} ${r.marco ? a.regMarco : ""}`}>
                  <div className={a.regHead}>
                    <button className={a.regNome} onClick={() => setJornada(r.mentorada.id)}>{r.mentorada.nome}</button>
                    <span>{r.mentorada.tipo}</span>
                    {r.tipo && <span className={a.regTipo}>{r.tipo}</span>}
                    {r.marco && <span className={a.regTipo}>★ {r.marcoTitulo ?? "Evolução"}</span>}
                    <span className={a.regData}>{fmt(r.data)}{r.autor ? ` · ${r.autor}` : ""}</span>
                  </div>
                  <div className={a.regTexto}>{r.texto}</div>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {importar && (
        <ImportarVarreduraModal
          programaInicial={props.programa}
          programas={programas}
          base={props.base}
          ultimas={props.ultimas}
          assinatura={props.assinatura}
          onClose={() => setImportar(false)}
          onImportada={programa => {
            setImportar(false);
            avisar("Varredura importada");
            ir(programa);
            router.refresh();
          }}
        />
      )}
      {jornada && <JornadaModal key={jornada} id={jornada} onClose={() => setJornada(null)} />}
      {toast && <div className={a.toast} role="status">{toast}</div>}
    </>
  );
}

function Campo({ titulo, itens }: { titulo: string; itens: string[] }) {
  if (!itens.length) return null;
  return (
    <div className={a.field}>
      <h4>{titulo}</h4>
      <ul>{itens.map((x, k) => <li key={k}>{x}</li>)}</ul>
    </div>
  );
}

function Card({
  i, aberto, mostrarPrograma, onToggle, onJornada, onCopiar,
}: {
  i: Item;
  aberto: boolean;
  mostrarPrograma: boolean;
  onToggle: () => void;
  onJornada: () => void;
  onCopiar: (t: string) => void;
}) {
  const b = bandaInfo(i.banda);
  const ant = i.anterior;
  const tendencia = ant
    ? PESO_BANDA[i.banda as Banda] > PESO_BANDA[ant.banda as Banda]
      ? { cls: a.up, txt: `↑ melhorou (era ${bandaInfo(ant.banda).label.toLowerCase()} em ${fmt(ant.data)})` }
      : PESO_BANDA[i.banda as Banda] < PESO_BANDA[ant.banda as Banda]
        ? { cls: a.down, txt: `↓ piorou (era ${bandaInfo(ant.banda).label.toLowerCase()} em ${fmt(ant.data)})` }
        : { cls: a.same, txt: `= igual a ${fmt(ant.data)}` }
    : { cls: a.same, txt: "primeira varredura" };
  const wa = linkWhats(i.mentorada?.whatsapp ?? null, i.mensagem);

  return (
    <div id={`card-${i.id}`} className={`${a.card} ${aberto ? a.open : ""}`} style={{ "--c": b.cor } as React.CSSProperties}>
      <button className={a.cardHead} onClick={onToggle} aria-expanded={aberto}>
        <span className={a.stripe} />
        <span className={a.cardMain}>
          <span className={a.titleRow}>
            <span className={a.name}>{i.nome}</span>
            {i.tag && <span className={a.tag}>{i.tag}</span>}
            {mostrarPrograma && i.varredura.programa && <span className={a.progMini}>{i.varredura.programa}</span>}
            <span className={`${a.trend} ${tendencia.cls}`}>{tendencia.txt}</span>
          </span>
          {i.etapa && <span className={a.stage}>{i.etapa}</span>}
          {i.status && <span className={a.status}>{i.status}</span>}
        </span>
        <svg className={a.chevron} viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {aberto && (
        <div className={a.body}>
          <div className={a.metaRow}>
            {i.mentorada ? (
              <>
                <span>{i.mentorada.tipo} · {i.mentorada.status}{i.mentorada.prazo ? ` · encerra em ${fmt(i.mentorada.prazo)}` : ""}</span>
                <button className={a.linkBtn} onClick={onJornada}>Ver jornada completa →</button>
              </>
            ) : (
              <span className={a.semVinculo}>Não vinculada a um cadastro — confira o nome na próxima varredura.</span>
            )}
          </div>
          <div className={a.twoCol}>
            <Campo titulo="O que já foi concluído" itens={i.concluido} />
            <Campo titulo="Pendências" itens={i.pendencias} />
          </div>
          <Campo titulo="Pontos de atenção" itens={i.atencao} />
          <div className={a.twoCol}>
            <Campo titulo="O que preciso acompanhar" itens={i.acompanhar} />
            <Campo titulo="O que preciso perguntar" itens={i.perguntar} />
          </div>
          <Campo titulo="Retornos que preciso enviar" itens={i.retornos} />
          <Campo titulo="Próximos passos recomendados" itens={i.proximos} />
          {i.mensagem && (
            <div className={a.field}>
              <h4>Mensagem sugerida</h4>
              <div className={a.msg}>{i.mensagem}</div>
              <div className={a.msgActions}>
                <button className={a.btnGhost} onClick={() => onCopiar(i.mensagem!)}>Copiar mensagem</button>
                {wa && <a className={a.btnWa} href={wa} target="_blank" rel="noopener noreferrer">Abrir no WhatsApp</a>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
