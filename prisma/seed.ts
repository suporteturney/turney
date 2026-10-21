// Seed inicial: cria conta admin
// Rodar após configurar .env com as URLs do Neon:
//   npx ts-node prisma/seed.ts

import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/lib/generated/prisma";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
});

const prisma = new PrismaClient({ adapter });

async function main() {
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
  console.log("   ⚠️  Troque a senha após o primeiro login");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
