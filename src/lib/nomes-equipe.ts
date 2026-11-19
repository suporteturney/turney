// Nome curto ou com outra grafia ("Daryane", "eduarda") → nome completo de quem tem acesso.
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const partes = (s: string) => norm(s).split(/\s+/).filter(Boolean);

export function casaNome(nomeCompleto: string, escrito: string | null | undefined) {
  if (!escrito) return false;
  const u = partes(nomeCompleto);
  const c = partes(escrito);
  return c.length > 0 && c.every(p => u.includes(p));
}

export function nomeDaEquipe(escrito: string | null | undefined, equipe: string[]) {
  const t = (escrito ?? "").trim();
  if (!t) return null;
  const achados = equipe.filter(n => casaNome(n, t));
  return achados.length === 1 ? achados[0] : t; // se for ambíguo, mantém o que foi escrito
}
