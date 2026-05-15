var LeadParser = {
  _csvAliases: {
    nome: 'name', name: 'name',
    telefone: 'phone', phone: 'phone', celular: 'phone', whatsapp: 'phone',
    email: 'email',
    idade: 'idade',
    estado: 'estado', uf: 'estado',
    cidade: 'cidade',
    estado_civil: 'estadoCivil', estado_civil_: 'estadoCivil', estadocivil: 'estadoCivil', civil: 'estadoCivil',
    sexo: 'sexo', genero: 'genero',
    faixa_salarial: 'faixaSalarial', renda: 'faixaSalarial', salario: 'faixaSalarial',
    tags: 'tags', tag: 'tags', acoes: 'tags', comportamento: 'tags'
  },
  _headerKeys: ['nome', 'name', 'email', 'telefone', 'phone', 'idade', 'estado', 'sexo', 'tags'],
  _defaultHeaders: ['nome', 'telefone', 'email', 'idade', 'estado', 'cidade', 'estado_civil', 'sexo', 'faixa_salarial', 'tags'],
  _headerSkipRegex: /^(?:name,email|nome,email)/i,
  normalizeHeader(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  },

  cleanPhone(value) {
    return String(value || '').trim();
  },

  normalizeLead(raw = {}, index = 0, scoreId = App?.state?.actionDraft?.scoreId) {
    const name = raw.name || raw.nome || raw.Nome || raw.Name || '';
    const email = raw.email || raw.Email || '';
    const phone = raw.phone || raw.telefone || raw.Telefone || raw.celular || raw.whatsapp || '';
    const tags = raw.tags || raw.Tags || raw.tag || raw.acoes || raw.ações || raw.comportamento || '';

    const lead = {
      id: raw.id || Date.now() + index,
      name: String(name || 'Lead sem nome').trim(),
      email: String(email || '').trim(),
      phone: this.cleanPhone(phone),
      tags: String(tags || '').trim(),
      idade: Number(raw.idade || raw.Idade || 0),
      sexo: String(raw.sexo || raw.Sexo || raw.genero || raw.gênero || raw.Genero || '').trim(),
      genero: String(raw.genero || raw.gênero || raw.sexo || raw.Sexo || '').trim(),
      estado: String(raw.estado || raw.Estado || raw.uf || raw.UF || '').trim(),
      cidade: String(raw.cidade || raw.Cidade || '').trim(),
      estadoCivil: String(raw.estadoCivil || raw.estado_civil || raw['Estado Civil'] || raw.estado_cívil || raw.estadocivil || '').trim(),
      faixaSalarial: String(raw.faixaSalarial || raw.faixa_salarial || raw['Faixa Salarial'] || raw.renda || raw.salario || '').trim(),
      origem: raw.origem || 'manual'
    };

    lead.profile = {
      idade: lead.idade,
      sexo: lead.sexo || lead.genero,
      estado: lead.estado,
      cidade: lead.cidade,
      estadoCivil: lead.estadoCivil,
      faixaSalarial: lead.faixaSalarial
    };

    return ScoreEngine?.withScore ? ScoreEngine.withScore(lead, scoreId) : lead;
  },

  parse(text, scoreId = App.state.actionDraft.scoreId) {
    const skipRegex = this._headerSkipRegex;
    const rows = [];
    const lines = String(text || '').split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || skipRegex.test(line)) continue;
      const parts = Utils.splitCsvLine(line).map(part => part.trim());
      rows.push(this.normalizeLead({
        name: parts[0] || '',
        email: parts[1] || '',
        phone: parts[2] || '',
        tags: parts.slice(3).join(' ') || ''
      }, rows.length, scoreId));
    }
    return rows;
  },

  parseProfileCsv(text, scoreId = App?.state?.scores?.[0]?.id || 1) {
    const lines = String(text || '')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);

    if (!lines.length) return [];

    const first = Utils.splitCsvLine(lines[0]).map(item => this.normalizeHeader(item));
    const headerKeySet = new Set(this._headerKeys);
    const hasHeader = first.some(h => headerKeySet.has(h));
    const headers = hasHeader ? first : this._defaultHeaders;
    const dataLines = hasHeader ? lines.slice(1) : lines;
    const alias = this._csvAliases;
    const keys = headers.map(header => alias[header] || header);

    return dataLines.map((line, index) => {
      const values = Utils.splitCsvLine(line).map(item => item.trim());
      const raw = {};
      for (let i = 0; i < keys.length; i++) raw[keys[i]] = values[i] || '';
      return this.normalizeLead(raw, index, scoreId);
    });
  }
};
window.LeadParser = LeadParser;
