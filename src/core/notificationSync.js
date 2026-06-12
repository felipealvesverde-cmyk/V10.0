// V37.4.1 — NotificationSync.
//
// Sincroniza estado atual do app com a tabela de notifications. Roda
// periodicamente (a cada N minutos) e emite notifications dedupadas
// pros estados problemáticos detectados em App.state.
//
// Casos cobertos:
//   1. ClickUp desconectado    → critical/integration
//   2. RD webhook falhas       → warning/integration (≥1) ou critical (≥10)
//   3. Reconciliation pendente → warning/integration (RD↔LJ divergente)
//
// LJEmitDedup garante que não vira spam (24h de dedup por kind+entity).

window.NotificationSync = {
  _lastRun: null,
  _runIntervalMs: 5 * 60 * 1000, // 5 min

  shouldRun() {
    if (!window.LJEmitDedup) return false;
    if (!localStorage.getItem('lj_jwt')) return false;
    if (this._lastRun && (Date.now() - this._lastRun) < this._runIntervalMs) return false;
    return true;
  },

  async run() {
    if (!this.shouldRun()) return;
    this._lastRun = Date.now();
    try {
      await this._checkClickup();
      await this._checkRdWebhooks();
      await this._checkReconciliation();
    } catch (err) {
      console.warn('[NotificationSync] erro:', err.message);
    }
  },

  async _checkClickup() {
    const status = App.state.clickupStatus;
    if (!status) return;
    if (!status.connected) {
      // ClickUp desconectado — crítico
      await window.LJEmitDedup({
        audience: 'tenant_wide',
        kind: 'integration.clickup_disconnected',
        category: 'integration',
        severity: 'critical',
        title: 'ClickUp desconectado',
        body: 'Sync de tarefas está pausado. Reconecte em Configurações → Integrações.',
        entityKind: 'integration',
        entityId: 'clickup'
      });
    }
  },

  async _checkRdWebhooks() {
    const summary = App.state.rdWebhookFailuresSummary;
    if (!summary || !summary.count) return;
    const severity = summary.count >= 10 ? 'critical' : 'warning';
    await window.LJEmitDedup({
      audience: { role: 'owner' },
      kind: 'integration.rd_webhook_failures',
      category: 'integration',
      severity,
      title: `RD webhook com ${summary.count} falha${summary.count === 1 ? '' : 's'}`,
      body: 'Há eventos do RD que não foram processados. Veja em Configurações → RD.',
      data: { count: summary.count, breakdown: summary.breakdown },
      entityKind: 'integration',
      entityId: 'rd_webhook_failures'
    });
  },

  async _checkReconciliation() {
    const counts = App.state.reconciliationCounts;
    if (!counts || !counts.totalUnread) return;
    await window.LJEmitDedup({
      audience: { role: 'owner' },
      kind: 'operational.reconciliation_pending',
      category: 'operational',
      severity: 'warning',
      title: `${counts.totalUnread} divergência${counts.totalUnread === 1 ? '' : 's'} RD ↔ LJ`,
      body: 'Stage ou deal divergente entre RD e LJ. Reveja e resolva.',
      data: counts,
      entityKind: 'reconciliation',
      entityId: 'pending'
    });
  }
};

// Auto-tick a cada 60s pra detectar mudanças (LJEmitDedup garante que não duplica).
setInterval(() => {
  if (window.NotificationSync && window.NotificationSync.shouldRun()) {
    window.NotificationSync.run();
  }
}, 60 * 1000);

// Primeiro run após carregar a app
setTimeout(() => {
  if (window.NotificationSync) window.NotificationSync.run();
}, 5000);
