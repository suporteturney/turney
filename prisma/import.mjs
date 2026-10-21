import { readFileSync } from "fs";

// Carrega .env manualmente
const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
for (const line of env.split("\n")) {
  const m = line.match(/^([^=]+)="?([^"]*)"?$/);
  if (m) process.env[m[1]] = m[2];
}

const { PrismaPg } = await import("@prisma/adapter-pg");
const { PrismaClient } = await import("../src/lib/generated/prisma/index.js");

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

const raw = readFileSync(
  "/private/tmp/claude-501/-Users-eduardavasconcelos/762a1cc8-0e39-4427-9294-69be7a08ec80/scratchpad/mentoradas.json",
  "utf8"
);
const mentoradas = JSON.parse(raw);

console.log(`Importando ${mentoradas.length} mentoradas...`);

let criadas = 0;
let erros = 0;

for (const m of mentoradas) {
  try {
    const record = await prisma.mentorada.upsert({
      where: { codigo: m.id },
      update: {
        nome: m.nome || "",
        tipo: m.tipo || "",
        status: m.status || "Ativo",
        inicio: m.inicio ? new Date(m.inicio) : null,
        prazo: m.prazo ? new Date(m.prazo) : null,
        duracao: m.duracao || null,
        saude: m.saude || "",
        area: m.area || "",
        localizacao: m.localizacao || "",
        origem: m.origem || "",
        resp: m.resp || "",
        obs: m.obs || "",
        email: m.email || "",
        whatsapp: m.whatsapp || "",
        produtoAnterior: m.produtoAnterior || "",
        turma: m.turma || "",
      },
      create: {
        codigo: m.id,
        nome: m.nome || "",
        tipo: m.tipo || "",
        status: m.status || "Ativo",
        inicio: m.inicio ? new Date(m.inicio) : null,
        prazo: m.prazo ? new Date(m.prazo) : null,
        duracao: m.duracao || null,
        saude: m.saude || "",
        area: m.area || "",
        localizacao: m.localizacao || "",
        origem: m.origem || "",
        resp: m.resp || "",
        obs: m.obs || "",
        email: m.email || "",
        whatsapp: m.whatsapp || "",
        produtoAnterior: m.produtoAnterior || "",
        turma: m.turma || "",
      },
    });

    // Importar etapas
    if (m.etapas && typeof m.etapas === "object") {
      for (const [nome, data] of Object.entries(m.etapas)) {
        if (!data) continue;
        await prisma.etapa.upsert({
          where: { mentoradaId_nome: { mentoradaId: record.id, nome } },
          update: { data: new Date(data) },
          create: { mentoradaId: record.id, nome, data: new Date(data) },
        });
      }
    }

    // Importar presenças
    if (m.presencas && typeof m.presencas === "object") {
      for (const [evento, presente] of Object.entries(m.presencas)) {
        if (presente === undefined || presente === null) continue;
        await prisma.presenca.upsert({
          where: { mentoradaId_evento: { mentoradaId: record.id, evento } },
          update: { presente: Boolean(presente) },
          create: { mentoradaId: record.id, evento, presente: Boolean(presente) },
        });
      }
    }

    criadas++;
    if (criadas % 50 === 0) console.log(`  ${criadas}/${mentoradas.length}...`);
  } catch (e) {
    erros++;
    console.error(`Erro em ${m.id} (${m.nome}):`, e.message);
  }
}

console.log(`\n✅ Concluído: ${criadas} importadas, ${erros} erros.`);
await prisma.$disconnect();
