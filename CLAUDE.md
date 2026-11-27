@AGENTS.md

# Painel Turney — instruções para o Claude

Sistema central da Turney Academy, no ar em https://painel.turneyacademy.com (Vercel, projeto "turney-painel", repositório suporteturney/turney, branch main).
Quem pede as mudanças é a Gestora de Operações (Eduarda). Ela não é técnica.

## Como falar com ela
- **Sempre em português do Brasil**, simples, com passos numerados quando ela precisar fazer algo. Ela não entende inglês.
- Explique o que mudou no painel em termos de tela ("Comercial › Funil de vendas"), não de código.
- Nunca digite senhas dela; ela entra sozinha. Nunca repita tokens, links secretos ou senhas na conversa.

## Publicação (autorizada por ela em 22/11/2026)
- Ela quer que tudo seja publicado **sem ela abrir o GitHub**: depois de testar, faça commit direto na `main` e envie (push). A Vercel publica sozinha.
- O build da Vercel (`vercel-build` → `scripts/migrar-na-vercel.mjs`) roda `prisma migrate deploy` antes do `next build`. Ela **não** roda migração. `npm run build` local não migra.
- Antes de publicar: `npx tsc --noEmit`, `npx eslint` nos arquivos mexidos e `npm run build` (a primeira execução pode sair com aviso de segurança do Next; rode de novo).
- Depois do push, confira o status da publicação (deploy "turney-painel" com sucesso) e se https://painel.turneyacademy.com/login responde 200. Avise o que subiu.
- Não rode `git config user.name/email`. Migração que apaga dados só com confirmação dela.
- Nunca commite dados de mentoradas/leads, links iCal, senhas ou tokens (o repositório pode estar público).

## Stack e regras de código
- Next.js 16 (App Router; leia `node_modules/next/dist/docs` antes de usar APIs), TypeScript, CSS Modules, Prisma 7 (cliente em `src/lib/generated/prisma`), Postgres Neon.
- Migrações: pastas SQL em `prisma/migrations` (gere com `npx prisma migrate diff --from-schema <antigo> --to-schema prisma/schema.prisma --script`), depois `npx prisma generate`. Só aditivas.
- Lint proíbe `Date.now()` em componente de servidor (use `new Date().getTime()`) e `setState` dentro de effect.
- "Hoje" no Brasil: `hojeISO()` (`src/lib/dias-uteis.ts`). Datas de dia são guardadas como meia-noite UTC.
- Três pilares: Comercial, Marketing, Pós Venda. Página nova usa `exigirPilar("comercial" | "marketing" | "posvenda")`; API usa `exigirPilarApi(...)`. Permissões em `src/lib/permissoes.ts` (`semPermissao`, `pode`). Registre ações com `registrarAtividade`.
- Sem custos de IA: nada de API de IA paga dentro do app.
- WhatsApp: `whatsappComDDI()` / `linkWhats()`.

## Testar sem mexer na produção
- O `.env` aponta para o banco de PRODUÇÃO. Scripts que leem o `.env` (ex.: `prisma/seed.mjs`, `scripts/*.mjs` com dotenv) mexem na produção — não rode para testar.
- Banco local: `npx prisma dev -n turney-teste -d`, depois `DATABASE_URL=<url local> DIRECT_URL=<url local> npx prisma migrate deploy` e `next dev -p 3041` com as mesmas variáveis. Crie um usuário de teste por script, teste, e apague tudo no fim (`npx prisma dev rm turney-teste --force`).

## O que existe (resumo)
- **Pós Venda**: mentoradas, jornada por programa, saúde da base, renovações, congelamento, pipeline Kanban + tarefas, presenças, acompanhamento (varreduras), agendas do Google (iCal), Hubla área de membros (webhook + importação de aulas), Meu painel (`/inicio`).
- **Devolutivas DISC** (Administração › Devolutivas DISC, `src/lib/devolutiva*.ts`): o painel relê a planilha da mentora de devolutiva comportamental (Natalia, .xlsx no Drive dela aberto por link; só o código do arquivo fica em Configuracao `disc_planilha`) a cada 15 min. Devolutiva com data vira data na jornada (Atlas), DISC se vazio e observação; "não apareceu" vira aviso de falta. Valor/pagamento da planilha nunca entram.
- **Avisos** (`/avisos`, modelo `Notificacao`, `src/lib/notificacoes.ts`): item do menu com contador; cada pessoa só vê os próprios avisos.
- **Comercial**:
  - Funil (`/comercial/funil`): lead fechado vai direto para o Pipeline do Pós Venda.
  - Vendas e metas: vendas da Hubla entram sozinhas pelo webhook (`src/lib/hubla-vendas*.ts`) e há importação do relatório xlsx da Hubla. A passagem para o Pós Venda fica pendente porque um cenário do Make já cria a mentorada.
  - Calls e Passagem.
  - Formulários do Respondi (HUB e Pré Mentoria): viram cartão no funil com temperatura (`src/lib/respondi.ts`). Os pontos são renda 40, investir 35 e inglês 25; quente a partir de 70 e morno de 50 a 69. Administração › Formulários repassa uma cópia para o Make que já existia.
  - Visão geral com o bloco Aplicações (período, temperaturas, origens e UTMs) e Inteligência comercial (`/comercial/inteligencia`, `src/lib/inteligencia.ts`).
- **Marketing**: ainda "em construção". Ela quer que converse com a Inteligência comercial.
- Automação do Make (onboarding): `src/app/api/automacao/route.ts`, guia em `docs/automacao-make.md`.

## Regras de negócio que ela definiu
- Saúde: jornada 40, encontros 30, acompanhamento 30; faixas 70+ Saudável, 45–69 Atenção, <45 Risco.
- Encontros obrigatórios: Atlas Hotseat e Tutoria; Nexus Evolution Day e Masterclass Day. Código da Aprovação é opcional e vale para todos os programas.
- Atlas tem duas turmas (turma 2 = "Atlas 2.0" no campo Turma).
- Formulário dos 6 meses (Mid-Journey) vale 300 pontos no Turney Points.
