"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ehLiveEvento } from "@/lib/origem";
import m from "./NovoMentoradoModal.module.css";

const PROGRAMAS = ["Nexus 1", "Nexus 2", "Nexus 3", "Atlas", "Delta", "MCR", "FCI", "CP1", "Personalizado"];
const STATUS = ["Ativo", "Em Andamento", "Em Renovação"];
const DURACOES = ["6", "7", "8", "12"];
const ORIGENS = ["Fluxo de Vendas", "Indicação", "Lives / Eventos", "Instagram", "LinkedIn", "YouTube", "Parceria", "Upsell / Upgrade", "Downgrade", "Cross-sell", "Workshop A Revolução Atlas", "Outra"];

function hoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function somarMeses(iso: string, meses: number) {
  if (!iso || !meses) return "";
  const [y, mo, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1 + meses, d));
  return dt.toISOString().slice(0, 10);
}

const VAZIO = {
  nome: "", tipo: "Nexus 2", status: "Ativo", inicio: hoje(), duracao: "6", prazo: somarMeses(hoje(), 6),
  email: "", whatsapp: "", area: "", localizacao: "", origem: "", origemDetalhe: "", produtoAnterior: "",
  linkedin: "", drive: "", asana: "", obs: "",
};

type Form = typeof VAZIO;
type Rascunho = { f: Form; prazoManual: boolean; aberto: boolean; salvoEm: string };
const RASCUNHO = "turney_novo_mentorado_rascunho";

function lerRascunho(): Rascunho | null {
  try {
    const s = localStorage.getItem(RASCUNHO);
    return s ? (JSON.parse(s) as Rascunho) : null;
  } catch {
    return null;
  }
}
function gravarRascunho(r: Rascunho | null) {
  try {
    if (r) localStorage.setItem(RASCUNHO, JSON.stringify(r));
    else localStorage.removeItem(RASCUNHO);
  } catch {
    /* navegador sem armazenamento: o formulário segue funcionando, só sem rascunho */
  }
}
const temConteudo = (f: Form) =>
  (Object.keys(VAZIO) as (keyof Form)[]).some(k => !["tipo", "status", "inicio", "duracao", "prazo"].includes(k) && f[k].trim() !== "");

export function useNovoMentorado() {
  const [aberto, setAberto] = useState(false);
  const [temRascunho, setTemRascunho] = useState(false);

  useEffect(() => {
    const r = lerRascunho();
    const t = window.setTimeout(() => {
      setTemRascunho(!!r && temConteudo(r.f));
      if (r?.aberto && temConteudo(r.f)) setAberto(true);
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  const abrir = useCallback(() => setAberto(true), []);
  const fechar = useCallback(() => {
    setAberto(false);
    const r = lerRascunho();
    setTemRascunho(!!r && temConteudo(r.f));
  }, []);
  return { aberto, abrir, fechar, temRascunho };
}

export default function NovoMentoradoModal({
  onClose,
  onCriado,
}: {
  onClose: () => void;
  onCriado: (id: string, nome: string) => void;
}) {
  const [inicial] = useState(() => lerRascunho());
  const [f, setF] = useState<Form>(() => (inicial ? { ...VAZIO, ...inicial.f } : VAZIO));
  const [prazoManual, setPrazoManual] = useState(inicial?.prazoManual ?? false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvoEm, setSalvoEm] = useState<string | null>(inicial && temConteudo(inicial.f) ? inicial.salvoEm : null);
  const nomeRef = useRef<HTMLInputElement>(null);
  const restaurado = !!inicial && temConteudo(inicial.f);

  useEffect(() => {
    if (!temConteudo(f)) {
      gravarRascunho(null);
      return;
    }
    const agora = new Date().toISOString();
    gravarRascunho({ f, prazoManual, aberto: true, salvoEm: agora });
    const t = window.setTimeout(() => setSalvoEm(agora), 0);
    return () => window.clearTimeout(t);
  }, [f, prazoManual]);

  const fecharMantendo = useCallback(() => {
    const r = lerRascunho();
    if (r) gravarRascunho({ ...r, aberto: false });
    onClose();
  }, [onClose]);

  function cancelar() {
    if (temConteudo(f) && !window.confirm("Descartar o que já foi preenchido deste cadastro?")) return;
    gravarRascunho(null);
    onClose();
  }

  useEffect(() => {
    nomeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && fecharMantendo();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fecharMantendo]);

  const set = (k: keyof typeof VAZIO) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const v = e.target.value;
    setF(prev => {
      const n = { ...prev, [k]: v };
      if (k === "origem" && !ehLiveEvento(v)) n.origemDetalhe = "";
      if ((k === "inicio" || k === "duracao") && !prazoManual) n.prazo = somarMeses(n.inicio, parseInt(n.duracao, 10));
      return n;
    });
    if (k === "prazo") setPrazoManual(true);
  };

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!f.nome.trim()) { setErro("Preencha o nome da mentorada."); nomeRef.current?.focus(); return; }
    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch("/api/mentorados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.erro || "Não foi possível cadastrar. Tente novamente.");
      gravarRascunho(null);
      onCriado(j.id, j.nome);
    } catch (err) {
      setErro((err as Error).message);
      setSalvando(false);
    }
  }

  return (
    <div className={m.backdrop}>
      <form className={m.modal} onSubmit={salvar} role="dialog" aria-modal="true" aria-label="Novo mentorado">
        <header className={m.header}>
          <div>
            <div className={m.title}>Novo Mentorado</div>
            {restaurado && <div className={m.restaurado}>Rascunho recuperado — continue de onde parou</div>}
          </div>
          <button type="button" className={m.close} onClick={fecharMantendo} aria-label="Fechar e guardar rascunho" title="Fechar (o rascunho fica guardado)">✕</button>
        </header>

        <div className={m.body}>
          <div className={m.section}>Dados principais</div>
          <div className={m.row}>
            <label className={`${m.field} ${m.full}`}>
              <span>Nome completo *</span>
              <input ref={nomeRef} value={f.nome} onChange={set("nome")} placeholder="Nome da mentorada" />
            </label>
          </div>
          <div className={m.row}>
            <label className={m.field}>
              <span>Programa *</span>
              <select value={f.tipo} onChange={set("tipo")}>{PROGRAMAS.map(p => <option key={p}>{p}</option>)}</select>
            </label>
            <label className={m.field}>
              <span>Status</span>
              <select value={f.status} onChange={set("status")}>{STATUS.map(p => <option key={p}>{p}</option>)}</select>
            </label>
          </div>
          <div className={m.row3}>
            <label className={m.field}>
              <span>Data de início</span>
              <input type="date" value={f.inicio} onChange={set("inicio")} />
            </label>
            <label className={m.field}>
              <span>Tempo de mentoria</span>
              <select value={f.duracao} onChange={set("duracao")}>{DURACOES.map(d => <option key={d} value={d}>{d} meses</option>)}</select>
            </label>
            <label className={m.field}>
              <span>Encerramento</span>
              <input type="date" value={f.prazo} onChange={set("prazo")} />
              {!prazoManual && <small>Calculado pelo início + tempo</small>}
            </label>
          </div>

          <div className={m.section}>Contato</div>
          <div className={m.row}>
            <label className={m.field}><span>E-mail</span><input type="email" value={f.email} onChange={set("email")} placeholder="email@exemplo.com" /></label>
            <label className={m.field}><span>WhatsApp</span><input type="tel" value={f.whatsapp} onChange={set("whatsapp")} placeholder="+55 11 99999-9999" /></label>
          </div>
          <div className={m.row}>
            <label className={m.field}><span>Área de atuação</span><input value={f.area} onChange={set("area")} placeholder="Ex: Supply Chain" /></label>
            <label className={m.field}><span>Localização</span><input value={f.localizacao} onChange={set("localizacao")} placeholder="Ex: Irlanda" /></label>
          </div>
          <div className={m.row}>
            <label className={m.field}>
              <span>Origem</span>
              <input list="nm-origem" value={f.origem} onChange={set("origem")} placeholder="Selecione ou digite…" />
              <datalist id="nm-origem">{ORIGENS.map(o => <option key={o} value={o} />)}</datalist>
            </label>
            <label className={m.field}>
              <span>Produto anterior</span>
              <input list="nm-prod" value={f.produtoAnterior} onChange={set("produtoAnterior")} placeholder="Nenhum (novo aluno)" />
              <datalist id="nm-prod">{PROGRAMAS.map(o => <option key={o} value={o} />)}</datalist>
            </label>
          </div>
          {ehLiveEvento(f.origem) && (
            <div className={m.row}>
              <label className={`${m.field} ${m.full}`}>
                <span>Qual live / evento?</span>
                <input value={f.origemDetalhe} onChange={set("origemDetalhe")} placeholder="Ex: Live Carreira Internacional (12/08)" />
              </label>
            </div>
          )}

          <div className={m.section}>Links</div>
          <div className={m.row3}>
            <label className={m.field}><span>LinkedIn</span><input value={f.linkedin} onChange={set("linkedin")} placeholder="linkedin.com/in/…" /></label>
            <label className={m.field}><span>Google Drive</span><input value={f.drive} onChange={set("drive")} placeholder="drive.google.com/…" /></label>
            <label className={m.field}><span>Asana</span><input value={f.asana} onChange={set("asana")} placeholder="app.asana.com/…" /></label>
          </div>
          <div className={m.row}>
            <label className={`${m.field} ${m.full}`}>
              <span>Observação</span>
              <textarea rows={3} value={f.obs} onChange={set("obs")} placeholder="Contexto da venda, objetivos, pontos de atenção…" />
            </label>
          </div>
        </div>

        <footer className={m.footer}>
          {erro ? (
            <span className={m.erro} role="alert">{erro}</span>
          ) : (
            salvoEm && <span className={m.salvo}>Rascunho salvo automaticamente às {new Date(salvoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
          )}
          <button type="button" className={m.btnGhost} onClick={cancelar}>Descartar</button>
          <button type="submit" className={m.btnPrimary} disabled={salvando}>{salvando ? "Cadastrando…" : "Cadastrar mentorado"}</button>
        </footer>
      </form>
    </div>
  );
}
