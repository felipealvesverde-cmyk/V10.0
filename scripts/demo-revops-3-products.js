// V40.7.8 — RevOps & Governança populado pros 3 produtos do tenant demo:
//   - 1781869701831 → Cerveja Pilsen
//   - 5001          → Cerveja Weiss
//   - 5002          → Chopp de Vinho
//
// Função `buildRevopsFinanceV2()` retorna um objeto pronto pra merge em
// state.revopsFinanceV2[productId]. Cada produto traz:
//   - sales projection mensal + offer principal com meta de vendas
//   - groups: acquisition (S&M), variable (CMV), fixed (G&A)
//   - custom KPIs por contexto do produto
//   - linhas extras de DRE (deduções, comissões, inadimplência)

const NOW_ISO = '2026-06-19T00:00:00Z';

function gid(prefix) { return `${prefix}_${Math.random().toString(36).slice(2, 8)}`; }
function fixed(value) { return { mode: 'fixed', value: Number(value) }; }

function buildPilsen() {
  return {
    productId: 1781869701831,
    period: 'monthly',
    salesProjection: 12000,
    offers: [{
      id: gid('offer'), name: 'Cerveja Pilsen 600ml',
      price: 22, mix: 100, selectedForTicket: true,
      kind: 'main', metaVendas: 12000
    }],
    ticketMode: 'weighted',
    ticketManualValue: 0,
    groups: [
      {
        id: gid('g'), label: 'Aquisição (S&M)', bucket: 'acquisition',
        items: [
          { id: gid('it'), name: 'Meta Ads',              calc: fixed(8000) },
          { id: gid('it'), name: 'Google Ads',            calc: fixed(4000) },
          { id: gid('it'), name: 'Influencers regionais', calc: fixed(5000) },
          { id: gid('it'), name: 'SDR/Comercial',         calc: fixed(5000) }
        ]
      },
      {
        id: gid('g'), label: 'CMV (Variável)', bucket: 'variable',
        items: [
          { id: gid('it'), name: 'Insumos (malte, lúpulo, levedura)', calc: fixed(90000) },
          { id: gid('it'), name: 'Embalagem + rótulo',                 calc: fixed(18000) }
        ]
      },
      {
        id: gid('g'), label: 'G&A (Fixo)', bucket: 'fixed',
        items: [
          { id: gid('it'), name: 'Folha admin (3 pessoas)', calc: fixed(14000) },
          { id: gid('it'), name: 'Aluguel galpão',           calc: fixed(8000)  },
          { id: gid('it'), name: 'Software/SaaS',            calc: fixed(2500)  },
          { id: gid('it'), name: 'Contabilidade',            calc: fixed(1800)  }
        ]
      }
    ],
    customKpis: [
      { id: gid('kpi'), name: 'CAC (R$/lead conv.)',     formula: '=0', unit: 'BRL'     },
      { id: gid('kpi'), name: 'Margem por garrafa',      formula: '=0', unit: 'percent' },
      { id: gid('kpi'), name: 'Recompra 90d',            formula: '=0', unit: 'percent' },
      { id: gid('kpi'), name: 'NPS',                     formula: '=0', unit: 'unit'    }
    ],
    dreExtraLines: [
      { id: gid('dre'), name: 'Inadimplência',     value: '2640', signal: '-', afterStep: 'deducoes' },
      { id: gid('dre'), name: 'Frete sobre venda', value: '7920', signal: '-', afterStep: 'venda_liquida' }
    ],
    dreExtraGroups: [],
    savedAt: NOW_ISO
  };
}

function buildWeiss() {
  return {
    productId: 5001,
    period: 'monthly',
    salesProjection: 4500,
    offers: [{
      id: gid('offer'), name: 'Cerveja Weiss 500ml',
      price: 28, mix: 100, selectedForTicket: true,
      kind: 'main', metaVendas: 4500
    }],
    ticketMode: 'weighted',
    ticketManualValue: 0,
    groups: [
      {
        id: gid('g'), label: 'Aquisição (S&M)', bucket: 'acquisition',
        items: [
          { id: gid('it'), name: 'Meta Ads (verão 2026)',          calc: fixed(5000) },
          { id: gid('it'), name: 'Influencers gourmet',             calc: fixed(4000) },
          { id: gid('it'), name: 'Eventos/Festival Cervejeiro',     calc: fixed(4000) },
          { id: gid('it'), name: 'Outbound bares parceiros',        calc: fixed(3000) }
        ]
      },
      {
        id: gid('g'), label: 'CMV (Variável)', bucket: 'variable',
        items: [
          { id: gid('it'), name: 'Malte importado',  calc: fixed(22500) },
          { id: gid('it'), name: 'Lúpulo bavarian',  calc: fixed(11250) },
          { id: gid('it'), name: 'Embalagem premium', calc: fixed(9000)  }
        ]
      },
      {
        id: gid('g'), label: 'G&A (Fixo)', bucket: 'fixed',
        items: [
          { id: gid('it'), name: 'Equipe artesanal (2 cervejeiros)', calc: fixed(12000) },
          { id: gid('it'), name: 'Estoque refrigerado',              calc: fixed(4500)  },
          { id: gid('it'), name: 'Software/SaaS',                    calc: fixed(1500)  }
        ]
      }
    ],
    customKpis: [
      { id: gid('kpi'), name: 'CAC bar parceiro',  formula: '=0', unit: 'BRL'     },
      { id: gid('kpi'), name: 'Bares ativos/mês',  formula: '=0', unit: 'unit'    },
      { id: gid('kpi'), name: 'Recompra bar 30d',  formula: '=0', unit: 'percent' },
      { id: gid('kpi'), name: 'Margem por garrafa', formula: '=0', unit: 'percent' }
    ],
    dreExtraLines: [
      { id: gid('dre'), name: 'Comissão bares parceiros', value: '10080', signal: '-', afterStep: 'venda_liquida' },
      { id: gid('dre'), name: 'Inadimplência',            value: '2520',  signal: '-', afterStep: 'deducoes'      }
    ],
    dreExtraGroups: [],
    savedAt: NOW_ISO
  };
}

function buildChoppVinho() {
  return {
    productId: 5002,
    period: 'monthly',
    salesProjection: 1200,
    offers: [{
      id: gid('offer'), name: 'Chopp de Vinho 250ml',
      price: 72, mix: 100, selectedForTicket: true,
      kind: 'main', metaVendas: 1200
    }],
    ticketMode: 'weighted',
    ticketManualValue: 0,
    groups: [
      {
        id: gid('g'), label: 'Aquisição (S&M)', bucket: 'acquisition',
        items: [
          { id: gid('it'), name: 'LinkedIn Ads premium',     calc: fixed(6000)  },
          { id: gid('it'), name: 'PR/Mídia gastronômica',     calc: fixed(8000)  },
          { id: gid('it'), name: 'Eventos Top 50 SP/RJ',      calc: fixed(10000) },
          { id: gid('it'), name: 'Sommelier consultant',      calc: fixed(4000)  }
        ]
      },
      {
        id: gid('g'), label: 'CMV (Variável)', bucket: 'variable',
        items: [
          { id: gid('it'), name: 'Vinho base reserva',  calc: fixed(18000) },
          { id: gid('it'), name: 'Processo cervejaria', calc: fixed(8400)  },
          { id: gid('it'), name: 'Embalagem gourmet',   calc: fixed(7200)  }
        ]
      },
      {
        id: gid('g'), label: 'G&A (Fixo)', bucket: 'fixed',
        items: [
          { id: gid('it'), name: 'Equipe especializada',         calc: fixed(8500) },
          { id: gid('it'), name: 'Câmara fria especializada',    calc: fixed(3500) },
          { id: gid('it'), name: 'Software gourmet',             calc: fixed(2000) },
          { id: gid('it'), name: 'Logística refrigerada',        calc: fixed(4000) }
        ]
      }
    ],
    customKpis: [
      { id: gid('kpi'), name: 'CAC restaurante',     formula: '=0', unit: 'BRL'     },
      { id: gid('kpi'), name: 'Top 50 ativos',       formula: '=0', unit: 'unit'    },
      { id: gid('kpi'), name: 'Recompra 60d',        formula: '=0', unit: 'percent' },
      { id: gid('kpi'), name: 'Margem por chopp',    formula: '=0', unit: 'percent' }
    ],
    dreExtraLines: [
      { id: gid('dre'), name: 'Comissão sommeliers',          value: '8640', signal: '-', afterStep: 'venda_liquida' },
      { id: gid('dre'), name: 'Bonificação embaixadores',     value: '2592', signal: '-', afterStep: 'lucro_bruto'   }
    ],
    dreExtraGroups: [],
    savedAt: NOW_ISO
  };
}

function buildRevopsFinanceV2() {
  return {
    '1781869701831': buildPilsen(),
    '5001': buildWeiss(),
    '5002': buildChoppVinho()
  };
}

const REVOPS_ADDON_VERSION = 'demo-revops-3-products-v1';

module.exports = { buildRevopsFinanceV2, REVOPS_ADDON_VERSION };
