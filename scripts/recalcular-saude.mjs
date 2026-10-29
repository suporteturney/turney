// Recalcula a saúde das mentoradas ativas (mesma regra de src/lib/saude-servidor.ts).
//
// Uso: node scripts/recalcular-saude.mjs [--aplicar]
//   sem --aplicar só mostra quantas mudariam de nível.
// Também exporta `recalcular(client, ids)` para outros scripts.
import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";
import "dotenv/config";
import pg from "pg";
import { ajusteVigente, calcularSaude, resumoSaude } from "../src/lib/saude.ts";

const iso = d => (d ? new Date(d).toISOString() : null);

export async function recalcular(c, ids = null, aplicar = true) {
  const filtro = ids ? `and m.id = any($1)` : "";
  const ms = (await c.query(
    `select m.id, m.nome, m.tipo, m.inicio, m."vagaData", m.saude, m."saudeAjusteEm",
       coalesce((select json_agg(json_build_object('acao', r.acao, 'destino', r.destino, 'data', r.data)) from "Renovacao" r where r."mentoradaId" = m.id), '[]') renovacoes,
       coalesce((select json_agg(json_build_object('nome', e.nome, 'data', e.data, 'programa', e.programa)) from "Etapa" e where e."mentoradaId" = m.id), '[]') etapas,
       coalesce((select json_agg(json_build_object('encontro', p.encontro, 'presente', p.presente)) from "Presenca" p where p."mentoradaId" = m.id), '[]') presencas,
       (select json_build_object('banda', i.banda, 'data', v.data) from "VarreduraItem" i join "Varredura" v on v.id = i."varreduraId"
          where i."mentoradaId" = m.id order by v.data desc limit 1) varredura
     from "Mentorada" m where m.status in ('Ativo', 'Em Renovação') ${filtro}`,
    ids ? [ids] : [],
  )).rows;

  const hoje = new Date().toISOString().slice(0, 10);
  const mudancas = [];
  for (const m of ms) {
    const r = calcularSaude({
      tipo: m.tipo, inicio: iso(m.inicio), vagaData: iso(m.vagaData),
      renovacoes: m.renovacoes.map(x => ({ ...x, data: iso(x.data) })),
      etapas: m.etapas.map(x => ({ ...x, data: iso(x.data) })),
      presencas: m.presencas,
      varredura: m.varredura ? { banda: m.varredura.banda, data: iso(m.varredura.data) } : null,
    }, hoje);
    const manual = ajusteVigente(iso(m.saudeAjusteEm), m.varredura ? iso(m.varredura.data) : null);
    const saude = manual ? m.saude : r.nivel ?? m.saude;
    if (saude && saude !== m.saude) mudancas.push(`${m.nome}: ${m.saude ?? "—"} → ${saude} (${resumoSaude(r)})`);
    if (!aplicar) continue;
    await c.query(
      `update "Mentorada" set "saudeNota" = $2, "saudeCalculada" = $3, "saudeDetalhe" = $4, saude = $5,
         "saudeAjusteEm" = case when $6 then "saudeAjusteEm" else null end, "updatedAt" = now() where id = $1`,
      [m.id, r.nota, r.nivel, JSON.stringify({ partes: r.partes, trava: r.trava, calculadoEm: hoje }), saude, manual],
    );
    if (saude && saude !== m.saude) {
      await c.query(
        `insert into "SaudeRegistro"(id, "mentoradaId", saude, motivo, origem, data) values ($1,$2,$3,$4,'calculo', now())`,
        [`sc_${randomBytes(10).toString("hex")}`, m.id, saude, resumoSaude(r)],
      );
    }
  }
  return { total: ms.length, mudancas };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const aplicar = process.argv.includes("--aplicar");
  const c = new pg.Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
  await c.connect();
  try {
    const { total, mudancas } = await recalcular(c, null, aplicar);
    console.log(`${aplicar ? "RECALCULADA" : "SIMULACAO"} ${total} mentoradas ativas · ${mudancas.length} mudaram de nível`);
    for (const m of mudancas) console.log(`  ${m}`);
  } finally {
    await c.end();
  }
}
