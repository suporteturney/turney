"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NOME_SITUACAO, dataBr, type Situacao } from "@/lib/devolutiva";
import styles from "../shared.module.css";
import a from "../agendas/agendas.module.css";
import d from "./devolutivas.module.css";

type Linha = {
  id: string; nome: string; email: string | null; situacao: string; textoData: string | null; data: string | null;
  perfil: string | null; lideranca: string | null; mentorada: { id: string; nome: string } | null; lancada: boolean;
};
type Status = { em: string; ok: boolean; erro?: string; linhas?: number } | null;

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

async function enviar(method: string, body?: unknown) {
  const res = await fetch("/api/devolutivas", { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.erro ?? "Não foi possível. Tente de novo.");
  return j;
}

const FILTROS = [
  { k: "todas", label: "Todas" },
  { k: "feita", label: "Realizadas" },
  { k: "faltou", label: "Faltas" },
  { k: "pendente", label: "Sem data / agendadas" },
  { k: "sem", label: "Sem cadastro" },
] as const;

export default function DevolutivasCliente({ ligada, mentora, finalId, status, linhas, equipe, avisar }: {
  ligada: boolean; mentora: string; finalId: string | null; status: Status; linhas: Linha[];
  equipe: { id: string; nome: string }[]; avisar: string[];
}) {
  const [quem, setQuem] = useState<string[]>(avisar);
  const mudouQuem = quem.length !== avisar.length || quem.some(x => !avisar.includes(x));
  const router = useRouter();
  const [link, setLink] = useState("");
  const [nome, setNome] = useState(mentora);
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<{ txt: string; erro?: boolean } | null>(null);
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]["k"]>("todas");

  const semCadastro = linhas.filter(l => l.situacao === "feita" && !l.mentorada);
  const conta = (k: string) => (k === "todas" ? linhas.length : k === "sem" ? semCadastro.length
    : k === "pendente" ? linhas.filter(l => l.situacao === "pendente" || l.situacao === "agendada").length
    : linhas.filter(l => l.situacao === k).length);
  const visiveis = linhas.filter(l => filtro === "todas" ? true : filtro === "sem" ? l.situacao === "feita" && !l.mentorada
    : filtro === "pendente" ? l.situacao === "pendente" || l.situacao === "agendada" : l.situacao === filtro);

  async function acao(fn: () => Promise<string>) {
    setOcupado(true); setMsg(null);
    try { setMsg({ txt: await fn() }); router.refresh(); } catch (e) { setMsg({ txt: (e as Error).message, erro: true }); }
    setOcupado(false);
  }
  const resumo = (r: { lidas: number; lancadas: number; semCadastro: number }) =>
    `Planilha lida: ${r.lidas} linhas. ${r.lancadas ? `${r.lancadas} ${r.lancadas === 1 ? "devolutiva nova lançada" : "devolutivas novas lançadas"} no cadastro.` : "Nada novo para lançar."}${r.semCadastro ? ` ${r.semCadastro} sem mentorada encontrada.` : ""}`;

  const salvar = (e: React.FormEvent) => { e.preventDefault(); acao(async () => { const r = await enviar("PUT", { link, mentora: nome }); setLink(""); return resumo(r); }); };
  const salvarQuem = () => acao(async () => {
    if (!quem.length) throw new Error("Escolha pelo menos uma pessoa.");
    await enviar("PUT", { avisar: quem });
    return "Pronto: os próximos avisos vão para quem está marcado.";
  });
  const lerAgora = () => acao(async () => resumo(await enviar("POST")));
  const desligar = () => { if (window.confirm("Parar de ler a planilha de devolutivas? O que já foi lançado no cadastro continua.")) acao(async () => { await enviar("PUT", { desligar: true }); return "Planilha desligada."; }); };

  return (
    <>
      <div className={styles.topbar}>
        <div>
          <div className={styles.pageTitle}>Devolutivas DISC</div>
          <div className={styles.pageSub}>A planilha da mentora de devolutiva comportamental: cada devolutiva realizada entra no cadastro da mentorada e gera um aviso.</div>
        </div>
      </div>
      <div className={styles.content}>
        <div className={a.grade}>
          <section className={a.bloco}>
            <h2 className={a.titulo}>Situação</h2>
            <div className={a.item}>
              <div className={a.itemTopo}>
                <span className={`${a.status} ${!ligada ? a.sPausa : status && !status.ok ? a.sErro : a.sOk}`} aria-hidden="true" />
                <div className={a.itemNome}>
                  <b>{!ligada ? "Ainda não ligada" : status && !status.ok ? "Ligada, mas a última leitura falhou" : `Ligada · planilha de ${mentora}`}</b>
                  <small>
                    {ligada && finalId ? `Arquivo terminando em …${finalId}` : "Cole o link da planilha ao lado"}
                    {status ? ` · última leitura em ${quando(status.em)}` : ""}
                    {status?.ok && status.linhas != null ? ` · ${status.linhas} linhas` : ""}
                  </small>
                  {status && !status.ok && status.erro && <small className={a.erroTxt}>{status.erro}</small>}
                </div>
                {ligada && (
                  <div className={a.itemAcoes}>
                    <button className={a.btnMini} onClick={lerAgora} disabled={ocupado}>{ocupado ? "Lendo…" : "Ler agora"}</button>
                    <button className={a.btnPerigo} onClick={desligar} disabled={ocupado}>Desligar</button>
                  </div>
                )}
              </div>
            </div>
            {msg && <p className={msg.erro ? a.msgErro : a.msgOk} role={msg.erro ? "alert" : "status"}>{msg.txt}</p>}

            {ligada && (
              <>
                <div className={a.chips} role="tablist" aria-label="Filtrar devolutivas" style={{ marginTop: 14 }}>
                  {FILTROS.map(f => (
                    <button key={f.k} role="tab" aria-selected={filtro === f.k} className={`${d.filtro} ${filtro === f.k ? d.filtroOn : ""}`} onClick={() => setFiltro(f.k)}>
                      {f.label} <span>{conta(f.k)}</span>
                    </button>
                  ))}
                </div>
                {filtro === "sem" && semCadastro.length > 0 && (
                  <p className={a.nota}>
                    A devolutiva foi feita, mas o e-mail da planilha não está em nenhum cadastro. Corrija o e-mail no cadastro da mentorada
                    (Pós Venda › Mentorados): na próxima leitura ela entra sozinha.
                  </p>
                )}
                {!visiveis.length && <p className={a.vazio}>Nada aqui.</p>}
                <div className={d.tabelaWrap}>
                  <table className={d.tabela}>
                    <thead>
                      <tr><th>Pessoa</th><th>Devolutiva</th><th>Perfil</th><th>No cadastro</th></tr>
                    </thead>
                    <tbody>
                      {visiveis.map(l => (
                        <tr key={l.id}>
                          <td><b>{l.nome}</b>{l.email && <small>{l.email}</small>}</td>
                          <td>
                            <span className={`${d.sit} ${d[`s_${l.situacao}`] ?? ""}`}>{NOME_SITUACAO[l.situacao as Situacao] ?? l.situacao}</span>
                            <small>{l.situacao === "feita" || l.situacao === "agendada" ? dataBr(l.data) : l.textoData ?? "—"}</small>
                          </td>
                          <td>{l.perfil ?? "—"}{l.lideranca && <small>{l.lideranca}</small>}</td>
                          <td>
                            {l.mentorada
                              ? <Link className={d.link} href={`/mentorados?q=${encodeURIComponent(l.mentorada.nome)}`}>{l.mentorada.nome}</Link>
                              : <span className={d.sem}>não encontrada</span>}
                            {l.mentorada && l.situacao === "feita" && <small>{l.lancada ? "lançada" : "a lançar"}</small>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>

          <section className={a.bloco}>
            <h2 className={a.titulo}>{ligada ? "Trocar a planilha" : "Ligar a planilha"}</h2>
            <ol className={a.passos}>
              <li>Abra a planilha de controle da mentora no navegador e copie o endereço da barra de cima.</li>
              <li>Cole aqui embaixo, confira o nome da mentora e clique em <b>Salvar e ler</b>.</li>
            </ol>
            <form className={a.form} onSubmit={salvar}>
              <label className={a.campo}>Link da planilha
                <input value={link} onChange={e => setLink(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…" autoComplete="off" spellCheck={false} required />
              </label>
              <label className={a.campo}>Nome da mentora
                <input value={nome} onChange={e => setNome(e.target.value)} maxLength={60} required />
              </label>
              <button className={a.btnPrim} disabled={ocupado || !link.trim()}>{ocupado ? "Lendo a planilha…" : "Salvar e ler"}</button>
            </form>
            {ligada && (
              <>
                <h3 className={d.sub}>Quem recebe os avisos</h3>
                <div className={d.quem}>
                  {equipe.map(u => (
                    <label key={u.id}>
                      <input type="checkbox" checked={quem.includes(u.id)} onChange={e => setQuem(q => e.target.checked ? [...q, u.id] : q.filter(x => x !== u.id))} />
                      {u.nome}
                    </label>
                  ))}
                </div>
                {mudouQuem && <button className={a.btnMini} style={{ marginTop: 8 }} onClick={salvarQuem} disabled={ocupado}>Salvar quem recebe</button>}
              </>
            )}
            <h3 className={d.sub}>Como funciona</h3>
            <ul className={d.regras}>
              <li>O painel relê a planilha sozinho a cada 15 minutos, enquanto alguém estiver usando o painel. O botão <b>Ler agora</b> força a leitura.</li>
              <li>Quando a coluna <b>Data de devolutiva</b> ganha uma data, a devolutiva entra no cadastro: data na jornada (Atlas), perfil DISC (se estiver vazio) e uma observação com perfil, liderança e o resumo da aba de relatório.</li>
              <li>Se ela escrever que a pessoa <b>não apareceu</b>, chega um aviso de falta e nada é lançado.</li>
              <li>A mentorada é reconhecida pelo <b>e-mail</b> (ou pelo nome completo). Valor e pagamento da planilha não entram no painel.</li>
              <li>Cada devolutiva nova gera um aviso em <b>Avisos</b> (no menu) para quem estiver marcado acima.</li>
              <li>Na primeira leitura, o histórico da planilha só completa o que faltava nos cadastros, sem um aviso por linha.</li>
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
