// V32.0.12 — POST /api/tenants-plug-db (master only)
// Body: { tenant_id, connection_string }
// Encrypta a connection string com ENCRYPTION_KEY e salva em tenants.db_connection_string_enc.
// Limpa o cache do tenant-pool pra próxima request criar pool novo.
//
// NÃO testa a connection string antes de salvar — confiamos que o master sabe o que tá fazendo.
// V32.0.13 vai adicionar smoke test pra plugagem (rodar SELECT 1 antes de gravar).
const { encrypt, isConfigured: isEncryptionReady } = require('../lib/clickup-crypto');
const tenantPoolHelper = require('../lib/tenant-pool');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.user.isMaster) return res.status(403).json({ ok: false, message: 'Apenas master pode plugar DBs.' });
  if (!isEncryptionReady()) return res.status(503).json({ ok: false, message: 'ENCRYPTION_KEY não configurada no servidor.' });

  const tenantId = Number(req.body?.tenant_id);
  const connStr = String(req.body?.connection_string || '').trim();
  if (!tenantId) return res.status(400).json({ ok: false, message: 'tenant_id obrigatório.' });
  if (!connStr) return res.status(400).json({ ok: false, message: 'connection_string obrigatória.' });
  if (!connStr.startsWith('postgres://') && !connStr.startsWith('postgresql://')) {
    return res.status(400).json({ ok: false, message: 'connection_string precisa começar com postgres:// ou postgresql://' });
  }

  try {
    const exists = await req.db.query('SELECT id, slug FROM tenants WHERE id = $1', [tenantId]);
    if (!exists.rows.length) return res.status(404).json({ ok: false, message: 'Tenant não encontrado.' });

    const enc = encrypt(connStr);
    await req.db.query(
      `UPDATE tenants
       SET db_connection_string_enc = $1,
           migrated_at = COALESCE(migrated_at, NOW()),
           updated_at = NOW()
       WHERE id = $2`,
      [enc, tenantId]
    );

    // Invalida cache de tenant + pool pra próxima request criar pool novo.
    tenantPoolHelper.invalidateTenantCache(tenantId);
    await tenantPoolHelper.closeTenantPool(tenantId);

    return res.status(200).json({
      ok: true,
      tenant_id: tenantId,
      slug: exists.rows[0].slug,
      message: `DB plugado pro tenant ${exists.rows[0].slug}. Próximas requests do tenant vão pro DB novo.`
    });
  } catch (err) {
    console.error('[tenants-plug-db]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
