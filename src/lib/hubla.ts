// Avisos da área de membros da Hubla → registro enxuto (sem pagamento, documento ou endereço).
// Tipos aceitos: customer.member_added, customer.member_removed, member.module_completed, member.course_completed.

export type TipoHubla = "acesso_liberado" | "acesso_removido" | "modulo_concluido" | "curso_concluido";
export type RegistroHubla = {
  chave: string; tipo: TipoHubla; email: string; nome: string | null;
  produtoId: string | null; produto: string | null; modulo: string | null; data: Date;
};

export const ROTULO_HUBLA: Record<TipoHubla, string> = {
  acesso_liberado: "Acesso liberado",
  acesso_removido: "Acesso removido",
  modulo_concluido: "Concluiu módulo",
  curso_concluido: "Concluiu o curso",
};

const TIPOS: Record<string, TipoHubla> = {
  "customer.member_added": "acesso_liberado",
  "customer.member_removed": "acesso_removido",
  "member.module_completed": "modulo_concluido",
  "member.course_completed": "curso_concluido",
};

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});
const txt = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const quando = (...vs: unknown[]) => {
  for (const v of vs) {
    const t = txt(v);
    if (t && !Number.isNaN(Date.parse(t))) return new Date(t);
  }
  return null;
};

// null = aviso que não interessa (ex.: financeiro) ou sem e-mail.
export function lerAvisoHubla(corpo: unknown): RegistroHubla | null {
  const c = obj(corpo);
  const tipo = TIPOS[String(c.type ?? "")];
  if (!tipo) return null;
  const ev = obj(c.event);
  const sub = obj(ev.subscription);
  const user = obj(ev.user), payer = obj(sub.payer);
  const email = (txt(user.email) ?? txt(payer.email))?.toLowerCase();
  if (!email) return null;
  const nome = [txt(user.firstName) ?? txt(payer.firstName), txt(user.lastName) ?? txt(payer.lastName)].filter(Boolean).join(" ") || null;
  const produto = obj(ev.product);
  const modulo = obj(ev.module);
  const data =
    tipo === "acesso_liberado" ? quando(sub.activatedAt, sub.statusAt, sub.modifiedAt) :
    tipo === "acesso_removido" ? quando(sub.inactivatedAt, sub.statusAt, sub.modifiedAt) :
    quando(ev.completedAt);
  const d = data ?? new Date();
  const produtoId = txt(produto.id);
  // Conclusões: a Hubla manda um aviso por oferta — guarda um só por pessoa + curso + módulo.
  // Acessos: um por pessoa + produto + mudança de status.
  const chave = tipo === "modulo_concluido" || tipo === "curso_concluido"
    ? [tipo, email, produtoId ?? txt(produto.name), txt(modulo.id) ?? ""].join("|")
    : [tipo, email, produtoId ?? txt(produto.name), txt(sub.id) ?? "", d.toISOString()].join("|");
  return {
    chave, tipo, email, nome, produtoId, produto: txt(produto.name), modulo: txt(modulo.name), data: d,
  };
}
