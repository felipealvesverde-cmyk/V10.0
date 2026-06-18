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
    return this._runChecks();
  },

  // V37.4.17 — Bypassa cooldown. Use pra forçar populate manual via console.
  async forceRun() {
    this._lastRun = Date.now();
    return this._runChecks();
  },

  async _runChecks() {
    this._lastRun = Date.now();
    try {
      await this._checkClickup();
      await this._checkRdWebhooks();
      await this._checkReconciliation();
      await this._checkLeadImportReports();
      await this._checkReleases();
      await this._checkAdsOrphans();
      await this._checkGa4Alerts();
      await this._checkMonthlyClosingPending();
    } catch (err) {
      console.warn('[NotificationSync] erro:', err.message);
    }
  },

  async _checkClickup() {
    const status = App.state.clickupStatus;
    if (!status) return;
    // V40.5.1 — Gate contra race: NÃO emite alerta se loadClickupStatus ainda
    // não respondeu pelo menos uma vez. O initial() do State traz
    // { connected: false } como default — sem este gate, F5 com rede lenta
    // disparava "ClickUp desconectado" antes da resposta real chegar.
    // Sintoma do Sansone V40.5.0: alerta no sininho com Settings dizendo conectado.
    if (!App.state._clickupStatusLoaded) return;
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
      data: { action: 'open_recon', counts },
      entityKind: 'reconciliation',
      entityId: 'pending'
    });
  },

  // V37.4.9 — Lead import reports não vistos
  async _checkLeadImportReports() {
    const count = Number(App.state.pendingLeadImportReports || 0);
    if (!count) return;
    await window.LJEmitDedup({
      audience: { role: 'owner' },
      kind: 'operational.lead_import_reports',
      category: 'operational',
      severity: 'info',
      title: `${count} relatório${count === 1 ? '' : 's'} de import de leads`,
      body: 'Há relatórios de import recente sem revisão.',
      data: { action: 'open_import_reports', count },
      entityKind: 'lead_imports',
      entityId: 'pending'
    });
  },

  // V37.4.9 — Releases (changelog) não vistas pelo user
  // V37.4.16 — Cria 1 notification por release (cap em 5 últimas) + marca
  // lastSeenVersion como a mais recente pra não acumular.
  async _checkReleases() {
    const unseen = (window.Actions?._getUnseenReleases?.() || []);
    if (!unseen.length) return;
    const cap = 5;
    const slice = unseen.slice(0, cap);
    for (const release of slice) {
      await window.LJEmitDedup({
        audience: { role: 'owner' },
        kind: 'event.lj_release',
        category: 'event',
        severity: 'info',
        title: `LeadJourney ${release.version}`,
        body: release.title || 'Nova versão.',
        data: { action: 'open_releases', version: release.version },
        entityKind: 'release',
        entityId: release.version
      });
    }
    // Marca a mais recente como vista — releases mais antigas já viraram
    // notification individual, não precisam continuar somando no badge.
    if (unseen[0]?.version) {
      App.state.lastSeenVersion = unseen[0].version;
      if (window.App?.save) App.save();
    }
  },

  // V37.4.9 — Ads órfãs (Google Ads não vinculadas a Campanha LJ)
  async _checkAdsOrphans() {
    const count = Number(window.Actions?.getAdsOrphanBellCount?.() || 0);
    if (!count) return;
    await window.LJEmitDedup({
      audience: { role: 'owner' },
      kind: 'operational.ads_orphans',
      category: 'operational',
      severity: 'warning',
      title: `${count} campanha${count === 1 ? '' : 's'} Ads sem vínculo LJ`,
      body: 'Vincule pra que apareçam no RevOps e no Mapa.',
      data: { action: 'open_ads_orphans', count },
      entityKind: 'ads_orphans',
      entityId: 'pending'
    });
  },

  // V37.4.9 — GA4 alertas (sync falhou, customs novos, etc)
  async _checkGa4Alerts() {
    const count = Number(window.Actions?.getGa4AlertCount?.() || 0);
    if (!count) return;
    await window.LJEmitDedup({
      audience: { role: 'owner' },
      kind: 'integration.ga4_alerts',
      category: 'integration',
      severity: 'warning',
      title: `${count} alerta${count === 1 ? '' : 's'} GA4`,
      body: 'Configure ou reveja a integração com GA4.',
      data: { action: 'open_ga4', count },
      entityKind: 'ga4',
      entityId: 'alerts'
    });
  },

  // V37.4.9 — Fechamento mensal pendente
  async _checkMonthlyClosingPending() {
    const count = Number(window.Actions?.getMonthlyClosingPendingCount?.() || 0);
    if (!count) return;
    await window.LJEmitDedup({
      audience: { role: 'owner' },
      kind: 'operational.monthly_closing_pending',
      category: 'operational',
      severity: 'warning',
      title: `${count} fechamento${count === 1 ? '' : 's'} mensal pendente${count === 1 ? '' : 's'}`,
      body: 'Snapshot consolidado aguardando finalização.',
      data: { action: 'open_monthly_closing', count },
      entityKind: 'monthly_closing',
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
