"use client";
import { useCallback, useEffect, useState } from "react";
import { NOME_RESULTADO, ORIGENS, PROGRAMAS, linkWhats, reais } from "@/lib/comercial";
import c from "../comercial.module.css";
import { enviar, type Msg } from "../ui";
import type { Etapa, LeadCard } from "./FunilCliente";

type Detalhe = {
  id: string; nome: string; whatsapp: string | null; email: string | null; instagram: string | null; origem: string | null; programa: string | null;
  valorCentavos: number | null; responsavel: string | null; etapaId: string; etapaEm: string; proximoPasso: string | null; proximoPassoEm: string | null;
  motivoPerda: string | null; obs: string | null; criadoPor: string | null; createdAt: string;
  notas: { id: string; tipo: string; texto: string; autor: string | null; createdAt: string }[];
  calls: { id: string; titulo: string; inicio: string; resultado: string | null }[];
  vendas: { id: string; programa: string; valorCentavos: number; data: string; cancelada: boolean }[];
};
const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

// Ficha do lead: dados, próximo passo, anotações e histórico.
export default function LeadPainel({ id, eu, hoje, equipe, etapas, onFechar, onMudou, onMsg, onMover, onVender }: {
  id: string; eu: string; hoje: string; equipe: string[]; etapas: Etapa[]; onFechar: () => void; onMudou: () => void; onMsg: (m: Msg) => void;
  onMover: (etapaId: string) => void; onVender: (l: LeadCard) => void;
}) {
  const [d, setD] = useState<Detalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [v, setV] = useState<Record<string, string>>({});
  const [nota, setNota] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const x: Detalhe = await enviar(`/api/comercial/leads/${id}`, "GET");
      setD(x);
      setV({
        nome: x.nome, whatsapp: x.whatsapp ?? "", email: x.email ?? "", instagram: x.instagram ?? "", origem: x.origem ?? "", programa: x.programa ?? "",
        valor: x.valorCentavos ? (x.valorCentavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "", responsavel: x.responsavel ?? "",
        proximoPasso: x.proximoPasso ?? "", proximoPassoEm: x.proximoPassoEm?.slice(0, 10) ?? "", obs: x.obs ?? "",
      });
    } catch (e) { setErro((e as Error).message); }
  }, [id]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- carrega a ficha ao abrir
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onFechar]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV(x => ({ ...x, [k]: e.target.value }));
  async function salvar(campos: string[], ok: string) {
    setSalvando(true);
    try {
      await enviar(`/api/comercial/leads/${id}`, "PATCH", Object.fromEntries(campos.map(k => [k, v[k]])));
      onMsg({ txt: ok }); await carregar(); onMudou();
    } catch (e) { onMsg({ txt: (e as Error).message, erro: true }); }
    setSalvando(false);
  }
  async function anotar(e: React.FormEvent) {
    e.preventDefault();
    if (!nota.trim()) return;
    try { await enviar(`/api/comercial/leads/${id}/notas`, "POST", { texto: nota }); setNota(""); await carregar(); }
    catch (err) { onMsg({ txt: (err as Error).message, erro: true }); }
  }
  async function excluir() {
    if (!d || !window.confirm(`Excluir ${d.nome} do funil? O histórico do lead também é apagado.`)) return;
    try { await enviar(`/api/comercial/leads/${id}`, "DELETE"); onMsg({ txt: "Lead excluído" }); onMudou(); onFechar(); }
    catch (err) { onMsg({ txt: (err as Error).message, erro: true }); }
  }

  const etapa = etapas.find(e => e.id === d?.etapaId);
  const whats = linkWhats(d?.whatsapp);
  const ig = d?.instagram?.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/.*$/, "");
  const card = (): LeadCard => ({
    id: d!.id, nome: d!.nome, whatsapp: d!.whatsapp, email: d!.email, instagram: d!.instagram, origem: d!.origem, programa: d!.programa, valor: d!.valorCentavos,
    responsavel: d!.responsavel, etapaId: d!.etapaId, etapaEm: d!.etapaEm, proximoPasso: d!.proximoPasso, proximoPassoEm: d!.proximoPassoEm, motivoPerda: d!.motivoPerda,
  });

  return (
    <>
      <div className={c.veu} onClick={onFechar} />
      <aside className={c.lado} role="dialog" aria-modal="true" aria-label={d ? `Lead ${d.nome}` : "Lead"}>
        <div className={c.ladoTopo}>
          <div className={c.modalTopo}>
            <div>
              <h2>{d?.nome ?? (erro ? "Não foi possível abrir" : "Carregando…")}</h2>
              {d && <p className={c.modalSub}>Desde {quando(d.createdAt).slice(0, 8)}{d.criadoPor ? ` · cadastrado por ${d.criadoPor}` : ""}{d.responsavel ? ` · com ${d.responsavel === eu ? "você" : d.responsavel}` : ""}</p>}
            </div>
            <button className={c.fechar} onClick={onFechar} aria-label="Fechar">×</button>
          </div>
          {erro && <p className={c.msgErro} role="alert">{erro}</p>}
          {d && (
            <div className={c.topoAcoes}>
              {etapa?.tipo === "ganho"
                ? <span className={`${c.tag} ${c.tVerde}`}>{etapa.nome}</span>
                : (
                  <select className={c.sel} value={d.etapaId} aria-label="Etapa" onChange={e => { onMover(e.target.value); setTimeout(carregar, 900); }}>
                    {etapas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                  </select>
                )}
              {etapa?.tipo === "perdido" && d.motivoPerda && <span className={`${c.tag} ${c.tVermelha}`}>{d.motivoPerda}</span>}
              {whats && <a className={c.whats} href={whats} target="_blank" rel="noreferrer">WhatsApp</a>}
              {ig && <a className={c.btnMini} href={`https://instagram.com/${encodeURIComponent(ig)}`} target="_blank" rel="noreferrer">Instagram</a>}
              <span className={c.espaco} />
              {etapa?.tipo !== "ganho" && <button className={c.btnPrim} onClick={() => onVender(card())}>Registrar venda</button>}
            </div>
          )}
        </div>
        {d && (
          <div className={c.ladoCorpo}>
            {etapa?.tipo === "aberta" && (
              <section>
                <h3 className={c.subTitulo}>Próximo passo</h3>
                <form className={c.proximo} onSubmit={e => { e.preventDefault(); salvar(["proximoPasso", "proximoPassoEm"], "Próximo passo salvo"); }}>
                  <label className={c.campo}>O que fazer<input value={v.proximoPasso} onChange={set("proximoPasso")} placeholder="Ex.: mandar a proposta" /></label>
                  <label className={c.campo}>Quando<input type="date" value={v.proximoPassoEm} onChange={set("proximoPassoEm")} min={hoje} /></label>
                  <button className={c.btnPrim} disabled={salvando}>Salvar</button>
                </form>
              </section>
            )}
            {d.vendas.length > 0 && (
              <section>
                <h3 className={c.subTitulo}>Vendas</h3>
                <ul className={c.lista}>{d.vendas.map(x => (
                  <li key={x.id} className={c.item}>
                    <div className={c.itemCorpo}><b>{x.programa}</b><small>{x.data.slice(0, 10).split("-").reverse().join("/")}</small></div>
                    <span className={`${c.num} ${c.valorCel}`}>{reais(x.valorCentavos)}</span>
                    {x.cancelada && <span className={`${c.tag} ${c.tVermelha}`}>cancelada</span>}
                  </li>
                ))}</ul>
              </section>
            )}
            <section>
              <h3 className={c.subTitulo}>Dados</h3>
              <form className={c.form} onSubmit={e => { e.preventDefault(); salvar(["nome", "whatsapp", "email", "instagram", "origem", "programa", "valor", "responsavel", "obs"], "Lead salvo"); }}>
                <div className={c.linha}>
                  <label className={c.campo}>Nome<input value={v.nome} onChange={set("nome")} required /></label>
                  <label className={c.campo}>WhatsApp<input value={v.whatsapp} onChange={set("whatsapp")} /></label>
                  <label className={c.campo}>E-mail<input type="email" value={v.email} onChange={set("email")} /></label>
                  <label className={c.campo}>Instagram<input value={v.instagram} onChange={set("instagram")} /></label>
                  <label className={c.campo}>Origem<select value={v.origem} onChange={set("origem")}><option value="">—</option>{[...new Set([...ORIGENS, v.origem].filter(Boolean))].map(o => <option key={o}>{o}</option>)}</select></label>
                  <label className={c.campo}>Programa<select value={v.programa} onChange={set("programa")}><option value="">—</option>{[...new Set([...PROGRAMAS, v.programa].filter(Boolean))].map(o => <option key={o}>{o}</option>)}</select></label>
                  <label className={c.campo}>Valor estimado (R$)<input inputMode="decimal" value={v.valor} onChange={set("valor")} /></label>
                  <label className={c.campo}>Responsável<input list="painel-equipe" value={v.responsavel} onChange={set("responsavel")} /></label>
                </div>
                <datalist id="painel-equipe">{equipe.map(n => <option key={n} value={n} />)}</datalist>
                <label className={c.campo}>Observações<textarea rows={3} value={v.obs} onChange={set("obs")} /></label>
                <div className={c.acoes}>
                  <button type="button" className={c.btnPerigo} onClick={excluir}>Excluir lead</button>
                  <span className={c.espaco} />
                  <button className={c.btnPrim} disabled={salvando || !v.nome?.trim()}>{salvando ? "Salvando…" : "Salvar dados"}</button>
                </div>
              </form>
            </section>
            {d.calls.length > 0 && (
              <section>
                <h3 className={c.subTitulo}>Calls</h3>
                <ul className={c.lista}>{d.calls.map(x => (
                  <li key={x.id} className={c.item}>
                    <div className={c.itemCorpo}><b>{x.titulo}</b><small>{quando(x.inicio)}</small></div>
                    {x.resultado && <span className={`${c.tag} ${x.resultado === "faltou" ? c.tVermelha : x.resultado === "remarcou" ? c.tAmarela : c.tVerde}`}>{NOME_RESULTADO[x.resultado]}</span>}
                  </li>
                ))}</ul>
              </section>
            )}
            <section>
              <h3 className={c.subTitulo}>Histórico</h3>
              <form className={c.form} onSubmit={anotar} style={{ marginBottom: 12 }}>
                <label className={c.campo}>Nova anotação<textarea rows={2} value={nota} onChange={e => setNota(e.target.value)} placeholder="O que foi conversado" /></label>
                <div className={c.acoes}><button className={c.btn} disabled={!nota.trim()}>Anotar</button></div>
              </form>
              <ul className={c.linhaTempo}>
                {d.notas.map(n => (
                  <li key={n.id} className={n.tipo === "nota" ? "" : c.mov}>
                    <p>{n.texto}</p>
                    <small>{quando(n.createdAt)}{n.autor ? ` · ${n.autor}` : ""}</small>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </aside>
    </>
  );
}
