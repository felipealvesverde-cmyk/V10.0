// V40.2.0 — Catálogo canônico de integrações/APIs do LJ no frontend.
// Espelho de lib/integrations-catalog.js. Pra adicionar nova integração:
// adiciona aqui + replica no backend.
window.LJIntegrationsCatalog = [
  {
    id: 'rd-station',
    name: 'RD Station',
    description: 'Sincroniza leads, deals e ações entre LJ e RD Station CRM/Marketing.',
    type: 'external',
    icon: 'rss',
    color: '#15B8E5',
    status: 'ga',
    defaultEnabled: true
  },
  {
    id: 'clickup',
    name: 'ClickUp',
    description: 'Espelha execuções no ClickUp como tarefas reais com responsáveis e datas.',
    type: 'external',
    icon: 'check-square',
    color: '#7B68EE',
    status: 'ga',
    defaultEnabled: true
  },
  {
    id: 'lj-public-leads-api',
    name: 'LJ Public Leads API',
    description: 'Endpoint público pra ingerir leads no LJ a partir de sistemas externos do cliente.',
    type: 'public-api',
    icon: 'webhook',
    color: '#10B981',
    status: 'ready',
    defaultEnabled: false
  }
];
