// Placeholder do client Supabase. Mantém o namespace global para troca futura
// do StorageAdapter sem ajustes nos demais arquivos.
var SupabaseClient = {
  enabled: false,
  url: '',
  anonKey: '',
  client: null,
  init() {
    if (!this.enabled || !window.supabase) return null;
    this.client = window.supabase.createClient(this.url, this.anonKey);
    return this.client;
  }
};
window.SupabaseClient = SupabaseClient;
