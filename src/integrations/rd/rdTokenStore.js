// LeadJourney V13 — local token store abstraction
window.RDTokenStore = {
  getConfig() {
    return App?.state?.integrations?.rd || RDConfig.defaultConfig();
  },

  setConfig(patch = {}) {
    App.state.integrations = App.state.integrations || {};
    App.state.integrations.rd = {
      ...RDConfig.defaultConfig(),
      ...(App.state.integrations.rd || {}),
      ...(patch || {})
    };
    App.save();
    return App.state.integrations.rd;
  },

  clear() {
    App.state.integrations = App.state.integrations || {};
    App.state.integrations.rd = RDConfig.defaultConfig();
    App.save();
  }
};
