"use client";
import { useEffect, useRef, useState } from "react";
import s from "./PeriodoCalendario.module.css";

// Escolha de período: atalhos à esquerda, datas digitáveis em cima e dois meses lado a lado.
// Um clique marca o começo, o segundo marca o fim.
export type Periodo = { de: string; ate: string };
const DIA = 86_400_000;
export const somarDias = (iso: string, n: number) => new Date(Date.parse(iso) + n * DIA).toISOString().slice(0, 10);
export const dataBr = (iso: string) => iso.split("-").reverse().join("/");
const mesDe = (mes: string, n: number) => { const d = new Date(`${mes}-15T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 7); };
const nomeMes = (mes: string) => new Date(`${mes}-15T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).replace(" de ", " ");
const DATA = /^\d{4}-\d{2}-\d{2}$/;

export function atalhos(hoje: string, inicio?: string | null): { l: string; p: Periodo }[] {
  const mes = hoje.slice(0, 7);
  const tri = `${hoje.slice(0, 5)}${String(Math.floor((+hoje.slice(5, 7) - 1) / 3) * 3 + 1).padStart(2, "0")}-01`;
  return [
    { l: "Hoje", p: { de: hoje, ate: hoje } },
    { l: "Ontem", p: { de: somarDias(hoje, -1), ate: somarDias(hoje, -1) } },
    { l: "Últimos 7 dias", p: { de: somarDias(hoje, -6), ate: hoje } },
    { l: "Últimos 30 dias", p: { de: somarDias(hoje, -29), ate: hoje } },
    { l: "Últimos 3 meses", p: { de: `${mesDe(mes, -2)}-01`, ate: hoje } },
    { l: "Últimos 12 meses", p: { de: `${mesDe(mes, -11)}-01`, ate: hoje } },
    { l: "Esse mês até a data", p: { de: `${mes}-01`, ate: hoje } },
    { l: "Mês passado", p: { de: `${mesDe(mes, -1)}-01`, ate: somarDias(`${mes}-01`, -1) } },
    { l: "Esse trimestre até a data", p: { de: tri, ate: hoje } },
    { l: "Esse ano até a data", p: { de: `${hoje.slice(0, 4)}-01-01`, ate: hoje } },
    ...(inicio && inicio < hoje ? [{ l: "Desde o início", p: { de: inicio, ate: hoje } }] : []),
  ];
}
export function nomePeriodo(p: Periodo, hoje: string, inicio?: string | null) {
  const a = atalhos(hoje, inicio).find(x => x.p.de === p.de && x.p.ate === p.ate);
  if (a) return a.l;
  return p.de === p.ate ? dataBr(p.de) : `${dataBr(p.de)} a ${dataBr(p.ate)}`;
}

export default function PeriodoCalendario({ valor, hoje, inicio, onMudar, rotulo = "Data de preenchimento", limpar = true, alinhar = "esquerda" }: {
  valor: Periodo | null; hoje: string; inicio?: string | null; onMudar: (p: Periodo | null) => void;
  rotulo?: string; limpar?: boolean; alinhar?: "esquerda" | "direita";
}) {
  const [aberto, setAberto] = useState(false);
  const [mes, setMes] = useState((valor?.ate ?? hoje).slice(0, 7));
  const [inicioSel, setInicioSel] = useState<string | null>(null);
  const [passando, setPassando] = useState<string | null>(null);
  const [txt, setTxt] = useState({ de: valor?.de ?? "", ate: valor?.ate ?? "" });
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (!caixa.current?.contains(e.target as Node)) setAberto(false); };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", esc); };
  }, [aberto]);

  const abrir = () => {
    setAberto(a => !a); setInicioSel(null); setPassando(null);
    setMes((valor?.ate ?? hoje).slice(0, 7)); setTxt({ de: valor?.de ?? "", ate: valor?.ate ?? "" });
  };
  const aplicar = (p: Periodo | null) => { onMudar(p); setAberto(false); setInicioSel(null); };
  const clicar = (dia: string) => {
    if (!inicioSel) { setInicioSel(dia); setTxt({ de: dia, ate: "" }); return; }
    aplicar(dia < inicioSel ? { de: dia, ate: inicioSel } : { de: inicioSel, ate: dia });
  };
  // Datas digitadas: aplica quando as duas estão completas e em ordem.
  const digitar = (k: "de" | "ate", v: string) => {
    const n = { ...txt, [k]: v };
    setTxt(n);
    if (DATA.test(n.de) && DATA.test(n.ate) && n.de <= n.ate && n.ate <= hoje) { onMudar({ de: n.de, ate: n.ate }); setMes(n.ate.slice(0, 7)); setInicioSel(null); }
  };
  const faixa = inicioSel
    ? (() => { const f = passando ?? inicioSel; return f < inicioSel ? { de: f, ate: inicioSel } : { de: inicioSel, ate: f }; })()
    : valor;

  const mesCal = (m: string, primeiroDaDupla: boolean) => {
    const primeiro = `${m}-01`;
    const recuo = new Date(primeiro).getUTCDay(); // domingo = 0
    const total = new Date(Date.parse(`${mesDe(m, 1)}-01`) - DIA).getUTCDate();
    return (
      <div className={`${s.mes} ${primeiroDaDupla ? s.mesAnterior : ""}`}>
        <div className={s.mesTopo}>
          {primeiroDaDupla || <button className={`${s.seta} ${s.setaCel}`} onClick={() => setMes(x => mesDe(x, -1))} aria-label="Mês anterior">‹</button>}
          {primeiroDaDupla && <button className={s.seta} onClick={() => setMes(x => mesDe(x, -1))} aria-label="Mês anterior">‹</button>}
          <b>{nomeMes(m)}</b>
          {!primeiroDaDupla && <button className={s.seta} onClick={() => setMes(x => mesDe(x, 1))} disabled={m >= hoje.slice(0, 7)} aria-label="Próximo mês">›</button>}
          {primeiroDaDupla && <span className={s.setaVazia} />}
        </div>
        <div className={s.grade} onMouseLeave={() => setPassando(null)}>
          {["dom", "seg", "ter", "qua", "qui", "sex", "sáb"].map(d => <span key={d} className={s.semana} aria-hidden="true">{d}</span>)}
          {Array.from({ length: total }, (_, i) => somarDias(primeiro, i)).map((d, i) => {
            const dentro = !!faixa && d >= faixa.de && d <= faixa.ate;
            const ponta = !!faixa && (d === faixa.de || d === faixa.ate);
            const dow = (recuo + i) % 7;
            return (
              <button
                key={d} style={i === 0 ? { gridColumnStart: recuo + 1 } : undefined} disabled={d > hoje}
                className={`${s.dia} ${dentro ? s.dentro : ""} ${dentro && (dow === 0 || d === faixa!.de) ? s.iniLinha : ""} ${dentro && (dow === 6 || d === faixa!.ate) ? s.fimLinha : ""} ${ponta ? s.ponta : ""} ${d === hoje ? s.hoje : ""}`}
                onClick={() => clicar(d)} onMouseEnter={() => inicioSel && setPassando(d)} aria-label={dataBr(d)} aria-pressed={dentro}
              ><span>{+d.slice(8)}</span></button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className={s.periodo} ref={caixa}>
      <button className={`${s.botao} ${valor ? s.botaoOn : ""}`} onClick={abrir} aria-expanded={aberto} aria-haspopup="dialog">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
        {valor ? nomePeriodo(valor, hoje, inicio) : rotulo}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {aberto && (
        <div className={`${s.cal} ${alinhar === "direita" ? s.direita : ""}`} role="dialog" aria-label="Escolher período">
          <div className={s.atalhos}>
            {atalhos(hoje, inicio).map(a => (
              <button key={a.l} onClick={() => aplicar(a.p)} className={valor?.de === a.p.de && valor.ate === a.p.ate ? s.atalhoOn : ""}>{a.l}</button>
            ))}
          </div>
          <div className={s.direitaCal}>
            <div className={s.datas}>
              <input type="date" value={txt.de} max={hoje} onChange={e => digitar("de", e.target.value)} aria-label="Data inicial" />
              <span aria-hidden="true">–</span>
              <input type="date" value={txt.ate} max={hoje} onChange={e => digitar("ate", e.target.value)} aria-label="Data final" />
            </div>
            <div className={s.meses}>
              {mesCal(mesDe(mes, -1), true)}
              {mesCal(mes, false)}
            </div>
            <p className={s.dica}>{inicioSel ? `Começa em ${dataBr(inicioSel)}. Agora clique no último dia.` : "Clique no primeiro e no último dia, ou digite as datas."}</p>
            {limpar && valor && <button className={s.limpar} onClick={() => aplicar(null)}>Limpar filtro</button>}
          </div>
        </div>
      )}
    </div>
  );
}
