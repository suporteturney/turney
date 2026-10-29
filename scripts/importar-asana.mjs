// Importa para o Diário das mentoradas os comentários do projeto do Asana
// "ACOMPANHAMENTO MENTORADOS HT - ATLAS, NEXUS E DELTA".
// Uso: node scripts/importar-asana.mjs <comentarios.json> [--aplicar]
//   comentarios.json: { [taskId]: { nome, comentarios: [{ gid, created_at, created_by: { name }, text }] } }
//   --aplicar  grava no banco (sem ele, só mostra o que seria importado)
// Cada comentário vira um Acompanhamento com id "asana_<gid>", então rodar de novo não duplica.

import { readFileSync } from "node:fs";
import "dotenv/config";
import pg from "pg";
import { casarMentorada, normNome } from "../src/lib/varredura.ts";

const [arquivo, ...flags] = process.argv.slice(2);
const aplicar = flags.includes("--aplicar");
if (!arquivo) {
  console.error("Uso: node scripts/importar-asana.mjs <comentarios.json> [--aplicar]");
  process.exit(1);
}

const MENTORAS = ["Amanda Dutra", "Andressa Bordon"];
// Nomes do Asana que não batem sozinhos com o cadastro
const APELIDOS = {};

const limparNome = n => n.replace(/\bCHURN\b/gi, "").replace(/\s+/g, " ").trim();
// Menções do Asana viram links de perfil sem sentido fora de lá
const limparTexto = t =>
  t.replace(/https:\/\/app\.asana\.com\/\S*?\/profile\/\d+/g, "@").replace(/[ \t]+\n/g, "\n").trim();

const dados = JSON.parse(readFileSync(arquivo, "utf8"));
const client = new pg.Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
await client.connect();

const { rows: base } = await client.query(`select id, nome, tipo, status from "Mentorada"`);
const porId = new Map(base.map(m => [m.id, m]));

const semPar = [];
const novos = [];
for (const [taskId, { nome, comentarios }] of Object.entries(dados)) {
  const limpo = limparNome(nome);
  const id = APELIDOS[normNome(limpo)] ?? casarMentorada(limpo, base);
  if (!id) {
    semPar.push(`${limpo} (${comentarios.length} comentários, tarefa ${taskId})`);
    continue;
  }
  for (const c of comentarios) {
    const texto = limparTexto(c.text ?? "");
    if (!texto) continue;
    const autor = c.created_by?.name ?? null;
    novos.push({
      id: `asana_${c.gid}`,
      mentoradaId: id,
      data: c.created_at,
      tipo: MENTORAS.includes(autor) ? "Observações mentora" : "Registro do Asana",
      texto,
      autor,
      asana: limpo,
    });
  }
}

const porMentorada = new Map();
for (const n of novos) porMentorada.set(n.mentoradaId, (porMentorada.get(n.mentoradaId) ?? 0) + 1);
for (const [id, qtd] of porMentorada) {
  const m = porId.get(id);
  console.log(`  ${m.nome} (${m.tipo}, ${m.status}): ${qtd}`);
}
console.log(`\n${novos.length} comentários de ${porMentorada.size} mentoradas.`);
if (semPar.length) console.log(`Sem correspondência no cadastro:\n  ${semPar.join("\n  ")}`);

if (aplicar) {
  await client.query("begin");
  let gravados = 0;
  for (const n of novos) {
    const r = await client.query(
      `insert into "Acompanhamento"(id, "mentoradaId", data, tipo, texto, autor)
       values ($1,$2,$3,$4,$5,$6) on conflict (id) do nothing`,
      [n.id, n.mentoradaId, n.data, n.tipo, n.texto, n.autor]
    );
    gravados += r.rowCount;
  }
  await client.query("commit");
  console.log(`\nGravados: ${gravados} (já existiam: ${novos.length - gravados}).`);
} else {
  console.log("\nSimulação. Rode com --aplicar para gravar.");
}
await client.end();
