// V32.0.14 — Helper genérico pra execution_credentials criptografado.
// Substitui o legacy App.state.executionConfig.providers[].apiToken (que vivia
// em journey_state.state_json plaintext).
//
// Padrão: cada provider tem campos sensíveis diferentes (Trello = apiKey+token+board,
// Jira = url+email+apiToken+project, Notion = apiToken+databaseId, etc). Pra
// evitar 1 coluna por field × N providers, guardamos tudo num JSON criptografado
// AES-256-GCM em `fields_enc`. Metadata exibível (account_name, workspace_name,
// default_list_id) vai em `display_meta` (JSONB plain, lido em GET sem decrypt).
//
// Pool é fornecido pelo caller (req.tenantDb por padrão, ou req.db se fallback).
const { encrypt, decrypt, isConfigured: isEncryptionReady } = require('./clickup-crypto');

const VALID_PROVIDERS = new Set(['trello', 'monday', 'jira', 'notion', 'clickup']);

function assertProvider(providerId) {
  if (!VALID_PROVIDERS.has(providerId)) {
    throw new Error(`provider_id inválido: ${providerId}. Use: ${[...VALID_PROVIDERS].join(', ')}`);
  }
}

// Salva ou atualiza credenciais de um provider pro user.
// fields: objeto com campos sensíveis (apiKey, token, etc) — serão criptografados juntos
// displayMeta: objeto com metadata pra UI (account_name, workspace, etc) — não criptografado
async function saveCredentials(db, userId, providerId, fields, displayMeta = {}) {
  assertProvider(providerId);
  if (!isEncryptionReady()) throw new Error('ENCRYPTION_KEY não configurada no servidor.');
  if (!fields || typeof fields !== 'object') throw new Error('fields obrigatório (objeto).');

  const fieldsEnc = encrypt(JSON.stringify(fields));
  await db.query(
    `INSERT INTO execution_credentials
       (user_id, provider_id, fields_enc, display_meta, status, connected_at, updated_at)
     VALUES ($1, $2, $3, $4, 'connected', NOW(), NOW())
     ON CONFLICT (user_id, provider_id) DO UPDATE SET
       fields_enc = $3,
       display_meta = $4,
       status = 'connected',
       last_error = NULL,
       updated_at = NOW()`,
    [userId, providerId, fieldsEnc, displayMeta]
  );
  return { ok: true, providerId };
}

// Retorna credenciais decriptadas pro provider. Throw se não existir.
async function getCredentials(db, userId, providerId) {
  assertProvider(providerId);
  if (!isEncryptionReady()) throw new Error('ENCRYPTION_KEY não configurada no servidor.');

  const r = await db.query(
    'SELECT fields_enc, display_meta, status, last_error, last_tested_at, connected_at FROM execution_credentials WHERE user_id = $1 AND provider_id = $2',
    [userId, providerId]
  );
  if (!r.rows.length) throw new Error(`Provider ${providerId} não conectado.`);
  const row = r.rows[0];
  const fields = JSON.parse(decrypt(row.fields_enc));
  return {
    fields,
    displayMeta: row.display_meta || {},
    status: row.status,
    lastError: row.last_error,
    lastTestedAt: row.last_tested_at,
    connectedAt: row.connected_at
  };
}

// Lista todos os providers conectados (sem decrypt — só metadata exibível).
async function listConnected(db, userId) {
  const r = await db.query(
    `SELECT provider_id, display_meta, status, last_error, last_tested_at, connected_at, updated_at
     FROM execution_credentials WHERE user_id = $1`,
    [userId]
  );
  return r.rows.map(row => ({
    providerId: row.provider_id,
    displayMeta: row.display_meta || {},
    status: row.status,
    lastError: row.last_error,
    lastTestedAt: row.last_tested_at,
    connectedAt: row.connected_at,
    updatedAt: row.updated_at
  }));
}

// Atualiza só metadata exibível (sem mexer nos secrets).
async function updateDisplayMeta(db, userId, providerId, displayMeta) {
  assertProvider(providerId);
  await db.query(
    `UPDATE execution_credentials SET display_meta = $1, updated_at = NOW()
     WHERE user_id = $2 AND provider_id = $3`,
    [displayMeta, userId, providerId]
  );
  return { ok: true };
}

// Marca erro de conexão sem apagar credenciais.
async function markError(db, userId, providerId, errorMessage) {
  assertProvider(providerId);
  await db.query(
    `UPDATE execution_credentials SET status = 'error', last_error = $1, last_tested_at = NOW(), updated_at = NOW()
     WHERE user_id = $2 AND provider_id = $3`,
    [String(errorMessage || '').slice(0, 500), userId, providerId]
  );
}

// Marca sucesso no teste (limpa erro).
async function markTested(db, userId, providerId) {
  assertProvider(providerId);
  await db.query(
    `UPDATE execution_credentials SET status = 'connected', last_error = NULL, last_tested_at = NOW(), updated_at = NOW()
     WHERE user_id = $1 AND provider_id = $2`,
    [userId, providerId]
  );
}

async function deleteCredentials(db, userId, providerId) {
  assertProvider(providerId);
  await db.query('DELETE FROM execution_credentials WHERE user_id = $1 AND provider_id = $2', [userId, providerId]);
  return { ok: true };
}

module.exports = {
  VALID_PROVIDERS,
  saveCredentials,
  getCredentials,
  listConnected,
  updateDisplayMeta,
  markError,
  markTested,
  deleteCredentials
};
