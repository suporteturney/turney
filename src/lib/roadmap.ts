// Resumo do roadmap sem IA: o documento segue o modelo da Turney, então cada parte é
// localizada pelos títulos do modelo e copiada do próprio texto, sem nada ser reescrito.

const semAcento = (t: string) => t.split("").map(c => c.normalize("NFD")[0].toLowerCase()).join("");

const MARCA = /^(?:[●•▪◦·\-–—]|\d+[.)])\s*/;
const ROTULO = /^[A-ZÀ-Ú][^:.]{2,40}:/;

// Junta as linhas quebradas pelo PDF. Um item novo começa em marcador, linha em branco ou "Rótulo:".
function itens(trecho: string) {
  const saida: string[] = [];
  let novo = true;
  for (const crua of trecho.split("\n")) {
    const linha = crua.trim();
    if (!linha) {
      novo = true;
      continue;
    }
    if (MARCA.test(linha) || ROTULO.test(linha)) novo = true;
    const resto = linha.replace(MARCA, "").trim();
    if (!resto) continue;
    if (novo || !saida.length) saida.push(resto);
    else saida[saida.length - 1] += ` ${resto}`;
    novo = false;
  }
  return saida;
}

const frases = (t: string) => t.replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s+(?=[A-ZÀ-Ú])/).filter(Boolean);
const curto = (t: string, n = 1) => frases(t).slice(0, n).join(" ");
const umaLinha = (t: string) => t.replace(/\s+/g, " ").replace(/[\s.,;]+$/, "").trim();

export function resumirRoadmap(bruto: string): string | null {
  const texto = bruto.replace(/[​-‍﻿]/g, "").replace(/[\t ]/g, " ");
  const plano = semAcento(texto);

  const achar = (re: RegExp, de = 0) => {
    const busca = new RegExp(re.source, "g");
    busca.lastIndex = de;
    const m = busca.exec(plano);
    return m ? { inicio: m.index, fim: m.index + m[0].length } : null;
  };
  const trecho = (de: RegExp, ate: RegExp[], aPartirDe = 0) => {
    const a = achar(de, aPartirDe);
    if (!a) return "";
    const fins = ate.flatMap(re => achar(re, a.fim)?.inicio ?? []);
    // Tira a letra ou o marcador do item seguinte, que fica no fim do trecho
    return texto.slice(a.fim, fins.length ? Math.min(...fins) : texto.length).replace(/\s+(?:[a-z]\.?|\d+[.)]|[-–•●])\s*$/i, "").trim();
  };

  const secoes: [string, string[]][] = [];
  const secao = (titulo: string, linhas: (string | false | null | undefined)[]) => {
    const validas = linhas.filter((l): l is string => !!l && !!l.trim());
    if (validas.length) secoes.push([titulo, validas]);
  };

  secao("MOMENTO E TRAJETÓRIA", itens(trecho(/trajetoria profissional\s*:?/, [/passo 0?2\b/])));

  secao("OBJETIVO", frases(trecho(/o que voce deseja alcancar em sua carreira\??/, [/quais sao suas aspiracoes/])));

  secao("ASPIRAÇÕES", itens(trecho(/quais sao suas aspiracoes[^\n]*/, [/renda( de)? expectativa/, /expectativa de renda/, /trajetoria profissional/])));

  secao("RENDA", itens(trecho(/(renda( de)? expectativa|expectativa de renda)\s*:?/, [/c\.?\s+trajetoria/, /trajetoria profissional/])));

  const disc = trecho(/estilo de comunicacao do seu\s+disc\s*:?/, [/analise individual skills/, /soft skills principais/]);
  const soft = itens(trecho(/soft skills principais/, [/hard skills principais/]));
  const hard = itens(trecho(/hard skills principais/, [/aqui, avaliar/, /areas mais estrateg/]));
  secao("PERFIL COMPORTAMENTAL", [
    ...frases(disc).slice(0, 4),
    soft.length > 0 && `Soft skills: ${soft.join("; ")}`,
    hard.length > 0 && `Hard skills: ${hard.join(", ")}`,
  ]);

  const base = achar(/areas mais estrateg/)?.fim ?? 0;
  const fimPlanos = [/seus diferenciais/, /pontos chaves/, /passo 0?3/];
  const linhasPlanos = ["a", "b", "c", "d"].flatMap((letra, i, todas) => {
    const proximos = todas.slice(i + 1).map(l => new RegExp(`\\bplano ${l}\\s*:`));
    const [titulo, ...resto] = itens(trecho(new RegExp(`\\bplano ${letra}\\s*:`), [...proximos, ...fimPlanos], base));
    if (!titulo) return [];
    return [
      `Plano ${letra.toUpperCase()}: ${titulo}`,
      ...resto.map(item => `  ${ROTULO.test(item) ? umaLinha(item) : curto(item)}`),
    ];
  });
  secao("PLANOS", linhasPlanos);

  const fimFoco = [/link da nossa ia/, /localizacao linkedin/, /curadoria de empresas/, /curadoria de job titles/, /senioridade sugerida/];
  const foco = umaLinha(trecho(/area de foco\s*:/, fimFoco));
  const cargos = umaLinha(trecho(/job titles comuns\s*:/, fimFoco));
  const senioridade = umaLinha(trecho(/senioridade sugerida para focar\s*:/, fimFoco));
  const localizacao = umaLinha(trecho(/localizacao linkedin\s*:/, fimFoco));
  secao("FOCO DA BUSCA", [
    foco && `Área de foco: ${foco}`,
    cargos && `Cargos: ${cargos}`,
    senioridade && `Senioridade: ${senioridade}`,
    localizacao && `LinkedIn: ${localizacao}`,
  ]);

  const paises = itens(trecho(/aprofundamento paises para focar\s*:?/, [/passo 0?3\b/]));
  const grandes = umaLinha(trecho(/grandes empresas\s*:/, [/pequeno e medio porte/, /informacoes de ouro/]));
  const menores = umaLinha(trecho(/pequeno e medio porte[^:]*:/, [/informacoes de ouro/]));
  secao("PAÍSES E EMPRESAS", [
    ...paises,
    grandes && `Grandes empresas: ${grandes}`,
    menores && `Pequeno e médio porte: ${menores}`,
  ]);

  secao("DIFERENCIAIS", itens(trecho(/seus diferenciais competitivos[^:]*:/, [/pontos chaves/])));

  secao("RESULTADOS PARA USAR", itens(trecho(/resultados quantitativos[^:]*:/, [/aprofundamento paises/])));

  secao(
    "PONTOS DE ATENÇÃO",
    itens(trecho(/pontos chaves para saber se vender[^:]*:/, [/\d[.)]\s*resultados quantitativos/, /resultados quantitativos/, /aprofundamento paises/]))
      .map(item => curto(item, 2)),
  );

  const passo4 = achar(/passo 0?4\b/)?.fim ?? 0;
  const meta = umaLinha(trecho(/\bmeta\s*:/, [], passo4));
  secao("PRÓXIMOS PASSOS E PRAZO", [
    ...itens(trecho(/proximos passos\s*:/, [/\bmeta\s*:/], passo4)),
    meta && `Meta: ${meta}`,
  ]);

  // Com poucas partes encontradas, o documento não segue o modelo
  if (secoes.length < 3) return null;
  return secoes
    .map(([titulo, linhas]) => [titulo, ...linhas.map(l => (l.startsWith("  ") ? `  - ${l.trim()}` : `- ${l}`))].join("\n"))
    .join("\n\n");
}
