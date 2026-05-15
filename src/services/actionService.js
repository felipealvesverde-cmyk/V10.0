/*
  ActionService keeps future database operations separated from UI modules.
  At this stage, appActions.js still changes local state directly.
  When Supabase is added, these services become the bridge to StorageAdapter.
*/
var ActionService = {};
window.ActionService = ActionService;
