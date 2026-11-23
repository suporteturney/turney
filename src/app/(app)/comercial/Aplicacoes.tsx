"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import PeriodoCalendario, { dataBr, nomePeriodo, type Periodo } from "@/components/PeriodoCalendario";
import type { ResumoAplicacoes } from "@/lib/comercial-aplicacoes";
import { FORM_HUB, FORM_PRE } from "@/lib/respondi";
import c from "./comercial.module.css";
import s from "./aplicacoes.module.css";

const SERIES = [
  { k: "quente", label: "Quentes", icone: "🔥", cor: "var(--a-quente)" },
  { k: "morno", label: "Mornos", icone: "🌤️", cor: "var(--a-morno)" },
  { k: "frio", label: "Frios", icone: "❄️", cor: "var(--a-frio)" },
  { k: "sem", label: "Sem classificação", icone: "", cor: "var(--a-sem)" },
] as const;
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
const fmt = (n: number) => n.toLocaleString("pt-BR");
const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const rotuloBalde = (k: string, passo: string) =>
  passo === "mes" ? `${MES[+k.slice(5, 7) - 1]}/${k.slice(2, 4)}` : `${k.slice(8)}/${k.slice(5, 7)}`;
const nomeBalde = (k: string, passo: string) =>
  passo === "mes" ? `${MES[+k.slice(5, 7) - 1]} de ${k.slice(0, 4)}` : passo === "semana" ? `Semana de ${dataBr(k)}` : dataBr(k);
// Topo da escala com meio inteiro: 4, 6, 8, 10, 20, 40, 60…
function topo(max: number) {
  if (max <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(max));
  return [1, 2, 4, 6, 8, 10].map(m => m * p).find(v => v >= max)!;
}

export default function Aplicacoes({ r, hoje, inicio }: { r: ResumoAplicacoes; hoje: string; inicio: string | null }) {
  const router = useRouter();
  const [foco, setFoco] = useState<number | null>(null);
  const [tabela, setTabela] = useState(false);
  const ir = (p: Periodo | null, form = r.form) => {
    const q = new URLSearchParams();
    const v = p ?? { de: `${hoje.slice(0, 7)}-01`, ate: hoje };
    q.set("de", v.de); q.set("ate", v.ate);
    if (form) q.set("form", form);
    router.replace(`/comercial?${q}`, { scroll: false });
  };
  const funil = (temp?: string) => `/comercial/funil?de=${r.de}&ate=${r.ate}${temp ? `&temp=${temp}` : ""}`;
  const quali = pct(r.temps.quente, r.total), qualiAntes = pct(r.anterior.quentes, r.anterior.total);
  const dif = (a: number, b: number, sufixo = "") => {
    if (!r.anterior.total && !b) return null;
    const d = a - b;
    return <small className={d > 0 ? s.sobe : d < 0 ? s.desce : ""}>{d > 0 ? "▲" : d < 0 ? "▼" : "="} {d ? `${fmt(Math.abs(d))}${sufixo}` : "igual"} <span>vs. período anterior</span></small>;
  };
  const max = topo(Math.max(1, ...r.serie.map(b => b.quente + b.morno + b.frio + b.sem)));
  const temSem = r.serie.some(b => b.sem > 0);
  const series = SERIES.filter(x => x.k !== "sem" || temSem);
  const maxOrigem = Math.max(1, ...r.origens.map(o => o.total));
  const passoNome = r.passo === "dia" ? "por dia" : r.passo === "semana" ? "por semana" : "por mês";

  return (
    <section className={`${c.bloco} ${s.bloco}`} aria-labelledby="aplic-titulo">
      <div className={s.topo}>
        <div>
          <h2 className={c.blocoTitulo} id="aplic-titulo">Aplicações dos formulários</h2>
          <p className={s.sub}>{nomePeriodo({ de: r.de, ate: r.ate }, hoje, inicio)} · {r.de === r.ate ? dataBr(r.de) : `${dataBr(r.de)} a ${dataBr(r.ate)}`}</p>
        </div>
        <div className={s.filtros}>
          <div className={s.forms} role="group" aria-label="Formulário">
            {[["", "Todos"], [FORM_HUB, "HUB"], [FORM_PRE, "Pré Mentoria"]].map(([k, l]) => (
              <button key={k} className={r.form === k ? s.formOn : ""} aria-pressed={r.form === k} onClick={() => ir({ de: r.de, ate: r.ate }, k)}>{l}</button>
            ))}
          </div>
          <PeriodoCalendario valor={{ de: r.de, ate: r.ate }} hoje={hoje} inicio={inicio} onMudar={p => ir(p)} limpar={false} alinhar="direita" />
        </div>
      </div>

      <div className={s.numeros}>
        <Link href={funil()} className={s.num}>
          <span className={s.numRot}>Aplicações</span>
          <strong className={c.num}>{fmt(r.total)}</strong>
          {dif(r.total, r.anterior.total)}
          {r.incompletas > 0 && <em>+ {fmt(r.incompletas)} {r.incompletas === 1 ? "pessoa começou" : "pessoas começaram"} e não terminou</em>}
        </Link>
        <Link href={funil("quente")} className={`${s.num} ${s.numDestaque}`}>
          <span className={s.numRot}>Qualificados</span>
          <strong className={c.num}>{quali}%</strong>
          {dif(quali, qualiAntes, " p.p.")}
          <em>{fmt(r.temps.quente)} quentes de {fmt(r.total)} aplicações</em>
        </Link>
        {SERIES.slice(0, 3).map(x => (
          <Link key={x.k} href={funil(x.k)} className={s.num}>
            <span className={s.numRot}><i style={{ background: x.cor }} aria-hidden="true" />{x.icone} {x.label}</span>
            <strong className={c.num}>{fmt(r.temps[x.k])}</strong>
            <em>{pct(r.temps[x.k], r.total)}% das aplicações</em>
          </Link>
        ))}
      </div>

      {r.total === 0 ? (
        <p className={c.vazio}>Nenhuma aplicação nesse período{r.form ? ` no forms ${r.form}` : ""}. Os formulários chegam pelo Respondi (Administração › Formulários).</p>
      ) : (
        <div className={s.grade}>
          <div className={s.grafico}>
            <div className={s.graficoTopo}>
              <h3 className={c.subTitulo}>Aplicações {passoNome}</h3>
              <div className={s.legenda} aria-label="Legenda">
                {series.map(x => <span key={x.k}><i style={{ background: x.cor }} aria-hidden="true" />{x.label}</span>)}
              </div>
            </div>
            <div className={s.plot} onMouseLeave={() => setFoco(null)}>
              <div className={s.eixo} aria-hidden="true">
                {[max, max / 2, 0].map(v => <span key={v}>{fmt(v)}</span>)}
              </div>
              <div className={s.area}>
                <div className={s.linhas} aria-hidden="true"><i /><i /><i /></div>
                <div className={s.colunas} style={{ gridTemplateColumns: `repeat(${r.serie.length}, minmax(${r.serie.length > 40 ? 8 : 14}px, 1fr))` }}>
                  {r.serie.map((b, i) => {
                    const tot = b.quente + b.morno + b.frio + b.sem;
                    const pilha = series.filter(x => b[x.k] > 0);
                    return (
                      <div
                        key={b.k} className={`${s.col} ${foco === i ? s.colFoco : ""}`} tabIndex={0}
                        aria-label={`${nomeBalde(b.k, r.passo)}: ${tot} aplicações, ${b.quente} quentes, ${b.morno} mornos, ${b.frio} frios`}
                        onMouseEnter={() => setFoco(i)} onFocus={() => setFoco(i)} onBlur={() => setFoco(null)}
                      >
                        <div className={s.pilha} style={{ height: `${(tot / max) * 100}%` }}>
                          {[...pilha].reverse().map(x => <span key={x.k} style={{ flexGrow: b[x.k], background: x.cor }} />)}
                        </div>
                        {foco === i && (
                          <div className={`${s.dica} ${i > r.serie.length * 0.6 ? s.dicaEsq : ""}`} role="tooltip">
                            <b>{nomeBalde(b.k, r.passo)}</b>
                            <span className={s.dicaTotal}><strong>{tot}</strong> aplicações</span>
                            {series.map(x => <span key={x.k} className={s.dicaLinha}><i style={{ background: x.cor }} /><strong>{b[x.k]}</strong> {x.label.toLowerCase()}</span>)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className={s.rotulos} aria-hidden="true" style={{ gridTemplateColumns: `repeat(${r.serie.length}, minmax(0, 1fr))` }}>
                  {r.serie.map((b, i) => {
                    const cada = Math.ceil(r.serie.length / 8);
                    return <span key={b.k}>{i % cada === 0 || i === r.serie.length - 1 ? rotuloBalde(b.k, r.passo) : ""}</span>;
                  })}
                </div>
              </div>
            </div>
            <button className={s.verTabela} onClick={() => setTabela(t => !t)} aria-expanded={tabela}>{tabela ? "Esconder tabela" : "Ver em tabela"}</button>
            {tabela && (
              <div className={c.tabelaWrap}>
                <table className={c.tabela}>
                  <thead><tr><th>{r.passo === "dia" ? "Dia" : r.passo === "semana" ? "Semana de" : "Mês"}</th><th className={c.direita}>Aplicações</th>{series.map(x => <th key={x.k} className={c.direita}>{x.label}</th>)}</tr></thead>
                  <tbody>{r.serie.map(b => (
                    <tr key={b.k}><td>{nomeBalde(b.k, r.passo).replace("Semana de ", "")}</td><td className={`${c.direita} ${c.num}`}>{b.quente + b.morno + b.frio + b.sem}</td>{series.map(x => <td key={x.k} className={`${c.direita} ${c.num}`}>{b[x.k]}</td>)}</tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>

          <div className={s.lado}>
            <h3 className={c.subTitulo}>De onde vieram</h3>
            <ol className={s.origens}>
              {r.origens.slice(0, 12).map(o => (
                <li key={o.nome}>
                  <div className={s.origemTopo}>
                    <b>{o.nome}</b>
                    <span className={c.num}>{fmt(o.total)} <small>· {pct(o.total, r.total)}%</small></span>
                  </div>
                  <div className={s.trilho}><span style={{ width: `${(o.total / maxOrigem) * 100}%` }} /></div>
                  <small className={s.origemQuali}>{fmt(o.quentes)} {o.quentes === 1 ? "qualificado" : "qualificados"} · {pct(o.quentes, o.total)}% de quentes</small>
                </li>
              ))}
            </ol>
            {r.origens.length > 12 && <p className={c.nota}>+ {r.origens.length - 12} outras origens com poucas aplicações.</p>}
            {!r.form && (
              <>
                <h3 className={c.subTitulo} style={{ marginTop: 16 }}>Por formulário</h3>
                <ul className={s.forms2}>
                  {r.porForm.map(f => (
                    <li key={f.formulario}>
                      <b>Forms {f.formulario}</b>
                      <span className={c.num}>{fmt(f.total)}</span>
                      <small>{pct(f.quentes, f.total)}% qualificados</small>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
