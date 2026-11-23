"use client";
import { useEffect, useState } from "react";
import { MOTIVOS_PERDA, ORIGENS, PAGAMENTOS, PROGRAMAS, duracaoPadrao } from "@/lib/comercial";
import c from "./comercial.module.css";

// Peças usadas nas telas do Comercial.

export class ErroApi extends Error {
  constructor(msg: string, public dados: Record<string, unknown> = {}) { super(msg); }
}
export async function enviar(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new ErroApi(j.erro ?? "Não foi possível salvar. Tente de novo.", j);
  return j;
}

export type Msg = { txt: string; erro?: boolean } | null;
export function Aviso({ msg, fechar }: { msg: Msg; fechar: () => void }) {
  useEffect(() => {
    if (!msg) return;
    const x = setTimeout(fechar, msg.erro ? 9000 : 4500);
    return () => clearTimeout(x);
  }, [msg, fechar]);
  if (!msg) return null;
  return (
    <div className={`${c.toast} ${msg.erro ? c.toastErro : ""}`} role={msg.erro ? "alert" : "status"}>
      <span>{msg.txt}</span>
      <button onClick={fechar} aria-label="Fechar aviso">×</button>
    </div>
  );
}

export function Janela({ titulo, sub, onFechar, children, larga = false }: {
  titulo: string; sub?: string; onFechar: () => void; children: React.ReactNode; larga?: boolean;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onFechar]);
  return (
    <div className={c.fundo} onMouseDown={e => { if (e.target === e.currentTarget) onFechar(); }}>
      <div className={`${c.modal} ${larga ? c.modalLargo : ""}`} role="dialog" aria-modal="true" aria-label={titulo}>
        <div className={c.modalTopo}>
          <div>
            <h2 className={c.modalTitulo}>{titulo}</h2>
            {sub && <p className={c.modalSub}>{sub}</p>}
          </div>
          <button type="button" className={c.fechar} onClick={onFechar} aria-label="Fechar">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Fechar venda ──
export type DadosVenda = {
  leadId?: string; cliente: string; email: string; whatsapp: string; programa: string; valor: string; pagamento: string;
  vendedora: string; data: string; origem: string; inicio: string; duracao: string; combinados: string;
};
type Resposta = { id: string; passagem: null | { ok: boolean; erro?: string; nome?: string; criada?: boolean; existente?: { nome: string; tipo: string } } };

export function FecharVenda({ inicial, equipe, onFechar, onSalvo }: {
  inicial: DadosVenda; equipe: string[]; onFechar: () => void; onSalvo: (msg: Msg) => void;
}) {
  const [v, setV] = useState(inicial);
  const [passar, setPassar] = useState<"agora" | "depois" | "nao">("agora");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [duvida, setDuvida] = useState<{ vendaId: string; erro: string; nome: string } | null>(null);
  const set = (k: keyof DadosVenda) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV(x => ({ ...x, [k]: e.target.value }));

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true); setErro(null);
    try {
      const r: Resposta = await enviar("/api/comercial/vendas", "POST", { ...v, passar: passar === "agora", passagem: passar === "nao" ? "nao_precisa" : "pendente" });
      if (r.passagem && !r.passagem.ok && r.passagem.existente) {
        setDuvida({ vendaId: r.id, erro: r.passagem.erro ?? "", nome: r.passagem.existente.nome });
        setSalvando(false);
      } else if (r.passagem && !r.passagem.ok) {
        onSalvo({ txt: `Venda registrada. A passagem ficou pendente: ${r.passagem.erro} Resolva em Comercial › Passagem.`, erro: true });
      } else {
        onSalvo({ txt: r.passagem?.ok ? `Venda registrada. ${r.passagem.nome} entrou no Pipeline do Pós Venda, em “Sem etapa”.` : "Venda registrada." });
      }
    } catch (err) { setErro((err as Error).message); setSalvando(false); }
  }

  async function decidir(modo: "ligar" | "novo") {
    if (!duvida) return;
    setSalvando(true); setErro(null);
    try {
      const r = await enviar(`/api/comercial/vendas/${duvida.vendaId}/passar`, "POST", { modo });
      onSalvo({ txt: r.criada ? `${r.nome} entrou no Pipeline do Pós Venda, em “Sem etapa”.` : `Venda ligada ao cadastro de ${r.nome}. O Pós Venda recebeu a tarefa.` });
    } catch (err) { setErro((err as Error).message); setSalvando(false); }
  }
  const pendente = () => onSalvo({ txt: "Venda registrada. A passagem ficou pendente em Comercial › Passagem." });

  if (duvida) {
    return (
      <Janela titulo="É a mesma pessoa?" sub="A venda já foi registrada" onFechar={pendente}>
        <p className={c.msgInfo}>{duvida.erro}</p>
        {erro && <p className={c.msgErro} role="alert">{erro}</p>}
        <div className={c.acoes}>
          <button className={c.btn} disabled={salvando} onClick={() => decidir("novo")}>É outra pessoa: criar cadastro</button>
          <button className={c.btnPrim} disabled={salvando} onClick={() => decidir("ligar")}>É ela: usar o cadastro de {duvida.nome.split(" ")[0]}</button>
        </div>
      </Janela>
    );
  }

  return (
    <Janela titulo="Registrar venda" sub={v.leadId ? `Fecha o card de ${inicial.cliente} no funil` : "Venda sem card no funil"} onFechar={onFechar} larga>
      <form className={c.form} onSubmit={salvar}>
        <div className={c.linha}>
          <label className={c.campo}>Cliente<input value={v.cliente} onChange={set("cliente")} required autoFocus={!v.leadId} /></label>
          <label className={c.campo}>Programa
            <select value={v.programa} required onChange={e => setV(x => ({ ...x, programa: e.target.value, duracao: String(duracaoPadrao(e.target.value)) }))}>
              <option value="">Escolha…</option>{PROGRAMAS.map(p => <option key={p}>{p}</option>)}
            </select>
          </label>
        </div>
        <div className={c.linha}>
          <label className={c.campo}>E-mail<input type="email" value={v.email} onChange={set("email")} placeholder="O mesmo da compra" /></label>
          <label className={c.campo}>WhatsApp<input value={v.whatsapp} onChange={set("whatsapp")} placeholder="Com DDD (ou +DDI)" /></label>
        </div>
        <div className={c.linha3}>
          <label className={c.campo}>Valor total (R$)<input inputMode="decimal" value={v.valor} onChange={set("valor")} placeholder="Ex.: 5.997,00" required /></label>
          <label className={c.campo}>Pagamento
            <select value={v.pagamento} onChange={set("pagamento")}><option value="">—</option>{PAGAMENTOS.map(p => <option key={p}>{p}</option>)}</select>
          </label>
          <label className={c.campo}>Data da venda<input type="date" value={v.data} onChange={set("data")} required /></label>
        </div>
        <div className={c.linha3}>
          <label className={c.campo}>Quem vendeu<input list="venda-equipe" value={v.vendedora} onChange={set("vendedora")} required /></label>
          <label className={c.campo}>Origem
            <select value={v.origem} onChange={set("origem")}><option value="">—</option>{ORIGENS.map(o => <option key={o}>{o}</option>)}</select>
          </label>
          <div className={c.linha} style={{ gridTemplateColumns: "minmax(0, 1fr) 64px", gap: 8 }}>
            <label className={c.campo}>Início<input type="date" value={v.inicio} onChange={set("inicio")} /></label>
            <label className={c.campo}>Meses<input type="number" min={1} max={36} value={v.duracao} onChange={set("duracao")} /></label>
          </div>
        </div>
        <datalist id="venda-equipe">{equipe.map(n => <option key={n} value={n} />)}</datalist>
        <label className={c.campo}>O que foi combinado na negociação
          <textarea rows={3} value={v.combinados} onChange={set("combinados")} placeholder="Objetivo dela, bônus prometidos, condições, pontos de atenção… Vai para o cadastro no Pós Venda." />
        </label>
        {v.leadId ? (
          <p className={c.msgInfo}>Ao salvar, {v.cliente.split(" ")[0] || "a cliente"} entra direto no Pipeline do Pós Venda, em “Sem etapa”{!v.email && !v.whatsapp ? ". Se puder, preencha o e-mail ou o WhatsApp para a equipe conseguir falar com ela" : ""}.</p>
        ) : (
          <fieldset className={c.opcoes}>
            <legend>Passagem para o Pós Venda</legend>
            {([["agora", "Passar agora", "cria o cadastro da mentorada e a tarefa de boas-vindas"], ["depois", "Deixar pendente", "fica na lista da Passagem"], ["nao", "Não precisa", "não é mentoria"]] as const).map(([k, t, d]) => (
              <label key={k} className={`${c.opcao} ${passar === k ? c.opcaoOn : ""}`}>
                <input type="radio" name="passar" checked={passar === k} onChange={() => setPassar(k)} /><span><b>{t}</b><small>{d}</small></span>
              </label>
            ))}
          </fieldset>
        )}
        {erro && <p className={c.msgErro} role="alert">{erro}</p>}
        <div className={c.acoes}>
          <button type="button" className={c.btn} onClick={onFechar}>Cancelar</button>
          <button className={c.btnPrim} disabled={salvando}>{salvando ? "Salvando…" : "Registrar venda"}</button>
        </div>
      </form>
    </Janela>
  );
}

// ── Motivo da perda ──
export function MotivoPerda({ nome, onFechar, onEscolher }: { nome: string; onFechar: () => void; onEscolher: (motivo: string) => void }) {
  const [motivo, setMotivo] = useState("");
  const [outro, setOutro] = useState("");
  const final = motivo === "Outro" ? outro.trim() : motivo;
  return (
    <Janela titulo="Por que não fechou?" sub={nome} onFechar={onFechar}>
      <form className={c.form} onSubmit={e => { e.preventDefault(); if (final) onEscolher(final); }}>
        <div className={c.chipsOpc}>
          {MOTIVOS_PERDA.map(m => (
            <button type="button" key={m} className={`${c.chipOpc} ${motivo === m ? c.chipOpcOn : ""}`} aria-pressed={motivo === m} onClick={() => setMotivo(m)}>{m}</button>
          ))}
        </div>
        {motivo === "Outro" && <label className={c.campo}>Qual?<input value={outro} onChange={e => setOutro(e.target.value)} autoFocus maxLength={120} /></label>}
        <div className={c.acoes}>
          <button type="button" className={c.btn} onClick={onFechar}>Cancelar</button>
          <button className={c.btnPrim} disabled={!final}>Mover para perdido</button>
        </div>
      </form>
    </Janela>
  );
}
