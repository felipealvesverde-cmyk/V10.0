// V32.1.3 — POST /api/clickup-set-list
// V32.2.4 (Geraldo A9) — DEPRECATED em modo mirror. Continua existindo só pra
// clientes no modo legado (mirror_enabled=false ou lj_space_id=NULL). Em mirror,
// default_list_id é morto — list é resolvida pela cascada do mirror.
//
// Body: { list_id, space_id, list_name? }
//
// space_id é necessário pra V32.1.4 (criar tag no space). list_name é cache
// exibível na UI sem novo fetch.
const { clickupFetch } = require('../lib/clickup-client');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });

  const userId = req.user.sub;
  const listId = String(req.body?.list_id || '').trim();
  const spaceId = String(req.body?.space_id || '').trim();
  let listName = String(req.body?.list_name || '').trim() || null;

  if (!listId) return res.status(400).json({ ok: false, message: 'list_id obrigatório.' });
  if (!spaceId) return res.status(400).json({ ok: false, message: 'space_id obrigatório (necessário pra tags automáticas em V32.1.4).' });

  try {
    // Se cliente não mandou list_name, busca via API pra cachear
    if (!listName) {
      try {
        const r = await clickupFetch(req.tenantDb, userId, 'GET', `/list/${listId}`);
        if (r.ok && r.data?.name) listName = r.data.name;
      } catch (_) { /* fallback silencioso */ }
    }

    const result = await req.tenantDb.query(
      `UPDATE clickup_credentials
       SET default_list_id = $1, default_space_id = $2, default_list_name = $3
       WHERE user_id = $4
       RETURNING default_list_id, default_space_id, default_list_name`,
      [listId, spaceId, listName, userId]
    );
    if (!result.rows.length) return res.status(404).json({ ok: false, message: 'ClickUp não conectado.' });

    return res.status(200).json({
      ok: true,
      defaultListId: result.rows[0].default_list_id,
      defaultSpaceId: result.rows[0].default_space_id,
      defaultListName: result.rows[0].default_list_name,
      message: `List selecionada: "${result.rows[0].default_list_name || result.rows[0].default_list_id}".`
    });
  } catch (err) {
    console.error('[clickup-set-list]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
