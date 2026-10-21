import { createRequire } from "module";
import { readFileSync } from "fs";

// Carrega .env manualmente
const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
for (const line of env.split("\n")) {
  const m = line.match(/^([^=]+)="?([^"]*)"?$/);
  if (m) process.env[m[1]] = m[2];
}

const { PrismaPg } = await import("@prisma/adapter-pg");
const { PrismaClient } = await import("../src/lib/generated/prisma/index.js");
const bcrypt = (await import("bcryptjs")).default;

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

const senhaHash = await bcrypt.hash("turney2024", 12);

const admin = await prisma.usuario.upsert({
  where: { email: "suporte@turneyacademy.com" },
  update: {},
  create: {
    nome: "Eduarda Vasconcelos",
    email: "suporte@turneyacademy.com",
    senhaHash,
    papel: "admin",
  },
});

console.log("✅ Admin criado:", admin.email);
console.log("   Senha inicial: turney2024");

await prisma.$disconnect();
