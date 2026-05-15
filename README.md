# LeadScore Journey — Modular

Projeto front-end modular com camada preparada para Supabase e busca de Leads com IA no backend.

## Rodar local sem backend

Use Live Server no VS Code e abra `index.html`.

A busca de Leads tentará chamar `/api/interpret-search`. No Live Server comum essa rota não existe, então o app usa fallback local automaticamente.

## Rodar local com backend da IA

Use Vercel CLI:

```bash
npm install -g vercel
vercel dev
```

Crie um arquivo `.env.local` na raiz:

```env
OPENAI_API_KEY=sua_chave_aqui
OPENAI_SEARCH_MODEL=gpt-5-mini
```

Abra o endereço mostrado pelo `vercel dev`.

## Deploy na Vercel

1. Suba o projeto na Vercel.
2. Configure a variável de ambiente:

```env
OPENAI_API_KEY=sua_chave_aqui
```

Opcional:

```env
OPENAI_SEARCH_MODEL=gpt-5-mini
```

## Estrutura

```txt
api/interpret-search.js        # Backend seguro para interpretar busca com IA
src/search/aiSearchClient.js   # Cliente front-end da busca por IA com fallback local
src/engines/profileFinder.js   # Filtro local e aplicação dos filtros nos leads
src/modules/leads.js           # Tela Leads
src/core/storage.js            # Hoje localStorage; amanhã Supabase
src/core/supabaseClient.js     # Placeholder para conexão Supabase
```

A chave da OpenAI nunca fica no front-end.

## V10.4
- Produtos viraram aba master na navegação principal.
- O botão de criação de produto foi removido da aba Campanha.
- A aba Produtos concentra dashboard estratégico, métricas de produto, campanhas vinculadas e visão RevOps.
- A aba Campanha permanece operacional e agora exibe painel de campanhas, não de produtos.


## V10.5 - Configurações de Banco de Dados
- Botão Configurações adicionado ao lado do Resetar.
- Modal de Banco de Dados com Local, Supabase e Amazon.
- Local usa localStorage como banco local único por enquanto.
- Supabase aceita Project URL e anon key com teste REST.
- Amazon prepara RDS PostgreSQL, RDS MySQL, Aurora e DynamoDB com tutorial e opção de API Gateway/backend proxy.
- Testar conexão, salvar configuração e sincronizar snapshot inicial disponíveis.


## V11 — Local Folder Storage
- O provedor Local agora foi preparado para salvar snapshots em uma pasta escolhida pelo usuário.
- A pasta é definida pelo usuário no campo de caminho e autorizada pelo botão “Escolher pasta no computador”.
- Em navegador puro, por segurança, o caminho digitado é referência/auditoria; a permissão real depende do seletor de pasta do browser.
- O snapshot é salvo como `leadjourney-db.json` dentro da pasta escolhida.
- Supabase e Amazon continuam preparados como conectores cloud.


## V11.1 — Desktop Local Folder Engine

Esta versão prepara o LeadJourney para rodar como app desktop via Electron.

### Rodar como desktop

```bash
npm install
npm run desktop
```

### Como o banco local funciona

No modo desktop, o usuário pode definir o caminho exato da pasta local, por exemplo:

```txt
D:/Empresas/LeadJourney
C:/LeadJourneyData
```

O app cria a estrutura:

```txt
LeadJourney/
├── database/
│   └── leadjourney-db.json
├── backups/
├── uploads/
├── exports/
└── config/
```

Com sincronização local ativada, alterações no app disparam autosave na pasta definida. Cada gravação manual também gera backup incremental.


## V11.2 — Data Persistence Layer + Base Limpa
- Código e dados foram desacoplados: o banco fica na pasta definida pelo usuário, fora da pasta do app.
- Estrutura local ampliada: `database/`, `backups/`, `uploads/`, `exports/`, `config/`, `migrations/` e `recovery/`.
- Snapshots agora levam `schemaVersion`, relatório de integridade e histórico de migração.
- Salvamento cria backup incremental e guarda uma cópia anterior em `recovery/`.
- Ao iniciar no Electron, o app tenta hidratar automaticamente o estado a partir da pasta configurada.
- A base inicial foi limpa: sem produtos, campanhas, ações ou leads fictícios. O app abre pronto para dados reais.
