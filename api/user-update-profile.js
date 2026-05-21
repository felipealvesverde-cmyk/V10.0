// V32.1.2 — POST /api/user-update-profile
// Qualquer user (autenticado) edita o PRÓPRIO perfil. Não master-only.
// User só pode mexer em si mesmo (req.user.sub do JWT).
//
// Body: { display_name }
//
// Campos suportados hoje: display_name. Futuro: avatar, timezone, language, etc.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });

  const body = req.body || {};
  const display_name = body.display_name === undefined
    ? undefined
    : String(body.display_name || '').trim().slice(0, 128);

  if (display_name === undefined) {
    return res.status(400).json({ ok: false, message: 'Nenhum campo enviado pra atualizar.' });
  }

  try {
    // String vazia → NULL (limpa o nome customizado, volta pro fallback do email/tenant).
    const value = display_name === '' ? null : display_name;
    const result = await req.db.query(
      'UPDATE users SET display_name = $1 WHERE id = $2 RETURNING id, username, display_name',
      [value, req.user.sub]
    );
    if (!result.rows.length) {
      return res.status(404).json({ ok: false, message: 'User não encontrado.' });
    }
    return res.status(200).json({
      ok: true,
      user: {
        id: result.rows[0].id,
        username: result.rows[0].username,
        displayName: result.rows[0].display_name
      },
      message: value ? `Nome atualizado pra "${value}".` : 'Nome customizado removido (volta pro fallback).'
    });
  } catch (err) {
    console.error('[user-update-profile]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
