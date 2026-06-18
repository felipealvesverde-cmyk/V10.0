// V40.0.0 — Boot do Cockpit Operacional (/admin).
// Verifica JWT, exige isLjOperator, monta AdminApp.
(async function () {
  // Logout limpo via ?logout=1
  if (new URLSearchParams(window.location.search).get('logout') === '1') {
    localStorage.removeItem('lj_jwt');
    history.replaceState(null, '', '/admin');
  }

  const root = document.getElementById('adminRoot');
  if (!root) {
    console.error('[admin] #adminRoot não encontrado.');
    return;
  }

  const token = localStorage.getItem('lj_jwt');
  if (!token) {
    AdminApp.render();
    return;
  }

  // Tenta validar JWT
  try {
    const res = await fetch('/api/auth-me', { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok || !data.authenticated || !data.user) {
      localStorage.removeItem('lj_jwt');
      AdminApp.render();
      return;
    }
    if (!data.user.isLjOperator) {
      AdminApp.state.currentUser = null;
      AdminApp.render();
      const errEl = document.createElement('div');
      errEl.style.cssText = 'position:fixed;bottom:6rem;left:50%;transform:translateX(-50%);background:rgba(239,68,68,0.2);border:1px solid rgba(248,113,113,0.5);color:#fca5a5;padding:10px 18px;border-radius:12px;font-weight:700;font-size:13px;z-index:90;';
      errEl.textContent = 'Esta conta não tem acesso ao cockpit.';
      document.body.appendChild(errEl);
      setTimeout(() => errEl.remove(), 4000);
      return;
    }
    AdminApp.state.currentUser = data.user;
    await AdminApp.loadTenants();
    AdminApp.render();
  } catch (err) {
    console.error('[admin] boot error:', err);
    AdminApp.render();
  }
})();
