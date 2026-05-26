// V34.0.0 — V34.6.a: Detecta visitors duplicados pelo critério "merge with
// certainty" cravado em [[v34-leads-banco-tagueamento]]:
//   - Email EXATO (case-insensitive trim) → duplicate group
//   - Phone EXATO (normalizado E.164/digits-only) → duplicate group
//
// NÃO faz merge automático aqui. Só retorna a lista pro frontend revisar e
// disparar cada merge via /api/visitors-merge.
//
// GET /api/visitors-find-duplicates
// Resposta:
//   {
//     ok,
//     emailGroups: [{ key: 'foo@bar.com', visitors: [...] }, ...],
//     phoneGroups: [{ key: '5511999999999', visitors: [...] }, ...]
//   }
//
// Cada visitor no array vem com: lj_visitor_id, email, phone, name, bank_id,
// bank_name, global_score, first_seen_at, last_seen_at, current_stage,
// external_rd_deal_id, tagCount.

module.exports = async function handler(req, res) {
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });

  const userId = req.user.sub;

  try {
    // Grupos por email (case-insensitive trim)
    const emailDupQuery = `
      WITH grouped AS (
        SELECT LOWER(TRIM(email)) AS key, COUNT(*) AS c
          FROM lj_visitors
          WHERE user_id = $1 AND email IS NOT NULL AND email <> ''
          GROUP BY LOWER(TRIM(email))
          HAVING COUNT(*) > 1
      )
      SELECT
        v.lj_visitor_id, v.email, v.phone, v.name, v.bank_id,
        v.entity_type, v.current_stage, v.global_score,
        v.first_seen_at, v.last_seen_at,
        v.external_rd_contact_id, v.external_rd_deal_id,
        b.name AS bank_name,
        LOWER(TRIM(v.email)) AS group_key,
        (SELECT COUNT(*) FROM lj_visitor_tags t WHERE t.user_id = v.user_id AND t.lj_visitor_id = v.lj_visitor_id) AS tag_count
      FROM lj_visitors v
      LEFT JOIN lj_lead_banks b ON b.id = v.bank_id AND b.user_id = v.user_id
      WHERE v.user_id = $1
        AND LOWER(TRIM(v.email)) IN (SELECT key FROM grouped)
      ORDER BY group_key, v.first_seen_at ASC NULLS LAST
    `;
    const emailRes = await req.tenantDb.query(emailDupQuery, [userId]);

    // Grupos por phone (digits only)
    const phoneDupQuery = `
      WITH grouped AS (
        SELECT REGEXP_REPLACE(phone, '\\D', '', 'g') AS key, COUNT(*) AS c
          FROM lj_visitors
          WHERE user_id = $1 AND phone IS NOT NULL AND phone <> ''
          GROUP BY REGEXP_REPLACE(phone, '\\D', '', 'g')
          HAVING COUNT(*) > 1 AND LENGTH(REGEXP_REPLACE(phone, '\\D', '', 'g')) >= 8
      )
      SELECT
        v.lj_visitor_id, v.email, v.phone, v.name, v.bank_id,
        v.entity_type, v.current_stage, v.global_score,
        v.first_seen_at, v.last_seen_at,
        v.external_rd_contact_id, v.external_rd_deal_id,
        b.name AS bank_name,
        REGEXP_REPLACE(v.phone, '\\D', '', 'g') AS group_key,
        (SELECT COUNT(*) FROM lj_visitor_tags t WHERE t.user_id = v.user_id AND t.lj_visitor_id = v.lj_visitor_id) AS tag_count
      FROM lj_visitors v
      LEFT JOIN lj_lead_banks b ON b.id = v.bank_id AND b.user_id = v.user_id
      WHERE v.user_id = $1
        AND REGEXP_REPLACE(v.phone, '\\D', '', 'g') IN (SELECT key FROM grouped)
      ORDER BY group_key, v.first_seen_at ASC NULLS LAST
    `;
    const phoneRes = await req.tenantDb.query(phoneDupQuery, [userId]);

    // Agrupa em arrays por key
    function groupByKey(rows) {
      const map = new Map();
      for (const r of rows) {
        const k = r.group_key;
        if (!map.has(k)) map.set(k, []);
        const { group_key, ...rest } = r;
        map.get(k).push({ ...rest, tag_count: Number(rest.tag_count || 0) });
      }
      return [...map.entries()].map(([key, visitors]) => ({ key, visitors }));
    }

    return res.status(200).json({
      ok: true,
      emailGroups: groupByKey(emailRes.rows),
      phoneGroups: groupByKey(phoneRes.rows)
    });
  } catch (err) {
    console.error('[visitors-find-duplicates]', err);
    return res.status(500).json({ ok: false, message: err?.message || 'Erro interno.' });
  }
};
