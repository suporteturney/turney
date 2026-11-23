"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NOME_RESULTADO, RESULTADOS } from "@/lib/comercial";
import type { CallTela } from "@/lib/comercial-calls";
import styles from "../../shared.module.css";
import f from "../../filtros.module.css";
import c from "../comercial.module.css";
import { Aviso, Janela, enviar, type Msg } from "../ui";

const TZ = "America/Sao_Paulo";
const DIA = 86_400_000;
const somar = (iso: string, n: number) => new Date(Date.parse(iso) + n * DIA).toISOString().slice(0, 10);
const diaDe = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso));
const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export default function CallsCliente({ eu, hoje, agora, segunda, calls, semTipo, leads, equipe, agendaLigada, gestora }: {
  eu: string; hoje: string; agora: number; segunda: string; calls: CallTela[]; semTipo: { id: string; titulo: string; inicio: string; agenda: string }[];
  leads: { id: string; nome: string }[]; equipe: string[]; agendaLigada: boolean; gestora: boolean;
}) {
  const router = useRouter();
  const [quem, setQuem] = useState("");
  const [aberta, setAberta] = useState<CallTela | null>(null);
  const [nova, setNova] = useState<string | null>(null);
  const [verOutros, setVerOutros] = useState(false);
  const [lendo, setLendo] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const fecharMsg = useCallback(() => setMsg(null), []);

  const lista = calls.filter(x => !quem || x.responsavel === quem);
  const passou = (x: CallTela) => Date.parse(x.inicio) < agora;
  const semResultado = lista.filter(x => passou(x) && !x.resultado).length;
  const vieram = lista.filter(x => x.resultado === "compareceu" || x.resultado === "fechou").length;
  const faltaram = lista.filter(x => x.resultado === "faltou").length;
  const fecharam = lista.filter(x => x.resultado === "fechou").length;
  const quemTem = [...new Set(calls.map(x => x.responsavel).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const ir = (n: number) => router.push(`/comercial/calls?semana=${somar(segunda, n * 7)}`);
  const curto = (iso: string) => iso.split("-").reverse().join("/").slice(0, 5);

  async function atualizar() {
    setLendo(true);
    try { const r = await enviar("/api/agenda/sincronizar", "POST"); setMsg({ txt: r.erros?.length ? r.erros.join(" · ") : "Agenda atualizada", erro: !!r.erros?.length }); router.refresh(); }
    catch (e) { setMsg({ txt: (e as Error).message, erro: true }); }
    setLendo(false);
  }
  async function ehCall(id: string, escopo: "evento" | "titulo", tipo: "call" | "pessoal") {
    try { await enviar("/api/agenda/tipo", "POST", { eventoId: id, tipo, escopo }); setMsg({ txt: tipo === "call" ? "Agora aparece como call" : "Marcado como pessoal" }); router.refresh(); }
    catch (e) { setMsg({ txt: (e as Error).message, erro: true }); }
  }

  return (
    <>
      <div className={styles.topbar}>
        <div>
          <div className={styles.pageTitle}>Calls</div>
          <div className={styles.pageSub}>Clique numa call para ligar ao lead e registrar o resultado</div>
        </div>
        <div className={c.topoAcoes}>
          <div className={c.mes}>
            <button className={c.setinha} onClick={() => ir(-1)} aria-label="Semana anterior">‹</button>
            <b>{curto(segunda)} a {curto(somar(segunda, 6))}</b>
            <button className={c.setinha} onClick={() => ir(1)} aria-label="Próxima semana">›</button>
          </div>
          {agendaLigada && <button className={c.btn} onClick={atualizar} disabled={lendo}>{lendo ? "Atualizando…" : "Atualizar agenda"}</button>}
          <button className={c.btnPrim} onClick={() => setNova(hoje >= segunda && hoje <= somar(segunda, 6) ? hoje : segunda)}>+ Call</button>
        </div>
      </div>
      <div className={styles.content}>
        {!agendaLigada && (
          <p className={c.msgInfo} style={{ marginBottom: 14 }}>
            Nenhuma agenda do Comercial ligada. {gestora ? <>Em <Link className={c.link} href="/agendas">Agendas</Link>, ligue o Google Agenda de quem faz as calls escolhendo “Comercial”. Enquanto isso, registre as calls à mão.</> : "Peça para a administradora ligar o seu Google Agenda. Enquanto isso, registre as calls à mão."}
          </p>
        )}
        <div className={c.numeros}>
          <div><strong className={c.num}>{lista.length}</strong><span>calls na semana</span></div>
          <div><strong className={c.num}>{semResultado}</strong><span>sem resultado registrado</span></div>
          <div><strong className={c.num}>{vieram + faltaram ? `${Math.round((vieram / (vieram + faltaram)) * 100)}%` : "—"}</strong><span>comparecimento ({vieram} de {vieram + faltaram})</span></div>
          <div><strong className={c.num}>{fecharam}</strong><span>{fecharam === 1 ? "fechou" : "fecharam"}</span></div>
        </div>
        <section className={c.bloco}>
          {quemTem.length > 1 && (
            <div className={f.bar}>
              <select className={f.select} value={quem} onChange={e => setQuem(e.target.value)} aria-label="De quem">
                <option value="">Toda a equipe</option>{quemTem.map(n => <option key={n} value={n}>{n === eu ? "Minhas calls" : n}</option>)}
              </select>
            </div>
          )}
          <div className={c.semana}>
            {DIAS.map((rot, i) => {
              const iso = somar(segunda, i);
              const doDia = lista.filter(x => diaDe(x.inicio) === iso);
              return (
                <div key={iso} className={`${c.dia} ${iso === hoje ? c.diaHoje : ""}`}>
                  <div className={c.diaTopo}>{rot}<b className={c.num}>{+iso.slice(8)}</b></div>
                  {doDia.map(x => (
                    <button
                      key={x.id ?? x.eventoId}
                      className={`${c.call} ${x.resultado === "faltou" ? c.callFalta : x.resultado ? c.callFeita : passou(x) ? c.callPend : ""}`}
                      onClick={() => setAberta(x)}
                    >
                      <small className={c.num}>{hora(x.inicio)}{quemTem.length > 1 && x.responsavel ? ` · ${x.responsavel.split(" ")[0]}` : ""}</small>
                      <b>{x.lead?.nome ?? x.titulo}</b>
                      <small>{x.resultado ? NOME_RESULTADO[x.resultado] : passou(x) ? "Registrar resultado" : x.lead ? "Agendada" : "Sem lead"}</small>
                    </button>
                  ))}
                  <span className={c.espaco} />
                  <button className={c.btnMini} onClick={() => setNova(iso)}>+ Call</button>
                </div>
              );
            })}
          </div>
          {semTipo.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <button className={c.btnMini} onClick={() => setVerOutros(v => !v)} aria-expanded={verOutros}>{verOutros ? "Esconder" : "Ver"} {semTipo.length} {semTipo.length === 1 ? "compromisso" : "compromissos"} que não {semTipo.length === 1 ? "parece" : "parecem"} call</button>
              {verOutros && (
                <ul className={c.lista} style={{ marginTop: 8 }}>
                  {semTipo.map(e => (
                    <li key={e.id} className={c.item}>
                      <div className={c.itemCorpo}><b>{e.titulo}</b><small>{curto(diaDe(e.inicio))} às {hora(e.inicio)} · agenda de {e.agenda}</small></div>
                      <button className={c.btnMini} onClick={() => ehCall(e.id, "titulo", "call")}>É call (todas com esse nome)</button>
                      <button className={c.btnMini} onClick={() => ehCall(e.id, "titulo", "pessoal")}>Pessoal</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      </div>
      {aberta && <JanelaCall call={aberta} leads={leads} onFechar={() => setAberta(null)} onSalvo={m => { setAberta(null); setMsg(m); router.refresh(); }} onNaoEhCall={aberta.eventoId ? () => { ehCall(aberta.eventoId!, "evento", "pessoal"); setAberta(null); } : null} />}
      {nova && <NovaCall data={nova} eu={eu} leads={leads} equipe={equipe} onFechar={() => setNova(null)} onSalvo={m => { setNova(null); setMsg(m); router.refresh(); }} />}
      <Aviso msg={msg} fechar={fecharMsg} />
    </>
  );
}

const acharLead = (leads: { id: string; nome: string }[], nome: string) => {
  const t = nome.trim().toLowerCase();
  return t ? leads.find(l => l.nome.toLowerCase() === t) ?? null : null;
};

function JanelaCall({ call, leads, onFechar, onSalvo, onNaoEhCall }: {
  call: CallTela; leads: { id: string; nome: string }[]; onFechar: () => void; onSalvo: (m: Msg) => void; onNaoEhCall: (() => void) | null;
}) {
  const [lead, setLead] = useState(call.lead?.nome ?? "");
  const [resultado, setResultado] = useState(call.resultado ?? "");
  const [obs, setObs] = useState(call.obs ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const opcoes = call.lead && !leads.some(l => l.id === call.lead!.id) ? [call.lead, ...leads] : leads;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const l = acharLead(opcoes, lead);
    if (lead.trim() && !l) { setErro("Escolha o lead pela lista. Se ainda não existe, cadastre no funil."); return; }
    setSalvando(true); setErro(null);
    try {
      const corpo = { leadId: l?.id ?? null, resultado: resultado || null, obs };
      if (call.eventoId) await enviar("/api/comercial/calls", "POST", { eventoId: call.eventoId, ...corpo });
      else await enviar(`/api/comercial/calls/${call.id}`, "PATCH", corpo);
      onSalvo({ txt: resultado === "fechou" ? "Resultado salvo. Agora registre a venda no card do lead, no funil." : "Call salva" });
    } catch (err) { setErro((err as Error).message); setSalvando(false); }
  }
  async function excluir() {
    if (!window.confirm("Excluir esta call?")) return;
    try { await enviar(`/api/comercial/calls/${call.id}`, "DELETE"); onSalvo({ txt: "Call excluída" }); } catch (e) { setErro((e as Error).message); }
  }
  return (
    <Janela titulo={call.titulo} sub={`${new Date(call.inicio).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: TZ })}, ${hora(call.inicio)}${call.responsavel ? ` · ${call.responsavel}` : ""}`} onFechar={onFechar}>
      <form className={c.form} onSubmit={salvar}>
        <div className={c.topoAcoes}>
          {call.link && <a className={c.btn} href={call.link} target="_blank" rel="noreferrer">Entrar na call ↗</a>}
          {call.lead && <Link className={c.btn} href={`/comercial/funil?lead=${call.lead.id}`}>Abrir lead</Link>}
        </div>
        <label className={c.campo}>Lead<input list="call-leads" value={lead} onChange={e => setLead(e.target.value)} placeholder="Escolha pelo nome" /></label>
        <datalist id="call-leads">{opcoes.map(l => <option key={l.id} value={l.nome} />)}</datalist>
        <div className={c.campo}>Resultado
          <div className={c.chipsOpc}>
            {RESULTADOS.map(r => (
              <button type="button" key={r.k} className={`${c.chipOpc} ${resultado === r.k ? c.chipOpcOn : ""}`} aria-pressed={resultado === r.k} onClick={() => setResultado(x => (x === r.k ? "" : r.k))}>{r.label}</button>
            ))}
          </div>
        </div>
        <label className={c.campo}>Como foi<textarea rows={3} value={obs} onChange={e => setObs(e.target.value)} /></label>
        {erro && <p className={c.msgErro} role="alert">{erro}</p>}
        <div className={c.acoes}>
          {onNaoEhCall && <button type="button" className={c.btn} onClick={onNaoEhCall}>Não é call</button>}
          {!call.daAgenda && call.id && <button type="button" className={c.btnPerigo} onClick={excluir}>Excluir</button>}
          <span className={c.espaco} />
          <button className={c.btnPrim} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</button>
        </div>
      </form>
    </Janela>
  );
}

function NovaCall({ data, eu, leads, equipe, onFechar, onSalvo }: { data: string; eu: string; leads: { id: string; nome: string }[]; equipe: string[]; onFechar: () => void; onSalvo: (m: Msg) => void }) {
  const [v, setV] = useState({ lead: "", titulo: "", data, hora: "10:00", link: "", responsavel: eu });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV(x => ({ ...x, [k]: e.target.value }));
  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const l = acharLead(leads, v.lead);
    if (v.lead.trim() && !l) { setErro("Escolha o lead pela lista. Se ainda não existe, cadastre no funil."); return; }
    setSalvando(true); setErro(null);
    try { await enviar("/api/comercial/calls", "POST", { ...v, leadId: l?.id ?? null }); onSalvo({ txt: "Call marcada" }); }
    catch (err) { setErro((err as Error).message); setSalvando(false); }
  }
  return (
    <Janela titulo="Nova call" onFechar={onFechar}>
      <form className={c.form} onSubmit={salvar}>
        <label className={c.campo}>Lead<input list="nova-call-leads" value={v.lead} onChange={set("lead")} placeholder="Escolha pelo nome" autoFocus /></label>
        <datalist id="nova-call-leads">{leads.map(l => <option key={l.id} value={l.nome} />)}</datalist>
        <label className={c.campo}>Título (se não tiver lead)<input value={v.titulo} onChange={set("titulo")} /></label>
        <div className={c.linha}>
          <label className={c.campo}>Dia<input type="date" value={v.data} onChange={set("data")} required /></label>
          <label className={c.campo}>Horário de Brasília<input type="time" value={v.hora} onChange={set("hora")} required /></label>
          <label className={c.campo}>Quem faz<input list="call-equipe" value={v.responsavel} onChange={set("responsavel")} /></label>
          <label className={c.campo}>Link<input value={v.link} onChange={set("link")} placeholder="https://" /></label>
        </div>
        <datalist id="call-equipe">{equipe.map(n => <option key={n} value={n} />)}</datalist>
        {erro && <p className={c.msgErro} role="alert">{erro}</p>}
        <div className={c.acoes}><button type="button" className={c.btn} onClick={onFechar}>Cancelar</button><button className={c.btnPrim} disabled={salvando}>{salvando ? "Salvando…" : "Marcar call"}</button></div>
      </form>
    </Janela>
  );
}
