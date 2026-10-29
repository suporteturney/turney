import { prisma } from "@/lib/prisma";
import { exigirUsuario, type UsuarioSessao } from "@/lib/auth";
import { pode } from "@/lib/permissoes";
import AcompanhamentoCliente from "./AcompanhamentoCliente";
import DiarioMentoradas from "./DiarioMentoradas";

const ATIVOS = ["Ativo", "Em Andamento", "Em Renovação"];

export default async function AcompanhamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ programa?: string; v?: string; visao?: string; m?: string }>;
}) {
  const usuario = await exigirUsuario();
  const { programa = "", v = "", visao = "", m = "" } = await searchParams;
  if (visao !== "varreduras") return <DiarioPagina usuario={usuario} selecionadaId={m} />;

  const [varreduras, base] = await Promise.all([
    prisma.varredura.findMany({
      orderBy: { data: "desc" },
      select: { id: true, data: true, programa: true, titulo: true, autor: true, _count: { select: { itens: true } } },
    }),
    prisma.mentorada.findMany({
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, tipo: true, status: true, codigo: true, whatsapp: true, prazo: true },
    }),
  ]);

  const ultimaPorPrograma = new Map<string, (typeof varreduras)[number]>();
  for (const s of varreduras) {
    const k = s.programa ?? "Sem programa";
    if (!ultimaPorPrograma.has(k)) ultimaPorPrograma.set(k, s);
  }

  const doPrograma = programa ? varreduras.filter(s => (s.programa ?? "Sem programa") === programa) : [];
  const selecionada = programa ? doPrograma.find(s => s.id === v) ?? doPrograma[0] ?? null : null;
  const idsVista = programa ? (selecionada ? [selecionada.id] : []) : [...ultimaPorPrograma.values()].map(s => s.id);

  const itens = idsVista.length
    ? await prisma.varreduraItem.findMany({
        where: { varreduraId: { in: idsVista } },
        include: { varredura: { select: { id: true, data: true, programa: true } } },
      })
    : [];

  const comMentorada = itens.filter(i => i.mentoradaId);
  const anteriores = comMentorada.length
    ? await prisma.varreduraItem.findMany({
        where: {
          mentoradaId: { in: comMentorada.map(i => i.mentoradaId!) },
          varreduraId: { notIn: idsVista },
        },
        orderBy: { varredura: { data: "desc" } },
        select: { mentoradaId: true, banda: true, tag: true, varredura: { select: { data: true } } },
      })
    : [];
  const anteriorDe = (mentoradaId: string, antesDe: Date) =>
    anteriores.find(a => a.mentoradaId === mentoradaId && a.varredura.data < antesDe) ?? null;

  const ultimasItens = await prisma.varreduraItem.findMany({
    where: { varreduraId: { in: [...ultimaPorPrograma.values()].map(s => s.id) } },
    select: { nome: true, banda: true, tag: true, varreduraId: true },
  });

  const programasCobertos = new Set(
    programa ? [programa] : [...ultimaPorPrograma.keys()]
  );
  const naVista = new Set(comMentorada.map(i => i.mentoradaId));
  const casa = (tipo: string, p: string) => tipo === p || tipo.startsWith(`${p} `);
  const semVarredura = base.filter(
    m => ATIVOS.includes(m.status) && [...programasCobertos].some(p => casa(m.tipo, p)) && !naVista.has(m.id)
  );

  const registros = await prisma.acompanhamento.findMany({
    where: { varreduraId: null },
    orderBy: { data: "desc" },
    take: 30,
    include: { mentorada: { select: { id: true, nome: true, tipo: true } } },
  });

  const porId = new Map(base.map(m => [m.id, m]));
  const iso = (d: Date | null) => d?.toISOString() ?? null;

  return (
    <AcompanhamentoCliente
      key={`${programa}|${selecionada?.id ?? ""}`}
      programa={programa}
      assinatura={usuario.nome.split(" ")[0]}
      varreduras={varreduras.map(s => ({
        id: s.id, data: s.data.toISOString(), programa: s.programa, titulo: s.titulo, autor: s.autor, total: s._count.itens,
      }))}
      selecionadaId={selecionada?.id ?? null}
      programasVista={[...ultimaPorPrograma.entries()].map(([p, s]) => ({ programa: p, id: s.id, data: s.data.toISOString() }))}
      itens={itens.map(i => {
        const m = i.mentoradaId ? porId.get(i.mentoradaId) : null;
        const ant = i.mentoradaId ? anteriorDe(i.mentoradaId, i.varredura.data) : null;
        return {
          ...i,
          varredura: { id: i.varredura.id, data: i.varredura.data.toISOString(), programa: i.varredura.programa },
          mentorada: m ? { id: m.id, tipo: m.tipo, status: m.status, codigo: m.codigo, whatsapp: m.whatsapp, prazo: iso(m.prazo) } : null,
          anterior: ant ? { banda: ant.banda, tag: ant.tag, data: ant.varredura.data.toISOString() } : null,
        };
      })}
      semVarredura={semVarredura.map(m => ({ id: m.id, nome: m.nome, tipo: m.tipo, status: m.status }))}
      base={base.map(m => ({ id: m.id, nome: m.nome, tipo: m.tipo, status: m.status }))}
      ultimas={[...ultimaPorPrograma.entries()].map(([p, s]) => ({
        programa: p,
        data: s.data.toISOString().slice(0, 10),
        itens: ultimasItens.filter(i => i.varreduraId === s.id).map(i => ({ nome: i.nome, banda: i.banda, tag: i.tag })),
      }))}
      registros={registros.map(r => ({
        id: r.id, data: r.data.toISOString(), tipo: r.tipo, texto: r.texto, autor: r.autor, marco: r.marco,
        marcoTitulo: r.marcoTitulo, mentorada: r.mentorada,
      }))}
    />
  );
}

// Diário das mentoradas: lista para escolher + histórico e registros da mentora escolhida.
async function DiarioPagina({ usuario, selecionadaId }: { usuario: UsuarioSessao; selecionadaId: string }) {
  const iso = (d: Date | null) => d?.toISOString() ?? null;
  const [lista, sel] = await Promise.all([
    prisma.mentorada.findMany({
      orderBy: { nome: "asc" },
      select: {
        id: true, nome: true, tipo: true, status: true, saude: true, saudeNota: true,
        acompanhamentos: {
          where: { varreduraId: null },
          orderBy: { data: "desc" },
          take: 1,
          select: { data: true, autor: true },
        },
      },
    }),
    selecionadaId
      ? prisma.mentorada.findUnique({
          where: { id: selecionadaId },
          include: {
            etapas: true,
            presencas: true,
            renovacoes: { orderBy: { data: "desc" } },
            acompanhamentos: { orderBy: [{ data: "desc" }, { createdAt: "desc" }] },
            observacoes: { orderBy: { data: "desc" } },
            varreduraItens: {
              orderBy: { varredura: { data: "desc" } },
              take: 1,
              include: { varredura: { select: { data: true } } },
            },
          },
        })
      : null,
  ]);

  return (
    <DiarioMentoradas
      autorPadrao={usuario.nome}
      podeRegistrar={pode(usuario, "acompanhamento")}
      eu={{ nome: usuario.nome, papel: usuario.papel }}
      lista={lista.map(x => ({
        id: x.id, nome: x.nome, tipo: x.tipo, status: x.status, saude: x.saude, saudeNota: x.saudeNota,
        ultimoRegistro: x.acompanhamentos[0] ? { data: x.acompanhamentos[0].data.toISOString(), autor: x.acompanhamentos[0].autor } : null,
      }))}
      selecionada={
        sel && {
          id: sel.id, nome: sel.nome, tipo: sel.tipo, status: sel.status, codigo: sel.codigo,
          inicio: iso(sel.inicio), prazo: iso(sel.prazo), saude: sel.saude, saudeNota: sel.saudeNota,
          saudeMotivo: sel.saudeMotivo, whatsapp: sel.whatsapp, linkedin: sel.linkedin, drive: sel.drive,
          disc: sel.disc, area: sel.area, localizacao: sel.localizacao, vagaCargo: sel.vagaCargo, vagaEmpresa: sel.vagaEmpresa,
          vagaData: iso(sel.vagaData),
          etapas: sel.etapas.map(e => ({ nome: e.nome, titulo: e.titulo, data: iso(e.data), programa: e.programa })),
          presencas: sel.presencas.map(p => ({ encontro: p.encontro, presente: p.presente })),
          renovacoes: sel.renovacoes.map(r => ({ acao: r.acao, destino: r.destino, data: r.data.toISOString() })),
          acompanhamentos: sel.acompanhamentos.map(a => ({
            id: a.id, data: a.data.toISOString(), criadoEm: a.createdAt.toISOString(), tipo: a.tipo, texto: a.texto,
            autor: a.autor, marco: a.marco, marcoTitulo: a.marcoTitulo, daVarredura: !!a.varreduraId,
          })),
          observacoes: sel.observacoes.map(o => ({ id: o.id, data: o.data.toISOString(), texto: o.texto, autor: o.autor })),
          varredura: sel.varreduraItens[0]
            ? {
                data: sel.varreduraItens[0].varredura.data.toISOString(), banda: sel.varreduraItens[0].banda,
                tag: sel.varreduraItens[0].tag, etapa: sel.varreduraItens[0].etapa, status: sel.varreduraItens[0].status,
                pendencias: sel.varreduraItens[0].pendencias, proximos: sel.varreduraItens[0].proximos,
              }
            : null,
        }
      }
    />
  );
}
