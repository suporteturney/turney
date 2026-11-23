import { NextResponse } from "next/server";
import { exigirUsuario } from "@/lib/auth";
import { negar, podeOperar } from "@/lib/pipeline-servidor";
import { temPilar } from "@/lib/permissoes";
import { sincronizarAgendas } from "@/lib/agenda-servidor";

export const maxDuration = 60;

// Botão "Buscar na agenda agora" do Pipeline.
export async function POST() {
  const usuario = await exigirUsuario();
  const negado = negar(usuario, podeOperar(usuario) || temPilar(usuario, "comercial"), ["jornada", "acompanhamento"]);
  if (negado) return negado;
  const r = await sincronizarAgendas({ forcar: true });
  if (!r.configurado) {
    return NextResponse.json({ erro: "Nenhuma agenda ligada ainda. Cadastre o link da agenda em Administração › Agendas." }, { status: 400 });
  }
  return NextResponse.json(r);
}
