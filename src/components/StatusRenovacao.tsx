"use client";
import { useState } from "react";
import s from "./StatusRenovacao.module.css";

export const STATUS_RENOVACAO = [
  { k: "Não iniciado", cor: "#9B8B7A" },
  { k: "Call ofertada", cor: "#3B82F6" },
  { k: "Call agendada", cor: "#10B981" },
  { k: "Follow-up", cor: "#D97706" },
  { k: "Sem perspectiva", cor: "#EF4444" },
];

export default function StatusRenovacao({
  mentoradaId,
  valor,
  nome,
  onSalvo,
}: {
  mentoradaId: string;
  valor: string | null;
  nome: string;
  onSalvo?: (valor: string | null) => void;
}) {
  const [atual, setAtual] = useState(valor ?? "");
  const [estado, setEstado] = useState<"ok" | "salvando" | "erro">("ok");
  const cor = STATUS_RENOVACAO.find(x => x.k === atual)?.cor ?? "#CBD5E1";

  async function mudar(novo: string) {
    const antes = atual;
    setAtual(novo);
    setEstado("salvando");
    try {
      const r = await fetch(`/api/mentorados/${mentoradaId}`, {
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

  return (
    <div className={s.wrap}>
      <select
        className={s.select}
        style={{ "--c": cor } as React.CSSProperties}
        value={atual}
        onChange={e => mudar(e.target.value)}
        aria-label={`Status de renovação de ${nome}`}
        disabled={estado === "salvando"}
      >
        <option value="">Definir status…</option>
        {STATUS_RENOVACAO.map(o => <option key={o.k} value={o.k}>{o.k}</option>)}
        {atual && !STATUS_RENOVACAO.some(o => o.k === atual) && <option value={atual}>{atual}</option>}
      </select>
      {estado === "erro" && <span className={s.erro}>Não salvou — tente de novo</span>}
    </div>
  );
}
