var OkrSuggestionEngine = {
  library: {
    'marketing|tof|instagram orgânico|post': [
      { name: 'Alcance qualificado', target: '5000', current: '0', unit: 'pessoas', benchmark: 'crescimento semanal', trend: 'stable', health: 'Atenção' },
      { name: 'Engajamento salvo/compartilhado', target: '4%', current: '0%', unit: '%', benchmark: 'orgânico', trend: 'stable', health: 'Atenção' },
      { name: 'Cliques para conteúdo MOF', target: '2%', current: '0%', unit: '%', benchmark: 'orgânico', trend: 'stable', health: 'Atenção' }
    ],
    'marketing|mof|instagram orgânico|post': [
      { name: 'CTR', target: '4%', current: '0%', unit: '%', benchmark: 'MOF orgânico', trend: 'stable', health: 'Atenção' },
      { name: 'Deep Scroll', target: '45%', current: '0%', unit: '%', benchmark: 'LP/conteúdo', trend: 'stable', health: 'Atenção' },
      { name: 'Clique CTA', target: '2%', current: '0%', unit: '%', benchmark: 'ação MOF', trend: 'stable', health: 'Atenção' }
    ],
    'marketing|bof|meta ads|remarketing': [
      { name: 'Clique CTA BOF', target: '5%', current: '0%', unit: '%', benchmark: 'remarketing', trend: 'stable', health: 'Atenção' },
      { name: 'Leads para vendas', target: '80', current: '0', unit: 'leads', benchmark: 'handoff', trend: 'stable', health: 'Atenção' },
      { name: 'CPL BOF', target: 'R$ 35', current: 'R$ 0', unit: 'R$', benchmark: 'mídia paga', trend: 'stable', health: 'Atenção' }
    ],
    'vendas|tof|whatsapp|sdr': [
      { name: 'Taxa de resposta', target: '35%', current: '0%', unit: '%', benchmark: 'SDR', trend: 'stable', health: 'Atenção' },
      { name: 'Conexões válidas', target: '50', current: '0', unit: 'leads', benchmark: 'prospecção', trend: 'stable', health: 'Atenção' },
      { name: 'Avanço para MOF Vendas', target: '25%', current: '0%', unit: '%', benchmark: 'qualificação', trend: 'stable', health: 'Atenção' }
    ],
    'cs|bof|email|email': [
      { name: 'Taxa de resposta', target: '20%', current: '0%', unit: '%', benchmark: 'base ativa', trend: 'stable', health: 'Atenção' },
      { name: 'Expansão', target: '10', current: '0', unit: 'clientes', benchmark: 'upsell', trend: 'stable', health: 'Atenção' },
      { name: 'Retenção/NPS', target: '75', current: '0', unit: 'score', benchmark: 'CS', trend: 'stable', health: 'Atenção' }
    ]
  },
  normalize(value) { return String(value || '').trim().toLowerCase(); },
  defaultFor(sector, funnel, channel, type) {
    const s = this.normalize(sector), f = this.normalize(funnel), c = this.normalize(channel), t = this.normalize(type);
    const keys = [`${s}|${f}|${c}|${t}`, `${s}|${f}|${c}|post`, `${s}|${f}|${c}|remarketing`, `${s}|${f}|whatsapp|sdr`];
    for (const key of keys) if (this.library[key]) return Utils.clone(this.library[key]);
    if (s === 'marketing' && f === 'mof') return Utils.clone(this.library['marketing|mof|instagram orgânico|post']);
    if (s === 'marketing') return [
      { name: 'CPL', target: 'R$ 30', current: 'R$ 0', unit: 'R$', benchmark: 'aquisição', trend: 'stable', health: 'Atenção' },
      { name: 'CTR', target: '3%', current: '0%', unit: '%', benchmark: 'canal', trend: 'stable', health: 'Atenção' },
      { name: 'Leads qualificados', target: '100', current: '0', unit: 'leads', benchmark: 'MQL', trend: 'stable', health: 'Atenção' }
    ];
    if (s === 'vendas') return [
      { name: 'Taxa de resposta', target: '30%', current: '0%', unit: '%', benchmark: 'comercial', trend: 'stable', health: 'Atenção' },
      { name: 'Show-up', target: '65%', current: '0%', unit: '%', benchmark: 'reuniões', trend: 'stable', health: 'Atenção' },
      { name: 'Close rate', target: '20%', current: '0%', unit: '%', benchmark: 'BOF', trend: 'stable', health: 'Atenção' }
    ];
    return [
      { name: 'Retenção', target: '90%', current: '0%', unit: '%', benchmark: 'CS', trend: 'stable', health: 'Atenção' },
      { name: 'NPS', target: '75', current: '0', unit: 'score', benchmark: 'experiência', trend: 'stable', health: 'Atenção' },
      { name: 'Expansão', target: '10%', current: '0%', unit: '%', benchmark: 'base', trend: 'stable', health: 'Atenção' }
    ];
  }
};
window.OkrSuggestionEngine = OkrSuggestionEngine;
