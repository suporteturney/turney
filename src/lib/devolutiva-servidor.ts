import "server-only";
import { prisma } from "@/lib/prisma";
import { registrarAtividade } from "@/lib/atividade";
import { etapaFields } from "@/lib/jornada";
import { hojeISO } from "@/lib/dias-uteis";
import { recalcularSaude } from "@/lib/saude-servidor";
import { avisarPessoas } from "@/lib/notificacoes";
import { lerXlsxAbas } from "@/lib/xlsx-simples";
import { dataBr, lerPlanilhaDevolutivas, mesmoNome, norm, type LinhaDevolutiva } from "@/lib/devolutiva";

// A planilha da mentora de devolutiva comportamental fica no Drive dela, aberta para quem tem o link.
// O painel relê a planilha de tempos em tempos (no máximo a cada 15 minutos, quando alguém usa o painel)
// e lança as devolutivas novas no cadastro da mentorada, avisando as administradoras.

export const CHAVE_PLANILHA = "disc_planilha"; // { id, mentora, avisar }
const CHAVE_STATUS = "disc_status"; // { em, ok, erro?, linhas }
const CHAVE_PRIMEIRA = "disc_primeira_leitura";
const CHAVE_ULTIMA = "disc_ultima_leitura";
const INTERVALO = 15 * 60_000;
let ultimaVez = 0;

export type ConfigPlanilha = { id: string; mentora: string; avisar?: string[] };
export type StatusPlanilha = { em: string; ok: boolean; erro?: string; linhas?: number };
export type ResultadoDevolutivas = {
  configurado: boolean; lidas: number; novas: number; lancadas: number; avisos: number; semCadastro: number; erro?: string;
};

async function lerConfig<T>(chave: string): Promise<T | null> {
  const c = await prisma.configuracao.findUnique({ where: { chave } }).catch(() => null);
  if (!c) return null;
  try { return JSON.parse(c.valor) as T; } catch { return null; }
}
async function gravar(chave: string, valor: unknown, por?: string) {
  const v = typeof valor === "string" ? valor : JSON.stringify(valor);
  await prisma.configuracao.upsert({ where: { chave }, update: { valor: v, atualizadaPor: por }, create: { chave, valor: v, atualizadaPor: por } });
}

export const configDaPlanilha = () => lerConfig<ConfigPlanilha>(CHAVE_PLANILHA);
export const statusDaPlanilha = () => lerConfig<StatusPlanilha>(CHAVE_STATUS);
export const salvarConfigPlanilha = (c: ConfigPlanilha | null, por: string) =>
  c ? gravar(CHAVE_PLANILHA, c, por) : prisma.configuracao.deleteMany({ where: { chave: CHAVE_PLANILHA } });

async function podeLerAgora() {
  const agora = new Date().getTime();
  if (agora - ultimaVez < INTERVALO) return false;
  ultimaVez = agora;
  const conf = await prisma.configuracao.findUnique({ where: { chave: CHAVE_ULTIMA } }).catch(() => null);
  if (conf && agora - new Date(conf.valor).getTime() < INTERVALO) return false;
  await gravar(CHAVE_ULTIMA, new Date().toISOString()).catch(() => {});
  return true;
}

// Baixa o arquivo pelo link aberto do Drive (planilha .xlsx enviada ao Drive ou planilha do Google).
export async function baixarPlanilha(id: string): Promise<Buffer> {
  const enderecos = [
    `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`,
    `https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/export?format=xlsx`,
  ];
  for (const url of enderecos) {
    const r = await fetch(url, { redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(20_000) }).catch(() => null);
    if (!r || !r.ok) continue;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b) return buf; // "PK": arquivo .xlsx
  }
  throw new Error("Não consegui abrir a planilha. Confira se o link está liberado para \"qualquer pessoa com o link\".");
}

type M = { id: string; nome: string; email: string | null; tipo: string; disc: string | null };

function acharMentorada(l: LinhaDevolutiva, ms: M[]): M | null {
  if (l.email) {
    const e = ms.find(m => norm(m.email) === l.email);
    if (e) return e;
  }
  const exato = ms.filter(m => norm(m.nome) === norm(l.nome));
  if (exato.length === 1) return exato[0];
  const parecido = ms.filter(m => mesmoNome(m.nome, l.nome));
  return parecido.length === 1 ? parecido[0] : null;
}

const linkDa = (m: { nome: string }) => `/mentorados?q=${encodeURIComponent(m.nome)}`;

// Lança a devolutiva no cadastro: data na jornada (se ainda não tinha), perfil DISC (se vazio) e uma observação.
// Na primeira leitura (histórico da planilha) a observação só entra quando há resumo, para não encher o cadastro.
async function lancar(m: M, l: LinhaDevolutiva, mentora: string, historico: boolean) {
  const feitos: string[] = [];
  if (l.data && etapaFields(m.tipo).some(f => f.key === "devolutiva")) {
    const ja = await prisma.etapa.findFirst({ where: { mentoradaId: m.id, nome: "devolutiva", programa: { in: [m.tipo, ""] }, data: { not: null } } });
    if (!ja) {
      await prisma.etapa.upsert({
        where: { mentoradaId_programa_nome: { mentoradaId: m.id, programa: m.tipo, nome: "devolutiva" } },
        update: { data: new Date(l.data) },
        create: { mentoradaId: m.id, programa: m.tipo, nome: "devolutiva", data: new Date(l.data) },
      });
      feitos.push("data na jornada");
    }
  }
  if (!m.disc?.trim() && l.perfil) {
    await prisma.mentorada.update({ where: { id: m.id }, data: { disc: l.perfil } });
    m.disc = l.perfil;
    feitos.push("perfil DISC");
  }
  const partes = [l.perfil && `Perfil ${l.perfil}`, l.lideranca && `Liderança ${l.lideranca}`].filter(Boolean).join(" · ");
  if (!historico || l.resumo) {
    await prisma.observacao.create({
      data: {
        mentoradaId: m.id, data: new Date(l.data ?? hojeISO()), autor: `${mentora} (planilha de devolutivas)`,
        texto: `Devolutiva Comportamental com ${mentora} em ${dataBr(l.data)}.${partes ? ` ${partes}.` : ""}${l.resumo ? `\n\n${l.resumo}` : ""}`,
      },
    });
    feitos.push("observação");
  }
  if (!feitos.length) return false;
  await registrarAtividade({ id: null, nome: `Planilha de devolutivas (${mentora})` }, {
    acao: "editou", entidade: "etapa", mentoradaId: m.id,
    resumo: `Devolutiva Comportamental de ${m.nome} em ${dataBr(l.data)} lançada pela planilha (${feitos.join(", ")})`,
  });
  return true;
}

export async function sincronizarDevolutivas({ forcar = false } = {}): Promise<ResultadoDevolutivas> {
  const r: ResultadoDevolutivas = { configurado: false, lidas: 0, novas: 0, lancadas: 0, avisos: 0, semCadastro: 0 };
  const conf = await configDaPlanilha();
  if (!conf?.id) return r;
  r.configurado = true;
  if (!forcar && !(await podeLerAgora())) return r;
  const mentora = conf.mentora?.trim() || "a mentora";

  let linhas: LinhaDevolutiva[];
  try {
    linhas = lerPlanilhaDevolutivas(lerXlsxAbas(await baixarPlanilha(conf.id)), hojeISO());
  } catch (e) {
    r.erro = (e as Error).message;
    await gravar(CHAVE_STATUS, { em: new Date().toISOString(), ok: false, erro: r.erro }).catch(() => {});
    return r;
  }
  r.lidas = linhas.length;

  // Primeira leitura: o que já estava na planilha entra no cadastro sem gerar um aviso por linha.
  const primeira = !(await prisma.configuracao.findUnique({ where: { chave: CHAVE_PRIMEIRA } }));
  const ms: M[] = await prisma.mentorada.findMany({ select: { id: true, nome: true, email: true, tipo: true, disc: true } });
  const guardadas = new Map((await prisma.devolutivaDisc.findMany()).map(d => [d.chave, d]));
  const avisos: { titulo: string; texto?: string; link?: string }[] = [];
  const mexidas = new Set<string>();

  for (const l of linhas) {
    const antes = guardadas.get(l.chave);
    guardadas.delete(l.chave);
    const m = (antes?.mentoradaId ? ms.find(x => x.id === antes.mentoradaId) : null) ?? acharMentorada(l, ms);
    if (!antes) r.novas++;
    const dados = {
      nome: l.nome, email: l.email, situacao: l.situacao, textoData: l.textoData, data: l.data ? new Date(l.data) : null,
      perfil: l.perfil, lideranca: l.lideranca, resumo: l.resumo, mentoradaId: m?.id ?? null,
    };
    const salva = await prisma.devolutivaDisc.upsert({ where: { chave: l.chave }, update: dados, create: { chave: l.chave, ...dados } });
    // "Reserva" a linha antes de lançar ou avisar: se duas leituras rodarem juntas, só uma faz.
    const reservar = async (campo: "lancadaEm" | "avisadaEm") =>
      (await prisma.devolutivaDisc.updateMany({ where: { id: salva.id, [campo]: null }, data: { [campo]: new Date() } })).count === 1;

    if (l.situacao === "feita" && m && !salva.lancadaEm && (await reservar("lancadaEm"))) {
      let mudou = false;
      try {
        mudou = await lancar(m, l, mentora, primeira);
      } catch (e) {
        await prisma.devolutivaDisc.update({ where: { id: salva.id }, data: { lancadaEm: null } }).catch(() => {});
        throw e;
      }
      if (mudou) { mexidas.add(m.id); r.lancadas++; }
    }
    if (l.situacao === "feita" && !m) r.semCadastro++;

    // Aviso: devolutiva feita ou falta que ainda não foi avisada.
    if ((l.situacao === "feita" || l.situacao === "faltou") && !salva.avisadaEm && (await reservar("avisadaEm"))) {
      if (!primeira) {
        const quem = m?.nome ?? l.nome;
        if (l.situacao === "faltou") {
          avisos.push({
            titulo: `${quem} faltou à Devolutiva Comportamental`,
            texto: `${mentora} marcou na planilha: "${l.textoData}".`, link: m ? linkDa(m) : "/devolutivas",
          });
        } else if (m) {
          avisos.push({
            titulo: `Devolutiva Comportamental de ${quem} realizada`,
            texto: `${mentora} fez a devolutiva em ${dataBr(l.data)}${l.perfil ? ` · perfil ${l.perfil}` : ""}. Já está no cadastro.`, link: linkDa(m),
          });
        } else {
          avisos.push({
            titulo: `Devolutiva de ${quem} realizada, mas a mentorada não foi encontrada`,
            texto: `${mentora} fez a devolutiva em ${dataBr(l.data)}. O e-mail${l.email ? ` ${l.email}` : ""} não está em nenhum cadastro: confira em Administração › Devolutivas.`, link: "/devolutivas",
          });
        }
      }
    }
  }

  // Linhas que sumiram da planilha (ex.: a data foi preenchida e a linha "sem data" virou outra) e nunca entraram no cadastro.
  const sumiram = [...guardadas.values()].filter(d => !d.lancadaEm).map(d => d.id);
  if (sumiram.length) await prisma.devolutivaDisc.deleteMany({ where: { id: { in: sumiram } } });

  if (primeira) {
    await gravar(CHAVE_PRIMEIRA, new Date().toISOString());
    avisos.push({
      titulo: "Planilha de devolutivas ligada",
      texto: `${r.lidas} linhas lidas; ${r.lancadas} cadastros completados com o que faltava (data, perfil DISC ou resumo)${r.semCadastro ? `; ${r.semCadastro} devolutivas sem mentorada encontrada` : ""}. A partir de agora cada devolutiva nova gera um aviso aqui.`,
      link: "/devolutivas",
    });
  }
  r.avisos = await avisarPessoas(conf.avisar ?? [], avisos);
  if (mexidas.size) await recalcularSaude([...mexidas]).catch(() => {});
  await gravar(CHAVE_STATUS, { em: new Date().toISOString(), ok: true, linhas: r.lidas });
  return r;
}
