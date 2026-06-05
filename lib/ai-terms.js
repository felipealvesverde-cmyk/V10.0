// V36.1.0 — Helper de Termos de Uso da IA.
//
// Versão atual hardcoded aqui. Quando bumpar pra 1.1, cliente vai precisar
// reaceitar (UI compara `users.ai_terms_version` com AI_TERMS_CURRENT_VERSION).
//
// Conteúdo do termo mora em public/ai-terms-v<X>.md — markdown lido aqui.

const fs = require('fs');
const path = require('path');

const AI_TERMS_CURRENT_VERSION = '1.0';

let _cachedMarkdown = null;
function loadTermsMarkdown(version) {
  if (_cachedMarkdown && _cachedMarkdown.version === version) {
    return _cachedMarkdown.content;
  }
  const file = path.join(__dirname, '..', 'public', `ai-terms-v${version}.md`);
  try {
    const content = fs.readFileSync(file, 'utf8');
    _cachedMarkdown = { version, content };
    return content;
  } catch (err) {
    console.warn(`[ai-terms] não consegui ler ${file}:`, err.message);
    return null;
  }
}

// Verifica se o user aceitou a versão atual.
// Retorna { accepted: bool, acceptedAt: Date|null, version: string|null }
async function checkAcceptance(masterDb, userId) {
  if (!masterDb || !userId) return { accepted: false, acceptedAt: null, version: null };
  try {
    const r = await masterDb.query(
      'SELECT ai_terms_accepted_at, ai_terms_version FROM users WHERE id = $1',
      [userId]
    );
    if (!r.rows.length) return { accepted: false, acceptedAt: null, version: null };
    const row = r.rows[0];
    const accepted = Boolean(row.ai_terms_accepted_at) && row.ai_terms_version === AI_TERMS_CURRENT_VERSION;
    return {
      accepted,
      acceptedAt: row.ai_terms_accepted_at || null,
      version: row.ai_terms_version || null
    };
  } catch (err) {
    console.warn('[ai-terms] checkAcceptance falhou:', err.message);
    return { accepted: false, acceptedAt: null, version: null };
  }
}

// Registra o aceite do user na versão atual.
async function recordAcceptance(masterDb, userId) {
  await masterDb.query(
    'UPDATE users SET ai_terms_accepted_at = NOW(), ai_terms_version = $1 WHERE id = $2',
    [AI_TERMS_CURRENT_VERSION, userId]
  );
  return { accepted: true, acceptedAt: new Date(), version: AI_TERMS_CURRENT_VERSION };
}

// Revoga o aceite (cliente clica "revogar" em Settings → IA).
async function revokeAcceptance(masterDb, userId) {
  await masterDb.query(
    'UPDATE users SET ai_terms_accepted_at = NULL, ai_terms_version = NULL WHERE id = $1',
    [userId]
  );
  return { accepted: false, acceptedAt: null, version: null };
}

module.exports = {
  AI_TERMS_CURRENT_VERSION,
  loadTermsMarkdown,
  checkAcceptance,
  recordAcceptance,
  revokeAcceptance
};
