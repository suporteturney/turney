import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { TIPOS_DOCUMENTO } from "@/lib/documentos";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await exigirUsuario();
  const { id } = await params;
  const doc = await prisma.documento.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ erro: "Documento não encontrado." }, { status: 404 });

  const modo = doc.tipo === TIPOS_DOCUMENTO.pdf ? "inline" : "attachment";
  return new NextResponse(Buffer.from(doc.conteudo), {
    headers: {
      "Content-Type": doc.tipo,
      "Content-Disposition": `${modo}; filename*=UTF-8''${encodeURIComponent(doc.nome)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
