// V15 — Revenue Event Bridge
// Quando uma LP dispara um checkpoint que representa conversão final,
// associa o lead à action.leads para que o engine de receita refleta o
// novo volume. Não duplica: usa identityKey como chave.
window.RevenueEventBridge = {
  recordPassage(action, checkpoint, leadIdentityKey) {
    if (!action || !leadIdentityKey) return { ok: false };
    const isFinal = checkpoint?.moveToStage === action.flow?.endStage || checkpoint?.event === 'form_submitted' || checkpoint?.event === 'checkout_click';
    if (!isFinal) return { ok: true, skipped: true };
    App.state.actions = (App.state.actions || []).map(a => {
      if (Number(a.id) !== Number(action.id)) return a;
      const existingLeads = Array.isArray(a.leads) ? a.leads : [];
      const alreadyIn = existingLeads.some(lead => {
        if (!lead) return false;
        try { return LeadIdentityEngine.identityKey(lead) === leadIdentityKey; } catch (_) { return false; }
      });
      if (alreadyIn) return a;
      const newLead = {
        id: Date.now() + Math.floor(Math.random() * 100),
        identityKey: leadIdentityKey,
        name: 'Lead via LP',
        email: leadIdentityKey.startsWith('email:') ? leadIdentityKey.slice(6) : '',
        phone: leadIdentityKey.startsWith('phone:') ? leadIdentityKey.slice(6) : '',
        tags: 'lp_checkpoint',
        score: 50,
        createdAt: new Date().toISOString()
      };
      return { ...a, leads: [newLead, ...existingLeads] };
    });
    return { ok: true, recorded: true };
  }
};
