// V34.7.h — AI key resolver. Decide qual chave Anthropic usar pra um user.
//
// Hierarquia:
//   1. Master sempre usa process.env.ANTHROPIC_API_KEY (saldo LJ).
//   2. Cliente com users.master_ai_enabled=true → também usa ANTHROPIC_API_KEY.
//      (master liberou o saldo do LJ pra esse user específico)
//   3. Cliente com chave própria em user_ai_credentials → usa a dele (decrypt).
//   4. Senão → null. Caller decide o status code (502 / 402 / msg).
//
// Importante: NUNCA logar a chave em texto puro. Logue só { source, present }.

const { decrypt } = require('./clickup-crypto');
const { checkAcceptance, AI_TERMS_CURRENT_VERSION } = require('./ai-terms');

async function resolveAnthropicKey(masterDb, userInfo) {
  // userInfo: { id (numeric), isMaster (bool) } — vindo do JWT/middleware.
  if (!userInfo || !userInfo.id) {
    return { ok: false, source: null, message: 'Sem userInfo.' };
  }

  // Master: usa env direto. Nunca cai pra tabela user_ai_credentials.
  if (userInfo.isMaster) {
    const key = process.env.ANTHROPIC_API_KEY || '';
    if (!key) return { ok: false, source: 'master', message: 'ANTHROPIC_API_KEY não configurada no Railway.' };
    return { ok: true, source: 'master', apiKey: key, provider: 'anthropic' };
  }

  // Cliente: lê users.master_ai_enabled (control plane = masterDb)
  let masterEnabled = false;
  try {
    const r = await masterDb.query('SELECT master_ai_enabled FROM users WHERE id = $1', [userInfo.id]);
    masterEnabled = Boolean(r.rows[0]?.master_ai_enabled);
  } catch (err) {
    console.warn('[ai-resolver] master_ai_enabled lookup falhou:', err.message);
  }

  if (masterEnabled) {
    const key = process.env.ANTHROPIC_API_KEY || '';
    if (!key) return { ok: false, source: 'master-shared', message: 'Master habilitou IA mas ANTHROPIC_API_KEY não configurada.' };
    return { ok: true, source: 'master-shared', apiKey: key, provider: 'anthropic' };
  }

  // Tenta a chave própria do user (user_ai_credentials)
  try {
    const r = await masterDb.query(
      'SELECT provider, api_key_enc FROM user_ai_credentials WHERE user_id = $1',
      [userInfo.id]
    );
    if (r.rows[0]?.api_key_enc) {
      // V36.1.0 — Gate de termos: source='user' exige aceite da versão atual.
      // Master + master-shared NÃO precisam (cobertos pelo termo do admin).
      const acceptance = await checkAcceptance(masterDb, userInfo.id);
      if (!acceptance.accepted) {
        return {
          ok: false,
          source: 'user',
          requiresTermsAcceptance: true,
          requiredVersion: AI_TERMS_CURRENT_VERSION,
          message: 'Aceite os Termos de Uso de IA em Configurações → IA antes de usar sua chave Anthropic.'
        };
      }
      const decrypted = decrypt(r.rows[0].api_key_enc);
      return {
        ok: true,
        source: 'user',
        apiKey: decrypted,
        provider: r.rows[0].provider || 'anthropic'
      };
    }
  } catch (err) {
    console.warn('[ai-resolver] user_ai_credentials lookup falhou:', err.message);
  }

  return {
    ok: false,
    source: null,
    message: 'IA não configurada. Configure em Configurações → IA ou peça liberação ao admin.'
  };
}

// Helper rápido pra checar disponibilidade sem retornar a chave (usado pela UI
// pra habilitar/desabilitar botões antes do clique).
async function checkAvailability(masterDb, userInfo) {
  const r = await resolveAnthropicKey(masterDb, userInfo);
  return {
    available: r.ok,
    source: r.source,
    message: r.message || null
  };
}

module.exports = { resolveAnthropicKey, checkAvailability };
