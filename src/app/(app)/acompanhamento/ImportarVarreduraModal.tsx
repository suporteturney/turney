"use client";
import { useEffect, useMemo, useState } from "react";
import {
  BANDAS, casarMentorada, instrucoesClaude, lerVarredura,
  type Banda, type ItemVarredura, type MentoradaRef, type VarreduraPayload,
} from "@/lib/varredura";
import m from "./importar.module.css";

const PROGRAMAS_PADRAO = ["Nexus 1", "Nexus 2", "Nexus 3", "Atlas", "Delta"];
const ATIVOS = ["Ativo", "Em Andamento", "Em Renovação"];
const casa = (tipo: string, p: string) => tipo === p || tipo.startsWith(`${p} `);
const corDe = (b: Banda) => BANDAS.find(x => x.k === b)!.cor;

export default function ImportarVarreduraModal({
  programaInicial, programas, base, ultimas, assinatura: assinaturaInicial, onClose, onImportada,
}: {
  programaInicial: string;
  programas: string[];
  base: MentoradaRef[];
  ultimas: { programa: string; data: string; itens: { nome: string; banda: string; tag: string | null }[] }[];
  assinatura: string;
  onClose: () => void;
  onImportada: (programa: string) => void;
}) {
  const opcoesProg = useMemo(() => [...new Set([...PROGRAMAS_PADRAO, ...programas])], [programas]);
  const [programa, setPrograma] = useState(programaInicial || "Nexus 1");
  const [assinatura, setAssinatura] = useState(() => {
    try { return localStorage.getItem("turney_assinatura") || assinaturaInicial; } catch { return assinaturaInicial; }
  });
  const [texto, setTexto] = useState("");
  const [lida, setLida] = useState<VarreduraPayload | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [vinculos, setVinculos] = useState<(string | "")[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [registrar, setRegistrar] = useState(true);
  const [atualizarSaude, setAtualizarSaude] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const ativasDoPrograma = base.filter(x => ATIVOS.includes(x.status) && casa(x.tipo, programa));

  async function copiarInstrucoes() {
    try { localStorage.setItem("turney_assinatura", assinatura); } catch { /* preferência opcional */ }
    const ant = ultimas.find(u => u.programa === programa);
    const txt = instrucoesClaude({
      programa,
      assinatura: assinatura || "equipe Turney",
      mentoradas: ativasDoPrograma.map(x => ({ nome: x.nome, status: x.status })),
      anterior: ant ? { data: ant.data, itens: ant.itens.map(i => ({ ...i, banda: i.banda as Banda })) } : null,
    });
    try {
      await navigator.clipboard.writeText(txt);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      window.prompt("Copie as instruções:", txt);
    }
  }

  function ler() {
    setErro(null);
    const r = lerVarredura(texto);
    if (!r.ok) { setErro(r.erro); setLida(null); return; }
    const prog = r.payload.programa ?? programa;
    setPrograma(prog);
    setLida({ ...r.payload, programa: prog });
    setAvisos(r.avisos);
    setVinculos(r.payload.itens.map(i => casarMentorada(i.nome, base, prog) ?? ""));
  }

  async function salvar() {
    if (!lida) return;
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch("/api/varreduras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...lida,
          programa,
          itens: lida.itens.map((i, k) => ({ ...i, mentoradaId: vinculos[k] || null })),
          registrarAcompanhamento: registrar,
          atualizarSaude,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.erro || "Não foi possível importar. Tente novamente.");
      onImportada(programa);
    } catch (e) {
      setErro((e as Error).message);
      setSalvando(false);
    }
  }

  const semVinculo = vinculos.filter(v => !v).length;
  const nAnalise = lida ? lida.analise.bom.length + lida.analise.ruim.length + lida.analise.invisivel.length + lida.analise.melhorias.length : 0;
  const opcoesBase = (i: ItemVarredura) => {
    const doProg = base.filter(x => casa(x.tipo, programa));
    const outros = base.filter(x => !casa(x.tipo, programa));
    void i;
    return { doProg, outros };
  };

  return (
    <div className={m.backdrop} onClick={onClose}>
      <div className={m.modal} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Importar varredura">
        <header className={m.header}>
          <div>
            <div className={m.title}>Importar varredura semanal</div>
            <div className={m.sub}>{lida ? "Confira os vínculos antes de salvar" : "Passo 1: peça ao Claude · Passo 2: cole o resultado"}</div>
          </div>
          <button className={m.close} onClick={onClose} aria-label="Fechar">✕</button>
        </header>

        <div className={m.body}>
          {!lida ? (
            <>
              <div className={m.row}>
                <label className={m.field}>
                  <span>Programa</span>
                  <select value={programa} onChange={e => setPrograma(e.target.value)}>
                    {opcoesProg.map(p => <option key={p}>{p}</option>)}
                  </select>
                </label>
                <label className={m.field}>
                  <span>Assinar mensagens como</span>
                  <input value={assinatura} onChange={e => setAssinatura(e.target.value)} placeholder="Ex: Duda" />
                </label>
              </div>
              <div className={m.passo}>
                <div>
                  <strong>1. Copie as instruções e cole no Claude</strong>
                  <p>
                    Vão junto a lista das {ativasDoPrograma.length} mentoradas ativas do {programa}
                    {ultimas.find(u => u.programa === programa) ? " e a varredura anterior, para ele comparar e apontar o que mudou" : ""}.
                  </p>
                </div>
                <button className={m.btnDark} onClick={copiarInstrucoes}>{copiado ? "Copiado ✓" : "Copiar instruções para o Claude"}</button>
              </div>
              <label className={m.field}>
                <span>2. Cole aqui a resposta do Claude (JSON)</span>
                <textarea
                  rows={12}
                  value={texto}
                  onChange={e => setTexto(e.target.value)}
                  placeholder='{ "data": "2026-10-21", "programa": "Nexus 1", "mentoradas": [ … ] }'
                  spellCheck={false}
                />
              </label>
            </>
          ) : (
            <>
              <div className={m.resumo}>
                <label className={m.field}>
                  <span>Data da varredura</span>
                  <input type="date" value={lida.data} onChange={e => setLida({ ...lida, data: e.target.value })} />
                </label>
                <label className={m.field}>
                  <span>Programa</span>
                  <select value={programa} onChange={e => setPrograma(e.target.value)}>
                    {opcoesProg.map(p => <option key={p}>{p}</option>)}
                  </select>
                </label>
                <div className={m.counts}>
                  {BANDAS.map(b => (
                    <span key={b.k}><i style={{ background: b.cor }} />{lida.itens.filter(i => i.banda === b.k).length} {b.label.toLowerCase()}</span>
                  ))}
                  <span>{nAnalise} insights do Claude</span>
                </div>
              </div>

              {avisos.length > 0 && <ul className={m.avisos}>{avisos.map((x, k) => <li key={k}>{x}</li>)}</ul>}
              {semVinculo > 0 && (
                <div className={m.alerta}>
                  {semVinculo} nome{semVinculo > 1 ? "s" : ""} não {semVinculo > 1 ? "foram encontrados" : "foi encontrado"} no cadastro.
                  Escolha a mentorada certa na lista ou deixe “não vincular” (o card aparece, mas não entra na jornada).
                </div>
              )}

              <div className={m.lista}>
                {lida.itens.map((i, k) => {
                  const { doProg, outros } = opcoesBase(i);
                  return (
                    <div key={k} className={`${m.item} ${vinculos[k] ? "" : m.itemSem}`}>
                      <span className={m.dot} style={{ background: corDe(i.banda) }} />
                      <div className={m.itemMain}>
                        <strong>{i.nome}</strong>
                        <small>{i.tag ?? i.status ?? ""}</small>
                      </div>
                      <select
                        value={vinculos[k] ?? ""}
                        onChange={e => setVinculos(v => v.map((x, j) => (j === k ? e.target.value : x)))}
                        aria-label={`Vincular ${i.nome} ao cadastro`}
                      >
                        <option value="">— não vincular —</option>
                        <optgroup label={programa}>
                          {doProg.map(x => <option key={x.id} value={x.id}>{x.nome} · {x.status}</option>)}
                        </optgroup>
                        <optgroup label="Outros programas">
                          {outros.map(x => <option key={x.id} value={x.id}>{x.nome} · {x.tipo}</option>)}
                        </optgroup>
                      </select>
                    </div>
                  );
                })}
              </div>

              <label className={m.check}>
                <input type="checkbox" checked={registrar} onChange={e => setRegistrar(e.target.checked)} />
                <span><strong>Registrar na jornada de cada mentorada</strong><small>Cria um acompanhamento “Varredura WhatsApp” com status, pendências e próximos passos — conta como último contato.</small></span>
              </label>
              <label className={m.check}>
                <input type="checkbox" checked={atualizarSaude} onChange={e => setAtualizarSaude(e.target.checked)} />
                <span><strong>Atualizar a saúde pela cor</strong><small>Vermelho → Risco, amarelo → Atenção, verde → Saudável. O motivo na Saúde da Base vira o resumo da varredura.</small></span>
              </label>
            </>
          )}
        </div>

        <footer className={m.footer}>
          {erro && <span className={m.erro} role="alert">{erro}</span>}
          {lida ? (
            <>
              <button className={m.btnGhost} onClick={() => setLida(null)} disabled={salvando}>Voltar</button>
              <button className={m.btnPrimary} onClick={salvar} disabled={salvando}>
                {salvando ? "Importando…" : `Importar ${lida.itens.length} mentoradas`}
              </button>
            </>
          ) : (
            <>
              <button className={m.btnGhost} onClick={onClose}>Cancelar</button>
              <button className={m.btnPrimary} onClick={ler} disabled={!texto.trim()}>Ler varredura</button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
