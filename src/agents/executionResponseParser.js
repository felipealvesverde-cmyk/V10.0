// V16.3 — Execution Response Parser
// Normaliza a resposta do Djow para o shape padrão de tarefa:
// { type, title, assignee, due_date, description, priority }.
// Quando o agente não está disponível, parseLocal() faz best-effort sobre a
// mensagem usando regex simples (data, responsável, prioridade).
window.ExecutionResponseParser = {
  parse(raw) {
    if (!raw || typeof raw !== 'object') return null;
    return {
      type: String(raw.type || 'task'),
      title: String(raw.title || '').trim(),
      assignee: String(raw.assignee || '').trim(),
      due_date: this._normalizeDate(raw.due_date),
      description: String(raw.description || '').trim(),
      priority: this._normalizePriority(raw.priority)
    };
  },

  parseLocal(message, ctx) {
    const msg = String(message || '');
    const due = this._extractDate(msg);
    const assignee = this._extractAssignee(msg);
    const priority = /\b(urgente|alta)\b/i.test(msg) ? 'high' : /\b(baixa)\b/i.test(msg) ? 'low' : 'normal';
    const titleGuess = this._extractTitle(msg) || (ctx?.action ? `Tarefa: ${ctx.action}` : 'Nova tarefa');
    return {
      type: 'task',
      title: titleGuess,
      assignee,
      due_date: due,
      description: msg,
      priority
    };
  },

  _normalizeDate(raw) {
    if (!raw) return null;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  },

  _normalizePriority(raw) {
    const v = String(raw || '').toLowerCase();
    if (['high','alta','urgente','critical'].includes(v)) return 'high';
    if (['low','baixa'].includes(v)) return 'low';
    return 'normal';
  },

  _extractDate(msg) {
    const m1 = msg.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
    if (m1) return `${m1[3]}-${m1[2]}-${m1[1]}`;
    const m2 = msg.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;
    const m3 = msg.match(/\b(\d{1,2})\/(\d{1,2})\b/);
    if (m3) {
      const y = new Date().getFullYear();
      const mm = String(m3[2]).padStart(2, '0');
      const dd = String(m3[1]).padStart(2, '0');
      return `${y}-${mm}-${dd}`;
    }
    return null;
  },

  _extractAssignee(msg) {
    const m = msg.match(/\bpara (?:o |a )?([A-ZÁ-Ú][\wÀ-ÿ]+)/);
    return m ? m[1] : '';
  },

  _extractTitle(msg) {
    const m = msg.match(/(?:tarefa|task|criar|gerar) (?:de |para )?([^,.;:]{3,80})/i);
    if (!m) return '';
    return m[1].replace(/\s+/g, ' ').trim();
  }
};
