var Utils = {
      clone(value) { return JSON.parse(JSON.stringify(value)); },
      escape(value) {
        return String(value || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      },
      toast(message) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 2200);
      },
      searchLog(title, messages = [], type = 'warning') {
        let panel = document.getElementById('searchLogPanel');
        if (!panel) {
          panel = document.createElement('div');
          panel.id = 'searchLogPanel';
          panel.className = 'fixed top-4 right-4 z-[80] w-[calc(100vw-2rem)] max-w-md rounded-3xl bg-white border border-slate-200 shadow-2xl p-4 text-slate-900';
          document.body.appendChild(panel);
        }
        const tone = type === 'success' ? 'bg-emerald-100 text-emerald-700' : type === 'error' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700';
        const items = Array.isArray(messages) ? messages : [messages];
        panel.innerHTML = `<div class="flex items-start justify-between gap-3"><div><div class="inline-flex px-3 py-1 rounded-full text-xs font-black ${tone} mb-2">Log da busca</div><h4 class="font-black text-base">${this.escape(title)}</h4></div><button onclick="document.getElementById('searchLogPanel')?.remove()" class="w-8 h-8 rounded-xl bg-slate-100 font-black">×</button></div><div class="mt-3 space-y-2">${items.map(item => `<p class="text-sm text-slate-600">• ${this.escape(item)}</p>`).join('')}</div>`;
        clearTimeout(this._searchLogTimer);
        this._searchLogTimer = setTimeout(() => panel?.remove(), 8000);
      },
      formatCents(value) {
        const num = Number(value) || 0;
        const totalCents = Math.round(Math.abs(num) * 100);
        const reais = Math.floor(totalCents / 100);
        const cents = totalCents % 100;
        const sign = num < 0 ? '-' : '';
        return sign + reais.toLocaleString('pt-BR') + ',' + String(cents).padStart(2, '0');
      },
      applyMoneyMask(inputEl) {
        const digits = String(inputEl.value || '').replace(/\D/g, '');
        const value = digits ? parseInt(digits, 10) / 100 : 0;
        inputEl.value = this.formatCents(value);
        const end = inputEl.value.length;
        try { inputEl.setSelectionRange(end, end); } catch (_) {}
        return value;
      },
      // V32.9.5 — Parser tolerante de string BRL pra número.
      // Aceita: "115,29" "1.234,56" "R$ 1.000.000,00" "1234.56" "115" etc.
      // Heurística: se tem vírgula, vírgula = decimal e ponto = milhares (BR).
      // Se só tem ponto e máx 2 dígitos depois, ponto = decimal (US-like fallback).
      parseBRL(str) {
        if (typeof str === 'number') return Number.isFinite(str) ? str : 0;
        if (str == null) return 0;
        let s = String(str).replace(/R\$/gi, '').replace(/\s/g, '').trim();
        if (!s) return 0;
        const hasComma = s.includes(',');
        if (hasComma) {
          // BR: ponto é milhares, vírgula é decimal
          s = s.replace(/\./g, '').replace(',', '.');
        } else {
          // Sem vírgula: ponto pode ser decimal (115.29) ou milhares (1.234)
          // Convenção: se houver 1 ponto e 1-2 dígitos depois, decimal. Senão, milhares.
          const dotPos = s.lastIndexOf('.');
          if (dotPos >= 0) {
            const after = s.length - dotPos - 1;
            if (after === 3 && s.split('.').length > 2) {
              // múltiplos pontos OU 1 ponto + 3 dígitos = milhares
              s = s.replace(/\./g, '');
            }
            // 1 ponto + 1 ou 2 dígitos = decimal (mantém)
          }
        }
        const n = parseFloat(s);
        return Number.isFinite(n) ? n : 0;
      },
      // V32.9.5 — Format BRL completo com R$ prefix.
      formatBRL(value) {
        const n = Number(value) || 0;
        return 'R$ ' + this.formatCents(n);
      },
      // V34.9.9 — Aceita separador customizado (default = vírgula). Use TAB pra TSV.
      splitCsvLine(line, separator = ',') {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          const nextChar = line[i + 1];
          if (char === '"' && inQuotes && nextChar === '"') { current += '"'; i++; }
          else if (char === '"') inQuotes = !inQuotes;
          else if (char === separator && !inQuotes) { result.push(current); current = ''; }
          else current += char;
        }
        result.push(current);
        return result;
      },
      // V34.9.9 — Detecta automaticamente o separador (CSV vs TSV).
      // Olha a primeira linha não-vazia: se tem mais TABs que vírgulas → TSV.
      detectCsvSeparator(text) {
        const firstLine = String(text || '').split(/\r?\n/).map(l => l.trim()).find(Boolean) || '';
        const tabCount = (firstLine.match(/\t/g) || []).length;
        const commaCount = (firstLine.match(/,/g) || []).length;
        return tabCount > commaCount ? '\t' : ',';
      }
    };
window.Utils = Utils;
