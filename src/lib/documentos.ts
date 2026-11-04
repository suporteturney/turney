// Regras dos arquivos anexados ao diário. Sem imports de servidor: a tela usa o limite e os tipos aceitos.
export const TAMANHO_MAXIMO = 4 * 1024 * 1024; // a Vercel recusa envios acima de 4,5 MB

export const TIPOS_DOCUMENTO = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const;

export const ACEITA_DOCUMENTO = ".pdf,.docx";

export type DocumentoLido = { nome: string; tipo: string; bytes: Buffer<ArrayBuffer> };

export async function lerDocumento(arquivo: File): Promise<DocumentoLido | { erro: string }> {
  if (!arquivo.size) return { erro: "O arquivo está vazio." };
  if (arquivo.size > TAMANHO_MAXIMO) return { erro: "O arquivo passa de 4 MB. Envie uma versão menor." };
  const bytes = Buffer.from(await arquivo.arrayBuffer());
  const assinatura = bytes.subarray(0, 4).toString("latin1");
  const extensao = arquivo.name.split(".").pop()?.toLowerCase();
  if (extensao === "pdf" && assinatura === "%PDF") return { nome: arquivo.name, tipo: TIPOS_DOCUMENTO.pdf, bytes };
  if (extensao === "docx" && assinatura.startsWith("PK")) return { nome: arquivo.name, tipo: TIPOS_DOCUMENTO.docx, bytes };
  return { erro: "Envie o documento em PDF ou Word (.docx)." };
}
