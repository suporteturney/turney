"use client";
import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Avatar from "@/components/Avatar";
import { ORIGENS, PROGRAMAS, duracaoPadrao, linkWhats, reais } from "@/lib/comercial";
import { FORM_HUB, FORM_PRE, NOME_TEMP, ORDEM_TEMP, TEMPERATURAS } from "@/lib/respondi";
import styles from "../../shared.module.css";
import f from "../../filtros.module.css";
import p from "../../pipeline/pipeline.module.css";
import c from "../comercial.module.css";
import { Aviso, ErroApi, FecharVenda, Janela, MotivoPerda, enviar, type DadosVenda, type Msg } from "../ui";
import LeadPainel from "./LeadPainel";
import PeriodoCalendario, { type Periodo } from "@/components/PeriodoCalendario";
import t from "./funil.module.css";

export type Etapa = { id: string; nome: string; tipo: string };
export type LeadCard = {
  id: string; nome: string; whatsapp: string | null; email: string | null; instagram: string | null; origem: string | null; programa: string | null;
  valor: number | null; responsavel: string | null; etapaId: string; etapaEm: string;
  proximoPasso: string | null; proximoPassoEm: string | null; motivoPerda: string | null;
  formularios: string[]; preenchido: string | null; temperatura: string | null; pontuacao: number | null; incompleto: boolean; // preenchido: "AAAA-MM-DD HH:mm" de Brasília
};
const POR_COLUNA = 40;

const br = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
export const vendaDoLead = (l: LeadCard, eu: string, hoje: string): DadosVenda => ({
  leadId: l.id, cliente: l.nome, email: l.email ?? "", whatsapp: l.whatsapp ?? "", programa: l.programa ?? "",
  valor: l.valor ? (l.valor / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "", pagamento: "", vendedora: l.responsavel ?? eu,
  data: hoje, origem: l.origem ?? "", inicio: hoje, duracao: String(duracaoPadrao(l.programa ?? "")), combinados: "",
});

export default function FunilCliente({ eu, hoje, equipe, gestora, etapas, leads: leadsIni, leadInicial, novoInicial, periodoInicial, tempInicial }: {
  eu: string; hoje: string; equipe: string[]; gestora: boolean; etapas: Etapa[]; leads: LeadCard[]; leadInicial: string | null; novoInicial: boolean;
  periodoInicial: Periodo | null; tempInicial: string;
}) {
  const router = useRouter();
  const [leads, setLeads] = useState(leadsIni);
  const [origem, setOrigem] = useState(leadsIni);
  if (origem !== leadsIni) { setOrigem(leadsIni); setLeads(leadsIni); }
  const [busca, setBusca] = useState("");
  const [resp, setResp] = useState("");
  const [prog, setProg] = useState("");
  const [temp, setTemp] = useState(tempInicial);
  const [form, setForm] = useState("");
  const [periodo, setPeriodo] = useState<Periodo | null>(periodoInicial);
  const [limite, setLimite] = useState<Record<string, number>>({});
  const [aberto, setAberto] = useState<string | null>(leadInicial);
  const [novo, setNovo] = useState<string | null>(novoInicial ? "" : null); // id da etapa ("" = primeira)
  const [gerenciar, setGerenciar] = useState(false);
  const [vender, setVender] = useState<LeadCard | null>(null);
  const [perder, setPerder] = useState<{ lead: LeadCard; etapaId: string } | null>(null);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const fecharMsg = useCallback(() => setMsg(null), []);

  // O período vai para o endereço: o servidor traz também os fechados e perdidos daquelas datas.
  function mudarPeriodo(p2: Periodo | null) {
    setPeriodo(p2); setLimite({});
    router.replace(p2 ? `/comercial/funil?de=${p2.de}&ate=${p2.ate}` : "/comercial/funil", { scroll: false });
  }
  const forms = useMemo(() => [...new Set([FORM_HUB, FORM_PRE, ...leads.flatMap(l => l.formularios)])], [leads]);
  // Tudo menos a temperatura: é o que alimenta os números de quente, morno e frio.
  const semTemp = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return leads.filter(l =>
      (!form || (form === "-" ? !l.formularios.length : l.formularios.includes(form))) &&
      (!periodo || (!!l.preenchido && l.preenchido.slice(0, 10) >= periodo.de && l.preenchido.slice(0, 10) <= periodo.ate)) &&
      (!resp || (resp === "-" ? !l.responsavel : l.responsavel === resp)) && (!prog || l.programa === prog) &&
      (!q || [l.nome, l.email, l.instagram, l.whatsapp].some(x => x?.toLowerCase().includes(q))));
  }, [leads, busca, resp, prog, form, periodo]);
  // Com próximo passo marcado primeiro (pela data); depois os mais quentes e, entre eles, os mais recentes.
  const filtrados = useMemo(() => semTemp.filter(l => !temp || (temp === "-" ? !l.temperatura : l.temperatura === temp)).sort((a, b) =>
    (a.proximoPassoEm ?? "9").localeCompare(b.proximoPassoEm ?? "9") ||
    (ORDEM_TEMP[a.temperatura ?? ""] ?? 3) - (ORDEM_TEMP[b.temperatura ?? ""] ?? 3) ||
    (b.preenchido ?? b.etapaEm).localeCompare(a.preenchido ?? a.etapaEm)), [semTemp, temp]);
  const conta = (k: string) => semTemp.filter(l => (k === "-" ? !l.temperatura : l.temperatura === k)).length;
  const filtrando = !!(busca || resp || prog || temp || form || periodo);
  const abertas = filtrados.filter(l => etapas.find(e => e.id === l.etapaId)?.tipo === "aberta");
  const emJogo = abertas.reduce((n, l) => n + (l.valor ?? 0), 0);

  async function mover(id: string, etapaId: string, motivoPerda?: string) {
    const lead = leads.find(l => l.id === id);
    const destino = etapas.find(e => e.id === etapaId);
    if (!lead || !destino || lead.etapaId === etapaId) return;
    if (etapas.find(e => e.id === lead.etapaId)?.tipo === "ganho") {
      setMsg({ txt: "Este lead já tem venda. Para desfazer, cancele a venda em Vendas e metas.", erro: true });
      return;
    }
    if (destino.tipo === "ganho") { setVender(lead); return; }
    if (destino.tipo === "perdido" && !motivoPerda) { setPerder({ lead, etapaId }); return; }
    setPerder(null);
    setLeads(ls => ls.map(l => (l.id === id ? { ...l, etapaId, etapaEm: new Date().toISOString(), motivoPerda: motivoPerda ?? null } : l)));
    try {
      await enviar(`/api/comercial/leads/${id}`, "PATCH", { etapaId, motivoPerda });
      setMsg({ txt: `${lead.nome} foi para “${destino.nome}”` });
      router.refresh();
    } catch (e) {
      setLeads(ls => ls.map(l => (l.id === id ? lead : l)));
      setMsg({ txt: (e as Error).message, erro: true });
    }
  }

  const card = (l: LeadCard, tipo: string) => {
    const whats = linkWhats(l.whatsapp);
    const cls = !l.proximoPassoEm ? c.passoFalta : l.proximoPassoEm < hoje ? c.passoAtrasado : l.proximoPassoEm === hoje ? c.passoHoje : "";
    return (
      <article
        key={l.id}
        className={`${p.card} ${tipo !== "ganho" ? p.cardMovel : ""} ${arrastando === l.id ? p.cardArrastando : ""}`}
        draggable={tipo !== "ganho"}
        onDragStart={e => { e.dataTransfer.setData("text/plain", l.id); e.dataTransfer.effectAllowed = "move"; setArrastando(l.id); }}
        onDragEnd={() => { setArrastando(null); setSobre(null); }}
      >
        {(l.temperatura || l.preenchido) && (
          <div className={t.topoCard}>
            {l.temperatura && <span className={`${t.temp} ${t[l.temperatura]}`}>{NOME_TEMP[l.temperatura]}</span>}
            {l.preenchido && <time className={t.quando} dateTime={l.preenchido} title={`Preencheu em ${br(l.preenchido)} às ${l.preenchido.slice(11)}`}>{br(l.preenchido).slice(0, 5)} {l.preenchido.slice(11)}</time>}
          </div>
        )}
        <button className={c.nomeBtn} onClick={() => setAberto(l.id)}>{l.nome}</button>
        {(l.programa || l.origem || l.formularios.length > 0) && (
          <div className={p.tags}>
            {l.formularios.map(x => <span key={x} className={`${t.form} ${x === FORM_HUB ? t.formHub : ""}`}>Forms {x}</span>)}
            {l.incompleto && <span className={t.incompleto} title="A pessoa não terminou o formulário">incompleto</span>}
            {l.programa && <span className={p.tipo}>{l.programa}</span>}
            {l.origem && <span className={p.tempo}>{l.origem}</span>}
          </div>
        )}
        {tipo === "aberta" && (
          <div className={`${c.passo} ${cls}`}>
            {l.proximoPasso || l.proximoPassoEm
              ? <>{l.proximoPasso ?? "Próximo contato"}{l.proximoPassoEm && <> · {l.proximoPassoEm === hoje ? "hoje" : br(l.proximoPassoEm).slice(0, 5)}</>}</>
              : "Sem próximo passo"}
          </div>
        )}
        {tipo === "perdido" && l.motivoPerda && <div className={c.passo}>{l.motivoPerda}</div>}
        {whats && tipo !== "ganho" && (
          <a className={`${c.whats} ${t.whatsCard}`} href={whats} target="_blank" rel="noreferrer" draggable={false}>Chamar no WhatsApp</a>
        )}
        <div className={c.rodape}>
          <span className={`${c.valorCard} ${c.num}`}>{l.valor ? reais(l.valor) : ""}</span>
          {l.responsavel && <Avatar nome={l.responsavel} tamanho={20} />}
        </div>
        {tipo !== "ganho" && (
          <select className={p.mover} value={l.etapaId} onChange={e => mover(l.id, e.target.value)} aria-label={`Mover ${l.nome} para`}>
            {etapas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        )}
      </article>
    );
  };

  return (
    <>
      <div className={styles.topbar}>
        <div>
          <div className={styles.pageTitle}>Funil de vendas</div>
          <div className={styles.pageSub}>{abertas.length} {abertas.length === 1 ? "lead em aberto" : "leads em aberto"} · {reais(emJogo)} em propostas</div>
        </div>
        <div className={c.topoAcoes}>
          {gestora && <button className={c.btn} onClick={() => setGerenciar(true)}>Etapas</button>}
          <button className={c.btnPrim} onClick={() => setNovo("")}>+ Novo lead</button>
        </div>
      </div>
      <div className={`${styles.content} ${p.content}`}>
        <div className={`${f.bar} ${p.toolbar}`}>
          <input className={`${f.select} ${p.busca}`} type="search" placeholder="Buscar nome, contato ou @" value={busca} onChange={e => setBusca(e.target.value)} aria-label="Buscar lead" />
          <select className={f.select} value={resp} onChange={e => setResp(e.target.value)} aria-label="Responsável">
            <option value="">Toda a equipe</option>
            {equipe.map(n => <option key={n} value={n}>{n === eu ? "Meus leads" : n}</option>)}
            <option value="-">Sem responsável</option>
          </select>
          <select className={f.select} value={form} onChange={e => setForm(e.target.value)} aria-label="Formulário">
            <option value="">Todos os formulários</option>
            {forms.map(x => <option key={x} value={x}>Forms {x}</option>)}
            <option value="-">Cadastrados à mão</option>
          </select>
          <PeriodoCalendario valor={periodo} hoje={hoje} onMudar={mudarPeriodo} />
          <select className={f.select} value={prog} onChange={e => setProg(e.target.value)} aria-label="Programa">
            <option value="">Todos os programas</option>{PROGRAMAS.map(x => <option key={x}>{x}</option>)}
          </select>
          {filtrando && <button className={f.clear} onClick={() => { setBusca(""); setResp(""); setProg(""); setTemp(""); setForm(""); if (periodo) mudarPeriodo(null); }}>Limpar filtros</button>}
        </div>
        <div className={t.temps} role="group" aria-label="Temperatura">
          <button className={`${t.tempBtn} ${!temp ? t.tempOn : ""}`} aria-pressed={!temp} onClick={() => setTemp("")}>Todos <b>{semTemp.length}</b></button>
          {TEMPERATURAS.map(x => (
            <button key={x.k} className={`${t.tempBtn} ${t[x.k]} ${temp === x.k ? t.tempOn : ""}`} aria-pressed={temp === x.k} onClick={() => setTemp(temp === x.k ? "" : x.k)}>
              {x.icone} {x.label}s <b>{conta(x.k)}</b>
            </button>
          ))}
          {conta("-") > 0 && <button className={`${t.tempBtn} ${temp === "-" ? t.tempOn : ""}`} aria-pressed={temp === "-"} onClick={() => setTemp(temp === "-" ? "" : "-")}>Sem classificação <b>{conta("-")}</b></button>}
          {periodo && <span className={t.resumo}>preenchidos {periodo.de === periodo.ate ? `em ${br(periodo.de)}` : `de ${br(periodo.de)} a ${br(periodo.ate)}`}</span>}
        </div>
        <div className={p.board}>
          {etapas.map(e => {
            const lista = filtrados.filter(l => l.etapaId === e.id);
            const soma = lista.reduce((n, l) => n + (l.valor ?? 0), 0);
            return (
              <section
                key={e.id}
                className={`${p.col} ${e.tipo !== "aberta" ? p.colSem : ""} ${sobre === e.id ? p.colSobre : ""}`}
                onDragOver={ev => { ev.preventDefault(); ev.dataTransfer.dropEffect = "move"; if (sobre !== e.id) setSobre(e.id); }}
                onDragLeave={ev => { if (!ev.currentTarget.contains(ev.relatedTarget as Node)) setSobre(null); }}
                onDrop={ev => { ev.preventDefault(); const id = ev.dataTransfer.getData("text/plain"); setSobre(null); setArrastando(null); if (id) mover(id, e.id); }}
                aria-label={e.nome}
              >
                <header className={p.colHead}>
                  <div className={p.colNome}><span>{e.nome}</span><span className={p.colCount}>{lista.length}</span></div>
                  <span className={c.somaCol}>{soma ? reais(soma) : e.tipo === "aberta" ? "" : periodo ? "no período" : "últimos 45 dias"}</span>
                </header>
                <div className={p.colBody}>
                  {lista.slice(0, limite[e.id] ?? POR_COLUNA).map(l => card(l, e.tipo))}
                  {lista.length > (limite[e.id] ?? POR_COLUNA) && (
                    <button className={c.btnMini} onClick={() => setLimite(x => ({ ...x, [e.id]: (x[e.id] ?? POR_COLUNA) + POR_COLUNA }))}>
                      Mostrar mais ({lista.length - (limite[e.id] ?? POR_COLUNA)})
                    </button>
                  )}
                  {!lista.length && <p className={p.vazio}>{e.tipo === "ganho" ? "Arraste para cá quando fechar" : "Nenhum lead"}</p>}
                  {e.tipo === "aberta" && <button className={c.btnMini} onClick={() => setNovo(e.id)}>+ Lead</button>}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {aberto && (
        <LeadPainel
          key={aberto} id={aberto} eu={eu} hoje={hoje} equipe={equipe} etapas={etapas}
          onFechar={() => { setAberto(null); if (leadInicial) router.replace("/comercial/funil"); }}
          onMudou={() => router.refresh()} onMsg={setMsg}
          onMover={etapaId => mover(aberto, etapaId)} onVender={l => setVender(l)}
        />
      )}
      {novo !== null && (
        <NovoLead etapaId={novo} eu={eu} equipe={equipe} onFechar={() => setNovo(null)}
          onSalvo={nome => { setNovo(null); setMsg({ txt: `${nome} entrou no funil` }); router.refresh(); }} />
      )}
      {vender && (
        <FecharVenda inicial={vendaDoLead(vender, eu, hoje)} equipe={equipe} onFechar={() => setVender(null)}
          onSalvo={m => { setVender(null); setAberto(null); setMsg(m); router.refresh(); }} />
      )}
      {perder && <MotivoPerda nome={perder.lead.nome} onFechar={() => setPerder(null)} onEscolher={m => mover(perder.lead.id, perder.etapaId, m)} />}
      {gerenciar && <GerenciarEtapas etapas={etapas} leads={leads} onFechar={() => setGerenciar(false)} onMudou={() => router.refresh()} onMsg={setMsg} />}
      <Aviso msg={msg} fechar={fecharMsg} />
    </>
  );
}

function NovoLead({ etapaId, eu, equipe, onFechar, onSalvo }: { etapaId: string; eu: string; equipe: string[]; onFechar: () => void; onSalvo: (nome: string) => void }) {
  const [v, setV] = useState({ nome: "", whatsapp: "", email: "", instagram: "", origem: "", programa: "", valor: "", responsavel: eu, proximoPasso: "", proximoPassoEm: "", obs: "" });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [repetido, setRepetido] = useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { setV(x => ({ ...x, [k]: e.target.value })); setRepetido(false); };

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true); setErro(null);
    try {
      await enviar("/api/comercial/leads", "POST", { ...v, etapaId, mesmoAssim: repetido });
      onSalvo(v.nome.trim());
    } catch (err) {
      setErro((err as Error).message);
      setRepetido(err instanceof ErroApi && err.dados.repetido === true);
      setSalvando(false);
    }
  }
  return (
    <Janela titulo="Novo lead" onFechar={onFechar} larga>
      <form className={c.form} onSubmit={salvar}>
        <div className={c.linha}>
          <label className={c.campo}>Nome<input value={v.nome} onChange={set("nome")} autoFocus required /></label>
          <label className={c.campo}>WhatsApp<input value={v.whatsapp} onChange={set("whatsapp")} placeholder="Com DDD (ou +DDI)" /></label>
        </div>
        <div className={c.linha}>
          <label className={c.campo}>E-mail<input type="email" value={v.email} onChange={set("email")} /></label>
          <label className={c.campo}>Instagram<input value={v.instagram} onChange={set("instagram")} placeholder="@perfil" /></label>
        </div>
        <div className={c.linha3}>
          <label className={c.campo}>Origem<select value={v.origem} onChange={set("origem")}><option value="">—</option>{ORIGENS.map(o => <option key={o}>{o}</option>)}</select></label>
          <label className={c.campo}>Programa de interesse<select value={v.programa} onChange={set("programa")}><option value="">—</option>{PROGRAMAS.map(o => <option key={o}>{o}</option>)}</select></label>
          <label className={c.campo}>Valor estimado (R$)<input inputMode="decimal" value={v.valor} onChange={set("valor")} /></label>
        </div>
        <div className={c.linha3}>
          <label className={c.campo}>Responsável<input list="lead-equipe" value={v.responsavel} onChange={set("responsavel")} /></label>
          <label className={c.campo}>Próximo passo<input value={v.proximoPasso} onChange={set("proximoPasso")} placeholder="Ex.: chamar no WhatsApp" /></label>
          <label className={c.campo}>Quando<input type="date" value={v.proximoPassoEm} onChange={set("proximoPassoEm")} /></label>
        </div>
        <datalist id="lead-equipe">{equipe.map(n => <option key={n} value={n} />)}</datalist>
        <label className={c.campo}>Observações<textarea rows={2} value={v.obs} onChange={set("obs")} /></label>
        {erro && <p className={c.msgErro} role="alert">{erro}</p>}
        <div className={c.acoes}>
          <button type="button" className={c.btn} onClick={onFechar}>Cancelar</button>
          <button className={c.btnPrim} disabled={!v.nome.trim() || salvando}>{salvando ? "Salvando…" : repetido ? "Cadastrar mesmo assim" : "Cadastrar lead"}</button>
        </div>
      </form>
    </Janela>
  );
}

function GerenciarEtapas({ etapas, leads, onFechar, onMudou, onMsg }: { etapas: Etapa[]; leads: LeadCard[]; onFechar: () => void; onMudou: () => void; onMsg: (m: Msg) => void }) {
  const [nova, setNova] = useState("");
  const abertas = etapas.filter(e => e.tipo === "aberta");
  const fazer = async (fn: () => Promise<unknown>, ok?: string) => {
    try { await fn(); if (ok) onMsg({ txt: ok }); onMudou(); } catch (e) { onMsg({ txt: (e as Error).message, erro: true }); }
  };
  const trocar = (i: number, j: number) => {
    const ids = abertas.map(e => e.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    fazer(() => enviar("/api/comercial/etapas", "PUT", { ordem: ids }));
  };
  const linha = (e: Etapa, i: number) => {
    const n = leads.filter(l => l.etapaId === e.id).length;
    return (
      <div key={e.id} className={p.etapa}>
        <div className={p.etapaTopo}>
          {e.tipo === "aberta" && (
            <div className={p.ordem}>
              <button onClick={() => trocar(i, i - 1)} disabled={i === 0} aria-label={`Subir ${e.nome}`}>↑</button>
              <button onClick={() => trocar(i, i + 1)} disabled={i === abertas.length - 1} aria-label={`Descer ${e.nome}`}>↓</button>
            </div>
          )}
          <input
            className={p.etapaNome} defaultValue={e.nome} aria-label="Nome da etapa"
            onBlur={ev => { const nome = ev.target.value.trim(); if (nome && nome !== e.nome) fazer(() => enviar(`/api/comercial/etapas/${e.id}`, "PATCH", { nome })); else ev.target.value = e.nome; }}
          />
          <span className={p.etapaQtd}>{n} {n === 1 ? "lead" : "leads"}</span>
          {e.tipo === "aberta"
            ? <button className={p.btnPerigo} disabled={abertas.length < 2} onClick={() => {
                if (window.confirm(`Excluir a etapa “${e.nome}”?${n ? ` Os ${n} leads dela vão para a primeira etapa.` : ""}`)) fazer(() => enviar(`/api/comercial/etapas/${e.id}`, "DELETE"), "Etapa excluída");
              }}>Excluir</button>
            : <span className={c.tag}>{e.tipo === "ganho" ? "venda" : "perda"}</span>}
        </div>
      </div>
    );
  };
  return (
    <Janela titulo="Etapas do funil" sub="Renomeie, mude a ordem, crie ou exclua. Fechado e Perdido ficam sempre no fim." onFechar={onFechar} larga>
      <div className={p.etapas}>
        {abertas.map(linha)}
        {etapas.filter(e => e.tipo !== "aberta").map(e => linha(e, -1))}
      </div>
      <form className={p.novaEtapa} onSubmit={e => { e.preventDefault(); if (nova.trim()) fazer(() => enviar("/api/comercial/etapas", "POST", { nome: nova }).then(() => setNova("")), "Etapa criada"); }}>
        <input value={nova} onChange={e => setNova(e.target.value)} placeholder="Nova etapa" aria-label="Nova etapa" />
        <button className={c.btnPrim} disabled={!nova.trim()}>Adicionar</button>
      </form>
    </Janela>
  );
}
