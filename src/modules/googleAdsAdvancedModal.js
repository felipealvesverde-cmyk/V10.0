// V35.7.1 — Modal "Avançados" — 25 indicadores oficiais da Google Ads API
// pra UMA campanha Ads específica. Aberto via botão "Avançados" no card
// expansível da sub-aba "Associadas".
//
// Estrutura organizada por categoria oficial da doc Google Ads:
//   1) Identificação (5)        — ID, name, status, channel type, bidding
//   2) Budget (2)               — campaign_budget + amount_micros (daily)
//   3) Custo (3)                — cost_micros, cost_per_conv, cost_per_all_conv
//   4) Volume (5)               — impressions, clicks, ctr, average_cpc, average_cpm
//   5) Conversão (5)            — conversions, conversions_value, all_conversions, ...
//   6) ROAS (2)                 — value_per_conversion, value_per_all_conversions
//   7) Segments (3)             — date, device, ad_network_type (resumo)

window.GoogleAdsAdvancedModal = {
  render() {
    const id = App.state.googleAdsAdvancedModalCampaignId;
    if (!id) return '';
    const allAds = Array.isArray(App.state.googleAdsCampaignsCache) ? App.state.googleAdsCampaignsCache : [];
    const a = allAds.find(x => String(x.campaign_id) === String(id));
    if (!a) return '';
    const m = a.metrics_30d || {};

    return `<div class="fixed inset-0 z-[95] grid place-items-center p-4"
      style="background: rgba(15,23,42,0.85); backdrop-filter: blur(6px);"
      onclick="if(event.target===this) Actions.closeGoogleAdsAdvancedModal()">
      <div class="w-full max-w-4xl rounded-3xl bg-white shadow-2xl border-2 border-pink-300 overflow-hidden">

        <!-- HEADER -->
        <div class="bg-gradient-to-r from-pink-700 to-rose-700 px-6 py-5 text-white flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-[10px] font-black text-pink-100 uppercase tracking-widest">Indicadores Avançados · Google Ads API</p>
            <h2 class="text-lg font-black leading-tight mt-0.5">${Utils.escape(a.campaign_name || a.campaign_id)}</h2>
            <p class="text-[11px] text-pink-100/90 mt-1">ID ${Utils.escape(a.campaign_id)} · ${Utils.escape((a.advertising_channel_type || '').replace('_', ' '))} · ${Utils.escape(a.status || '?')}</p>
          </div>
          <button onclick="Actions.closeGoogleAdsAdvancedModal()" class="shrink-0 w-9 h-9 rounded-lg bg-white/15 hover:bg-white/25 text-white grid place-items-center">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <!-- BODY -->
        <main class="p-5 lg:p-6 max-h-[72vh] overflow-y-auto space-y-5">

          ${this._section('Identificação', 'tag', [
            { label: 'campaign.id',                       value: a.campaign_id },
            { label: 'campaign.name',                     value: a.campaign_name },
            { label: 'campaign.status',                   value: a.status },
            { label: 'campaign.advertising_channel_type', value: (a.advertising_channel_type || '').replace('_', ' ') },
            { label: 'campaign.bidding_strategy_type',    value: (a.bidding_strategy_type || '').replace('_', ' ') }
          ])}

          ${this._section('Budget', 'wallet', [
            { label: 'campaign.campaign_budget (BRL diário)', value: `R$ ${this._fmtMoney(a.daily_budget_brl)}` },
            { label: 'campaign_budget.amount_micros',         value: `${this._fmtInt(Number(a.daily_budget_brl || 0) * 1_000_000)} micros` }
          ])}

          ${this._section('Custo', 'banknote', [
            { label: 'metrics.cost_micros (BRL 30d)',         value: `R$ ${this._fmtMoney(m.cost_brl)}` },
            { label: 'metrics.cost_per_conversion',            value: `R$ ${this._fmtMoney(m.cost_per_conversion)}` },
            { label: 'metrics.cost_per_all_conversions',       value: `R$ ${this._fmtMoney(m.cost_per_all_conversions)}` }
          ])}

          ${this._section('Volume', 'bar-chart-3', [
            { label: 'metrics.impressions', value: this._fmtInt(m.impressions) },
            { label: 'metrics.clicks',      value: this._fmtInt(m.clicks) },
            { label: 'metrics.ctr (%)',     value: `${Number(m.ctr || 0).toFixed(2)}%` },
            { label: 'metrics.average_cpc', value: `R$ ${this._fmtMoney(m.average_cpc)}` },
            { label: 'metrics.average_cpm', value: `R$ ${this._fmtMoney(m.average_cpm)}` }
          ])}

          ${this._section('Conversão', 'target', [
            { label: 'metrics.conversions',                       value: this._fmtInt(m.conversions) },
            { label: 'metrics.conversions_value',                 value: `R$ ${this._fmtMoney(m.conversions_value)}` },
            { label: 'metrics.conversions_from_interactions_rate', value: `${(Number(m.conversions_from_interactions_rate || 0) * 100).toFixed(2)}%` },
            { label: 'metrics.all_conversions',                   value: this._fmtInt(m.all_conversions) },
            { label: 'metrics.all_conversions_value',             value: `R$ ${this._fmtMoney(m.all_conversions_value)}` },
            { label: 'metrics.view_through_conversions',          value: this._fmtInt(m.view_through_conversions) }
          ])}

          ${this._section('ROAS', 'trending-up', [
            { label: 'metrics.value_per_conversion',          value: `R$ ${this._fmtMoney(m.value_per_conversion)}` },
            { label: 'metrics.value_per_all_conversions',     value: `R$ ${this._fmtMoney(m.value_per_all_conversions)}` }
          ])}

          ${this._section('Search (só Search/Shopping)', 'search', [
            { label: 'metrics.search_impression_share (%)',     value: m.search_impression_share != null ? `${Number(m.search_impression_share).toFixed(1)}%` : '— não aplica a este tipo de campanha' },
            { label: 'metrics.search_top_impression_share (%)', value: m.search_top_impression_share != null ? `${Number(m.search_top_impression_share).toFixed(1)}%` : '— não aplica a este tipo de campanha' }
          ])}

          ${this._section('Segments (resumo agregado 30d)', 'layers', [
            { label: 'segments.date',                value: 'Agregado dos últimos 30 dias' },
            { label: 'segments.device',              value: '— breakdown por device em release futura' },
            { label: 'segments.ad_network_type',     value: '— breakdown por rede em release futura' }
          ])}

          <p class="text-[11px] text-slate-500 italic">Fonte: Google Ads Query Language (GAQL) v18+. Documentação oficial em developers.google.com/google-ads/api/fields.</p>
        </main>

        <footer class="px-6 py-3 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50">
          <button onclick="Actions.closeGoogleAdsAdvancedModal()" class="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-black inline-flex items-center gap-1.5" style="color:#fff!important;">
            <i data-lucide="check" class="w-3.5 h-3.5"></i> Fechar
          </button>
        </footer>
      </div>
    </div>`;
  },

  _section(title, icon, rows) {
    return `<section class="rounded-2xl bg-slate-50 border border-slate-200 p-4">
      <div class="flex items-center gap-2 mb-3">
        <i data-lucide="${icon}" class="w-4 h-4 text-pink-700"></i>
        <h3 class="text-sm font-black text-slate-800">${Utils.escape(title)}</h3>
      </div>
      <div class="grid md:grid-cols-2 gap-2">
        ${rows.map(r => `<div class="rounded-xl bg-white border border-slate-200 px-3 py-2 flex items-center justify-between gap-2">
          <p class="text-[10px] font-mono text-slate-500 truncate">${Utils.escape(r.label)}</p>
          <p class="text-[12px] font-black text-slate-900 text-right">${Utils.escape(String(r.value ?? '—'))}</p>
        </div>`).join('')}
      </div>
    </section>`;
  },

  _fmtMoney(n) {
    return Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  _fmtInt(n) {
    return Number(n || 0).toLocaleString('pt-BR');
  }
};
