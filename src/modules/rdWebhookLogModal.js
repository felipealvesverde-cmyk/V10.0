// V35.11.0 — Modal "Log de Erros" (webhooks RD).
//
// Acessado via Configurações > Meu Banco > card "Log de Erros" → "Abrir log".
// Também usado como ação "Ver log e marcar como visto" no sininho.
//
// Estrutura:
//   - Header com kicker "Meu Banco · Log"
//   - Linha de filtros: busca / tipo / status / período / botão CSV
//   - Tabela paginada (até 50 por página)
//   - Footer com paginação
//
// Backend: GET /api/rd-webhook-log com query string.

window.RdWebhookLogModal = {
  render() {
    if (!App.state.rdWebhookLogModalOpen) return '';
    const cache = App.state.rdWebhookLogCache || { items: [], total: 0, page: 1, totalPages: 1, loading: false };
    const f = App.state.rdWebhookLogFilters || { status: 'all', eventType: '', period: '7d', search: '', page: 1 };

    return `<div class="fixed inset-0 z-[95] grid place-items-center p-4"
      style="background: rgba(15,23,42,0.78); backdrop-filter: blur(6px);"
      onclick="if(event.target===this) Actions.closeRdWebhookLogModal()">
      <div class="w-full max-w-5xl rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden">

        <!-- HEADER -->
        <div class="px-6 py-4 bg-slate-950 text-white flex items-start justify-between gap-3" style="color:#fff;">
          <div>
            <p class="text-[10px] font-black text-violet-300 uppercase tracking-widest inline-flex items-center gap-1.5">
              <i data-lucide="database" class="w-3 h-3"></i> Meu Banco · Log
            </p>
            <h2 class="text-xl font-black text-white mt-1">Log de webhooks RD</h2>
            <p class="text-[12px] text-slate-300 mt-0.5">Histórico de tudo que o RD enviou pro LJ (últimos 7 dias).</p>
          </div>
          <button onclick="Actions.closeRdWebhookLogModal()" class="shrink-0 w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 grid place-items-center" style="color:#fff;">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <!-- FILTROS -->
        <div class="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-3">
          <div class="relative flex-1 min-w-[200px]">
            <i data-lucide="search" class="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input
              type="text"
              value="${Utils.escape(f.search || '')}"
              oninput="Actions.setRdWebhookLogFilter('search', this.value)"
              placeholder="Buscar..."
              class="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-300 text-xs"
            />
          </div>
          <select onchange="Actions.setRdWebhookLogFilter('eventType', this.value)" class="px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-black text-slate-700">
            <option value="" ${!f.eventType ? 'selected' : ''}>Todos os tipos</option>
            <option value="crm_contact_created" ${f.eventType === 'crm_contact_created' ? 'selected' : ''}>Contato criado</option>
            <option value="crm_contact_updated" ${f.eventType === 'crm_contact_updated' ? 'selected' : ''}>Contato atualizado</option>
            <option value="crm_contact_deleted" ${f.eventType === 'crm_contact_deleted' ? 'selected' : ''}>Contato deletado</option>
            <option value="tag_added" ${f.eventType === 'tag_added' ? 'selected' : ''}>Tag adicionada</option>
            <option value="tag_removed" ${f.eventType === 'tag_removed' ? 'selected' : ''}>Tag removida</option>
          </select>
          <select onchange="Actions.setRdWebhookLogFilter('status', this.value)" class="px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-black text-slate-700">
            <option value="all" ${f.status === 'all' ? 'selected' : ''}>Tudo</option>
            <option value="ok" ${f.status === 'ok' ? 'selected' : ''}>✓ OK</option>
            <option value="error" ${f.status === 'error' ? 'selected' : ''}>✗ Erro</option>
          </select>
          <select onchange="Actions.setRdWebhookLogFilter('period', this.value)" class="px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-black text-slate-700">
            <option value="24h" ${f.period === '24h' ? 'selected' : ''}>Últimas 24h</option>
            <option value="7d" ${f.period === '7d' ? 'selected' : ''}>Últimos 7 dias</option>
            <option value="30d" ${f.period === '30d' ? 'selected' : ''}>Últimos 30 dias</option>
          </select>
          <button onclick="Actions.downloadRdWebhookLogCsv()" class="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black inline-flex items-center gap-1.5" style="color:#fff;">
            <i data-lucide="download" class="w-3.5 h-3.5"></i> CSV
          </button>
          <button onclick="Actions.loadRdWebhookLog()" class="px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-black inline-flex items-center gap-1.5">
            <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
          </button>
        </div>

        <!-- TABELA -->
        <div class="max-h-[55vh] overflow-y-auto">
          ${cache.loading
            ? `<div class="p-10 text-center text-slate-500 text-sm">Carregando...</div>`
            : (cache.items?.length
              ? this._table(cache.items)
              : `<div class="p-10 text-center">
                  <i data-lucide="inbox" class="w-10 h-10 text-slate-300 mx-auto mb-2"></i>
                  <p class="text-sm font-black text-slate-700">Sem registros nos filtros atuais.</p>
                  <p class="text-[12px] text-slate-500 mt-1">Ajuste o período ou os filtros pra ver mais.</p>
                </div>`)
          }
        </div>

        <!-- FOOTER PAGINAÇÃO -->
        ${cache.total > 0 ? `<div class="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <p class="text-[11px] text-slate-600">
            <b>${cache.total}</b> registro(s) · Página <b>${cache.page}</b> de <b>${cache.totalPages}</b>
          </p>
          <div class="flex items-center gap-2">
            <button
              ${cache.page <= 1 ? 'disabled' : ''}
              onclick="Actions.setRdWebhookLogPage(${cache.page - 1})"
              class="px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-xs font-black text-slate-700 ${cache.page <= 1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-100'}">
              ← Anterior
            </button>
            <button
              ${cache.page >= cache.totalPages ? 'disabled' : ''}
              onclick="Actions.setRdWebhookLogPage(${cache.page + 1})"
              class="px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-xs font-black text-slate-700 ${cache.page >= cache.totalPages ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-100'}">
              Próximo →
            </button>
          </div>
        </div>` : ''}
      </div>
    </div>`;
  },

  _table(items) {
    return `<table class="w-full text-xs">
      <thead class="bg-slate-100 sticky top-0">
        <tr>
          <th class="text-left px-4 py-2 font-black text-slate-700 uppercase tracking-wider text-[10px]">Quando</th>
          <th class="text-left px-4 py-2 font-black text-slate-700 uppercase tracking-wider text-[10px]">Status</th>
          <th class="text-left px-4 py-2 font-black text-slate-700 uppercase tracking-wider text-[10px]">Tipo</th>
          <th class="text-left px-4 py-2 font-black text-slate-700 uppercase tracking-wider text-[10px]">Contato</th>
          <th class="text-left px-4 py-2 font-black text-slate-700 uppercase tracking-wider text-[10px]">Detalhe / Erro</th>
          <th class="text-right px-4 py-2 font-black text-slate-700 uppercase tracking-wider text-[10px]">Latência</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(r => this._row(r)).join('')}
      </tbody>
    </table>`;
  },

  _row(r) {
    const isErr = r.status === 'error';
    const when = r.received_at ? new Date(r.received_at).toLocaleString('pt-BR') : '—';
    const statusChip = isErr
      ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-black"><i data-lucide="x-circle" class="w-3 h-3"></i> Erro</span>`
      : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black"><i data-lucide="check" class="w-3 h-3"></i> OK</span>`;
    const detail = isErr
      ? `<div>
          <p class="text-rose-700 font-black text-[11px]">${Utils.escape(r.error_category || 'unknown')}</p>
          <p class="text-rose-600/80 text-[11px] mt-0.5">${Utils.escape(r.error_message || '')}</p>
        </div>`
      : `<p class="text-slate-500 text-[11px]">${r.payload_excerpt ? Utils.escape(this._summarizePayload(r.payload_excerpt)) : '—'}</p>`;
    return `<tr class="border-b border-slate-100 ${isErr ? 'bg-rose-50/30' : ''} hover:bg-slate-50">
      <td class="px-4 py-2.5 text-slate-600 whitespace-nowrap text-[11px]">${when}</td>
      <td class="px-4 py-2.5 whitespace-nowrap">${statusChip}</td>
      <td class="px-4 py-2.5 text-slate-700 font-mono text-[11px] whitespace-nowrap">${Utils.escape(r.event_type || '—')}</td>
      <td class="px-4 py-2.5 text-slate-600 font-mono text-[11px] whitespace-nowrap">${Utils.escape(r.rd_contact_id || '—')}</td>
      <td class="px-4 py-2.5 max-w-md">${detail}</td>
      <td class="px-4 py-2.5 text-right text-slate-500 text-[11px] whitespace-nowrap">${r.processing_ms != null ? `${r.processing_ms}ms` : '—'}</td>
    </tr>`;
  },

  _summarizePayload(p) {
    if (!p || typeof p !== 'object') return '—';
    const parts = [];
    if (p.email) parts.push(p.email);
    else if (p.contact?.email) parts.push(p.contact.email);
    if (p.name) parts.push(p.name);
    else if (p.contact?.name) parts.push(p.contact.name);
    if (Array.isArray(p.tags) && p.tags.length) parts.push(`tags: ${p.tags.join(',')}`);
    return parts.length ? parts.join(' · ') : '(payload sem campos chave)';
  }
};
