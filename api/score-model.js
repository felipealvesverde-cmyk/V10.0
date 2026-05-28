// V34.9.10 — Toggle do modelo ativo de scoring por user.
//
// GET → { active_score_model } (lê de users.active_score_model — master DB)
// POST → { model: 'rfv' | 'criteria' | 'hybrid' } seta o modelo
//
// Permissão: master only pra escrita (modelo afeta cálculo de score do tenant inteiro).

const ALLOWED_MODELS = ['rfv', 'criteria', 'hybrid'];

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Master DB não configurado.' });

  const myId = Number(req.user.sub || req.user.id);
  const scopeUserId = req.user.isMaster && req.body?.user_id
    ? Number(req.body.user_id)
    : myId;

  try {
    if (req.method === 'GET') {
      const r = await req.db.query(
        `SELECT active_score_model FROM users WHERE id = $1`,
        [scopeUserId]
      );
      const model = r.rows[0]?.active_score_model || 'rfv';
      return res.status(200).json({ ok: true, model });
    }

    if (req.method === 'POST') {
      // V34.9.10.3 — Qualquer user autenticado pode mudar próprio modelo.
      // Master pode passar user_id pra setar modelo de outro user.
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
      const model = String(body?.model || '').toLowerCase();
      if (!ALLOWED_MODELS.includes(model)) {
        return res.status(400).json({ ok: false, message: `model deve ser ${ALLOWED_MODELS.join('|')}.` });
      }
      // Cliente comum sempre opera no próprio escopo
      const userIdParam = req.user.isMaster && body?.user_id ? Number(body.user_id) : myId;
      await req.db.query(
        `UPDATE users SET active_score_model = $2 WHERE id = $1`,
        [userIdParam, model]
      );
      return res.status(200).json({ ok: true, model, userId: userIdParam });
    }

    return res.status(405).json({ ok: false, message: 'Use GET ou POST.' });
  } catch (err) {
    console.error('[score-model]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
