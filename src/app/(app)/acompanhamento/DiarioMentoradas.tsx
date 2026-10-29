"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import MentoradaDrawer from "@/components/MentoradaDrawer";
import { encontrosGrupo, etapaFields, fmt, hojeISO } from "@/lib/jornada";
import { BANDAS } from "@/lib/varredura";
import styles from "../shared.module.css";
import a from "./acompanhamento.module.css";
import d from "./diario.module.css";

type ItemLista = {
  id: string; nome: string; tipo: string; status: string; saude: string | null; saudeNota: number | null;
  ultimoRegistro: { data: string; autor: string | null } | null;
};
type Registro = {
  id: string; data: string; criadoEm: string; tipo: string | null; texto: string; autor: string | null;
  marco: boolean; marcoTitulo: string | null; daVarredura: boolean;
};
type Selecionada = {
  id: string; nome: string; tipo: string; status: string; codigo: string | null; inicio: string | null; prazo: string | null;
  saude: string | null; saudeNota: number | null; saudeMotivo: string | null; whatsapp: string | null; linkedin: string | null;
  drive: string | null; disc: string | null; area: string | null; localizacao: string | null;
  vagaCargo: string | null; vagaEmpresa: string | null; vagaData: string | null;
  etapas: { nome: string; titulo: string | null; data: string | null; programa: string }[];
  presencas: { encontro: string; presente: boolean }[];
  renovacoes: { acao: string; destino: string; data: string }[];
  acompanhamentos: Registro[];
  observacoes: { id: string; data: string; texto: string; autor: string | null }[];
  varredura: { data: string; banda: string; tag: string | null; etapa: string | null; status: string | null; pendencias: string[]; proximos: string[] } | null;
};

const ATIVOS = ["Ativo", "Em Andamento", "Em Renovação"];
const TIPOS = ["Mentoria individual", "Encontro em grupo", "WhatsApp", "Revisão de material", "Roadmap", "Outro"];
const SAUDE_COR: Record<string, string> = { "Saudável": "#10B981", "Atenção": "#D97706", Risco: "#EF4444" };
const grupo = (tipo: string) => tipo.replace(/ \d+$/, "");
const iniciais = (nome: string | null) =>
  (nome ?? "?").replace(/ - .*/, "").split(" ").filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join("") || "?";

export default function DiarioMentoradas(props: {
  lista: ItemLista[];
  selecionada: Selecionada | null;
  autorPadrao: string;
  podeRegistrar: boolean;
  podeExcluir: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [prog, setProg] = useState(params.get("p") ?? "");
  const [status, setStatus] = useState(params.get("s") ?? "ativas");
  const [busca, setBusca] = useState("");

  const programas = useMemo(() => [...new Set(props.lista.map(m => grupo(m.tipo)).filter(Boolean))].sort((x, y) => x.localeCompare(y, "pt-BR")), [props.lista]);
  const visiveis = props.lista.filter(m =>
    (!prog || grupo(m.tipo) === prog) &&
    (status === "todas" || ATIVOS.includes(m.status)) &&
    (!busca || m.nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(busca.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")))
  );

  const abrir = (id: string) => {
    const q = new URLSearchParams();
    q.set("m", id);
    if (prog) q.set("p", prog);
    if (status !== "ativas") q.set("s", status);
    router.push(`/acompanhamento?${q}`, { scroll: false });
  };

  return (
    <>
      <div className={styles.topbar}>
        <div>
          <div className={styles.pageTitle}>Acompanhamento</div>
          <div className={styles.pageSub}>Diário das mentoradas: histórico e registros da equipe de mentoria</div>
        </div>
        <nav className={a.progTabs} aria-label="Visão">
          <span className={a.tabOn} aria-current="page" style={{ padding: "6px 13px", borderRadius: 6, fontSize: 12, fontWeight: 600 }}>Diário das mentoradas</span>
          <Link href="/acompanhamento?visao=varreduras" className={d.abaLink}>Varreduras semanais</Link>
        </nav>
      </div>

      <div className={`${styles.content} ${d.grade}`}>
        <aside className={d.lista} aria-label="Mentoradas">
          <input className={d.busca} value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar mentorada pelo nome" aria-label="Buscar mentorada" />
          <div className={d.filtros}>
            <select value={prog} onChange={e => setProg(e.target.value)} aria-label="Mentoria">
              <option value="">Todas as mentorias</option>
              {programas.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={status} onChange={e => setStatus(e.target.value)} aria-label="Situação">
              <option value="ativas">Ativas e em renovação</option>
              <option value="todas">Todas, inclusive encerradas</option>
            </select>
          </div>
          <div className={d.contagem}>{visiveis.length} mentoradas</div>
          <ul className={d.itens}>
            {visiveis.map(m => (
              <li key={m.id}>
                <button className={`${d.item} ${props.selecionada?.id === m.id ? d.itemOn : ""}`} onClick={() => abrir(m.id)} aria-current={props.selecionada?.id === m.id}>
                  <span className={d.ponto} style={{ background: SAUDE_COR[m.saude ?? ""] ?? "var(--bdr)" }} title={m.saude ?? "Sem saúde"} />
                  <span className={d.itemTexto}>
                    <strong>{m.nome}</strong>
                    <small>
                      {m.tipo}{!ATIVOS.includes(m.status) ? ` · ${m.status}` : ""} ·{" "}
                      {m.ultimoRegistro ? `último registro ${fmt(m.ultimoRegistro.data)}${m.ultimoRegistro.autor ? ` (${m.ultimoRegistro.autor.split(" ")[0]})` : ""}` : "sem registros"}
                    </small>
                  </span>
                </button>
              </li>
            ))}
            {!visiveis.length && <li className={d.nada}>Nenhuma mentorada com esses filtros.</li>}
          </ul>
        </aside>

        <section className={d.painel} aria-live="polite">
          {props.selecionada ? (
            <Painel key={props.selecionada.id} m={props.selecionada} {...props} />
          ) : (
            <div className={a.vazio}>
              <div className={a.vazioTitulo}>Escolha uma mentorada</div>
              <p>Filtre pela mentoria ou busque pelo nome. Ao abrir, você vê a jornada, os encontros, a última varredura e todo o histórico de registros, e pode registrar o acompanhamento.</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function Painel({ m, autorPadrao, podeRegistrar, podeExcluir }: {
  m: Selecionada; autorPadrao: string; podeRegistrar: boolean; podeExcluir: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState({ tipo: TIPOS[0], data: hojeISO(), texto: "", marco: false, marcoTitulo: "" });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [filtroFeed, setFiltroFeed] = useState<"tudo" | "equipe" | "varredura">("equipe");
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [ficha, setFicha] = useState(false);

  async function registrar() {
    if (!form.texto.trim()) return;
    setSalvando(true);
    setErro(null);
    const r = await fetch(`/api/mentorados/${m.id}/acompanhamentos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, autor: autorPadrao }),
    });
    const j = await r.json().catch(() => ({}));
    setSalvando(false);
    if (!r.ok) return setErro(j.erro || "Não foi possível registrar.");
    setForm({ ...form, texto: "", marco: false, marcoTitulo: "" });
    router.refresh();
  }

  async function excluir(rota: "acompanhamentos" | "observacoes", id: string) {
    if (!window.confirm("Excluir este registro? Isso não pode ser desfeito.")) return;
    const r = await fetch(`/api/mentorados/${m.id}/${rota}?item=${id}`, { method: "DELETE" });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      return window.alert(j.erro || "Não foi possível excluir.");
    }
    router.refresh();
  }

  // Jornada do programa atual
  const datas = new Map(m.etapas.filter(e => !e.programa || e.programa === m.tipo).map(e => [e.nome, e.data]));
  const etapas = etapaFields(m.tipo).map(f => ({ label: f.label, data: f.campoMentorada === "vagaData" ? m.vagaData : datas.get(f.key) ?? null }));
  const extras = m.etapas.filter(e => e.nome.startsWith("extra:") && (!e.programa || e.programa === m.tipo));

  // Encontros obrigatórios dos últimos 60 dias
  const obrig = encontrosGrupo(m.tipo).filter(e => !e.opcional);
  const [desde] = useState(() => new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10));
  const sessoes = m.presencas
    .map(p => {
      const [ym, chave, dia] = p.encontro.split("|");
      return { chave, dia: dia ?? `${ym}-01`, presente: p.presente, label: obrig.find(o => o.key === chave)?.label };
    })
    .filter(s => s.label && s.dia >= desde)
    .sort((x, y) => y.dia.localeCompare(x.dia));
  const pres = sessoes.filter(s => s.presente).length;

  const feed = [
    ...m.acompanhamentos.map(r => ({ ...r, rota: "acompanhamentos" as const })),
    ...m.observacoes.map(o => ({
      id: o.id, data: o.data, criadoEm: o.data, tipo: "Observação", texto: o.texto, autor: o.autor,
      marco: false, marcoTitulo: null, daVarredura: false, rota: "observacoes" as const,
    })),
  ]
    .filter(r => filtroFeed === "tudo" || (filtroFeed === "varredura" ? r.daVarredura : !r.daVarredura))
    .sort((x, y) => y.data.localeCompare(x.data) || y.criadoEm.localeCompare(x.criadoEm));
  const nEquipe = m.acompanhamentos.filter(r => !r.daVarredura).length + m.observacoes.length;
  const nVarredura = m.acompanhamentos.filter(r => r.daVarredura).length;
  const banda = m.varredura ? BANDAS.find(b => b.k === m.varredura!.banda) : null;
  const wa = (m.whatsapp ?? "").replace(/\D/g, "");

  return (
    <>
      <header className={d.cab}>
        <div>
          <h2 className={d.nome}>{m.nome}</h2>
          <div className={d.meta}>
            {m.tipo} · {m.status}{m.codigo ? ` · ${m.codigo}` : ""} · {fmt(m.inicio)} → {fmt(m.prazo)}
            {m.saude && (
              <span className={d.saude} style={{ color: SAUDE_COR[m.saude] }}>
                ● {m.saude}{m.saudeNota != null ? ` (nota ${m.saudeNota})` : ""}
              </span>
            )}
          </div>
        </div>
        <div className={d.links}>
          {wa.length >= 8 && <a className={a.btnGhost} href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">WhatsApp</a>}
          {m.linkedin && <a className={a.btnGhost} href={m.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>}
          {m.drive && <a className={a.btnGhost} href={m.drive} target="_blank" rel="noreferrer">Drive</a>}
          <button className={a.btnGhost} onClick={() => setFicha(true)}>Ficha completa</button>
        </div>
      </header>

      {podeRegistrar ? (
        <div className={d.composer}>
          <textarea
            rows={4}
            value={form.texto}
            onChange={e => setForm({ ...form, texto: e.target.value })}
            placeholder={`Registre o acompanhamento de ${m.nome.split(" ")[0]}: o que foi conversado, metas, próximos passos…`}
            aria-label="Registro de acompanhamento"
          />
          <div className={d.composerBarra}>
            <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} aria-label="Tipo de registro">
              {TIPOS.map(t => <option key={t}>{t}</option>)}
            </select>
            <input type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} aria-label="Data" />
            <label className={d.marco}>
              <input type="checkbox" checked={form.marco} onChange={e => setForm({ ...form, marco: e.target.checked })} />
              ★ Evolução significativa
            </label>
            {form.marco && (
              <input className={d.marcoTitulo} value={form.marcoTitulo} onChange={e => setForm({ ...form, marcoTitulo: e.target.value })} placeholder="Qual? Ex: roadmap traçado" aria-label="Qual evolução" />
            )}
            <span className={d.espaco} />
            {erro && <span className={d.erro}>{erro}</span>}
            <button className={a.btnPrimary} onClick={registrar} disabled={salvando || !form.texto.trim()}>
              {salvando ? "Registrando…" : "Registrar"}
            </button>
          </div>
          <div className={d.assina}>Registrado como {autorPadrao}</div>
        </div>
      ) : (
        <div className={d.somenteLeitura}>Seu acesso permite visualizar o histórico. Para registrar acompanhamentos, peça a permissão “Acompanhamento” à administradora.</div>
      )}

      <div className={d.contexto}>
        <div className={d.bloco}>
          <h3>Jornada</h3>
          <ul className={d.etapas}>
            {etapas.map(e => (
              <li key={e.label} className={e.data ? d.feita : d.pendente}>
                <span>{e.data ? "✓" : "○"}</span>{e.label}<em>{e.data ? fmt(e.data) : "pendente"}</em>
              </li>
            ))}
          </ul>
          {extras.length > 0 && <div className={d.obs}>+ {extras.length} encontro(s) extra(s): {extras.map(x => x.titulo).filter(Boolean).join(", ")}</div>}
          {m.vagaCargo && <div className={d.obs}>Vaga: {m.vagaCargo}{m.vagaEmpresa ? ` · ${m.vagaEmpresa}` : ""}</div>}
        </div>

        <div className={d.bloco}>
          <h3>Encontros ao vivo · últimos 60 dias</h3>
          {sessoes.length ? (
            <>
              <div className={d.numero}>{pres} de {sessoes.length}<small> presenças nos obrigatórios</small></div>
              <ul className={d.sessoes}>
                {sessoes.slice(0, 8).map((s, i) => (
                  <li key={i} className={s.presente ? d.feita : d.falta}>
                    <span>{s.presente ? "✓" : "✗"}</span>{s.label}<em>{fmt(s.dia)}</em>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className={d.obs}>Nenhum encontro obrigatório registrado no período.</div>
          )}
        </div>

        <div className={d.bloco}>
          <h3>Última varredura{m.varredura ? ` · ${fmt(m.varredura.data)}` : ""}</h3>
          {m.varredura ? (
            <>
              <div className={d.banda} style={{ color: banda?.cor }}>● {banda?.label}{m.varredura.tag ? ` — ${m.varredura.tag}` : ""}</div>
              {m.varredura.status && <p className={d.texto}>{m.varredura.status}</p>}
              {m.varredura.pendencias.length > 0 && <><h4>Pendências</h4><ul className={d.lista2}>{m.varredura.pendencias.slice(0, 4).map((x, i) => <li key={i}>{x}</li>)}</ul></>}
              {m.varredura.proximos.length > 0 && <><h4>Próximos passos</h4><ul className={d.lista2}>{m.varredura.proximos.slice(0, 4).map((x, i) => <li key={i}>{x}</li>)}</ul></>}
            </>
          ) : (
            <div className={d.obs}>Ainda não apareceu em nenhuma varredura.</div>
          )}
        </div>

        <div className={d.bloco}>
          <h3>Perfil</h3>
          <dl className={d.perfil}>
            <dt>DISC</dt><dd>{m.disc || "—"}</dd>
            <dt>Área</dt><dd>{m.area || "—"}</dd>
            <dt>Onde mora</dt><dd>{m.localizacao || "—"}</dd>
            {m.renovacoes[0] && (<><dt>Última renovação</dt><dd>{m.renovacoes[0].acao} → {m.renovacoes[0].destino} ({fmt(m.renovacoes[0].data)})</dd></>)}
            {m.saudeMotivo && (<><dt>Motivo da saúde</dt><dd>{m.saudeMotivo}</dd></>)}
          </dl>
        </div>
      </div>

      <div className={d.feedCab}>
        <h3>Histórico</h3>
        <div className={a.progTabs} role="tablist" aria-label="Filtrar histórico">
          <button role="tab" aria-selected={filtroFeed === "equipe"} className={filtroFeed === "equipe" ? a.tabOn : ""} onClick={() => setFiltroFeed("equipe")}>Registros da equipe · {nEquipe}</button>
          <button role="tab" aria-selected={filtroFeed === "varredura"} className={filtroFeed === "varredura" ? a.tabOn : ""} onClick={() => setFiltroFeed("varredura")}>Varreduras · {nVarredura}</button>
          <button role="tab" aria-selected={filtroFeed === "tudo"} className={filtroFeed === "tudo" ? a.tabOn : ""} onClick={() => setFiltroFeed("tudo")}>Tudo</button>
        </div>
      </div>

      <ol className={d.feed}>
        {feed.map(r => {
          const longo = r.texto.length > 420;
          const aberto = abertos.has(r.id);
          return (
            <li key={`${r.rota}-${r.id}`} className={`${d.post} ${r.marco ? d.postMarco : ""}`}>
              <span className={d.avatar} aria-hidden="true">{r.daVarredura ? "WA" : iniciais(r.autor)}</span>
              <div className={d.postCorpo}>
                <div className={d.postCab}>
                  <strong>{r.daVarredura ? "Varredura do WhatsApp" : r.autor || "Sem autor"}</strong>
                  <span>· {fmt(r.data)}</span>
                  {r.tipo && !r.daVarredura && <span className={d.chip}>{r.tipo}</span>}
                  {r.marco && <span className={d.chipMarco}>★ {r.marcoTitulo || "Evolução"}</span>}
                  {podeExcluir && !r.daVarredura && (
                    <button className={d.remover} onClick={() => excluir(r.rota, r.id)} aria-label="Excluir registro">✕</button>
                  )}
                </div>
                <p className={d.texto}>{longo && !aberto ? `${r.texto.slice(0, 420)}…` : r.texto}</p>
                {longo && (
                  <button className={d.verMais} onClick={() => setAbertos(s => { const n = new Set(s); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })}>
                    {aberto ? "Ver menos" : "Veja mais"}
                  </button>
                )}
              </div>
            </li>
          );
        })}
        {!feed.length && <li className={d.nada}>Nenhum registro {filtroFeed === "varredura" ? "de varredura" : "da equipe"} ainda.</li>}
      </ol>

      {ficha && (
        <MentoradaDrawer id={m.id} abaInicial="jornada" onClose={() => setFicha(false)} onChanged={() => router.refresh()} />
      )}
    </>
  );
}
