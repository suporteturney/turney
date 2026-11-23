// Grava a data da Devolutiva Comportamental (etapa "devolutiva") no cadastro das mentoradas.
// Uso (na pasta turney): node scripts/importar-devolutivas.mjs caminho/devolutivas.json
// O arquivo é uma lista [{ "nome", "email", "data": "AAAA-MM-DD" }]. Acha a mentorada pelo e-mail
// (ou, se não achar, pelo nome); com dois cadastros, prefere o do Atlas. A data da lista substitui a do cadastro.
import "dotenv/config";
import fs from "node:fs";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { recalcular } from "./recalcular-saude.mjs";

const arquivo = process.argv[2];
if (!arquivo) { console.log("\nInforme o arquivo: node scripts/importar-devolutivas.mjs caminho/devolutivas.json\n"); process.exit(1); }
const linhas = JSON.parse(fs.readFileSync(arquivo, "utf8"));
const partes = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z ]/g, " ").split(/\s+/).filter(Boolean);
const ATIVOS = ["Ativo", "Em Andamento", "Em Renovação", "Congelado"];

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const ms = (await c.query(`SELECT id, nome, email, tipo, status FROM "Mentorada"`)).rows;
const iguais = [], novas = [], trocadas = [], naoAchei = [], recalc = [];

for (const r of linhas) {
  let achadas = ms.filter(m => m.email && m.email.trim().toLowerCase() === r.email.trim().toLowerCase());
  if (!achadas.length) { const p = partes(r.nome); achadas = ms.filter(m => p.every(x => partes(m.nome).includes(x))); }
  if (achadas.length > 1) {
    const atlas = achadas.filter(m => m.tipo === "Atlas");
    if (atlas.length) achadas = atlas;
    if (achadas.length > 1) { const at = achadas.filter(m => ATIVOS.includes(m.status)); if (at.length) achadas = at; }
  }
  if (achadas.length !== 1) { naoAchei.push(`${r.nome} (${r.email})${achadas.length ? " — mais de um cadastro" : ""}`); continue; }
  const m = achadas[0];
  const antes = (await c.query(`SELECT id, programa, data FROM "Etapa" WHERE "mentoradaId" = $1 AND nome = 'devolutiva' ORDER BY data DESC NULLS LAST`, [m.id])).rows;
  const atual = antes.find(e => e.data);
  const diaAtual = atual ? new Date(atual.data.getTime() - atual.data.getTimezoneOffset() * 60000).toISOString().slice(0, 10) : null;
  if (diaAtual === r.data) { iguais.push(m.nome); continue; }
  if (antes.length) {
    await c.query(`UPDATE "Etapa" SET data = $1 WHERE id = $2`, [r.data, (atual ?? antes[0]).id]);
  } else {
    await c.query(`INSERT INTO "Etapa"(id, "mentoradaId", programa, nome, data) VALUES ($1, $2, 'Atlas', 'devolutiva', $3)`, [randomUUID(), m.id, r.data]);
  }
  const br = d => d.split("-").reverse().join("/");
  await c.query(
    `INSERT INTO "Atividade"(id, "usuarioNome", acao, entidade, "mentoradaId", resumo, data) VALUES ($1, 'Terminal', 'editou', 'etapa', $2, $3, now())`,
    [randomUUID(), m.id, `Marcou Devolutiva Comportamental em ${br(r.data)} para ${m.nome}${diaAtual ? ` (antes: ${br(diaAtual)})` : ""} — planilha Controle alunos DISC`],
  );
  (diaAtual ? trocadas : novas).push(`${m.nome}: ${diaAtual ? `${br(diaAtual)} → ` : ""}${br(r.data)}`);
  if (ATIVOS.includes(m.status)) recalc.push(m.id);
}
if (recalc.length) await recalcular(c, recalc, true);
await c.end();

console.log(`\n✓ Preenchidas (estavam vazias): ${novas.length}`); novas.forEach(x => console.log("   " + x));
console.log(`\n✓ Corrigidas pela planilha: ${trocadas.length}`); trocadas.forEach(x => console.log("   " + x));
console.log(`\n• Já estavam iguais: ${iguais.length}`);
if (naoAchei.length) { console.log(`\n⚠️  Não achei no cadastro (marque à mão): ${naoAchei.length}`); naoAchei.forEach(x => console.log("   " + x)); }
console.log(`\nSaúde recalculada para ${recalc.length} mentorada(s) ativa(s).\n`);
