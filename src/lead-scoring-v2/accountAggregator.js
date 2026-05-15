// V19 — Account Aggregator (B2B)
// Agrupa leads por domínio (companyDomain) e calcula score do account.
// Buying group: identifica quando há decisor + champion + user no mesmo account.
window.AccountAggregator = {
  group(classifiedLeads) {
    const map = new Map();
    for (const c of (classifiedLeads || [])) {
      const domain = c.lead?.companyDomain || this._extractDomain(c.lead?.email) || '__no-domain__';
      if (!map.has(domain)) map.set(domain, { domain, leads: [], roles: new Set() });
      const acc = map.get(domain);
      acc.leads.push(c);
      if (c.lead?.buyingRole) acc.roles.add(c.lead.buyingRole);
    }
    const accounts = [];
    for (const acc of map.values()) {
      if (acc.domain === '__no-domain__') {
        // Sem domínio: cada lead é um "account" isolado (B2C fallback)
        for (const c of acc.leads) accounts.push(this._singleLeadAccount(c));
        continue;
      }
      accounts.push(this._accountSummary(acc));
    }
    return accounts;
  },

  _accountSummary(acc) {
    const leads = acc.leads;
    const fitMax = Math.max(...leads.map(l => l.fit || 0), 0);
    const intentMax = Math.max(...leads.map(l => l.intent || 0), 0);
    const fitAvg = Math.round(leads.reduce((s, l) => s + (l.fit || 0), 0) / leads.length);
    const intentAvg = Math.round(leads.reduce((s, l) => s + (l.intent || 0), 0) / leads.length);
    // B2B: account fit = max (1 decisor forte já vale) ; intent = avg (atividade geral)
    const accountFit = fitMax;
    const accountIntent = intentAvg;
    const buyingGroupCompleteness = this._buyingGroupCompleteness(acc.roles);
    const buyingGroupBonus = buyingGroupCompleteness * 10; // até +10 pts se grupo completo
    const accountScore = Math.min(100, Math.round(accountFit * 0.55 + accountIntent * 0.35 + buyingGroupBonus));
    return {
      domain: acc.domain,
      leadCount: leads.length,
      roles: Array.from(acc.roles),
      buyingGroupCompleteness,
      accountFit,
      accountIntent,
      fitAvg,
      intentAvg,
      accountScore,
      leads,
      hasRevenueReady: leads.some(l => l.revenueReady)
    };
  },

  _singleLeadAccount(c) {
    return {
      domain: null,
      leadCount: 1,
      roles: c.lead?.buyingRole ? [c.lead.buyingRole] : [],
      buyingGroupCompleteness: 0,
      accountFit: c.fit,
      accountIntent: c.intent,
      fitAvg: c.fit,
      intentAvg: c.intent,
      accountScore: c.revenueScore,
      leads: [c],
      hasRevenueReady: c.revenueReady
    };
  },

  _buyingGroupCompleteness(roles) {
    // 4 papéis chave: decisor, champion, user, blocker. Completeness = 1 - blocker.
    const has = (r) => roles.has(r);
    let positive = 0;
    if (has('decisor')) positive += 1;
    if (has('champion')) positive += 1;
    if (has('user')) positive += 1;
    const blockerPenalty = has('blocker') ? 0.3 : 0;
    return Math.max(0, Math.min(1, positive / 3 - blockerPenalty));
  },

  _extractDomain(email) {
    if (!email) return '';
    const at = String(email).indexOf('@');
    return at >= 0 ? email.slice(at + 1).toLowerCase() : '';
  }
};
