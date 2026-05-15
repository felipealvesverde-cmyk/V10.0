// V19 — Negative Selection Engine
// Lista de exclusão por domínio ou account. Lead ou account na lista recebe
// cap de score 30, independente de sinais positivos.
window.NegativeSelectionEngine = {
  excludeDomain(domain) {
    if (!domain) return;
    const d = String(domain).toLowerCase().trim();
    const sel = App.state.negativeSelection || { excludedDomains: [], excludedAccounts: [] };
    const list = Array.isArray(sel.excludedDomains) ? sel.excludedDomains : [];
    if (!list.includes(d)) App.state.negativeSelection = { ...sel, excludedDomains: [...list, d] };
  },

  excludeAccount(accountKey) {
    if (!accountKey) return;
    const k = String(accountKey).toLowerCase().trim();
    const sel = App.state.negativeSelection || { excludedDomains: [], excludedAccounts: [] };
    const list = Array.isArray(sel.excludedAccounts) ? sel.excludedAccounts : [];
    if (!list.includes(k)) App.state.negativeSelection = { ...sel, excludedAccounts: [...list, k] };
  },

  isExcludedDomain(domain) {
    const list = App.state.negativeSelection?.excludedDomains || [];
    return list.includes(String(domain || '').toLowerCase().trim());
  },

  isExcludedAccount(accountKey) {
    const list = App.state.negativeSelection?.excludedAccounts || [];
    return list.includes(String(accountKey || '').toLowerCase().trim());
  },

  list() {
    return {
      domains: App.state.negativeSelection?.excludedDomains || [],
      accounts: App.state.negativeSelection?.excludedAccounts || []
    };
  },

  remove(kind, value) {
    const sel = App.state.negativeSelection || { excludedDomains: [], excludedAccounts: [] };
    const v = String(value).toLowerCase().trim();
    const key = kind === 'domain' ? 'excludedDomains' : 'excludedAccounts';
    App.state.negativeSelection = { ...sel, [key]: (sel[key] || []).filter(x => x !== v) };
  }
};
