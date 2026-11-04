// Número no formato que o ManyChat aceita: só dígitos, com DDI (ex: +5511999998888).
// Sem DDI e com 10 ou 11 dígitos, assume Brasil (+55).
export function whatsappComDDI(v: string | null | undefined) {
  let digitos = (v ?? "").replace(/\D/g, "");
  if (!digitos) return null;
  if (digitos.length === 10 || digitos.length === 11) digitos = `55${digitos}`;
  return `+${digitos}`;
}
