"use client";
import { useEffect, useRef, useState } from "react";
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
  email: "", whatsapp: "", area: "", localizacao: "", origem: "", produtoAnterior: "",
  linkedin: "", drive: "", asana: "", obs: "",
};

export default function NovoMentoradoModal({
  onClose,
  onCriado,
}: {
  onClose: () => void;
  onCriado: (id: string, nome: string) => void;
}) {
  const [f, setF] = useState(VAZIO);
  const [prazoManual, setPrazoManual] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const nomeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nomeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = (k: keyof typeof VAZIO) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const v = e.target.value;
    setF(prev => {
      const n = { ...prev, [k]: v };
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
      onCriado(j.id, j.nome);
    } catch (err) {
      setErro((err as Error).message);
      setSalvando(false);
    }
  }

  return (
    <div className={m.backdrop} onClick={onClose}>
      <form className={m.modal} onClick={e => e.stopPropagation()} onSubmit={salvar} role="dialog" aria-modal="true" aria-label="Novo mentorado">
        <header className={m.header}>
          <div className={m.title}>Novo Mentorado</div>
          <button type="button" className={m.close} onClick={onClose} aria-label="Fechar">✕</button>
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
          {erro && <span className={m.erro} role="alert">{erro}</span>}
          <button type="button" className={m.btnGhost} onClick={onClose}>Cancelar</button>
          <button type="submit" className={m.btnPrimary} disabled={salvando}>{salvando ? "Cadastrando…" : "Cadastrar mentorado"}</button>
        </footer>
      </form>
    </div>
  );
}
