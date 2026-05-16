# Data Model — Entidades do LeadJourney

> KB ativa pro Djow. Quando o user pedir "cria produto/campanha/ação", use esse schema.

## Product

Vive em `App.state.products`.

```ts
{
  id: number,             // auto: Date.now() + random
  name: string,           // OBRIGATÓRIO
  price: string,          // ex: "R$ 497,00" (display)
  priceValue: number,     // ex: 497 (numérico)
  ticket: string,         // 'Baixo' | 'Médio' | 'Alto'
  description?: string,
  channels?: string[],    // canais usados
  okrs?: [],
  kpis?: [],
  flow?: {},
  createdAt: string       // ISO
}
```

**Mínimo pra criar**: `name`. Resto pode ser default.

Defaults sugeridos:
- `priceValue: 0` se omitido
- `price`: formato BRL do priceValue (ex: R$ 0,00)
- `ticket`: 'Médio'

## Campaign

Vive em `App.state.campaigns`. Vinculada a um produto.

```ts
{
  id: number,
  name: string,           // OBRIGATÓRIO
  productId: number,      // OBRIGATÓRIO (foreign key → product.id)
  status: string,         // 'Ativa' | 'Pausada' | 'Em planejamento' | 'Concluída'
  description?: string,
  startDate?: string,
  endDate?: string,
  budget?: number,
  okrs?: [],
  kpis?: [],
  blueprintId?: number,   // Revenue Score blueprint vinculado
  createdAt: string
}
```

**Mínimo pra criar**: `name` + `productId`.

Defaults:
- `status: 'Em planejamento'`

## Action

Vive em `App.state.actions`. Pertence a uma campanha.

```ts
{
  id: number,
  campaignId: number,     // OBRIGATÓRIO
  name: string,           // OBRIGATÓRIO
  channel: string,        // OBRIGATÓRIO. Valores válidos:
                          //   RD Station, Instagram Orgânico, RD Email,
                          //   Instagram Ads, Meta Ads, WhatsApp, Google Ads,
                          //   LinkedIn, Email, SDR, Outbound, Webhook, Outro
  actionType: string,     // OBRIGATÓRIO. Valores válidos:
                          //   Post, Campanha, Sequência, Automação, Ligação,
                          //   Remarketing, Webinar, Nutrição, SDR, Email, LP,
                          //   WhatsApp, Checkout, CRM, CS, Canal de aquisição, Outro
  sector: string,         // OBRIGATÓRIO: 'Marketing' | 'Vendas' | 'CS'
  funnel: string,         // OBRIGATÓRIO: 'TOF' | 'MOF' | 'BOF'
  originSector?: string,
  originFunnel?: string,
  destinationSector?: string,
  destinationFunnel?: string,
  objective?: string,
  conversionObjective?: string,
  expectedConversion?: number,    // %
  mailingDefined?: boolean,
  okrs?: [],
  kpis?: [],
  leads?: [],
  flow?: {                        // FlowEngine.normalize
    enabled?: boolean,
    startStage?: string,          // ex: 'mkt_tof'
    endStage?: string,            // ex: 'vnd_tof'
    checkpoints?: []
  },
  scoreId?: number,
  status?: string,
  createdAt: string
}
```

**Mínimo pra criar**: `campaignId`, `name`, `channel`, `actionType`, `sector`, `funnel`.

## Lead

Vive em `App.state.actions[].leads` (por ação) OU `App.state.globalLeads` (base global). Tipicamente:

```ts
{
  id: string | number,
  name: string,
  email: string,
  phone?: string,
  idade?: number,
  estado?: string,         // 'sao paulo', 'rio de janeiro', etc
  cidade?: string,
  sexo?: string,           // 'feminino' | 'masculino'
  estadoCivil?: string,    // 'solteiro' | 'casado' | etc
  faixaSalarial?: string,
  tags?: string[],         // tags comportamentais: #open, #cta, #lp, etc
  behaviorTags?: string[],
  channels?: string[],
  score?: number,
  globalScore?: number,    // após RdCrmLeadScoringBridge.applyToLead
  temperature?: string,    // 'Quente' | 'Morno' | 'Frio'
  rdContactId?: string,    // ID no RD CRM se sincronizado
  createdAt: string
}
```

Leads não são criados por Djow no MVP — vêm via:
- Conversão em LP (pixel + `rdCrmConversionBridge`)
- Upload manual em Leads → "Inserir leads"
- Pull RD Marketing (`rdMarketingContactService`)

## Estágios do funil (lead currentStage)

```
mkt_tof, mkt_mof, mkt_bof          → Marketing TOF/MOF/BOF
vnd_tof, vnd_mof, vnd_bof          → Vendas TOF/MOF/BOF
cs_onboarding, cs_retencao, cs_expansao  → CS
```

## Score

```ts
{
  id: number,
  name: string,
  description?: string,
  tagRules: [
    { tag: '#open', score: 5 },
    { tag: '#read', score: 10 },
    { tag: '#cta', score: 30 }
  ]
}
```

Default tem `id: 1` chamado "Score comportamento padrão".

## Como criar entidades (Djow → tools)

Tools disponíveis no backend (`api/djow-chat.js`):
- `create_product({ name, priceValue?, price?, ticket?, description? })`
- `create_campaign({ name, productId, status?, description? })`
- `create_action({ campaignId, name, channel, actionType, sector, funnel, ... })`

Cada tool escreve direto em `journey_state.state_json` no Postgres. Frontend faz pull no fim da resposta do Djow.

## Confirmação

Por convenção:
- **Criação**: direto, sem confirmação (1 produto/campanha/ação extra não machuca)
- **Destrutivo** (delete, sobrescrever, reset): SEMPRE perguntar "Confirma X? sim/não" e esperar resposta antes de aplicar

## Informações sigilosas (NUNCA expor)

Se o user pedir, responder educadamente "Não posso te mostrar essa informação — é sigilosa do sistema":

- `password_hash` da tabela users
- Env vars do Railway: ANTHROPIC_API_KEY, JWT_SECRET, MASTER_PASSWORD, DATABASE_URL, RD_WEBHOOK_SECRET
- Tokens em `App.state.integrations.rd`:
  - `crmPersonalToken`
  - `accessToken` / `refreshToken`
  - `clientSecret`
  - `crmOauth.clientSecret`, `crmOauth.accessToken`, `crmOauth.refreshToken`
- Senhas de usuários cadastrados em qualquer campo
