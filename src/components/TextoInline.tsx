"use client";
import { useRef, useState } from "react";
import t from "./TextoInline.module.css";

const fmt = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");

export default function TextoInline({
  mentoradaId,
  campo,
  valor,
  atualizadoEm,
  placeholder,
  ariaLabel,
  onSalvo,
}: {
  mentoradaId: string;
  campo: "negociacao" | "saudeMotivo";
  valor: string | null;
  atualizadoEm: string | null;
  placeholder: string;
  ariaLabel: string;
  onSalvo: (valor: string | null, atualizadoEm: string | null) => void;
}) {
  const [texto, setTexto] = useState(valor ?? "");
  const [estado, setEstado] = useState<"ok" | "salvando" | "erro">("ok");
  const ref = useRef<HTMLTextAreaElement>(null);
  const emAt = `${campo}Em` as const;

  async function salvar() {
    const novo = texto.trim();
    if (novo === (valor ?? "")) return;
    setEstado("salvando");
    try {
      const res = await fetch(`/api/mentorados/${mentoradaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [campo]: novo }),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      onSalvo(json[campo] ?? null, json[emAt] ?? null);
      setTexto(json[campo] ?? "");
      setEstado("ok");
    } catch {
      setEstado("erro");
    }
  }

  return (
    <div className={t.wrap}>
      <textarea
        ref={ref}
        className={`${t.input} ${texto ? t.filled : ""}`}
        value={texto}
        rows={texto.length > 70 ? 3 : 2}
        placeholder={placeholder}
        onChange={e => { setTexto(e.target.value); if (estado === "erro") setEstado("ok"); }}
        onBlur={salvar}
        onKeyDown={e => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) ref.current?.blur();
          if (e.key === "Escape") { setTexto(valor ?? ""); ref.current?.blur(); }
        }}
        aria-label={ariaLabel}
      />
      <div className={t.meta}>
        {estado === "salvando" && <span>Salvando…</span>}
        {estado === "erro" && <span className={t.erro}>Não salvou — clique fora de novo para tentar</span>}
        {estado === "ok" && atualizadoEm && <span>Atualizado em {fmt(atualizadoEm)}</span>}
      </div>
    </div>
  );
}
