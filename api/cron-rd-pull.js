// V34.8.0 — Cron bidirecional RD ↔ LJ.
// V35.11.2 — 🚫 DESATIVADO. Felipe optou por webhook-only na V35.11.
//
// Endpoint mantido pra não quebrar agendadores externos que possam estar
// apontando aqui (Railway cron, cron-job.org, GitHub Actions, etc) — bate
// no endpoint e recebe 200 OK + mensagem informativa. Custo zero: não
// resolve tenant, não consome API RD, não toca DB.
//
// O código original (pull bidirecional + reconciliação) está preservado em
// git log api/cron-rd-pull.js (último commit antes da V35.11.2).
//
// Pra reativar: substituir o handler abaixo pelo da versão antiga.

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  return res.status(200).json({
    ok: true,
    disabled: true,
    since: 'V35.11.2',
    message: 'cron-rd-pull desativado. Atualizações RD chegam via webhook. Desligue o agendador externo apontando aqui pra economizar requests.'
  });
};
