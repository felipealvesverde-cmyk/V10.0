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
      splitCsvLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          const nextChar = line[i + 1];
          if (char === '"' && inQuotes && nextChar === '"') { current += '"'; i++; }
          else if (char === '"') inQuotes = !inQuotes;
          else if (char === ',' && !inQuotes) { result.push(current); current = ''; }
          else current += char;
        }
        result.push(current);
        return result;
      }
    };
window.Utils = Utils;
