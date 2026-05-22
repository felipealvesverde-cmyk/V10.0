// V32.1.4-1.6 — POST /api/clickup-update-settings
// Endpoint genérico pra atualizar settings da integração ClickUp do user.
// Substitui ter 1 endpoint por setting (cleaner pra UI que faz batch save).
//
// Body (todos campos opcionais):
//   {
//     lj_tag_name?: string|null,       // V32.1.4 — tag automática (null = desativa)
//     task_prefix?: string|null,       // V32.1.4 — prefixo no nome (null = sem prefixo)
//     status_map_json?: object|null,   // V32.1.5 — { pending, in_progress, completed }
//     write_enabled?: boolean          // V32.1.6 — toggle read-only
//   }
//
// Apenas campos enviados são atualizados (PATCH-style — undefined preserva valor antigo).
// String vazia em lj_tag_name/task_prefix vira NULL (limpa).
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });

  const userId = req.user.sub;
  const body = req.body || {};

  // Builda SET dinamicamente baseado em campos enviados
  const sets = [];
  const params = [];
  let paramIdx = 1;

  if (body.lj_tag_name !== undefined) {
    const v = body.lj_tag_name === null || body.lj_tag_name === ''
      ? null
      : String(body.lj_tag_name).trim().slice(0, 64);
    sets.push(`lj_tag_name = $${paramIdx++}`);
    params.push(v);
  }
  if (body.task_prefix !== undefined) {
    const v = body.task_prefix === null || body.task_prefix === ''
      ? null
      : String(body.task_prefix).slice(0, 32);
    sets.push(`task_prefix = $${paramIdx++}`);
    params.push(v);
  }
  if (body.status_map_json !== undefined) {
    const v = body.status_map_json === null
      ? null
      : (typeof body.status_map_json === 'object' ? JSON.stringify(body.status_map_json) : String(body.status_map_json));
    sets.push(`status_map_json = $${paramIdx++}`);
    params.push(v);
  }
  if (body.write_enabled !== undefined) {
    sets.push(`write_enabled = $${paramIdx++}`);
    params.push(Boolean(body.write_enabled));
  }
  // V32.2.0 — Toggle opt-out do modo espelhado (default TRUE — modelo padrão).
  if (body.mirror_enabled !== undefined) {
    sets.push(`mirror_enabled = $${paramIdx++}`);
    params.push(Boolean(body.mirror_enabled));
  }

  if (!sets.length) {
    return res.status(400).json({ ok: false, message: 'Nenhum campo enviado pra atualizar.' });
  }

  try {
    params.push(userId);
    const result = await req.tenantDb.query(
      `UPDATE clickup_credentials SET ${sets.join(', ')} WHERE user_id = $${paramIdx} RETURNING lj_tag_name, task_prefix, status_map_json, write_enabled`,
      params
    );
    if (!result.rows.length) return res.status(404).json({ ok: false, message: 'ClickUp não conectado.' });

    return res.status(200).json({
      ok: true,
      settings: {
        ljTagName: result.rows[0].lj_tag_name,
        taskPrefix: result.rows[0].task_prefix,
        statusMap: result.rows[0].status_map_json ? JSON.parse(result.rows[0].status_map_json) : null,
        writeEnabled: result.rows[0].write_enabled
      },
      message: 'Settings ClickUp atualizadas.'
    });
  } catch (err) {
    console.error('[clickup-update-settings]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
