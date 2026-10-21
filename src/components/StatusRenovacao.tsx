"use client";
import { useState } from "react";
import RenovarModal, { type Renovado } from "./RenovarModal";
import s from "./StatusRenovacao.module.css";

export const STATUS_RENOVACAO = [
  { k: "Não iniciado", cor: "#9B8B7A" },
  { k: "Call ofertada", cor: "#3B82F6" },
  { k: "Call agendada", cor: "#8B5CF6" },
  { k: "Follow-up", cor: "#D97706" },
  { k: "Renovou", cor: "#10B981" },
  { k: "Não quis renovar", cor: "#B91C1C" },
  { k: "Sem perspectiva", cor: "#EF4444" },
];

export type { Renovado };

export default function StatusRenovacao({
  mentorada,
  valor,
  onSalvo,
  onRenovado,
}: {
  mentorada: { id: string; nome: string; tipo: string; prazo: string | null; duracao: number | null };
  valor: string | null;
  onSalvo?: (valor: string | null) => void;
  onRenovado?: (r: Renovado) => void;
}) {
  const [atual, setAtual] = useState(valor ?? "");
  const [estado, setEstado] = useState<"ok" | "salvando" | "erro">("ok");
  const [renovando, setRenovando] = useState(false);
  const cor = STATUS_RENOVACAO.find(x => x.k === atual)?.cor ?? "#CBD5E1";

  async function salvar(novo: string) {
    const antes = atual;
    setAtual(novo);
    setEstado("salvando");
    try {
      const r = await fetch(`/api/mentorados/${mentorada.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ renovacaoStatus: novo }),
      });
      if (!r.ok) throw new Error();
      setEstado("ok");
      onSalvo?.(novo || null);
    } catch {
      setAtual(antes);
      setEstado("erro");
    }
  }

  function mudar(novo: string) {
    if (novo === "Renovou") {
      setRenovando(true);
      return;
    }
    salvar(novo);
  }

  return (
    <div className={s.wrap}>
      <select
        className={s.select}
        style={{ "--c": cor } as React.CSSProperties}
        value={atual}
        onChange={e => mudar(e.target.value)}
        aria-label={`Status de renovação de ${mentorada.nome}`}
        disabled={estado === "salvando"}
      >
        <option value="">Definir status…</option>
        {STATUS_RENOVACAO.map(o => <option key={o.k} value={o.k}>{o.k}</option>)}
        {atual && !STATUS_RENOVACAO.some(o => o.k === atual) && <option value={atual}>{atual}</option>}
      </select>
      {atual === "Renovou" && (
        <button type="button" className={s.link} onClick={() => setRenovando(true)}>+ registrar outra renovação</button>
      )}
      {estado === "erro" && <span className={s.erro}>Não salvou — tente de novo</span>}
      {renovando && (
        <RenovarModal
          mentorada={mentorada}
          onClose={() => setRenovando(false)}
          onRenovado={r => {
            setRenovando(false);
            setAtual("Renovou");
            setEstado("ok");
            onRenovado?.(r);
            onSalvo?.("Renovou");
          }}
        />
      )}
    </div>
  );
}
