"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PeriodoCalendario, { dataBr, nomePeriodo, type Periodo } from "@/components/PeriodoCalendario";
import { TEMAS, type Citacao, type Inteligencia, type Pergunta } from "@/lib/inteligencia";
import { FORM_HUB, FORM_PRE, NOME_TEMP } from "@/lib/respondi";
import styles from "../../shared.module.css";
import c from "../comercial.module.css";
import s from "./inteligencia.module.css";

type Totais = { pessoas: number; quente: number; morno: number; frio: number; comprou: number };
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
const fmt = (n: number) => n.toLocaleString("pt-BR");
const SEGS = [
  { k: "", label: "Todos" }, { k: "quente", label: "🔥 Quentes" }, { k: "morno", label: "🌤️ Mornos" }, { k: "frio", label: "❄️ Frios" }, { k: "comprou", label: "💰 Compraram" },
] as const;
const NOME_SEG: Record<string, string> = { "": "todas as pessoas", quente: "os quentes", morno: "os mornos", frio: "os frios", comprou: "quem comprou" };

export default function InteligenciaCliente({ r, hoje, inicio, de, ate, form, seg, totais }: {
  r: Inteligencia; hoje: string; inicio: string | null; de: string; ate: string; form: string; seg: string; totais: Totais;
}) {
  const router = useRouter();
  const ir = (mud: { de?: string; ate?: string; form?: string; seg?: string }) => {
    const v = { de, ate, form, seg, ...mud };
    const q = new URLSearchParams({ de: v.de, ate: v.ate });
    if (v.form) q.set("form", v.form);
    if (v.seg) q.set("seg", v.seg);
    router.replace(`/comercial/inteligencia?${q}`, { scroll: false });
  };
  const escolhas = r.perguntas.filter(p => p.tipo === "escolha");
  const abertas = r.perguntas.filter(p => p.tipo !== "escolha");
  const comVendas = totais.comprou > 0;
  const mediaQ = pct(r.quentes, r.base);

  return (
    <>
      <div className={styles.topbar}>
        <div>
          <div className={styles.pageTitle}>Inteligência comercial</div>
          <div className={styles.pageSub}>O que os formulários contam sobre quem chega até a Turney: perfil, desejos, dificuldades e onde desistem</div>
        </div>
      </div>
      <div className={styles.content}>
        <div className={s.filtros}>
          <PeriodoCalendario valor={{ de, ate }} hoje={hoje} inicio={inicio} onMudar={p => p && ir(p as Periodo)} limpar={false} />
          <div className={s.grupo} role="group" aria-label="Formulário">
            {[["", "Todos os forms"], [FORM_HUB, "HUB"], [FORM_PRE, "Pré Mentoria"]].map(([k, l]) => (
              <button key={k} className={form === k ? s.on : ""} aria-pressed={form === k} onClick={() => ir({ form: k })}>{l}</button>
            ))}
          </div>
          <div className={s.grupo} role="group" aria-label="Quem analisar">
            {SEGS.map(x => {
              const n = x.k === "" ? totais.pessoas : totais[x.k];
              return <button key={x.k} className={seg === x.k ? s.on : ""} aria-pressed={seg === x.k} onClick={() => ir({ seg: x.k })} disabled={x.k !== "" && !n}>{x.label} <b>{fmt(n)}</b></button>;
            })}
          </div>
        </div>
        <p className={s.resumo}>
          {nomePeriodo({ de, ate }, hoje, inicio)} ({de === ate ? dataBr(de) : `${dataBr(de)} a ${dataBr(ate)}`}) · analisando <b>{NOME_SEG[seg]}</b>{form ? ` do forms ${form}` : ""}: {fmt(r.base)} {r.base === 1 ? "pessoa" : "pessoas"}, {fmt(r.completas)} terminaram o formulário.
          {!comVendas && " Quando as vendas forem registradas no funil, aparece também quanto cada perfil compra."}
        </p>

        {r.base === 0 ? (
          <div className={c.bloco}><p className={c.vazio}>Nenhum preenchimento nesse período. Os formulários chegam pelo Respondi; os antigos entram pela importação em Administração › Formulários.</p></div>
        ) : (
          <>
            <div className={s.topo}>
              {r.destaques.length > 0 && (
                <section className={`${c.bloco} ${s.destaques}`}>
                  <h2 className={c.blocoTitulo}>O que chama atenção</h2>
                  <ul>{r.destaques.map(d => <li key={d}>{d}</li>)}</ul>
                </section>
              )}
              {r.abandono.length > 0 && (
                <section className={c.bloco}>
                  <h2 className={c.blocoTitulo}>Onde as pessoas desistem</h2>
                  <p className={s.nota}>Para quem começou e não terminou: a pergunta em que parou (a seguinte à última respondida).</p>
                  <ol className={s.barras}>
                    {r.abandono.map(a => (
                      <li key={a.pergunta}>
                        <div className={s.barraTopo}><span>{a.pergunta}</span><b className={c.num}>{fmt(a.n)}</b></div>
                        <div className={s.trilho}><span className={s.alerta} style={{ width: `${pct(a.n, r.abandono[0].n)}%` }} /></div>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
            </div>

            <h2 className={s.secao}>Perfil <small>respostas de múltipla escolha</small></h2>
            <div className={s.cartoes}>
              {escolhas.map(p => <CartaoEscolha key={p.id} p={p} comVendas={comVendas} mediaQ={mediaQ} seg={seg} />)}
            </div>

            <h2 className={s.secao}>Nas palavras deles <small>o que as pessoas escrevem</small></h2>
            <div className={s.abertas}>
              {abertas.map(p => <CartaoAberta key={p.id} p={p} comVendas={comVendas} seg={seg} />)}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function Linha({ nome, n, total, quentes, compraram, comVendas, seg, max }: {
  nome: string; n: number; total: number; quentes: number; compraram: number; comVendas: boolean; seg: string; max: number;
}) {
  return (
    <li>
      <div className={s.barraTopo}>
        <span title={nome}>{nome}</span>
        <b className={c.num}>{pct(n, total)}% <small>({fmt(n)})</small></b>
      </div>
      <div className={s.trilho}><span style={{ width: `${(n / max) * 100}%` }} /></div>
      {(!seg || comVendas) && (
        <small className={s.cruza}>
          {!seg && <>🔥 {pct(quentes, n)}% quentes</>}
          {comVendas && <>{!seg && " · "}💰 {pct(compraram, n)}% compraram</>}
        </small>
      )}
    </li>
  );
}

function CartaoEscolha({ p, comVendas, mediaQ, seg }: { p: Pergunta; comVendas: boolean; mediaQ: number; seg: string }) {
  const max = Math.max(1, ...p.opcoes.map(o => o.n));
  const melhor = !seg ? [...p.opcoes].filter(o => o.n >= Math.max(5, p.respondidas * 0.05)).sort((a, b) => pct(b.quentes, b.n) - pct(a.quentes, a.n))[0] : null;
  return (
    <section className={`${c.bloco} ${s.cartao}`}>
      <h3 className={s.pergunta} title={p.completo}>{p.titulo}</h3>
      <p className={s.nota}>{fmt(p.respondidas)} responderam{p.formularios.length === 1 ? ` · forms ${p.formularios[0]}` : ""}</p>
      <ul className={s.barras}>
        {p.opcoes.map(o => <Linha key={o.nome} nome={o.nome} n={o.n} total={p.respondidas} quentes={o.quentes} compraram={o.compraram} comVendas={comVendas} seg={seg} max={max} />)}
      </ul>
      {p.outras > 0 && <p className={s.nota} style={{ marginTop: 8 }}>+ {fmt(p.outras)} com outras respostas.</p>}
      {melhor && pct(melhor.quentes, melhor.n) >= mediaQ + 10 && (
        <p className={s.sinal}>Mais quentes: <b>{melhor.nome}</b> ({pct(melhor.quentes, melhor.n)}%, média {mediaQ}%)</p>
      )}
    </section>
  );
}

function CartaoAberta({ p, comVendas, seg }: { p: Pergunta; comVendas: boolean; seg: string }) {
  const [busca, setBusca] = useState("");
  const [tema, setTema] = useState("");
  const [qtd, setQtd] = useState(6);
  const [verGrupos, setVerGrupos] = useState(p.tipo === "curta" && !p.temas.length);
  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    return p.citacoes.filter(x => (!tema || x.temas.includes(tema)) && (!q || x.texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(q)));
  }, [p.citacoes, busca, tema]);
  const maxT = Math.max(1, ...p.temas.map(t => t.n));
  const maxO = Math.max(1, ...p.opcoes.map(o => o.n));
  const nomeTema = TEMAS.find(t => t.k === tema)?.label;

  return (
    <section className={`${c.bloco} ${s.aberta}`}>
      <div className={s.abertaTopo}>
        <div>
          <h3 className={s.pergunta} title={p.completo}>{p.titulo}</h3>
          <p className={s.nota}>{fmt(p.respondidas)} responderam{p.formularios.length === 1 ? ` · forms ${p.formularios[0]}` : ""}</p>
        </div>
        {p.temas.length > 0 && p.opcoes.length > 0 && (
          <div className={s.grupo} role="tablist" aria-label="Ver por">
            <button role="tab" aria-selected={!verGrupos} className={!verGrupos ? s.on : ""} onClick={() => setVerGrupos(false)}>Temas</button>
            <button role="tab" aria-selected={verGrupos} className={verGrupos ? s.on : ""} onClick={() => setVerGrupos(true)}>Respostas iguais</button>
          </div>
        )}
      </div>
      <div className={s.abertaGrade}>
        <div>
          {!verGrupos && p.temas.length > 0 && (
            <>
              <h4 className={c.subTitulo}>Temas mais citados <span className={s.dica}>clique para ler as respostas</span></h4>
              <ul className={s.barras}>
                {p.temas.slice(0, 10).map(t => (
                  <li key={t.k} className={`${s.clicavel} ${tema === t.k ? s.temaOn : ""}`}>
                    <button onClick={() => { setTema(tema === t.k ? "" : t.k); setQtd(6); }} aria-pressed={tema === t.k}>
                      <div className={s.barraTopo}><span>{t.nome}</span><b className={c.num}>{pct(t.n, p.respondidas)}% <small>({fmt(t.n)})</small></b></div>
                      <div className={s.trilho}><span style={{ width: `${(t.n / maxT) * 100}%` }} /></div>
                      {(!seg || comVendas) && <small className={s.cruza}>{!seg && <>🔥 {pct(t.quentes, t.n)}% quentes</>}{comVendas && <>{!seg && " · "}💰 {pct(t.compraram, t.n)}% compraram</>}</small>}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {(verGrupos || !p.temas.length) && p.opcoes.length > 0 && (
            <>
              <h4 className={c.subTitulo}>Respostas mais comuns <span className={s.dica}>parecidas foram juntadas</span></h4>
              <ul className={s.barras}>
                {p.opcoes.map(o => <Linha key={o.nome} nome={o.nome} n={o.n} total={p.respondidas} quentes={o.quentes} compraram={o.compraram} comVendas={comVendas} seg={seg} max={maxO} />)}
              </ul>
              {p.outras > 0 && <p className={s.nota}>+ {fmt(p.outras)} respostas diferentes de todas as outras.</p>}
            </>
          )}
          {p.termos.length > 0 && (
            <>
              <h4 className={c.subTitulo} style={{ marginTop: 14 }}>Palavras e expressões <span className={s.dica}>clique para buscar</span></h4>
              <div className={s.termos}>
                {p.termos.map(t => (
                  <button key={t.termo} className={busca === t.termo ? s.termoOn : ""} onClick={() => { setBusca(busca === t.termo ? "" : t.termo); setQtd(6); }} style={{ fontSize: `${11 + Math.min(4, Math.round((t.n / p.termos[0].n) * 4))}px` }}>
                    {t.termo} <small>{t.n}</small>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <div className={s.citacoes}>
          <div className={s.buscaLinha}>
            <input type="search" value={busca} onChange={e => { setBusca(e.target.value); setQtd(6); }} placeholder="Buscar nas respostas" aria-label={`Buscar nas respostas de: ${p.titulo}`} />
            {(tema || busca) && <button className={c.btnMini} onClick={() => { setTema(""); setBusca(""); }}>Limpar</button>}
          </div>
          <p className={s.nota}>
            {fmt(filtradas.length)} {filtradas.length === 1 ? "resposta" : "respostas"}{nomeTema ? ` sobre “${nomeTema}”` : ""}{busca ? ` com “${busca}”` : ""}
            {p.citacoes.length < p.respondidas && !tema && !busca ? ` (as ${fmt(p.citacoes.length)} mais recentes)` : ""}
          </p>
          <ul className={s.falas}>
            {filtradas.slice(0, qtd).map((x, i) => <Fala key={`${x.leadId}-${i}`} x={x} />)}
          </ul>
          {filtradas.length > qtd && <button className={c.btnMini} onClick={() => setQtd(q => q + 10)}>Mostrar mais ({fmt(filtradas.length - qtd)})</button>}
        </div>
      </div>
    </section>
  );
}

function Fala({ x }: { x: Citacao }) {
  return (
    <li>
      <p>“{x.texto}”</p>
      <small>
        <Link href={`/comercial/funil?lead=${x.leadId}`}>{x.nome}</Link>
        {x.temperatura && <> · {NOME_TEMP[x.temperatura]}</>}
        {x.comprou && <> · 💰 comprou</>}
        {" · "}{new Date(x.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" })} · forms {x.formulario}
      </small>
    </li>
  );
}
