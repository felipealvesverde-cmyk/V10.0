// V35.4.0 — Suporte a rotação de JWT_SECRET.
//
// Permite rotacionar JWT_SECRET sem invalidar tokens já em circulação.
//
// Como funciona:
//   - Tokens NOVOS são sempre assinados com JWT_SECRET (atual)
//   - Verificação tenta JWT_SECRET primeiro
//   - Se falhar, tenta JWT_SECRET_PREVIOUS (anterior)
//   - Após X dias (TTL do JWT), removemos JWT_SECRET_PREVIOUS
//
// Processo de rotação (manual no Railway):
//   1. Gerar novo secret: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
//   2. Mover JWT_SECRET atual pra JWT_SECRET_PREVIOUS
//   3. Setar JWT_SECRET com o novo
//   4. App redeploy automático
//   5. Tokens emitidos antes continuam válidos (PREVIOUS)
//   6. Tokens emitidos depois usam o novo (JWT_SECRET)
//   7. Após TTL do token (default 7d) + margem, remover JWT_SECRET_PREVIOUS
//
// Sugestão: rotacionar a cada 90 dias.

const jwt = require('jsonwebtoken');

function getSecrets() {
  const current = process.env.JWT_SECRET || '';
  const previous = process.env.JWT_SECRET_PREVIOUS || '';
  return { current, previous };
}

// Verifica token tentando current primeiro, depois previous.
// Retorna { ok: true, payload, usedPrevious: bool } ou { ok: false, error }.
function verifyWithRotation(token) {
  const { current, previous } = getSecrets();
  if (!current) return { ok: false, error: 'JWT_SECRET ausente' };

  try {
    const payload = jwt.verify(token, current);
    return { ok: true, payload, usedPrevious: false };
  } catch (errA) {
    if (!previous) return { ok: false, error: errA.message };
    try {
      const payload = jwt.verify(token, previous);
      return { ok: true, payload, usedPrevious: true };
    } catch (errB) {
      return { ok: false, error: errB.message };
    }
  }
}

// Assina sempre com o secret atual.
function signWithCurrent(payload, options = {}) {
  const { current } = getSecrets();
  if (!current) throw new Error('JWT_SECRET ausente — não posso assinar.');
  return jwt.sign(payload, current, options);
}

// Helper de diagnóstico (uso interno).
function rotationStatus() {
  const { current, previous } = getSecrets();
  return {
    currentConfigured: Boolean(current),
    currentLength: current.length,
    previousConfigured: Boolean(previous),
    previousLength: previous.length
  };
}

module.exports = { verifyWithRotation, signWithCurrent, rotationStatus };
