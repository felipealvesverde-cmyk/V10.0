// V40.12.2 — Catálogo de Consequências por Arquétipo.
//
// Sprint 3 da Onda V2 do "Definir Audiência" (Felipe 2026-06-23).
//
// O QUE É: dicionário arquétipo → comportamento de cada módulo do LJ.
// Audiência fundida (modeloNegocio + modeloOperacional + refinamento)
// classifica em 1 dos arquétipos abaixo. Os módulos consumidores
// (Velocidade, RevOps, Djow, Score, Mapa) leem este catálogo pra
// adaptar labels, hints, ranges e tom.
//
// LEI cravada na máxima [[maxima-triangulacao-viva]]:
//   - Catálogo VIVO (este arquivo), não hardcoded em módulos
//   - VERSIONADO (CONSEQUENCES_VERSION)
//   - Audiência salva carimba qual versão foi usada
//   - Lista de arquétipos cresce com aprendizado real
//
// Cada arquétipo descreve 5 dimensões consumidas:
//   velocidade  → V/C/L/T labels + diagnóstico no card de Velocidade
//   score       → pesos do Score Engine RFV
//   djow        → tom + foco da conversa lateral
//   revops      → ranges saudáveis (Payback, ROAS, etc)
//   mapa        → KRs-mãe sugeridos
//
// PRÓXIMA EVOLUÇÃO (V2): arquétipos podem ter "variantes" e LJ aprender
// padrões novos. Por agora, 8 arquétipos cobrem 95% dos casos.

(function() {
  'use strict';

  const ARCHETYPES = {
    // E-commerce B2C de impulso (Pilsen D2C, Loja online, infoproduto)
    b2c_ecommerce_impulso: {
      label: 'E-commerce B2C de Impulso',
      tagline: 'Consumidor compra direto no site',
      // V40.13.0 — Onda 2 da Audiência. Cor semântica do arquétipo, consumida
      // pelos módulos visualmente adaptativos (Velocidade, Djow lateral).
      // Impulso B2C atrai pela comunicação → Marketing (rosa-magenta).
      accent: 'var(--lj-marketing)',
      matches: [
        { negocio: 'b2c', operacional: 'ecommerce', when: { ciclo: ['impulso', 'curto'], ticket: ['micro', 'medio'] } }
      ],
      velocidade: {
        v_label: 'Sessões únicas no site',
        c_label: 'Sessão → compra',
        l_label: 'Ticket médio (carrinho)',
        t_label: 'Minutos a horas (impulso)',
        v_source: 'Pixel + UTM + GA4',
        diagnostico: 'V baixo → tráfego ou awareness. C baixo → produto, preço ou checkout. L baixo → cross-sell. T alto → cliente comparando.'
      },
      score: { weights: { intencao: 0.5, engajamento: 0.3, fit: 0.2 }, threshold: 70 },
      djow:  { tone: 'consumidor, leveza', focus: 'CRO no checkout, retargeting, frete grátis, urgência' },
      revops:{ payback_saudavel: '< 1 mês', roas_min: 3.0, foco: 'ROAS por canal + taxa de carrinho' },
      mapa:  { kr_mae_sugerido: 'Receita mensal de checkout', krs_secundarios: ['Taxa de conversão', 'AOV', 'Taxa de carrinho abandonado'] }
    },

    // B2B Atacado / Wholesale (Pilsen Atacado, distribuidor, cervejaria → bar)
    b2b_atacado_consultivo: {
      label: 'B2B Atacado / Wholesale',
      tagline: 'SDR vende em pedido fechado pra estabelecimento',
      // Comercial, SDR consultivo, relacionamento de campo → Vendas (turquesa).
      accent: 'var(--lj-sales)',
      matches: [
        { negocio: 'b2b', operacional: 'atacado' },
        { negocio: 'b2b2c', operacional: 'atacado' }
      ],
      velocidade: {
        v_label: 'Estabelecimentos abordados',
        c_label: 'Abordagem → 1º pedido',
        l_label: 'Ticket médio do pedido',
        t_label: 'Dias a semanas (relacionamento)',
        v_source: 'CRM (RD/HubSpot/Pipedrive) — pipeline do SDR',
        diagnostico: 'V baixo → SDR mal alocado ou rota. C baixo → degustação, mix, preço de tabela. L baixo → ticket de pedido pequeno (incentivar volume). T alto → ciclo de aprovação longo.'
      },
      score: { weights: { fit_pj: 0.4, frequencia_pedido: 0.3, ticket_pedido: 0.3 }, threshold: 75 },
      djow:  { tone: 'comercial sênior, sem jargão de Ads', focus: 'pipeline coverage, win rate, rampagem do SDR, ticket por pedido' },
      revops:{ payback_saudavel: '3-6 meses', roas_min: null, foco: 'pipeline coverage + ticket médio do pedido + churn de estabelecimento' },
      mapa:  { kr_mae_sugerido: 'Novos estabelecimentos ativos/mês', krs_secundarios: ['Ticket médio do pedido', 'Frequência de recompra', 'Cobertura geográfica'] }
    },

    // SaaS B2B Self-Service (PLG)
    b2b_saas_plg: {
      label: 'SaaS B2B Product-Led',
      tagline: 'Cliente entra no freemium e cresce sozinho',
      // Growth product-led, ativação direta → Vendas (turquesa).
      accent: 'var(--lj-sales)',
      matches: [
        { negocio: 'b2b', operacional: 'freemium' },
        { negocio: 'b2b', operacional: 'saas', when: { time_comercial: ['autoatendimento', 'hibrido'], ticket: ['medio'] } }
      ],
      velocidade: {
        v_label: 'Signups + ativações',
        c_label: 'Ativação → upgrade pago',
        l_label: 'MRR médio por conta paga',
        t_label: 'Dias a semanas (uso → upgrade)',
        v_source: 'Tracker de produto (PostHog/Mixpanel) + Auth events',
        diagnostico: 'V baixo → SEO ou onboarding. C baixo → valor não destrava no free. L baixo → faltam features do plano superior. T alto → fricção pra trocar de plano.'
      },
      score: { weights: { uso_ativo: 0.5, power_user: 0.3, atingiu_limite: 0.2 }, threshold: 65 },
      djow:  { tone: 'product manager, foco em ativação', focus: 'PQL definition, time-to-value, expansion revenue, NRR' },
      revops:{ payback_saudavel: '6-12 meses', roas_min: 2.0, foco: 'CAC payback + LTV/CAC + NRR' },
      mapa:  { kr_mae_sugerido: 'MRR de contas pagas', krs_secundarios: ['Taxa de ativação', 'Taxa de upgrade', 'Expansion revenue'] }
    },

    // SaaS B2B Enterprise (sales-led, alto ticket, ciclo longo)
    b2b_saas_enterprise: {
      label: 'SaaS B2B Enterprise',
      tagline: 'Vendas com SDR/AE pra alto ticket',
      // ARR, governança comercial complexa, longo ciclo → RevOps (roxo).
      accent: 'var(--lj-revops)',
      matches: [
        { negocio: 'b2b', operacional: 'saas', when: { ticket: ['alto', 'enterprise'], time_comercial: ['outbound', 'inbound', 'hibrido'] } }
      ],
      velocidade: {
        v_label: 'MQLs / SQLs no CRM',
        c_label: 'SQL → contrato assinado',
        l_label: 'ACV (Annual Contract Value)',
        t_label: 'Semanas a meses (ciclo de venda)',
        v_source: 'CRM (RD/HubSpot/Salesforce) + atribuição de marketing',
        diagnostico: 'V baixo → demand gen ou ICP errado. C baixo → pitch, demo ou pricing. L baixo → desconto ou downsell. T alto → comitê de compra longo.'
      },
      score: { weights: { fit_porte: 0.3, decisor_mandato: 0.3, intencao: 0.2, engajamento: 0.2 }, threshold: 80 },
      djow:  { tone: 'consultor B2B, ROI e compliance', focus: 'pipeline coverage, win rate, ACV expansion, sales velocity' },
      revops:{ payback_saudavel: '12-18 meses', roas_min: null, foco: 'CAC payback + LTV/CAC + NRR (gross retention > 90%)' },
      mapa:  { kr_mae_sugerido: 'ARR fechado/trimestre', krs_secundarios: ['Win rate', 'ACV médio', 'Sales velocity'] }
    },

    // Consultoria estratégica (alto ticket, ciclo longo, decisor sênior)
    b2b_consultoria_premium: {
      label: 'Consultoria Estratégica',
      tagline: 'Projeto alto ticket, decisor sênior',
      // Estratégico, decisor sênior, narrativa de transformação → RevOps (roxo).
      accent: 'var(--lj-revops)',
      matches: [
        { negocio: 'b2b', operacional: 'consultoria' },
        { negocio: 'b2c', operacional: 'consultoria' }
      ],
      velocidade: {
        v_label: 'Conversas de descoberta',
        c_label: 'Descoberta → contrato',
        l_label: 'Fee do projeto',
        t_label: 'Meses (projeto fechado)',
        v_source: 'Calendly/agenda + CRM (registro de descoberta)',
        diagnostico: 'V baixo → indicação fraca ou autoridade não construída. C baixo → diagnóstico não convenceu. L baixo → escopo encolhido pra fechar. T alto → comitê ou orçamento travado.'
      },
      score: { weights: { decisor_mandato: 0.4, dor_estrategica: 0.3, verba_projeto: 0.3 }, threshold: 85 },
      djow:  { tone: 'sócio consultivo, gravidade, sem jargão de growth', focus: 'qualificação rigorosa, narrativa de transformação, prova de competência' },
      revops:{ payback_saudavel: '< 1 projeto', roas_min: null, foco: 'pipeline coverage + fee médio + utilization' },
      mapa:  { kr_mae_sugerido: 'Receita de contratos novos/trimestre', krs_secundarios: ['Pipeline coverage', 'Fee médio', 'Utilization do time'] }
    },

    // Manufatura B2B industrial
    b2b_manufatura_industrial: {
      label: 'Manufatura B2B Industrial',
      tagline: 'Indústria → indústria, com homologação',
      // Homologação, confiança técnica de longo prazo → CS (azul-céu).
      accent: 'var(--lj-cs)',
      matches: [
        { negocio: 'b2b', operacional: 'manufatura' }
      ],
      velocidade: {
        v_label: 'Solicitações de cotação (RFQ)',
        c_label: 'RFQ → pedido firme',
        l_label: 'Ticket médio do contrato',
        t_label: 'Meses (homologação + comercial)',
        v_source: 'CRM (com integração ERP) + portal de cotação',
        diagnostico: 'V baixo → ausência em feiras/diretórios técnicos. C baixo → homologação travada ou spec não bate. L baixo → desconto pra entrar. T alto → comitê técnico longo.'
      },
      score: { weights: { compatibilidade_tecnica: 0.4, volume_industrial: 0.3, decisor_tecnico_comercial: 0.3 }, threshold: 80 },
      djow:  { tone: 'engenheiro comercial, spec rigorosa', focus: 'homologação, lead time de produção, capacity, qualidade' },
      revops:{ payback_saudavel: '12-24 meses', roas_min: null, foco: 'pipeline de homologação + ticket de contrato + share of wallet' },
      mapa:  { kr_mae_sugerido: 'Pedidos firmes homologados/trimestre', krs_secundarios: ['Pipeline de homologação', 'Ticket de contrato', 'Share of wallet por cliente'] }
    },

    // Agribusiness
    b2b_agribusiness: {
      label: 'Agribusiness',
      tagline: 'Cadeia agro com janela de safra',
      // Safra, ciclo grande de receita, retenção entre janelas → Receita (amarelo).
      accent: 'var(--lj-revenue)',
      matches: [
        { negocio: 'b2b', operacional: 'agribusiness' },
        { negocio: 'b2b2c', operacional: 'agribusiness' }
      ],
      velocidade: {
        v_label: 'Produtores/cooperativas abordados',
        c_label: 'Abordagem → 1ª safra fechada',
        l_label: 'Ticket por safra/contrato',
        t_label: 'Semanas a meses (dentro da janela)',
        v_source: 'CRM + agenda de visitas técnicas + cooperativas parceiras',
        diagnostico: 'V baixo → cobertura geográfica fraca. C baixo → confiança ou crédito. L baixo → tabela de preços (commodities). T alto → fora de janela de safra.'
      },
      score: { weights: { escala_produtiva: 0.3, safra_compativel: 0.3, confianca_relacional: 0.2, decisor_proprietario: 0.2 }, threshold: 75 },
      djow:  { tone: 'agro tradicional, confiança e janela', focus: 'cobertura geográfica, janela de safra, crédito rural, indicação' },
      revops:{ payback_saudavel: '1-2 safras', roas_min: null, foco: 'cobertura por região + ticket por safra + retenção entre safras' },
      mapa:  { kr_mae_sugerido: 'Receita de safra fechada (R$)', krs_secundarios: ['Cobertura geográfica', 'Ticket por contrato', 'Recompra entre safras'] }
    },

    // Marketplace bilateral
    marketplace_bilateral: {
      label: 'Marketplace Bilateral',
      tagline: 'Plataforma equilibra oferta + demanda',
      // Atração dual (oferta + demanda), liquidez de plataforma → Marketing (rosa).
      accent: 'var(--lj-marketing)',
      matches: [
        { negocio: 'c2c', operacional: 'marketplace' },
        { negocio: 'b2b', operacional: 'marketplace' },
        { negocio: 'b2c', operacional: 'marketplace' },
        { negocio: 'b2b2c', operacional: 'marketplace' }
      ],
      velocidade: {
        v_label: 'Cadastros ativos (oferta + demanda)',
        c_label: 'Cadastro → 1ª transação',
        l_label: 'Take rate × ticket médio',
        t_label: 'Variável por lado',
        v_source: 'Auth events + onboarding + 1ª transação',
        diagnostico: 'V baixo → aquisição desequilibrada entre lados. C baixo → liquidez insuficiente. L baixo → take rate apertada. T alto → matching ruim.'
      },
      score: { weights: { ativacao_inicial: 0.4, volume_liquidez: 0.3, comportamento_plataforma: 0.3 }, threshold: 70 },
      djow:  { tone: 'product manager de marketplace, equilíbrio', focus: 'liquidez por lado, matching, retention, GMV growth' },
      revops:{ payback_saudavel: '< 6 meses', roas_min: 4.0, foco: 'CAC por lado + take rate + GMV growth' },
      mapa:  { kr_mae_sugerido: 'GMV mensal', krs_secundarios: ['Liquidez por lado', 'Take rate', 'Repeat purchase rate'] }
    }
  };

  // Fallback genérico quando nenhum arquétipo matcha — não impede a Audiência de funcionar,
  // só perde adaptatividade. Sprint 4+ pode propor "cravar arquétipo novo" pelo Master.
  const FALLBACK = {
    label: 'Operação Não Classificada',
    tagline: 'Combinação rara — usando defaults genéricos',
    // FALLBACK genérico → slate puro (sem cor da paleta semântica). Sinal
    // visual sutil pro Master "ainda não classificamos pra alimentar pele".
    accent: '#64748B',
    velocidade: {
      v_label: 'Visitas',
      c_label: 'Visita → cliente',
      l_label: 'Ticket médio',
      t_label: 'Ciclo médio',
      v_source: 'Tracker disponível',
      diagnostico: 'Combinação rara. LJ usa defaults — sugiro cadastrar arquétipo customizado.'
    },
    score: { weights: { intencao: 0.4, engajamento: 0.3, fit: 0.3 }, threshold: 70 },
    djow:  { tone: 'consultivo genérico', focus: 'descobrir padrão antes de prescrever' },
    revops:{ payback_saudavel: 'a definir', roas_min: null, foco: 'definir métricas com cliente' },
    mapa:  { kr_mae_sugerido: 'a definir', krs_secundarios: [] }
  };

  window.AudienceConsequencesCatalog = {
    // V40.13.0 — Bump pra 1.1.0: campo `accent` adicionado em todos os arquétipos.
    // Semver minor — não quebra consumidores antigos (campo opcional).
    CONSEQUENCES_VERSION: '1.1.0',
    ARCHETYPES,
    FALLBACK
  };
})();
