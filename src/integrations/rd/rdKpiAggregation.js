
window.RDKpiAggregation = {
  rdActions() {
    return (App.state.actions || []).filter(action => window.RDMapper?.isRDEmailAction?.(action));
  },
  aggregate(actions = this.rdActions()) {
    const totals = {};
    actions.forEach(action => {
      const kpis = window.RDKpiMapper ? RDKpiMapper.ensureActionKpis(action) : (action.kpis || []);
      kpis.forEach(kpi => {
        const key = kpi.name;
        totals[key] = totals[key] || { name: key, current: 0, actions: 0 };
        totals[key].current += Number(kpi.current || 0);
        totals[key].actions += 1;
      });
    });
    return Object.values(totals);
  }
};
