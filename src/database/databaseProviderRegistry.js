// V16.4 — Database Provider Registry
// Catálogo unificado de providers de banco do LeadJourney. Reflete a lista que
// DatabaseService já mantém, mas expõe metadata extra (engine, descrição) e
// facilita adicionar novos providers no futuro sem mexer no service.
window.DatabaseProviderRegistry = {
  PROVIDERS: [
    { id: 'local',    label: 'Local',    icon: 'hard-drive', engines: ['json'],                   description: 'Banco local no seu computador. Começa imediato e fica offline.' },
    { id: 'supabase', label: 'Supabase', icon: 'database',   engines: ['postgres'],               description: 'Postgres gerenciado com API REST pronta para produção inicial.' },
    { id: 'amazon',   label: 'Amazon',   icon: 'cloud',      engines: ['postgres','mysql','dynamodb','aurora'], description: 'RDS, Aurora ou DynamoDB. Preparado para escalar via backend/proxy.' },
    { id: 'railway',  label: 'Railway',  icon: 'train',      engines: ['postgres','mysql'],       description: 'Postgres ou MySQL hospedado no Railway. Conexão guiada por DATABASE_URL ou campos separados.' }
  ],

  list() { return this.PROVIDERS.slice(); },
  byId(id) { return this.PROVIDERS.find(p => p.id === id) || null; },
  enginesFor(id) { return (this.byId(id)?.engines) || []; }
};
