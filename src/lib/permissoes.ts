// Níveis de acesso da equipe — usado no servidor e no navegador.

// Pilares da empresa: cada pessoa vê só os que estão marcados no acesso dela (administradora vê todos).
export const PILARES = [
  { k: "comercial", label: "Comercial", desc: "Funil de vendas, vendas e metas, calls e passagem para o Pós Venda" },
  { k: "marketing", label: "Marketing", desc: "Conteúdo, campanhas, lançamentos e redes" },
  { k: "posvenda", label: "Pós Venda", desc: "Mentoradas, pipeline, saúde, encontros e renovações" },
] as const;
export type Pilar = (typeof PILARES)[number]["k"];
export const NOME_PILAR = Object.fromEntries(PILARES.map(p => [p.k, p.label])) as Record<Pilar, string>;
export function temPilar(u: { papel: string; pilares?: string[] | null } | null | undefined, p: Pilar) {
  if (!u) return false;
  return u.papel === "admin" || (u.pilares ?? []).includes(p);
}

export const PERMISSOES = [
  { k: "cadastro", label: "Cadastro", desc: "Criar mentoradas e editar dados cadastrais (contato, área, DISC, saúde…)" },
  { k: "jornada", label: "Jornada", desc: "Marcar datas das etapas e encontros extras" },
  { k: "presencas", label: "Presenças", desc: "Registrar presença e falta nos encontros ao vivo" },
  { k: "acompanhamento", label: "Acompanhamento", desc: "Registrar acompanhamentos, observações e importar varreduras" },
  { k: "comercial", label: "Contratos e renovações", desc: "Programa, status, datas de contrato, renovações e negociação" },
  { k: "excluir", label: "Excluir", desc: "Apagar registros (acompanhamentos, observações, renovações, varreduras)" },
  { k: "equipe", label: "Equipe e atividades", desc: "Criar acessos, mudar permissões e ver o registro de atividades" },
] as const;

export type Permissao = (typeof PERMISSOES)[number]["k"];

export const PAPEIS: { k: string; label: string; permissoes: Permissao[]; pilares: Pilar[] }[] = [
  { k: "admin", label: "Administradora", permissoes: PERMISSOES.map(p => p.k), pilares: PILARES.map(p => p.k) },
  { k: "mentora", label: "Mentora", permissoes: ["cadastro", "jornada", "presencas", "acompanhamento"], pilares: ["posvenda"] },
  { k: "suporte", label: "Suporte", permissoes: ["cadastro", "presencas", "acompanhamento"], pilares: ["posvenda"] },
  { k: "vendas", label: "Vendas", permissoes: [], pilares: ["comercial"] },
  { k: "marketing", label: "Marketing", permissoes: [], pilares: ["marketing"] },
  { k: "leitura", label: "Somente leitura", permissoes: [], pilares: ["posvenda"] },
];

export const rotuloPapel = (k: string) => PAPEIS.find(p => p.k === k)?.label ?? k;

// Campos do cadastro que são da área comercial (o resto é "cadastro").
export const CAMPOS_COMERCIAIS = new Set([
  "tipo", "status", "inicio", "prazo", "duracao", "cancelamento", "congelamentoPedido", "congelamentoAte", "congelamentoMotivo", "mesesAntes", "negociacao", "renovacaoStatus",
]);

export function pode(u: { papel: string; permissoes?: string[] | null } | null | undefined, p: Permissao) {
  if (!u) return false;
  return u.papel === "admin" || (u.permissoes ?? []).includes(p);
}

// Registros do diário: só quem escreveu ou uma administradora edita e exclui.
const mesmoNome = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
export function ehAutora(u: { nome: string; papel: string } | null | undefined, autor: string | null | undefined) {
  if (!u) return false;
  return u.papel === "admin" || (!!autor && mesmoNome(autor, u.nome));
}

export const NOME_PERMISSAO =Object.fromEntries(PERMISSOES.map(p => [p.k, p.label])) as Record<Permissao, string>;
