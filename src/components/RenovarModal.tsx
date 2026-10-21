"use client";
import { useEffect, useState } from "react";
import m from "./RenovarModal.module.css";

const PROGRAMAS = ["Nexus 1", "Nexus 2", "Nexus 3", "Atlas", "Delta", "MCR", "FCI", "CP1", "Personalizado"];
const ACOES = [
  { k: "RENOVAÇÃO", label: "Renovação (mesmo programa)" },
  { k: "UPGRADE", label: "Upgrade" },
  { k: "DOWNGRADE", label: "Downgrade" },
  { k: "CROSS", label: "Cross-sell" },
];
const DURACOES = ["6", "7", "8", "12"];

export type Renovado = { status: string; tipo: string; prazo: string | null; duracao: number | null; renovacaoStatus: string | null };

function hoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function somarMeses(iso: string, meses: number) {
  const [y, mo, d] = iso.split("-").map(Number);
  const alvo = new Date(Date.UTC(y, mo - 1 + meses, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimo));
  return alvo.toISOString().slice(0, 10);
}
const fmt = (iso: string) => iso.split("-").reverse().join("/");

function calcularPrazo(dataRenov: string, prazoAtual: string | null, meses: number) {
  const base = prazoAtual && prazoAtual.slice(0, 10) > dataRenov ? prazoAtual.slice(0, 10) : dataRenov;
  return somarMeses(base, meses);
}

export default function RenovarModal({
  mentorada,
  onClose,
  onRenovado,
}: {
  mentorada: { id: string; nome: string; tipo: string; prazo: string | null; duracao: number | null };
  onClose: () => void;
  onRenovado: (r: Renovado) => void;
}) {
  const duracaoInicial = String(mentorada.duracao && DURACOES.includes(String(mentorada.duracao)) ? mentorada.duracao : 6);
  const [data, setData] = useState(hoje());
  const [acao, setAcao] = useState("RENOVAÇÃO");
  const [destino, setDestino] = useState(mentorada.tipo);
  const [duracao, setDuracao] = useState(duracaoInicial);
  const [prazo, setPrazo] = useState(() => calcularPrazo(hoje(), mentorada.prazo, +duracaoInicial));
  const [prazoManual, setPrazoManual] = useState(false);
  const [obs, setObs] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !salvando && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, salvando]);

  const recalcular = (d: string, meses: string) => {
    if (!prazoManual && d) setPrazo(calcularPrazo(d, mentorada.prazo, +meses));
  };

  const mudarAcao = (v: string) => {
    setAcao(v);
    if (v === "RENOVAÇÃO") setDestino(mentorada.tipo);
  };
  const mudarDestino = (v: string) => {
    setDestino(v);
    if (v !== mentorada.tipo && acao === "RENOVAÇÃO") setAcao("UPGRADE");
    if (v === mentorada.tipo && acao !== "RENOVAÇÃO") setAcao("RENOVAÇÃO");
  };

  const continuaDoPrazo = !!mentorada.prazo && mentorada.prazo.slice(0, 10) > data;
  const programas = PROGRAMAS.includes(mentorada.tipo) ? PROGRAMAS : [mentorada.tipo, ...PROGRAMAS];

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!data || !prazo) { setErro("Informe a data da renovação e o novo encerramento."); return; }
    if (prazo <= data) { setErro("O novo encerramento precisa ser depois da data da renovação."); return; }
    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch(`/api/mentorados/${mentorada.id}/renovacoes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao, destino, data, novoPrazo: prazo, duracao, obs, atualizarCadastro: true }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.erro || "Não foi possível registrar a renovação. Tente novamente.");
      onRenovado({
        status: j.mentorada?.status ?? "Ativo",
        tipo: j.mentorada?.tipo ?? destino,
        prazo: j.mentorada?.prazo ?? prazo,
        duracao: j.mentorada?.duracao ?? +duracao,
        renovacaoStatus: j.mentorada?.renovacaoStatus ?? "Renovou",
      });
    } catch (err) {
      setErro((err as Error).message);
      setSalvando(false);
    }
  }

  return (
    <div className={m.backdrop} onClick={() => !salvando && onClose()}>
      <form className={m.modal} onClick={e => e.stopPropagation()} onSubmit={salvar} role="dialog" aria-modal="true" aria-label={`Registrar renovação de ${mentorada.nome}`}>
        <header className={m.header}>
          <div>
            <div className={m.eyebrow}>Registrar renovação</div>
            <div className={m.title}>{mentorada.nome}</div>
            <div className={m.sub}>
              {mentorada.tipo}{mentorada.prazo ? ` · acesso atual até ${fmt(mentorada.prazo.slice(0, 10))}` : ""}
            </div>
          </div>
          <button type="button" className={m.close} onClick={onClose} aria-label="Fechar" disabled={salvando}>✕</button>
        </header>

        <div className={m.body}>
          <div className={m.row}>
            <label className={m.field}>
              <span>Data da renovação</span>
              <input type="date" value={data} onChange={e => { setData(e.target.value); recalcular(e.target.value, duracao); }} autoFocus />
            </label>
            <label className={m.field}>
              <span>Tipo</span>
              <select value={acao} onChange={e => mudarAcao(e.target.value)}>
                {ACOES.map(a => <option key={a.k} value={a.k}>{a.label}</option>)}
              </select>
            </label>
          </div>
          <div className={m.row3}>
            <label className={m.field}>
              <span>Programa</span>
              <select value={destino} onChange={e => mudarDestino(e.target.value)}>
                {programas.map(p => <option key={p}>{p}</option>)}
              </select>
            </label>
            <label className={m.field}>
              <span>Tempo de acesso</span>
              <select value={duracao} onChange={e => { setDuracao(e.target.value); recalcular(data, e.target.value); }}>
                {DURACOES.map(d => <option key={d} value={d}>{d} meses</option>)}
              </select>
            </label>
            <label className={m.field}>
              <span>Novo encerramento</span>
              <input type="date" value={prazo} onChange={e => { setPrazo(e.target.value); setPrazoManual(true); }} />
            </label>
          </div>
          {!prazoManual && (
            <p className={m.hint}>
              {continuaDoPrazo
                ? `Os ${duracao} meses contam a partir do fim do acesso atual (${fmt(mentorada.prazo!.slice(0, 10))}), sem perder dias.`
                : `Os ${duracao} meses contam a partir da data da renovação.`}
            </p>
          )}
          <label className={m.field}>
            <span>Observação (opcional)</span>
            <input value={obs} onChange={e => setObs(e.target.value)} placeholder="Ex: antecipou a renovação, condição especial…" />
          </label>

          <div className={m.resumo}>
            <strong>Ao confirmar, o cadastro fica assim:</strong>
            <ul>
              <li>Status <b>Ativo</b> · status de renovação <b>Renovou</b></li>
              <li>Programa <b>{destino}</b>{destino !== mentorada.tipo ? ` (antes ${mentorada.tipo})` : ""}</li>
              <li>Acesso até <b>{prazo ? fmt(prazo) : "—"}</b> · {duracao} meses</li>
              <li>A renovação entra no histórico, na linha do tempo e no card Renovações do dashboard</li>
            </ul>
          </div>
        </div>

        <footer className={m.footer}>
          {erro && <span className={m.erro} role="alert">{erro}</span>}
          <button type="button" className={m.btnGhost} onClick={onClose} disabled={salvando}>Cancelar</button>
          <button type="submit" className={m.btnPrimary} disabled={salvando}>{salvando ? "Registrando…" : "Confirmar renovação"}</button>
        </footer>
      </form>
    </div>
  );
}
