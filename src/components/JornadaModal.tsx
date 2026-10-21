"use client";
import { useEffect, useRef, useState } from "react";
import Jornada, { type Detalhe, diasEntre, fmt, hojeISO } from "./Jornada";
import m from "./JornadaModal.module.css";

const STATUS_CLS: Record<string, string> = {
  Ativo: m.bAtivo, "Em Andamento": m.bAtivo, "Em Renovação": m.bRenov, Encerrado: m.bEnc, Churn: m.bChurn,
};

export default function JornadaModal({
  id,
  onClose,
  onAbrirCadastro,
}: {
  id: string;
  onClose: () => void;
  onAbrirCadastro?: () => void;
}) {
  const [d, setD] = useState<Detalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const fecharRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/mentorados/${id}`, { cache: "no-store" })
      .then(async r => {
        if (!vivo) return;
        if (!r.ok) {
          setErro(r.status === 404 ? "Mentorada não encontrada." : "Não foi possível carregar a jornada. Recarregue a página.");
          return;
        }
        const json: Detalhe = await r.json();
        if (vivo) setD(json);
      })
      .catch(() => vivo && setErro("Sem conexão com o servidor. Verifique a internet e tente de novo."));
    return () => { vivo = false; };
  }, [id]);

  useEffect(() => {
    fecharRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const dias = d?.prazo ? diasEntre(hojeISO(), d.prazo) : null;

  return (
    <div className={m.backdrop} onClick={onClose}>
      <div
        className={m.modal}
        role="dialog"
        aria-modal="true"
        aria-label={d ? `Jornada de ${d.nome}` : "Jornada"}
        onClick={e => e.stopPropagation()}
      >
        <header className={m.header}>
          <div className={m.headMain}>
            <div className={m.eyebrow}>Jornada da mentorada</div>
            <div className={m.nome}>{d?.nome ?? (erro ? "Erro" : "Carregando…")}</div>
            {d && (
              <div className={m.meta}>
                <span className={`${m.badge} ${STATUS_CLS[d.status] ?? m.bEnc}`}>{d.status}</span>
                <span className={m.prog}>{d.tipo}</span>
                {d.area && <span className={m.area}>{d.area}</span>}
                <span className={m.periodo}>
                  {fmt(d.inicio)} → {fmt(d.prazo)}
                  {dias !== null && dias >= 0 && <em className={dias <= 30 ? m.urg : undefined}> · faltam {dias}d</em>}
                </span>
              </div>
            )}
          </div>
          <div className={m.headActions}>
            {onAbrirCadastro && d && (
              <button className={m.btnGhost} onClick={onAbrirCadastro}>Abrir cadastro</button>
            )}
            <button ref={fecharRef} className={m.close} onClick={onClose} aria-label="Fechar">✕</button>
          </div>
        </header>

        <div className={m.body}>
          {erro && <div className={m.empty}>{erro}</div>}
          {!d && !erro && <div className={m.skeleton}><div /><div /><div /><div /></div>}
          {d && (
            <>
              {d.negociacao && (
                <div className={m.negoc}>
                  <div className={m.negocLabel}>
                    Negociação de renovação{d.negociacaoEm && ` · atualizado em ${fmt(d.negociacaoEm)}`}
                  </div>
                  <div className={m.negocText}>{d.negociacao}</div>
                </div>
              )}
              <Jornada d={d} compacto />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
