// Gera uma senha provisória para um acesso do painel e mostra só no Terminal de quem rodou.
// Uso (na pasta turney):  node scripts/redefinir-senha.mjs email@turneyacademy.com
// No primeiro login com a senha provisória, a plataforma pede para criar a senha definitiva.
import "dotenv/config";
import pg from "pg";
import bcrypt from "bcryptjs";
import { randomBytes, randomUUID } from "node:crypto";

const email = (process.argv[2] ?? "").trim().toLowerCase();
if (!email.includes("@")) {
  console.log("\nInforme o e-mail. Exemplo:\n  node scripts/redefinir-senha.mjs apoioaoaluno@turneyacademy.com\n");
  process.exit(1);
}

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const u = (await c.query(`SELECT id, nome FROM "Usuario" WHERE lower(email) = $1`, [email])).rows[0];
if (!u) {
  console.log(`\nNão existe acesso com o e-mail ${email}.\n`);
  await c.end();
  process.exit(1);
}

// Sem letras parecidas (0/O, 1/l/I) para não errar ao digitar.
const letras = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
const senha = [...randomBytes(10)].map(b => letras[b % letras.length]).join("");
const hash = await bcrypt.hash(senha, 10);

await c.query(`UPDATE "Usuario" SET "senhaHash" = $1, "trocarSenha" = true, ativo = true WHERE id = $2`, [hash, u.id]);
await c.query(`DELETE FROM "Sessao" WHERE "usuarioId" = $1`, [u.id]);
await c.query(
  `INSERT INTO "Atividade"(id, "usuarioNome", acao, entidade, resumo, data) VALUES ($1, 'Terminal', 'editou', 'usuario', $2, now())`,
  [randomUUID(), `Gerou senha provisória para ${u.nome} (${email}) pelo Terminal`],
);
await c.end();

console.log(`
Senha provisória de ${u.nome} (${email}):

    ${senha}

1. Entre em https://painel.turneyacademy.com com esse e-mail e essa senha.
2. A plataforma vai pedir para você criar a sua senha nova.
`);
