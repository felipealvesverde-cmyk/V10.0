// V30.0.0 — Crypto helper for ClickUp integration (and future integrations).
// AES-256-GCM with key from ENCRYPTION_KEY env var (64 hex chars = 32 bytes).
//
// Setup pelo user:
//   1. Gera chave: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
//   2. Adiciona no Railway: ENCRYPTION_KEY=<chave>
//   3. Reinicia o app.
//
// Se a env var não estiver setada, encrypt() lança erro claro pra debug.
const crypto = require('crypto');

const ALGO = 'aes-256-gcm';

function getKey() {
  const hex = process.env.ENCRYPTION_KEY || '';
  if (!hex || hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY não configurada (precisa 64 hex chars = 32 bytes). Gere com: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))" e adicione no Railway → Variables.');
  }
  return Buffer.from(hex, 'hex');
}

function isConfigured() {
  const hex = process.env.ENCRYPTION_KEY || '';
  return Boolean(hex && hex.length === 64);
}

// Encripta uma string com AES-256-GCM. Retorna base64 (iv + tag + ciphertext).
function encrypt(plaintext) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext || ''), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

function decrypt(b64) {
  const key = getKey();
  const buf = Buffer.from(b64 || '', 'base64');
  if (buf.length < 28) throw new Error('Ciphertext inválido (tamanho).');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt, isConfigured };
