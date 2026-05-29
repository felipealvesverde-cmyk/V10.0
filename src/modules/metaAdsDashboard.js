// V35.3.3 — Meta Ads Dashboard (placeholder).
//
// Sub-tab dentro de Dashboard > Checkout. Vai conectar com Meta Marketing
// API (Graph) pra trazer: campanhas, conjuntos, anúncios, gasto, impressões,
// cliques, conversões, ROAS.
//
// Roadmap futuro (standby):
//   - OAuth Meta Business
//   - GET /api/meta-ads-dashboard-metrics
//   - Webhooks de leadgen
//   - Tags lj-meta-clicou, lj-meta-conversao

window.MetaAdsDashboard = {
  render() {
    return `<div class="space-y-4">
      <!-- Hero — paleta Marketing pink -->
      <div class="rounded-3xl p-6 lg:p-8" style="background: linear-gradient(135deg, rgba(244,114,182,.18), rgba(249,168,212,.10)); border: 1px solid rgba(244,114,182,.30);">
        <div class="flex items-start gap-4">
          <div class="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center" style="background: rgba(244,114,182,.20); border: 1px solid rgba(244,114,182,.40);">
            <i data-lucide="facebook" class="w-7 h-7" style="color: #F472B6;"></i>
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-[10px] font-black uppercase tracking-widest mb-1" style="color: #F472B6;">Marketing · Aquisição</p>
            <h2 class="text-2xl lg:text-3xl font-black text-slate-900">Meta Ads</h2>
            <p class="text-sm text-slate-600 mt-2">Campanhas no Facebook, Instagram, Messenger e WhatsApp. Gasto, ROAS, CPL, leadgen — tudo no LJ.</p>
          </div>
        </div>
      </div>

      <!-- Card 'Em construção' -->
      <div class="rounded-3xl bg-white border-2 border-dashed p-8 text-center" style="border-color: rgba(244,114,182,.35);">
        <div class="inline-flex w-16 h-16 rounded-2xl items-center justify-center mb-4" style="background: rgba(244,114,182,.10);">
          <i data-lucide="hard-hat" class="w-8 h-8" style="color: #F472B6;"></i>
        </div>
        <h3 class="text-xl font-black text-slate-900 mb-2">Em construção</h3>
        <p class="text-sm text-slate-600 max-w-md mx-auto mb-6">
          Esta aba vai conectar com a <strong>Meta Marketing API</strong> pra trazer dados de campanha em tempo real. Disponível em breve.
        </p>

        <!-- Preview do que vai vir -->
        <div class="max-w-2xl mx-auto text-left">
          <p class="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">O que vai chegar:</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            ${[
              { icon: 'dollar-sign',   title: 'Gasto + ROAS por campanha', desc: 'Quanto investiu, quanto retornou em vendas (cruzando com Hotmart).' },
              { icon: 'mouse-pointer', title: 'CPL + CPC + CTR',           desc: 'Custo por lead, custo por click, taxa de cliques.' },
              { icon: 'users',          title: 'Lead Ads automáticos',      desc: 'Webhook leadgen → lead direto no LJ + tag lj-meta-leadgen.' },
              { icon: 'target',         title: 'Atribuição multi-touch',    desc: 'Que campanha trouxe o cliente que comprou na Hotmart?' }
            ].map(p => `<div class="flex items-start gap-3 p-3 rounded-2xl border" style="background: rgba(244,114,182,.04); border-color: rgba(244,114,182,.20);">
              <div class="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center" style="background: rgba(244,114,182,.12);">
                <i data-lucide="${p.icon}" class="w-4 h-4" style="color: #F472B6;"></i>
              </div>
              <div class="min-w-0">
                <p class="text-sm font-black text-slate-900">${p.title}</p>
                <p class="text-xs text-slate-500 mt-0.5">${p.desc}</p>
              </div>
            </div>`).join('')}
          </div>
        </div>

        <div class="mt-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest" style="background: rgba(244,114,182,.10); color: #F472B6;">
          <span class="w-1.5 h-1.5 rounded-full" style="background: #F472B6;"></span>
          Roadmap · Meta Marketing API standby
        </div>
      </div>
    </div>`;
  }
};
