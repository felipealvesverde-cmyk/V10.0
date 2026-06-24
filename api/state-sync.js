// V31.0.0 — GET/POST /api/state-sync (multi-tenant: chaveado por user_id)
//
// GET: retorna state do user autenticado + updated_at.
//   - Master, production e demo: lê de journey_state WHERE user_id = req.user.sub
//   - Sandbox: também recebe (mas frontend ignora, usa localStorage)
//
// POST: salva state do user autenticado.
//   - Body: { state, clientUpdatedAt? }
//   - Sandbox + Demo: rejeitado (403) — sandbox por design, demo pelo middleware
//   - Master + production: faz UPSERT em journey_state (user_id como PK)
//   - Conflict resolution: last-write-wins via NOW() do servidor
module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });

  const userId = req.user.sub;

  // V37.4.29 — Resolve tenant_id (JWT ou fallback default_tenant_id). Pra
  // tenants migrados, state vive em tenant_state — todos os membros compartilham.
  let resolvedTenantId = req.user.tenantId || null;
  if (!resolvedTenantId) {
    try {
      const u = await req.db.query('SELECT default_tenant_id FROM users WHERE id = $1', [userId]);
      resolvedTenantId = u.rows[0]?.default_tenant_id || null;
    } catch (_) { /* defensive */ }
  }

  if (req.method === 'GET') {
    try {
      // V37.4.29 — Lê tenant_state PRIMEIRO. Fallback pra journey_state se
      // tenant ainda não migrou (tabela inexistente OU sem row pro tenant).
      if (resolvedTenantId) {
        try {
          const tsResult = await req.tenantDb.query(
            'SELECT state_json, updated_at FROM tenant_state WHERE tenant_id = $1',
            [resolvedTenantId]
          );
          if (tsResult.rows.length) {
            const row = tsResult.rows[0];
            return res.status(200).json({
              ok: true,
              state: row.state_json,
              updatedAt: row.updated_at,
              mode: req.user.mode || 'sandbox',
              source: 'tenant_state'
            });
          }
        } catch (err) {
          // Tabela ainda não existe (migration não rodou) — cai pro fallback abaixo.
          if (!String(err.message).includes('does not exist')) {
            console.warn('[state-sync GET] tenant_state read falhou (cai pra fallback):', err.message);
          }
        }
      }

      // Fallback legado: journey_state per-user.
      const result = await req.tenantDb.query(
        'SELECT state_json, updated_at FROM journey_state WHERE user_id = $1',
        [userId]
      );
      const row = result.rows[0];
      if (!row) {
        return res.status(200).json({ ok: true, state: null, updatedAt: null, mode: req.user.mode || 'sandbox', source: 'none' });
      }
      return res.status(200).json({
        ok: true,
        state: row.state_json,
        updatedAt: row.updated_at,
        mode: req.user.mode || 'sandbox',
        source: 'journey_state_legacy'
      });
    } catch (err) {
      console.error('[state-sync GET]', err);
      return res.status(500).json({ ok: false, message: err.message });
    }
  }

  if (req.method === 'POST') {
    // V23.0.0 — Sandbox bloqueia gravação no banco. (Demo já barrado em middleware global.)
    if (req.user.mode === 'sandbox' && !req.user.isMaster) {
      return res.status(403).json({ ok: false, message: 'Modo sandbox não persiste no banco.' });
    }

    const state = req.body?.state;
    if (!state || typeof state !== 'object') {
      return res.status(400).json({ ok: false, message: 'Body precisa de { state: {...} }' });
    }

    // V40.14.17 — GUARD DE TENANT IDENTITY (cross-tenant write block).
    // Felipe perdeu Atira.Pro do Sansone em 2026-06-24 porque o navegador que
    // estava logado como master no tenant Sansone fez auto-save com state da
    // sessão anterior (state.user.tenantId divergente do JWT), sobrescrevendo
    // o produto. Esse guard rejeita explicitamente qualquer save em que o
    // state diz pertencer a outro tenant/user. Defesa em profundidade —
    // a camada 2 (purga client-side no logout/login) vai pra V40.15.0.
    const stateUser = state.user && typeof state.user === 'object' ? state.user : null;
    if (stateUser) {
      const stateTenantId = stateUser.tenantId != null ? Number(stateUser.tenantId) : null;
      const jwtTenantId = resolvedTenantId != null ? Number(resolvedTenantId) : null;
      if (stateTenantId != null && jwtTenantId != null && stateTenantId !== jwtTenantId) {
        console.warn('[state-sync POST] 🚨 REJEITADO V40.14.17 — state.user.tenantId mismatch com JWT.', {
          jwt_user: userId,
          jwt_tenant: jwtTenantId,
          state_tenant: stateTenantId,
          state_user_id: stateUser.id
        });
        return res.status(409).json({
          ok: false,
          code: 'tenant_mismatch',
          message: 'Cross-tenant write bloqueado. State do navegador pertence a outro tenant — faça logout completo (fechar aba) e relogin pra resetar.',
          expected: { tenantId: jwtTenantId, userId },
          received: { tenantId: stateTenantId, userId: stateUser.id }
        });
      }
      const stateUserId = stateUser.id != null ? Number(stateUser.id) : null;
      // Master pode ler state de qualquer user mas o auto-save normal não
      // deveria gravar com user.id != JWT.sub. Bloqueia mesmo pra master —
      // master que precisa importar state em outro user usa o endpoint
      // admin-import-tenant-state explicitamente (que pula esse guard).
      if (stateUserId != null && stateUserId !== Number(userId)) {
        console.warn('[state-sync POST] 🚨 REJEITADO V40.14.17 — state.user.id mismatch com JWT.', {
          jwt_user: userId,
          state_user: stateUserId,
          is_master: !!req.user.isMaster
        });
        return res.status(409).json({
          ok: false,
          code: 'user_mismatch',
          message: 'State do navegador pertence a outro usuário. Faça logout completo (fechar aba) e relogin pra resetar.',
          expected: { userId },
          received: { userId: stateUserId }
        });
      }
    }

    // V36.8.3 — GUARD DE EMERGÊNCIA: rejeita state malformado (proteção de
    // último nível, defesa em profundidade). Felipe perdeu Sansone em
    // 2026-06-08/09 porque runHealthCheck (V36.5.0) mandava body
    // { state: { hc_ping: true } } pra "testar conectividade" — endpoint
    // salvava literal sobrescrevendo state legítimo a cada 30s do panel timer.
    // Frontend já não faz mais isso (V36.8.3 mudou pra GET), mas o backend
    // agora rejeita explicitamente esse padrão E qualquer state que NÃO tenha
    // os campos mínimos de um state real do LJ.
    const stateKeys = Object.keys(state);
    const looksLikePing = stateKeys.length <= 2 && (state.hc_ping !== undefined || state.ping !== undefined);
    const hasAnyRealField = ['products', 'campaigns', 'actions', 'leads', 'integrations', 'lastSavedAt'].some(k => state[k] !== undefined);
    if (looksLikePing || !hasAnyRealField) {
      console.warn('[state-sync POST] 🚨 REJEITADO V36.8.3 — body parece ping ou state corrompido.', {
        user_id: userId,
        keys: stateKeys,
        looksLikePing,
        hasAnyRealField
      });
      return res.status(422).json({
        ok: false,
        message: 'State malformado — não tem campos mínimos de um state real (products/campaigns/actions/integrations).',
        keys_received: stateKeys
      });
    }

    // V36.8.3 — Aviso (não bloqueio): se vier 0 produtos, 0 campanhas e 0 ações
    // num tenant que tinha dados antes, loga pra investigação. NÃO bloqueia
    // porque isso pode ser legítimo (cliente novo, reset intencional).
    // Frontend tem guards V36.7.1 e V36.7.2 que cuidam disso na origem.
    try {
      const totalIncoming = (state.products||[]).length + (state.campaigns||[]).length + (state.actions||[]).length;
      if (totalIncoming === 0) {
        const prior = await req.tenantDb.query(
          `SELECT jsonb_array_length(state_json->'products') AS p,
                  jsonb_array_length(state_json->'campaigns') AS c,
                  jsonb_array_length(state_json->'actions') AS a
             FROM journey_state WHERE user_id = $1`,
          [userId]
        );
        const row = prior.rows[0];
        if (row && (row.p > 0 || row.c > 0 || row.a > 0)) {
          console.warn('[state-sync POST] ⚠ Push zerando state que tinha dados.', {
            user_id: userId,
            prior_products: row.p,
            prior_campaigns: row.c,
            prior_actions: row.a
          });
        }
      }
    } catch (_) { /* defensive — não bloqueia se telemetria falhar */ }

    try {
      // V37.4.29 — DUAL-WRITE transitório.
      // - tenant_state: source of truth (todos membros do tenant compartilham).
      // - journey_state: backup legado mantido por algumas releases pra rollback fácil.
      // Após Felipe validar colaboração de verdade, remove o write em journey_state.

      let wroteTenantState = false;
      if (resolvedTenantId) {
        try {
          await req.tenantDb.query(
            `INSERT INTO tenant_state (tenant_id, state_json, last_writer_user_id, updated_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (tenant_id) DO UPDATE SET
               state_json = EXCLUDED.state_json,
               last_writer_user_id = EXCLUDED.last_writer_user_id,
               updated_at = NOW()`,
            [resolvedTenantId, state, userId]
          );
          wroteTenantState = true;
        } catch (err) {
          // Tabela não existe → ignora silenciosamente. POST continua escrevendo
          // em journey_state. Felipe roda /api/admin-migrate-tenant-state pra criar.
          if (!String(err.message).includes('does not exist')) {
            console.warn('[state-sync POST] tenant_state write falhou:', err.message);
          }
        }
      }

      // Backup legado.
      await req.tenantDb.query(
        `INSERT INTO journey_state (user_id, state_json, updated_at, updated_by_user_id)
         VALUES ($1, $2, NOW(), $1)
         ON CONFLICT (user_id) DO UPDATE SET
           state_json = EXCLUDED.state_json,
           updated_at = NOW(),
           updated_by_user_id = EXCLUDED.updated_by_user_id`,
        [userId, state]
      );

      return res.status(200).json({
        ok: true,
        updatedAt: new Date().toISOString(),
        wroteTenantState,
        wroteJourneyStateLegacy: true
      });
    } catch (err) {
      console.error('[state-sync POST]', err);
      return res.status(500).json({ ok: false, message: err.message });
    }
  }

  return res.status(405).json({ ok: false, message: 'Use GET ou POST.' });
};
