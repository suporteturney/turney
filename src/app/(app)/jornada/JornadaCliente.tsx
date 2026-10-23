"use client";
import { useMemo, useState } from "react";
import JornadaModal from "@/components/JornadaModal";
import { type CampoEtapa, type Etapa, dataEtapa, diasEntre, etapaFields, fmt, inicioCiclo } from "@/components/Jornada";
import styles from "../shared.module.css";
import f from "../filtros.module.css";

type Linha = {
  id: string; nome: string; tipo: string; status: string; inicio: string | null; codigo: string | null;
  vagaData: string | null; etapas: Etapa[];
  renovacoes: { acao: string; destino: string; data: string }[];
};

const ORDEM = ["onboarding", "devolutiva", "sessao", "correcao", "analise", "entrevista", "aprovacao"];
const casaTipo = (tipo: string, filtro: string) => tipo === filtro || tipo.startsWith(`${filtro} `);
const media = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

export default function JornadaCliente({ data }: { data: Linha[] }) {
  const [filtTipo, setFiltTipo] = useState("");
  const [filtStatus, setFiltStatus] = useState("");
  const [aberta, setAberta] = useState<string | null>(null);

  const tipos = useMemo(() => {
    const set = [...new Set(data.map(m => m.tipo).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    const grupos = [...new Set(set.filter(t => / \d+$/.test(t)).map(t => t.replace(/ \d+$/, "")))];
    return { set, grupos };
  }, [data]);
  const statusOpts = useMemo(() => [...new Set(data.map(m => m.status))].sort((a, b) => a.localeCompare(b, "pt-BR")), [data]);

  const lista = useMemo(
    () => data.filter(m => (!filtTipo || casaTipo(m.tipo, filtTipo)) && (!filtStatus || m.status === filtStatus)),
    [data, filtTipo, filtStatus]
  );

  const colunas = useMemo(() => {
    const map = new Map<string, CampoEtapa>();
    for (const m of lista) for (const c of etapaFields(m.tipo)) if (ORDEM.includes(c.key)) map.set(c.key, c);
    return ORDEM.filter(k => map.has(k)).map(k => map.get(k)!);
  }, [lista]);

  const kpis = colunas.map(c => {
    const aplicaveis = lista.filter(m => etapaFields(m.tipo).some(x => x.key === c.key));
    const feitas = aplicaveis.map(m => ({ m, data: dataEtapa(m, c) })).filter(x => x.data);
    const dias = feitas.map(x => { const ini = inicioCiclo(x.m); return ini ? diasEntre(ini, x.data!) : null; }).filter((n): n is number => n !== null && n >= 0);
    return { c, total: aplicaveis.length, feitas: feitas.length, media: media(dias) };
  });

  return (
    <>
      <div className={styles.topbar}>
        <div>
          <div className={styles.pageTitle}>Jornada</div>
          <div className={styles.pageSub}>Datas de cada etapa e tempo médio desde o início do programa</div>
        </div>
      </div>
      <div className={styles.content}>
        <div className={f.bar}>
          <select className={f.select} value={filtTipo} onChange={e => setFiltTipo(e.target.value)} aria-label="Filtrar por programa">
            <option value="">Todos os programas</option>
            {tipos.grupos.map(g => <option key={`g-${g}`} value={g}>{g} (todos)</option>)}
            {tipos.set.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className={f.select} value={filtStatus} onChange={e => setFiltStatus(e.target.value)} aria-label="Filtrar por status">
            <option value="">Todos os status</option>
            {statusOpts.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {(filtTipo || filtStatus) && (
            <button className={f.clear} onClick={() => { setFiltTipo(""); setFiltStatus(""); }}>Limpar filtros</button>
          )}
          <span className={f.count}>{lista.length} mentoradas</span>
        </div>

        <div className={f.kpiStrip}>
          {kpis.map(k => (
            <div key={k.c.key} className={f.kpiMini}>
              <span className={f.kpiMiniLabel}>Início → {k.c.label}</span>
              <strong className={f.kpiMiniValue}>{k.media !== null ? `${k.media}d` : "—"}</strong>
              <span className={f.kpiMiniSub}>
                {k.feitas}/{k.total} concluíram
                <i className={f.kpiMiniTrack}><b style={{ width: `${k.total ? Math.round((k.feitas / k.total) * 100) : 0}%` }} /></i>
              </span>
            </div>
          ))}
        </div>

        <div className={styles.tblCard}>
          <div className={styles.tblHead}>
            <span className={styles.tblTitle}>Jornada individual por mentorada</span>
            <span className={styles.tblCount}>Clique no nome para ver a linha do tempo</span>
          </div>
          <div className={styles.tblWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Programa</th>
                  <th>Status</th>
                  {colunas.map(c => <th key={c.key} style={{ textAlign: "center" }}>{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {lista.map(m => {
                  const campos = etapaFields(m.tipo);
                  return (
                    <tr key={m.id}>
                      <td>
                        <button className={f.nomeBtn} onClick={() => setAberta(m.id)}>{m.nome}</button>
                        {m.codigo && <div className={f.cod}>{m.codigo}</div>}
                      </td>
                      <td><span className={`${styles.badge} ${styles.bSilver}`}>{m.tipo}</span></td>
                      <td>
                        <span className={`${styles.badge} ${m.status === "Ativo" ? styles.bAtivo : m.status === "Encerrado" ? styles.bEnc : m.status === "Churn" ? styles.bChurn : m.status === "Em Renovação" ? styles.bRenov : styles.bSilver}`}>
                          {m.status}
                        </span>
                      </td>
                      {colunas.map(c => {
                        const campo = campos.find(x => x.key === c.key);
                        if (!campo) return <td key={c.key} className={f.na}>n/a</td>;
                        const val = dataEtapa(m, campo);
                        const ini = inicioCiclo(m);
                        const dias = val && ini ? diasEntre(ini, val) : null;
                        return (
                          <td key={c.key} style={{ textAlign: "center" }}>
                            {val ? (
                              <span className={f.dateCell}>
                                {fmt(val)}
                                {dias !== null && <small>{dias}d</small>}
                              </span>
                            ) : <span className={f.pend}>—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {lista.length === 0 && (
                  <tr><td colSpan={3 + colunas.length} style={{ textAlign: "center", color: "var(--txt3)", padding: 24 }}>Nenhuma mentorada com esses filtros.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {aberta && <JornadaModal key={aberta} id={aberta} onClose={() => setAberta(null)} />}
    </>
  );
}
