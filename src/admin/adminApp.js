// V40.0.0 — Cockpit Operacional do LJ (/admin).
// App SEPARADO do LJ-cliente. Tem state, render, actions próprios.
// Auth: reusa JWT em localStorage('lj_jwt'). Boot verifica isLjOperator
// e bloqueia entrada caso contrário.
window.AdminApp = {
  state: {
    currentUser: null,
    activeScreen: 'tenants',     // 'tenants' | 'users' | 'plugins' | 'integrations' | 'billing' | 'snapshots'
    tenants: [],
    tenantsLoading: false,
    selectedTenantId: null,
    showCreateTenantModal: false,
    createTenantDraft: { slug: '', name: '', masterEmail: '', teamEmails: '' },
    showCreateUserModal: false,
    createUserDraft: { tenantId: null, email: '', role: 'user', displayName: '' },
    snapshots: [],
    snapshotsLoading: false,
    selectedSnapshotTenantId: null,
    // V40.1.0 — Gating de plugins por tenant
    pluginsTenantId: null,
    pluginsList: [],
    pluginsLoading: false,
    // V40.2.0 — Cobrança manual
    billingTenantId: null,
    billingEntries: [],
    billingTotals: { total_pending: 0, total_paid: 0, hours_total: 0 },
    billingLoading: false,
    showBillingAddModal: false,
    billingAddDraft: { hours: '', rate: '', performedAt: '', note: '' },
    // V40.2.0 — Gating de integrações por tenant
    integrationsTenantId: null,
    integrationsList: [],
    integrationsLoading: false,
    // V40.3.0 — Usuários por tenant + gating de IA
    usersTenantId: null,
    usersList: [],
    usersLoading: false,
    toast: null,
    plugDbDraft: { tenantId: null, connString: '' }
  },

  toast(msg, kind = 'info') {
    this.state.toast = { msg: String(msg), kind, ts: Date.now() };
    this.render();
    setTimeout(() => {
      if (this.state.toast && (Date.now() - this.state.toast.ts) >= 3000) {
        this.state.toast = null;
        this.render();
      }
    }, 3200);
  },

  async fetch(path, options = {}) {
    const token = localStorage.getItem('lj_jwt');
    if (!token) {
      window.location.href = '/admin?logout=1';
      return null;
    }
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers || {}) };
    const res = await fetch(path, { ...options, headers });
    if (res.status === 401) {
      localStorage.removeItem('lj_jwt');
      window.location.href = '/admin';
      return null;
    }
    let data = null;
    try { data = await res.json(); } catch (_) { /* sem body */ }
    return { ok: res.ok, status: res.status, data };
  },

  // ===== ACTIONS =====
  async loadCurrentUser() {
    const r = await this.fetch('/api/auth-me');
    if (!r || !r.ok || !r.data?.authenticated) return null;
    this.state.currentUser = r.data.user;
    return r.data.user;
  },

  async loadTenants() {
    this.state.tenantsLoading = true; this.render();
    const r = await this.fetch('/api/tenants-list');
    this.state.tenantsLoading = false;
    if (r?.ok) this.state.tenants = r.data.tenants || [];
    this.render();
  },

  setScreen(screen) {
    this.state.activeScreen = screen;
    if (screen === 'snapshots') this.loadSnapshots();
    if (screen === 'plugins') this.loadPluginsList();
    if (screen === 'billing') this.loadBilling();
    if (screen === 'integrations') this.loadIntegrationsList();
    if (screen === 'users') this.loadTenantUsers();
    this.render();
  },

  // ===== USUÁRIOS POR TENANT + GATING DE IA =====
  async loadTenantUsers() {
    if (!this.state.usersTenantId) return;
    this.state.usersLoading = true; this.render();
    const r = await this.fetch(`/api/admin-tenant-users?tenantId=${this.state.usersTenantId}`);
    this.state.usersLoading = false;
    if (r?.ok) this.state.usersList = r.data.users || [];
    this.render();
  },
  setUsersTenant(tenantId) {
    this.state.usersTenantId = Number(tenantId) || null;
    this.loadTenantUsers();
  },
  async toggleUserAi(userId, currentlyEnabled) {
    const r = await this.fetch('/api/users-toggle-master-ai', {
      method: 'POST',
      body: JSON.stringify({ userId: Number(userId), enabled: !currentlyEnabled })
    });
    if (r?.ok) {
      this.toast(`✓ IA ${!currentlyEnabled ? 'liberada' : 'cortada'} pro usuário.`, 'success');
      this.loadTenantUsers();
    } else {
      this.toast(r?.data?.message || 'Erro ao alterar IA.', 'error');
    }
  },

  // ===== COBRANÇA MANUAL =====
  async loadBilling() {
    if (!this.state.billingTenantId) return;
    this.state.billingLoading = true; this.render();
    const r = await this.fetch(`/api/admin-tenant-billing?tenantId=${this.state.billingTenantId}`);
    this.state.billingLoading = false;
    if (r?.ok) {
      this.state.billingEntries = r.data.entries || [];
      this.state.billingTotals = r.data.totals || { total_pending: 0, total_paid: 0, hours_total: 0 };
    }
    this.render();
  },
  setBillingTenant(tenantId) {
    this.state.billingTenantId = Number(tenantId) || null;
    this.loadBilling();
  },
  openBillingAdd() {
    this.state.showBillingAddModal = true;
    this.state.billingAddDraft = { hours: '', rate: '', performedAt: new Date().toISOString().slice(0, 10), note: '' };
    this.render();
  },
  closeBillingAdd() { this.state.showBillingAddModal = false; this.render(); },
  updateBillingAddField(field, value) { this.state.billingAddDraft[field] = String(value || ''); },
  async submitBillingAdd() {
    const d = this.state.billingAddDraft;
    if (!this.state.billingTenantId) return this.toast('Tenant não selecionado.', 'error');
    if (!d.hours || !d.rate) return this.toast('Horas e valor/hora obrigatórios.', 'error');
    const r = await this.fetch('/api/admin-tenant-billing-add', {
      method: 'POST',
      body: JSON.stringify({
        tenantId: this.state.billingTenantId,
        hours: Number(d.hours),
        rate: Number(d.rate),
        performedAt: d.performedAt || null,
        note: d.note || null
      })
    });
    if (r?.ok) {
      this.toast(`✓ Cobrança registrada.`, 'success');
      this.state.showBillingAddModal = false;
      this.loadBilling();
    } else {
      this.toast(r?.data?.message || 'Erro ao registrar.', 'error');
    }
  },
  async markBillingPaid(entryId, currentlyPaid) {
    const r = await this.fetch('/api/admin-tenant-billing-mark-paid', {
      method: 'POST',
      body: JSON.stringify({ entryId: Number(entryId), paid: !currentlyPaid })
    });
    if (r?.ok) {
      this.toast(`✓ ${!currentlyPaid ? 'Marcada como paga' : 'Voltou pra pendente'}.`, 'success');
      this.loadBilling();
    } else {
      this.toast(r?.data?.message || 'Erro.', 'error');
    }
  },
  async deleteBillingEntry(entryId) {
    if (!confirm('Apagar essa entry de cobrança?')) return;
    const r = await this.fetch('/api/admin-tenant-billing-delete', {
      method: 'POST',
      body: JSON.stringify({ entryId: Number(entryId) })
    });
    if (r?.ok) {
      this.toast('Apagada.', 'success');
      this.loadBilling();
    } else {
      this.toast(r?.data?.message || 'Erro.', 'error');
    }
  },

  // ===== INTEGRAÇÕES (gating por tenant) =====
  async loadIntegrationsList() {
    if (!this.state.integrationsTenantId) return;
    this.state.integrationsLoading = true; this.render();
    const r = await this.fetch(`/api/admin-tenant-integrations?tenantId=${this.state.integrationsTenantId}`);
    this.state.integrationsLoading = false;
    if (r?.ok) this.state.integrationsList = r.data.integrations || [];
    this.render();
  },
  setIntegrationsTenant(tenantId) {
    this.state.integrationsTenantId = Number(tenantId) || null;
    this.loadIntegrationsList();
  },
  async toggleIntegration(integrationId, currentlyEnabled) {
    if (!this.state.integrationsTenantId) return;
    const r = await this.fetch('/api/admin-tenant-integration-toggle', {
      method: 'POST',
      body: JSON.stringify({
        tenantId: this.state.integrationsTenantId,
        integrationId,
        enabled: !currentlyEnabled
      })
    });
    if (r?.ok) {
      this.toast(`✓ Integração ${!currentlyEnabled ? 'liberada' : 'desativada'}.`, 'success');
      this.loadIntegrationsList();
    } else {
      this.toast(r?.data?.message || 'Erro ao toggle integração.', 'error');
    }
  },

  // ===== PLUGINS (gating por tenant) =====
  async loadPluginsList() {
    if (!this.state.pluginsTenantId) return;
    this.state.pluginsLoading = true; this.render();
    const r = await this.fetch(`/api/admin-tenant-plugins?tenantId=${this.state.pluginsTenantId}`);
    this.state.pluginsLoading = false;
    if (r?.ok) this.state.pluginsList = r.data.plugins || [];
    this.render();
  },
  setPluginsTenant(tenantId) {
    this.state.pluginsTenantId = Number(tenantId) || null;
    this.loadPluginsList();
  },
  async togglePlugin(pluginId, currentlyEnabled) {
    if (!this.state.pluginsTenantId) return;
    const r = await this.fetch('/api/admin-tenant-plugin-toggle', {
      method: 'POST',
      body: JSON.stringify({
        tenantId: this.state.pluginsTenantId,
        pluginId,
        enabled: !currentlyEnabled
      })
    });
    if (r?.ok) {
      this.toast(`✓ Plugin ${!currentlyEnabled ? 'liberado' : 'desativado'}.`, 'success');
      this.loadPluginsList();
    } else {
      this.toast(r?.data?.message || 'Erro ao toggle plugin.', 'error');
    }
  },

  openCreateTenantModal() {
    this.state.showCreateTenantModal = true;
    this.state.createTenantDraft = { slug: '', name: '', masterEmail: '', teamEmails: '' };
    this.render();
  },
  closeCreateTenantModal() { this.state.showCreateTenantModal = false; this.render(); },
  updateCreateTenantField(field, value) {
    this.state.createTenantDraft[field] = String(value || '');
  },
  async submitCreateTenant() {
    const d = this.state.createTenantDraft;
    if (!d.slug || !d.name || !d.masterEmail) {
      return this.toast('Slug, nome e email do master são obrigatórios.', 'error');
    }
    const teamEmails = String(d.teamEmails || '').split(/[\s,;]+/).filter(Boolean);
    const r = await this.fetch('/api/tenant-create', {
      method: 'POST',
      body: JSON.stringify({ slug: d.slug, name: d.name, masterEmail: d.masterEmail, teamEmails })
    });
    if (r?.ok) {
      this.toast(`✓ Tenant "${d.name}" criado. Senhas geradas — veja no console.`, 'success');
      console.log('[admin] credenciais criadas:', r.data.credentials);
      this.state.showCreateTenantModal = false;
      await this.loadTenants();
    } else {
      this.toast(r?.data?.message || 'Erro ao criar tenant.', 'error');
    }
  },

  openCreateUserModal(tenantId) {
    this.state.showCreateUserModal = true;
    this.state.createUserDraft = { tenantId: Number(tenantId), email: '', role: 'user', displayName: '' };
    this.render();
  },
  closeCreateUserModal() { this.state.showCreateUserModal = false; this.render(); },
  updateCreateUserField(field, value) { this.state.createUserDraft[field] = String(value || ''); },
  async submitCreateUser() {
    const d = this.state.createUserDraft;
    if (!d.tenantId || !d.email) return this.toast('Tenant e email obrigatórios.', 'error');
    const r = await this.fetch('/api/admin-create-tenant-user', {
      method: 'POST',
      body: JSON.stringify(d)
    });
    if (r?.ok) {
      this.toast(`✓ Usuário ${r.data.user.email} criado. Senha inicial: ${r.data.initialPassword}`, 'success');
      console.log('[admin] usuário criado:', r.data);
      this.state.showCreateUserModal = false;
      this.render();
    } else {
      this.toast(r?.data?.message || 'Erro ao criar usuário.', 'error');
    }
  },

  openPlugDb(tenantId) {
    this.state.plugDbDraft = { tenantId: Number(tenantId), connString: '' };
    this.render();
  },
  closePlugDb() { this.state.plugDbDraft = { tenantId: null, connString: '' }; this.render(); },
  updatePlugDbConnString(value) { this.state.plugDbDraft.connString = String(value || ''); },
  async submitPlugDb() {
    const d = this.state.plugDbDraft;
    if (!d.tenantId || !d.connString) return this.toast('Connection string obrigatória.', 'error');
    const r = await this.fetch('/api/tenants-plug-db', {
      method: 'POST',
      body: JSON.stringify({ tenantId: d.tenantId, connString: d.connString })
    });
    if (r?.ok) {
      this.toast('✓ DB plugado.', 'success');
      this.closePlugDb();
      await this.loadTenants();
    } else {
      this.toast(r?.data?.message || 'Erro ao plugar DB.', 'error');
    }
  },
  async unplugDb(tenantId) {
    if (!confirm('Desplugar o DB deste tenant? Os dados não somem, mas o tenant volta a usar o control plane.')) return;
    const r = await this.fetch('/api/tenants-unplug-db', {
      method: 'POST',
      body: JSON.stringify({ tenantId: Number(tenantId) })
    });
    if (r?.ok) {
      this.toast('DB desplugado.', 'success');
      await this.loadTenants();
    } else {
      this.toast(r?.data?.message || 'Erro.', 'error');
    }
  },

  async impersonate(tenantId) {
    const r = await this.fetch('/api/admin-impersonate-token', {
      method: 'POST',
      body: JSON.stringify({ tenantId: Number(tenantId) })
    });
    if (r?.ok) {
      const url = `/?impersonateToken=${encodeURIComponent(r.data.token)}`;
      window.open(url, '_blank');
      this.toast(`Aberto em nova aba como ${r.data.target.email}.`, 'success');
    } else {
      this.toast(r?.data?.message || 'Erro ao impersonar.', 'error');
    }
  },

  async loadSnapshots() {
    if (!this.state.selectedSnapshotTenantId) return;
    this.state.snapshotsLoading = true; this.render();
    const r = await this.fetch(`/api/admin-tenant-snapshots?tenantId=${this.state.selectedSnapshotTenantId}`);
    this.state.snapshotsLoading = false;
    if (r?.ok) this.state.snapshots = r.data.snapshots || [];
    this.render();
  },
  setSelectedSnapshotTenant(tenantId) {
    this.state.selectedSnapshotTenantId = Number(tenantId) || null;
    this.loadSnapshots();
  },
  async takeSnapshot() {
    const r = await this.fetch('/api/admin-deploy-snapshot', { method: 'POST', body: JSON.stringify({}) });
    if (r?.ok) {
      this.toast('✓ Snapshot tirado.', 'success');
      this.loadSnapshots();
    } else {
      this.toast(r?.data?.message || 'Erro ao tirar snapshot.', 'error');
    }
  },
  async restoreSnapshot(tenantId, snapshotId) {
    if (!confirm(`Restaurar snapshot ${snapshotId} pro tenant ${tenantId}? Estado atual será sobrescrito.`)) return;
    const r = await this.fetch('/api/admin-restore-tenant-snapshot', {
      method: 'POST',
      body: JSON.stringify({ tenantId: Number(tenantId), snapshotId })
    });
    if (r?.ok) {
      this.toast('✓ Snapshot restaurado.', 'success');
    } else {
      this.toast(r?.data?.message || 'Erro ao restaurar.', 'error');
    }
  },

  logout() {
    localStorage.removeItem('lj_jwt');
    window.location.href = '/admin';
  },

  // ===== RENDER =====
  render() {
    const root = document.getElementById('adminRoot');
    if (!root) return;
    if (!this.state.currentUser) {
      root.innerHTML = this._loginScreen();
    } else {
      root.innerHTML = this._shell();
    }
    if (window.lucide?.createIcons) try { window.lucide.createIcons(); } catch (_) {}
  },

  _escape(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  _loginScreen() {
    return `<div class="min-h-screen grid place-items-center p-6">
      <div class="admin-card p-8 w-full max-w-md">
        <div class="flex items-center gap-3 mb-2">
          <img src="/public/lj-logo.png" alt="LJ" class="w-10 h-10 rounded-lg" />
          <div>
            <p class="text-[10px] font-black text-indigo-300 uppercase tracking-wider">Cockpit Operacional</p>
            <h1 class="text-xl font-black">LJ Admin</h1>
          </div>
        </div>
        <p class="text-xs text-slate-400 mb-5">Acesso restrito ao operador do LJ-business.</p>
        <label class="text-[11px] font-black text-slate-400 uppercase tracking-wider">Email</label>
        <input id="adminLoginEmail" type="email" class="w-full mt-1 px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white font-semibold text-sm" placeholder="seu@email.com" />
        <label class="text-[11px] font-black text-slate-400 uppercase tracking-wider mt-3 block">Senha</label>
        <input id="adminLoginPassword" type="password" class="w-full mt-1 px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white font-semibold text-sm" onkeydown="if(event.key==='Enter')AdminApp.tryLogin()" />
        <button onclick="AdminApp.tryLogin()" class="admin-btn-primary w-full mt-5 px-4 py-3 rounded-xl text-sm">Entrar no cockpit</button>
        <p id="adminLoginError" class="text-xs text-red-300 mt-3 text-center hidden"></p>
      </div>
    </div>`;
  },

  async tryLogin() {
    const email = document.getElementById('adminLoginEmail')?.value || '';
    const password = document.getElementById('adminLoginPassword')?.value || '';
    const errEl = document.getElementById('adminLoginError');
    if (!email || !password) {
      if (errEl) { errEl.textContent = 'Preencha email e senha.'; errEl.classList.remove('hidden'); }
      return;
    }
    const res = await fetch('/api/auth-login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: email, password })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      if (errEl) { errEl.textContent = data.message || 'Falha no login.'; errEl.classList.remove('hidden'); }
      return;
    }
    if (!data.user?.isLjOperator) {
      if (errEl) { errEl.textContent = 'Esta conta não tem acesso ao cockpit.'; errEl.classList.remove('hidden'); }
      return;
    }
    localStorage.setItem('lj_jwt', data.token);
    this.state.currentUser = data.user;
    await this.loadTenants();
    this.render();
  },

  _shell() {
    return `<div class="admin-shell flex">
      <aside class="admin-sidebar w-60 p-4 flex flex-col gap-1">
        <div class="flex items-center gap-2 mb-5 px-1">
          <img src="/public/lj-logo.png" alt="LJ" class="w-8 h-8 rounded" />
          <div>
            <p class="text-[9px] font-black text-indigo-300 uppercase tracking-wider">Cockpit</p>
            <p class="text-sm font-black">LJ Admin</p>
          </div>
        </div>
        ${this._navBtn('tenants', 'Tenants', 'building-2')}
        ${this._navBtn('users', 'Usuários', 'users')}
        ${this._navBtn('plugins', 'Plugins', 'puzzle')}
        ${this._navBtn('integrations', 'Integrações', 'link')}
        ${this._navBtn('billing', 'Cobrança', 'banknote')}
        ${this._navBtn('snapshots', 'Snapshots', 'database-backup')}
        <div class="flex-1"></div>
        <div class="px-2 py-3 border-t border-white/10 mt-3">
          <p class="text-[10px] text-slate-400">Logado como</p>
          <p class="text-xs font-black text-white truncate">${this._escape(this.state.currentUser?.username || '')}</p>
          <button onclick="AdminApp.logout()" class="mt-2 text-[10px] font-black text-red-300 hover:text-red-100 flex items-center gap-1"><i data-lucide="log-out" class="w-3 h-3"></i> Sair</button>
        </div>
      </aside>
      <main class="flex-1 admin-content p-8 overflow-auto" style="max-height:100vh;">
        ${this.state.activeScreen === 'tenants' ? this._tenantsScreen()
          : this.state.activeScreen === 'users' ? this._usersScreen()
          : this.state.activeScreen === 'plugins' ? this._pluginsScreen()
          : this.state.activeScreen === 'integrations' ? this._integrationsScreen()
          : this.state.activeScreen === 'billing' ? this._billingScreen()
          : this._snapshotsScreen()}
      </main>
      ${this.state.showCreateTenantModal ? this._createTenantModal() : ''}
      ${this.state.showCreateUserModal ? this._createUserModal() : ''}
      ${this.state.plugDbDraft.tenantId ? this._plugDbModal() : ''}
      ${this.state.showBillingAddModal ? this._billingAddModal() : ''}
      ${this.state.toast ? this._toastEl() : ''}
    </div>`;
  },

  _navBtn(screen, label, icon) {
    const active = this.state.activeScreen === screen;
    const cls = active
      ? 'bg-indigo-500/20 border border-indigo-400/40 text-white'
      : 'bg-transparent text-slate-300 hover:bg-white/5';
    return `<button onclick="AdminApp.setScreen('${screen}')" class="${cls} flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-black text-left transition">
      <i data-lucide="${icon}" class="w-4 h-4"></i> ${label}
    </button>`;
  },

  _tenantsScreen() {
    return `<div class="flex items-center justify-between mb-6">
      <div>
        <p class="text-[10px] font-black text-indigo-300 uppercase tracking-wider">Control Plane</p>
        <h1 class="text-2xl font-black">Tenants</h1>
        <p class="text-sm text-slate-400 mt-1">Cada cliente que comprou o LJ. Crie, gerencie, plugue DB próprio, entre como.</p>
      </div>
      <button onclick="AdminApp.openCreateTenantModal()" class="admin-btn-primary px-4 py-2.5 rounded-xl text-xs flex items-center gap-2"><i data-lucide="plus" class="w-4 h-4"></i> Novo tenant</button>
    </div>
    ${this.state.tenantsLoading
      ? `<p class="text-sm text-slate-400">Carregando…</p>`
      : !this.state.tenants.length
        ? `<div class="admin-card p-10 text-center"><p class="text-sm text-slate-400">Nenhum tenant ainda. Crie o primeiro.</p></div>`
        : `<div class="space-y-2">${this.state.tenants.map(t => this._tenantRow(t)).join('')}</div>`
    }`;
  },

  _tenantRow(t) {
    const statusPill = t.status === 'active'
      ? `<span class="admin-pill admin-pill-emerald">ATIVO</span>`
      : t.status === 'demo'
        ? `<span class="admin-pill admin-pill-amber">DEMO</span>`
        : `<span class="admin-pill admin-pill-slate">${this._escape(t.status || '').toUpperCase()}</span>`;
    const dbPill = t.db_plugged
      ? `<span class="admin-pill admin-pill-emerald">DB próprio</span>`
      : `<span class="admin-pill admin-pill-slate">Control plane</span>`;
    return `<div class="admin-card p-4">
      <div class="flex items-center gap-4">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <h3 class="font-black text-white text-lg truncate">${this._escape(t.name || t.slug)}</h3>
            ${statusPill}
            ${dbPill}
          </div>
          <p class="text-[11px] text-slate-400 mt-0.5">slug: <span class="font-mono text-slate-300">${this._escape(t.slug)}</span> · ${t.members_count} membro${t.members_count === 1 ? '' : 's'} ${t.owner_username ? `· owner: <span class="text-slate-300">${this._escape(t.owner_username)}</span>` : ''}</p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button onclick="AdminApp.impersonate(${t.id})" title="Abrir LJ como este tenant em nova aba" class="px-3 py-2 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-400/30 text-indigo-100 text-[11px] font-black flex items-center gap-1"><i data-lucide="log-in" class="w-3.5 h-3.5"></i> Entrar como</button>
          <button onclick="AdminApp.openCreateUserModal(${t.id})" title="Criar novo usuário pra este tenant" class="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-[11px] font-black flex items-center gap-1"><i data-lucide="user-plus" class="w-3.5 h-3.5"></i> Novo user</button>
          ${t.db_plugged
            ? `<button onclick="AdminApp.unplugDb(${t.id})" class="px-3 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-400/30 text-red-200 text-[11px] font-black flex items-center gap-1"><i data-lucide="database-zap" class="w-3.5 h-3.5"></i> Desplugar DB</button>`
            : `<button onclick="AdminApp.openPlugDb(${t.id})" class="px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 text-emerald-200 text-[11px] font-black flex items-center gap-1"><i data-lucide="database" class="w-3.5 h-3.5"></i> Plugar DB</button>`
          }
        </div>
      </div>
    </div>`;
  },

  _createTenantModal() {
    const d = this.state.createTenantDraft;
    return `<div class="fixed inset-0 z-[80] bg-slate-950/80 backdrop-blur-sm grid place-items-center p-4">
      <div class="admin-card p-6 w-full max-w-lg">
        <h3 class="text-xl font-black mb-1">Novo tenant</h3>
        <p class="text-xs text-slate-400 mb-4">Cria a empresa cliente + 1 usuário master inicial. Senha gerada aparece no console e no toast pra você repassar.</p>
        <label class="text-[11px] font-black text-slate-400 uppercase tracking-wider">Slug (URL)</label>
        <input value="${this._escape(d.slug)}" oninput="AdminApp.updateCreateTenantField('slug', this.value)" placeholder="ex: mariano" class="w-full mt-1 mb-3 px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white font-mono text-sm" />
        <label class="text-[11px] font-black text-slate-400 uppercase tracking-wider">Nome de exibição</label>
        <input value="${this._escape(d.name)}" oninput="AdminApp.updateCreateTenantField('name', this.value)" placeholder="ex: Mariano Construções" class="w-full mt-1 mb-3 px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white font-semibold text-sm" />
        <label class="text-[11px] font-black text-slate-400 uppercase tracking-wider">Email do master do tenant</label>
        <input value="${this._escape(d.masterEmail)}" oninput="AdminApp.updateCreateTenantField('masterEmail', this.value)" placeholder="mariano@empresa.com" class="w-full mt-1 mb-3 px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white font-semibold text-sm" />
        <label class="text-[11px] font-black text-slate-400 uppercase tracking-wider">Equipe (opcional)</label>
        <textarea oninput="AdminApp.updateCreateTenantField('teamEmails', this.value)" placeholder="emails separados por vírgula ou espaço" class="w-full mt-1 mb-3 px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white font-semibold text-sm" rows="2">${this._escape(d.teamEmails)}</textarea>
        <div class="flex justify-end gap-2 mt-2">
          <button onclick="AdminApp.closeCreateTenantModal()" class="px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white font-black text-sm">Cancelar</button>
          <button onclick="AdminApp.submitCreateTenant()" class="admin-btn-primary px-4 py-2.5 rounded-xl text-sm">Criar tenant</button>
        </div>
      </div>
    </div>`;
  },

  _createUserModal() {
    const d = this.state.createUserDraft;
    const tenant = this.state.tenants.find(t => Number(t.id) === Number(d.tenantId));
    return `<div class="fixed inset-0 z-[80] bg-slate-950/80 backdrop-blur-sm grid place-items-center p-4">
      <div class="admin-card p-6 w-full max-w-lg">
        <h3 class="text-xl font-black mb-1">Novo usuário</h3>
        <p class="text-xs text-slate-400 mb-4">Cria acesso pra <b>${this._escape(tenant?.name || '')}</b>. Senha gerada aparece no toast pra você repassar fora-de-banda.</p>
        <label class="text-[11px] font-black text-slate-400 uppercase tracking-wider">Email</label>
        <input value="${this._escape(d.email)}" oninput="AdminApp.updateCreateUserField('email', this.value)" class="w-full mt-1 mb-3 px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white font-semibold text-sm" />
        <label class="text-[11px] font-black text-slate-400 uppercase tracking-wider">Nome de exibição (opcional)</label>
        <input value="${this._escape(d.displayName)}" oninput="AdminApp.updateCreateUserField('displayName', this.value)" class="w-full mt-1 mb-3 px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white font-semibold text-sm" />
        <label class="text-[11px] font-black text-slate-400 uppercase tracking-wider">Role</label>
        <select onchange="AdminApp.updateCreateUserField('role', this.value)" class="w-full mt-1 mb-3 px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white font-semibold text-sm">
          <option value="user" ${d.role === 'user' ? 'selected' : ''}>Usuário</option>
          <option value="manager" ${d.role === 'manager' ? 'selected' : ''}>Gerente</option>
          <option value="owner" ${d.role === 'owner' ? 'selected' : ''}>Owner (admin do tenant)</option>
        </select>
        <div class="flex justify-end gap-2 mt-2">
          <button onclick="AdminApp.closeCreateUserModal()" class="px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white font-black text-sm">Cancelar</button>
          <button onclick="AdminApp.submitCreateUser()" class="admin-btn-primary px-4 py-2.5 rounded-xl text-sm">Criar usuário</button>
        </div>
      </div>
    </div>`;
  },

  _plugDbModal() {
    const d = this.state.plugDbDraft;
    const tenant = this.state.tenants.find(t => Number(t.id) === Number(d.tenantId));
    return `<div class="fixed inset-0 z-[80] bg-slate-950/80 backdrop-blur-sm grid place-items-center p-4">
      <div class="admin-card p-6 w-full max-w-lg">
        <h3 class="text-xl font-black mb-1">Plugar DB próprio</h3>
        <p class="text-xs text-slate-400 mb-4">Tenant: <b>${this._escape(tenant?.name || '')}</b>. Cole a connection string Postgres do cliente. É criptografada no backend antes de salvar.</p>
        <label class="text-[11px] font-black text-slate-400 uppercase tracking-wider">Connection string</label>
        <input value="${this._escape(d.connString)}" oninput="AdminApp.updatePlugDbConnString(this.value)" placeholder="postgres://user:pass@host:5432/db" class="w-full mt-1 mb-3 px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white font-mono text-sm" />
        <div class="flex justify-end gap-2 mt-2">
          <button onclick="AdminApp.closePlugDb()" class="px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white font-black text-sm">Cancelar</button>
          <button onclick="AdminApp.submitPlugDb()" class="admin-btn-primary px-4 py-2.5 rounded-xl text-sm">Plugar</button>
        </div>
      </div>
    </div>`;
  },

  // ===== TELA USUÁRIOS POR TENANT =====
  _usersScreen() {
    const tenant = this.state.tenants.find(t => Number(t.id) === Number(this.state.usersTenantId));
    const usersCount = this.state.usersList.length;
    const aiCount = this.state.usersList.filter(u => u.masterAiEnabled || u.hasOwnAiKey).length;
    return `<div class="flex items-center justify-between mb-6">
      <div>
        <p class="text-[10px] font-black text-indigo-300 uppercase tracking-wider">Acesso & IA</p>
        <h1 class="text-2xl font-black">Usuários por tenant</h1>
        <p class="text-sm text-slate-400 mt-1">Veja quem cada cliente tem cadastrado e libere o saldo Anthropic do LJ por usuário. Toggle aplica imediatamente — próxima chamada de IA usa o saldo do LJ ao invés de exigir chave própria.</p>
      </div>
      ${this.state.usersTenantId ? `<button onclick="AdminApp.openCreateUserModal(${this.state.usersTenantId})" class="admin-btn-primary px-4 py-2.5 rounded-xl text-xs flex items-center gap-2"><i data-lucide="user-plus" class="w-4 h-4"></i> Novo usuário</button>` : ''}
    </div>
    <div class="admin-card p-4 mb-4">
      <label class="text-[11px] font-black text-slate-400 uppercase tracking-wider">Tenant</label>
      <select onchange="AdminApp.setUsersTenant(this.value)" class="w-full mt-1 px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white font-semibold text-sm">
        <option value="">— escolha um tenant —</option>
        ${this.state.tenants.map(t => `<option value="${t.id}" ${Number(this.state.usersTenantId) === Number(t.id) ? 'selected' : ''}>${this._escape(t.name)}</option>`).join('')}
      </select>
    </div>
    ${!this.state.usersTenantId
      ? `<p class="text-sm text-slate-400">Escolha um tenant pra ver os usuários cadastrados nele.</p>`
      : this.state.usersLoading
        ? `<p class="text-sm text-slate-400">Carregando…</p>`
        : !usersCount
          ? `<div class="admin-card p-10 text-center"><p class="text-sm text-slate-400">Nenhum usuário cadastrado em ${this._escape(tenant?.name || '')}. Clique em "Novo usuário" pra criar.</p></div>`
          : `<div class="grid grid-cols-2 gap-3 mb-4">
              <div class="admin-card p-4"><p class="text-[10px] font-black text-slate-400 uppercase tracking-wider">Cadastrados</p><p class="text-2xl font-black text-white mt-1">${usersCount}</p></div>
              <div class="admin-card p-4"><p class="text-[10px] font-black text-slate-400 uppercase tracking-wider">Com IA disponível</p><p class="text-2xl font-black text-emerald-300 mt-1">${aiCount}</p><p class="text-[10px] text-slate-400 mt-0.5">via saldo LJ ou chave própria</p></div>
            </div>
            <div class="space-y-2">${this.state.usersList.map(u => this._userRow(u)).join('')}</div>
            <p class="text-[11px] text-slate-400 mt-4">"IA liberada" = ${this._escape(tenant?.name || '')} usa o saldo Anthropic do LJ. "Chave própria" = cliente plugou a dele em Configurações → IA. Operador LJ sempre vê tudo (master é override global).</p>`
    }`;
  },

  _userRow(u) {
    const aiEnabled = !!u.masterAiEnabled;
    const hasOwn = !!u.hasOwnAiKey;
    const roleLabel = u.role === 'owner' ? 'OWNER' : u.role === 'manager' ? 'GERENTE' : 'USUÁRIO';
    const roleClass = u.role === 'owner' ? 'admin-pill-emerald' : u.role === 'manager' ? 'admin-pill-amber' : 'admin-pill-slate';
    const lastLogin = u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('pt-BR') : 'nunca logou';
    const initials = String(u.displayName || u.email || '?').slice(0, 2).toUpperCase();
    return `<div class="admin-card p-4 flex items-center gap-4">
      <div class="shrink-0 w-10 h-10 rounded-xl grid place-items-center text-white text-[11px] font-black" style="background:linear-gradient(135deg,#6366f1,#a855f7);">${this._escape(initials)}</div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <p class="font-black text-white truncate">${this._escape(u.displayName || u.email)}</p>
          <span class="admin-pill ${roleClass}">${roleLabel}</span>
          ${aiEnabled ? `<span class="admin-pill admin-pill-emerald">IA LIBERADA</span>` : ''}
          ${hasOwn ? `<span class="admin-pill admin-pill-slate">CHAVE PRÓPRIA</span>` : ''}
          ${!u.isApproved ? `<span class="admin-pill admin-pill-amber">NÃO APROVADO</span>` : ''}
        </div>
        <p class="text-[11px] text-slate-400 mt-0.5 truncate">${this._escape(u.email)} · último login ${lastLogin}</p>
      </div>
      <div class="shrink-0 flex items-center gap-3">
        <div class="text-right">
          <p class="text-[10px] font-black text-slate-400 uppercase tracking-wider">Saldo LJ</p>
          <p class="text-[10px] text-slate-300">${aiEnabled ? 'liberado' : 'cortado'}</p>
        </div>
        <button onclick="AdminApp.toggleUserAi(${u.id}, ${aiEnabled})"
                title="${aiEnabled ? 'Cortar saldo de IA do LJ' : 'Liberar saldo de IA do LJ pra este usuário'}"
                class="inline-flex items-center gap-2 px-1 py-1 rounded-full transition"
                style="background:${aiEnabled ? '#10b981' : '#475569'};width:48px;justify-content:${aiEnabled ? 'flex-end' : 'flex-start'};border:1px solid ${aiEnabled ? 'rgba(52,211,153,0.5)' : 'rgba(148,163,184,0.4)'};">
          <span class="block w-5 h-5 rounded-full bg-white shadow"></span>
        </button>
      </div>
    </div>`;
  },

  _pluginsScreen() {
    const tenant = this.state.tenants.find(t => Number(t.id) === Number(this.state.pluginsTenantId));
    return `<div class="flex items-center justify-between mb-6">
      <div>
        <p class="text-[10px] font-black text-indigo-300 uppercase tracking-wider">Gating</p>
        <h1 class="text-2xl font-black">Plugins por tenant</h1>
        <p class="text-sm text-slate-400 mt-1">Libere ou corte plugins individualmente pra cada cliente. Tenant sem registro vê o default do catálogo.</p>
      </div>
    </div>
    <div class="admin-card p-4 mb-4">
      <label class="text-[11px] font-black text-slate-400 uppercase tracking-wider">Tenant</label>
      <select onchange="AdminApp.setPluginsTenant(this.value)" class="w-full mt-1 px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white font-semibold text-sm">
        <option value="">— escolha um tenant —</option>
        ${this.state.tenants.map(t => `<option value="${t.id}" ${Number(this.state.pluginsTenantId) === Number(t.id) ? 'selected' : ''}>${this._escape(t.name)}</option>`).join('')}
      </select>
    </div>
    ${!this.state.pluginsTenantId
      ? `<p class="text-sm text-slate-400">Escolha um tenant pra ver e gerenciar os plugins dele.</p>`
      : this.state.pluginsLoading
        ? `<p class="text-sm text-slate-400">Carregando…</p>`
        : !this.state.pluginsList.length
          ? `<div class="admin-card p-10 text-center"><p class="text-sm text-slate-400">Catálogo vazio.</p></div>`
          : `<div class="space-y-2">${this.state.pluginsList.map(p => this._pluginRow(p)).join('')}</div>
             <p class="text-[11px] text-slate-400 mt-4">Mudança aplica na próxima vez que ${this._escape(tenant?.name || '')} abrir o app. Operador LJ sempre vê tudo (override).</p>`
    }`;
  },

  _pluginRow(p) {
    const enabled = !!p.enabled;
    const onColor = enabled ? '#10b981' : '#475569';
    const offColor = enabled ? '#0b1325' : '#0b1325';
    return `<div class="admin-card p-4 flex items-center gap-4">
      <span class="w-10 h-10 rounded-xl grid place-items-center shrink-0" style="background:${p.color}22;color:${p.color};border:1px solid ${p.color}55;"><i data-lucide="${this._escape(p.icon || 'puzzle')}" class="w-5 h-5"></i></span>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <p class="font-black text-white">${this._escape(p.name)}</p>
          ${enabled ? `<span class="admin-pill admin-pill-emerald">ATIVO</span>` : `<span class="admin-pill admin-pill-slate">DESATIVADO</span>`}
          ${!p.hasRecord ? `<span class="admin-pill admin-pill-amber">DEFAULT</span>` : ''}
        </div>
        <p class="text-[11px] text-slate-400 mt-0.5">${this._escape(p.description)}</p>
      </div>
      <button onclick="AdminApp.togglePlugin('${this._escape(p.id)}', ${enabled})"
              class="shrink-0 inline-flex items-center gap-2 px-1 py-1 rounded-full transition"
              style="background:${onColor};width:48px;justify-content:${enabled ? 'flex-end' : 'flex-start'};border:1px solid ${enabled ? 'rgba(52,211,153,0.5)' : 'rgba(148,163,184,0.4)'};">
        <span class="block w-5 h-5 rounded-full bg-white shadow"></span>
      </button>
    </div>`;
  },

  // ===== TELA INTEGRAÇÕES =====
  _integrationsScreen() {
    const tenant = this.state.tenants.find(t => Number(t.id) === Number(this.state.integrationsTenantId));
    return `<div class="flex items-center justify-between mb-6">
      <div>
        <p class="text-[10px] font-black text-indigo-300 uppercase tracking-wider">Gating</p>
        <h1 class="text-2xl font-black">Integrações por tenant</h1>
        <p class="text-sm text-slate-400 mt-1">Libere ou corte integrações e APIs do LJ individualmente pra cada cliente. Catálogo em <span class="font-mono text-slate-300">lib/integrations-catalog.js</span> — pra adicionar nova, edita lá + replica no frontend.</p>
      </div>
    </div>
    <div class="admin-card p-4 mb-4">
      <label class="text-[11px] font-black text-slate-400 uppercase tracking-wider">Tenant</label>
      <select onchange="AdminApp.setIntegrationsTenant(this.value)" class="w-full mt-1 px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white font-semibold text-sm">
        <option value="">— escolha um tenant —</option>
        ${this.state.tenants.map(t => `<option value="${t.id}" ${Number(this.state.integrationsTenantId) === Number(t.id) ? 'selected' : ''}>${this._escape(t.name)}</option>`).join('')}
      </select>
    </div>
    ${!this.state.integrationsTenantId
      ? `<p class="text-sm text-slate-400">Escolha um tenant pra ver e gerenciar as integrações dele.</p>`
      : this.state.integrationsLoading
        ? `<p class="text-sm text-slate-400">Carregando…</p>`
        : !this.state.integrationsList.length
          ? `<div class="admin-card p-10 text-center"><p class="text-sm text-slate-400">Catálogo vazio.</p></div>`
          : `<div class="space-y-2">${this.state.integrationsList.map(i => this._integrationRow(i)).join('')}</div>
             <p class="text-[11px] text-slate-400 mt-4">Mudança aplica na próxima vez que ${this._escape(tenant?.name || '')} abrir o app. Integrações com status <span class="admin-pill admin-pill-amber">DRAFT</span> ficam ocultas pra tenants comuns mesmo se ativadas.</p>`
    }`;
  },

  _integrationRow(i) {
    const enabled = !!i.enabled;
    const onColor = enabled ? '#10b981' : '#475569';
    const typePill = i.type === 'public-api'
      ? `<span class="admin-pill admin-pill-emerald">API PÚBLICA</span>`
      : `<span class="admin-pill admin-pill-slate">EXTERNA</span>`;
    const statusPill = i.status === 'draft'
      ? `<span class="admin-pill admin-pill-amber">DRAFT</span>`
      : i.status === 'ready'
        ? `<span class="admin-pill admin-pill-slate">READY</span>`
        : `<span class="admin-pill admin-pill-emerald">GA</span>`;
    return `<div class="admin-card p-4 flex items-center gap-4">
      <span class="w-10 h-10 rounded-xl grid place-items-center shrink-0" style="background:${i.color}22;color:${i.color};border:1px solid ${i.color}55;"><i data-lucide="${this._escape(i.icon || 'link')}" class="w-5 h-5"></i></span>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <p class="font-black text-white">${this._escape(i.name)}</p>
          ${typePill}
          ${statusPill}
          ${enabled ? `<span class="admin-pill admin-pill-emerald">ATIVO</span>` : `<span class="admin-pill admin-pill-slate">DESATIVADO</span>`}
          ${!i.hasRecord ? `<span class="admin-pill admin-pill-amber">DEFAULT</span>` : ''}
        </div>
        <p class="text-[11px] text-slate-400 mt-0.5">${this._escape(i.description)}</p>
      </div>
      <button onclick="AdminApp.toggleIntegration('${this._escape(i.id)}', ${enabled})"
              class="shrink-0 inline-flex items-center gap-2 px-1 py-1 rounded-full transition"
              style="background:${onColor};width:48px;justify-content:${enabled ? 'flex-end' : 'flex-start'};border:1px solid ${enabled ? 'rgba(52,211,153,0.5)' : 'rgba(148,163,184,0.4)'};">
        <span class="block w-5 h-5 rounded-full bg-white shadow"></span>
      </button>
    </div>`;
  },

  // ===== TELA COBRANÇA =====
  _billingScreen() {
    const tenant = this.state.tenants.find(t => Number(t.id) === Number(this.state.billingTenantId));
    const totals = this.state.billingTotals || { total_pending: 0, total_paid: 0, hours_total: 0 };
    const fmtBRL = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `<div class="flex items-center justify-between mb-6">
      <div>
        <p class="text-[10px] font-black text-indigo-300 uppercase tracking-wider">Cobrança manual</p>
        <h1 class="text-2xl font-black">Horas faturadas</h1>
        <p class="text-sm text-slate-400 mt-1">Registre horas trabalhadas por tenant e marque como pago manualmente. Sem integração com Stripe — você controla a régua.</p>
      </div>
      ${this.state.billingTenantId ? `<button onclick="AdminApp.openBillingAdd()" class="admin-btn-primary px-4 py-2.5 rounded-xl text-xs flex items-center gap-2"><i data-lucide="plus" class="w-4 h-4"></i> Nova cobrança</button>` : ''}
    </div>
    <div class="admin-card p-4 mb-4">
      <label class="text-[11px] font-black text-slate-400 uppercase tracking-wider">Tenant</label>
      <select onchange="AdminApp.setBillingTenant(this.value)" class="w-full mt-1 px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white font-semibold text-sm">
        <option value="">— escolha um tenant —</option>
        ${this.state.tenants.map(t => `<option value="${t.id}" ${Number(this.state.billingTenantId) === Number(t.id) ? 'selected' : ''}>${this._escape(t.name)}</option>`).join('')}
      </select>
    </div>
    ${!this.state.billingTenantId
      ? `<p class="text-sm text-slate-400">Escolha um tenant pra ver as cobranças dele.</p>`
      : `<div class="grid grid-cols-3 gap-3 mb-4">
          <div class="admin-card p-4"><p class="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total pendente</p><p class="text-2xl font-black text-amber-300 mt-1">${fmtBRL(totals.total_pending)}</p></div>
          <div class="admin-card p-4"><p class="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total pago</p><p class="text-2xl font-black text-emerald-300 mt-1">${fmtBRL(totals.total_paid)}</p></div>
          <div class="admin-card p-4"><p class="text-[10px] font-black text-slate-400 uppercase tracking-wider">Horas totais</p><p class="text-2xl font-black text-white mt-1">${Number(totals.hours_total || 0).toFixed(1)}h</p></div>
        </div>
        ${this.state.billingLoading
          ? `<p class="text-sm text-slate-400">Carregando…</p>`
          : !this.state.billingEntries.length
            ? `<div class="admin-card p-10 text-center"><p class="text-sm text-slate-400">Nenhuma cobrança registrada pra ${this._escape(tenant?.name || '')}.</p></div>`
            : `<div class="space-y-1.5">${this.state.billingEntries.map(e => this._billingRow(e, fmtBRL)).join('')}</div>`
        }`
    }`;
  },

  _billingRow(e, fmtBRL) {
    const paid = e.status === 'paid';
    const dt = e.performed_at ? new Date(e.performed_at).toLocaleDateString('pt-BR') : '—';
    const paidDt = e.paid_at ? new Date(e.paid_at).toLocaleDateString('pt-BR') : null;
    return `<div class="admin-card p-3 flex items-center gap-3">
      <div class="shrink-0 w-2 h-10 rounded-full" style="background:${paid ? '#10b981' : '#f59e0b'};"></div>
      <div class="flex-1 min-w-0 grid grid-cols-[80px_1fr_140px_120px] gap-3 items-center">
        <div>
          <p class="text-[10px] text-slate-400 uppercase tracking-wider">Data</p>
          <p class="text-xs font-black text-white">${dt}</p>
        </div>
        <div class="min-w-0">
          <p class="text-[10px] text-slate-400 uppercase tracking-wider">Descrição</p>
          <p class="text-xs font-semibold text-slate-200 truncate">${this._escape(e.note || '—')}</p>
        </div>
        <div>
          <p class="text-[10px] text-slate-400 uppercase tracking-wider">Horas × valor</p>
          <p class="text-xs font-black text-white">${Number(e.hours).toFixed(1)}h × ${fmtBRL(e.rate)}</p>
        </div>
        <div>
          <p class="text-[10px] text-slate-400 uppercase tracking-wider">Total</p>
          <p class="text-xs font-black ${paid ? 'text-emerald-300' : 'text-amber-300'}">${fmtBRL(e.total)}</p>
        </div>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        ${paid
          ? `<span class="admin-pill admin-pill-emerald">PAGO ${paidDt ? `· ${paidDt}` : ''}</span><button onclick="AdminApp.markBillingPaid(${e.id}, true)" title="Reverter pra pendente" class="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-[10px] font-black">↺</button>`
          : `<span class="admin-pill admin-pill-amber">PENDENTE</span><button onclick="AdminApp.markBillingPaid(${e.id}, false)" class="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 text-emerald-200 text-[10px] font-black">Marcar pago</button>`
        }
        <button onclick="AdminApp.deleteBillingEntry(${e.id})" title="Apagar" class="px-2 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-400/30 text-red-200"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
      </div>
    </div>`;
  },

  _billingAddModal() {
    const d = this.state.billingAddDraft;
    const tenant = this.state.tenants.find(t => Number(t.id) === Number(this.state.billingTenantId));
    return `<div class="fixed inset-0 z-[80] bg-slate-950/80 backdrop-blur-sm grid place-items-center p-4">
      <div class="admin-card p-6 w-full max-w-lg">
        <h3 class="text-xl font-black mb-1">Nova cobrança</h3>
        <p class="text-xs text-slate-400 mb-4">Pra <b>${this._escape(tenant?.name || '')}</b>. Total é calculado automaticamente (horas × valor/hora).</p>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-[11px] font-black text-slate-400 uppercase tracking-wider">Horas</label>
            <input type="number" step="0.25" value="${this._escape(d.hours)}" oninput="AdminApp.updateBillingAddField('hours', this.value)" placeholder="ex: 2.5" class="w-full mt-1 px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white font-mono text-sm" />
          </div>
          <div>
            <label class="text-[11px] font-black text-slate-400 uppercase tracking-wider">Valor/hora (R$)</label>
            <input type="number" step="0.01" value="${this._escape(d.rate)}" oninput="AdminApp.updateBillingAddField('rate', this.value)" placeholder="ex: 250.00" class="w-full mt-1 px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white font-mono text-sm" />
          </div>
        </div>
        <label class="text-[11px] font-black text-slate-400 uppercase tracking-wider mt-3 block">Data do trabalho</label>
        <input type="date" value="${this._escape(d.performedAt)}" oninput="AdminApp.updateBillingAddField('performedAt', this.value)" class="w-full mt-1 mb-3 px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white font-semibold text-sm" />
        <label class="text-[11px] font-black text-slate-400 uppercase tracking-wider">Descrição (opcional)</label>
        <textarea oninput="AdminApp.updateBillingAddField('note', this.value)" rows="2" placeholder="ex: Implementação do dashboard de leads" class="w-full mt-1 mb-3 px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white font-semibold text-sm">${this._escape(d.note)}</textarea>
        ${d.hours && d.rate ? `<p class="text-sm font-black text-emerald-300 mb-3">Total: R$ ${(Number(d.hours) * Number(d.rate)).toFixed(2)}</p>` : ''}
        <div class="flex justify-end gap-2 mt-2">
          <button onclick="AdminApp.closeBillingAdd()" class="px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white font-black text-sm">Cancelar</button>
          <button onclick="AdminApp.submitBillingAdd()" class="admin-btn-primary px-4 py-2.5 rounded-xl text-sm">Registrar</button>
        </div>
      </div>
    </div>`;
  },

  _snapshotsScreen() {
    return `<div class="flex items-center justify-between mb-6">
      <div>
        <p class="text-[10px] font-black text-indigo-300 uppercase tracking-wider">Backup & Restore</p>
        <h1 class="text-2xl font-black">Snapshots</h1>
        <p class="text-sm text-slate-400 mt-1">Estado salvo de cada tenant. Use antes de deploys arriscados.</p>
      </div>
      <button onclick="AdminApp.takeSnapshot()" class="admin-btn-primary px-4 py-2.5 rounded-xl text-xs flex items-center gap-2"><i data-lucide="camera" class="w-4 h-4"></i> Tirar snapshot agora</button>
    </div>
    <div class="admin-card p-4 mb-4">
      <label class="text-[11px] font-black text-slate-400 uppercase tracking-wider">Tenant</label>
      <select onchange="AdminApp.setSelectedSnapshotTenant(this.value)" class="w-full mt-1 px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white font-semibold text-sm">
        <option value="">— escolha um tenant —</option>
        ${this.state.tenants.map(t => `<option value="${t.id}" ${Number(this.state.selectedSnapshotTenantId) === Number(t.id) ? 'selected' : ''}>${this._escape(t.name)}</option>`).join('')}
      </select>
    </div>
    ${!this.state.selectedSnapshotTenantId
      ? `<p class="text-sm text-slate-400">Escolha um tenant pra ver os snapshots dele.</p>`
      : this.state.snapshotsLoading
        ? `<p class="text-sm text-slate-400">Carregando…</p>`
        : !this.state.snapshots.length
          ? `<div class="admin-card p-10 text-center"><p class="text-sm text-slate-400">Nenhum snapshot encontrado pra este tenant.</p></div>`
          : `<div class="space-y-1.5">${this.state.snapshots.map(s => this._snapshotRow(s)).join('')}</div>`
    }`;
  },

  _snapshotRow(s) {
    const dt = s.created_at ? new Date(s.created_at).toLocaleString('pt-BR') : '—';
    return `<div class="admin-card p-3 flex items-center gap-3">
      <i data-lucide="database-backup" class="w-4 h-4 text-indigo-300 shrink-0"></i>
      <div class="flex-1 min-w-0">
        <p class="text-xs font-black text-white truncate">${this._escape(s.id || s.snapshot_id || '')}</p>
        <p class="text-[10px] text-slate-400">${dt} ${s.size_kb ? `· ${s.size_kb} KB` : ''}</p>
      </div>
      <button onclick="AdminApp.restoreSnapshot(${this.state.selectedSnapshotTenantId}, '${this._escape(s.id || s.snapshot_id)}')" class="px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/30 text-amber-100 text-[11px] font-black">Restaurar</button>
    </div>`;
  },

  _toastEl() {
    const t = this.state.toast;
    const cls = t.kind === 'error' ? 'bg-red-500/20 border-red-400/40 text-red-100'
              : t.kind === 'success' ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-100'
              : 'bg-slate-800/90 border-white/20 text-white';
    return `<div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] ${cls} border rounded-2xl px-5 py-3 text-sm font-black shadow-2xl">${this._escape(t.msg)}</div>`;
  }
};
