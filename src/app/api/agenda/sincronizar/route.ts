import { NextResponse } from "next/server";
import { exigirUsuario } from "@/lib/auth";
import { negar, podeOperar } from "@/lib/pipeline-servidor";
import { sincronizarAgendas } from "@/lib/agenda-servidor";

export const maxDuration = 60;

// Botão "Buscar na agenda agora" do Pipeline.
export async function POST() {
  const usuario = await exigirUsuario();
  const negado = negar(usuario, podeOperar(usuario), ["jornada", "acompanhamento"]);
  if (negado) return negado;
  const r = await sincronizarAgendas({ forcar: true });
  if (!r.configurado) {
    return NextResponse.json({ erro: "A agenda ainda não foi ligada (falta o link iCal secreto na Vercel)." }, { status: 400 });
  }
  return NextResponse.json(r);
}
