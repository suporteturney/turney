"use client";
import { useMemo, useState } from "react";
import { SETORES, gerarInsights, type Insight, type MentoradaInsight, type Setor } from "@/lib/insights";
import styles from "../shared.module.css";
import f from "../filtros.module.css";
import s from "./insights.module.css";

const CONF: Record<Insight["confianca"], { label: string; dica: string }> = {
  alta: { label: "Confiança alta", dica: "Grupos comparados com 30 ou mais mentoradas" },
  media: { label: "Confiança média", dica: "Grupos com 10 a 29 mentoradas — tendência a confirmar" },
  baixa: { label: "Indício", dica: "Amostra pequena (menos de 10) — use como pista, não como regra" },
  "sem-dados": { label: "Aguardando dados", dica: "Ainda não há dados para esta análise" },
};
const casaTipo = (tipo: string, filtro: string) => tipo === filtro || tipo.startsWith(`${filtro} `);
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

export default function InsightsCliente({ base, atualizadoEm }: { base: MentoradaInsight[]; atualizadoEm: string | null }) {
  const [setor, setSetor] = useState<Setor | "">("");
  const [filtTipo, setFiltTipo] = useState("");
  const [ano, setAno] = useState("");
  const [copiado, setCopiado] = useState<string | null>(null);

  const tipos = useMemo(() => {
    const set = [...new Set(base.map(m => m.tipo).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    const grupos = [...new Set(set.filter(t => / \d+$/.test(t)).map(t => t.replace(/ \d+$/, "")))];
    return { set, grupos };
  }, [base]);
  const anos = useMemo(() => [...new Set(base.map(m => m.inicio?.slice(0, 4)).filter(Boolean) as string[])].sort().reverse(), [base]);

  const recorte = useMemo(
    () => base.filter(m => (!filtTipo || casaTipo(m.tipo, filtTipo)) && (!ano || m.inicio?.startsWith(ano))),
    [base, filtTipo, ano]
  );
  const insights = useMemo(() => gerarInsights(recorte), [recorte]);
  const visiveis = setor ? insights.filter(i => i.setor === setor) : insights;
  const porSetor = (k: Setor) => insights.filter(i => i.setor === k && i.confianca !== "sem-dados").length;
  const destaques = insights.filter(i => i.confianca === "alta" && i.setor !== "dados").slice(0, 3);

  async function copiar(i: Insight) {
    const texto = `${i.titulo}\n\n${i.achado}\n\nO que fazer: ${i.acao}\n\n(${CONF[i.confianca].label} · Central de Insights Turney)`;
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(i.id);
      window.setTimeout(() => setCopiado(c => (c === i.id ? null : c)), 2000);
    } catch {
      window.prompt("Copie o insight:", texto);
    }
  }

  return (
    <>
      <div className={styles.topbar}>
        <div>
          <div className={styles.pageTitle}>Insights</div>
          <div className={styles.pageSub}>Central de inteligência — cruza perfil, jornada, presença, renovação e origem das mentoradas</div>
        </div>
        <span className={s.atualizado}>Recalculada com os dados de agora · última alteração na base: {fmt(atualizadoEm)}</span>
      </div>

      <div className={styles.content}>
        <div className={f.bar}>
          <select className={f.select} value={filtTipo} onChange={e => setFiltTipo(e.target.value)} aria-label="Filtrar por programa">
            <option value="">Todos os programas</option>
            {tipos.grupos.map(g => <option key={`g-${g}`} value={g}>{g} (todos)</option>)}
            {tipos.set.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className={f.select} value={ano} onChange={e => setAno(e.target.value)} aria-label="Ano de entrada">
            <option value="">Entraram em qualquer ano</option>
            {anos.map(a => <option key={a} value={a}>Entraram em {a}</option>)}
          </select>
          {(filtTipo || ano) && <button className={f.clear} onClick={() => { setFiltTipo(""); setAno(""); }}>Limpar filtros</button>}
          <span className={f.count}>analisando {recorte.length} mentoradas</span>
        </div>

        {destaques.length > 0 && !setor && (
          <div className={s.destaques}>
            <div className={s.destaquesTitulo}>Principais descobertas agora</div>
            <div className={s.destaquesGrid}>
              {destaques.map(i => (
                <button key={i.id} className={s.destaque} onClick={() => document.getElementById(`ins-${i.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}>
                  <span className={s.destaqueSetor}>{SETORES.find(x => x.k === i.setor)?.label}</span>
                  <span className={s.destaqueTexto}>{i.achado}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={s.abas} role="tablist" aria-label="Setor">
          <button role="tab" aria-selected={!setor} className={!setor ? s.abaOn : ""} onClick={() => setSetor("")}>
            Todos <em>{insights.length}</em>
          </button>
          {SETORES.map(x => (
            <button key={x.k} role="tab" aria-selected={setor === x.k} className={setor === x.k ? s.abaOn : ""} onClick={() => setSetor(x.k)}>
              {x.label} <em>{x.k === "dados" ? "!" : porSetor(x.k)}</em>
            </button>
          ))}
        </div>

        <div className={s.lista}>
          {visiveis.map(i => <Cartao key={i.id} i={i} copiado={copiado === i.id} onCopiar={() => copiar(i)} />)}
        </div>

        <p className={s.rodape}>
          Como funciona: a cada acesso a central recalcula tudo com os dados atuais do painel — cadastros, etapas, renovações, presenças e
          varreduras. Quanto mais campos preenchidos, mais cruzamentos aparecem e maior a confiança. A confiança indica o tamanho dos
          grupos comparados; correlação não é causa, então use os indícios para investigar e testar.
        </p>
      </div>
    </>
  );
}

function Cartao({ i, copiado, onCopiar }: { i: Insight; copiado: boolean; onCopiar: () => void }) {
  const max = Math.max(1, ...i.linhas.map(l => l.valor ?? 0));
  const setor = SETORES.find(x => x.k === i.setor)?.label;
  return (
    <article id={`ins-${i.id}`} className={`${s.cartao} ${s[`c_${i.confianca.replace("-", "")}`]}`}>
      <header className={s.cHead}>
        <div className={s.cTags}>
          <span className={`${s.setor} ${s[`s_${i.setor}`]}`}>{setor}</span>
          <span className={s.conf} title={CONF[i.confianca].dica}>{CONF[i.confianca].label}</span>
        </div>
        <button className={s.copiar} onClick={onCopiar}>{copiado ? "Copiado ✓" : "Copiar para o time"}</button>
      </header>
      <h3 className={s.cTitulo}>{i.titulo}</h3>
      <p className={s.cAchado}>{i.achado}</p>
      {i.linhas.length > 0 && i.confianca !== "sem-dados" && (
        <div className={s.barras}>
          {i.linhas.map((l, k) => (
            <div key={k} className={`${s.barra} ${l.destaque ? s[`b_${l.destaque}`] : ""}`}>
              <span className={s.bLabel}>{l.label}</span>
              {l.valor !== null ? (
                <span className={s.bTrack}><i style={{ width: `${(l.valor / max) * 100}%` }} /></span>
              ) : <span className={s.bTrack} />}
              <span className={s.bValor}>
                {l.valor !== null ? `${l.valor}%` : ""}
                <small>{l.valor !== null ? (l.sufixo ?? "").replace(/^%\s?/, "") : ""}{l.n ? ` · n=${l.n}` : ""}</small>
              </span>
            </div>
          ))}
        </div>
      )}
      <div className={s.acao}>
        <strong>O que fazer</strong>
        <span>{i.acao}</span>
      </div>
    </article>
  );
}
