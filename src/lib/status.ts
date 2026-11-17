// Todos os status da mentorada, na ordem em que aparecem nos filtros.
export const STATUS_MENTORADA = ["Ativo", "Em Andamento", "Em Renovação", "Congelado", "Encerrado", "Churn"];

// Opções de filtro: os status fixos e qualquer outro que exista nos dados.
export const opcoesStatus = (usados: (string | null)[]) => [
  ...STATUS_MENTORADA,
  ...[...new Set(usados.filter((s): s is string => !!s && !STATUS_MENTORADA.includes(s)))].sort((a, b) => a.localeCompare(b, "pt-BR")),
];
