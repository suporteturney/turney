// Comercial — listas e contas usadas no servidor e no navegador.

export const PROGRAMAS = ["Nexus 1", "Nexus 2", "Nexus 3", "Atlas", "Delta", "MCR", "FCI", "CP1", "Personalizado"];
// Duração mais comum dos contratos de cada programa (sugestão ao fechar a venda).
export const duracaoPadrao = (programa: string) => (programa === "CP1" ? 12 : 6);
// Mesmas origens do cadastro de mentoradas, para a análise por origem continuar valendo no Pós Venda.
export const ORIGENS = ["Fluxo de Vendas", "Indicação", "Lives / Eventos", "Instagram", "LinkedIn", "YouTube", "Parceria", "Upsell / Upgrade", "Outra"];
export const PAGAMENTOS = ["Pix à vista", "Cartão à vista", "Cartão parcelado", "Boleto parcelado", "Entrada + parcelas", "Outro"];
export const MOTIVOS_PERDA = ["Preço", "Sem retorno", "Não é o momento", "Escolheu outra opção", "Não tem o perfil", "Outro"];
export const RESULTADOS = [
  { k: "compareceu", label: "Compareceu" },
  { k: "fechou", label: "Fechou" },
  { k: "faltou", label: "Faltou" },
  { k: "remarcou", label: "Remarcou" },
] as const;
export const NOME_RESULTADO = Object.fromEntries(RESULTADOS.map(r => [r.k, r.label])) as Record<string, string>;

export const reais = (centavos: number | null | undefined, curto = false) => {
  if (centavos == null) return "—";
  const v = centavos / 100;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: curto || Number.isInteger(v) ? 0 : 2 });
};

// "1.997,50", "R$ 2000" ou "2000.5" → centavos. Vazio ou inválido → null.
export function centavos(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) : null;
  if (typeof v !== "string") return null;
  let t = v.replace(/[^\d.,]/g, "");
  if (!t) return null;
  const virgula = t.lastIndexOf(","), ponto = t.lastIndexOf(".");
  if (virgula > ponto) t = t.replace(/\./g, "").replace(",", ".");
  else if (ponto > virgula && virgula >= 0) t = t.replace(/,/g, "");
  else if (ponto >= 0 && (t.length - ponto - 1 === 3 || t.indexOf(".") !== ponto)) t = t.replace(/\./g, ""); // 2.000 = dois mil
  const n = parseFloat(t);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

export const nomeMes = (mes: string) =>
  new Date(`${mes}-15T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
export const somarMes = (mes: string, n: number) => {
  const d = new Date(`${mes}-15T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
};
// Fim do contrato: início + meses, sem estourar o mês (31/08 + 6 = 28/02).
export function fimDoContrato(inicio: string, meses: number) {
  const [a, m, d] = inicio.slice(0, 10).split("-").map(Number);
  const ultimo = new Date(Date.UTC(a, m - 1 + meses + 1, 0)).getUTCDate();
  return new Date(Date.UTC(a, m - 1 + meses, Math.min(d, ultimo)));
}
export const linkWhats = (n: string | null | undefined) => {
  const d = (n ?? "").replace(/\D/g, "");
  return d ? `https://wa.me/${d.length <= 11 && !n!.trim().startsWith("+") ? `55${d}` : d}` : null;
};
