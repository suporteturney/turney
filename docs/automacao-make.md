# Automação do onboarding: como o Make conversa com o painel

O painel tem uma "porta de entrada" para o Make: o endereço

```
https://turney-painel.vercel.app/api/automacao
```

Por ela, o Make cadastra aluna nova, completa o cadastro, muda a etapa da jornada e consulta quem está onde.
Ela não usa login: é protegida por uma chave secreta.

## Ligar (uma vez só)

1. **Gerar a chave.** No Terminal, rode o comando abaixo. Ele cria a chave e já copia para a área de transferência (não aparece na tela):
   ```
   openssl rand -hex 32 | pbcopy
   ```
2. **Colar na Vercel.** Projeto turney → Settings → Environment Variables → nome `AUTOMACAO_CHAVE`, valor: colar (Cmd+V) → Save.
3. **Guardar a mesma chave no Make** (passo "Em todo módulo HTTP", abaixo). Não mande a chave por chat nem e-mail.
4. **Atualizar o banco** (cria os campos tutora e etapa da jornada). No Terminal, dentro da pasta turney:
   ```
   npx prisma migrate deploy
   ```
5. **Publicar** pelo GitHub Desktop (commit + Push origin). A Vercel republica sozinha.

Sem a chave na Vercel, a porta responde "Automação desligada".

## Em todo módulo HTTP do Make

Módulo **HTTP → Make a request**:

| Campo | Valor |
|---|---|
| URL | `https://turney-painel.vercel.app/api/automacao` |
| Method | `POST` (ou `GET` para consultar) |
| Headers | `x-chave-automacao` = a chave · `Content-Type` = `application/json` |
| Body type | Raw → JSON |
| Parse response | Yes |

## Como o painel acha a aluna

Em qualquer ação, mande **um** destes campos (o painel tenta nessa ordem):
`id` (o que o painel devolve no cadastro) · `codigo` (ex: NX1042) · `email` · `whatsapp`.

O WhatsApp pode vir em qualquer formato: `(11) 98888-7777`, `11988887777` ou `+55 11 98888-7777`.
Sem DDI, o painel entende como Brasil (+55).

## 1. Cadastrar aluna nova

Usar quando chega a venda da Hubla ou o formulário de Pix.

```json
{
  "acao": "cadastrar",
  "nome": "Maria Silva",
  "tipo": "Nexus 1",
  "email": "maria@email.com",
  "whatsapp": "11988887777",
  "duracao": 6,
  "tutora": "Camila",
  "origem": "Fluxo de Vendas",
  "etapa": "NEXUS1-D0-01"
}
```

- Obrigatórios: `nome`, `tipo` e `email` ou `whatsapp`.
- `tipo`: o programa, escrito igual ao painel (Nexus 1, Nexus 2, Nexus 3, Atlas, Delta…).
- Opcionais: `inicio` (padrão: hoje), `prazo` ou `duracao` em meses (calcula o prazo), `tutora`, `resp`, `drive`, `asana`, `origem`, `obs`, `etapa`.
- Resposta: `{ "criada": true, "mentorada": { "id": ..., "codigo": ..., "whatsappDDI": ... } }`.
- **A Hubla manda o mesmo aviso duas vezes?** Se a aluna já está ativa no mesmo programa, o painel não duplica e responde `"criada": false`. No Make, siga só quando `criada` for `true`.
- Se ela já está ativa em **outro** programa, o painel recusa (erro 409). Upgrade é registrado à mão no painel.

## 2. Completar o cadastro

Depois que o Make cria a pasta no Drive e a task no Asana:

```json
{ "acao": "atualizar", "id": "<id da aluna>", "drive": "https://drive.google.com/...", "asana": "https://app.asana.com/..." }
```

Campos aceitos: `email`, `whatsapp`, `tutora`, `resp`, `drive`, `asana`, `turma`, `linkedin`.
Para trocar o e-mail ou o WhatsApp da própria aluna, identifique-a por `id` ou `codigo`.

## 3. Avançar a etapa da jornada

A cada evento (formulário respondido, call terminada, roadmap na pasta):

```json
{ "acao": "avancar", "email": "maria@email.com", "etapa": "NEXUS1-09" }
```

- `etapa`: o id da linha da Config_Jornada.
- Opcional `data` (padrão: agora).
- Resposta: `{ "mudou": true, ... }`. **Só mande o WhatsApp quando `mudou` for `true`**: se o evento chegar repetido, o painel responde `false` e a aluna não recebe a mensagem duas vezes.

**Marcar uma etapa do painel junto (marco).** Quando o evento também é uma das etapas que o painel acompanha, mande `marco`. Isso preenche a data na aba Jornada e atualiza a saúde:

```json
{ "acao": "avancar", "email": "maria@email.com", "etapa": "NEXUS1-11", "marco": "onboarding", "data": "2026-11-10" }
```

| Programa | Marcos aceitos |
|---|---|
| Nexus 1 | onboarding, sessao, correcao, entrevista, aprovacao |
| Nexus 2 | onboarding, sessao, entrevista, aprovacao |
| Nexus 3 | onboarding, analise, entrevista, aprovacao |
| Atlas | onboarding, devolutiva, sessao, entrevista, aprovacao |

## 4. Consultar

- Uma aluna: `GET https://turney-painel.vercel.app/api/automacao?email=maria@email.com` (ou `?codigo=`, `?whatsapp=`, `?id=`).
- Todas as ativas (para o agente diário de CS): `GET ...?lista=ativas` (opcional `&tipo=Nexus 1`).

Cada aluna vem com `jornadaEtapa`, `diasNaEtapa`, `tutora`, `whatsappDDI` (pronto para o ManyChat), `saude` e `saudeNota`.

## Onde ver o que a automação fez

- Na ficha da aluna, aba **Dados**: campo **Tutora** e a linha "Etapa da jornada (automação)", com o número de dias.
- Na tela **Atividades**: tudo aparece com o nome "Automação (Make)".

## Erros comuns

| Resposta | O que fazer |
|---|---|
| 503 "Automação desligada" | Falta `AUTOMACAO_CHAVE` na Vercel (ou falta republicar depois de colar) |
| 401 "Chave inválida" | A chave do Make está diferente da Vercel |
| 404 "Mentorada não encontrada" | Confira o e-mail ou WhatsApp, ou use o `id` |
| 400 "Marco não existe" | O marco não faz parte daquele programa (veja a tabela) |
| 409 "já está ativa no …" | É upgrade ou cross: registrar pelo painel |
