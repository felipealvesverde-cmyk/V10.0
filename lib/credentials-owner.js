// V37.4.34 — Resolve qual user_id detém as credenciais de integração do tenant.
//
// Contexto: as tabelas clickup_credentials, rd_credentials, hotmart_config,
// google_ads_config, ga4_config etc. ainda usam user_id como PK (legado
// pré-multi-tenant V32). Quando há tenant, todas as integrações pertencem
// ao OWNER — todos os membros do mesmo tenant compartilham as mesmas creds.
//
// Antes deste helper: cada membro do tenant via "Não conectado" porque a
// query filtrava pelo SEU user_id (que nunca conectou nada). Bug visível
// após V37.4.29 (state per-tenant), quando o user novo começou a ver as
// entidades do owner mas sem as integrações.
//
// Uso:
//   const { resolveCredentialOwnerId, assertCanWriteCredentials } = require('../lib/credentials-owner');
//
//   // Em GETs (qualquer membro do tenant pode ler):
//   const credUserId = await resolveCredentialOwnerId(req);
//   await req.tenantDb.query('SELECT ... WHERE user_id = $1', [credUserId]);
//
//   // Em POSTs/DELETEs (só owner ou master pode mutar):
//   await assertCanWriteCredentials(req); // joga 403 se não pode
//   const credUserId = await resolveCredentialOwnerId(req);
//   await req.tenantDb.query('INSERT ... user_id = $1', [credUserId]);

class CredentialPermissionError extends Error {
  constructor(message) { super(message); this.statusCode = 403; }
}

async function resolveCredentialOwnerId(req) {
  if (!req.user) throw new Error('Não autenticado.');

  // Master sem tenant ativo → usa o próprio id (caso especial: admin global).
  // Pre-V32 (sem tenantId) → usa o próprio id (compat backward).
  const tenantId = req.user.tenantId;
  if (!tenantId) return req.user.sub;

  // Cache na req pra não pagar query múltipla por endpoint que faz vários SELECTs.
  if (req._credOwnerId) return req._credOwnerId;

  try {
    const r = await req.db.query(
      `SELECT user_id FROM tenant_members WHERE tenant_id = $1 AND LOWER(role) = 'owner' LIMIT 1`,
      [tenantId]
    );
    const ownerId = r.rows[0]?.user_id || req.user.sub;
    req._credOwnerId = ownerId;
    return ownerId;
  } catch (err) {
    console.warn('[credentials-owner] resolve falhou, caindo pro req.user.sub:', err.message);
    return req.user.sub;
  }
}

// Bloqueia 403 se o user não pode mutar credenciais do tenant.
// Master sempre passa. Owner do tenant passa. Qualquer outro (manager/user) bloqueia.
async function assertCanWriteCredentials(req) {
  if (!req.user) throw new CredentialPermissionError('Não autenticado.');
  if (req.user.isMaster) return true;
  const tenantId = req.user.tenantId;
  if (!tenantId) return true; // pré-V32 ou master sem tenant — não há quem mais possa mutar
  const r = await req.db.query(
    'SELECT role FROM tenant_members WHERE tenant_id = $1 AND user_id = $2',
    [tenantId, req.user.sub]
  );
  const role = String(r.rows[0]?.role || '').toLowerCase();
  if (role !== 'owner') {
    throw new CredentialPermissionError('Apenas o Admin Master do tenant pode mudar credenciais de integração.');
  }
  return true;
}

module.exports = {
  resolveCredentialOwnerId,
  assertCanWriteCredentials,
  CredentialPermissionError
};
