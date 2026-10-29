// Níveis de acesso da equipe — usado no servidor e no navegador.

export const PERMISSOES = [
  { k: "cadastro", label: "Cadastro", desc: "Criar mentoradas e editar dados cadastrais (contato, área, DISC, saúde…)" },
  { k: "jornada", label: "Jornada", desc: "Marcar datas das etapas e encontros extras" },
  { k: "presencas", label: "Presenças", desc: "Registrar presença e falta nos encontros ao vivo" },
  { k: "acompanhamento", label: "Acompanhamento", desc: "Registrar acompanhamentos, observações e importar varreduras" },
  { k: "comercial", label: "Comercial", desc: "Programa, status, datas de contrato, renovações e negociação" },
  { k: "excluir", label: "Excluir", desc: "Apagar registros (acompanhamentos, observações, renovações, varreduras)" },
  { k: "equipe", label: "Equipe e atividades", desc: "Criar acessos, mudar permissões e ver o registro de atividades" },
] as const;

export type Permissao = (typeof PERMISSOES)[number]["k"];

export const PAPEIS: { k: string; label: string; permissoes: Permissao[] }[] = [
  { k: "admin", label: "Administradora", permissoes: PERMISSOES.map(p => p.k) },
  { k: "mentora", label: "Mentora", permissoes: ["cadastro", "jornada", "presencas", "acompanhamento"] },
  { k: "suporte", label: "Suporte", permissoes: ["cadastro", "presencas", "acompanhamento"] },
  { k: "leitura", label: "Somente leitura", permissoes: [] },
];

export const rotuloPapel = (k: string) => PAPEIS.find(p => p.k === k)?.label ?? k;

// Campos do cadastro que são da área comercial (o resto é "cadastro").
export const CAMPOS_COMERCIAIS = new Set([
  "tipo", "status", "inicio", "prazo", "duracao", "cancelamento", "mesesAntes", "negociacao", "renovacaoStatus",
]);

export function pode(u: { papel: string; permissoes?: string[] | null } | null | undefined, p: Permissao) {
  if (!u) return false;
  return u.papel === "admin" || (u.permissoes ?? []).includes(p);
}

export const NOME_PERMISSAO = Object.fromEntries(PERMISSOES.map(p => [p.k, p.label])) as Record<Permissao, string>;
