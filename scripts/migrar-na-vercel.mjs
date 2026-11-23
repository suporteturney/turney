// Roda antes do build na Vercel: atualiza o banco (prisma migrate deploy) só na publicação oficial.
// Se o banco falhar, o build para e o site que está no ar continua como estava.
import { spawnSync } from "node:child_process";

if (process.env.VERCEL_ENV !== "production") {
  console.log("Banco: nada a fazer (só atualiza na publicação oficial da Vercel).");
  process.exit(0);
}
// Migração precisa da conexão direta do Neon (sem o "-pooler").
const url = process.env.DIRECT_URL || (process.env.DATABASE_URL ?? "").replace(/-pooler(?=\.)/, "");
if (!url) {
  console.error("Banco: falta DATABASE_URL (ou DIRECT_URL) na Vercel.");
  process.exit(1);
}
console.log("Banco: aplicando migrações pendentes…");
const r = spawnSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit", env: { ...process.env, DIRECT_URL: url } });
process.exit(r.status ?? 1);
