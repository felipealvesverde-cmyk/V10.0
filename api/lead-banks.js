// V34.0.0 — V34.2.b: CRUD de bancos de leads. Privado (JWT).
//
// GET    /api/lead-banks                  → lista bancos do user
// POST   /api/lead-banks                  → cria banco { name, description?, is_default? }
// PATCH  /api/lead-banks?id=X             → atualiza { name?, description?, is_default? }
// DELETE /api/lead-banks?id=X             → remove banco (set bank_id=NULL nos visitors)
//
// Decisão arquitetural [[v34-leads-banco-tagueamento]]:
// - Banco vive solto no tenant (não vinculado a produto)
// - Só 1 banco default por user (constraint partial unique no DB)
// - slug é normalizado pra virar tag lj-banco-{slug}

// Slugifica nome de banco pra usar em tag/URL.
// "Banco Pinacolada V2 / 2026" → "pinacolada-v2-2026"
function slugify(name) {
  return String(name || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // remove acentos
    .toLowerCase()
    .replace(/^banco\s+/i, '')                          // "Banco Pinacolada" → "pinacolada"
    .replace(/[^a-z0-9]+/g, '-')                        // qualquer não-alfanum vira hífen
    .replace(/^-+|-+$/g, '')                            // tira hífen das pontas
    .replace(/-{2,}/g, '-')                             // colapsa múltiplos hífens
    .slice(0, 100);                                     // cap em 100 chars
}

module.exports = async function handler(req, res) {
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });

  const userId = req.user.sub;

  // GET — lista todos os bancos do user
  if (req.method === 'GET') {
    try {
      const r = await req.tenantDb.query(
        `SELECT id, name, slug, description, is_default, visitor_count, created_at, updated_at
         FROM lj_lead_banks WHERE user_id = $1
         ORDER BY is_default DESC, name ASC`,
        [userId]
      );
      return res.status(200).json({ ok: true, banks: r.rows });
    } catch (err) {
      console.error('[lead-banks GET]', err);
      return res.status(500).json({ ok: false, message: err?.message || 'Erro interno.' });
    }
  }

  // POST — cria banco
  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) { body = {}; }
    }
    const name = String(body?.name || '').trim();
    const description = String(body?.description || '').trim() || null;
    const isDefault = Boolean(body?.is_default);
    if (!name) return res.status(400).json({ ok: false, message: 'Nome do banco obrigatório.' });

    const slug = slugify(name);
    if (!slug) return res.status(400).json({ ok: false, message: 'Nome inválido — não conseguiu gerar slug.' });

    try {
      // Se is_default=true, primeiro desmarca todos os outros (constraint partial)
      if (isDefault) {
        await req.tenantDb.query(
          `UPDATE lj_lead_banks SET is_default = FALSE, updated_at = NOW() WHERE user_id = $1 AND is_default = TRUE`,
          [userId]
        );
      }
      const ins = await req.tenantDb.query(
        `INSERT INTO lj_lead_banks (user_id, name, slug, description, is_default)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, slug, description, is_default, visitor_count, created_at, updated_at`,
        [userId, name, slug, description, isDefault]
      );
      return res.status(200).json({ ok: true, bank: ins.rows[0], message: 'Banco criado.' });
    } catch (err) {
      // Conflito de nome OU slug
      if (err.code === '23505') {
        return res.status(409).json({ ok: false, message: 'Já existe um banco com esse nome ou slug.' });
      }
      console.error('[lead-banks POST]', err);
      return res.status(500).json({ ok: false, message: err?.message || 'Erro interno.' });
    }
  }

  // PATCH — atualiza banco existente
  if (req.method === 'PATCH') {
    const bankId = Number(req.query?.id || 0);
    if (!bankId) return res.status(400).json({ ok: false, message: 'id obrigatório.' });

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) { body = {}; }
    }

    // Construir SET dinamicamente com campos enviados
    const updates = [];
    const values = [userId, bankId];
    let i = 3;
    if (typeof body?.name === 'string' && body.name.trim()) {
      const newName = body.name.trim();
      const newSlug = slugify(newName);
      if (!newSlug) return res.status(400).json({ ok: false, message: 'Nome inválido.' });
      updates.push(`name = $${i++}`);
      values.push(newName);
      updates.push(`slug = $${i++}`);
      values.push(newSlug);
    }
    if (typeof body?.description === 'string') {
      updates.push(`description = $${i++}`);
      values.push(body.description.trim() || null);
    }
    if (typeof body?.is_default === 'boolean') {
      // Se virou default=true, desmarca os outros
      if (body.is_default) {
        await req.tenantDb.query(
          `UPDATE lj_lead_banks SET is_default = FALSE, updated_at = NOW() WHERE user_id = $1 AND is_default = TRUE AND id != $2`,
          [userId, bankId]
        );
      }
      updates.push(`is_default = $${i++}`);
      values.push(body.is_default);
    }
    if (updates.length === 0) return res.status(400).json({ ok: false, message: 'Nada pra atualizar.' });
    updates.push(`updated_at = NOW()`);

    try {
      const upd = await req.tenantDb.query(
        `UPDATE lj_lead_banks SET ${updates.join(', ')}
         WHERE user_id = $1 AND id = $2
         RETURNING id, name, slug, description, is_default, visitor_count, created_at, updated_at`,
        values
      );
      if (upd.rows.length === 0) return res.status(404).json({ ok: false, message: 'Banco não encontrado.' });
      return res.status(200).json({ ok: true, bank: upd.rows[0], message: 'Banco atualizado.' });
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ ok: false, message: 'Já existe um banco com esse nome ou slug.' });
      }
      console.error('[lead-banks PATCH]', err);
      return res.status(500).json({ ok: false, message: err?.message || 'Erro interno.' });
    }
  }

  // DELETE — remove banco. Visitors do banco ficam com bank_id=NULL (não são deletados).
  if (req.method === 'DELETE') {
    const bankId = Number(req.query?.id || 0);
    if (!bankId) return res.status(400).json({ ok: false, message: 'id obrigatório.' });

    try {
      // Desvincula visitors antes de apagar banco
      await req.tenantDb.query(
        `UPDATE lj_visitors SET bank_id = NULL, updated_at = NOW() WHERE user_id = $1 AND bank_id = $2`,
        [userId, bankId]
      );
      const del = await req.tenantDb.query(
        `DELETE FROM lj_lead_banks WHERE user_id = $1 AND id = $2 RETURNING name`,
        [userId, bankId]
      );
      if (del.rows.length === 0) return res.status(404).json({ ok: false, message: 'Banco não encontrado.' });
      return res.status(200).json({ ok: true, message: `Banco "${del.rows[0].name}" removido. Visitors mantidos sem banco.` });
    } catch (err) {
      console.error('[lead-banks DELETE]', err);
      return res.status(500).json({ ok: false, message: err?.message || 'Erro interno.' });
    }
  }

  return res.status(405).json({ ok: false, message: 'Use GET, POST, PATCH ou DELETE.' });
};
