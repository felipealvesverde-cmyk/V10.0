// V40.7.19 — Mocks dos endpoints de sistema do tenant demo@leadjourney.app.
//
// Esses 9 endpoints dependem de tabelas que não existem no demo (notifications,
// pins, lj_reconciliation_alerts, lj_hotmart_purchases, lj_governance_closings,
// lj_visitors com colunas RD, lj_merges, lj_google_ads_config). Sem branch demo,
// retornam 500 e poluem o console + quebram Health card.
//
// Filosofia: a maioria retorna "estado vazio mas válido" (sininho zero, sem
// pins, sem alerts RD, sem fechamentos). Eficiência retorna dados ricos pq
// alimenta o card A4 da RevOps & Velocidade.
//
// Backlog: refator quando provider abstraction acontecer. Ver [[backlog-provider-abstraction]].

const PRODUCTS = [
  { ljId: 1781869701831, name: 'Cerveja Pilsen 600ml',  priceBRL: 22, monthlyApproved: 9600, customers: 1920 },
  { ljId: 5001,          name: 'Cerveja Weiss 500ml',   priceBRL: 28, monthlyApproved: 3600, customers: 720  },
  { ljId: 5002,          name: 'Chopp de Vinho 250ml',  priceBRL: 72, monthlyApproved: 440,  customers: 88   }
];

const NOW_ISO = '2026-06-19T00:00:00Z';

// ============================================================
// Sininho / Notifications
// ============================================================

function buildNotificationsList() {
  return {
    ok: true,
    items: [],
    counts: { inbox: 0, saved: 0, archive: 0, snoozed: 0 }
  };
}

function buildNotificationsDailySummary(query = {}) {
  const since = query.since ? new Date(query.since).toISOString() : new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  return {
    ok: true,
    since,
    overall: { total: 0, critical: 0, warning: 0, info: 0 },
    byCategory: [],
    topKinds: [],
    highlights: []
  };
}

function buildNotificationPreferences() {
  return {
    ok: true,
    preferences: {
      handoff:     { inApp: true,  email: true  },
      event:       { inApp: true,  email: false },
      state:       { inApp: true,  email: false },
      operational: { inApp: true,  email: false },
      integration: { inApp: true,  email: true  },
      health:      { inApp: true,  email: true  }
    },
    weeklyDigest: false,
    lastDigestSentAt: null
  };
}

// ============================================================
// Pins (collaboration overlay)
// ============================================================

function buildPinsList() {
  return { ok: true, pins: [] };
}

// ============================================================
// Reconciliation alerts (RD ↔ LJ)
// ============================================================

function buildReconciliationAlerts(query = {}) {
  const includeLists = String(query.include || '').toLowerCase() === 'lists';
  const counts = {
    conflictsUnread: 0,
    conflictsTotal: 0,
    pendingStage: 0,
    pendingDeal: 0,
    totalUnread: 0
  };
  if (!includeLists) return { ok: true, counts };
  return {
    ok: true,
    counts,
    alerts: [],
    stagePending: [],
    dealPending: []
  };
}

// ============================================================
// Efficiency summary (RevOps & Velocidade — card A4 Eficiência de Capital)
// ============================================================

function buildEfficiencySummary() {
  const today = NOW_ISO.slice(0, 10);
  const thirtyDaysAgo = new Date(new Date(NOW_ISO).getTime() - 30 * 86400000).toISOString().slice(0, 10);
  const ninetyDaysAgo = new Date(new Date(NOW_ISO).getTime() - 90 * 86400000).toISOString().slice(0, 10);

  // Por produto: customers, LTV, refunds/cancels coerentes com Velocity mock
  // - Pilsen: 1920 PDVs × R$ 22 × ~3 pedidos LTV médio = R$ 66
  // - Weiss: 720 × R$ 28 × ~3 = R$ 84
  // - Chopp: 88 × R$ 72 × ~2 = R$ 144 (LTV maior por ticket, mas base baixa)
  const byProduct = PRODUCTS.map(p => {
    const ltvUnits = p.ljId === 5002 ? 2 : 3; // Chopp tem menos recorrência
    const ltv = p.priceBRL * ltvUnits;
    const totalRevenue = p.monthlyApproved * p.priceBRL;
    // Chopp tem refund/cancel ligeiramente maior (sinal de problema no funil premium)
    const refundRate = p.ljId === 5002 ? 0.04 : 0.018;
    const cancelRate = p.ljId === 5002 ? 0.07 : 0.034;
    return {
      product_id_lj: p.ljId,
      customers_count: p.customers,
      ltv,
      total_revenue: totalRevenue,
      has_subscriptions: false,
      active_30d: Math.round(p.customers * 0.92),
      refunds_90d: Math.round(p.monthlyApproved * 3 * refundRate),
      cancellations_90d: Math.round(p.monthlyApproved * 3 * cancelRate),
      refunds_30d: Math.round(p.monthlyApproved * refundRate),
      cancellations_30d: Math.round(p.monthlyApproved * cancelRate)
    };
  });

  return {
    ok: true,
    window: { ninetyDaysAgo, thirtyDaysAgo, today },
    benchmarks: {
      ltv_cac_healthy: 3.0,
      payback_healthy_months: 12,
      nrr_healthy: 1.0,
      nrr_excellent: 1.10
    },
    byProduct,
    __demoMock: true
  };
}

// ============================================================
// Governance closings (snapshots mensais — empty by design)
// ============================================================

function buildGovernanceClosings() {
  return { ok: true, closings: [] };
}

// ============================================================
// Visitors pending counts (identity resolution badge)
// ============================================================

function buildVisitorsPendingCounts() {
  return {
    ok: true,
    duplicateGroupsEmail: 0,
    duplicateGroupsPhone: 0,
    duplicateGroupsTotal: 0,
    recentMerges24h: 0,
    lastMergeAt: null,
    enrichablePending: 0,
    rdContactSyncPending: 0,
    enrichedLast24h: 0,
    totalPending: 0
  };
}

// ============================================================
// Google Ads config (não conectado no demo)
// ============================================================

function buildGoogleAdsConfig() {
  return { ok: true, configured: false };
}

module.exports = {
  buildNotificationsList,
  buildNotificationsDailySummary,
  buildNotificationPreferences,
  buildPinsList,
  buildReconciliationAlerts,
  buildEfficiencySummary,
  buildGovernanceClosings,
  buildVisitorsPendingCounts,
  buildGoogleAdsConfig
};
