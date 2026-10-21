"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Jornada, {
  type Acomp, type Campo, type CampoEtapa, type Detalhe, dataEtapa, diasEntre, etapaFields, fmt, hojeISO, toInput,
} from "./Jornada";
import RenovarModal from "./RenovarModal";
import s from "./MentoradaDrawer.module.css";

const PROGRAMAS = ["Nexus 1", "Nexus 2", "Nexus 3", "Atlas", "Delta", "MCR", "FCI", "CP1", "Personalizado"];
const STATUS = ["Ativo", "Em Andamento", "Em Renovação", "Encerrado", "Churn"];
const SAUDE = ["Saudável", "Atenção", "Risco"];
const DISC = ["D", "I", "S", "C", "DI", "DC", "ID", "IC", "IS", "SC", "SI", "CD", "CS", "DIS", "DSC", "ISC", "SDC", "Outro"];
const ORIGENS = ["Fluxo de Vendas", "Indicação", "Lives / Eventos", "Instagram", "LinkedIn", "YouTube", "Parceria", "Upsell / Upgrade", "Downgrade", "Cross-sell", "Workshop A Revolução Atlas", "Outra"];
const DURACOES = ["6", "7", "8", "12"];
const ACOMP_TIPOS = ["WhatsApp", "Sessão", "E-mail", "Outro"];
const ACAO_COR: Record<string, string> = { "RENOVAÇÃO": "#10B981", UPGRADE: "#8B5CF6", DOWNGRADE: "#F59E0B", CROSS: "#3B82F6" };

const STATUS_CLS: Record<string, string> = {
  Ativo: s.bAtivo, "Em Andamento": s.bAtivo, "Em Renovação": s.bRenov, Encerrado: s.bEnc, Churn: s.bChurn,
};
const SAUDE_CLS: Record<string, string> = { Saudável: s.bAtivo, Atenção: s.bRenov, Risco: s.bChurn };

const GRUPO: Record<string, { grupo: string[]; opcional: string[] }> = {
  Atlas: { grupo: ["Encontro semanal em grupo (durante 6 meses)"], opcional: [] },
  "Nexus 1": { grupo: ["Evolution Day (mensal)", "Masterclass Day (mensal)"], opcional: ["O Código da Aprovação (mensal — opcional)"] },
  "Nexus 2": { grupo: ["Evolution Day (mensal)", "Masterclass Day (mensal)"], opcional: ["O Código da Aprovação (mensal — opcional)"] },
  "Nexus 3": { grupo: ["Evolution Day (mensal)", "Masterclass Day (mensal)"], opcional: ["O Código da Aprovação (mensal — opcional)"] },
};

const EVENTOS_ATLAS: Campo[] = [1, 2, 3, 4].map(i => ({ key: `s${i}`, label: `Semana ${i}` }));
const EVENTOS_NEXUS: Campo[] = [
  { key: "evolutionDay", label: "Evolution Day" },
  { key: "masterclassDay", label: "Masterclass Day" },
  { key: "codigoAprovacao", label: "O Código da Aprovação (opcional)" },
];

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function mesesDoContrato(inicio: string | null, prazo: string | null): string[] {
  const hoje = new Date();
  const fimLimite = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), 1));
  if (!inicio) {
    return [3, 2, 1, 0].map(k => {
      const d = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth() - k, 1));
      return d.toISOString().slice(0, 7);
    });
  }
  const ini = new Date(inicio);
  let cur = new Date(Date.UTC(ini.getUTCFullYear(), ini.getUTCMonth(), 1));
  const p = prazo ? new Date(prazo) : null;
  const fimPrazo = p ? new Date(Date.UTC(p.getUTCFullYear(), p.getUTCMonth(), 1)) : fimLimite;
  const fim = fimPrazo < fimLimite ? fimPrazo : fimLimite;
  const out: string[] = [];
  while (cur <= fim && out.length < 24) {
    out.push(cur.toISOString().slice(0, 7));
    cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
  }
  return out.length ? out : [ini.toISOString().slice(0, 7)];
}
const labelMes = (ym: string) => `${MESES[+ym.slice(5, 7) - 1]}/${ym.slice(0, 4)}`;

function opcoes(lista: string[], atual: string) {
  return atual && !lista.includes(atual) ? [atual, ...lista] : lista;
}

type Form = Record<string, string>;
const CAMPOS_FORM = [
  "nome", "tipo", "status", "saude", "area", "localizacao", "email", "linkedin", "drive", "asana",
  "whatsapp", "disc", "produtoAnterior", "origem", "resp", "turma", "vagaCargo", "vagaEmpresa",
  "saudeMotivo",
] as const;

function paraForm(d: Detalhe): Form {
  const f: Form = {};
  for (const k of CAMPOS_FORM) f[k] = (d[k] as string | null) ?? "";
  f.duracao = d.duracao != null ? String(d.duracao) : "";
  f.mesesAntes = d.mesesAntes != null ? String(d.mesesAntes) : "";
  f.inicio = toInput(d.inicio);
  f.prazo = toInput(d.prazo);
  f.cancelamento = toInput(d.cancelamento);
  f.vagaData = toInput(d.vagaData);
  return f;
}

export type Aba = "jornada" | "dados" | "etapas" | "presenca" | "renovacoes" | "acomp";
const ABAS: { k: Aba; label: string }[] = [
  { k: "jornada", label: "Jornada" },
  { k: "dados", label: "Dados" },
  { k: "etapas", label: "Etapas do Programa" },
  { k: "presenca", label: "Presença nos Encontros" },
  { k: "renovacoes", label: "Renovações" },
  { k: "acomp", label: "Acompanhamento" },
];

export default function MentoradaDrawer({
  id,
  abaInicial = "dados",
  onClose,
  onChanged,
}: {
  id: string;
  abaInicial?: Aba;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [d, setD] = useState<Detalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>(abaInicial);
  const [form, setForm] = useState<Form>({});
  const [salvando, setSalvando] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [novaObs, setNovaObs] = useState("");
  const [acomp, setAcomp] = useState({ data: hojeISO(), tipo: "Sessão", texto: "", autor: "", marco: false, marcoTitulo: "" });
  const [renovAberto, setRenovAberto] = useState(false);

  const avisar = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(t => (t === msg ? null : t)), 2400);
  }, []);

  const carregar = useCallback(async () => {
    const r = await fetch(`/api/mentorados/${id}`, { cache: "no-store" });
    if (!r.ok) {
      setErro(r.status === 404 ? "Mentorada não encontrada." : "Não foi possível carregar os dados. Recarregue a página.");
      return null;
    }
    const json: Detalhe = await r.json();
    setD(json);
    return json;
  }, [id]);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/mentorados/${id}`, { cache: "no-store" })
      .then(async r => {
        if (!vivo) return;
        if (!r.ok) {
          setErro(r.status === 404 ? "Mentorada não encontrada." : "Não foi possível carregar os dados. Recarregue a página.");
          return;
        }
        const json: Detalhe = await r.json();
        if (!vivo) return;
        setD(json);
        setForm(paraForm(json));
        setAcomp(a => ({ ...a, autor: json.resp ?? "" }));
      })
      .catch(() => vivo && setErro("Sem conexão com o servidor. Verifique a internet e tente de novo."));
    return () => { vivo = false; };
  }, [id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function chamar(url: string, method: string, body?: unknown) {
    const r = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw new Error(j.erro || "Não foi possível salvar. Tente novamente.");
    }
    return r.json();
  }

  async function salvarDados() {
    if (!d) return;
    if (!form.nome?.trim()) return avisar("O nome não pode ficar vazio.");
    setSalvando(true);
    try {
      await chamar(`/api/mentorados/${d.id}`, "PATCH", form);
      const json = await carregar();
      if (json) setForm(paraForm(json));
      onChanged?.();
      avisar("Dados salvos");
    } catch (e) {
      avisar((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  async function salvarEtapa(f: CampoEtapa, data: string) {
    if (!d) return;
    try {
      if (f.campoMentorada) {
        await chamar(`/api/mentorados/${d.id}`, "PATCH", { [f.campoMentorada]: data || null });
        setForm(fm => ({ ...fm, [f.campoMentorada!]: data }));
      } else {
        await chamar(`/api/mentorados/${d.id}/etapas`, "PUT", { nome: f.key, data: data || null });
      }
      await carregar();
      onChanged?.();
      avisar(data ? "Etapa salva" : "Etapa removida");
    } catch (e) {
      avisar((e as Error).message);
    }
  }

  async function alternarPresenca(encontro: string, atual: boolean | undefined) {
    if (!d) return;
    const proximo = atual === undefined ? true : atual === true ? false : null;
    const otimista = d.presencas.filter(p => p.encontro !== encontro);
    if (proximo !== null) otimista.push({ id: `tmp-${encontro}`, encontro, presente: proximo });
    setD({ ...d, presencas: otimista });
    try {
      await chamar(`/api/mentorados/${d.id}/presencas`, "PUT", { encontro, presente: proximo });
      onChanged?.();
    } catch (e) {
      avisar((e as Error).message);
      await carregar();
    }
  }

  async function adicionar(rota: string, body: unknown, ok: string) {
    if (!d) return false;
    try {
      await chamar(`/api/mentorados/${d.id}/${rota}`, "POST", body);
      await carregar();
      onChanged?.();
      avisar(ok);
      return true;
    } catch (e) {
      avisar((e as Error).message);
      return false;
    }
  }

  async function alternarMarco(a: Acomp) {
    if (!d) return;
    let titulo: string | null = null;
    if (!a.marco) {
      titulo = window.prompt("Qual foi a evolução? (ex: Currículo aprovado, 1ª entrevista)", "");
      if (titulo === null) return;
    }
    try {
      await chamar(`/api/mentorados/${d.id}/acompanhamentos`, "PATCH", { item: a.id, marco: !a.marco, marcoTitulo: titulo });
      await carregar();
      avisar(a.marco ? "Evolução desmarcada" : "Marcada como evolução");
    } catch (e) {
      avisar((e as Error).message);
    }
  }

  async function remover(rota: string, item: string) {
    if (!d) return;
    if (!window.confirm("Remover este registro? Essa ação não pode ser desfeita.")) return;
    try {
      await chamar(`/api/mentorados/${d.id}/${rota}?item=${encodeURIComponent(item)}`, "DELETE");
      await carregar();
      onChanged?.();
      avisar("Registro removido");
    } catch (e) {
      avisar((e as Error).message);
    }
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => {
      const n = { ...f, [k]: e.target.value };
      if (k === "cancelamento" && e.target.value) n.status = "Churn";
      return n;
    });

  const presMap = useMemo(() => new Map((d?.presencas ?? []).map(p => [p.encontro, p.presente])), [d]);

  const diasRestantes = d?.prazo ? diasEntre(hojeISO(), d.prazo) : null;

  return (
    <>
      <div className={s.overlay} onClick={onClose} />
      <aside className={s.drawer} role="dialog" aria-modal="true" aria-label={d?.nome ?? "Mentorada"}>
        <header className={s.header}>
          <div className={s.headMain}>
            <div className={s.nome}>{d?.nome ?? (erro ? "Erro" : "Carregando…")}</div>
            {d && (
              <div className={s.meta}>
                <span className={`${s.badge} ${STATUS_CLS[d.status] ?? s.bSilver}`}>{d.status}</span>
                <span>{d.tipo}</span>
                {d.area && <span className={s.metaArea}>{d.area}</span>}
                {d.codigo && <span className={s.metaCod}>#{d.codigo}</span>}
              </div>
            )}
          </div>
          <button className={s.close} onClick={onClose} aria-label="Fechar">✕</button>
        </header>

        {d && (
          <div className={s.summary}>
            <div><span>Início</span><strong>{fmt(d.inicio)}</strong></div>
            <div><span>Encerramento</span><strong>{fmt(d.prazo)}</strong></div>
            <div>
              <span>Contrato</span>
              <strong className={diasRestantes !== null && diasRestantes < 0 ? s.txtMuted : diasRestantes !== null && diasRestantes <= 30 ? s.txtWarn : ""}>
                {diasRestantes === null ? "—" : diasRestantes < 0 ? "Encerrado" : `${diasRestantes} dias`}
              </strong>
            </div>
            <div>
              <span>Saúde</span>
              {d.saude ? <span className={`${s.badge} ${SAUDE_CLS[d.saude] ?? s.bSilver}`}>{d.saude}</span> : <strong>—</strong>}
            </div>
          </div>
        )}

        <nav className={s.tabs}>
          {ABAS.map(t => (
            <button key={t.k} className={`${s.tab} ${aba === t.k ? s.tabOn : ""}`} onClick={() => setAba(t.k)}>
              {t.label}
              {t.k === "acomp" && d && d.acompanhamentos.length > 0 && <em className={s.tabCount}>{d.acompanhamentos.length}</em>}
              {t.k === "renovacoes" && d && d.renovacoes.length > 0 && <em className={s.tabCount}>{d.renovacoes.length}</em>}
            </button>
          ))}
        </nav>

        <div className={s.body}>
          {erro && <div className={s.empty}>{erro}</div>}
          {!d && !erro && <div className={s.skeleton}><div /><div /><div /><div /></div>}

          {d && aba === "jornada" && (
            <Jornada
              d={d}
              onToggleMarco={alternarMarco}
              acoes={
                <>
                  <button className={s.btnGhost} onClick={() => { setAcomp(a => ({ ...a, marco: false, marcoTitulo: "" })); setAba("acomp"); }}>
                    + Acompanhamento
                  </button>
                  <button className={s.btnDark} onClick={() => { setAcomp(a => ({ ...a, marco: true })); setAba("acomp"); }}>
                    ★ Registrar evolução
                  </button>
                </>
              }
            />
          )}

          {d && aba === "dados" && (
            <div>
              <div className={s.row}>
                <F label="Nome completo"><input value={form.nome ?? ""} onChange={set("nome")} /></F>
                <F label="ID"><input value={d.codigo ?? ""} disabled /></F>
              </div>
              <div className={s.row}>
                <F label="Programa">
                  <select value={form.tipo ?? ""} onChange={set("tipo")}>
                    {opcoes(PROGRAMAS, form.tipo ?? "").map(o => <option key={o}>{o}</option>)}
                  </select>
                </F>
                <F label="Status">
                  <select value={form.status ?? ""} onChange={set("status")}>
                    {opcoes(STATUS, form.status ?? "").map(o => <option key={o}>{o}</option>)}
                  </select>
                </F>
              </div>
              <div className={s.row}>
                <F label="Área de aplicação"><input value={form.area ?? ""} onChange={set("area")} placeholder="Ex: Supply Chain, Engenharia, RH…" /></F>
                <F label="Localização"><input value={form.localizacao ?? ""} onChange={set("localizacao")} placeholder="Ex: Brasil, Irlanda, Portugal…" /></F>
              </div>
              <div className={s.row}>
                <F label="E-mail" href={form.email ? `mailto:${form.email}` : undefined}>
                  <input type="email" value={form.email ?? ""} onChange={set("email")} placeholder="email@exemplo.com" />
                </F>
                <F label="LinkedIn" href={linkExterno(form.linkedin)}>
                  <input value={form.linkedin ?? ""} onChange={set("linkedin")} placeholder="linkedin.com/in/…" />
                </F>
              </div>
              <div className={s.row3}>
                <F label="Google Drive" href={linkExterno(form.drive)}>
                  <input value={form.drive ?? ""} onChange={set("drive")} placeholder="drive.google.com/…" />
                </F>
                <F label="Asana" href={linkExterno(form.asana)}>
                  <input value={form.asana ?? ""} onChange={set("asana")} placeholder="app.asana.com/…" />
                </F>
                <F label="WhatsApp" href={linkWhats(form.whatsapp)}>
                  <input type="tel" value={form.whatsapp ?? ""} onChange={set("whatsapp")} placeholder="+55 11 99999-9999" />
                </F>
              </div>
              <div className={s.row}>
                <F label="Perfil DISC">
                  <select value={form.disc ?? ""} onChange={set("disc")}>
                    <option value="">Selecione…</option>
                    {opcoes(DISC, form.disc ?? "").map(o => <option key={o}>{o}</option>)}
                  </select>
                </F>
                <F label="Produto anterior">
                  <input list="dl-produto" value={form.produtoAnterior ?? ""} onChange={set("produtoAnterior")} placeholder="Nenhum (novo aluno)" />
                  <datalist id="dl-produto">{PROGRAMAS.map(o => <option key={o} value={o} />)}</datalist>
                </F>
              </div>
              <div className={s.row}>
                <F label="Origem">
                  <input list="dl-origem" value={form.origem ?? ""} onChange={set("origem")} placeholder="Selecione ou digite…" />
                  <datalist id="dl-origem">{ORIGENS.map(o => <option key={o} value={o} />)}</datalist>
                </F>
                <F label="Turma"><input value={form.turma ?? ""} onChange={set("turma")} /></F>
              </div>
              <div className={s.row}>
                <F label="Data de início"><input type="date" value={form.inicio ?? ""} onChange={set("inicio")} /></F>
                <F label="Data de encerramento"><input type="date" value={form.prazo ?? ""} onChange={set("prazo")} /></F>
              </div>
              <div className={s.row}>
                <F label="Data de cancelamento" hint="Preencher marca o status como Churn">
                  <input type="date" value={form.cancelamento ?? ""} onChange={set("cancelamento")} />
                </F>
                <div />
              </div>
              <div className={s.row3}>
                <F label="Tempo de mentoria">
                  <select value={form.duracao ?? ""} onChange={set("duracao")}>
                    <option value="">—</option>
                    {opcoes(DURACOES, form.duracao ?? "").map(o => <option key={o} value={o}>{o} meses</option>)}
                  </select>
                </F>
                <F label="Meses em programas anteriores">
                  <input type="number" min={0} max={60} value={form.mesesAntes ?? ""} onChange={set("mesesAntes")} placeholder="0" />
                </F>
                <F label="Saúde">
                  <select value={form.saude ?? ""} onChange={set("saude")}>
                    <option value="">—</option>
                    {opcoes(SAUDE, form.saude ?? "").map(o => <option key={o}>{o}</option>)}
                  </select>
                </F>
              </div>
              <div className={s.row1}>
                <F label="Por que está nessa condição de saúde?" hint={d.saudeMotivoEm ? `Atualizado em ${fmt(d.saudeMotivoEm)}` : undefined}>
                  <textarea rows={2} value={form.saudeMotivo ?? ""} onChange={set("saudeMotivo")} placeholder="Ex: faltou aos 2 últimos encontros e não respondeu no WhatsApp" />
                </F>
              </div>
              <div className={s.row1}>
                <F label="CS responsável"><input value={form.resp ?? ""} onChange={set("resp")} /></F>
              </div>

              <div className={s.sectionTitle}>Aprovação em vaga</div>
              <div className={s.row}>
                <F label="Vaga / cargo"><input value={form.vagaCargo ?? ""} onChange={set("vagaCargo")} placeholder="Ex: Analista de Supply Chain" /></F>
                <F label="Empresa"><input value={form.vagaEmpresa ?? ""} onChange={set("vagaEmpresa")} placeholder="Nome da empresa" /></F>
              </div>
              <div className={s.row}>
                <F label="Data da aprovação"><input type="date" value={form.vagaData ?? ""} onChange={set("vagaData")} /></F>
                <div />
              </div>

              <button className={s.saveBtn} onClick={salvarDados} disabled={salvando}>
                {salvando ? "Salvando…" : "Salvar alterações"}
              </button>

              <div className={s.sectionTitle} style={{ marginTop: 24 }}>Histórico de observações</div>
              <div className={s.formBox}>
                <textarea rows={3} value={novaObs} onChange={e => setNovaObs(e.target.value)} placeholder="Adicionar nova observação…" />
                <button
                  className={s.btnDark}
                  onClick={async () => { if (await adicionar("observacoes", { texto: novaObs }, "Observação salva")) setNovaObs(""); }}
                >
                  + Adicionar observação
                </button>
              </div>
              {d.observacoes.map(o => (
                <div key={o.id} className={s.entry}>
                  <div className={s.entryHead}>
                    <span className={s.entryDate}>{fmt(o.data)}</span>
                    {o.autor && <span className={s.entryMuted}>{o.autor}</span>}
                    <button className={s.remove} onClick={() => remover("observacoes", o.id)} aria-label="Remover observação">✕</button>
                  </div>
                  <div className={s.entryText}>{o.texto}</div>
                </div>
              ))}
              {d.obs && (
                <div className={s.entry}>
                  <div className={s.entryHead}>
                    {d.inicio && <span className={s.entryDate}>{fmt(d.inicio)}</span>}
                    <span className={s.chip}>obs anterior</span>
                  </div>
                  <div className={s.entryText}>{d.obs}</div>
                </div>
              )}
              {!d.obs && d.observacoes.length === 0 && <div className={s.emptySmall}>Nenhuma observação registrada.</div>}
            </div>
          )}

          {d && aba === "etapas" && (() => {
            const fields = etapaFields(d.tipo);
            const chaves = new Set(fields.map(f => f.key));
            const extras = d.etapas.filter(e => !chaves.has(e.nome) && e.data);
            const feitas = fields.filter(f => dataEtapa(d, f)).length;
            const pct = fields.length ? Math.round((feitas / fields.length) * 100) : 0;
            const info = GRUPO[d.tipo];
            return (
              <div>
                {fields.length > 0 && (
                  <div className={s.progress}>
                    <div className={s.progressTop}>
                      <span>Progresso da jornada</span>
                      <strong>{feitas}/{fields.length} · {pct}%</strong>
                    </div>
                    <div className={s.track}><div style={{ width: `${pct}%`, background: pct === 100 ? "var(--ok)" : "var(--champagne)" }} /></div>
                  </div>
                )}
                <div className={s.sectionTitle}>Etapas acompanhadas — {d.tipo}</div>
                {fields.map(f => {
                  const val = dataEtapa(d, f);
                  const dias = val && d.inicio ? diasEntre(d.inicio, val) : null;
                  return (
                    <div key={f.key} className={s.etapaRow}>
                      <span className={`${s.dot} ${val ? s.dotOn : ""}`} />
                      <span className={s.etapaLabel}>
                        {f.label}
                        {dias !== null && <em>{dias}d após início</em>}
                      </span>
                      <input
                        type="date"
                        className={`${s.etapaInput} ${val ? s.filled : ""}`}
                        defaultValue={toInput(val)}
                        key={`${f.key}-${val}`}
                        onChange={e => salvarEtapa(f, e.target.value)}
                      />
                    </div>
                  );
                })}
                {extras.length > 0 && (
                  <>
                    <div className={s.sectionTitle} style={{ marginTop: 18 }}>Outras etapas registradas</div>
                    {extras.map(e => (
                      <div key={e.id} className={s.etapaRow}>
                        <span className={`${s.dot} ${s.dotOn}`} />
                        <span className={s.etapaLabel}>{e.nome}</span>
                        <span className={s.entryMuted}>{fmt(e.data)}</span>
                      </div>
                    ))}
                  </>
                )}
                {info && (
                  <>
                    <div className={s.sectionTitle} style={{ marginTop: 18 }}>Encontros em grupo</div>
                    {info.grupo.map(g => <div key={g} className={s.grupoItem}>{g}</div>)}
                    {info.opcional.map(g => <div key={g} className={`${s.grupoItem} ${s.grupoOpc}`}>{g}</div>)}
                  </>
                )}
              </div>
            );
          })()}

          {d && aba === "presenca" && (() => {
            const meses = mesesDoContrato(d.inicio, d.prazo);
            const eventos = d.tipo === "Atlas" ? EVENTOS_ATLAS : EVENTOS_NEXUS;
            const todos = meses.flatMap(m => eventos.map(e => presMap.get(`${m}|${e.key}`)));
            const pres = todos.filter(v => v === true).length;
            const aus = todos.filter(v => v === false).length;
            const taxa = pres + aus > 0 ? Math.round((pres / (pres + aus)) * 100) : null;
            return (
              <div>
                <div className={s.progress}>
                  <div className={s.progressTop}>
                    <span>Assiduidade no período</span>
                    <strong>{taxa === null ? "Sem registros" : `${taxa}% · ${pres} presenças, ${aus} faltas`}</strong>
                  </div>
                  <div className={s.track}><div style={{ width: `${taxa ?? 0}%`, background: taxa !== null && taxa < 60 ? "var(--danger)" : "var(--ok)" }} /></div>
                </div>
                {[...meses].reverse().map(m => {
                  const vals = eventos.map(e => presMap.get(`${m}|${e.key}`));
                  return (
                    <div key={m} className={s.mes}>
                      <div className={s.mesTitle}>
                        {labelMes(m)}
                        <span className={s.psOk}>✓ {vals.filter(v => v === true).length}</span>
                        <span className={s.psDn}>✗ {vals.filter(v => v === false).length}</span>
                        <span className={s.psNd}>· {vals.filter(v => v === undefined).length} pendente</span>
                      </div>
                      <div className={s.presGrid}>
                        {eventos.map(e => {
                          const enc = `${m}|${e.key}`;
                          const v = presMap.get(enc);
                          return (
                            <button
                              key={enc}
                              className={`${s.presItem} ${v === true ? s.presOk : v === false ? s.presDn : ""}`}
                              onClick={() => alternarPresenca(enc, v)}
                            >
                              <span className={s.presCheck}>{v === true ? "✓" : v === false ? "✗" : ""}</span>
                              <span className={s.presNome}>{e.label}</span>
                              <span className={s.presState}>{v === true ? "Presente" : v === false ? "Ausente" : "Não registrado"}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                <div className={s.hint}>Clique para alternar entre Presente, Ausente e Não registrado.</div>
              </div>
            );
          })()}

          {d && aba === "renovacoes" && (
            <div>
              <div className={s.renovHead}>
                <div>
                  <div className={s.blockTitle}>Histórico de renovações</div>
                  <div className={s.blockSub}>Ao registrar, o cadastro é atualizado: status Ativo, programa, tempo de acesso e novo encerramento</div>
                </div>
                <button className={s.btnDark} onClick={() => setRenovAberto(true)}>+ Registrar renovação</button>
              </div>
              {renovAberto && (
                <RenovarModal
                  mentorada={d}
                  onClose={() => setRenovAberto(false)}
                  onRenovado={async () => {
                    setRenovAberto(false);
                    const json = await carregar();
                    if (json) setForm(paraForm(json));
                    onChanged?.();
                    avisar("Renovação registrada · cadastro atualizado");
                  }}
                />
              )}
              {d.renovacoes.map(r => {
                const cor = ACAO_COR[r.acao] ?? "#6B7280";
                return (
                  <div key={r.id} className={s.entry}>
                    <div className={s.entryHead}>
                      <span className={s.acao} style={{ background: `${cor}1F`, color: cor, borderColor: `${cor}55` }}>{r.acao}</span>
                      <span className={s.entryStrong}>{r.destino}</span>
                      <span className={s.entryMuted} style={{ marginLeft: "auto" }}>{fmt(r.data)}</span>
                      <button className={s.remove} style={{ marginLeft: 6 }} onClick={() => remover("renovacoes", r.id)} aria-label="Remover renovação">✕</button>
                    </div>
                    <div className={s.entryMeta}>
                      Novo prazo: <strong>{fmt(r.novoPrazo)}</strong>
                      {r.obs && <> · <em>{r.obs}</em></>}
                    </div>
                  </div>
                );
              })}
              {d.renovacoes.length === 0 && (
                <div className={s.empty}>Nenhuma renovação registrada ainda.<br />Clique em <strong>+ Registrar renovação</strong> para adicionar.</div>
              )}
            </div>
          )}

          {d && aba === "acomp" && (
            <div>
              <div className={s.formBox}>
                <div className={s.blockTitle} style={{ marginBottom: 10 }}>Novo acompanhamento</div>
                <div className={s.row}>
                  <F label="Data"><input type="date" value={acomp.data} onChange={e => setAcomp({ ...acomp, data: e.target.value })} /></F>
                  <F label="Tipo">
                    <select value={acomp.tipo} onChange={e => setAcomp({ ...acomp, tipo: e.target.value })}>
                      {ACOMP_TIPOS.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </F>
                </div>
                <div className={s.row1}>
                  <F label="Resumo / anotações">
                    <textarea rows={5} value={acomp.texto} onChange={e => setAcomp({ ...acomp, texto: e.target.value })} placeholder="Cole aqui o resumo do Claude ou escreva as anotações…" />
                  </F>
                </div>
                <div className={s.row1}>
                  <F label="Responsável"><input value={acomp.autor} onChange={e => setAcomp({ ...acomp, autor: e.target.value })} /></F>
                </div>
                <label className={`${s.marcoToggle} ${acomp.marco ? s.marcoOn : ""}`}>
                  <input type="checkbox" checked={acomp.marco} onChange={e => setAcomp({ ...acomp, marco: e.target.checked })} />
                  <span>
                    <strong>★ Evolução significativa</strong>
                    <small>Aparece em destaque na Jornada da mentorada</small>
                  </span>
                </label>
                {acomp.marco && (
                  <div className={s.row1}>
                    <F label="Qual foi a evolução?">
                      <input value={acomp.marcoTitulo} onChange={e => setAcomp({ ...acomp, marcoTitulo: e.target.value })} placeholder="Ex: Currículo aprovado, 1ª entrevista, Oferta recebida" />
                    </F>
                  </div>
                )}
                <button
                  className={s.btnDark}
                  onClick={async () => {
                    if (await adicionar("acompanhamentos", acomp, acomp.marco ? "Evolução registrada" : "Acompanhamento salvo"))
                      setAcomp({ ...acomp, texto: "", marco: false, marcoTitulo: "" });
                  }}
                >
                  Salvar acompanhamento
                </button>
              </div>
              {d.acompanhamentos.map(a => (
                <div key={a.id} className={`${s.entry} ${a.marco ? s.entryMarco : ""}`}>
                  <div className={s.entryHead}>
                    <button
                      className={`${s.star} ${a.marco ? s.starOn : ""}`}
                      onClick={() => alternarMarco(a)}
                      title={a.marco ? "Desmarcar evolução" : "Marcar como evolução significativa"}
                      aria-label={a.marco ? "Desmarcar evolução" : "Marcar como evolução significativa"}
                    >
                      ★
                    </button>
                    <span className={s.entryDate}>{fmt(a.data)}</span>
                    {a.tipo && <span className={s.chipGold}>{a.tipo}</span>}
                    {a.marco && a.marcoTitulo && <span className={s.entryStrong}>{a.marcoTitulo}</span>}
                    {a.autor && <span className={s.entryMuted} style={{ marginLeft: "auto" }}>{a.autor}</span>}
                    <button className={s.remove} style={a.autor ? { marginLeft: 6 } : undefined} onClick={() => remover("acompanhamentos", a.id)} aria-label="Remover acompanhamento">✕</button>
                  </div>
                  <div className={s.entryText}>{a.texto}</div>
                </div>
              ))}
              {d.acompanhamentos.length === 0 && <div className={s.empty}>Nenhum acompanhamento registrado ainda.</div>}
            </div>
          )}
        </div>

        {toast && <div className={s.toast} role="status">{toast}</div>}
      </aside>
    </>
  );
}

function linkExterno(v?: string) {
  if (!v) return undefined;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}
function linkWhats(v?: string) {
  const n = (v ?? "").replace(/\D/g, "");
  return n.length >= 8 ? `https://wa.me/${n}` : undefined;
}

function F({ label, hint, href, children }: { label: string; hint?: string; href?: string; children: React.ReactNode }) {
  return (
    <div className={s.field}>
      <label>
        {label}
        {href && <a href={href} target="_blank" rel="noopener noreferrer" className={s.fieldLink}>abrir ↗</a>}
      </label>
      {children}
      {hint && <small>{hint}</small>}
    </div>
  );
}
