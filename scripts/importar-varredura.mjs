// Importa a varredura semanal de acompanhamento para o banco.
//
// Uso: node scripts/importar-varredura.mjs <arquivo.html|arquivo.json> [--aplicar] [--sem-saude] [--substituir]
//   arquivo     código da página do painel de acompanhamento (artifact do Claude) ou o JSON da varredura
//   --aplicar   grava no banco (sem ele, só mostra o que seria importado)
//   --sem-saude não recalcula a saúde com a varredura nova
//   --substituir reimporta mesmo que já exista varredura do mesmo programa e data
//
// Faz o mesmo que "Acompanhamento → Importar varredura": cria a varredura, os itens,
// um acompanhamento por mentorada e (por padrão) recalcula a saúde (src/lib/saude.ts).
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import "dotenv/config";
import pg from "pg";
import { lerVarredura, casarMentorada, normNome, LISTAS } from "../src/lib/varredura.ts";
import { recalcular } from "./recalcular-saude.mjs";

const args = process.argv.slice(2);
const arquivo = args.find(a => !a.startsWith("--"));
const aplicar = args.includes("--aplicar");
const comSaude = !args.includes("--sem-saude");
const substituir = args.includes("--substituir");
if (!arquivo) {
  console.error("Informe o arquivo da varredura.");
  process.exit(1);
}

const lida = lerVarredura(readFileSync(arquivo, "utf8"));
if (!lida.ok) {
  console.error(lida.erro);
  process.exit(1);
}
const p = lida.payload;
const novoId = prefixo => `${prefixo}_${randomBytes(10).toString("hex")}`;

const c = new pg.Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
await c.connect();
try {
  const existente = (await c.query(
    `select id from "Varredura" where coalesce(programa, '') = coalesce($1, '') and data::date = $2::date`,
    [p.programa, p.data],
  )).rows[0];
  if (existente && !substituir) {
    console.log(`JA_IMPORTADA ${p.programa ?? "Sem programa"} ${p.data}`);
    process.exit(0);
  }

  const base = (await c.query(`select id, nome, tipo, status from "Mentorada"`)).rows;
  const ligados = p.itens.map(i => {
    let mid = casarMentorada(i.nome, base, p.programa);
    if (!mid) {
      // nome da varredura mais longo que o do cadastro (ex.: sobrenome a mais)
      const t = normNome(i.nome).split(" ");
      const cand = base.filter(m => (!p.programa || m.tipo === p.programa || m.tipo.startsWith(`${p.programa} `))
        && normNome(m.nome).split(" ").every(x => t.includes(x)));
      if (cand.length === 1) mid = cand[0].id;
    }
    return { i, mid };
  });
  const semCadastro = ligados.filter(l => !l.mid).map(l => l.i.nome);

  console.log(`Varredura ${p.programa ?? "Sem programa"} de ${p.data}: ${ligados.length} mentoradas, ${ligados.length - semCadastro.length} ligadas ao cadastro.`);
  if (semCadastro.length) console.log(`Sem cadastro correspondente: ${semCadastro.join("; ")}`);
  for (const a of lida.avisos) console.log(`Aviso: ${a}`);
  if (!aplicar) process.exit(0);

  const autor = (await c.query(`select nome from "Usuario" order by "createdAt" limit 1`)).rows[0]?.nome ?? null;
  const data = new Date(`${p.data}T12:00:00.000Z`);
  const textoAcomp = i => {
    const bloco = (t, xs) => (xs.length ? `${t}:\n${xs.map(x => `• ${x}`).join("\n")}` : null);
    return [i.status, bloco("Pendências", i.pendencias), bloco("Pontos de atenção", i.atencao), bloco("Próximos passos", i.proximos)]
      .filter(Boolean).join("\n\n") || i.tag || "Varredura de WhatsApp";
  };

  await c.query("begin");
  try {
    if (existente) await c.query(`delete from "Varredura" where id = $1`, [existente.id]);
    const vid = novoId("var");
    await c.query(
      `insert into "Varredura"(id, data, programa, titulo, autor, bom, ruim, invisivel, melhorias) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [vid, data, p.programa, p.titulo ?? "Painel de acompanhamento (projeto do Claude)", autor, p.analise.bom, p.analise.ruim, p.analise.invisivel, p.analise.melhorias],
    );
    const cols = LISTAS.map(x => `"${x}"`).join(", ");
    const params = LISTAS.map((_, k) => `$${12 + k}`).join(", ");
    for (const { i, mid } of ligados) {
      await c.query(
        `insert into "VarreduraItem"(id, "varreduraId", "mentoradaId", nome, banda, tag, etapa, status, mensagem, prioridade, "prioridadeMotivo", ${cols})
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, ${params})`,
        [novoId("vi"), vid, mid, i.nome, i.banda, i.tag, i.etapa, i.status, i.mensagem, i.prioridade, i.prioridadeMotivo, ...LISTAS.map(x => i[x])],
      );
      if (!mid) continue;
      await c.query(
        `insert into "Acompanhamento"(id, "mentoradaId", data, tipo, texto, autor, "varreduraId") values ($1,$2,$3,'Varredura WhatsApp',$4,$5,$6)`,
        [novoId("ac"), mid, data, textoAcomp(i), autor, vid],
      );
      if (comSaude) {
        await c.query(
          `update "Mentorada" set "saudeMotivo" = $2, "saudeMotivoEm" = now(), "updatedAt" = now() where id = $1`,
          [mid, [i.tag, i.status].filter(Boolean).join(" — ") || null],
        );
      }
    }
    // A cor da varredura entra no cálculo da saúde junto com jornada e encontros.
    if (comSaude) await recalcular(c, ligados.map(l => l.mid).filter(Boolean));
    await c.query("commit");
  } catch (e) {
    await c.query("rollback");
    throw e;
  }
  const bandas = Object.fromEntries(["vermelho", "amarelo", "verde"].map(b => [b, ligados.filter(l => l.i.banda === b).length]));
  console.log(`IMPORTADA ${p.programa ?? "Sem programa"} ${p.data} · vermelho ${bandas.vermelho} · amarelo ${bandas.amarelo} · verde ${bandas.verde}${comSaude ? " · saúde atualizada" : ""}`);
} finally {
  await c.end();
}
