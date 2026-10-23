// Regras da jornada por programa — usadas no servidor e no navegador.
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

export function nomeEtapa(chave: string) {
  const achado = Object.values(E).find(x => x.key === chave);
  if (achado) return achado.label;
  if (chave.startsWith("encontro")) return `Encontro Individual ${chave.slice(8)}`;
  return chave;
}

export function etapasDoPrograma<T extends { programa?: string }>(d: { etapas: T[]; tipo: string }): T[] {
  return d.etapas.filter(e => !e.programa || e.programa === d.tipo);
}

export function dataEtapa(
  d: { etapas: { nome: string; data: string | null; programa?: string }[]; vagaData: string | null; tipo: string },
  f: CampoEtapa
): string | null {
  if (f.campoMentorada) return d[f.campoMentorada];
  return etapasDoPrograma(d).find(e => e.nome === f.key)?.data ?? null;
}

export const MUDANCAS = ["UPGRADE", "DOWNGRADE", "CROSS"];

export function mudancaDePrograma(d: { tipo: string; renovacoes?: { acao: string; destino: string; data: string; programaAnterior?: string | null }[] }) {
  return [...(d.renovacoes ?? [])]
    .filter(r => MUDANCAS.includes(r.acao) && r.destino === d.tipo)
    .sort((a, b) => b.data.localeCompare(a.data))[0] ?? null;
}

export function inicioCiclo(d: { inicio: string | null; tipo: string; renovacoes?: { acao: string; destino: string; data: string }[] }) {
  return mudancaDePrograma(d)?.data ?? d.inicio;
}
