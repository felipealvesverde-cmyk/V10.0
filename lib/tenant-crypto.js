// V35.4.0 — Tenant-aware crypto.
//
// Substitui clickup-crypto pra criptografar segredos com CHAVE POR TENANT.
// Cada cliente tem uma chave derivada de:
//   ENCRYPTION_KEY (master, env var) + tenant_id (HKDF-SHA256)
//
// Razão: se a chave master vazar, ainda compromete todos. Mas se UMA chave
// derivada vazar, só compromete UM cliente. Reduz blast radius de vazamento.
//
// Backwards compat: dados criptografados com clickup-crypto.encrypt() antes
// desta versão continuam descriptografáveis. tenantDecrypt() tenta primeiro
// com a chave do tenant e, em fallback, com a chave master.
//
// API:
//   tenantEncrypt(tenantId, plaintext) → string base64
//   tenantDecrypt(tenantId, ciphertext) → string plaintext
//   deriveTenantKey(tenantId)           → Buffer (32 bytes)

const crypto = require('crypto');

const ALGO = 'aes-256-gcm';
const HKDF_HASH = 'sha256';
const KEY_LEN = 32;
const HKDF_INFO = Buffer.from('lj-tenant-crypto-v1', 'utf8');

function getMasterKey() {
  const hex = process.env.ENCRYPTION_KEY || '';
  if (!hex || hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY não configurada (precisa 64 hex chars).');
  }
  return Buffer.from(hex, 'hex');
}

// HKDF-SHA256: deriva chave única do tenant a partir da master + tenant_id.
// Determinístico: mesmo (master, tenantId) sempre dá a mesma chave.
function deriveTenantKey(tenantId) {
  if (!tenantId) throw new Error('tenantId obrigatório pra derivar chave.');
  const master = getMasterKey();
  const salt = Buffer.from(`tenant:${tenantId}`, 'utf8');
  // hkdfSync(digest, ikm, salt, info, keylen)
  const derived = crypto.hkdfSync(HKDF_HASH, master, salt, HKDF_INFO, KEY_LEN);
  return Buffer.from(derived);
}

// Encripta com a chave do tenant. Prefixa com marker '1:' pra
// distinguir de dados antigos (clickup-crypto).
function tenantEncrypt(tenantId, plaintext) {
  const key = deriveTenantKey(tenantId);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext || ''), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const blob = Buffer.concat([iv, tag, ciphertext]).toString('base64');
  return '1:' + blob;
}

// Decripta. Se começa com '1:', usa chave do tenant. Senão, fallback pra
// chave master (dados criados antes do V35.4.0).
function tenantDecrypt(tenantId, ciphertext) {
  if (!ciphertext) return '';
  const str = String(ciphertext);
  if (str.startsWith('1:')) {
    return decryptWithKey(deriveTenantKey(tenantId), str.slice(2));
  }
  // Fallback: dados legacy criptografados com chave master
  return decryptWithKey(getMasterKey(), str);
}

function decryptWithKey(key, b64) {
  const buf = Buffer.from(b64, 'base64');
  if (buf.length < 28) throw new Error('Ciphertext inválido.');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

module.exports = {
  tenantEncrypt,
  tenantDecrypt,
  deriveTenantKey
};
