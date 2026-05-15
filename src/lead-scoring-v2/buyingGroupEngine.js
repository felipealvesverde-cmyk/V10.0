// V19 — Buying Group Engine
// B2B real: decisão é coletiva (6-10 stakeholders). Identifica papéis no
// account e detecta grupo completo vs single-thread (risco).
window.BuyingGroupEngine = {
  ROLES: ['decisor', 'champion', 'user', 'blocker', 'influencer'],

  ROLE_META: {
    decisor:    { label: 'Decisor',    weight: 35, dot: 'bg-emerald-500' },
    champion:   { label: 'Champion',   weight: 30, dot: 'bg-sky-500' },
    user:       { label: 'User',       weight: 15, dot: 'bg-indigo-500' },
    influencer: { label: 'Influencer', weight: 10, dot: 'bg-amber-500' },
    blocker:    { label: 'Blocker',    weight: -25, dot: 'bg-red-500' }
  },

  assess(account) {
    const roles = new Set(account?.roles || []);
    let score = 0;
    for (const r of roles) score += (this.ROLE_META[r]?.weight || 0);
    const hasChampion = roles.has('champion');
    const hasDecisor = roles.has('decisor');
    const isSingleThread = account?.leadCount === 1;
    const completeness = Math.max(0, Math.min(100, score));
    return {
      completeness,
      hasChampion,
      hasDecisor,
      isSingleThread,
      risk: isSingleThread ? 'high' : (!hasDecisor ? 'medium' : 'low'),
      missingRoles: this.ROLES.filter(r => !roles.has(r) && r !== 'blocker' && r !== 'influencer')
    };
  }
};
