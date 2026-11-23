"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROTULO_HUBLA, type TipoHubla } from "@/lib/hubla";
import styles from "../shared.module.css";
import a from "../agendas/agendas.module.css";
import h from "./hubla.module.css";

type Evento = {
  id: string; tipo: string; nome: string | null; email: string; produto: string | null; modulo: string | null; data: string;
  mentorada: { id: string; nome: string } | null;
};
type Solto = { email: string; nome: string | null; total: number; data: string | null };
type Importacao = { em: string; por: string; linhas: number; pessoas: number; mentoradas: number; arquivo?: string };

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const ICONE: Record<string, string> = { acesso_liberado: "🔓", acesso_removido: "🔒", modulo_concluido: "✅", curso_concluido: "🎓" };

async function enviar(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.erro ?? "Não foi possível salvar. Tente de novo.");
  return j;
}

export default function HublaCliente({
  url, configurado, finalToken, configuradoEm, ultimoAviso, contagem, soltos, recentes, mentoradas, importacao, semAulas,
}: {
  url: string; configurado: boolean; finalToken: string | null; configuradoEm: string | null; ultimoAviso: string | null;
  contagem: Record<string, number>; soltos: Solto[]; recentes: Evento[]; mentoradas: { id: string; nome: string }[];
  importacao: Importacao | null; semAulas: { id: string; nome: string; email: string | null; tipo: string }[];
}) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [importando, setImportando] = useState(false);
  const [msgImp, setMsgImp] = useState<{ txt: string; erro?: boolean } | null>(null);
  const [verSemAulas, setVerSemAulas] = useState(false);

  async function importar(e: React.FormEvent) {
    e.preventDefault();
    if (!arquivo) return;
    setImportando(true); setMsgImp(null);
    try {
      const fd = new FormData();
      fd.append("arquivo", arquivo);
      const res = await fetch("/api/hubla/consumo", { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.erro ?? "Não foi possível importar.");
      setMsgImp({ txt: `Pronto: ${j.linhas} aulas de ${j.pessoas} pessoas — ${j.mentoradas} mentoradas reconhecidas pelo e-mail.` });
      setArquivo(null);
      router.refresh();
    } catch (err) { setMsgImp({ txt: (err as Error).message, erro: true }); }
    setImportando(false);
  }
  const router = useRouter();
  const [token, setToken] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ txt: string; erro?: boolean } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [escolha, setEscolha] = useState<Record<string, string>>({});

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true); setMsg(null);
    try {
      await enviar("/api/hubla/config", "PUT", { token });
      setToken("");
      setMsg({ txt: "Token salvo. Agora use o “Ambiente de testes” da Hubla para mandar um aviso de exemplo." });
      router.refresh();
    } catch (err) { setMsg({ txt: (err as Error).message, erro: true }); }
    setSalvando(false);
  }

  async function desligar() {
    if (!window.confirm("Desligar a integração? A plataforma passa a recusar os avisos da Hubla até um novo token ser salvo.")) return;
    try { await enviar("/api/hubla/config", "DELETE"); router.refresh(); }
    catch (err) { setMsg({ txt: (err as Error).message, erro: true }); }
  }

  async function ligar(s: Solto) {
    const nome = (escolha[s.email] ?? "").trim().toLowerCase();
    const m = mentoradas.find(x => x.nome.toLowerCase() === nome);
    if (!m) { setMsg({ txt: "Escolha a mentorada pela lista.", erro: true }); return; }
    try {
      const r = await enviar("/api/hubla/ligar", "POST", { email: s.email, mentoradaId: m.id });
      setMsg({ txt: `${s.email} ligado a ${m.nome} (${r.ligados} ${r.ligados === 1 ? "aviso" : "avisos"}). Os próximos avisos desse e-mail já vão para ela.` });
      router.refresh();
    } catch (err) { setMsg({ txt: (err as Error).message, erro: true }); }
  }

  const copiar = async () => {
    try { await navigator.clipboard.writeText(url); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* sem permissão de copiar */ }
  };

  return (
    <>
      <div className={styles.topbar}>
        <div>
          <div className={styles.pageTitle}>Hubla — área de membros</div>
          <div className={styles.pageSub}>Área de membros (acessos, módulos e cursos) para o Pós Venda e vendas aprovadas para o Comercial.</div>
        </div>
      </div>
      <div className={styles.content}>
        <div className={a.grade}>
          <section className={a.bloco}>
            <h2 className={a.titulo}>Situação</h2>
            <div className={a.item}>
              <div className={a.itemTopo}>
                <span className={`${a.status} ${configurado ? (ultimoAviso ? a.sOk : a.sPausa) : a.sErro}`} aria-hidden="true" />
                <div className={a.itemNome}>
                  <b>{!configurado ? "Ainda não ligada" : ultimoAviso ? "Ligada e recebendo avisos" : "Ligada — esperando o primeiro aviso"}</b>
                  <small>
                    {configurado && finalToken ? `Token terminando em …${finalToken}` : configurado ? "Token na Vercel" : "Falta salvar o token do webhook"}
                    {configuradoEm ? ` · salvo em ${quando(configuradoEm)}` : ""}
                    {ultimoAviso ? ` · último aviso em ${quando(ultimoAviso)}` : ""}
                  </small>
                </div>
                {configurado && finalToken && <div className={a.itemAcoes}><button className={a.btnPerigo} onClick={desligar}>Desligar</button></div>}
              </div>
              <div className={a.chips}>
                <span>Últimos 30 dias:</span>
                {(Object.keys(ROTULO_HUBLA) as TipoHubla[]).map(t => (
                  <span key={t} className={a.chip}>{ICONE[t]} {contagem[t] ?? 0} · {ROTULO_HUBLA[t].toLowerCase()}</span>
                ))}
              </div>
            </div>

            {soltos.length > 0 && (
              <>
                <h3 className={h.sub}>E-mails que não achei no cadastro <span>{soltos.length}</span></h3>
                <p className={a.nota} style={{ marginTop: 0 }}>
                  A Hubla mandou avisos de e-mails que não estão no cadastro de nenhuma mentorada. Corrija o e-mail no cadastro dela
                  ou ligue aqui (vale também para os próximos avisos).
                </p>
                <datalist id="hubla-mentoradas">{mentoradas.map(m => <option key={m.id} value={m.nome} />)}</datalist>
                <ul className={h.soltos}>
                  {soltos.map(s => (
                    <li key={s.email}>
                      <div className={h.soltoQuem}>
                        <b>{s.nome ?? s.email}</b>
                        <small>{s.email} · {s.total} {s.total === 1 ? "aviso" : "avisos"}</small>
                      </div>
                      <input
                        list="hubla-mentoradas"
                        placeholder="Mentorada…"
                        value={escolha[s.email] ?? ""}
                        onChange={e => setEscolha(x => ({ ...x, [s.email]: e.target.value }))}
                        aria-label={`Mentorada do e-mail ${s.email}`}
                      />
                      <button className={a.btnMini} onClick={() => ligar(s)}>Ligar</button>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <h3 className={h.sub}>Últimos avisos</h3>
            {!recentes.length && <p className={a.vazio}>Nenhum aviso recebido ainda.</p>}
            <ul className={h.avisos}>
              {recentes.map(e => (
                <li key={e.id}>
                  <span className={h.icone} aria-hidden="true">{ICONE[e.tipo] ?? "•"}</span>
                  <div className={h.avisoCorpo}>
                    <b>{e.mentorada?.nome ?? e.nome ?? e.email}</b>
                    <span>
                      {ROTULO_HUBLA[e.tipo as TipoHubla] ?? e.tipo}
                      {e.modulo ? `: ${e.modulo}` : ""}{e.produto ? ` · ${e.produto}` : ""}
                    </span>
                  </div>
                  <span className={h.quando}>{quando(e.data)}</span>
                  {!e.mentorada && <span className={h.semDona}>sem mentorada</span>}
                </li>
              ))}
            </ul>
          </section>

          <div className={h.coluna}>
          <section className={a.bloco}>
            <h2 className={a.titulo}>Aulas assistidas</h2>
            <p className={a.nota} style={{ marginTop: 0 }}>
              O que cada mentorada já assistiu (aula, módulo, % concluído e data) vem do relatório <b>Consumo do membro por conteúdo</b>.
              A Hubla não manda isso sozinha — importe a planilha <b>uma vez por semana</b> para manter atualizado.
            </p>
            {importacao && (
              <div className={a.item} style={{ marginTop: 10 }}>
                <div className={a.itemTopo}>
                  <span className={`${a.status} ${a.sOk}`} aria-hidden="true" />
                  <div className={a.itemNome}>
                    <b>Última importação em {quando(importacao.em)}</b>
                    <small>{importacao.linhas} aulas · {importacao.pessoas} pessoas · {importacao.mentoradas} mentoradas reconhecidas · por {importacao.por}</small>
                  </div>
                </div>
              </div>
            )}
            <form className={a.form} onSubmit={importar} style={{ marginTop: 12 }}>
              <label className={h.arquivo}>
                <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={e => setArquivo(e.target.files?.[0] ?? null)} />
                <span>{arquivo ? arquivo.name : "Escolher a planilha (.xlsx)"}</span>
              </label>
              {msgImp && <p className={msgImp.erro ? a.msgErro : a.msgOk} role={msgImp.erro ? "alert" : "status"}>{msgImp.txt}</p>}
              <button className={a.btnPrim} disabled={!arquivo || importando}>{importando ? "Importando…" : "Importar aulas"}</button>
            </form>
            <ol className={a.passos}>
              <li>Na Hubla: <b>Relatórios</b> › <b>Consumo do membro por conteúdo</b>.</li>
              <li>Clique em <b>Exportar</b>, deixe em <b>xlsx</b> e baixe.</li>
              <li>Escolha o arquivo aqui e clique em <b>Importar aulas</b>. A importação nova substitui a anterior.</li>
            </ol>
            {semAulas.length > 0 && (
              <>
                <button className={a.ajudaBtn} onClick={() => setVerSemAulas(v => !v)} aria-expanded={verSemAulas}>
                  {verSemAulas ? "▾" : "▸"} {semAulas.length} {semAulas.length === 1 ? "mentorada ativa" : "mentoradas ativas"} sem nenhuma aula no relatório
                </button>
                {verSemAulas && (
                  <>
                    <p className={a.nota} style={{ marginTop: 6 }}>Ou nunca assistiram, ou usam outro e-mail na Hubla. Se for e-mail diferente, ligue na lista “E-mails que não achei” ou corrija o cadastro.</p>
                    <ul className={h.semAulas}>
                      {semAulas.map(m => <li key={m.id}><b>{m.nome}</b><small>{m.tipo} · {m.email ?? "sem e-mail no cadastro"}</small></li>)}
                    </ul>
                  </>
                )}
              </>
            )}
          </section>

          <section className={a.bloco}>
            <h2 className={a.titulo}>Como ligar os avisos</h2>
            <ol className={a.passos} style={{ marginTop: 0 }}>
              <li>
                Copie este endereço:
                <div className={h.url}>
                  <code>{url}</code>
                  <button className={a.btnMini} onClick={copiar}>{copiado ? "Copiado ✓" : "Copiar"}</button>
                </div>
              </li>
              <li>Na Hubla: <b>Integrações</b> › <b>Criar nova integração</b> › <b>Webhooks</b> › <b>Configurar</b>.</li>
              <li>Cole o endereço como <b>URL</b>, dê um apelido (ex.: “Painel Turney”) e escolha os produtos das mentorias.</li>
              <li>
                Em <b>eventos</b>, marque: <b>Membro</b> (Acesso concedido, Acesso removido), <b>Área de Membros</b> (Módulo concluído,
                Curso concluído) e <b>Fatura</b> (<b>Pagamento da fatura realizado</b> e <b>Fatura reembolsada</b>). Em “Como enviar seus dados”, deixe <b>Integração recomendada</b>.
              </li>
              <li>Salve. Na aba <b>Autenticação</b>, copie o <b>Token de Autenticação</b> e cole aqui embaixo.</li>
              <li>Use o <b>Ambiente de testes</b> da Hubla para mandar um aviso de exemplo — ele aparece em “Últimos avisos” (como “sem mentorada”, porque o comprador é fictício).</li>
            </ol>
            <form className={a.form} onSubmit={salvar} style={{ marginTop: 16 }}>
              <label className={a.campo}>
                Token de Autenticação do webhook
                <input value={token} onChange={e => setToken(e.target.value)} placeholder={configurado ? "Cole um token novo para trocar" : "Cole o token da Hubla"} autoComplete="off" spellCheck={false} />
              </label>
              {msg && <p className={msg.erro ? a.msgErro : a.msgOk} role={msg.erro ? "alert" : "status"}>{msg.txt}</p>}
              <button className={a.btnPrim} disabled={!token.trim() || salvando}>{salvando ? "Salvando…" : "Salvar token"}</button>
            </form>
            <p className={a.nota}>
              O token é uma senha: cole direto aqui, não mande por WhatsApp. A Hubla avisa só quando um <b>módulo inteiro</b> ou o
              <b> curso</b> é concluído — aula por aula vem pela importação acima.
            </p>
          </section>
          </div>
        </div>
      </div>
    </>
  );
}
