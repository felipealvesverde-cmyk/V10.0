// V15 — Lead Identity Resolver
// Triangula identidade de leads vindos de LP através de email, telefone,
// fingerprint do navegador e UTM. Resolve para o identityKey unificado.
window.LeadIdentityResolver = {
  resolve(payload = {}) {
    if (window.LeadIdentityEngine && (payload.email || payload.phone || payload.name)) {
      return LeadIdentityEngine.identityKey({
        email: payload.email,
        phone: payload.phone,
        name: payload.name,
        empresa: payload.company
      });
    }
    if (payload.fingerprint) return `fp:${payload.fingerprint}`;
    if (payload.sessionId) return `session:${payload.sessionId}`;
    return null;
  },

  enrichEvent(rawEvent) {
    const identityKey = this.resolve(rawEvent.lead || {});
    return { ...rawEvent, leadIdentityKey: identityKey };
  }
};
