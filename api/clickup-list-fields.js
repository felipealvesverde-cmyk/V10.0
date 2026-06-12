// V32.9.2 (Geraldo A16) — GET /api/clickup-list-fields?list_id=X
// Retorna custom fields configurados numa list do ClickUp, marcando quais
// são obrigatórios. Usado pelo modal de criar task pra pré-checar antes
// do submit (evita HTTP 422 do ClickUp recusando task por field faltando).
//
// Resposta: {
//   ok: true,
//   listId,
//   fields: [
//     { id, name, type, required, options? }
//   ]
// }
//
// Cacheável no frontend por sessão — fields raramente mudam.
const { clickupFetch } = require('../lib/clickup-client');
const { resolveCredentialOwnerId } = require('../lib/credentials-owner');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });

  // V37.4.34 — Credenciais ClickUp vivem na linha do owner do tenant.
  const userId = await resolveCredentialOwnerId(req);
  const listId = String(req.query?.list_id || '').trim();
  if (!listId) return res.status(400).json({ ok: false, message: 'list_id obrigatório.' });

  try {
    const r = await clickupFetch(req.tenantDb, userId, 'GET', `/list/${listId}/field`);
    if (!r.ok) {
      return res.status(502).json({
        ok: false,
        message: `ClickUp recusou (${r.status}). Token sem permissão ou list não existe.`,
        details: r.data
      });
    }
    const raw = Array.isArray(r.data?.fields) ? r.data.fields : [];
    const fields = raw.map(f => ({
      id: String(f.id || ''),
      name: String(f.name || ''),
      type: String(f.type || 'text'),
      required: !!f.required,
      // type_config contém opções pra dropdown, labels, etc.
      options: Array.isArray(f.type_config?.options) ? f.type_config.options.map(o => ({
        id: String(o.id || ''),
        name: String(o.name || ''),
        orderindex: o.orderindex || 0,
        color: o.color || null
      })) : null
    }));
    return res.status(200).json({ ok: true, listId, fields });
  } catch (err) {
    console.error('[clickup-list-fields]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
