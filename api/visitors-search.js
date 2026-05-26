// V34.0.0 — V34.4.a: Busca visitors do tenant filtrados por banco(s).
//
// Endpoint consumido pelo Buscador de Perfil (Leads → Buscador). Cliente
// abre modal "De qual(is) banco(s) quer buscar?", marca N bancos (ou Todos),
// confirma, e o front chama este endpoint. Resultado é normalizado pra
// formato Lead-like e o ProfileFinder roda em cima.
//
// POST /api/visitors-search
// Body: {
//   bank_ids: [1, 2, 3] | null,  // null OR omitido = todos os bancos do tenant (sem filtro)
//   limit: 1000                  // opcional, default 1000, max 5000
// }
//
// Resposta:
//   { ok, visitors: [{ ...visitor + tags: [string] }], total, bankIds }
//
// Cada visitor retornado inclui:
//   - colunas de lj_visitors (id, lj_visitor_id, entity_type, current_stage,
//     email, phone, name, bank_id, global_score, idade, estado, cidade, etc)
//   - tags: array de strings (do JOIN com lj_visitor_tags)
//   - bankName: nome do banco (resolvido via JOIN com lj_lead_banks)

module.exports = async function handler(req, res) {
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });

  const userId = req.user.sub;

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { body = {}; }
  }
  body = body || {};

  const bankIds = Array.isArray(body.bank_ids) ? body.bank_ids.map(Number).filter(n => n > 0) : null;
  const limit = Math.min(Number(body.limit) || 1000, 5000);

  try {
    const params = [userId];
    let bankFilterSql = '';
    if (bankIds && bankIds.length) {
      bankFilterSql = `AND v.bank_id = ANY($${params.length + 1}::int[])`;
      params.push(bankIds);
    }

    const sql = `
      SELECT
        v.id, v.lj_visitor_id, v.entity_type, v.current_stage,
        v.email, v.phone, v.name, v.bank_id,
        v.global_score,
        v.first_seen_at, v.last_seen_at, v.promoted_to_lead_at,
        v.total_value_cents,
        b.name AS bank_name, b.slug AS bank_slug,
        COALESCE(
          (SELECT array_agg(t.tag ORDER BY t.created_at)
           FROM lj_visitor_tags t
           WHERE t.user_id = v.user_id AND t.lj_visitor_id = v.lj_visitor_id),
          ARRAY[]::varchar[]
        ) AS tags
      FROM lj_visitors v
      LEFT JOIN lj_lead_banks b ON b.id = v.bank_id AND b.user_id = v.user_id
      WHERE v.user_id = $1
        ${bankFilterSql}
      ORDER BY v.last_seen_at DESC NULLS LAST
      LIMIT $${params.length + 1}
    `;
    params.push(limit);

    const r = await req.tenantDb.query(sql, params);

    return res.status(200).json({
      ok: true,
      visitors: r.rows,
      total: r.rows.length,
      bankIds: bankIds || null
    });
  } catch (err) {
    console.error('[visitors-search]', err);
    return res.status(500).json({ ok: false, message: err?.message || 'Erro interno.' });
  }
};
