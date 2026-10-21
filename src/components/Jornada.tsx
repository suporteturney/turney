"use client";
import { useState, type ReactNode } from "react";
import j from "./Jornada.module.css";

export type Etapa = { id: string; nome: string; data: string | null };
export type Presenca = { id: string; encontro: string; presente: boolean };
export type Acomp = {
  id: string; data: string; tipo: string | null; texto: string; autor: string | null;
  marco: boolean; marcoTitulo: string | null;
};
export type Obs = { id: string; data: string; texto: string; autor: string | null };
export type Renov = { id: string; acao: string; destino: string; data: string; novoPrazo: string | null; obs: string | null };

export type Detalhe = {
  id: string; codigo: string | null; nome: string; tipo: string; status: string; saude: string | null;
  email: string | null; whatsapp: string | null; area: string | null; localizacao: string | null;
  turma: string | null; produtoAnterior: string | null; origem: string | null; resp: string | null;
  obs: string | null; linkedin: string | null; drive: string | null; asana: string | null; disc: string | null;
  duracao: number | null; mesesAntes: number | null;
  inicio: string | null; prazo: string | null; cancelamento: string | null;
  vagaCargo: string | null; vagaEmpresa: string | null; vagaData: string | null;
  negociacao: string | null; negociacaoEm: string | null;
  saudeMotivo: string | null; saudeMotivoEm: string | null;
  etapas: Etapa[]; presencas: Presenca[]; acompanhamentos: Acomp[]; observacoes: Obs[]; renovacoes: Renov[];
};

export type Campo = { key: string; label: string };
export type CampoEtapa = Campo & { campoMentorada?: "vagaData" };

export const toInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");
export const fmt = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");
export const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const diasEntre = (a: string, b: string) =>
  Math.round((Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / 86400000);

const E = {
  onboarding: { key: "onboarding", label: "Onboarding" },
  devolutiva: { key: "devolutiva", label: "Devolutiva Comportamental" },
  mentoria: { key: "sessao", label: "Mentoria Individual" },
  correcao: { key: "correcao", label: "Correção de Materiais" },
  analise: { key: "analise", label: "Análise Integrativa de Perfil" },
  entrevista: { key: "entrevista", label: "1ª Entrevista" },
  aprovacao: { key: "aprovacao", label: "Aprovação", campoMentorada: "vagaData" },
} satisfies Record<string, CampoEtapa>;

export function etapaFields(tipo: string): CampoEtapa[] {
  switch (tipo) {
    case "Nexus 1": return [E.onboarding, E.mentoria, E.correcao, E.entrevista, E.aprovacao];
    case "Nexus 2": return [E.onboarding, E.mentoria, E.entrevista, E.aprovacao];
    case "Nexus 3": return [E.onboarding, E.analise, E.entrevista, E.aprovacao];
    case "Atlas": return [E.onboarding, E.devolutiva, E.mentoria, E.entrevista, E.aprovacao];
    case "Delta":
      return [E.onboarding, ...[1, 2, 3, 4].map(i => ({ key: `encontro${i}`, label: `Encontro Individual ${i}` }))];
    default: return [E.onboarding];
  }
}

export function dataEtapa(d: Pick<Detalhe, "etapas" | "vagaData">, f: CampoEtapa): string | null {
  if (f.campoMentorada) return d[f.campoMentorada];
  return d.etapas.find(e => e.nome === f.key)?.data ?? null;
}

type Evento = {
  key: string;
  data: string;
  titulo: string;
  texto?: string;
  meta?: string;
  nivel: "marco" | "etapa" | "rotina" | "futuro" | "alerta";
  acompId?: string;
};

const ETAPA_LABEL: Record<string, string> = {
  onboarding: "Onboarding concluído",
  sessao: "Mentoria Individual realizada",
  devolutiva: "Devolutiva Comportamental realizada",
  correcao: "Correção de Materiais entregue",
  analise: "Análise Integrativa de Perfil realizada",
  entrevista: "1ª entrevista",
};

function montarJornada(d: Detalhe): Evento[] {
  const ev: Evento[] = [];
  if (d.inicio) ev.push({ key: "inicio", data: d.inicio, titulo: `Início no ${d.tipo}`, nivel: "etapa" });
  for (const e of d.etapas) {
    if (!e.data) continue;
    const label = ETAPA_LABEL[e.nome] ?? (e.nome.startsWith("encontro") ? `Encontro Individual ${e.nome.slice(8)}` : e.nome);
    ev.push({ key: `et-${e.id}`, data: e.data, titulo: label, nivel: "etapa" });
  }
  for (const a of d.acompanhamentos) {
    ev.push({
      key: `ac-${a.id}`,
      data: a.data,
      titulo: a.marco ? a.marcoTitulo || "Evolução significativa" : `Acompanhamento${a.tipo ? ` · ${a.tipo}` : ""}`,
      texto: a.texto,
      meta: [a.marco && a.tipo ? a.tipo : null, a.autor].filter(Boolean).join(" · ") || undefined,
      nivel: a.marco ? "marco" : "rotina",
      acompId: a.id,
    });
  }
  for (const o of d.observacoes) {
    ev.push({ key: `ob-${o.id}`, data: o.data, titulo: "Observação", texto: o.texto, meta: o.autor ?? undefined, nivel: "rotina" });
  }
  for (const r of d.renovacoes) {
    ev.push({
      key: `rn-${r.id}`, data: r.data, titulo: `${r.acao[0]}${r.acao.slice(1).toLowerCase()} → ${r.destino}`,
      texto: r.obs ?? undefined, meta: r.novoPrazo ? `Novo prazo ${fmt(r.novoPrazo)}` : undefined, nivel: "marco",
    });
  }
  if (d.negociacao && d.negociacaoEm) {
    ev.push({ key: "negociacao", data: d.negociacaoEm, titulo: "Negociação de renovação", texto: d.negociacao, nivel: "rotina" });
  }
  if (d.vagaData || d.vagaCargo || d.vagaEmpresa) {
    ev.push({
      key: "vaga", data: d.vagaData ?? d.prazo ?? new Date().toISOString(),
      titulo: "Aprovada em vaga", texto: [d.vagaCargo, d.vagaEmpresa].filter(Boolean).join(" · ") || undefined, nivel: "marco",
    });
  }
  if (d.cancelamento) ev.push({ key: "cancel", data: d.cancelamento, titulo: "Cancelamento", nivel: "alerta" });
  if (d.prazo) {
    const futuro = d.prazo.slice(0, 10) > hojeISO();
    ev.push({ key: "prazo", data: d.prazo, titulo: futuro ? "Encerramento previsto" : "Fim do programa", nivel: futuro ? "futuro" : "etapa" });
  }
  return ev.sort((a, b) => a.data.localeCompare(b.data));
}

type Fase = { key: string; label: string; data: string | null; estado: "feito" | "pendente" | "futuro" };

function montarFases(d: Detalhe): Fase[] {
  const hoje = hojeISO();
  const fases: Fase[] = [{ key: "inicio", label: "Início", data: d.inicio, estado: d.inicio ? "feito" : "pendente" }];
  for (const f of etapaFields(d.tipo)) {
    const data = dataEtapa(d, f);
    fases.push({ key: f.key, label: f.label, data, estado: data ? "feito" : "pendente" });
  }
  const fim = d.cancelamento ?? d.prazo;
  const encerrou = !!fim && fim.slice(0, 10) <= hoje;
  fases.push({
    key: "fim",
    label: d.cancelamento ? "Cancelamento" : "Encerramento",
    data: fim,
    estado: encerrou ? "feito" : "futuro",
  });
  return fases;
}

export default function Jornada({
  d,
  acoes,
  onToggleMarco,
  compacto = false,
}: {
  d: Detalhe;
  acoes?: ReactNode;
  onToggleMarco?: (a: Acomp) => void;
  compacto?: boolean;
}) {
  const [soMarcos, setSoMarcos] = useState(false);

  const todos = montarJornada(d);
  const eventos = soMarcos ? todos.filter(e => e.nivel !== "rotina") : todos;
  const fases = montarFases(d);
  const fasesFeitas = fases.filter(f => f.estado === "feito").length;
  const marcos = d.acompanhamentos.filter(a => a.marco).length + d.renovacoes.length + (d.vagaData || d.vagaCargo ? 1 : 0);
  const ultimo = d.acompanhamentos[0]?.data ?? null;
  const diasSemAcomp = ultimo ? diasEntre(ultimo, hojeISO()) : null;
  const ativa = d.status === "Ativo" || d.status === "Em Andamento" || d.status === "Em Renovação";
  const semanaAtual = d.inicio ? Math.max(1, Math.floor(diasEntre(d.inicio, hojeISO()) / 7) + 1) : null;
  const semanasTotal = d.inicio && d.prazo ? Math.max(1, Math.round(diasEntre(d.inicio, d.prazo) / 7)) : null;
  const hoje = hojeISO();
  const idxHoje = eventos.findIndex(e => e.data.slice(0, 10) > hoje);
  const semanaTxt =
    semanaAtual === null ? "—"
      : semanasTotal && semanaAtual > semanasTotal ? `${semanasTotal}/${semanasTotal}`
      : `${semanaAtual}${semanasTotal ? `/${semanasTotal}` : ""}`;

  return (
    <div className={compacto ? j.compacto : undefined}>
      <div className={j.stats}>
        <div><span>Semana</span><strong>{semanaTxt}</strong></div>
        <div><span>Fases concluídas</span><strong>{fasesFeitas}/{fases.length}</strong></div>
        <div><span>Evoluções</span><strong className={j.gold}>{marcos}</strong></div>
        <div>
          <span>Último contato</span>
          <strong className={ativa && (diasSemAcomp === null || diasSemAcomp > 7) ? j.warn : ""}>
            {diasSemAcomp === null ? "Nunca" : diasSemAcomp === 0 ? "Hoje" : `há ${diasSemAcomp}d`}
          </strong>
        </div>
      </div>

      <div className={j.fasesWrap}>
        <div className={j.blockLabel}>Fases do programa · {d.tipo}</div>
        <ol className={j.fases}>
          {fases.map(f => (
            <li key={f.key} className={j[`f_${f.estado}`]}>
              <span className={j.fDot}>{f.estado === "feito" ? "✓" : ""}</span>
              <span className={j.fLabel}>{f.label}</span>
              <span className={j.fData}>{f.data ? fmt(f.data) : "pendente"}</span>
            </li>
          ))}
        </ol>
        {(d.produtoAnterior || (d.mesesAntes ?? 0) > 0 || d.vagaCargo || d.vagaEmpresa) && (
          <div className={j.chips}>
            {d.produtoAnterior && <span className={j.chip}>Veio de: <strong>{d.produtoAnterior}</strong></span>}
            {(d.mesesAntes ?? 0) > 0 && <span className={j.chip}><strong>{d.mesesAntes}</strong> meses em programas anteriores</span>}
            {(d.vagaCargo || d.vagaEmpresa) && (
              <span className={`${j.chip} ${j.chipGold}`}>
                ★ Aprovada: <strong>{[d.vagaCargo, d.vagaEmpresa].filter(Boolean).join(" · ")}</strong>
                {d.vagaData && ` em ${fmt(d.vagaData)}`}
              </span>
            )}
          </div>
        )}
      </div>

      {ativa && (diasSemAcomp === null || diasSemAcomp > 7) && (
        <div className={j.alert}>
          {diasSemAcomp === null
            ? "Nenhum acompanhamento registrado ainda."
            : `Sem acompanhamento há ${diasSemAcomp} dias — o ritmo combinado é semanal.`}
        </div>
      )}

      <div className={j.toolbar}>
        <div className={j.seg}>
          <button className={!soMarcos ? j.segOn : ""} onClick={() => setSoMarcos(false)}>Tudo</button>
          <button className={soMarcos ? j.segOn : ""} onClick={() => setSoMarcos(true)}>Só marcos</button>
        </div>
        {acoes && <div className={j.acoes}>{acoes}</div>}
      </div>

      {eventos.length === 0 ? (
        <div className={j.empty}>A jornada ainda está vazia.<br />Registre o primeiro acompanhamento para começar a linha do tempo.</div>
      ) : (
        <ol className={j.timeline}>
          {eventos.map((e, i) => (
            <li key={e.key} className={`${j.tItem} ${j[`t_${e.nivel}`]}`}>
              {i === idxHoje && <div className={j.tHoje}><span>Hoje · {fmt(hoje)}</span></div>}
              <span className={j.tDot}>{e.nivel === "marco" ? "★" : ""}</span>
              <div className={j.tCard}>
                <div className={j.tHead}>
                  <span className={j.tTitle}>{e.titulo}</span>
                  <span className={j.tDate}>{fmt(e.data)}</span>
                </div>
                {e.texto && <div className={j.tText}>{e.texto}</div>}
                {(e.meta || (e.acompId && onToggleMarco)) && (
                  <div className={j.tMeta}>
                    {e.meta && <span>{e.meta}</span>}
                    {e.acompId && onToggleMarco && (
                      <button
                        className={j.tStar}
                        onClick={() => {
                          const a = d.acompanhamentos.find(x => x.id === e.acompId);
                          if (a) onToggleMarco(a);
                        }}
                      >
                        {e.nivel === "marco" ? "Desmarcar evolução" : "★ Marcar como evolução"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
