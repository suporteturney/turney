import "server-only";
import { randomBytes } from "node:crypto";
import { PERMISSOES } from "@/lib/permissoes";

const VALIDAS = new Set<string>(PERMISSOES.map(p => p.k));

export const limparPermissoes = (v: unknown) =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && VALIDAS.has(x)))] : [];

// Senha provisória legível (sem letras ambíguas), trocada pela pessoa no primeiro acesso.
export function senhaProvisoria() {
  const abc = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return [...randomBytes(12)].map(b => abc[b % abc.length]).join("");
}
