// V35.4.0 — Safe Logger com redaction automática.
//
// Substitui console.log/warn/error em pontos sensíveis. Detecta e mascara:
//   - Emails: ana@email.com → a***@email.com
//   - Telefones: 11999999999 → ***99-99**
//   - CPF: 123.456.789-00 → ***.***.***-**
//   - CNPJ: 12.345.678/0001-00 → ***.***.****/****-**
//   - JWT tokens: eyJ... → [JWT_REDACTED]
//   - Connection strings: postgres://user:pass@... → [CONN_REDACTED]
//   - API keys: sk-..., pk-..., Bearer ... → [KEY_REDACTED]
//
// API:
//   slog.info(...args)  — info level + redact
//   slog.warn(...args)  — warn level + redact
//   slog.error(...args) — error level + redact
//   redact(text)        — só redact (string -> string)
//
// Não substitui console.log GLOBAL. Quem importar e usar slog tem proteção;
// quem usa console.log direto continua sem.

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const PHONE_RE = /\b(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?9?\d{4}[-\s]?\d{4}\b/g;
const CPF_RE   = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g;
const CNPJ_RE  = /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g;
const JWT_RE   = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;
const CONN_RE  = /(?:postgres|postgresql|mysql|redis|mongodb):\/\/[^\s'"]+/gi;
const BEARER_RE = /\bBearer\s+[A-Za-z0-9._-]{12,}/g;
const APIKEY_RE = /\b(?:sk|pk)-[A-Za-z0-9-]{12,}/g;
// HOTTOK e similares: 32+ chars hex/base64 que parecem token
const LONGTOKEN_RE = /\b[A-Za-z0-9]{40,}\b/g;

function maskEmail(s) {
  const [user, domain] = s.split('@');
  if (!user || !domain) return s;
  const visible = user.length > 1 ? user[0] : '';
  return `${visible}***@${domain}`;
}
function maskPhone(s) {
  // Mantém últimos 4, mascara o resto
  const digits = s.replace(/\D/g, '');
  if (digits.length < 6) return '***';
  return '***' + digits.slice(-4).replace(/(\d{2})(\d{2})/, '$1-$2');
}

function redact(input) {
  if (input == null) return input;
  let s = typeof input === 'string' ? input : safeStringify(input);
  s = s.replace(EMAIL_RE, maskEmail);
  s = s.replace(CPF_RE, '***.***.***-**');
  s = s.replace(CNPJ_RE, '***.***.****/****-**');
  s = s.replace(JWT_RE, '[JWT_REDACTED]');
  s = s.replace(CONN_RE, '[CONN_REDACTED]');
  s = s.replace(BEARER_RE, 'Bearer [REDACTED]');
  s = s.replace(APIKEY_RE, '[APIKEY_REDACTED]');
  s = s.replace(PHONE_RE, maskPhone);
  // Long tokens por último (pode matchar coisa legítima — só mascara se 50+ chars
  // e não bateu nas regras anteriores)
  s = s.replace(LONGTOKEN_RE, m => m.length >= 50 ? '[LONG_TOKEN_REDACTED]' : m);
  return s;
}

function safeStringify(obj) {
  const seen = new WeakSet();
  try {
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) return '[Circular]';
        seen.add(value);
      }
      return value;
    });
  } catch (_) {
    return String(obj);
  }
}

function makeLog(level) {
  return (...args) => {
    const safe = args.map(a => {
      if (typeof a === 'string') return redact(a);
      if (a instanceof Error) return redact(a.message + '\n' + (a.stack || ''));
      return redact(safeStringify(a));
    });
    const fn = console[level] || console.log;
    fn.apply(console, safe);
  };
}

module.exports = {
  slog: {
    info:  makeLog('info'),
    warn:  makeLog('warn'),
    error: makeLog('error'),
    log:   makeLog('log')
  },
  redact
};
