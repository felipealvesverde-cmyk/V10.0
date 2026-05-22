// V32.4.0 (Geraldo Item 6) — Refator pra remover feature V11 "Banco de Dados".
//
// Antes (V11): este service controlava providers externos (Local folder /
// Supabase / Amazon / Railway) pra salvar state. Tinha ~365 linhas com
// connection testers, snapshot writers, file pickers, IndexedDB handles, etc.
//
// Depois (V32+): multi-tenant SaaS com Postgres por cliente (V31.0+) e
// self-service tenant DB (V32.1.1+). A feature de "escolher provider"
// virou obsoleta — cada tenant tem seu próprio DB plugado via control plane.
//
// O que SOBROU: utility de migration de schema de STATE JSON
// (originSector ← sector, etc.) que continua sendo crítico pra carregar
// states antigos.
//
// O nome "DatabaseService" foi mantido por compat dos callers em main.js +
// state.js que chamam applyMigrations. Renomear pra StateMigrationService
// fica como follow-up cosmético.
var DatabaseService = {
  schemaVersion: '11.2.0',

  // V32.4.0 — databaseConfig vira objeto vazio. Nenhuma feature consome
  // os campos antigos (provider/local/supabase/amazon/railway). Mantido
  // só pra storage compat com states persistidos antes da V32.4.0.
  defaultConfig() {
    return {};
  },

  normalize(config) {
    // V32.4.0 — Aceita qualquer objeto, retorna {}. Não preserva campos
    // legacy pois nada os consome. Storage do user antigo "perde" o conteúdo
    // de databaseConfig silenciosamente — sem impacto operacional.
    return {};
  },

  // V32.4.0 — Helper preservado: state inicial vazio com arrays prontos.
  // Usado por Actions.resetDemo (limpa state local).
  emptyDataState() {
    return {
      products: [],
      campaigns: [],
      actions: [],
      manualLeads: [],
      selectedProductId: null,
      selectedCampaignId: null,
      selectedActionId: null,
      activeTab: 'products'
    };
  },

  // V32.4.0 — Migration de schema do state JSON. Mantido inalterado em
  // funcionalidade: garante arrays, migra sector/funnel → origin/destination,
  // valida selectedX IDs, marca schemaVersion + lastMigrationAt.
  // Chamado em State.load (state.js) e App._loadStateWithRemoteFallback (main.js).
  applyMigrations(state) {
    const working = { ...(state || {}) };
    working.products = Array.isArray(working.products) ? working.products : [];
    working.campaigns = Array.isArray(working.campaigns) ? working.campaigns : [];
    working.actions = Array.isArray(working.actions) ? working.actions : [];
    working.manualLeads = Array.isArray(working.manualLeads) ? working.manualLeads : [];
    working.cxProjects = Array.isArray(working.cxProjects) ? working.cxProjects : [];
    working.campaigns = working.campaigns.map(campaign => ({
      ...campaign,
      productId: campaign.productId || working.selectedProductId || null
    }));
    working.actions = working.actions.map(action => {
      const originSector = action.originSector || action.sector || 'Marketing';
      const originFunnel = action.originFunnel || action.funnel || 'MOF';
      const destinationSector = action.destinationSector || originSector;
      const destinationFunnel = action.destinationFunnel || originFunnel;
      return {
        ...action,
        originSector,
        originFunnel,
        destinationSector,
        destinationFunnel,
        flowPath: Array.isArray(action.flowPath) && action.flowPath.length
          ? action.flowPath
          : (window.FlowResolutionEngine ? FlowResolutionEngine.resolve(originSector, originFunnel, destinationSector, destinationFunnel) : []),
        okrs: (window.State?.normalizeOkrs) ? State.normalizeOkrs(action.okrs || []) : (action.okrs || [])
      };
    });
    if (working.selectedProductId && !working.products.some(product => Number(product.id) === Number(working.selectedProductId))) {
      working.selectedProductId = working.products[0]?.id || null;
    }
    if (working.selectedCampaignId && !working.campaigns.some(campaign => Number(campaign.id) === Number(working.selectedCampaignId))) {
      working.selectedCampaignId = working.campaigns[0]?.id || null;
    }
    if (working.selectedActionId && !working.actions.some(action => Number(action.id) === Number(working.selectedActionId))) {
      working.selectedActionId = null;
    }
    working.schemaVersion = this.schemaVersion;
    working.lastMigrationAt = new Date().toISOString();
    return working;
  }
};

if (typeof window !== 'undefined') window.DatabaseService = DatabaseService;
