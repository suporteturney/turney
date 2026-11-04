import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import { exigirUsuario, semPermissao } from "@/lib/auth";
import { lerDocumento, TIPOS_DOCUMENTO, type DocumentoLido } from "@/lib/documentos";
import { resumirRoadmap } from "@/lib/roadmap";

async function textoDo(doc: DocumentoLido) {
  if (doc.tipo === TIPOS_DOCUMENTO.docx) return (await mammoth.extractRawText({ buffer: doc.bytes })).value;
  const pdf = await getDocumentProxy(new Uint8Array(doc.bytes));
  return (await extractText(pdf, { mergePages: true })).text;
}

// Lê o documento e devolve o resumo para a mentora revisar. Nada é gravado aqui.
export async function POST(req: NextRequest) {
  const usuario = await exigirUsuario();
  const negado = semPermissao(usuario, "acompanhamento");
  if (negado) return negado;

  const arquivo = (await req.formData()).get("arquivo");
  if (!(arquivo instanceof File)) return NextResponse.json({ erro: "Escolha o documento do roadmap." }, { status: 400 });
  const doc = await lerDocumento(arquivo);
  if ("erro" in doc) return NextResponse.json({ erro: doc.erro }, { status: 400 });

  const texto = await textoDo(doc).catch(() => "");
  if (!texto.trim()) {
    return NextResponse.json({ erro: "Não encontrei texto nesse arquivo (pode ser uma imagem escaneada). Escreva o resumo no campo acima; o documento fica anexado do mesmo jeito." }, { status: 422 });
  }
  const resumo = resumirRoadmap(texto);
  if (!resumo) {
    return NextResponse.json({ erro: "Esse documento não segue o modelo de roadmap. Escreva o resumo no campo acima; o documento fica anexado do mesmo jeito." }, { status: 422 });
  }
  return NextResponse.json({ texto: resumo });
}
