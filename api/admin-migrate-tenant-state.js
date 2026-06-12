// V37.4.29 — POST /api/admin-migrate-tenant-state
//
// Migra state per-user (journey_state) → per-tenant (tenant_state).
// Estratégia transitória: cria a nova tabela no req.tenantDb e importa o
// state existente do OWNER do tenant logado (1 row por tenant_id).
//
// Idempotente: ON CONFLICT (tenant_id) DO NOTHING — nunca sobrescreve um
// tenant_state existente. Pra forçar re-import, deletar a row primeiro.
//
// Quem pode: Master ou owner do tenant alvo. O endpoint roda no contexto
// do TENANT ATIVO do user logado (req.user.tenantId), criando a tabela
// no DB próprio dele se houver, ou no control plane senão.
//
// Roda 1x POR TENANT. Cada tenant tem seu próprio DB → tabela vive lá.

const { normalizeRole } = require('../lib/permission-engine');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não resolvido.' });

  // Resolve tenant alvo (do JWT ou fallback default_tenant_id).
  let tenantId = req.user.tenantId || null;
  if (!tenantId) {
    const u = await req.db.query('SELECT default_tenant_id FROM users WHERE id = $1', [req.user.sub]);
    tenantId = u.rows[0]?.default_tenant_id || null;
  }
  if (!tenantId) return res.status(400).json({ ok: false, message: 'Sem tenant ativo. Master sem default_tenant_id precisa selecionar tenant antes.' });

  // Auth: Master OU owner do tenant alvo.
  if (!req.user.isMaster) {
    const m = await req.db.query(
      'SELECT role FROM tenant_members WHERE tenant_id = $1 AND user_id = $2',
      [tenantId, req.user.sub]
    );
    if (!m.rows.length || normalizeRole(m.rows[0].role) !== 'owner') {
      return res.status(403).json({ ok: false, message: 'Apenas Master ou Admin Master do tenant.' });
    }
  }

  const results = [];

  try {
    // 1. CREATE TABLE no tenant DB (idempotente).
    await req.tenantDb.query(`
      CREATE TABLE IF NOT EXISTS tenant_state (
        tenant_id INT PRIMARY KEY,
        state_json JSONB NOT NULL,
        last_writer_user_id INT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    results.push('tenant_state table ✓');

    // 2. Verifica se já tem row pro tenant_id (idempotência).
    const existing = await req.tenantDb.query(
      'SELECT updated_at FROM tenant_state WHERE tenant_id = $1',
      [tenantId]
    );
    if (existing.rows.length) {
      results.push(`tenant_state já tem row pro tenant ${tenantId} (updated_at: ${existing.rows[0].updated_at.toISOString()}) — NOOP`);
      return res.status(200).json({
        ok: true,
        action: 'noop',
        tenantId,
        message: 'Tenant já migrado. Use DELETE manual antes de re-importar.',
        results
      });
    }

    // 3. Pega user_id do owner do tenant no CONTROL PLANE.
    const ownerRow = await req.db.query(
      `SELECT user_id FROM tenant_members WHERE tenant_id = $1 AND LOWER(role) = 'owner' LIMIT 1`,
      [tenantId]
    );
    if (!ownerRow.rows.length) {
      results.push('Tenant sem owner em tenant_members. Sem fonte pra importar.');
      return res.status(404).json({ ok: false, message: 'Tenant sem owner registrado.', results });
    }
    const ownerUserId = ownerRow.rows[0].user_id;
    results.push(`Owner do tenant: user_id ${ownerUserId}`);

    // 4. Lê journey_state do owner no TENANT DB.
    const ownerState = await req.tenantDb.query(
      'SELECT state_json, updated_at FROM journey_state WHERE user_id = $1',
      [ownerUserId]
    );
    if (!ownerState.rows.length) {
      results.push(`Owner não tem state em journey_state (user_id ${ownerUserId}). Nada pra importar.`);
      return res.status(200).json({
        ok: true,
        action: 'no_source_state',
        tenantId,
        message: 'Owner sem state — nenhum dado pra migrar. Próximo POST cria tenant_state direto.',
        results
      });
    }

    // 5. Importa pro tenant_state.
    await req.tenantDb.query(
      `INSERT INTO tenant_state (tenant_id, state_json, last_writer_user_id, updated_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id) DO NOTHING`,
      [tenantId, ownerState.rows[0].state_json, ownerUserId, ownerState.rows[0].updated_at]
    );
    results.push(`State do owner importado pra tenant_state ✓`);

    return res.status(200).json({
      ok: true,
      action: 'imported',
      tenantId,
      ownerUserId,
      sourceUpdatedAt: ownerState.rows[0].updated_at,
      message: 'State migrado pra tenant_state. Owner e todos os membros do tenant agora compartilham.',
      results
    });
  } catch (err) {
    console.error('[admin-migrate-tenant-state]', err);
    return res.status(500).json({ ok: false, message: err.message, results });
  }
};
