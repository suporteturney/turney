import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirUsuario, semPermissao } from "@/lib/auth";
import { registrarAtividade } from "@/lib/atividade";
import { LISTAS, type Banda } from "@/lib/varredura";
import { recalcularSaude } from "@/lib/saude-servidor";

const BANDAS_OK = new Set(["vermelho", "amarelo", "verde"]);
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const lista = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()).map(x => x.trim()) : []);

function textoAcompanhamento(i: Record<string, unknown>) {
  const partes = [str(i.status)];
  const bloco = (titulo: string, xs: string[]) => (xs.length ? `${titulo}:\n${xs.map(x => `• ${x}`).join("\n")}` : null);
  partes.push(bloco("Pendências", lista(i.pendencias)));
  partes.push(bloco("Pontos de atenção", lista(i.atencao)));
  partes.push(bloco("Próximos passos", lista(i.proximos)));
  return partes.filter(Boolean).join("\n\n") || str(i.tag) || "Varredura de WhatsApp";
}

export async function POST(req: NextRequest) {
  const usuario = await exigirUsuario();
  const negado = semPermissao(usuario, "acompanhamento");
  if (negado) return negado;
  const body = await req.json();

  const data = str(body.data);
  const itens = Array.isArray(body.itens) ? (body.itens as Record<string, unknown>[]) : [];
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return NextResponse.json({ erro: "Informe a data da varredura." }, { status: 400 });
  }
  const validos = itens.filter(i => str(i.nome) && BANDAS_OK.has(String(i.banda)));
  if (!validos.length) {
    return NextResponse.json({ erro: "A varredura não tem mentoradas válidas." }, { status: 400 });
  }

  const ids = [...new Set(validos.map(i => str(i.mentoradaId)).filter((x): x is string => !!x))];
  const existentes = new Set((await prisma.mentorada.findMany({ where: { id: { in: ids } }, select: { id: true } })).map(m => m.id));
  const dataVarredura = new Date(`${data}T12:00:00.000Z`);
  const analise = (body.analise ?? {}) as Record<string, unknown>;

  const varredura = await prisma.$transaction(async tx => {
    const v = await tx.varredura.create({
      data: {
        data: dataVarredura,
        programa: str(body.programa),
        titulo: str(body.titulo),
        autor: usuario.nome,
        bom: lista(analise.bom),
        ruim: lista(analise.ruim),
        invisivel: lista(analise.invisivel),
        melhorias: lista(analise.melhorias),
      },
    });

    const linhas = validos.map(i => {
      const mid = str(i.mentoradaId);
      return { i, mentoradaId: mid && existentes.has(mid) ? mid : null, banda: String(i.banda) as Banda };
    });

    await tx.varreduraItem.createMany({
      data: linhas.map(({ i, mentoradaId, banda }) => ({
        varreduraId: v.id,
        mentoradaId,
        nome: str(i.nome)!,
        banda,
        tag: str(i.tag),
        etapa: str(i.etapa),
        status: str(i.status),
        mensagem: str(i.mensagem),
        prioridade: Number.isInteger(i.prioridade) ? (i.prioridade as number) : null,
        prioridadeMotivo: str(i.prioridadeMotivo),
        ...Object.fromEntries(LISTAS.map(c => [c, lista(i[c])])),
      })),
    });

    const casadas = linhas.filter(l => l.mentoradaId);
    if (body.registrarAcompanhamento !== false && casadas.length) {
      await tx.acompanhamento.createMany({
        data: casadas.map(({ i, mentoradaId }) => ({
          mentoradaId: mentoradaId!,
          data: dataVarredura,
          tipo: "Varredura WhatsApp",
          texto: textoAcompanhamento(i),
          autor: usuario.nome,
          varreduraId: v.id,
        })),
      });
    }

    if (body.atualizarSaude) {
      for (const { i, mentoradaId } of casadas) {
        await tx.mentorada.update({
          where: { id: mentoradaId! },
          data: { saudeMotivo: [str(i.tag), str(i.status)].filter(Boolean).join(" — ") || null, saudeMotivoEm: new Date() },
        });
      }
    }
    return v;
  }, { timeout: 30000, maxWait: 10000 });

  // A cor da varredura entra no cálculo da saúde (src/lib/saude.ts) junto com jornada e encontros.
  if (body.atualizarSaude) await recalcularSaude([...existentes]);
  await registrarAtividade(usuario, {
    acao: "importou", entidade: "varredura",
    resumo: `Importou a varredura ${str(body.programa) ?? ""} de ${data.split("-").reverse().join("/")} (${validos.length} mentoradas)`,
    detalhe: { varreduraId: varredura.id },
  });

  return NextResponse.json({ id: varredura.id }, { status: 201 });
}
