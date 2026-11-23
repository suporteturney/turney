import { PROGRAMAS } from "@/lib/comercial";

export const SEM_VENDEDORA = "A definir"; // venda da Hubla de alguém que não estava no funil

// Avisos de fatura da Hubla (pagamento aprovado e reembolso) → venda no Comercial.
// Documentação: hubla.gitbook.io/docs/webhooks/eventos/fatura e /como-enviar-seus-dados.

export type VendaHubla = {
  tipo: "paga" | "reembolsada";
  fatura: string; // código da venda: parentInvoiceId ?? invoice.id (no modo de compatibilidade há vários avisos da mesma venda)
  cliente: string; email: string | null; whatsapp: string | null;
  produto: string; programa: string; valorCentavos: number; pagamento: string | null; data: Date;
  utm: { source?: string; medium?: string; campaign?: string } | null;
};

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const txt = (v: unknown) => (typeof v === "string" && v.trim() && v.trim() !== "-" ? v.trim() : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null);
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// "Mentoria Nexus 2" → "Nexus 2"; "Mentoria Atlas" → "Atlas". Produto desconhecido fica com o nome da Hubla.
export function programaDoProduto(nome: string) {
  const n = norm(nome);
  const nexus = n.match(/nexus\s*(\d)/);
  if (nexus && PROGRAMAS.includes(`Nexus ${nexus[1]}`)) return `Nexus ${nexus[1]}`;
  for (const p of PROGRAMAS) if (!/^nexus/i.test(p) && new RegExp(`\\b${norm(p)}\\b`).test(n)) return p;
  return nome.replace(/^mentoria\s+/i, "").slice(0, 60) || "Hubla";
}

function pagamentoDe(inv: Obj): string | null {
  const metodo = txt(inv.paymentMethod);
  const parcelas = num(inv.installments) ?? 1;
  const smart = obj(inv.smartInstallment);
  if (num(smart.installments)) return `Parcelamento inteligente ${num(smart.installments)}x`;
  if (metodo === "pix") return "Pix à vista";
  if (metodo === "bank_slip") return "Boleto";
  if (metodo === "credit_card" || metodo === "apple_pay" || metodo === "google_pay") {
    const nome = metodo === "credit_card" ? "Cartão" : metodo === "apple_pay" ? "Apple Pay" : "Google Pay";
    return parcelas > 1 ? `${nome} em ${parcelas}x` : `${nome} à vista`;
  }
  return metodo;
}

// null = aviso que não vira venda (outros eventos, renovação de assinatura, 2ª parcela em diante do parcelamento inteligente…).
export function lerVendaHubla(corpo: unknown): VendaHubla | null {
  const c = obj(corpo);
  const tipo = c.type === "invoice.payment_succeeded" ? "paga" : c.type === "invoice.refunded" ? "reembolsada" : null;
  if (!tipo) return null;
  const ev = obj(c.event), inv = obj(ev.invoice);
  const fatura = txt(inv.parentInvoiceId) ?? txt(inv.id);
  if (!fatura) return null;
  const tipoFatura = txt(inv.type);
  if (tipoFatura && tipoFatura !== "sell") return null; // renovações e outros tipos não são venda nova
  const smart = obj(inv.smartInstallment);
  const parcela = num(smart.installment);
  if (parcela && parcela > 1) return null;

  const user = obj(ev.user), payer = obj(inv.payer);
  const email = (txt(user.email) ?? txt(payer.email))?.toLowerCase() ?? null;
  const whatsapp = txt(user.phone) ?? txt(payer.phone);
  const cliente = [txt(user.firstName) ?? txt(payer.firstName), txt(user.lastName) ?? txt(payer.lastName)].filter(Boolean).join(" ") || email || "Cliente Hubla";
  const produtos = (Array.isArray(ev.products) ? ev.products : []).map(p => txt(obj(p).name)).filter((x): x is string => !!x);
  const produto = (produtos.length ? [...new Set(produtos)].join(" + ") : txt(obj(ev.product).name)) ?? "Produto Hubla";
  const amount = obj(inv.amount);
  let valor = num(amount.totalCents) ?? (num(amount.total) !== null ? num(amount.total)! * 100 : 0);
  const totalParcelas = num(smart.installments);
  if (totalParcelas && totalParcelas > 1) valor *= totalParcelas; // parcelamento inteligente: o aviso traz só a 1ª parcela
  const statusAt = Array.isArray(inv.statusAt) ? inv.statusAt.map(obj) : [];
  const pagoEm = statusAt.find(s => s.status === "paid")?.when;
  const dataTxt = txt(inv.saleDate) ?? txt(pagoEm) ?? txt(inv.createdAt);
  const data = dataTxt && !Number.isNaN(Date.parse(dataTxt)) ? new Date(dataTxt) : new Date();
  const u = obj(obj(inv.paymentSession).utm);
  const utm = { source: txt(u.source) ?? undefined, medium: txt(u.medium) ?? undefined, campaign: txt(u.campaign) ?? undefined };

  return {
    tipo, fatura: fatura.slice(0, 80), cliente: cliente.slice(0, 120), email, whatsapp, produto: produto.slice(0, 200),
    programa: programaDoProduto(produtos[0] ?? produto), valorCentavos: Math.round(valor), pagamento: pagamentoDe(inv), data,
    utm: utm.source || utm.medium || utm.campaign ? utm : null,
  };
}

// Relatório "Vendas" exportado da Hubla (xlsx). Uma linha por fatura.
const normH = (s: string) => norm(s).replace(/\s+/g, " ").trim();
export function lerVendasPlanilhaHubla(linhas: string[][]): { vendas: VendaHubla[]; ignoradas: number; erro?: string } {
  const cab = (linhas[0] ?? []).map(normH);
  const col = (nome: string) => cab.indexOf(normH(nome));
  const iId = col("ID da fatura"), iStatus = col("Status da fatura"), iTotal = col("Valor total");
  if (iId < 0 || iStatus < 0 || iTotal < 0) return { vendas: [], ignoradas: 0, erro: "Essa planilha não parece ser o relatório de Vendas da Hubla (faltam as colunas ID da fatura, Status da fatura ou Valor total)." };
  const pega = (l: string[], nome: string) => { const i = col(nome); return i >= 0 ? (l[i] ?? "").trim() : ""; };
  const dataBr = (t: string) => {
    const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
    return m ? new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4] ?? "12"}:${m[5] ?? "00"}:${m[6] ?? "00"}-03:00`) : null;
  };
  const vendas: VendaHubla[] = [];
  let ignoradas = 0;
  for (const l of linhas.slice(1)) {
    const id = pega(l, "ID da fatura");
    if (!id) continue;
    const status = normH(pega(l, "Status da fatura"));
    const tipo = normH(pega(l, "Tipo de fatura"));
    const parcela = Number(pega(l, "Parcela do parcelamento inteligente")) || null;
    const pagou = /^paga|reembols/.test(status);
    if (!pagou || (tipo && !/compra|venda/.test(tipo)) || (parcela && parcela > 1)) { ignoradas++; continue; }
    const total = Number(pega(l, "Valor total").replace(",", "."));
    const nParcSmart = Number(pega(l, "Total de parcelas do parcelamento inteligente")) || null;
    const metodo = normH(pega(l, "Método de pagamento"));
    const parcelas = Number(pega(l, "Parcelas")) || 1;
    const pagamento = nParcSmart ? `Parcelamento inteligente ${nParcSmart}x`
      : /pix/.test(metodo) ? "Pix à vista" : /boleto/.test(metodo) ? "Boleto"
      : /cartao|credito|apple|google/.test(metodo) ? `Cartão ${parcelas > 1 ? `em ${parcelas}x` : "à vista"}` : pega(l, "Método de pagamento") || null;
    const produto = [pega(l, "Nome do produto"), pega(l, "Nome do produto de orderbump")].filter(Boolean).join(" + ") || "Produto Hubla";
    const data = dataBr(pega(l, "Data de pagamento")) ?? dataBr(pega(l, "Data de criação")) ?? new Date();
    const utm = { source: pega(l, "UTM Origem") || undefined, medium: pega(l, "UTM Mídia") || undefined, campaign: pega(l, "UTM Campanha") || undefined };
    const base: VendaHubla = {
      tipo: "paga", fatura: (pega(l, "Fatura original") || id).slice(0, 80), cliente: (pega(l, "Nome do cliente") || pega(l, "Email do cliente") || "Cliente Hubla").slice(0, 120),
      email: pega(l, "Email do cliente").toLowerCase() || null, whatsapp: pega(l, "Telefone do cliente") || null,
      produto: produto.slice(0, 200), programa: programaDoProduto(pega(l, "Nome do produto") || produto),
      valorCentavos: Math.round((Number.isFinite(total) ? total : 0) * 100 * (nParcSmart && nParcSmart > 1 ? nParcSmart : 1)),
      pagamento, data, utm: utm.source || utm.medium || utm.campaign ? utm : null,
    };
    vendas.push(base);
    if (/reembols/.test(status)) vendas.push({ ...base, tipo: "reembolsada" }); // entra e já sai cancelada
  }
  return { vendas, ignoradas };
}
