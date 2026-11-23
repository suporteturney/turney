"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Avatar from "@/components/Avatar";
import { nomeMes, reais, somarMes } from "@/lib/comercial";
import styles from "../../shared.module.css";
import c from "../comercial.module.css";
import { Aviso, FecharVenda, Janela, enviar, type Msg } from "../ui";

type Venda = {
  id: string; cliente: string; programa: string; valor: number; pagamento: string | null; vendedora: string; data: string; origem: string | null;
  cancelada: boolean; motivo: string | null; passagem: string; leadId: string | null;
};
type Meta = { vendedora: string; valor: number; quantidade: number | null };
const br = (iso: string) => iso.split("-").reverse().join("/");
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

export default function VendasCliente({ eu, mes, hoje, equipe, gestora, vendas, metas, anterior }: {
  eu: string; mes: string; hoje: string; equipe: string[]; gestora: boolean; vendas: Venda[]; metas: Meta[]; anterior: { valor: number; n: number };
}) {
  const router = useRouter();
  const [nova, setNova] = useState(false);
  const [editarMetas, setEditarMetas] = useState(false);
  const [cancelar, setCancelar] = useState<Venda | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const fecharMsg = useCallback(() => setMsg(null), []);

  const validas = vendas.filter(v => !v.cancelada);
  const total = validas.reduce((n, v) => n + v.valor, 0);
  const meta = metas.find(m => m.vendedora === "");
  const individuais = metas.filter(m => m.vendedora);
  const pessoas = [...new Set([...validas.map(v => v.vendedora), ...individuais.map(m => m.vendedora)])]
    .map(nome => {
      const vs = validas.filter(v => v.vendedora === nome);
      return { nome, n: vs.length, valor: vs.reduce((a, v) => a + v.valor, 0), meta: individuais.find(m => m.vendedora === nome) };
    })
    .sort((a, b) => b.valor - a.valor);
  const porPrograma = Object.entries(validas.reduce<Record<string, { n: number; valor: number }>>((o, v) => {
    (o[v.programa] ??= { n: 0, valor: 0 }).n++; o[v.programa].valor += v.valor; return o;
  }, {})).sort((a, b) => b[1].valor - a[1].valor);
  const porOrigem = Object.entries(validas.reduce<Record<string, number>>((o, v) => { const k = v.origem ?? "Sem origem"; o[k] = (o[k] ?? 0) + 1; return o; }, {})).sort((a, b) => b[1] - a[1]);
  const ir = (n: number) => router.push(`/comercial/vendas?mes=${somarMes(mes, n)}`);
  const doMesAtual = mes === hoje.slice(0, 7);

  async function mudar(v: Venda, corpo: Record<string, unknown>, ok: string) {
    try { await enviar(`/api/comercial/vendas/${v.id}`, "PATCH", corpo); setMsg({ txt: ok }); setCancelar(null); router.refresh(); }
    catch (e) { setMsg({ txt: (e as Error).message, erro: true }); }
  }

  return (
    <>
      <div className={styles.topbar}>
        <div>
          <div className={styles.pageTitle}>Vendas e metas</div>
          <div className={styles.pageSub}>Vendas canceladas não entram nas contas</div>
        </div>
        <div className={c.topoAcoes}>
          <div className={c.mes}>
            <button className={c.setinha} onClick={() => ir(-1)} aria-label="Mês anterior">‹</button>
            <b>{nomeMes(mes)}</b>
            <button className={c.setinha} onClick={() => ir(1)} aria-label="Próximo mês">›</button>
          </div>
          {gestora && <button className={c.btn} onClick={() => setEditarMetas(true)}>Metas</button>}
          <button className={c.btnPrim} onClick={() => setNova(true)}>+ Venda</button>
        </div>
      </div>
      <div className={styles.content}>
        <div className={c.grade2}>
          <div className={c.pilha}>
            <section className={c.bloco}>
              <div className={c.blocoTopo}><h2 className={c.blocoTitulo}>Meta do mês</h2>{meta && <span className={`${c.tag} ${total >= meta.valor ? c.tVerde : ""}`}>{pct(total, meta.valor)}%</span>}</div>
              <div className={c.metaLinha}>
                <strong className={c.num}>{reais(total)}</strong>
                <span>{meta ? <>de {reais(meta.valor)}{meta.quantidade ? ` · ${validas.length} de ${meta.quantidade} vendas` : ""}</> : `${validas.length} ${validas.length === 1 ? "venda" : "vendas"}`}</span>
              </div>
              {meta && <div className={c.trilho}><span className={total >= meta.valor ? c.bateu : ""} style={{ width: `${Math.min(100, pct(total, meta.valor))}%` }} /></div>}
              <p className={c.nota}>
                {meta
                  ? total >= meta.valor ? `Meta batida, ${reais(total - meta.valor)} acima.` : `Faltam ${reais(meta.valor - total)}${doMesAtual ? " até o fim do mês" : ""}.`
                  : gestora ? "Sem meta definida para este mês. Clique em Metas para definir." : "Sem meta definida para este mês."}
                {" "}Mês anterior: {reais(anterior.valor)} em {anterior.n} {anterior.n === 1 ? "venda" : "vendas"}.
              </p>
            </section>
            <section className={c.bloco}>
              <div className={c.blocoTopo}><h2 className={c.blocoTitulo}>Vendas</h2><span className={c.nota}>{validas.length} no mês</span></div>
              {!vendas.length && <p className={c.vazio}>Nenhuma venda em {nomeMes(mes)}. Feche um card no funil ou clique em + Venda.</p>}
              {vendas.length > 0 && (
                <div className={c.tabelaWrap}>
                  <table className={c.tabela}>
                    <thead><tr><th>Data</th><th>Cliente</th><th>Programa</th><th>Vendeu</th><th className={c.direita}>Valor</th><th>Pós Venda</th><th /></tr></thead>
                    <tbody>
                      {vendas.map(v => (
                        <tr key={v.id} className={v.cancelada ? c.cancelada : ""}>
                          <td>{br(v.data).slice(0, 5)}</td>
                          <td>{v.leadId ? <Link className={c.nomeBtn} href={`/comercial/funil?lead=${v.leadId}`}>{v.cliente}</Link> : <b>{v.cliente}</b>}<small>{v.cancelada ? `Cancelada: ${v.motivo}` : v.pagamento}</small></td>
                          <td>{v.programa}<small>{v.origem}</small></td>
                          <td>{v.vendedora.split(" ")[0]}</td>
                          <td className={`${c.direita} ${c.num} ${c.valorCel}`}>{reais(v.valor)}</td>
                          <td>{v.cancelada ? "" : v.passagem === "enviada" ? <span className={`${c.tag} ${c.tVerde}`}>passada</span> : v.passagem === "nao_precisa" ? <span className={c.tag}>não precisa</span> : <Link href="/comercial/passagem" className={`${c.tag} ${c.tAmarela}`}>pendente</Link>}</td>
                          <td className={c.direita}>
                            {(gestora || v.vendedora === eu) && (v.cancelada
                              ? <button className={c.btnMini} onClick={() => mudar(v, { cancelada: false }, "Venda reativada")}>Reativar</button>
                              : <button className={c.btnMini} onClick={() => setCancelar(v)}>Cancelar</button>)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
          <div className={c.pilha}>
            <section className={c.bloco}>
              <div className={c.blocoTopo}><h2 className={c.blocoTitulo}>Por pessoa</h2></div>
              {!pessoas.length && <p className={c.vazio}>Ninguém vendeu ainda neste mês.</p>}
              <ul className={c.pessoas}>
                {pessoas.map(p => (
                  <li key={p.nome} className={c.pessoa}>
                    <Avatar nome={p.nome} tamanho={30} />
                    <div><b>{p.nome}</b><br /><small>{p.n} {p.n === 1 ? "venda" : "vendas"}{p.meta ? ` · meta ${reais(p.meta.valor)}` : ""}</small></div>
                    <span className={`${c.num} ${c.valorCard}`}>{reais(p.valor)}</span>
                    {p.meta && <div className={c.trilho}><span className={p.valor >= p.meta.valor ? c.bateu : ""} style={{ width: `${Math.min(100, pct(p.valor, p.meta.valor))}%` }} /></div>}
                  </li>
                ))}
              </ul>
            </section>
            <section className={c.bloco}>
              <div className={c.blocoTopo}><h2 className={c.blocoTitulo}>Por programa</h2></div>
              {!porPrograma.length && <p className={c.vazio}>—</p>}
              <ul className={c.lista}>{porPrograma.map(([k, x]) => (
                <li key={k} className={c.item}><div className={c.itemCorpo}><b>{k}</b><small>{x.n} {x.n === 1 ? "venda" : "vendas"}</small></div><span className={`${c.num} ${c.valorCard}`}>{reais(x.valor)}</span></li>
              ))}</ul>
            </section>
            {porOrigem.length > 0 && (
              <section className={c.bloco}>
                <div className={c.blocoTopo}><h2 className={c.blocoTitulo}>De onde vieram</h2></div>
                <ul className={c.lista}>{porOrigem.map(([k, n]) => (
                  <li key={k} className={c.item}><div className={c.itemCorpo}><b>{k}</b></div><span className={`${c.num} ${c.valorCard}`}>{n}</span></li>
                ))}</ul>
              </section>
            )}
          </div>
        </div>
      </div>

      {nova && (
        <FecharVenda
          equipe={equipe} onFechar={() => setNova(false)}
          inicial={{ cliente: "", email: "", whatsapp: "", programa: "", valor: "", pagamento: "", vendedora: eu, data: doMesAtual ? hoje : `${mes}-01`, origem: "", inicio: hoje, duracao: "6", combinados: "" }}
          onSalvo={m => { setNova(false); setMsg(m); router.refresh(); }}
        />
      )}
      {cancelar && <CancelarVenda v={cancelar} onFechar={() => setCancelar(null)} onConfirmar={motivo => mudar(cancelar, { cancelada: true, motivoCancelamento: motivo }, "Venda cancelada")} />}
      {editarMetas && <Metas mes={mes} metas={metas} equipe={equipe} onFechar={() => setEditarMetas(false)} onSalvo={m => { setMsg(m); router.refresh(); }} />}
      <Aviso msg={msg} fechar={fecharMsg} />
    </>
  );
}

function CancelarVenda({ v, onFechar, onConfirmar }: { v: Venda; onFechar: () => void; onConfirmar: (m: string) => void }) {
  const [motivo, setMotivo] = useState("");
  return (
    <Janela titulo="Cancelar venda" sub={`${v.cliente} · ${reais(v.valor)}`} onFechar={onFechar}>
      <form className={c.form} onSubmit={e => { e.preventDefault(); if (motivo.trim()) onConfirmar(motivo); }}>
        <label className={c.campo}>Motivo<input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ex.: reembolso em 7 dias" autoFocus /></label>
        {v.passagem === "enviada" && <p className={c.msgInfo}>Esta cliente já está no Pós Venda. Cancelar a venda aqui não muda o cadastro dela: avise a equipe do Pós Venda.</p>}
        <div className={c.acoes}><button type="button" className={c.btn} onClick={onFechar}>Voltar</button><button className={c.btnPerigo} disabled={!motivo.trim()}>Cancelar venda</button></div>
      </form>
    </Janela>
  );
}

function Metas({ mes, metas, equipe, onFechar, onSalvo }: { mes: string; metas: Meta[]; equipe: string[]; onFechar: () => void; onSalvo: (m: Msg) => void }) {
  const linhas = ["", ...equipe];
  const valorDe = (v: string) => { const m = metas.find(x => x.vendedora === v); return { valor: m ? (m.valor / 100).toLocaleString("pt-BR") : "", quantidade: m?.quantidade ? String(m.quantidade) : "" }; };
  const [vals, setVals] = useState<Record<string, { valor: string; quantidade: string }>>(() => Object.fromEntries(linhas.map(v => [v, valorDe(v)])));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true); setErro(null);
    try {
      for (const v of linhas) {
        const antes = valorDe(v);
        if (antes.valor !== vals[v].valor || antes.quantidade !== vals[v].quantidade) await enviar("/api/comercial/metas", "PUT", { mes, vendedora: v, ...vals[v] });
      }
      onSalvo({ txt: "Metas salvas" }); onFechar();
    } catch (err) { setErro((err as Error).message); setSalvando(false); }
  }
  const campo = (v: string, k: "valor" | "quantidade") => (e: React.ChangeEvent<HTMLInputElement>) => setVals(x => ({ ...x, [v]: { ...x[v], [k]: e.target.value } }));
  return (
    <Janela titulo="Metas" sub={nomeMes(mes)} onFechar={onFechar} larga>
      <form className={c.form} onSubmit={salvar}>
        <div className={c.tabelaWrap}>
          <table className={c.tabela}>
            <thead><tr><th>Quem</th><th>Valor (R$)</th><th>Vendas</th></tr></thead>
            <tbody>
              {linhas.map(v => (
                <tr key={v || "equipe"}>
                  <td><b>{v || "Equipe inteira"}</b></td>
                  <td><input className={c.sel} inputMode="decimal" value={vals[v].valor} onChange={campo(v, "valor")} aria-label={`Meta em reais de ${v || "equipe"}`} /></td>
                  <td><input className={c.sel} type="number" min={1} style={{ width: 90 }} value={vals[v].quantidade} onChange={campo(v, "quantidade")} aria-label={`Meta em vendas de ${v || "equipe"}`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={c.nota}>Deixe o valor vazio para tirar a meta.</p>
        {erro && <p className={c.msgErro} role="alert">{erro}</p>}
        <div className={c.acoes}><button type="button" className={c.btn} onClick={onFechar}>Cancelar</button><button className={c.btnPrim} disabled={salvando}>{salvando ? "Salvando…" : "Salvar metas"}</button></div>
      </form>
    </Janela>
  );
}
