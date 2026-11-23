"use client";
import { useEffect, useRef, useState } from "react";
import t from "./funil.module.css";

export type Periodo = { de: string; ate: string };
const DIA = 86_400_000;
const mais = (iso: string, n: number) => new Date(Date.parse(iso) + n * DIA).toISOString().slice(0, 10);
const br = (iso: string) => iso.split("-").reverse().join("/");
const mesDe = (mes: string, n: number) => { const d = new Date(`${mes}-15T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 7); };
const nomeMes = (mes: string) => new Date(`${mes}-15T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });

// Calendário para escolher o período: um clique marca o começo, o segundo marca o fim.
export default function PeriodoCalendario({ valor, hoje, onMudar }: { valor: Periodo | null; hoje: string; onMudar: (p: Periodo | null) => void }) {
  const [aberto, setAberto] = useState(false);
  const [mes, setMes] = useState((valor?.ate ?? hoje).slice(0, 7));
  const [inicio, setInicio] = useState<string | null>(null);
  const [passando, setPassando] = useState<string | null>(null);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (!caixa.current?.contains(e.target as Node)) setAberto(false); };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", esc); };
  }, [aberto]);

  const abrir = () => { setAberto(a => !a); setInicio(null); setPassando(null); setMes((valor?.ate ?? hoje).slice(0, 7)); };
  const aplicar = (p: Periodo | null) => { onMudar(p); setAberto(false); setInicio(null); };
  const clicar = (dia: string) => {
    if (!inicio) { setInicio(dia); return; }
    aplicar(dia < inicio ? { de: dia, ate: inicio } : { de: inicio, ate: dia });
  };
  const atalhos: { l: string; p: Periodo }[] = [
    { l: "Hoje", p: { de: hoje, ate: hoje } },
    { l: "Ontem", p: { de: mais(hoje, -1), ate: mais(hoje, -1) } },
    { l: "Últimos 7 dias", p: { de: mais(hoje, -6), ate: hoje } },
    { l: "Últimos 30 dias", p: { de: mais(hoje, -29), ate: hoje } },
    { l: "Este mês", p: { de: `${hoje.slice(0, 7)}-01`, ate: hoje } },
    { l: "Mês passado", p: { de: `${mesDe(hoje.slice(0, 7), -1)}-01`, ate: mais(`${hoje.slice(0, 7)}-01`, -1) } },
  ];
  const faixa = inicio
    ? (() => { const f = passando ?? inicio; return f < inicio ? { de: f, ate: inicio } : { de: inicio, ate: f }; })()
    : valor;
  const primeiro = `${mes}-01`;
  const recuo = new Date(primeiro).getUTCDay(); // domingo = 0
  const total = new Date(Date.parse(`${mesDe(mes, 1)}-01`) - DIA).getUTCDate();
  const dias = Array.from({ length: total }, (_, i) => mais(primeiro, i));

  return (
    <div className={t.periodo} ref={caixa}>
      <button className={`${t.periodoBtn} ${valor ? t.periodoOn : ""}`} onClick={abrir} aria-expanded={aberto} aria-haspopup="dialog">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
        {valor ? (valor.de === valor.ate ? br(valor.de) : `${br(valor.de)} a ${br(valor.ate)}`) : "Data de preenchimento"}
      </button>
      {aberto && (
        <div className={t.cal} role="dialog" aria-label="Período de preenchimento">
          <div className={t.atalhos}>
            {atalhos.map(a => <button key={a.l} onClick={() => aplicar(a.p)} className={valor?.de === a.p.de && valor.ate === a.p.ate ? t.atalhoOn : ""}>{a.l}</button>)}
            {valor && <button onClick={() => aplicar(null)} className={t.atalhoLimpar}>Qualquer data</button>}
          </div>
          <div className={t.mesCal}>
            <div className={t.mesTopo}>
              <button onClick={() => setMes(m => mesDe(m, -1))} aria-label="Mês anterior">‹</button>
              <b>{nomeMes(mes)}</b>
              <button onClick={() => setMes(m => mesDe(m, 1))} disabled={mes >= hoje.slice(0, 7)} aria-label="Próximo mês">›</button>
            </div>
            <div className={t.grade} onMouseLeave={() => setPassando(null)}>
              {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => <span key={i} className={t.semana} aria-hidden="true">{d}</span>)}
              {dias.map((d, i) => {
                const dentro = faixa && d >= faixa.de && d <= faixa.ate;
                const ponta = faixa && (d === faixa.de || d === faixa.ate);
                return (
                  <button
                    key={d} style={i === 0 ? { gridColumnStart: recuo + 1 } : undefined} disabled={d > hoje}
                    className={`${t.diaCal} ${dentro ? t.dentro : ""} ${ponta ? t.ponta : ""} ${d === hoje ? t.hojeCal : ""}`}
                    onClick={() => clicar(d)} onMouseEnter={() => inicio && setPassando(d)} aria-label={br(d)} aria-pressed={!!dentro}
                  >{+d.slice(8)}</button>
                );
              })}
            </div>
            <p className={t.dica}>{inicio ? `Começa em ${br(inicio)}. Agora clique no último dia.` : "Clique no primeiro e no último dia."}</p>
          </div>
        </div>
      )}
    </div>
  );
}
