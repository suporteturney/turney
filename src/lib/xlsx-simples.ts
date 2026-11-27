import { inflateRawSync } from "node:zlib";

// Leitor mínimo de .xlsx (primeira aba) — sem biblioteca externa.
// Um .xlsx é um ZIP com XMLs dentro; aqui lemos o índice do ZIP, abrimos a planilha e os textos compartilhados.

function arquivosDoZip(buf: Buffer): Map<string, Buffer> {
  // Fim do diretório central: assinatura 0x06054b50 nos últimos ~64 KB.
  let fim = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { fim = i; break; }
  }
  if (fim < 0) throw new Error("O arquivo não é uma planilha .xlsx válida.");
  const total = buf.readUInt16LE(fim + 10);
  let p = buf.readUInt32LE(fim + 16);
  const saida = new Map<string, Buffer>();
  for (let n = 0; n < total; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("Planilha corrompida.");
    const metodo = buf.readUInt16LE(p + 10);
    const tamComp = buf.readUInt32LE(p + 20);
    const lenNome = buf.readUInt16LE(p + 28), lenExtra = buf.readUInt16LE(p + 30), lenCom = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const nome = buf.toString("utf8", p + 46, p + 46 + lenNome);
    p += 46 + lenNome + lenExtra + lenCom;
    if (!/^xl\/(worksheets\/sheet\d+\.xml|sharedStrings\.xml|workbook\.xml|_rels\/workbook\.xml\.rels)$/.test(nome)) continue;
    const ini = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const dados = buf.subarray(ini, ini + tamComp);
    saida.set(nome, metodo === 8 ? inflateRawSync(dados) : Buffer.from(dados));
  }
  return saida;
}

const desescapar = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");
const textos = (xml: string) => [...xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(m => desescapar(m[1])).join("");
const coluna = (ref: string) => [...ref.replace(/\d+/g, "")].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;

function compartilhadosDo(zip: Map<string, Buffer>) {
  return zip.has("xl/sharedStrings.xml")
    ? [...zip.get("xl/sharedStrings.xml")!.toString("utf8").matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => textos(m[1]))
    : [];
}

function linhasDa(folha: Buffer, compartilhados: string[]): string[][] {
  const linhas: string[][] = [];
  for (const r of folha.toString("utf8").matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const linha: string[] = [];
    for (const c of (r[1] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1], corpo = c[2] ?? "";
      const ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1];
      const tipo = attrs.match(/\bt="([^"]+)"/)?.[1];
      const v = corpo.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let valor = "";
      if (tipo === "s" && v != null) valor = compartilhados[+v] ?? "";
      else if (tipo === "inlineStr") valor = textos(corpo);
      else if (v != null) valor = desescapar(v);
      linha[ref ? coluna(ref) : linha.length] = valor;
    }
    linhas.push(Array.from(linha, x => x ?? ""));
  }
  return linhas;
}

// Linhas da primeira aba como listas de textos (a primeira linha costuma ser o cabeçalho).
export function lerXlsx(buf: Buffer): string[][] {
  const zip = arquivosDoZip(buf);
  const folha = zip.get("xl/worksheets/sheet1.xml") ?? [...zip.entries()].find(([k]) => k.startsWith("xl/worksheets/"))?.[1];
  if (!folha) throw new Error("Não achei nenhuma aba na planilha.");
  return linhasDa(folha, compartilhadosDo(zip));
}

// Todas as abas, com o nome de cada uma, na ordem da planilha.
export function lerXlsxAbas(buf: Buffer): { nome: string; linhas: string[][] }[] {
  const zip = arquivosDoZip(buf);
  const compartilhados = compartilhadosDo(zip);
  const rels = new Map(
    [...(zip.get("xl/_rels/workbook.xml.rels")?.toString("utf8") ?? "").matchAll(/<Relationship\b[^>]*>/g)].map(m => [
      m[0].match(/\bId="([^"]+)"/)?.[1] ?? "", (m[0].match(/\bTarget="([^"]+)"/)?.[1] ?? "").replace(/^\/?(xl\/)?/, "xl/"),
    ]),
  );
  const abas: { nome: string; linhas: string[][] }[] = [];
  const wb = zip.get("xl/workbook.xml")?.toString("utf8") ?? "";
  [...wb.matchAll(/<sheet\b[^>]*>/g)].forEach((m, i) => {
    const nome = desescapar(m[0].match(/\bname="([^"]*)"/)?.[1] ?? `Aba ${i + 1}`);
    const rid = m[0].match(/\br:id="([^"]+)"/)?.[1] ?? "";
    const folha = zip.get(rels.get(rid) ?? "") ?? zip.get(`xl/worksheets/sheet${i + 1}.xml`);
    if (folha) abas.push({ nome, linhas: linhasDa(folha, compartilhados) });
  });
  if (!abas.length) throw new Error("Não achei nenhuma aba na planilha.");
  return abas;
}
