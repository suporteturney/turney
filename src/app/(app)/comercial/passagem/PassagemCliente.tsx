"use client";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import MentoradaDrawer from "@/components/MentoradaDrawer";
import styles from "../../shared.module.css";
import c from "../comercial.module.css";
import { Aviso, ErroApi, Janela, enviar, type Msg } from "../ui";

type V = {
  id: string; cliente: string; email: string | null; whatsapp: string | null; programa: string; vendedora: string; data: string; inicio: string | null; duracao: number | null;
  combinados: string | null; passagem: string; passagemEm: string | null; passagemPor: string | null; mentoradaId: string | null; fase: string | null; status: string | null;
};
const br = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");

export default function PassagemCliente({ vendas, verCadastro }: { vendas: V[]; verCadastro: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<Msg>(null);
  const fecharMsg = useCallback(() => setMsg(null), []);
  const [abrir, setAbrir] = useState<V | null>(null);
  const [cadastro, setCadastro] = useState<string | null>(null);
  const pendentes = vendas.filter(v => v.passagem !== "enviada");
  const enviadas = vendas.filter(v => v.passagem === "enviada");

  return (
    <>
      <div className={styles.topbar}>
        <div>
          <div className={styles.pageTitle}>Passagem para o Pós Venda</div>
          <div className={styles.pageSub}>Quem fecha no funil vai direto para o Pipeline do Pós Venda, em “Sem etapa”. Aqui ficam as que precisam de uma decisão</div>
        </div>
      </div>
      <div className={styles.content}>
        <div className={c.pilha}>
          <section className={c.bloco}>
            <div className={c.blocoTopo}><h2 className={c.blocoTitulo}>Pendentes</h2><span className={`${c.tag} ${pendentes.length ? c.tAmarela : c.tVerde}`}>{pendentes.length}</span></div>
            {!pendentes.length && <p className={c.vazio}>Nenhuma venda esperando passagem.</p>}
            <ul className={c.lista}>
              {pendentes.map(v => (
                <li key={v.id} className={c.item}>
                  <div className={c.itemCorpo}>
                    <b>{v.cliente}</b> <span className={c.tag}>{v.programa}</span>
                    <small>Vendida em {br(v.data)} por {v.vendedora}{!v.email && !v.whatsapp ? " · sem e-mail e WhatsApp" : ""}{!v.combinados ? " · sem combinados" : ""}</small>
                  </div>
                  <button className={c.btnPrim} onClick={() => setAbrir(v)}>Passar</button>
                </li>
              ))}
            </ul>
          </section>
          <section className={c.bloco}>
            <div className={c.blocoTopo}><h2 className={c.blocoTitulo}>Já no Pós Venda</h2><span className={c.nota}>{enviadas.length}</span></div>
            {!enviadas.length && <p className={c.vazio}>As passagens feitas aparecem aqui, com a etapa em que a mentorada está.</p>}
            {enviadas.length > 0 && (
              <div className={c.tabelaWrap}>
                <table className={c.tabela}>
                  <thead><tr><th>Cliente</th><th>Programa</th><th>Vendida</th><th>Passada</th><th>Onde está</th><th /></tr></thead>
                  <tbody>
                    {enviadas.map(v => (
                      <tr key={v.id}>
                        <td><b>{v.cliente}</b></td>
                        <td>{v.programa}</td>
                        <td>{br(v.data)}<small>{v.vendedora}</small></td>
                        <td>{v.passagemEm ? new Date(v.passagemEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—"}<small>{v.passagemPor}</small></td>
                        <td>{v.fase ? <span className={`${c.tag} ${c.tAzul}`}>{v.fase}</span> : <span className={c.tag}>{v.status === "Ativo" ? "Sem etapa" : v.status ?? "—"}</span>}</td>
                        <td className={c.direita}>{verCadastro && v.mentoradaId && <button className={c.btnMini} onClick={() => setCadastro(v.mentoradaId)}>Cadastro</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
      {abrir && <Passar v={abrir} onFechar={() => setAbrir(null)} onSalvo={m => { setAbrir(null); setMsg(m); router.refresh(); }} />}
      {cadastro && <MentoradaDrawer key={cadastro} id={cadastro} onClose={() => setCadastro(null)} onChanged={() => router.refresh()} />}
      <Aviso msg={msg} fechar={fecharMsg} />
    </>
  );
}

function Passar({ v, onFechar, onSalvo }: { v: V; onFechar: () => void; onSalvo: (m: Msg) => void }) {
  const [d, setD] = useState({ email: v.email ?? "", whatsapp: v.whatsapp ?? "", inicio: v.inicio ?? v.data, duracao: String(v.duracao ?? 6), combinados: v.combinados ?? "" });
  const [existente, setExistente] = useState<{ nome: string; tipo: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const set = (k: keyof typeof d) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setD(x => ({ ...x, [k]: e.target.value }));

  async function passar(modo: "auto" | "ligar" | "novo") {
    setSalvando(true); setErro(null);
    try {
      await enviar(`/api/comercial/vendas/${v.id}`, "PATCH", d);
      const r = await enviar(`/api/comercial/vendas/${v.id}/passar`, "POST", { modo });
      onSalvo({ txt: r.criada ? `${r.nome} entrou no Pipeline do Pós Venda, em “Sem etapa”.` : `Venda ligada ao cadastro de ${r.nome}. O Pós Venda recebeu a tarefa.` });
    } catch (e) {
      setErro((e as Error).message);
      if (e instanceof ErroApi && e.dados.existente) setExistente(e.dados.existente as { nome: string; tipo: string });
      setSalvando(false);
    }
  }
  async function naoPrecisa() {
    try { await enviar(`/api/comercial/vendas/${v.id}`, "PATCH", { passagem: "nao_precisa" }); onSalvo({ txt: "Venda marcada como sem passagem" }); }
    catch (e) { setErro((e as Error).message); }
  }
  return (
    <Janela titulo={`Passar ${v.cliente}`} sub={`${v.programa} · vendida em ${br(v.data)} por ${v.vendedora}`} onFechar={onFechar} larga>
      <form className={c.form} onSubmit={e => { e.preventDefault(); passar("auto"); }}>
        <div className={c.linha}>
          <label className={c.campo}>E-mail<input type="email" value={d.email} onChange={set("email")} /></label>
          <label className={c.campo}>WhatsApp<input value={d.whatsapp} onChange={set("whatsapp")} /></label>
          <label className={c.campo}>Início do contrato<input type="date" value={d.inicio} onChange={set("inicio")} required /></label>
          <label className={c.campo}>Duração (meses)<input type="number" min={1} max={36} value={d.duracao} onChange={set("duracao")} required /></label>
        </div>
        <label className={c.campo}>O que foi combinado<textarea rows={4} value={d.combinados} onChange={set("combinados")} placeholder="Objetivo dela, bônus prometidos, condições, pontos de atenção…" /></label>
        {erro && <p className={existente ? c.msgInfo : c.msgErro} role="alert">{erro}</p>}
        <div className={c.acoes}>
          <button type="button" className={c.btn} onClick={naoPrecisa}>Não precisa de passagem</button>
          <span className={c.espaco} />
          {existente
            ? <>
                <button type="button" className={c.btn} disabled={salvando} onClick={() => passar("novo")}>É outra pessoa: criar cadastro</button>
                <button type="button" className={c.btnPrim} disabled={salvando} onClick={() => passar("ligar")}>É ela: usar o cadastro de {existente.nome.split(" ")[0]}</button>
              </>
            : <button className={c.btnPrim} disabled={salvando}>{salvando ? "Passando…" : "Passar para o Pós Venda"}</button>}
        </div>
      </form>
    </Janela>
  );
}
