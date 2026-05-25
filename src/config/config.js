var Config = {
      storageKey: 'leadscore_v11_2_clean_data_layer',
      channels: ['RD Station', 'Instagram Orgânico', 'RD Email', 'Instagram Ads', 'Meta Ads', 'WhatsApp', 'Google Ads', 'LinkedIn', 'Email', 'SDR', 'Outbound', 'Webhook', 'Outro'],
      allChannels() {
        const custom = (window.App?.state?.customChannels) || [];
        return [...this.channels, ...custom.filter(c => !this.channels.includes(c))];
      },
      allActionTypes() {
        const custom = (window.App?.state?.customActionTypes) || [];
        return [...this.actionTypes, ...custom.filter(t => !this.actionTypes.includes(t))];
      },
      sectors: ['Marketing', 'Vendas', 'CS'],
      funnels: ['TOF', 'MOF', 'BOF'],
      actionTypes: ['Post', 'Campanha', 'Sequência', 'Automação', 'Ligação', 'Remarketing', 'Webinar', 'Nutrição', 'SDR', 'Email', 'LP', 'WhatsApp', 'Checkout', 'CRM', 'CS', 'Canal de aquisição', 'Outro'],
      tabs: [
        // V25.0.0 — Página inicial (home cockpit). Primeira do menu.
        { id: 'home', label: 'Início', icon: 'home' },
        { id: 'products', label: 'Produtos', icon: 'package' },
        { id: 'campaigns', label: 'Campanhas', icon: 'megaphone' },
        { id: 'actions', label: 'Ações da campanha', icon: 'plug' },
        { id: 'results', label: 'Resultados', icon: 'bar-chart-3' },
        { id: 'scores', label: 'Score', icon: 'gauge' },
        { id: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard' },
        { id: 'leads', label: 'Leads', icon: 'users-round' },
        { id: 'revops', label: 'RevOps & Governança', icon: 'landmark' }
      ],
      emptyOkrs: [
        { name: '', target: '', current: '' },
        { name: '', target: '', current: '' },
        { name: '', target: '', current: '' }
      ],
      defaultScore: {
        id: 1,
        name: 'Score comportamento padrão',
        description: 'Pontuação baseada em tags de comportamento.',
        tagRules: [
          { tag: '#open', score: 5 },
          { tag: '#read', score: 10 },
          { tag: '#cta', score: 30 },
          { tag: '#decisor', score: 20 }
        ]
      }
    };
window.Config = Config;
