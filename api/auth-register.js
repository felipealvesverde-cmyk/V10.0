// V23.0.0 — POST /api/auth-register
// Body: { username, email?, modeRequested: 'production' | 'sandbox' }
// Cria usuário com is_approved=false. Master aprova depois via painel.
// Sem password (não-master nunca tem senha).
module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });

  const username = String(req.body?.username || '').trim().toLowerCase();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const modeRequested = ['production', 'sandbox'].includes(req.body?.modeRequested)
    ? req.body.modeRequested
    : 'sandbox';

  if (!username) return res.status(400).json({ ok: false, message: 'Username obrigatório.' });
  if (username.length < 3) return res.status(400).json({ ok: false, message: 'Username muito curto (mínimo 3 chars).' });
  if (username.length > 64) return res.status(400).json({ ok: false, message: 'Username muito longo.' });

  try {
    const existing = await req.db.query('SELECT id, is_approved FROM users WHERE LOWER(username) = $1', [username]);
    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      if (row.is_approved) return res.status(409).json({ ok: false, message: 'Username já está em uso por usuário ativo.' });
      return res.status(409).json({ ok: false, message: 'Usuário já cadastrado e aguardando aprovação.' });
    }

    await req.db.query(
      `INSERT INTO users (username, email, mode, is_approved, is_master)
       VALUES ($1, $2, $3, FALSE, FALSE)`,
      [username, email || null, modeRequested]
    );

    return res.status(201).json({
      ok: true,
      message: 'Cadastro recebido. Aguarde aprovação do administrador. Você receberá acesso assim que o master aprovar.'
    });
  } catch (err) {
    console.error('[auth-register]', err);
    return res.status(500).json({ ok: false, message: err.message || 'Erro interno.' });
  }
};
