"use client";
import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Mentorada } from "@/lib/generated/prisma";
import MentoradaDrawer, { type Aba } from "@/components/MentoradaDrawer";
import NovoMentoradoModal, { useNovoMentorado } from "@/components/NovoMentoradoModal";
import styles from "./mentorados.module.css";

const BADGE: Record<string, string> = {
  Ativo: styles.bAtivo,
  Encerrado: styles.bEnc,
  Churn: styles.bChurn,
  "Em Renovação": styles.bRenov,
  Saudável: styles.bSau,
  Atenção: styles.bAte,
  Risco: styles.bRis,
};

function Badge({ label }: { label: string }) {
  return (
    <span className={`${styles.badge} ${BADGE[label] ?? styles.bSilver}`}>
      {label}
    </span>
  );
}

function formatData(d: Date | string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function diasPrazo(prazo: Date | string | null): number | null {
  if (!prazo) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const p = new Date(prazo);
  p.setHours(0, 0, 0, 0);
  return Math.round((p.getTime() - hoje.getTime()) / 86400000);
}

const normArea = (a: string | null) => (a ?? "").trim().toLocaleLowerCase("pt-BR");
const SEM_AREA = "__sem__";

function casaTipo(tipo: string, filtro: string) {
  return tipo === filtro || tipo.startsWith(`${filtro} `);
}

function linkExterno(v: string | null) {
  if (!v) return null;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}
function linkWhats(v: string | null) {
  const n = (v ?? "").replace(/\D/g, "");
  return n.length >= 8 ? `https://wa.me/${n}` : null;
}

const IconWhats = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M12 2a9.9 9.9 0 0 0-8.5 15l-1.4 5 5.1-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.8-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
  </svg>
);
const IconLinkedin = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.75h4V21H3V9.75Zm6.5 0h3.83v1.54h.06c.53-1 1.84-2.06 3.79-2.06 4.05 0 4.8 2.67 4.8 6.13V21h-4v-4.98c0-1.19-.02-2.72-1.66-2.72-1.66 0-1.92 1.3-1.92 2.63V21h-4V9.75Z" />
  </svg>
);
const IconMail = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="m4 7 8 6 8-6" />
  </svg>
);
const IconAsana = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="7" r="4" fill="currentColor" />
    <circle cx="6" cy="16" r="4" fill="currentColor" />
    <circle cx="18" cy="16" r="4" fill="currentColor" />
  </svg>
);
const IconDrive = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
    <path d="M8.5 3h7l6 10.5-3.5 6h-12L2.5 13.5Z" />
    <path d="M8.5 3 15 14.5h6.5M15.5 3 9 14.5l-3 5M2.5 13.5H15" />
  </svg>
);

export default function MentoradosCliente({
  mentorados,
  tipoInicial = "",
  statusInicial = "",
  buscaInicial = "",
}: {
  mentorados: Mentorada[];
  tipoInicial?: string;
  statusInicial?: string;
  buscaInicial?: string;
}) {
  const router = useRouter();
  const [busca, setBusca] = useState(buscaInicial);
  const [filtStatus, setFiltStatus] = useState(statusInicial);
  const [filtTipo, setFiltTipo] = useState(tipoInicial);
  const [filtArea, setFiltArea] = useState("");
  const [filtLocal, setFiltLocal] = useState("");
  const [pagina, setPagina] = useState(1);
  const [aberta, setAberta] = useState<{ id: string; aba: Aba } | null>(null);
  const novo = useNovoMentorado();
  const [toast, setToast] = useState<string | null>(null);
  const POR_PAG = 30;

  const avisar = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(t => (t === msg ? null : t)), 2200);
  }, []);

  const tipos = useMemo(() => {
    const set = [...new Set(mentorados.map(m => m.tipo).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    const grupos = [...new Set(set.filter(t => / \d+$/.test(t)).map(t => t.replace(/ \d+$/, "")))];
    return { set, grupos };
  }, [mentorados]);

  const statusOpts = useMemo(
    () => [...new Set(mentorados.map(m => m.status).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [mentorados]
  );

  const areas = useMemo(() => {
    const map = new Map<string, { label: string; n: number }>();
    let sem = 0;
    for (const m of mentorados) {
      const k = normArea(m.area);
      if (!k) { sem++; continue; }
      const cur = map.get(k);
      if (cur) cur.n++;
      else map.set(k, { label: (m.area ?? "").trim(), n: 1 });
    }
    const lista = [...map.entries()]
      .map(([k, v]) => ({ k, ...v }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" }));
    return { lista, sem };
  }, [mentorados]);

  const locais = useMemo(() => {
    const map = new Map<string, { label: string; n: number }>();
    let sem = 0;
    for (const m of mentorados) {
      const k = normArea(m.localizacao);
      if (!k) { sem++; continue; }
      const cur = map.get(k);
      if (cur) cur.n++;
      else map.set(k, { label: (m.localizacao ?? "").trim(), n: 1 });
    }
    const lista = [...map.entries()]
      .map(([k, v]) => ({ k, ...v }))
      .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" }));
    return { lista, sem };
  }, [mentorados]);

  const lista = useMemo(() => {
    let r = mentorados;
    if (busca) {
      const b = busca.toLowerCase();
      r = r.filter(
        (m) =>
          m.nome.toLowerCase().includes(b) ||
          (m.email ?? "").toLowerCase().includes(b) ||
          (m.codigo ?? "").toLowerCase().includes(b) ||
          (m.area ?? "").toLowerCase().includes(b) ||
          (m.localizacao ?? "").toLowerCase().includes(b)
      );
    }
    if (filtStatus) r = r.filter((m) => m.status === filtStatus);
    if (filtTipo) r = r.filter((m) => casaTipo(m.tipo, filtTipo));
    if (filtArea === SEM_AREA) r = r.filter((m) => !normArea(m.area));
    else if (filtArea) r = r.filter((m) => normArea(m.area) === filtArea);
    if (filtLocal === SEM_AREA) r = r.filter((m) => !normArea(m.localizacao));
    else if (filtLocal) r = r.filter((m) => normArea(m.localizacao) === filtLocal);
    return r;
  }, [mentorados, busca, filtStatus, filtTipo, filtArea, filtLocal]);

  const total = lista.length;
  const paginas = Math.ceil(total / POR_PAG);
  const visivel = lista.slice((pagina - 1) * POR_PAG, pagina * POR_PAG);
  const temFiltro = !!(busca || filtStatus || filtTipo || filtArea || filtLocal);

  const titulo = filtTipo ? `Mentorados · ${filtTipo}` : "Mentorados";

  async function copiarEmail(email: string) {
    try {
      await navigator.clipboard.writeText(email);
      avisar(`E-mail copiado: ${email}`);
    } catch {
      window.prompt("Copie o e-mail:", email);
    }
  }

  function limpar() {
    setBusca("");
    setFiltStatus("");
    setFiltTipo("");
    setFiltArea("");
    setFiltLocal("");
    setPagina(1);
  }

  return (
    <>
      <div className={styles.topbar}>
        <div>
          <div className={styles.pageTitle}>{titulo}</div>
          <div className={styles.pageSub}>
            Clique no nome para ver a jornada · na linha para abrir o cadastro
          </div>
        </div>
        <div className={styles.topbarRight}>
          <span className={styles.topbarDate}>
            {new Date().toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
          <button className={styles.btnNovo} onClick={novo.abrir}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {novo.temRascunho ? "Continuar cadastro" : "Novo Mentorado"}
          </button>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.tblCard}>
          <div className={styles.tblHead}>
            <div className={styles.filters}>
              <input
                type="search"
                placeholder="Buscar nome, e-mail, código, área, local…"
                value={busca}
                onChange={(e) => { setBusca(e.target.value); setPagina(1); }}
                className={styles.searchInput}
              />
              <select
                value={filtTipo}
                onChange={(e) => { setFiltTipo(e.target.value); setPagina(1); }}
                aria-label="Filtrar por programa"
              >
                <option value="">Todos os programas</option>
                {tipos.grupos.map(g => <option key={`g-${g}`} value={g}>{g} (todos)</option>)}
                {tipos.set.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select
                value={filtStatus}
                onChange={(e) => { setFiltStatus(e.target.value); setPagina(1); }}
                aria-label="Filtrar por status"
              >
                <option value="">Todos os status</option>
                {statusOpts.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select
                value={filtArea}
                onChange={(e) => { setFiltArea(e.target.value); setPagina(1); }}
                aria-label="Filtrar por área de atuação"
                className={styles.areaSelect}
              >
                <option value="">Todas as áreas</option>
                {areas.lista.map(a => <option key={a.k} value={a.k}>{a.label} ({a.n})</option>)}
                {areas.sem > 0 && <option value={SEM_AREA}>Sem área informada ({areas.sem})</option>}
              </select>
              <select
                value={filtLocal}
                onChange={(e) => { setFiltLocal(e.target.value); setPagina(1); }}
                aria-label="Filtrar por localização"
                className={styles.areaSelect}
              >
                <option value="">Todas as localizações</option>
                {locais.lista.map(a => <option key={a.k} value={a.k}>{a.label} ({a.n})</option>)}
                {locais.sem > 0 && <option value={SEM_AREA}>Sem localização ({locais.sem})</option>}
              </select>
              {temFiltro && <button className={styles.clearBtn} onClick={limpar}>Limpar filtros</button>}
            </div>
            <span className={styles.tblCount}>{total} mentorados</span>
          </div>

          <div className={styles.tblWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Contato</th>
                  <th>Tipo</th>
                  <th>Área de atuação</th>
                  <th>Localização</th>
                  <th>Status</th>
                  <th>Saúde</th>
                  <th>Início</th>
                  <th>Prazo</th>
                </tr>
              </thead>
              <tbody>
                {visivel.map((m) => {
                  const dias = diasPrazo(m.prazo);
                  const wa = linkWhats(m.whatsapp);
                  const asana = linkExterno(m.asana);
                  const linkedin = linkExterno(m.linkedin);
                  const drive = linkExterno(m.drive);
                  const abrirCadastro = () => setAberta({ id: m.id, aba: "dados" });
                  return (
                    <tr
                      key={m.id}
                      onClick={abrirCadastro}
                      className={aberta?.id === m.id ? styles.rowAtiva : undefined}
                    >
                      <td>
                        <button
                          className={styles.nomeBtn}
                          onClick={(e) => { e.stopPropagation(); setAberta({ id: m.id, aba: "jornada" }); }}
                          title="Ver jornada da mentorada"
                        >
                          {m.nome}
                        </button>
                        {m.codigo && (
                          <div className={styles.nomeId}>{m.codigo}</div>
                        )}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className={styles.icons}>
                          {wa ? (
                            <a href={wa} target="_blank" rel="noopener noreferrer" className={`${styles.ic} ${styles.icWa}`} title={`WhatsApp: ${m.whatsapp}`} aria-label="Abrir WhatsApp">
                              <IconWhats />
                            </a>
                          ) : (
                            <button className={`${styles.ic} ${styles.icOff}`} onClick={abrirCadastro} title="WhatsApp não cadastrado — clique para adicionar" aria-label="Adicionar WhatsApp"><IconWhats /></button>
                          )}
                          {m.email ? (
                            <button className={`${styles.ic} ${styles.icMail}`} onClick={() => copiarEmail(m.email!)} title={`Copiar e-mail: ${m.email}`} aria-label="Copiar e-mail">
                              <IconMail />
                            </button>
                          ) : (
                            <button className={`${styles.ic} ${styles.icOff}`} onClick={abrirCadastro} title="E-mail não cadastrado — clique para adicionar" aria-label="Adicionar e-mail"><IconMail /></button>
                          )}
                          {linkedin ? (
                            <a href={linkedin} target="_blank" rel="noopener noreferrer" className={`${styles.ic} ${styles.icLinkedin}`} title="Abrir perfil no LinkedIn" aria-label="Abrir perfil no LinkedIn">
                              <IconLinkedin />
                            </a>
                          ) : (
                            <button className={`${styles.ic} ${styles.icOff}`} onClick={abrirCadastro} title="LinkedIn não cadastrado — clique para adicionar" aria-label="Adicionar LinkedIn"><IconLinkedin /></button>
                          )}
                          {asana ? (
                            <a href={asana} target="_blank" rel="noopener noreferrer" className={`${styles.ic} ${styles.icAsana}`} title="Abrir no Asana" aria-label="Abrir no Asana">
                              <IconAsana />
                            </a>
                          ) : (
                            <button className={`${styles.ic} ${styles.icOff}`} onClick={abrirCadastro} title="Asana não cadastrado — clique para adicionar" aria-label="Adicionar link do Asana"><IconAsana /></button>
                          )}
                          {drive ? (
                            <a href={drive} target="_blank" rel="noopener noreferrer" className={`${styles.ic} ${styles.icDrive}`} title="Abrir pasta no Drive" aria-label="Abrir pasta no Drive">
                              <IconDrive />
                            </a>
                          ) : (
                            <button className={`${styles.ic} ${styles.icOff}`} onClick={abrirCadastro} title="Drive não cadastrado — clique para adicionar" aria-label="Adicionar link do Drive"><IconDrive /></button>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`${styles.badge} ${styles.bSilver}`}>
                          {m.tipo}
                        </span>
                      </td>
                      <td className={styles.areaCell}>{m.area?.trim() || <span className={styles.muted}>—</span>}</td>
                      <td className={styles.areaCell}>{m.localizacao?.trim() || <span className={styles.muted}>—</span>}</td>
                      <td>
                        <Badge label={m.status} />
                      </td>
                      <td>{m.saude ? <Badge label={m.saude} /> : "—"}</td>
                      <td>{formatData(m.inicio)}</td>
                      <td>
                        {m.prazo ? (
                          <span>
                            {formatData(m.prazo)}
                            {dias !== null && dias <= 30 && dias >= 0 && (
                              <span className={styles.diasWarn}>
                                {" "}· {dias}d
                              </span>
                            )}
                            {dias !== null && dias < 0 && (
                              <span className={styles.diasDanger}>
                                {" "}· vencido
                              </span>
                            )}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
                {visivel.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", color: "var(--txt3)", padding: "24px" }}>
                      Nenhuma mentorada com esses filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {paginas > 1 && (
            <div className={styles.pag}>
              <span className={styles.pagInfo}>
                {(pagina - 1) * POR_PAG + 1}–
                {Math.min(pagina * POR_PAG, total)} de {total}
              </span>
              <div className={styles.pagBtns}>
                <button
                  className={styles.pb}
                  disabled={pagina === 1}
                  onClick={() => setPagina(pagina - 1)}
                >
                  ‹
                </button>
                {Array.from({ length: Math.min(paginas, 7) }, (_, i) => {
                  const p =
                    paginas <= 7
                      ? i + 1
                      : pagina <= 4
                      ? i + 1
                      : pagina >= paginas - 3
                      ? paginas - 6 + i
                      : pagina - 3 + i;
                  return (
                    <button
                      key={p}
                      className={`${styles.pb} ${p === pagina ? styles.cur : ""}`}
                      onClick={() => setPagina(p)}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  className={styles.pb}
                  disabled={pagina === paginas}
                  onClick={() => setPagina(pagina + 1)}
                >
                  ›
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {aberta && (
        <MentoradaDrawer
          key={`${aberta.id}-${aberta.aba}`}
          id={aberta.id}
          abaInicial={aberta.aba}
          onClose={() => setAberta(null)}
          onChanged={() => router.refresh()}
        />
      )}

      {novo.aberto && (
        <NovoMentoradoModal
          onClose={novo.fechar}
          onCriado={(id, nome) => {
            novo.fechar();
            avisar(`${nome} cadastrada`);
            setAberta({ id, aba: "dados" });
            router.refresh();
          }}
        />
      )}

      {toast && <div className={styles.toast} role="status">{toast}</div>}
    </>
  );
}
