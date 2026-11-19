"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../shared.module.css";
import a from "./agendas.module.css";

type Fonte = {
  id: string; nome: string; email: string | null; agenda: string; ativo: boolean;
  ultimaLeitura: string | null; ultimoErro: string | null; eventos: number | null; proximos: Record<string, number>;
};

const ROTULO: Record<string, [string, string]> = {
  individual: ["individual", "individuais"], grupo: ["em grupo", "em grupo"], onboarding: ["onboarding", "onboardings"], outro: ["outro", "outros"],
};
const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

async function enviar(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.erro ?? "Não foi possível salvar. Tente de novo.");
  return j;
}

export default function AgendasCliente({ fontes, vercel }: { fontes: Fonte[]; vercel: { nome: string; agenda: string }[] }) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [url, setUrl] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [lendo, setLendo] = useState(false);
  const [msg, setMsg] = useState<{ txt: string; erro?: boolean } | null>(null);
  const [ajuda, setAjuda] = useState(fontes.length === 0);

  async function ligar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true); setMsg(null);
    try {
      const r = await enviar("/api/agenda/fontes", "POST", { nome, email, url });
      setMsg({ txt: `Agenda de ${nome} ligada. Encontrei ${r.encontrados} encontros entre 3 semanas atrás e 8 semanas à frente.` });
      setNome(""); setEmail(""); setUrl("");
      router.refresh();
    } catch (err) { setMsg({ txt: (err as Error).message, erro: true }); }
    setEnviando(false);
  }

  async function lerAgora() {
    setLendo(true); setMsg(null);
    try {
      const r = await enviar("/api/agenda/sincronizar", "POST");
      setMsg({ txt: `Agendas lidas: ${r.encontros} encontros atualizados.${r.erros.length ? ` Atenção: ${r.erros.join(" · ")}` : ""}`, erro: r.erros.length > 0 });
      router.refresh();
    } catch (err) { setMsg({ txt: (err as Error).message, erro: true }); }
    setLendo(false);
  }

  async function alternar(f: Fonte) {
    try { await enviar(`/api/agenda/fontes/${f.id}`, "PATCH", { ativo: !f.ativo }); router.refresh(); }
    catch (err) { setMsg({ txt: (err as Error).message, erro: true }); }
  }

  async function desligar(f: Fonte) {
    if (!window.confirm(`Desligar a agenda de ${f.nome}? Os encontros dela somem do painel (nada muda no Google Agenda).`)) return;
    try { await enviar(`/api/agenda/fontes/${f.id}`, "DELETE"); router.refresh(); }
    catch (err) { setMsg({ txt: (err as Error).message, erro: true }); }
  }

  return (
    <>
      <div className={styles.topbar}>
        <div>
          <div className={styles.pageTitle}>Agendas</div>
          <div className={styles.pageSub}>Agendas do Google que alimentam os encontros do Meu painel e as datas de Mentoria Estratégica</div>
        </div>
        {(fontes.length > 0 || vercel.length > 0) && (
          <button className={a.btn} onClick={lerAgora} disabled={lendo}>{lendo ? "Lendo…" : "Ler agendas agora"}</button>
        )}
      </div>
      <div className={styles.content}>
        <div className={a.grade}>
          <section className={a.bloco}>
            <h2 className={a.titulo}>Agendas ligadas</h2>
            {!fontes.length && !vercel.length && <p className={a.vazio}>Nenhuma agenda ligada ainda. Cadastre a primeira ao lado.</p>}
            <ul className={a.lista}>
              {fontes.map(f => (
                <li key={f.id} className={`${a.item} ${!f.ativo ? a.pausada : ""}`}>
                  <div className={a.itemTopo}>
                    <span className={`${a.status} ${f.ultimoErro ? a.sErro : f.ativo ? a.sOk : a.sPausa}`} aria-hidden="true" />
                    <div className={a.itemNome}>
                      <b>{f.nome}</b>
                      <small>{f.agenda}</small>
                    </div>
                    <div className={a.itemAcoes}>
                      <button className={a.btnMini} onClick={() => alternar(f)}>{f.ativo ? "Pausar" : "Religar"}</button>
                      <button className={a.btnPerigo} onClick={() => desligar(f)}>Desligar</button>
                    </div>
                  </div>
                  {f.ultimoErro ? (
                    <p className={a.erroTxt}>Última leitura falhou: {f.ultimoErro}</p>
                  ) : (
                    <p className={a.info}>
                      {!f.ativo ? "Pausada — não está sendo lida." : f.ultimaLeitura ? `Lida em ${quando(f.ultimaLeitura)} · ${f.eventos ?? 0} encontros na janela` : "Ainda não foi lida."}
                    </p>
                  )}
                  {f.ativo && Object.keys(f.proximos).length > 0 && (
                    <div className={a.chips}>
                      <span>Próximos:</span>
                      {Object.entries(f.proximos).map(([t, n]) => <span key={t} className={`${a.chip} ${a[t]}`}>{n} {ROTULO[t]?.[n === 1 ? 0 : 1] ?? t}</span>)}
                    </div>
                  )}
                </li>
              ))}
              {vercel.map(v => (
                <li key={v.agenda} className={a.item}>
                  <div className={a.itemTopo}>
                    <span className={`${a.status} ${a.sOk}`} aria-hidden="true" />
                    <div className={a.itemNome}><b>{v.nome}</b><small>{v.agenda} · ligada pela Vercel</small></div>
                  </div>
                </li>
              ))}
            </ul>
            <p className={a.nota}>
              O painel lê as agendas sozinho, no máximo a cada 2 horas, quando alguém abre a plataforma. Os encontros são separados assim:
              <b> Onboarding</b> (título com “onboarding”), <b>Individual</b> (“individual”, “mentoria estratégica”, “entrevista”, “devolutiva”),
              <b> Grupo</b> (“encontro”, “ao vivo”, “turma”, “aula”, “grupo” ou 6+ convidados). O resto aparece como <b>Outros</b>.
            </p>
          </section>

          <section className={a.bloco}>
            <h2 className={a.titulo}>Ligar uma agenda</h2>
            <form className={a.form} onSubmit={ligar}>
              <label className={a.campo}>
                De quem é a agenda
                <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Amanda Dutra" />
              </label>
              <label className={a.campo}>
                <span>E-mail da dona da agenda <small>(ajuda a reconhecer as mentoradas)</small></span>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="amanda.dutra@turneyacademy.com" />
              </label>
              <label className={a.campo}>
                Endereço secreto no formato iCal
                <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://calendar.google.com/calendar/ical/…/private-…/basic.ics" autoComplete="off" spellCheck={false} />
              </label>
              {msg && <p className={msg.erro ? a.msgErro : a.msgOk} role={msg.erro ? "alert" : "status"}>{msg.txt}</p>}
              <button className={a.btnPrim} disabled={!nome.trim() || !url.trim() || enviando}>{enviando ? "Testando o link…" : "Testar e ligar"}</button>
            </form>

            <button className={a.ajudaBtn} onClick={() => setAjuda(v => !v)} aria-expanded={ajuda}>
              {ajuda ? "▾" : "▸"} Onde encontro esse link?
            </button>
            {ajuda && (
              <ol className={a.passos}>
                <li>A <b>dona da agenda</b> abre o Google Agenda <b>no computador</b> (calendar.google.com).</li>
                <li>Clica na <b>engrenagem</b> (canto de cima, à direita) › <b>Configurações</b>.</li>
                <li>Na coluna da esquerda, em <b>“Configurações das minhas agendas”</b>, clica no nome da agenda.</li>
                <li>Desce até <b>“Integrar agenda”</b> e copia o <b>“Endereço secreto no formato iCal”</b> (clique no ícone de copiar).</li>
                <li>Cola aqui ao lado e clica em <b>Testar e ligar</b>.</li>
              </ol>
            )}
            {ajuda && (
              <p className={a.nota}>
                Esse link dá acesso aos compromissos da agenda: não mande por WhatsApp nem e-mail. O ideal é a própria dona colar aqui
                (ou você colar com ela do lado). Se o “endereço secreto” não aparecer, o administrador do Google Workspace precisa liberar
                o compartilhamento de agendas. Encontros em grupo que ficam numa agenda separada (ex.: “Encontros Turney”) também têm o
                próprio endereço — cadastre cada agenda separada.
              </p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
