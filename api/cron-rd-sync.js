// V34.7.h.8 — Cron RD sync (processava backlog de pending-contact-update).
// V35.11.2 — 🚫 DESATIVADO. Felipe optou por webhook-only na V35.11.
//
// Mesmo padrão de cron-rd-pull: endpoint mantido pra não quebrar agendadores
// externos eventualmente apontados aqui. Bate, recebe 200 OK, não custa nada.
//
// O código original (batch de pending-contact-update) está preservado em
// git log api/cron-rd-sync.js (último commit antes da V35.11.2).

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  return res.status(200).json({
    ok: true,
    disabled: true,
    since: 'V35.11.2',
    message: 'cron-rd-sync desativado. Atualizações RD chegam via webhook. Desligue o agendador externo apontando aqui pra economizar requests.'
  });
};
