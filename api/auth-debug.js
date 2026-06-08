// V36.4.1 — GET /api/auth-debug
//
// Endpoint PÚBLICO (sem JWT exigido) que retorna metadados seguros sobre
// o estado da autenticação do servidor. Usado pra diagnose quando um JWT
// está sendo rejeitado e precisamos entender porque (rotação? secret ausente?).
//
// NÃO expõe valores de secrets. Só metadados (configurado? tamanho? hash curto).
//
// Quando chamado com Authorization: Bearer <token>, também reporta:
//   - Se o token valida com SECRET atual
//   - Se o token valida com SECRET anterior (PREVIOUS)
//   - Payload decodificado (sem verificar — só pra debug)
//
// Permissão: público. Não tem nada sensível na resposta.

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { verifyWithRotation, rotationStatus } = require('../lib/jwt-rotation');

function shortHash(s) {
  if (!s) return null;
  return crypto.createHash('sha256').update(s).digest('hex').slice(0, 12);
}

function decodeWithoutVerify(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return payload;
  } catch (_) { return null; }
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });

  const status = rotationStatus();
  const out = {
    ok: true,
    server_time_iso: new Date().toISOString(),
    server_time_unix: Math.floor(Date.now() / 1000),
    jwt_secret: {
      configured: status.currentConfigured,
      length: status.currentLength,
      sha256_first12: shortHash(process.env.JWT_SECRET || '')
    },
    jwt_secret_previous: {
      configured: status.previousConfigured,
      length: status.previousLength,
      sha256_first12: shortHash(process.env.JWT_SECRET_PREVIOUS || '')
    }
  };

  // Se cliente enviou JWT, testa
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (token) {
    out.token_provided = true;
    out.token_length = token.length;

    // Payload sem verificar
    const payload = decodeWithoutVerify(token);
    out.token_payload_decoded = payload ? {
      sub: payload.sub,
      username: payload.username,
      iat: payload.iat,
      iat_iso: payload.iat ? new Date(payload.iat * 1000).toISOString() : null,
      exp: payload.exp,
      exp_iso: payload.exp ? new Date(payload.exp * 1000).toISOString() : null,
      age_minutes: payload.iat ? ((Date.now() / 1000 - payload.iat) / 60).toFixed(1) : null,
      already_expired: payload.exp ? (payload.exp * 1000 < Date.now()) : null,
      mode: payload.mode,
      tenantId: payload.tenantId
    } : null;

    // Testa verificação com current
    if (process.env.JWT_SECRET) {
      try {
        jwt.verify(token, process.env.JWT_SECRET);
        out.token_valid_with_current = true;
      } catch (err) {
        out.token_valid_with_current = false;
        out.token_current_error = err.message;
      }
    } else {
      out.token_valid_with_current = null;
      out.token_current_error = 'JWT_SECRET não configurada';
    }

    // Testa verificação com previous
    if (process.env.JWT_SECRET_PREVIOUS) {
      try {
        jwt.verify(token, process.env.JWT_SECRET_PREVIOUS);
        out.token_valid_with_previous = true;
      } catch (err) {
        out.token_valid_with_previous = false;
        out.token_previous_error = err.message;
      }
    } else {
      out.token_valid_with_previous = null;
      out.token_previous_error = 'JWT_SECRET_PREVIOUS não configurada';
    }

    // Verifica via helper (igual middleware faz)
    const v = verifyWithRotation(token);
    out.middleware_verify_result = {
      ok: v.ok,
      usedPrevious: v.usedPrevious || false,
      error: v.error || null
    };
  } else {
    out.token_provided = false;
  }

  return res.status(200).json(out);
};
