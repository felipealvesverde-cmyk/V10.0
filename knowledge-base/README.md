# Knowledge Base do Djow

Esta pasta é o **banco de conhecimento** do Djow (o assistente AI do LeadJourney). Todo arquivo `.md` aqui é carregado automaticamente no system prompt do Claude quando o user faz uma pergunta.

## Por que existe?

O Djow tem acesso a **dois tipos de informação**:

1. **Dados da operação** (App.state + Postgres do user) — via tools de function calling. Isso é o que o user **fez**.
2. **Conhecimento de domínio** — esta pasta. Isso é o que vc (Felipe, dev) **ensina** ao Djow para ele dar insights.

Exemplo: o Djow sabe quantas campanhas o user tem (via tool `list_campaigns()`), mas não sabe **o que é uma boa estratégia de RevOps** — esse conhecimento mora aqui.

## Como funciona

1. Backend (`server.js` ou `api/djow-chat.js`) lê **todos os arquivos `.md`** desta pasta no startup
2. Concatena em uma única string `KNOWLEDGE_BASE`
3. Injeta no system prompt do Claude:
   ```
   Você é o Djow, assistente AI do LeadJourney.
   
   [...]
   
   ## Conhecimento de domínio
   {KNOWLEDGE_BASE}
   ```
4. Claude usa esse conhecimento pra responder

## Como editar / adicionar

### Workflow (passo a passo)

1. **Edita ou cria** um arquivo `.md` aqui
   - Exemplos: `revops.md`, `cx.md`, `pricing.md`, `funnel-best-practices.md`
   - Pode ser qualquer nome — o backend pega todos
2. **Commit** as mudanças:
   ```bash
   git add knowledge-base/
   git commit -m "KB: atualiza RevOps com método X"
   git push
   ```
3. **Aguarda o Railway redeploy** (~1min)
4. Pronto. Próxima pergunta ao Djow já usa o KB atualizado.

### Recarregar sem redeploy (futuro)

Atualmente o KB é carregado no startup do servidor. Se vc quiser recarregar sem deploy, precisamos adicionar um endpoint `/api/djow-reload-kb` (master-only). Pra V26.0.0 fica com redeploy mesmo.

## Limites práticos

- **Tamanho total**: até ~30k caracteres é ok (cabe no contexto do Claude com folga)
- Se passar de 30k, considerar:
  - Migrar pra Postgres com retrieval (vector embeddings)
  - Quebrar em arquivos menores + tool `search_kb(query)` que faz busca

## Convenções de escrita

Os MDs devem ser:
- **Diretos**: o Claude é bom em digerir markdown, sem floreio
- **Estruturados**: use `##` pra tópicos, listas pra enumerar
- **Contextualizados**: comece com o "quando" — ex: "Quando o user tem CPA acima da meta, recomendar:..."
- **Acionáveis**: termine com recomendações práticas, não teoria solta

Exemplo bom:
```md
## CAC vs LTV — quando alertar

Se LTV/CAC < 3, a operação tá no vermelho. Indicadores que apontam isso:
- Custo de aquisição médio > ticket × 0.33
- Churn > 5%/mês com CAC > R$ 200

**Recomendação**: revisar canal de aquisição com maior CPA primeiro.
```

Exemplo ruim:
```md
RevOps é a disciplina que une marketing, vendas e CS...
[parágrafo genérico que o Claude já sabe]
```

## Arquivos atuais

Veja os `.md` nessa pasta. Cada um é uma área de conhecimento. Comece pelos exemplos:
- `revops.example.md` — exemplo de KB de RevOps
- `cx.example.md` — exemplo de KB de CX

Renomeie pra `revops.md` / `cx.md` (sem o `.example`) quando estiver pronto pra ativar. Os `.example` ficam pra referência mas **não** são carregados pelo Djow.
