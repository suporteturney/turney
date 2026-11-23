"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CORTE, NOME_TEMP, PESOS, TEMPERATURAS } from "@/lib/respondi";
import styles from "../shared.module.css";
import a from "../agendas/agendas.module.css";
import h from "../hubla/hubla.module.css";

type Recente = { id: string; formulario: string; completa: boolean; preenchidoEm: string; temperatura: string | null; lead: { id: string; nome: string } };
const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const br = (iso: string) => iso.split("-").reverse().join("/");

export default function FormulariosCliente({ hoje, url, ultimo, importacao, porForm, recentes }: {
  hoje: string; url: string | null; ultimo: { em: string; formulario: string | null; resultado: string } | null;
  importacao: { em: string; por: string; formulario: string; desde: string; total: number } | null;
  porForm: { formulario: string; temperatura: string | null; n: number }[]; recentes: Recente[];
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ txt: string; erro?: boolean } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [desde, setDesde] = useState(`${hoje.slice(0, 7)}-01`);
  const [importando, setImportando] = useState(false);
  const [msgImp, setMsgImp] = useState<{ txt: string; erro?: boolean } | null>(null);

  async function gerar() {
    if (url && !window.confirm("Trocar o endereço? O endereço atual para de funcionar e você precisa colar o novo nos dois formulários do Respondi.")) return;
    const res = await fetch("/api/respondi/config", { method: "POST" });
    const j = await res.json().catch(() => ({}));
    setMsg(res.ok ? { txt: "Endereço criado. Copie e cole nos dois formulários." } : { txt: j.erro ?? "Não foi possível criar.", erro: true });
    router.refresh();
  }
  const copiar = async () => {
    try { await navigator.clipboard.writeText(url!); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* sem permissão de copiar */ }
  };
  async function chamar(campos: Record<string, string>) {
    const fd = new FormData();
    fd.append("arquivo", arquivo!); fd.append("desde", desde);
    for (const [k, v] of Object.entries(campos)) fd.append(k, v);
    const res = await fetch("/api/respondi/importar", { method: "POST", body: fd });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.erro ?? "Não foi possível importar. Tente de novo.");
    return j;
  }
  async function importar(e: React.FormEvent) {
    e.preventDefault();
    if (!arquivo) return;
    setImportando(true); setMsgImp(null);
    try {
      const c = await chamar({ contar: "1" });
      if (!window.confirm(`Achei ${c.total} preenchimentos do forms ${c.formulario} a partir de ${br(desde)} (${c.pessoas} pessoas). Criar os cartões no funil?`)) { setImportando(false); return; }
      const soma = { novo: 0, atualizado: 0, repetido: 0 };
      let pular = 0;
      for (;;) {
        const r = await chamar({ pular: String(pular) });
        soma.novo += r.novo; soma.atualizado += r.atualizado; soma.repetido += r.repetido;
        pular = r.proximo;
        if (r.acabou) break;
        setMsgImp({ txt: `Importando… ${pular} de ${r.total}. Não feche esta página.` });
      }
      setMsgImp({ txt: `Pronto: ${soma.novo} cartões novos, ${soma.atualizado} preenchimentos juntados a cartões que já existiam e ${soma.repetido} que já estavam aqui.` });
      setArquivo(null);
      router.refresh();
    } catch (err) { setMsgImp({ txt: (err as Error).message, erro: true }); }
    setImportando(false);
  }

  const forms = [...new Set(porForm.map(x => x.formulario))];
  const n = (f: string, t: string) => porForm.filter(x => x.formulario === f && x.temperatura === t).reduce((s, x) => s + x.n, 0);

  return (
    <>
      <div className={styles.topbar}>
        <div>
          <div className={styles.pageTitle}>Formulários de aplicação</div>
          <div className={styles.pageSub}>Cada preenchimento no Respondi vira um cartão no funil de vendas, já separado em quente, morno ou frio</div>
        </div>
      </div>
      <div className={styles.content}>
        <div className={a.grade}>
          <section className={a.bloco}>
            <h2 className={a.titulo}>Situação</h2>
            <div className={a.item}>
              <div className={a.itemTopo}>
                <span className={`${a.status} ${!url ? a.sErro : ultimo ? a.sOk : a.sPausa}`} aria-hidden="true" />
                <div className={a.itemNome}>
                  <b>{!url ? "Ainda não ligado" : ultimo ? "Ligado e recebendo" : "Esperando o primeiro preenchimento"}</b>
                  <small>
                    {ultimo
                      ? `Último aviso em ${quando(ultimo.em)}${ultimo.formulario ? ` · forms ${ultimo.formulario}` : ""}${ultimo.resultado === "sem_contato" ? " · sem e-mail nem WhatsApp, não virou cartão" : ""}`
                      : url ? "Cole o endereço nos dois formulários do Respondi" : "Crie o endereço ao lado"}
                  </small>
                </div>
              </div>
              {forms.map(f => (
                <div key={f} className={a.chips}>
                  <span>Forms {f}, 30 dias:</span>
                  {TEMPERATURAS.map(t => <span key={t.k} className={a.chip}>{t.icone} {n(f, t.k)} {t.label.toLowerCase()}s</span>)}
                </div>
              ))}
            </div>
            <h3 className={h.sub}>Últimos preenchimentos</h3>
            {!recentes.length && <p className={a.vazio}>Nenhum preenchimento recebido ainda.</p>}
            <ul className={h.avisos}>
              {recentes.map(r => (
                <li key={r.id}>
                  <div className={h.avisoCorpo}>
                    <b><Link href={`/comercial/funil?lead=${r.lead.id}`}>{r.lead.nome}</Link></b>
                    <span>Forms {r.formulario}{r.completa ? "" : " · não terminou"}{r.temperatura ? ` · ${NOME_TEMP[r.temperatura]}` : " · sem classificação"}</span>
                  </div>
                  <span className={h.quando}>{quando(r.preenchidoEm)}</span>
                </li>
              ))}
            </ul>
          </section>

          <div className={h.coluna}>
            <section className={a.bloco}>
              <h2 className={a.titulo}>Como ligar o Respondi</h2>
              <ol className={a.passos} style={{ marginTop: 0 }}>
                <li>
                  {url ? "Copie este endereço (é o mesmo para os dois formulários):" : "Crie o endereço que vai receber os preenchimentos:"}
                  {url && (
                    <div className={h.url}>
                      <code>{url}</code>
                      <button className={a.btnMini} onClick={copiar}>{copiado ? "Copiado ✓" : "Copiar"}</button>
                    </div>
                  )}
                  <div style={{ marginTop: 8 }}><button className={url ? a.btnMini : a.btnPrim} onClick={gerar}>{url ? "Trocar o endereço" : "Criar endereço"}</button></div>
                </li>
                <li>No Respondi, abra o formulário e vá na aba <b>Opções</b>.</li>
                <li>Desça até <b>Integrações</b> e clique em <b>Configurar integrações</b>.</li>
                <li>Ligue o <b>Webhooks</b>, cole o endereço e salve.</li>
                <li>Em <b>Quando deseja ativar as integrações?</b>, escolha <b>Ativar em respostas completas e recuperadas</b> para receber também quem não terminou (chega 1 hora depois).</li>
                <li>Faça o mesmo no outro formulário. Não precisa mexer na planilha: ela continua recebendo normalmente.</li>
                <li>Clique em <b>Fazer envio de teste</b> no Respondi ou preencha o formulário. O cartão aparece no funil em alguns segundos.</li>
              </ol>
              {msg && <p className={msg.erro ? a.msgErro : a.msgOk} role={msg.erro ? "alert" : "status"}>{msg.txt}</p>}
              <p className={a.nota}>O endereço funciona como uma senha: cole só no Respondi, não mande por WhatsApp.</p>
            </section>

            <section className={a.bloco}>
              <h2 className={a.titulo}>Trazer preenchimentos antigos</h2>
              <p className={a.nota} style={{ marginTop: 0 }}>Opcional. Serve para quem preencheu antes de ligar o Respondi. Repetir a importação não duplica ninguém.</p>
              <form className={a.form} onSubmit={importar} style={{ marginTop: 12 }}>
                <label className={h.arquivo}>
                  <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={e => setArquivo(e.target.files?.[0] ?? null)} />
                  <span>{arquivo ? arquivo.name : "Escolher a planilha (.xlsx)"}</span>
                </label>
                <label className={a.campo}>Importar quem preencheu a partir de<input type="date" value={desde} max={hoje} onChange={e => setDesde(e.target.value)} required /></label>
                {msgImp && <p className={msgImp.erro ? a.msgErro : a.msgOk} role={msgImp.erro ? "alert" : "status"}>{msgImp.txt}</p>}
                <button className={a.btnPrim} disabled={!arquivo || !desde || importando}>{importando ? "Importando…" : "Importar para o funil"}</button>
              </form>
              {importacao && <p className={a.nota}>Última importação: {importacao.total} do forms {importacao.formulario}, a partir de {br(importacao.desde)}, em {quando(importacao.em)} por {importacao.por}.</p>}
              <ol className={a.passos}>
                <li>Abra a planilha do formulário no Google.</li>
                <li><b>Arquivo</b> › <b>Fazer download</b> › <b>Microsoft Excel (.xlsx)</b>.</li>
                <li>Escolha o arquivo aqui, a data de início e clique em <b>Importar para o funil</b>.</li>
              </ol>
            </section>

            <section className={a.bloco}>
              <h2 className={a.titulo}>Como a temperatura é calculada</h2>
              <ul className={a.passos} style={{ marginTop: 0 }}>
                <li><b>Renda atual</b>: até {PESOS.renda} pontos (as faixas em € são comparadas em reais).</li>
                <li><b>Disposta a investir</b>: {PESOS.investir} pontos no “Sim”; cerca de 1/3 disso em “Não sei”.</li>
                <li><b>Inglês</b>: até {PESOS.ingles} pontos (fluente vale tudo, básico não pontua).</li>
                <li>🔥 <b>Quente</b>: {CORTE.quente} pontos ou mais. 🌤️ <b>Morno</b>: de {CORTE.morno} a {CORTE.quente - 1}. ❄️ <b>Frio</b>: menos de {CORTE.morno}.</li>
                <li>Quem responde “Não” para investir, ou para antes dessa pergunta, fica no máximo em morno.</li>
                <li>No cartão dá para mudar a temperatura à mão. Novos preenchimentos respeitam a sua escolha.</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
