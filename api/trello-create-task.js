// V32.0.16 — POST /api/trello-create-task
// Cria card no Trello usando credenciais criptografadas (execution_credentials).
// Padrão idêntico ao /api/clickup-create-task — token nunca toca o browser.
//
// Body: { name, description?, due_date? }
//   list_id implícito vem das credenciais (fields.listTodo).
//
// Retorna: { ok, providerTaskId, externalUrl }
const { getCredentials, markError, markTested } = require('../lib/execution-credentials');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });

  const { name, description, due_date } = req.body || {};
  if (!name) return res.status(400).json({ ok: false, message: 'name obrigatório.' });

  let cred;
  try {
    cred = await getCredentials(req.tenantDb, req.user.sub, 'trello');
  } catch (err) {
    if (err.message?.includes('não conectado')) {
      return res.status(404).json({ ok: false, message: 'Trello não conectado. Conecte em Configurações → Execução Operacional.' });
    }
    if (err.message?.includes('ENCRYPTION_KEY')) {
      return res.status(503).json({ ok: false, message: 'ENCRYPTION_KEY não configurada no servidor.' });
    }
    return res.status(500).json({ ok: false, message: err.message });
  }

  const { apiKey, token, listTodo } = cred.fields;
  if (!apiKey || !token || !listTodo) {
    return res.status(400).json({
      ok: false,
      message: 'Credenciais Trello incompletas — apiKey + token + listTodo obrigatórios.'
    });
  }

  try {
    const params = new URLSearchParams({
      key: apiKey,
      token: token,
      idList: listTodo,
      name: String(name).slice(0, 16384),
      desc: String(description || '').slice(0, 16384)
    });
    if (due_date) {
      try { params.set('due', new Date(due_date).toISOString()); } catch (_) {}
    }

    const trelloRes = await fetch(`https://api.trello.com/1/cards?${params.toString()}`, { method: 'POST' });
    const data = await trelloRes.json().catch(() => ({}));

    if (!trelloRes.ok) {
      const errMsg = `Trello ${trelloRes.status}: ${data?.message || data?.error || JSON.stringify(data).slice(0, 200)}`;
      await markError(req.tenantDb, req.user.sub, 'trello', errMsg).catch(() => {});
      return res.status(502).json({ ok: false, message: `Trello recusou (${trelloRes.status}).`, details: data });
    }

    await markTested(req.tenantDb, req.user.sub, 'trello').catch(() => {});
    return res.status(200).json({
      ok: true,
      providerTaskId: data.id || null,
      externalUrl: data.url || data.shortUrl || null
    });
  } catch (err) {
    console.error('[trello-create-task]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
