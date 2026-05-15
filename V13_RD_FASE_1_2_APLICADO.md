# LeadJourney V13 — RD Station Fase 1 + 2 aplicada

Base: V12.4.6 — produtos criados alinhado.

## Fase 1 — Base de integração RD

Implementado:
- `src/integrations/rd/`
- Configuração OAuth no modal de Configurações
- Campos: Client ID, Client Secret, Redirect URI, Authorization Code, tokens e conta
- Botão Gerar URL OAuth
- Botão Testar conexão
- Botão Limpar RD
- Persistência em `App.state.integrations.rd`

## Fase 2 — Cadastro dinâmico da ação

Implementado:
- Canal `RD Email`
- Quando o canal RD Email é selecionado, abre bloco específico:
  - Lista/segmentação
  - Campanha de e-mail RD
  - Assunto
  - Data de disparo
  - URL/CTA principal
  - Tags aplicadas
  - Campo identificador do lead
  - Frequência de sync
- KPIs padrão preparados:
  - Enviados
  - Entregues
  - Aberturas
  - Cliques
  - CTR
  - CTOR
  - Bounces
  - Descadastros
  - Conversões

## Regra

RD Email alimenta KPIs. OKRs continuam sendo definidos no LeadJourney.
