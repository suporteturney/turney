// Recalcula a temperatura de todas as respostas dos formulários e dos leads (menos os escolhidos à mão)
// com a regra atual de src/lib/respondi.ts. Uso: npx tsx --tsconfig tsconfig.json scripts/recalcular-temperaturas.mts
import "dotenv/config";
import pg from "pg";
import { classificar, type Resposta } from "../src/lib/respondi";

const c = new pg.Client({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL, ssl: process.env.DATABASE_URL?.includes("localhost") ? undefined : { rejectUnauthorized: false } });
await c.connect();
const rs = (await c.query(`select id, "leadId", completa, "preenchidoEm", respostas from "RespostaFormulario"`)).rows as { id: string; leadId: string; completa: boolean; preenchidoEm: Date; respostas: Resposta[] }[];
let mudaram = 0;
for (const r of rs) {
  const k = classificar(r.respostas);
  const x = await c.query(`update "RespostaFormulario" set temperatura=$2, pontuacao=$3 where id=$1 and (temperatura is distinct from $2 or pontuacao is distinct from $3)`, [r.id, k.temperatura, k.pontuacao]);
  mudaram += x.rowCount ?? 0;
}
// O lead fica com a da resposta completa mais recente (ou a mais recente, se nenhuma terminou).
const l = await c.query(`
  update "Lead" l set temperatura = r.temperatura, pontuacao = r.pontuacao
  from (select distinct on ("leadId") "leadId", temperatura, pontuacao from "RespostaFormulario" order by "leadId", completa desc, "preenchidoEm" desc) r
  where r."leadId" = l.id and not l."temperaturaManual" and (l.temperatura is distinct from r.temperatura or l.pontuacao is distinct from r.pontuacao)`);
console.log(`Respostas: ${rs.length} lidas, ${mudaram} mudaram. Leads atualizados: ${l.rowCount}.`);
await c.end();
