// Marca no cadastro (campo Turma = "Atlas 2.0") as mentoradas da turma 2 do Atlas.
// Uso (na pasta turney), com os nomes entre aspas:
//   node scripts/turma-atlas2.mjs "Nome Um" "Nome Dois" ...
// Aceita nome curto ("Caroline Ferreira" acha "Caroline da Silva Ramalho Ferreira"). Só mexe em mentoradas do Atlas.
import "dotenv/config";
import pg from "pg";
import { randomUUID } from "node:crypto";

const nomes = process.argv.slice(2).filter(Boolean);
if (!nomes.length) { console.log('\nInforme os nomes. Exemplo:\n  node scripts/turma-atlas2.mjs "Thaina Rossi" "Bruna Cardozo"\n'); process.exit(1); }
const partes = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/\s+/).filter(Boolean);

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const atlas = (await c.query(`SELECT id, nome, turma, status FROM "Mentorada" WHERE tipo = 'Atlas'`)).rows;
const ativos = ["Ativo", "Em Andamento", "Em Renovação", "Congelado"];
let feitas = 0;
for (const n of nomes) {
  const p = partes(n);
  let achadas = atlas.filter(m => p.every(x => partes(m.nome).includes(x)));
  if (achadas.length > 1) achadas = achadas.filter(m => ativos.includes(m.status));
  if (achadas.length !== 1) { console.log(`⚠️  ${n}: ${achadas.length ? "mais de uma no cadastro" : "não achei no Atlas"} — marque à mão em Cadastro › Dados › Turma`); continue; }
  const m = achadas[0];
  if (m.turma === "Atlas 2.0") { console.log(`•  ${m.nome}: já estava na Atlas 2.0`); continue; }
  await c.query(`UPDATE "Mentorada" SET turma = 'Atlas 2.0', "updatedAt" = now() WHERE id = $1`, [m.id]);
  await c.query(
    `INSERT INTO "Atividade"(id, "usuarioNome", acao, entidade, "mentoradaId", resumo, data) VALUES ($1, 'Terminal', 'editou', 'mentorada', $2, $3, now())`,
    [randomUUID(), m.id, `Marcou ${m.nome} na turma Atlas 2.0${m.turma ? ` (antes: ${m.turma})` : ""}`],
  );
  console.log(`✓  ${m.nome} → Atlas 2.0`);
  feitas++;
}
await c.end();
console.log(`\nPronto: ${feitas} mentorada(s) marcadas na turma Atlas 2.0. As demais do Atlas ficam na turma 1.\n`);
