"use client";
import { useMemo, useState } from "react";
import JornadaModal from "@/components/JornadaModal";
import { PESO_BANDA, type Banda } from "@/lib/varredura";
import styles from "../shared.module.css";
import f from "../filtros.module.css";
import s from "./analises.module.css";

type M = {
  id: string; nome: string; tipo: string; status: string; saude: string | null;
  inicio: string | null; prazo: string | null; cancelamento: string | null; vagaData: string | null;
  negociacao: string | null; renovacaoStatus: string | null; etapas: { nome: string; data: string | null }[];
};
type R = { mentoradaId: string; acao: string; data: string };
type A = { mentoradaId: string; data: string; marco: boolean; marcoTitulo: string | null; varreduraId: string | null };
type V = {
  id: string; data: string; programa: string | null; bom: string[]; ruim: string[]; invisivel: string[]; melhorias: string[];
  itens: { mentoradaId: string | null; nome: string; banda: string; tag: string | null; status: string | null; atencao: string[]; pendencias: string[]; retornos: string[] }[];
};

const ATIVOS = ["Ativo", "Em Andamento", "Em Renovação"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const labelMes = (ym: string) => `${MESES[+ym.slice(5, 7) - 1]} ${ym.slice(0, 4)}`;
const casaTipo = (tipo: string, filtro: string) => tipo === filtro || tipo.startsWith(`${filtro} `);
const noMes = (iso: string | null, ym: string) => !!iso && iso.slice(0, 7) === ym;
const fmt = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");
const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function mesAnterior(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return d.toISOString().slice(0, 7);
}
function fimDoMes(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const fim = new Date(Date.UTC(y, m, 0, 23, 59));
  const agora = new Date();
  return fim > agora ? agora : fim;
}
const dias = (a: Date, b: string) => Math.round((a.getTime() - Date.parse(b)) / 86400000);

const TEMAS: { k: string; label: string; re: RegExp; tom: "ruim" | "bom"; melhoria: string }[] = [
  { k: "silencio", label: "Silêncio / sem resposta da mentorada", re: /nao respond|sem respost|silencio|sem retorno|nao retorn|visualiz/, tom: "ruim",
    melhoria: "Cadência de reativação: depois de 7 dias sem resposta, trocar de canal (e-mail ou ligação) e envolver a mentora." },
  { k: "equipe", label: "Retorno pendente da equipe", re: /sem resposta da equipe|nao respondida pela equipe|aguardando (nossa|a equipe)|equipe (ainda )?nao/, tom: "ruim",
    melhoria: "Combinar um prazo de resposta de até 24h para mensagens das mentoradas e revisar os retornos pendentes toda segunda." },
  { k: "acesso", label: "Problemas de acesso à plataforma", re: /acesso|acessar|login|senha|cache|plataforma/, tom: "ruim",
    melhoria: "Incluir no onboarding um checklist de acesso (login, app, gravações) e um vídeo curto de primeiros passos." },
  { k: "agenda", label: "Agenda / reagendamento", re: /reagend|remarc|antecip|horario|agenda/, tom: "ruim",
    melhoria: "Abrir mais horários no link de autoagendamento e confirmar todo agendamento no mesmo dia." },
  { k: "financeiro", label: "Questões financeiras", re: /financeir|pagament|investir|investimento|valor|reembolso|dinheiro/, tom: "ruim",
    melhoria: "Preparar uma condição de renovação facilitada para quem citou questões financeiras, antes do fim do ciclo." },
  { k: "pessoal", label: "Questões pessoais / saúde / mudança", re: /saude|doenc|familia|mae|pai|viag|mudanc|mudou|gravidez|luto/, tom: "ruim",
    melhoria: "Oferecer pausa ou extensão do ciclo para mentoradas passando por momentos pessoais difíceis." },
  { k: "materiais", label: "Materiais (currículo, LinkedIn, cover letter)", re: /curriculo|cv\b|linkedin|cover letter|correc|material/, tom: "bom",
    melhoria: "Padronizar o prazo de devolutiva dos materiais e avisar a mentorada quando a correção começar." },
  { k: "entrevistas", label: "Aplicações, entrevistas e propostas", re: /entrevist|aplica|candidat|proposta|processo seletivo|oferta|aprovad/, tom: "bom",
    melhoria: "Registrar cada entrevista como evolução na jornada para medir conversão aplicação → entrevista → aprovação." },
];

type Ponto = { texto: string; pessoas?: { id: string; nome: string }[]; fonte?: string };

export default function AnalisesCliente({ mentoradas, renovacoes, acompanhamentos, varreduras }: {
  mentoradas: M[]; renovacoes: R[]; acompanhamentos: A[]; varreduras: V[];
}) {
  const hoje = new Date();
  const mesHoje = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  const [mes, setMes] = useState(mesHoje);
  const [comparar, setComparar] = useState(mesAnterior(mesHoje));
  const [filtTipo, setFiltTipo] = useState("");
  const [aberta, setAberta] = useState<string | null>(null);

  const meses = useMemo(() => {
    const out: string[] = [];
    let cur = mesHoje;
    for (let i = 0; i < 18; i++) { out.push(cur); cur = mesAnterior(cur); }
    return out;
  }, [mesHoje]);

  const tipos = useMemo(() => {
    const set = [...new Set(mentoradas.map(m => m.tipo).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    const grupos = [...new Set(set.filter(t => / \d+$/.test(t)).map(t => t.replace(/ \d+$/, "")))];
    return { set, grupos };
  }, [mentoradas]);

  const base = useMemo(() => (filtTipo ? mentoradas.filter(m => casaTipo(m.tipo, filtTipo)) : mentoradas), [mentoradas, filtTipo]);
  const ids = useMemo(() => new Set(base.map(m => m.id)), [base]);
  const porId = useMemo(() => new Map(mentoradas.map(m => [m.id, m])), [mentoradas]);
  const sweeps = useMemo(
    () => varreduras.filter(v => !filtTipo || (v.programa ? casaTipo(v.programa, filtTipo) || casaTipo(filtTipo, v.programa) : true)),
    [varreduras, filtTipo]
  );

  function ultimaBanda(ym: string) {
    const ate = fimDoMes(ym).toISOString();
    const mapa = new Map<string, { banda: Banda; data: string; tag: string | null }>();
    for (const v of sweeps) {
      if (v.data > ate) continue;
      for (const i of v.itens) if (i.mentoradaId && ids.has(i.mentoradaId)) mapa.set(i.mentoradaId, { banda: i.banda as Banda, data: v.data, tag: i.tag });
    }
    return mapa;
  }

  function metricas(ym: string) {
    const doMes = sweeps.filter(v => noMes(v.data, ym));
    const ultimas = new Map<string, Banda>();
    for (const v of doMes) for (const i of v.itens) if (i.mentoradaId && ids.has(i.mentoradaId)) ultimas.set(i.mentoradaId, i.banda as Banda);
    const vermelhas = [...ultimas.values()].filter(b => b === "vermelho").length;
    const churn = base.filter(m => noMes(m.cancelamento, ym) || (!m.cancelamento && m.status === "Churn" && noMes(m.prazo, ym)));
    return {
      entradas: base.filter(m => noMes(m.inicio, ym)),
      encerramentos: base.filter(m => m.status === "Encerrado" && noMes(m.prazo, ym)),
      churn,
      renov: renovacoes.filter(r => ids.has(r.mentoradaId) && noMes(r.data, ym)),
      aprovacoes: base.filter(m => noMes(m.vagaData, ym)),
      entrevistas: base.filter(m => m.etapas.some(e => e.nome === "entrevista" && noMes(e.data, ym))),
      onboardings: base.filter(m => m.etapas.some(e => e.nome === "onboarding" && noMes(e.data, ym))),
      acomp: acompanhamentos.filter(a => ids.has(a.mentoradaId) && noMes(a.data, ym)),
      marcos: acompanhamentos.filter(a => a.marco && ids.has(a.mentoradaId) && noMes(a.data, ym)),
      varreduras: doMes,
      pctVermelho: ultimas.size ? Math.round((vermelhas / ultimas.size) * 100) : null,
      cobertas: ultimas.size,
    };
  }

  const atual = metricas(mes);
  const antes = metricas(comparar);

  type Linha = { label: string; a: number | null; b: number | null; melhor: "mais" | "menos" | "neutro"; sufixo?: string; nomes?: M[] };
  const linhas: Linha[] = [
    { label: "Novas entradas", a: atual.entradas.length, b: antes.entradas.length, melhor: "mais", nomes: atual.entradas },
    { label: "Onboardings realizados", a: atual.onboardings.length, b: antes.onboardings.length, melhor: "mais", nomes: atual.onboardings },
    { label: "1ª entrevistas", a: atual.entrevistas.length, b: antes.entrevistas.length, melhor: "mais", nomes: atual.entrevistas },
    { label: "Aprovações em vaga", a: atual.aprovacoes.length, b: antes.aprovacoes.length, melhor: "mais", nomes: atual.aprovacoes },
    { label: "Renovações e upgrades", a: atual.renov.length, b: antes.renov.length, melhor: "mais" },
    { label: "Churn / cancelamentos", a: atual.churn.length, b: antes.churn.length, melhor: "menos", nomes: atual.churn },
    { label: "Encerramentos no prazo", a: atual.encerramentos.length, b: antes.encerramentos.length, melhor: "neutro" },
    { label: "Acompanhamentos registrados", a: atual.acomp.length, b: antes.acomp.length, melhor: "mais" },
    { label: "Evoluções marcadas", a: atual.marcos.length, b: antes.marcos.length, melhor: "mais" },
    { label: "Mentoradas em vermelho", a: atual.pctVermelho, b: antes.pctVermelho, melhor: "menos", sufixo: "%" },
  ];

  const tom = (l: Linha) => {
    if (l.a === null || l.b === null || l.a === l.b || l.melhor === "neutro") return "neutro";
    const subiu = l.a > l.b;
    return (subiu && l.melhor === "mais") || (!subiu && l.melhor === "menos") ? "bom" : "ruim";
  };

  const bandaAgora = ultimaBanda(mes);
  const bandaAntes = ultimaBanda(comparar);
  const melhoraram: { id: string; nome: string }[] = [];
  const pioraram: { id: string; nome: string }[] = [];
  for (const [id, b] of bandaAgora) {
    const ant = bandaAntes.get(id);
    if (!ant || ant.data === b.data) continue;
    const nome = porId.get(id)?.nome ?? "";
    if (PESO_BANDA[b.banda] > PESO_BANDA[ant.banda]) melhoraram.push({ id, nome });
    if (PESO_BANDA[b.banda] < PESO_BANDA[ant.banda]) pioraram.push({ id, nome });
  }

  const bom: Ponto[] = [];
  const ruim: Ponto[] = [];
  for (const l of linhas) {
    const t = tom(l);
    if (t === "neutro" || l.a === null || l.b === null) continue;
    const delta = l.a - l.b;
    const txt = `${l.label}: ${l.a}${l.sufixo ?? ""} em ${labelMes(mes)} contra ${l.b}${l.sufixo ?? ""} em ${labelMes(comparar)} (${delta > 0 ? "+" : ""}${delta}${l.sufixo ? " p.p." : ""})`;
    (t === "bom" ? bom : ruim).push({ texto: txt, pessoas: l.nomes?.slice(0, 8).map(m => ({ id: m.id, nome: m.nome })) });
  }
  if (melhoraram.length) bom.push({ texto: `${melhoraram.length} mentorada${melhoraram.length > 1 ? "s" : ""} melhorou de cor entre as varreduras`, pessoas: melhoraram });
  if (pioraram.length) ruim.push({ texto: `${pioraram.length} mentorada${pioraram.length > 1 ? "s" : ""} piorou de cor entre as varreduras`, pessoas: pioraram });
  for (const v of atual.varreduras) {
    for (const t of v.bom) bom.push({ texto: t, fonte: `Claude · varredura ${v.programa ?? ""} ${fmt(v.data)}` });
    for (const t of v.ruim) ruim.push({ texto: t, fonte: `Claude · varredura ${v.programa ?? ""} ${fmt(v.data)}` });
  }

  const ref = fimDoMes(mes);
  const ativas = base.filter(m => ATIVOS.includes(m.status));
  const invisivel: Ponto[] = [];
  const melhorias: Ponto[] = [];

  const ordenadas = sweeps.filter(v => v.data <= ref.toISOString());
  const historico = new Map<string, Banda[]>();
  for (const v of ordenadas) for (const i of v.itens) if (i.mentoradaId) historico.set(i.mentoradaId, [...(historico.get(i.mentoradaId) ?? []), i.banda as Banda]);
  const persistentes = [...historico.entries()]
    .filter(([id, bs]) => ids.has(id) && bs.length >= 2 && bs.slice(-2).every(b => b === "vermelho"))
    .map(([id]) => ({ id, nome: porId.get(id)?.nome ?? "" }));
  if (persistentes.length) {
    invisivel.push({ texto: `${persistentes.length} em vermelho por 2 varreduras seguidas — o contato atual não está funcionando`, pessoas: persistentes });
    melhorias.push({ texto: "Para quem está em vermelho há 2 semanas: trocar a abordagem (ligação, mentora entra na conversa) em vez de repetir mensagem." });
  }

  const ultimasSweeps = new Map<string, V>();
  for (const v of ordenadas) ultimasSweeps.set(v.programa ?? "—", v);
  const itensRecentes = [...ultimasSweeps.values()].flatMap(v => v.itens).filter(i => !i.mentoradaId || ids.has(i.mentoradaId));
  const comRetorno = itensRecentes.filter(i => i.retornos.length);
  if (comRetorno.length) {
    invisivel.push({
      texto: `${comRetorno.reduce((n, i) => n + i.retornos.length, 0)} retornos que a equipe ainda deve, em ${comRetorno.length} mentorada${comRetorno.length > 1 ? "s" : ""}`,
      pessoas: comRetorno.filter(i => i.mentoradaId).map(i => ({ id: i.mentoradaId!, nome: i.nome })),
    });
  }

  const ultimoContato = new Map<string, string>();
  for (const a of acompanhamentos) if (a.data <= ref.toISOString() && (!ultimoContato.get(a.mentoradaId) || a.data > ultimoContato.get(a.mentoradaId)!)) ultimoContato.set(a.mentoradaId, a.data);
  const semContato = ativas.filter(m => { const u = ultimoContato.get(m.id); return !u || dias(ref, u) > 30; });
  if (semContato.length && acompanhamentos.length) {
    invisivel.push({ texto: `${semContato.length} ativas sem nenhum acompanhamento há mais de 30 dias`, pessoas: semContato.slice(0, 12).map(m => ({ id: m.id, nome: m.nome })) });
    melhorias.push({ texto: `Incluir as ${semContato.length} ativas sem contato na próxima varredura — hoje elas estão fora do radar.` });
  }

  const vencendo = ativas.filter(m => {
    if (!m.prazo) return false;
    const d = -dias(ref, m.prazo);
    const b = bandaAgora.get(m.id)?.banda;
    return d >= 0 && d <= 30 && (b === "vermelho" || b === "amarelo" || m.saude === "Risco" || m.saude === "Atenção") && !m.negociacao && (!m.renovacaoStatus || m.renovacaoStatus === "Não iniciado");
  });
  if (vencendo.length) {
    invisivel.push({ texto: `${vencendo.length} contratos vencem em até 30 dias, com sinal de risco e sem negociação de renovação iniciada`, pessoas: vencendo.map(m => ({ id: m.id, nome: m.nome })) });
    melhorias.push({ texto: "Abrir a conversa de renovação 45 dias antes do fim do ciclo para quem está em atenção ou risco." });
  }

  const onbPend = ativas.filter(m => m.inicio && dias(ref, m.inicio) > 14 && !m.etapas.some(e => e.nome === "onboarding" && e.data));
  if (onbPend.length) {
    invisivel.push({ texto: `${onbPend.length} ativas com mais de 14 dias de programa e onboarding ainda não registrado`, pessoas: onbPend.slice(0, 12).map(m => ({ id: m.id, nome: m.nome })) });
  }

  const textosMes = (ym: string) =>
    sweeps.filter(v => noMes(v.data, ym)).flatMap(v => v.itens.filter(i => !i.mentoradaId || ids.has(i.mentoradaId)).map(i => ({
      i, texto: norm([i.tag, i.status, ...i.atencao, ...i.pendencias, ...i.retornos].filter(Boolean).join(" \n ")),
    })));
  const tAtual = textosMes(mes);
  const tAntes = textosMes(comparar);
  const temas = TEMAS.map(t => ({
    ...t,
    agora: tAtual.filter(x => t.re.test(x.texto)),
    antes: tAntes.filter(x => t.re.test(x.texto)).length,
  })).filter(t => t.agora.length || t.antes);
  const maxTema = Math.max(1, ...temas.map(t => Math.max(t.agora.length, t.antes)));
  for (const t of temas) {
    if (t.tom === "ruim" && t.agora.length >= 2 && t.agora.length > t.antes) {
      invisivel.push({
        texto: `“${t.label}” apareceu em ${t.agora.length} acompanhamentos (antes: ${t.antes}) — é um padrão, não um caso isolado`,
        pessoas: t.agora.filter(x => x.i.mentoradaId).map(x => ({ id: x.i.mentoradaId!, nome: x.i.nome })),
      });
      melhorias.push({ texto: t.melhoria });
    }
  }

  for (const v of atual.varreduras) {
    for (const t of v.invisivel) invisivel.push({ texto: t, fonte: `Claude · varredura ${v.programa ?? ""} ${fmt(v.data)}` });
    for (const t of v.melhorias) melhorias.push({ texto: t, fonte: `Claude · varredura ${v.programa ?? ""} ${fmt(v.data)}` });
  }
  const melhoriasUnicas = melhorias.filter((p, i) => melhorias.findIndex(q => q.texto === p.texto) === i);

  const semVarredura = varreduras.length === 0;

  return (
    <>
      <div className={styles.topbar}>
        <div>
          <div className={styles.pageTitle}>Análises</div>
          <div className={styles.pageSub}>Comparativo mês a mês, alimentado pelos acompanhamentos semanais</div>
        </div>
      </div>
      <div className={styles.content}>
        <div className={f.bar}>
          <label className={s.ctl}>
            <span>Mês</span>
            <select className={f.select} value={mes} onChange={e => { setMes(e.target.value); setComparar(mesAnterior(e.target.value)); }}>
              {meses.map(m => <option key={m} value={m}>{labelMes(m)}</option>)}
            </select>
          </label>
          <label className={s.ctl}>
            <span>Comparar com</span>
            <select className={f.select} value={comparar} onChange={e => setComparar(e.target.value)}>
              {meses.filter(m => m !== mes).map(m => <option key={m} value={m}>{labelMes(m)}</option>)}
            </select>
          </label>
          <label className={s.ctl}>
            <span>Programa</span>
            <select className={f.select} value={filtTipo} onChange={e => setFiltTipo(e.target.value)}>
              <option value="">Todos os programas</option>
              {tipos.grupos.map(g => <option key={`g-${g}`} value={g}>{g} (todos)</option>)}
              {tipos.set.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <span className={f.count}>
            {atual.varreduras.length} varredura{atual.varreduras.length !== 1 ? "s" : ""} em {labelMes(mes)} · {atual.cobertas} mentoradas acompanhadas
          </span>
        </div>

        {semVarredura && (
          <div className={s.aviso}>
            Ainda não há varreduras importadas. Os comparativos abaixo já usam os dados do cadastro (entradas, etapas, renovações, aprovações).
            Os temas, os padrões escondidos e os insights do Claude aparecem a partir da primeira varredura importada em <strong>Acompanhamento</strong>.
          </div>
        )}

        <div className={s.comp}>
          {linhas.map(l => {
            const t = tom(l);
            const delta = l.a !== null && l.b !== null ? l.a - l.b : null;
            return (
              <div key={l.label} className={`${s.metric} ${s[`m_${t}`]}`}>
                <span className={s.mLabel}>{l.label}</span>
                <span className={s.mValor}>{l.a === null ? "—" : `${l.a}${l.sufixo ?? ""}`}</span>
                <span className={s.mDelta}>
                  {delta === null ? "sem dado para comparar" : delta === 0 ? `igual a ${labelMes(comparar)}` : `${delta > 0 ? "▲" : "▼"} ${Math.abs(delta)}${l.sufixo ? " p.p." : ""} vs ${l.b}${l.sufixo ?? ""}`}
                </span>
              </div>
            );
          })}
        </div>

        <div className={s.duo}>
          <Bloco titulo="O que foi muito bom" classe={s.bom} vazio="Nada se destacou positivamente neste comparativo." pontos={bom} onPessoa={setAberta} />
          <Bloco titulo="O que foi muito ruim" classe={s.ruim} vazio="Nenhuma piora relevante neste comparativo." pontos={ruim} onPessoa={setAberta} />
        </div>

        <div className={s.duo}>
          <Bloco titulo="Situações que não estamos enxergando" classe={s.invisivel} vazio="Nenhum padrão escondido encontrado com os dados atuais." pontos={invisivel} onPessoa={setAberta} />
          <Bloco titulo="Insights de melhoria" classe={s.melhoria} vazio="Sem sugestões por enquanto — elas surgem a partir dos padrões das varreduras." pontos={melhoriasUnicas} onPessoa={setAberta} />
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>Temas que mais aparecem nos acompanhamentos</div>
          <div className={styles.cardSub}>{labelMes(mes)} (barra cheia) contra {labelMes(comparar)} (barra clara), a partir do texto das varreduras</div>
          {temas.length === 0 ? (
            <div className={s.vazio}>Os temas aparecem quando houver varreduras nos meses comparados.</div>
          ) : (
            <div className={s.temas}>
              {temas.sort((x, y) => y.agora.length - x.agora.length).map(t => (
                <div key={t.k} className={s.tema}>
                  <span className={s.temaLabel}>{t.label}</span>
                  <span className={s.temaBars}>
                    <i className={t.tom === "bom" ? s.barBom : s.barRuim} style={{ width: `${(t.agora.length / maxTema) * 100}%` }} />
                    <i className={s.barAntes} style={{ width: `${(t.antes / maxTema) * 100}%` }} />
                  </span>
                  <span className={s.temaN}>{t.agora.length}<small> / {t.antes}</small></span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {aberta && <JornadaModal key={aberta} id={aberta} onClose={() => setAberta(null)} />}
    </>
  );
}

function Bloco({ titulo, classe, pontos, vazio, onPessoa }: {
  titulo: string; classe: string; pontos: Ponto[]; vazio: string; onPessoa: (id: string) => void;
}) {
  return (
    <div className={`${s.bloco} ${classe}`}>
      <h3>{titulo}<span>{pontos.length}</span></h3>
      {pontos.length === 0 ? <p className={s.vazio}>{vazio}</p> : (
        <ul>
          {pontos.map((p, k) => (
            <li key={k}>
              <span>{p.texto}</span>
              {p.fonte && <em className={s.fonte}>{p.fonte}</em>}
              {p.pessoas && p.pessoas.length > 0 && (
                <span className={s.pessoas}>
                  {p.pessoas.map(x => <button key={x.id} onClick={() => onPessoa(x.id)}>{x.nome}</button>)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
