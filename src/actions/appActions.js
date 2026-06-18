var Actions = {
      // V31.2.1 — Administrar Lead Journey: deletar produto em cascata.
      // Master-only (Settings já gate por isMaster). Confirmação dupla via typed.
      adminRequestDeleteProduct(productId) {
        // V32.5.7 — Removida checagem isMaster. Qualquer user gerencia próprios
        // produtos via Minha Conta. Demo guard mantém — user demo é read-only.
        if (this._demoGuard && this._demoGuard('Apagar produto')) return;
        App.state.adminDeleteProductPending = { productId: Number(productId), typed: '' };
        App.render();
      },
      adminDeleteProductTyped(value) {
        const pending = App.state.adminDeleteProductPending;
        if (!pending) return;
        pending.typed = String(value || '');
        App.render();
      },
      adminCancelDeleteProduct() {
        App.state.adminDeleteProductPending = null;
        App.render();
      },
      adminConfirmDeleteProduct(productId) {
        // V32.5.7 — Removida checagem isMaster. Cliente do tenant gerencia
        // próprios produtos via Configurações → Minha Conta → Produtos.
        // Tenant DB já isola dados — não há risco de apagar produto alheio.
        const product = (App.state.products || []).find(p => Number(p.id) === Number(productId));
        if (!product) return Utils.toast('Produto não encontrado.');
        const pending = App.state.adminDeleteProductPending;
        if (!pending || pending.typed !== product.name) return Utils.toast('Confirme digitando o nome exato.');

        const pid = Number(productId);
        // Identifica dependências antes de deletar
        const campaigns = (App.state.campaigns || []).filter(c => Number(c.productId) === pid);
        const campaignIds = new Set(campaigns.map(c => Number(c.id)));
        const actions = (App.state.actions || []).filter(a => campaignIds.has(Number(a.campaignId)));
        const actionIds = new Set(actions.map(a => Number(a.id)));
        const leadIds = new Set();
        actions.forEach(a => (a.leads || []).forEach(l => leadIds.add(Number(l.id))));

        // CASCADE — apaga tudo em ordem
        // 1. Tabelas list-based
        App.state.products = (App.state.products || []).filter(p => Number(p.id) !== pid);
        App.state.campaigns = (App.state.campaigns || []).filter(c => !campaignIds.has(Number(c.id)));
        App.state.actions = (App.state.actions || []).filter(a => !actionIds.has(Number(a.id)));
        App.state.manualLeads = (App.state.manualLeads || []).filter(l =>
          !campaignIds.has(Number(l.campaignId)) && !actionIds.has(Number(l.actionId))
        );
        App.state.executionTasks = (App.state.executionTasks || []).filter(t =>
          !campaignIds.has(Number(t.linked_campaign_id)) && !actionIds.has(Number(t.linked_action_id))
        );

        // 2. Dicts keyed por productId
        const strategicMaps = { ...(App.state.strategicMaps || {}) };
        delete strategicMaps[pid];
        App.state.strategicMaps = strategicMaps;

        const revopsFinance = { ...(App.state.revopsFinance || {}) };
        delete revopsFinance[pid];
        App.state.revopsFinance = revopsFinance;

        // 3. Dicts keyed por campaignId
        const strategicCampaignMaps = { ...(App.state.strategicCampaignMaps || {}) };
        campaignIds.forEach(cid => delete strategicCampaignMaps[cid]);
        App.state.strategicCampaignMaps = strategicCampaignMaps;

        const revenueScoreBlueprints = { ...(App.state.revenueScoreBlueprints || {}) };
        campaignIds.forEach(cid => delete revenueScoreBlueprints[cid]);
        App.state.revenueScoreBlueprints = revenueScoreBlueprints;

        const revenueReadyTriggered = { ...(App.state.revenueReadyTriggered || {}) };
        campaignIds.forEach(cid => delete revenueReadyTriggered[cid]);
        App.state.revenueReadyTriggered = revenueReadyTriggered;

        if (App.state.integrations?.rdCrm?.pipelinesByCampaign) {
          const piby = { ...(App.state.integrations.rdCrm.pipelinesByCampaign) };
          campaignIds.forEach(cid => delete piby[cid]);
          App.state.integrations = {
            ...App.state.integrations,
            rdCrm: { ...(App.state.integrations.rdCrm || {}), pipelinesByCampaign: piby }
          };
        }

        // 4. Dicts keyed por leadId
        const leadOutcomes = { ...(App.state.leadOutcomes || {}) };
        const leadScoreHistory = { ...(App.state.leadScoreHistory || {}) };
        const leadEngagementHistory = { ...(App.state.leadEngagementHistory || {}) };
        leadIds.forEach(lid => {
          delete leadOutcomes[lid];
          delete leadScoreHistory[lid];
          delete leadEngagementHistory[lid];
        });
        App.state.leadOutcomes = leadOutcomes;
        App.state.leadScoreHistory = leadScoreHistory;
        App.state.leadEngagementHistory = leadEngagementHistory;

        // 5. Seleção atual se apontava pro produto deletado
        if (Number(App.state.selectedProductId) === pid) {
          App.state.selectedProductId = (App.state.products[0] || {}).id || null;
        }
        if (campaignIds.has(Number(App.state.selectedCampaignId))) {
          App.state.selectedCampaignId = (App.state.campaigns[0] || {}).id || null;
        }
        if (actionIds.has(Number(App.state.selectedActionId))) {
          App.state.selectedActionId = null;
        }

        // 6. Limpa o pending + persiste
        App.state.adminDeleteProductPending = null;
        App.save(); App.render();
        Utils.toast(`Produto "${product.name}" apagado: ${campaigns.length} campanha(s), ${actions.length} ação(ões), ${leadIds.size} lead(s).`);
        // V32.2.5 (Geraldo A15) — Sync delete cascado pro ClickUp.
        // Ordem: actions primeiro (subtasks), campanhas (lists), produto (folder).
        // Best-effort, sem bloquear UI.
        if (window.Actions?._syncDeleteToClickup) {
          actionIds.forEach(aid => Actions._syncDeleteToClickup('action', aid));
          campaignIds.forEach(cid => Actions._syncDeleteToClickup('campaign', cid));
          Actions._syncDeleteToClickup('product', pid);
        }
      },

      // V31.0.0 — Helpers demo mode. Backend bloqueia mutations (403) via middleware;
      // estes helpers no frontend são UX (toast amigável + abort) e ficam fora dos
      // Actions principais — quem quiser blindar uma Action chama Actions._demoGuard()
      // no topo. Para Actions que não chamam, o backend ainda bloqueia: state
      // in-memory pode mostrar mudança fantasma até reload, mas DB nunca é tocado.
      _isDemoUser() {
        try {
          const u = JSON.parse(localStorage.getItem('lj_user') || '{}');
          return u.mode === 'demo';
        } catch (_) { return false; }
      },
      _demoGuard(label) {
        if (!this._isDemoUser()) return false;
        Utils.toast(`Modo demo · ${label || 'cadastros'} desabilitado. Navegue à vontade!`);
        return true;
      },

      selectCampaign(id) {
        const campaign = (App.state.campaigns || []).find(item => Number(item.id) === Number(id));
        if (!campaign) return Utils.toast('Campanha não encontrada.');
        App.state.selectedCampaignId = Number(id);
        App.state.selectedProductId = Number(campaign.productId || App.state.selectedProductId || 0) || App.state.selectedProductId;
        App.state.actionDraft.campaignId = Number(id);
        App.state.activeTab = 'actions';
        App.save(); App.render();
      },
      selectCampaignFromActions(id) { App.state.selectedCampaignId = id; App.state.actionDraft.campaignId = id; App.state.selectedActionId = null; App.save(); App.render(); },
      // V37.0.9 — setLeadInputMode e setMailingDefined REMOVIDAS junto com o
      // bloco "Mailing definido?" do form. Importação inline saiu — base de
      // leads agora só via Actions.openLeadImportModal (Lead Import Wizard).
      updateActionChannel(id, channel) { App.state.actions = App.state.actions.map(action => action.id === id ? { ...action, channel, connected: false, connectionStatus: 'ready', status: 'Canal selecionado' } : action); App.save(); App.render(); Utils.toast('Canal atualizado. Conecte novamente.'); },
      connectAction(id) { App.state.actions = App.state.actions.map(action => action.id === id ? { ...action, connected: true, connectionStatus: 'ready', status: `Conectada ao ${action.channel}` } : action); App.save(); App.render(); Utils.toast('Canal conectado. Ação pronta para ativar.'); },
      toggleActionTransfer(id) { App.state.actions = App.state.actions.map(action => { if (action.id !== id || !action.connected) return action; const next = action.connectionStatus === 'active' ? 'idle' : 'active'; return { ...action, connectionStatus: next, status: next === 'active' ? `Ativa: trocando dados com ${action.channel}` : 'Sem troca de dados' }; }); App.save(); App.render(); Utils.toast('Status da troca atualizado.'); },
      openActionResult(id) { App.state.selectedActionId = id; App.state.activeTab = 'results'; App.save(); App.render(); },
      // V37.0.9 — prepareNextActionFromResult: tirados leadInputMode/leadsText/
      // rdListName/scoreId (campos do antigo mailing inline). Ação nova nasce
      // limpa; cliente anexa base pelo Lead Import Wizard se quiser.
      prepareNextActionFromResult(id) {
        const action = App.state.actions.find(item => item.id === id);
        if (!action) return;
        App.state.actionDraft = { campaignId: action.campaignId, name: `Próxima ação após ${action.name}`, channel: 'Meta Ads', objective: 'Continuar a jornada com os leads de maior score desta ação.' };
        App.state.selectedCampaignId = action.campaignId;
        App.state.activeTab = 'actions';
        App.save(); App.render(); Utils.toast('Nova ação preparada.');
      },
      createScorePreset() {
        const d = App.state.scoreDraft;
        if (!d.name.trim()) return Utils.toast('Digite o nome do score.');
        const score = State.normalizeScore({ ...d, id: Date.now() });
        App.state.scores.unshift(score);
        App.state.selectedScoreId = score.id;
        App.state.scoreDraft = { name: '', description: '', tagRules: [{ tag: '#nova', score: 0 }] };
        App.save(); App.render(); Utils.toast('Score criado. Agora ele pode ser usado nas ações.');
      },
      selectScore(id) { App.state.selectedScoreId = id; App.save(); App.render(); },
      updateScoreField(id, field, value, shouldRender = true) { App.state.scores = App.state.scores.map(score => Number(score.id) === Number(id) ? { ...score, [field]: value } : score); App.save(); if (shouldRender) App.render(); },
      updateScoreTag(id, index, field, value, shouldRender = true) { App.state.scores = App.state.scores.map(score => { if (Number(score.id) !== Number(id)) return score; const rules = Utils.clone(score.tagRules); rules[index][field] = field === 'score' ? Number(value || 0) : value; return { ...score, tagRules: rules }; }); App.save(); if (shouldRender) App.render(); },
      addScoreTag(id) { App.state.scores = App.state.scores.map(score => Number(score.id) === Number(id) ? { ...score, tagRules: [...score.tagRules, { tag: '#nova', score: 0 }] } : score); App.save(); App.render(); },
      removeScoreTag(id, index) { App.state.scores = App.state.scores.map(score => Number(score.id) === Number(id) ? { ...score, tagRules: score.tagRules.filter((_, i) => i !== index) } : score); App.save(); App.render(); },
      addScoreDraftTag() { App.state.scoreDraft.tagRules.push({ tag: '#nova', score: 0 }); App.save(); App.render(); },
      removeScoreDraftTag(index) { App.state.scoreDraft.tagRules.splice(index, 1); App.save(); App.render(); },
      // V37.0.9 — loadLeadExample, handleActionCSV, downloadCsvTemplate
      // REMOVIDAS junto com o mailing inline. Caminho moderno é o Lead Import
      // Wizard (Actions.openLeadImportModal) com dedup + validação.
      openDashboardCampaign(id) { App.state.selectedDashboardCampaignId = id; App.save(); App.render(); },
      openLead(id) { App.state.selectedLeadId = id; App.state.activeTab = 'leads'; App.save(); App.render(); },
      // V35.3.7 — Lead Import Wizard substitui o modal único antigo.
      // 4 steps: Upload → Mapear → Revisar → Importar.
      async openLeadImportModal() {
        if (!App.state.leadBanksCache?.loadedAt) {
          await Actions.loadLeadBanks();
        }
        const banks = App.state.leadBanksCache?.banks || [];
        const defaultBank = banks.find(b => b.is_default) || banks[0] || null;
        App.state.leadImportWizard = {
          open: true,
          step: 1,
          bankId: defaultBank?.id || null,
          inputMode: 'file',
          rawText: '',
          fileName: null,
          separator: null,
          encoding: 'utf-8',
          headers: [],
          rows: [],
          preview: [],
          mapping: {},
          parseError: null,
          dedupPreview: null,
          dedupBehavior: 'update',
          applyOriginTag: true,
          originTag: defaultBank ? `import-${new Date().toISOString().slice(0,10)}-${defaultBank.name.toLowerCase().replace(/\s+/g,'-').slice(0,20)}` : `import-${new Date().toISOString().slice(0,10)}`,
          result: null
        };
        // Pra compat: mantém showLeadImportModal=true caso outro caller dependa
        App.state.showLeadImportModal = true;
        App.save(); App.render();
      },
      closeLeadImportModal() {
        App.state.showLeadImportModal = false;
        App.state.leadImportWizard = null;
        App.save(); App.render();
      },

      // ===== V35.3.7 — Lead Import Wizard actions =====

      setLeadWizardStep(n) {
        const w = App.state.leadImportWizard;
        if (!w) return;
        w.step = Math.max(1, Math.min(4, Number(n)));
        App.save(); App.render();
      },

      setLeadWizardBank(bankId) {
        const w = App.state.leadImportWizard;
        if (!w) return;
        w.bankId = bankId ? Number(bankId) : null;
        const bank = (App.state.leadBanksCache?.banks || []).find(b => b.id === w.bankId);
        if (bank && w.originTag.startsWith('import-')) {
          w.originTag = `import-${new Date().toISOString().slice(0,10)}-${bank.name.toLowerCase().replace(/\s+/g,'-').slice(0,20)}`;
        }
        App.save(); App.render();
      },

      setLeadWizardInputMode(mode) {
        const w = App.state.leadImportWizard;
        if (!w) return;
        w.inputMode = mode === 'paste' ? 'paste' : 'file';
        App.render();
      },

      // V35.3.7 — Helpers internos
      _detectCsvSeparator(text) {
        const first = String(text || '').split(/\r?\n/)[0] || '';
        const counts = { ',': (first.match(/,/g)||[]).length, ';': (first.match(/;/g)||[]).length, '\t': (first.match(/\t/g)||[]).length };
        let best = ',', max = 0;
        for (const sep of Object.keys(counts)) {
          if (counts[sep] > max) { max = counts[sep]; best = sep; }
        }
        return max === 0 ? ',' : best;
      },

      _parseCsvRow(line, sep) {
        // Simple CSV parser com suporte a aspas
        const out = []; let cur = ''; let inQ = false;
        for (let i = 0; i < line.length; i++) {
          const c = line[i];
          if (inQ) {
            if (c === '"' && line[i+1] === '"') { cur += '"'; i++; }
            else if (c === '"') { inQ = false; }
            else { cur += c; }
          } else {
            if (c === '"') { inQ = true; }
            else if (c === sep) { out.push(cur); cur = ''; }
            else { cur += c; }
          }
        }
        out.push(cur);
        return out.map(s => s.trim());
      },

      _parseCsvFull(text, sep) {
        const lines = String(text || '').split(/\r?\n/).filter(l => l.trim());
        if (!lines.length) return { headers: [], rows: [] };
        const headers = Actions._parseCsvRow(lines[0], sep);
        const rows = lines.slice(1).map(l => Actions._parseCsvRow(l, sep));
        return { headers, rows };
      },

      // V35.3.7 — Heurística de auto-mapping. Reduz cliques no Step 2.
      _autoMapHeaders(headers) {
        const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
        const map = {};
        for (const h of headers) {
          const n = norm(h);
          if (/^(e[-_ ]?mail|email|email[-_ ]?address|correo)$/i.test(n)) map[h] = 'email';
          else if (/^(nome|name|nome[-_ ]?completo|full[-_ ]?name|nombre|first[-_ ]?name)$/i.test(n)) map[h] = 'name';
          else if (/^(sobrenome|last[-_ ]?name|surname)$/i.test(n)) map[h] = 'name';
          else if (/^(telefone|phone|celular|whatsapp|tel|mobile|contact)$/i.test(n)) map[h] = 'phone';
          else if (/^(idade|age|anos)$/i.test(n)) map[h] = 'idade';
          else if (/^(estado|state|uf)$/i.test(n)) map[h] = 'estado';
          else if (/^(cidade|city)$/i.test(n)) map[h] = 'cidade';
          else if (/^(estado[-_ ]?civil|marital)$/i.test(n)) map[h] = 'estadoCivil';
          else if (/^(sexo|gender|genero)$/i.test(n)) map[h] = 'sexo';
          else if (/^(faixa[-_ ]?salarial|renda|income|salary)$/i.test(n)) map[h] = 'faixaSalarial';
          else if (/^(tags?|labels?|etiquetas)$/i.test(n)) map[h] = 'tags';
          else map[h] = 'skip';
        }
        return map;
      },

      handleLeadWizardFile(event) {
        const w = App.state.leadImportWizard;
        if (!w) return;
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
          const text = String(e.target.result || '');
          Actions._ingestWizardText(text, file.name);
        };
        reader.readAsText(file, 'utf-8');
        event.target.value = '';
      },

      handleLeadWizardPaste(text) {
        const w = App.state.leadImportWizard;
        if (!w) return;
        w.rawText = text;
        App.save(); // não render — preserva foco
      },

      submitLeadWizardPaste() {
        const w = App.state.leadImportWizard;
        if (!w || !w.rawText.trim()) {
          return Utils.toast('Cole o conteúdo CSV antes de continuar.');
        }
        Actions._ingestWizardText(w.rawText, null);
      },

      _ingestWizardText(text, fileName) {
        const w = App.state.leadImportWizard;
        if (!w) return;
        const sep = Actions._detectCsvSeparator(text);
        const parsed = Actions._parseCsvFull(text, sep);
        if (!parsed.headers.length || parsed.headers.every(h => !h)) {
          w.parseError = 'Não consegui detectar cabeçalho. CSV está vazio ou mal-formado.';
          App.render();
          return;
        }
        if (parsed.headers.length < 2 && !parsed.rows.length) {
          w.parseError = 'CSV tem só 1 coluna ou nenhum dado. Confirme o separador.';
          App.render();
          return;
        }
        w.rawText = text;
        w.fileName = fileName;
        w.separator = sep;
        w.headers = parsed.headers;
        w.rows = parsed.rows;
        w.preview = parsed.rows.slice(0, 5);
        w.mapping = Actions._autoMapHeaders(parsed.headers);
        w.parseError = null;
        w.step = 2;
        App.save(); App.render();
      },

      setLeadWizardMapping(csvCol, ljField) {
        const w = App.state.leadImportWizard;
        if (!w) return;
        w.mapping[csvCol] = ljField;
        App.render();
      },

      _validateMapping(mapping) {
        const used = Object.values(mapping || {});
        if (!used.includes('email') && !used.includes('phone')) {
          return { ok: false, error: 'Mapeie ao menos uma coluna pra Email OU Telefone — sem isso o lead não pode ser identificado.' };
        }
        return { ok: true };
      },

      async goToWizardReview() {
        const w = App.state.leadImportWizard;
        if (!w) return;
        const v = Actions._validateMapping(w.mapping);
        if (!v.ok) return Utils.toast(v.error);
        w.step = 3;
        App.render();
        // Dispara dedup preview conforme regra de volume
        Actions._loadWizardDedupPreview();
      },

      async _loadWizardDedupPreview() {
        const w = App.state.leadImportWizard;
        if (!w) return;
        const total = w.rows.length;
        // V35.3.7 — Regras de volume cravadas com Felipe:
        //   ≤ 20k  → preview com cafezinho loader
        //   ≤ 50k  → preview com aviso "vai demorar mas dá certo"
        //   > 50k  → sugere lotes de 20k, sem preview (risco de quebrar)
        if (total > 50000) {
          w.dedupPreview = { skipped: true, reason: 'volume-high', total };
          App.render();
          return;
        }
        w.dedupPreview = {
          loading: true,
          warnSlow: total > 20000,
          total
        };
        App.render();
        // Extrai emails e phones do CSV mapeados
        const emailCol = Object.keys(w.mapping).find(c => w.mapping[c] === 'email');
        const phoneCol = Object.keys(w.mapping).find(c => w.mapping[c] === 'phone');
        const emails = []; const phones = [];
        for (const row of w.rows) {
          const obj = {};
          w.headers.forEach((h, i) => { obj[h] = row[i]; });
          if (emailCol && obj[emailCol]) emails.push(String(obj[emailCol]).toLowerCase().trim());
          if (phoneCol && obj[phoneCol]) phones.push(String(obj[phoneCol]).replace(/\D/g, ''));
        }
        try {
          const token = localStorage.getItem('lj_jwt');
          const r = await fetch('/api/leads-dedup-preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ emails, phones, bank_id: w.bankId })
          });
          const data = await r.json();
          if (data.ok) {
            w.dedupPreview = {
              loading: false,
              warnSlow: total > 20000,
              total,
              duplicateEmails: Number(data.duplicateEmails || 0),
              duplicatePhones: Number(data.duplicatePhones || 0)
            };
          } else {
            w.dedupPreview = { loading: false, error: data.message || 'Falha no preview' };
          }
          App.render();
        } catch (err) {
          w.dedupPreview = { loading: false, error: err.message };
          App.render();
        }
      },

      setLeadWizardDedupBehavior(behavior) {
        const w = App.state.leadImportWizard;
        if (!w) return;
        w.dedupBehavior = behavior === 'skip' ? 'skip' : 'update';
        App.render();
      },

      toggleLeadWizardOriginTag() {
        const w = App.state.leadImportWizard;
        if (!w) return;
        w.applyOriginTag = !w.applyOriginTag;
        App.render();
      },

      setLeadWizardOriginTag(text) {
        const w = App.state.leadImportWizard;
        if (!w) return;
        w.originTag = String(text || '').trim();
        // sem render — preserva foco
      },

      async executeLeadWizardImport() {
        const w = App.state.leadImportWizard;
        if (!w) return;
        w.step = 4;
        w.result = { running: true, processed: 0, total: w.rows.length };
        App.render();

        // V35.3.9 — Fix: quando 2+ colunas mapeiam pro MESMO campo:
        //   - 'name' concatena (já era assim)
        //   - 'tags' agora ACUMULA tags de todas as colunas (era sobrescrever)
        //   - 'phone' / qualquer outro: usa o PRIMEIRO não-vazio (era sobrescrever)
        const ljLeads = [];
        for (const row of w.rows) {
          const obj = {};
          w.headers.forEach((h, i) => {
            const dest = w.mapping[h];
            if (!dest || dest === 'skip') return;
            const val = row[i] || '';
            if (dest === 'name') {
              obj.name = obj.name ? (obj.name + ' ' + val).trim() : String(val).trim();
            } else if (dest === 'tags') {
              const newTags = String(val).split(/[,;]/).map(t => t.trim()).filter(Boolean);
              if (newTags.length) {
                obj.tags = Array.isArray(obj.tags) ? [...obj.tags, ...newTags] : newTags;
              }
            } else {
              // First-non-empty wins (preserva valor da 1ª coluna mapeada pro campo)
              if (!obj[dest] && val) obj[dest] = val;
            }
          });
          // Dedup tags do mesmo lead
          if (Array.isArray(obj.tags)) obj.tags = [...new Set(obj.tags)];
          if (obj.email || obj.phone) ljLeads.push(obj);
        }

        // V35.3.7 — Chunking de 100 em 100 (limite hard do endpoint).
        const CHUNK_SIZE = 100;
        const token = localStorage.getItem('lj_jwt');
        let totalCreated = 0, totalUpdated = 0, totalSkipped = 0, totalErrors = 0;

        for (let i = 0; i < ljLeads.length; i += CHUNK_SIZE) {
          const chunk = ljLeads.slice(i, i + CHUNK_SIZE);
          try {
            const r = await fetch('/api/leads-import-batch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                bank_id: w.bankId,
                source: 'mailing-csv',
                leads: chunk,
                dedup_behavior: w.dedupBehavior,
                origin_tag: w.applyOriginTag ? w.originTag : null
              })
            });
            const data = await r.json();
            if (data.ok) {
              totalCreated += Number(data.created || 0);
              totalUpdated += Number(data.updated || 0);
              totalSkipped += Number(data.skipped || 0);
              totalErrors  += Array.isArray(data.errors) ? data.errors.length : Number(data.errors || 0);
            } else {
              totalErrors += chunk.length;
            }
          } catch (err) {
            totalErrors += chunk.length;
          }
          // Atualiza progress
          w.result = {
            running: i + CHUNK_SIZE < ljLeads.length,
            total: ljLeads.length,
            processed: Math.min(i + CHUNK_SIZE, ljLeads.length),
            created: totalCreated,
            updated: totalUpdated,
            skipped: totalSkipped,
            errors: totalErrors
          };
          App.render();
        }

        w.result.running = false;
        Actions._notifyHomeBellImportReport(w.result);
        App.save(); App.render();
      },

      // V35.3.7 — Pendura relatório do import no sininho da Home.
      _notifyHomeBellImportReport(result) {
        App.state.leadImportReports = Array.isArray(App.state.leadImportReports) ? App.state.leadImportReports : [];
        App.state.leadImportReports.unshift({
          id: Date.now(),
          when: new Date().toISOString(),
          ...result
        });
        App.state.leadImportReports = App.state.leadImportReports.slice(0, 10);
        App.state.pendingLeadImportReports = (App.state.pendingLeadImportReports || 0) + 1;
        App.save();
      },

      openImportReportsModal(tab) {
        App.state.importReportsModalOpen = true;
        App.state.pendingLeadImportReports = 0;
        // V35.3.8 — Ao abrir, marca todas as releases como vistas
        if (window.LJVersion) App.state.lastSeenVersion = window.LJVersion;
        // V35.9.3 — Aceita tab opcional ('updates' | 'alerts'). Se não vier,
        // decide pela presença de alertas — alerta no ar → entra em Alertas.
        const valid = ['updates', 'alerts'];
        if (valid.includes(tab)) {
          App.state.notificationsTab = tab;
        } else {
          const alerts = Actions._getNotificationAlerts ? Actions._getNotificationAlerts() : [];
          App.state.notificationsTab = alerts.length ? 'alerts' : 'updates';
        }
        App.save(); App.render();
      },
      // V35.9.3 — Alias semântico mais limpo. Mesma função.
      openNotificationsModal(tab) { Actions.openImportReportsModal(tab); },
      setNotificationsTab(tab) {
        const valid = ['updates', 'alerts'];
        if (!valid.includes(tab)) return;
        App.state.notificationsTab = tab;
        App.save(); App.render();
      },
      // V35.9.3 — Coleta alertas do tenant (ads órfãs, reconciliação RD,
      // pode crescer com integrações futuras). Cada alerta: { id, icon,
      // title, description, action?, actionLabel?, severity? }.
      // V35.11.0 — severity controla cor do card no modal de alertas:
      //   'warning' = amber, 'critical' = rose (default rose se ausente).
      _getNotificationAlerts() {
        const alerts = [];

        // V36.8.0 — Alerta de boas-vindas (só pra cliente, dispensável).
        // Aparece no primeiro acesso após criação do tenant. Fica até cliente
        // clicar "Entendido" no modal. Não aparece pro master (já conhece o LJ).
        const cu = App.currentUser || {};
        const isCliente = cu.isMaster === false;
        if (isCliente && !App.state.welcomeDismissed) {
          alerts.push({
            id: 'welcome-lj',
            icon: 'sparkles',
            title: '🚀 Bem-vindo ao LeadJourney',
            description: 'Aqui você opera o ciclo completo de receita: capta leads (RD, Hotmart, ads, formulários), pontua e qualifica, visualiza o pulso da operação, conecta com outras plataformas e constrói seu Mapa da Receita. Tem o Djow (sua IA) pra buscar e configurar tudo. Vamos começar?',
            action: 'Actions.dismissWelcome()',
            actionLabel: 'Entendido, vamos começar',
            severity: 'info'
          });
        }

        // V36.8.0 — Alerta crítico: cliente sem banco de dados plugado.
        // Aparece pra cliente cujo tenant não tem db_connection_string_enc.
        // Bloqueia integrações até resolver. Não aparece pro master.
        if (isCliente && cu.tenantDbPlugged === false) {
          alerts.push({
            id: 'tenant-db-missing',
            icon: 'database',
            title: '🔴 Configure um banco de dados',
            description: 'Pra ativar as integrações com outras plataformas, sincronizar entre dispositivos e receber webhooks em tempo real, conecte seu próprio Postgres. Recomendamos Railway (R$30-50/mês, setup em 5min, backups automáticos). Também funciona com Neon, Supabase ou seu próprio. Enquanto sem banco: dados ficam só no seu navegador, sem sync, sem webhooks, sem integrações.',
            action: 'Actions.openTenantDbWizard()',
            actionLabel: 'Conectar banco de dados →',
            severity: 'critical'
          });
        }

        // 1. Ads órfãs (Google Ads não associadas a Campanha LJ)
        const adsOrphanCount = Actions.getAdsOrphanBellCount ? Actions.getAdsOrphanBellCount() : 0;
        if (adsOrphanCount > 0) {
          alerts.push({
            id: 'ads-orphan',
            icon: 'link-2-off',
            title: `${adsOrphanCount} campanha(s) Google Ads sem vínculo`,
            description: 'Vincule a uma Campanha LJ pra os números entrarem nos roll-ups (RevOps, Mapa da Receita, Home).',
            action: 'Actions.openAdsOrphanInbox()',
            actionLabel: 'Abrir Dashboard',
            severity: 'critical'
          });
        }
        // 2. Reconciliação RD pendente
        const reconCount = Number(App.state.pendingReconciliationCount || 0);
        if (reconCount > 0) {
          alerts.push({
            id: 'rd-recon',
            icon: 'refresh-cw',
            title: `${reconCount} conciliação(ões) RD aguardando`,
            description: 'Discrepâncias entre RD Station e LJ precisam de decisão.',
            action: 'Actions.openReconciliationModal()',
            actionLabel: 'Abrir Conciliação',
            severity: 'critical'
          });
        }
        // V35.14.5 — Alertas GA4
        const ga4Alerts = Actions._getGa4Alerts ? Actions._getGa4Alerts() : [];
        ga4Alerts.forEach(a => alerts.push(a));
        // 3. V35.11.0 — Falhas de webhook RD agregadas (até cliente marcar como visto).
        // Escalada: 1-9 = amber/warning, 10+ = rose/critical.
        const wh = App.state.rdWebhookFailuresSummary || {};
        const whCount = Number(wh.count || 0);
        if (whCount > 0) {
          const severity = whCount >= 10 ? 'critical' : 'warning';
          const breakdown = wh.breakdown || {};
          const breakdownLabels = {
            validation: 'validação',
            db: 'banco',
            'tenant-resolve': 'tenant',
            unknown: 'desconhecido'
          };
          const breakdownText = Object.keys(breakdown)
            .map(k => `${breakdown[k]} ${breakdownLabels[k] || k}`)
            .join(' · ');
          alerts.push({
            id: 'rd-webhook-failures',
            icon: 'webhook',
            title: `${whCount} webhook${whCount > 1 ? 's' : ''} do RD falharam`,
            description: breakdownText
              ? `Quebra por tipo: ${breakdownText}. Veja o log completo em Configurações > Meu Banco.`
              : 'O LJ recebeu webhooks do RD mas não conseguiu processar. Veja o log em Configurações > Meu Banco.',
            action: 'Actions.openRdWebhookLogModal(); Actions.markRdWebhookFailuresAsRead()',
            actionLabel: 'Ver log e marcar como visto',
            severity
          });
        }

        // V37.0.4 — Pendências de Fechamento Mensal (consolidated_monthly partial)
        const govList = App.state.governanceClosings?.list || [];
        const monthlyPartials = govList.filter(c => c.kind === 'consolidated_monthly' && c.status === 'partial');
        if (monthlyPartials.length > 0) {
          const periods = monthlyPartials.map(c => c.period).sort().reverse().slice(0, 3).join(', ');
          const more = monthlyPartials.length > 3 ? ` +${monthlyPartials.length - 3} mais` : '';
          const firstId = monthlyPartials[0].id;
          alerts.push({
            id: 'governance-monthly-partial',
            icon: 'calendar-check',
            title: `${monthlyPartials.length} fechamento${monthlyPartials.length === 1 ? '' : 's'} mensal aguardando consolidação`,
            description: `Mês(es) parcialmente fechado(s): ${periods}${more}. Associe os produtos que entram no consolidado ou confirme "não consolidar este mês" pra fechar a decisão.`,
            action: `Actions.openGovernanceClosingFromAlert(${firstId})`,
            actionLabel: 'Abrir Fechamento',
            severity: 'warning'
          });
        }

        return alerts;
      },

      // V37.0.4 — Atalho do alerta de pendência: abre o snapshot direto
      openGovernanceClosingFromAlert(closingId) {
        // Fecha modal de notificações (se aberto)
        if (App.state.importReportsModalOpen) {
          App.state.importReportsModalOpen = false;
        }
        // Garante que está na view RevOps Whitelabel + aba Fechamento
        const products = Array.isArray(App.state.products) ? App.state.products : [];
        const firstProductId = products[0]?.id;
        if (firstProductId) {
          App.state.activeProductId = firstProductId;
        }
        App.state.activeView = 'revopsWhitelabel';
        App.state.revopsWhitelabelActiveTab = 'fechamento';
        if (firstProductId) {
          App.state.revopsFechamentoScope = App.state.revopsFechamentoScope || {};
          App.state.revopsFechamentoScope[firstProductId] = 'monthly';
        }
        App.state.governanceClosingOpen = Number(closingId);
        App.save(); App.render();
      },

      // V35.11.0 — Carrega summary das falhas de webhook RD pro sininho.
      // Chamado no boot + em loop leve (60s) pelo timer de notifications.
      async loadRdWebhookFailuresSummary() {
        try {
          const token = localStorage.getItem('lj_jwt');
          if (!token) return;
          const r = await fetch('/api/rd-webhook-failures-summary', {
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await r.json();
          if (data.ok) {
            App.state.rdWebhookFailuresSummary = {
              count: data.count || 0,
              breakdown: data.breakdown || {},
              firstFailureAt: data.firstFailureAt || null,
              lastFailureAt: data.lastFailureAt || null,
              loadedAt: new Date().toISOString()
            };
            App.save(); App.render();
          }
        } catch (err) {
          console.warn('[loadRdWebhookFailuresSummary]', err.message);
        }
      },

      // V35.11.0 — Marca todas as falhas atuais como vistas. Reseta o sininho.
      // Próxima falha vira nova vaga e gera notificação imediatamente.
      async markRdWebhookFailuresAsRead() {
        try {
          const token = localStorage.getItem('lj_jwt');
          if (!token) return;
          const r = await fetch('/api/rd-webhook-failures-summary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ action: 'mark_read' })
          });
          const data = await r.json();
          if (data.ok) {
            App.state.rdWebhookFailuresSummary = { count: 0, breakdown: {}, firstFailureAt: null, lastFailureAt: null, loadedAt: new Date().toISOString() };
            App.save(); App.render();
          }
        } catch (err) {
          console.warn('[markRdWebhookFailuresAsRead]', err.message);
        }
      },

      // V35.11.0 — Abre modal de Log de Erros (Configurações > Meu Banco).
      openRdWebhookLogModal() {
        App.state.rdWebhookLogModalOpen = true;
        App.state.rdWebhookLogFilters = { status: 'all', eventType: '', period: '7d', search: '', page: 1 };
        App.save(); App.render();
        setTimeout(() => Actions.loadRdWebhookLog(), 50);
      },
      closeRdWebhookLogModal() {
        App.state.rdWebhookLogModalOpen = false;
        App.save(); App.render();
      },
      setRdWebhookLogFilter(field, value) {
        const f = App.state.rdWebhookLogFilters || { status: 'all', eventType: '', period: '7d', search: '', page: 1 };
        f[field] = value;
        if (field !== 'page') f.page = 1; // qualquer filtro reseta página
        App.state.rdWebhookLogFilters = f;
        App.save(); App.render();
        // debounce simples no search; outros filtros disparam direto
        clearTimeout(Actions._rdLogFilterTimer);
        Actions._rdLogFilterTimer = setTimeout(() => Actions.loadRdWebhookLog(), field === 'search' ? 400 : 50);
      },
      setRdWebhookLogPage(page) {
        const f = App.state.rdWebhookLogFilters || {};
        f.page = Math.max(1, Number(page) || 1);
        App.state.rdWebhookLogFilters = f;
        App.save(); App.render();
        setTimeout(() => Actions.loadRdWebhookLog(), 50);
      },
      async loadRdWebhookLog() {
        App.state.rdWebhookLogCache = { ...(App.state.rdWebhookLogCache || {}), loading: true };
        App.render();
        try {
          const token = localStorage.getItem('lj_jwt');
          const f = App.state.rdWebhookLogFilters || {};
          const params = new URLSearchParams({
            status: f.status || 'all',
            event_type: f.eventType || '',
            period: f.period || '7d',
            search: f.search || '',
            page: String(f.page || 1),
            per_page: '50'
          });
          const r = await fetch(`/api/rd-webhook-log?${params}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await r.json();
          if (data.ok) {
            App.state.rdWebhookLogCache = {
              items: data.items || [],
              total: data.total || 0,
              page: data.page || 1,
              perPage: data.perPage || 50,
              totalPages: data.totalPages || 1,
              loadedAt: new Date().toISOString(),
              loading: false
            };
          } else {
            App.state.rdWebhookLogCache = { ...(App.state.rdWebhookLogCache || {}), loading: false };
            Utils.toast(`Erro: ${data.message || 'Falha ao carregar log.'}`);
          }
          App.save(); App.render();
        } catch (err) {
          App.state.rdWebhookLogCache = { ...(App.state.rdWebhookLogCache || {}), loading: false };
          App.save(); App.render();
          Utils.toast(`Erro: ${err.message}`);
        }
      },
      downloadRdWebhookLogCsv() {
        const token = localStorage.getItem('lj_jwt');
        const f = App.state.rdWebhookLogFilters || {};
        const params = new URLSearchParams({
          status: f.status || 'all',
          event_type: f.eventType || '',
          period: f.period || '7d',
          search: f.search || '',
          format: 'csv'
        });
        // Browser não suporta Authorization header em window.open. Usamos fetch + blob.
        fetch(`/api/rd-webhook-log?${params}`, {
          headers: { Authorization: `Bearer ${token}` }
        }).then(r => r.blob()).then(blob => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `rd-webhook-log-${new Date().toISOString().slice(0, 10)}.csv`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        }).catch(err => Utils.toast(`Erro ao baixar: ${err.message}`));
      },
      closeImportReportsModal() {
        App.state.importReportsModalOpen = false;
        App.save(); App.render();
      },
      clearImportReports() {
        App.state.leadImportReports = [];
        App.state.pendingLeadImportReports = 0;
        App.save(); App.render();
      },

      // V35.3.8 — Compara duas versões "Vmaj.med.peq.tiny" sem dependência.
      // Retorna >0 se a>b, <0 se a<b, 0 se igual.
      _compareLJVersion(a, b) {
        if (!a || !b) return a === b ? 0 : (a ? 1 : -1);
        const parse = v => String(v).replace(/^[Vv]/, '').split(/[.-]/).map(p => parseInt(p, 10) || 0);
        const pa = parse(a), pb = parse(b);
        const len = Math.max(pa.length, pb.length);
        for (let i = 0; i < len; i++) {
          const da = pa[i] || 0, db = pb[i] || 0;
          if (da !== db) return da - db;
        }
        return 0;
      },

      // V35.3.8 — Lista releases ainda não vistas pelo usuário.
      _getUnseenReleases() {
        const all = window.LJChangelog || [];
        const lastSeen = App.state.lastSeenVersion;
        if (!lastSeen) return all; // primeira vez vê tudo
        return all.filter(r => Actions._compareLJVersion(r.version, lastSeen) > 0);
      },

      // V35.3.8 — Marca uma única release específica como vista (botão "OK").
      markReleaseAsSeen(version) {
        const current = App.state.lastSeenVersion;
        if (!current || Actions._compareLJVersion(version, current) > 0) {
          App.state.lastSeenVersion = version;
          App.save(); App.render();
        }
      },
      setLeadImportBank(bankId) {
        App.state.leadImportBankId = bankId ? Number(bankId) : null;
        App.save(); App.render();
      },

      setLeadBaseInputMode(mode) { App.state.leadBaseInputMode = mode; App.save(); App.render(); },
      handleGlobalLeadCSV(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => { App.state.leadCsvText = String(e.target.result || '').trim(); App.save(); App.render(); Utils.toast('CSV carregado. Clique em importar para salvar na base.'); };
        reader.readAsText(file);
        event.target.value = '';
      },
      downloadGlobalLeadCsvTemplate() {
        const csv = ['Nome,Telefone,Email,Idade,Estado,Cidade,Estado Civil,Sexo,Faixa Salarial,Tags', 'Nome do Lead,48999999999,email@empresa.com,38,SC,Florianópolis,Casado(a),Feminino,R$ 5 mil a R$ 10 mil,#tag_exemplo', 'Outro Lead,48988888888,outro@email.com,42,SP,São Paulo,Solteiro(a),Masculino,R$ 10 mil a R$ 20 mil,#cta'].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'modelo_leads_globais.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      },
      // V32.4.0 (Geraldo Item 6) — trocou DatabaseService.emptyDataState() por State.initial()
      // pois databaseService refatorado pra manter só helpers de state migration.
      resetDemo() { StorageAdapter.clear(); App.state = State.initial(); App.render(); Utils.toast('Dados locais limpos.'); },
      async applyProfileSearch() {
        const q = App.state.profileQuery || '';
        if (!String(q).trim()) {
          App.state.profileFilters = [];
          App.state.profileActive = false;
          App.save(); App.render();
          return;
        }

        Utils.toast('Interpretando busca com IA...');
        const interpretation = await AISearchClient.interpret(q);
        const filters = interpretation.filters || [];
        const warnings = interpretation.warnings || [];
        const allLeads = LeadsModule.getGlobalLeads();

        if (!filters.length && q.trim()) {
          Utils.searchLog('Não consegui interpretar a busca', [
            ...warnings,
            'A IA não conseguiu transformar sua frase em filtros seguros.',
            'Tente explicitar sexo, idade, estado/cidade, score, tags ou temperatura.'
          ], 'error');
          Utils.toast('Busca não interpretada.');
          return;
        }

        App.state.profileFilters = filters;
        App.state.profileActive = filters.length > 0;
        App.save(); App.render();

        if (filters.length) {
          const filtered = ProfileFinder.applyFilters(allLeads, filters);
          const sourceMessage = interpretation.source === 'openai'
            ? 'Fonte: IA no backend.'
            : 'Fonte: fallback local, porque a IA/backend ainda não respondeu.';

          if (!filtered.length) {
            Utils.searchLog('Busca sem resultado', [
              sourceMessage,
              ...warnings,
              ...(interpretation.messages || []),
              ...ProfileFinder.explainNoResults(allLeads, filters, q)
            ], 'warning');
          } else {
            const groupSearch = filters.some(filter => filter.type === 'or_segments');
            const logicMessage = groupSearch
              ? 'A busca foi interpretada como clusters de público somados por “E”. Exemplo: homens 20-30 + mulheres 30-40.'
              : 'A lógica usada foi: filtros diferentes afunilam juntos; múltiplos valores do mesmo campo entram como classes do perfil.';
            const logType = warnings.length || interpretation.source !== 'openai' ? 'warning' : 'success';
            const title = warnings.length ? 'Busca aplicada com alerta' : 'Busca aplicada';
            Utils.searchLog(title, [sourceMessage, ...warnings, `${filtered.length} lead(s) encontrado(s).`, 'Interpretação:', ...(interpretation.messages || []), logicMessage], logType);
          }
        }
      },
      refineProfile() {
        const input = document.getElementById('refineInput');
        if (!input) return;
        const q = input.value.trim();
        if (!q) return;
        const newFilters = ProfileFinder.parseQuery(q);
        if (!newFilters.length) {
          Utils.searchLog('Refino não interpretado', ['Use termos como: com telefone, score acima de 50, quente, SP, #cta.'], 'error');
          Utils.toast('Não entendi o refino.');
          return;
        }
        const existing = App.state.profileFilters.map(f => f.label);
        newFilters.forEach(f => { if (!existing.includes(f.label)) App.state.profileFilters.push(f); });
        App.state.profileActive = true;
        input.value = '';
        App.save(); App.render();
        // V34.0.0 Onda 4 — Refino opera sobre visitorSearchResults quando há busca
        // server-side ativa; caso contrário, fallback pro getGlobalLeads legacy.
        const baseLeads = App.state.visitorSearchResults?.loadedAt
          ? (App.state.visitorSearchResults.visitors || [])
          : LeadsModule.getGlobalLeads();
        const filtered = ProfileFinder.applyFilters(baseLeads, App.state.profileFilters);
        if (!filtered.length) Utils.searchLog('Refino sem resultado', ProfileFinder.explainNoResults(baseLeads, App.state.profileFilters, q), 'warning');
        else Utils.toast('Perfil refinado.');
      },
      removeProfileFilter(index) {
        App.state.profileFilters.splice(index, 1);
        if (!App.state.profileFilters.length) App.state.profileActive = false;
        App.save(); App.render();
      },
      clearProfile() {
        App.state.profileQuery = '';
        App.state.profileFilters = [];
        App.state.profileActive = false;
        App.save(); App.render();
        Utils.toast('Perfil limpo.');
      },
      // V38.1.42 — Filtro de camada de audiência (Suspect/PA/ICP/BP) na lista de leads.
      setLeadAudienceFilter(layer) {
        const valid = ['all','lj-suspect','lj-pa','lj-icp','lj-bp'];
        App.state.leadAudienceFilter = valid.includes(layer) ? layer : 'all';
        App.save(); App.render();
      },
      // V38.1.43 — Modal "Por que esse lead virou X?" drill-down do ICP.
      openAudienceDrillModal(leadId, productId) {
        App.state.audienceDrillModal = { open: true, leadId, productId: productId || null, djowHints: {} };
        App.save(); App.render();
      },
      closeAudienceDrillModal() {
        App.state.audienceDrillModal = null;
        App.save(); App.render();
      },
      // V38.1.46 — Pede ao Djow uma sugestão dinâmica pra uma estratégia de coleta
      // dentro do drill-down. Resposta vai pra App.state.audienceDrillModal.djowHints[strategyKey].
      async djowAudienceCollectHint(strategyKey) {
        const m = App.state.audienceDrillModal;
        if (!m || !m.open) return;
        m.djowHints = m.djowHints || {};
        const slot = m.djowHints[strategyKey] = { loading: true, hint: null, error: null };
        App.save(); App.render();

        try {
          if (!window.AudienceCollectionAdvisor || !window.AudienceTransmutationEngine) {
            slot.loading = false;
            slot.error = 'Engines de audiência não carregadas.';
            App.save(); App.render();
            return;
          }
          const lead = []
            .concat(App.state.globalLeads || [])
            .concat((App.state.actions || []).flatMap(a => a.leads || []))
            .find(l => String(l.id) === String(m.leadId));
          if (!lead) { slot.loading = false; slot.error = 'Lead não encontrado.'; App.save(); App.render(); return; }
          const result = AudienceTransmutationEngine.getLayerForLead(lead, m.productId);
          if (!result) { slot.loading = false; slot.error = 'Produto sem audiência configurada.'; App.save(); App.render(); return; }
          const product = (App.state.products || []).find(p => Number(p.id) === Number(m.productId));
          const allMissing = [
            ...(result.details.pa.missing || []),
            ...(result.details.icp.missing || []),
            ...(result.details.bp.missing || [])
          ];
          const groups = AudienceCollectionAdvisor.groupByStrategy(allMissing);
          const group = groups[strategyKey];
          if (!group || !group.fields.length) {
            slot.loading = false;
            slot.error = 'Sem campos faltando nessa estratégia.';
            App.save(); App.render();
            return;
          }
          const token = localStorage.getItem('lj_jwt');
          const r = await fetch('/api/djow-audience-collect-hint', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              strategyKey,
              fields: group.fields.map(f => ({ key: f.key, label: f.label, type: f.type })),
              productName: product?.name || '',
              modeloNegocio: product?.audience?.modeloNegocio || '',
              modeloOperacional: product?.audience?.modeloOperacional || ''
            })
          });
          const data = await r.json();
          slot.loading = false;
          if (!data.ok) { slot.error = data.message || `HTTP ${r.status}`; App.save(); App.render(); return; }
          slot.hint = data.hint || '';
          App.save(); App.render();
        } catch (err) {
          slot.loading = false;
          slot.error = err.message || String(err);
          App.save(); App.render();
        }
      },
      // V37.0.9 — Sem mais preencher leadsText/leadInputMode/rdListName/scoreId
      // no draft (mailing inline removido). Cliente cria a ação a partir do
      // perfil e anexa base depois pelo Lead Import Wizard se quiser.
      createActionFromProfile() {
        const allLeads = LeadsModule.getGlobalLeads();
        const filtered = ProfileFinder.applyFilters(allLeads, App.state.profileFilters);
        if (!filtered.length) return Utils.toast('Nenhum lead no perfil.');
        const filtersDesc = App.state.profileFilters.map(f => f.label).join(', ');
        App.state.actionDraft = {
          campaignId: App.state.selectedCampaignId,
          name: `Ação: ${filtersDesc}`.substring(0, 60),
          channel: 'Meta Ads',
          objective: `Ação direcionada ao perfil: ${filtersDesc}`
        };
        App.state.activeTab = 'actions';
        App.save(); App.render();
        Utils.toast(`Perfil de ${filtered.length} lead(s) selecionado. Ação preparada.`);
      },
      createCampaignFromProfile() {
        const filtersDesc = App.state.profileFilters.map(f => f.label).join(', ');
        App.state.campaignDraft = {
          name: `Campanha: ${filtersDesc}`.substring(0, 60),
          objective: `Campanha para perfil: ${filtersDesc}`,
          okrs: Utils.clone(Config.emptyOkrs),
          owner: ''
        };
        App.state.activeTab = 'campaigns';
        App.save(); App.render();
        Utils.toast('Rascunho de campanha preparado.');
      }
    };
window.Actions = Actions;

// RevOps patches 1-5: operational overrides and helpers.
Object.assign(Actions, {
  // V38.1.0 — Modal Saúde do Produto. Abre via "?" no card.
  openHealthScoreModal(productId) {
    App.state.healthModal = { productId: Number(productId), djowAnalysis: null };
    App.render();
  },

  closeHealthScoreModal() {
    App.state.healthModal = null;
    App.render();
  },

  // V38.1.0 — Pede análise pro Djow. Lazy (1 call quando user clica).
  // Endpoint dedicado pra não pagar overhead do djow-chat full loop.
  async askDjowHealthAnalysis(productId) {
    const modal = App.state.healthModal;
    if (!modal || Number(modal.productId) !== Number(productId)) return;
    modal.djowAnalysis = { loading: true, error: null, byDimension: null, verdict: null };
    App.render();
    try {
      if (!window.HealthScoreEngine) throw new Error('Engine de Saúde não carregado.');
      const product = (App.state.products || []).find(p => Number(p.id) === Number(productId));
      if (!product) throw new Error('Produto não encontrado.');
      const computed = HealthScoreEngine.compute(productId);
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/djow-health-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          productId,
          productName: product.name,
          productType: product.type || '',
          revenueModel: product.revenueModel || '',
          score: computed.score,
          tier: computed.tier.label,
          gargalo: computed.gargalo.label,
          fatores: {
            eficacia: { value: computed.fatores.eficacia.value, total: computed.fatores.eficacia.total, done: computed.fatores.eficacia.done },
            cobertura: { value: computed.fatores.cobertura.value, areasComKr: computed.fatores.cobertura.areasComKr, areasFaltantes: computed.fatores.cobertura.areasFaltantes },
            krs: { value: computed.fatores.krs.value, count: computed.fatores.krs.krsConfirmadosCount, krs: (computed.fatores.krs.krs || []).map(k => ({ name: k.kr.metric, tier: k.tier, label: k.label })) },
            resultado: { value: computed.fatores.resultado.value, meta: computed.fatores.resultado.metaConsolidada, vendas: computed.fatores.resultado.vendasRealizadas, hasCheckout: computed.fatores.resultado.hasCheckoutConnected, hasMeta: computed.fatores.resultado.hasMeta }
          }
        })
      });
      const data = await r.json();
      if (!data.ok) throw new Error(data.message || 'Djow recusou a análise.');
      modal.djowAnalysis = {
        loading: false, error: null,
        byDimension: data.byDimension || {},
        verdict: data.verdict || ''
      };
      App.render();
    } catch (err) {
      const m = App.state.healthModal;
      if (m) {
        m.djowAnalysis = { loading: false, error: err.message, byDimension: null, verdict: null };
        App.render();
      }
    }
  },

  // V38.0.3 — Garante revopsFinanceV2[productId] com pelo menos 1 oferta default.
  // Usado em createProduct + confirmNewProductWithMapa + migration de clientes
  // existentes que tem metasResultado mas nenhuma oferta cadastrada.
  // Não sobrescreve se já houver oferta — idempotente.
  _ensureRevopsOffersForProduct(productId, productName) {
    if (!window.RevopsWhitelabelEngine?.defaultOffer) return;
    App.state.revopsFinanceV2 = App.state.revopsFinanceV2 || {};
    let cfg = App.state.revopsFinanceV2[productId];
    if (!cfg) {
      cfg = RevopsWhitelabelEngine.defaultConfig(productId);
      App.state.revopsFinanceV2[productId] = cfg;
    }
    if (!Array.isArray(cfg.offers) || !cfg.offers.length) {
      cfg.offers = [RevopsWhitelabelEngine.defaultOffer(productName || 'Produto Principal', 0)];
    }
  },

  createProduct() {
    const d = App.state.productDraft || {};
    if (!String(d.name || '').trim()) return Utils.toast('Digite o nome do produto.');
    if (this._demoGuard && this._demoGuard('Criar produto')) return null;
    const pendingDraft = {
      name: d.name.trim(),
      type: d.type || '',
      price: d.price || '',
      revenueModel: d.revenueModel || 'Venda única',
      operationalCost: d.operationalCost || ''
    };
    // V38.1.37 — Se cliente já definiu audiência pré-submit (botão "Definir
    // Audiência" no form), cria direto. Caso contrário, abre wizard como
    // bloqueio hard (V38.1.36).
    if (d.audience && d.audience.configured) {
      return this._finalizeProductCreation(pendingDraft, d.audience);
    }
    this.openAudienceWizardForNewProduct(pendingDraft, 'createProduct');
    return null;
  },

  _finalizeProductCreation(pendingDraft, audience) {
    const product = ProductRevenueEngine.normalize({
      id: Date.now(),
      name: pendingDraft.name,
      type: pendingDraft.type || '',
      price: pendingDraft.price || '',
      revenueModel: pendingDraft.revenueModel || 'Venda única',
      operationalCost: pendingDraft.operationalCost || '',
      audience
    });
    App.state.products.unshift(product);
    App.state.selectedProductId = product.id;
    App.state.campaignDraft.productId = product.id;
    App.state.productDraft = { name: '', type: '', price: '', revenueModel: 'Venda única', operationalCost: '', audience: null };
    // V38.0.3 — Oferta default + struct RevOps zerada pra esse produto. Antes,
    // produto novo nascia sem oferta — TM=0, Faturamento=0, sem cadastro de
    // meta. Agora cliente já vê 1 oferta "Padrão" preenchível.
    this._ensureRevopsOffersForProduct(product.id, product.name);
    App.save(); App.render(); Utils.toast('Produto criado e pronto para receber campanhas.');
    // V37.4.3 — emit notification tenant_wide
    if (window.LJEmit) window.LJEmit({
      audience: 'tenant_wide',
      kind: 'event.product_created',
      category: 'event',
      severity: 'info',
      title: `Novo produto criado: ${product.name}`,
      data: { productId: product.id, productName: product.name },
      entityKind: 'product',
      entityId: String(product.id)
    });
    return product;
  },

  // V38.1.36 — Wizard "Definir Audiência" (ICP do produto).
  openAudienceWizardForNewProduct(pendingDraft, mode) {
    App.state.audienceWizard = {
      open: true,
      mode: mode || 'createProduct',
      step: 0,
      productId: null,
      pendingDraft,
      modeloNegocio: null,
      modeloOperacional: null,
      salesChannel: null,
      quadroPA: [], quadroICP: [], quadroBP: [],
      customFields: { pa: [], icp: [], bp: [] }
    };
    App.save(); App.render();
  },
  // V38.1.38 — Abre wizard pra editar o audience do POPUP "Criar Produto
  // com Mapa". Salva em App.state.newProductWithMapaPopup.audience.
  openAudienceWizardForMapaPopup() {
    const popup = App.state.newProductWithMapaPopup || null;
    if (!popup || !popup.open) return;
    const a = popup.audience && typeof popup.audience === 'object' ? popup.audience : {};
    App.state.audienceWizard = {
      open: true,
      mode: 'mapaPopupDraft',
      step: a.configured ? 3 : 0,
      productId: null,
      pendingDraft: null,
      modeloNegocio: a.modeloNegocio || null,
      modeloOperacional: a.modeloOperacional || null,
      salesChannel: a.salesChannel || null,
      quadroPA: Array.isArray(a.quadroPA) ? [...a.quadroPA] : [],
      quadroICP: Array.isArray(a.quadroICP) ? [...a.quadroICP] : [],
      quadroBP: Array.isArray(a.quadroBP) ? [...a.quadroBP] : [],
      customFields: (a.customFields && typeof a.customFields === 'object')
        ? { pa: a.customFields.pa || [], icp: a.customFields.icp || [], bp: a.customFields.bp || [] }
        : { pa: [], icp: [], bp: [] }
    };
    App.save(); App.render();
  },
  // V38.1.37 — Abre wizard pra editar o audience DO DRAFT (pré-submit no
  // form "Criar Produto sem Mapa"). Salva em App.state.productDraft.audience
  // e fecha sem criar produto.
  openAudienceWizardForDraft() {
    const d = App.state.productDraft || {};
    const a = d.audience && typeof d.audience === 'object' ? d.audience : {};
    App.state.audienceWizard = {
      open: true,
      mode: 'draft',
      step: a.configured ? 3 : 0,
      productId: null,
      pendingDraft: null,
      modeloNegocio: a.modeloNegocio || null,
      modeloOperacional: a.modeloOperacional || null,
      salesChannel: a.salesChannel || null,
      quadroPA: Array.isArray(a.quadroPA) ? [...a.quadroPA] : [],
      quadroICP: Array.isArray(a.quadroICP) ? [...a.quadroICP] : [],
      quadroBP: Array.isArray(a.quadroBP) ? [...a.quadroBP] : [],
      customFields: (a.customFields && typeof a.customFields === 'object')
        ? { pa: a.customFields.pa || [], icp: a.customFields.icp || [], bp: a.customFields.bp || [] }
        : { pa: [], icp: [], bp: [] }
    };
    App.save(); App.render();
  },
  // V38.1.44 — Adiciona campo custom no quadro (Step 3 do wizard).
  addCustomAudienceField(layer) {
    const w = App.state.audienceWizard;
    if (!w || !w.open) return;
    if (!['pa','icp','bp'].includes(layer)) return;
    const label = (window.prompt('Nome do campo (curto):') || '').trim();
    if (!label) return;
    const isFit = window.confirm('Esse campo precisa BATER um critério pra contar (FIT)?\n\nOK = FIT (mais rigoroso, ex: cargo decisor exige cargo de chefia)\nCancelar = DADO (basta existir, ex: nome preenchido)');
    const isOptional = window.confirm('Esse campo é OPCIONAL (não conta no denominador do threshold)?\n\nOK = Opcional (fica de fora do cálculo)\nCancelar = Obrigatório (conta no threshold de 80%)');
    const key = 'custom_' + label.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') + '_' + Date.now().toString(36);
    w.customFields = w.customFields || { pa: [], icp: [], bp: [] };
    w.customFields[layer] = Array.isArray(w.customFields[layer]) ? w.customFields[layer] : [];
    w.customFields[layer].push({
      key,
      layer,
      type: isFit ? 'fit' : 'completude',
      label,
      optional: !!isOptional,
      custom: true,
      tooltip: 'Campo customizado pelo cliente.'
    });
    App.save(); App.render();
  },
  removeCustomAudienceField(layer, key) {
    const w = App.state.audienceWizard;
    if (!w || !w.open) return;
    if (!['pa','icp','bp'].includes(layer)) return;
    w.customFields = w.customFields || { pa: [], icp: [], bp: [] };
    w.customFields[layer] = (w.customFields[layer] || []).filter(f => f.key !== key);
    App.save(); App.render();
  },
  openAudienceWizardForExisting(productId) {
    const product = (App.state.products || []).find(p => Number(p.id) === Number(productId));
    if (!product) return;
    const a = product.audience || {};
    // V39.1.0 — Se o produto existente já tem audience configurado mas falta
    // salesChannel (pré-V39.1), abre direto no Step 2 pra o cliente escolher.
    const needsSalesChannel = a.configured && !a.salesChannel;
    App.state.audienceWizard = {
      open: true,
      mode: 'existingProduct',
      step: needsSalesChannel ? 2 : (a.configured ? 3 : 0),
      productId: Number(productId),
      pendingDraft: null,
      modeloNegocio: a.modeloNegocio || null,
      modeloOperacional: a.modeloOperacional || null,
      salesChannel: a.salesChannel || null,
      quadroPA: Array.isArray(a.quadroPA) ? [...a.quadroPA] : [],
      quadroICP: Array.isArray(a.quadroICP) ? [...a.quadroICP] : [],
      quadroBP: Array.isArray(a.quadroBP) ? [...a.quadroBP] : [],
      customFields: (a.customFields && typeof a.customFields === 'object')
        ? { pa: a.customFields.pa || [], icp: a.customFields.icp || [], bp: a.customFields.bp || [] }
        : { pa: [], icp: [], bp: [] }
    };
    App.save(); App.render();
  },
  cancelAudienceWizard() {
    App.state.audienceWizard = null;
    App.save(); App.render();
  },
  // V39.4.0 — Carrega Eficiência de Capital (LTV + refunds + cancellations).
  // CAC é lido em runtime do revopsFinanceV2 no engine.
  async loadEfficiencySummary(opts) {
    const force = !!(opts && opts.force);
    const cur = App.state.efficiencyCache;
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    if (!force && cur && cur.loaded && cur.fetchedAt > fiveMinAgo) return;
    App.state.efficiencyCache = { ...(cur || {}), loading: true };
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/efficiency-summary', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await r.json();
      if (!data.ok) {
        App.state.efficiencyCache = { loaded: false, loading: false, error: data.message || 'fetch-failed', fetchedAt: Date.now() };
        if (App.render) App.render();
        return;
      }
      App.state.efficiencyCache = {
        loaded: true,
        loading: false,
        error: null,
        fetchedAt: Date.now(),
        window: data.window,
        benchmarks: data.benchmarks,
        byProduct: data.byProduct || []
      };
      if (App.render) App.render();
    } catch (err) {
      App.state.efficiencyCache = { loaded: false, loading: false, error: err.message || String(err), fetchedAt: Date.now() };
      if (App.render) App.render();
    }
  },
  // V39.3.0 — Carrega Pipeline Velocity Summary (V/C/L/T por campanha e
  // produto). Endpoint /api/pipeline-velocity-summary agrega tracker +
  // Hotmart purchases. Cache 5 min.
  async loadPipelineVelocitySummary(opts) {
    const force = !!(opts && opts.force);
    const cur = App.state.pipelineVelocityCache;
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    if (!force && cur && cur.loaded && cur.fetchedAt > fiveMinAgo) return;
    App.state.pipelineVelocityCache = { ...(cur || {}), loading: true };
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/pipeline-velocity-summary', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await r.json();
      if (!data.ok) {
        App.state.pipelineVelocityCache = { loaded: false, loading: false, error: data.message || 'fetch-failed', fetchedAt: Date.now() };
        if (App.render) App.render();
        return;
      }
      App.state.pipelineVelocityCache = {
        loaded: true,
        loading: false,
        error: null,
        fetchedAt: Date.now(),
        period: data.period,
        benchmarks: data.benchmarks,
        byCampaign: data.byCampaign || [],
        byProduct: data.byProduct || []
      };
      if (App.render) App.render();
    } catch (err) {
      App.state.pipelineVelocityCache = { loaded: false, loading: false, error: err.message || String(err), fetchedAt: Date.now() };
      if (App.render) App.render();
    }
  },
  // V39.6.0 — Toggle de "Saber mais" por bloco (productId + blockKey).
  toggleRevopsVelocityDesc(productId, blockKey) {
    const key = `${productId}-${blockKey}`;
    const cur = App.state.revopsVelocityDescOpen || {};
    if (cur[key]) {
      const { [key]: _, ...rest } = cur;
      App.state.revopsVelocityDescOpen = rest;
    } else {
      App.state.revopsVelocityDescOpen = { ...cur, [key]: true };
    }
    App.render();
  },
  // V39.6.1 — Atalho cravado: abre RevOps no produto específico, sub-tab Ofertas.
  // Usado pelos botões "Definir meta →" e "Defina CAC" do card de Velocidade.
  openProductOffers(productId) {
    App.state.activeTab = 'revops';
    App.state.revopsSelectedProductId = Number(productId);
    App.state.revopsWhitelabelActiveTab = 'offers';
    App.save(); App.render();
  },
  // V39.6.0 — Refresh unificado dos 3 caches da Onda A em paralelo.
  refreshOndaA() {
    if (window.Actions?.loadForecastRealizedSummary) Actions.loadForecastRealizedSummary({ force: true });
    if (window.Actions?.loadPipelineVelocitySummary) Actions.loadPipelineVelocitySummary({ force: true });
    if (window.Actions?.loadEfficiencySummary) Actions.loadEfficiencySummary({ force: true });
    Utils.toast('🔄 Recarregando Onda A…');
  },
  // V39.3.0 — Expande card de produto na aba RevOps & Velocidade. null = colapsa.
  toggleRevopsVelocityProduct(productId) {
    const cur = App.state.revopsVelocityExpandedProductId;
    App.state.revopsVelocityExpandedProductId = (cur != null && Number(cur) === Number(productId)) ? null : Number(productId);
    App.save(); App.render();
  },
  // V39.2.0 — Carrega Forecast × Realizado do mês corrente. Endpoint
  // /api/forecast-realized-summary agrega lj_hotmart_purchases por
  // product_id_lj. Re-roda a cada 5 min ou após manual refresh.
  async loadForecastRealizedSummary(opts) {
    const force = !!(opts && opts.force);
    const cur = App.state.forecastRealizedCache;
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    if (!force && cur && cur.loaded && cur.fetchedAt > fiveMinAgo) return;
    App.state.forecastRealizedCache = { ...(cur || {}), loading: true };
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/forecast-realized-summary', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await r.json();
      if (!data.ok) {
        App.state.forecastRealizedCache = { loaded: false, loading: false, error: data.message || 'fetch-failed', fetchedAt: Date.now() };
        if (App.render) App.render();
        return;
      }
      App.state.forecastRealizedCache = {
        loaded: true,
        loading: false,
        error: null,
        fetchedAt: Date.now(),
        period: data.period,
        products: data.products || []
      };
      if (App.render) App.render();
    } catch (err) {
      App.state.forecastRealizedCache = { loaded: false, loading: false, error: err.message || String(err), fetchedAt: Date.now() };
      if (App.render) App.render();
    }
  },
  // V39.1.0 — Force-prompt de salesChannel pra produtos pré-V39.1. Roda no
  // boot do main.js init(). Só abre se houver pelo menos 1 produto com
  // audience.configured=true e salesChannel=null.
  maybeOpenSalesChannelPrompt() {
    const pending = (App.state.products || [])
      .filter(p => p.audience && p.audience.configured && !p.audience.salesChannel);
    if (pending.length === 0) return;
    App.state.salesChannelPrompt = {
      open: true,
      currentProductId: pending[0].id,
      choice: null
    };
    App.render();
  },
  chooseSalesChannelInPrompt(channel) {
    const s = App.state.salesChannelPrompt;
    if (!s || !s.open) return;
    App.state.salesChannelPrompt = { ...s, choice: String(channel || '') || null };
    App.render();
  },
  confirmSalesChannelPrompt() {
    const s = App.state.salesChannelPrompt;
    if (!s || !s.open) return;
    if (!s.choice) return Utils.toast('Escolha como o produto vende antes de continuar.');
    const products = App.state.products || [];
    const idx = products.findIndex(p => Number(p.id) === Number(s.currentProductId));
    if (idx < 0) {
      App.state.salesChannelPrompt = { open: false, currentProductId: null, choice: null };
      App.render();
      return;
    }
    const existing = products[idx];
    const updatedAudience = {
      ...(existing.audience || {}),
      salesChannel: s.choice
    };
    const updated = window.ProductRevenueEngine
      ? ProductRevenueEngine.normalize({ ...existing, audience: updatedAudience }, idx)
      : { ...existing, audience: updatedAudience };
    App.state.products = [
      ...products.slice(0, idx),
      updated,
      ...products.slice(idx + 1)
    ];
    // Encontra o próximo produto pendente.
    const stillPending = App.state.products.filter(p => p.audience && p.audience.configured && !p.audience.salesChannel);
    if (stillPending.length === 0) {
      App.state.salesChannelPrompt = { open: false, currentProductId: null, choice: null };
      App.save(); App.render();
      Utils.toast('✓ Canal de venda definido pra todos os produtos. Forecast × Realizado destravado.');
      return;
    }
    App.state.salesChannelPrompt = {
      open: true,
      currentProductId: stillPending[0].id,
      choice: null
    };
    App.save(); App.render();
  },
  audienceWizardChoose(field, value) {
    const w = App.state.audienceWizard;
    if (!w || !w.open) return;
    if (field !== 'modeloNegocio' && field !== 'modeloOperacional' && field !== 'salesChannel') return;
    w[field] = String(value || '') || null;
    // V38.1.40 — invalida análise do Djow se mudou modelo (não pra salesChannel,
    // que é metadata operacional e não afeta o quadro).
    if (field !== 'salesChannel') {
      w.djowAnalise = null;
      w.djowError = null;
    }
    App.save(); App.render();
  },
  audienceWizardNext() {
    const w = App.state.audienceWizard;
    if (!w || !w.open) return;
    if (w.step === 1 && !w.modeloNegocio) return Utils.toast('Escolha um modelo de negócio.');
    if (w.step === 2 && !w.modeloOperacional) return Utils.toast('Escolha um modelo operacional.');
    if (w.step === 2 && !w.salesChannel) return Utils.toast('Escolha como esse produto vende.');
    w.step = Math.min(4, Number(w.step || 0) + 1);
    App.save(); App.render();
  },
  audienceWizardBack() {
    const w = App.state.audienceWizard;
    if (!w || !w.open) return;
    w.step = Math.max(0, Number(w.step || 0) - 1);
    App.save(); App.render();
  },
  // V38.1.40 — Pede análise do Djow no Step 3 do wizard de Audiência.
  // Backend: /api/djow-audience-analyze
  async djowAnalyzeAudience() {
    const w = App.state.audienceWizard;
    if (!w || !w.open) return;
    if (!w.modeloNegocio || !w.modeloOperacional) return Utils.toast('Escolha os dois modelos antes.');
    if (!window.AudienceFusionEngine) return Utils.toast('Motor de fusão não carregado.');

    const fused = AudienceFusionEngine.fuse(w.modeloNegocio, w.modeloOperacional);
    if (!fused.ok) return Utils.toast(fused.error || 'Erro ao fundir.');

    // Resolve nome do produto (pendingDraft / existing / draft)
    let productName = 'Novo produto';
    if (w.mode === 'existingProduct') {
      productName = (App.state.products || []).find(p => Number(p.id) === Number(w.productId))?.name || productName;
    } else if (w.mode === 'draft') {
      productName = App.state.productDraft?.name || productName;
    } else if (w.mode === 'mapaPopupDraft') {
      productName = App.state.newProductWithMapaPopup?.name || productName;
    } else if (w.pendingDraft?.name) {
      productName = w.pendingDraft.name;
    }

    // Schema summary (texto curto pra economizar tokens)
    const layerLine = (label, fields, count) => {
      const list = fields.map(f => `${f.label || f.key}${f.type === 'fit' ? ' [fit]' : ''}${f.optional ? ' [opc]' : ''}`).join(', ');
      return `**${label}** (${count} obrigatórios): ${list}`;
    };
    const notasTxt = (fused.notas || []).map(n => `- (${n.origem}) ${n.texto}`).join('\n');
    const schemaSummary = [
      `Combinação: ${fused.negocioLabel} × ${fused.operacionalLabel}`,
      `Unidade: ${fused.unidade}${fused.bilateral ? ' (bilateral)' : ''}`,
      layerLine('PA (Público-Alvo)',  fused.pa,  fused.requiredCounts.pa),
      layerLine('ICP',                fused.icp, fused.requiredCounts.icp),
      layerLine('BP (Buyer Persona)', fused.bp,  fused.requiredCounts.bp),
      notasTxt ? `\nNotas do motor:\n${notasTxt}` : ''
    ].join('\n');

    // Leads summary agregado (sem PII)
    const allLeads = []
      .concat(App.state.globalLeads || [])
      .concat((App.state.actions || []).flatMap(a => a.leads || []));
    let leadsSummary = '';
    if (allLeads.length > 0) {
      const total = allLeads.length;
      const withCargo = allLeads.filter(l => String(l.cargo || l.role || '').trim().length).length;
      const withEmpresa = allLeads.filter(l => String(l.empresa || l.company || '').trim().length).length;
      const withScore = allLeads.filter(l => Number(l.globalScore || l.score || 0) > 0).length;
      const byOrigin = {};
      allLeads.forEach(l => { const o = String(l.origin || l.fonte || 'desconhecida').toLowerCase(); byOrigin[o] = (byOrigin[o] || 0) + 1; });
      const top3Origins = Object.entries(byOrigin).sort((a,b) => b[1]-a[1]).slice(0,3).map(([o,c]) => `${o}: ${c}`).join(', ');
      leadsSummary = `Total de leads importados: ${total}. Com cargo: ${withCargo} (${Math.round(100*withCargo/total)}%). Com empresa: ${withEmpresa} (${Math.round(100*withEmpresa/total)}%). Com score: ${withScore} (${Math.round(100*withScore/total)}%). Top origens: ${top3Origins}.`;
    }

    // UI: loading
    App.state.audienceWizard.djowLoading = true;
    App.state.audienceWizard.djowError = null;
    App.state.audienceWizard.djowAnalise = null;
    App.save(); App.render();

    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/djow-audience-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          productName,
          modeloNegocio: w.modeloNegocio,
          modeloOperacional: w.modeloOperacional,
          schemaSummary,
          leadsSummary
        })
      });
      const data = await r.json();
      if (!data.ok) {
        const w2 = App.state.audienceWizard;
        if (w2) { w2.djowLoading = false; w2.djowError = data.message || `HTTP ${r.status}`; }
        App.save(); App.render();
        return;
      }
      const w2 = App.state.audienceWizard;
      if (w2) {
        w2.djowLoading = false;
        w2.djowAnalise = data.analise || '';
        w2.djowError = null;
      }
      App.save(); App.render();
    } catch (err) {
      const w2 = App.state.audienceWizard;
      if (w2) { w2.djowLoading = false; w2.djowError = err.message || String(err); }
      App.save(); App.render();
    }
  },

  audienceWizardFinish() {
    const w = App.state.audienceWizard;
    if (!w || !w.open) return;
    // V38.1.39 — Funde via AudienceFusionEngine pra salvar schema completo
    // (snapshot, não delta — flag customized: false até cliente editar).
    // V38.1.44 — Custom fields do draft do wizard mesclam no schema final.
    let schema = null;
    const customFields = (w.customFields && typeof w.customFields === 'object')
      ? { pa: w.customFields.pa || [], icp: w.customFields.icp || [], bp: w.customFields.bp || [] }
      : { pa: [], icp: [], bp: [] };
    const totalCustom = customFields.pa.length + customFields.icp.length + customFields.bp.length;
    if (window.AudienceFusionEngine && w.modeloNegocio && w.modeloOperacional) {
      const fused = AudienceFusionEngine.fuse(w.modeloNegocio, w.modeloOperacional);
      if (fused.ok) {
        const paAll  = [...fused.pa,  ...customFields.pa];
        const icpAll = [...fused.icp, ...customFields.icp];
        const bpAll  = [...fused.bp,  ...customFields.bp];
        schema = {
          pa: paAll,
          icp: icpAll,
          bp: bpAll,
          unidade: fused.unidade,
          bilateral: fused.bilateral,
          requiredCounts: {
            pa:  paAll.filter(f => !f.optional).length,
            icp: icpAll.filter(f => !f.optional).length,
            bp:  bpAll.filter(f => !f.optional).length
          },
          notas: fused.notas
        };
      }
    }
    const audience = {
      configured: true,
      modeloNegocio: w.modeloNegocio,
      modeloOperacional: w.modeloOperacional,
      // V39.1.0 — Canal de fechamento: 'checkout' | 'crm' | 'hybrid'.
      // Define a fonte do Realizado em Forecast × Realizado e o ponto crítico
      // do tenant (integração checkout vs disciplina do preenchimento no CRM).
      salesChannel: w.salesChannel || null,
      schema,
      customFields,
      customized: totalCustom > 0,
      // Retrocompat (V38.1.36) — arrays vazios até a próxima onda permitir custom
      quadroPA: Array.isArray(w.quadroPA) ? w.quadroPA : [],
      quadroICP: Array.isArray(w.quadroICP) ? w.quadroICP : [],
      quadroBP: Array.isArray(w.quadroBP) ? w.quadroBP : []
    };
    // V39.12.0 — Quando o wizard foi aberto pelo Flow Builder pra um node
    // específico, devolve o audience no draft do bloco (não salva em produto
    // real). Só vira product.audience quando "Salvar esteira" rodar.
    if (w.mode === 'flowBuilderNode' && w.flowBuilderNodeId) {
      const nodes = App.state.flowBuilderNodes || [];
      App.state.flowBuilderNodes = nodes.map(n =>
        String(n.id) === String(w.flowBuilderNodeId)
          ? { ...n, data: { ...(n.data || {}), audienceDraft: audience } }
          : n
      );
      App.state.audienceWizard = null;
      App.save(); App.render();
      Utils.toast('Audiência (ICP) salva no rascunho. Sobe pro LJ ao clicar "Salvar esteira".');
      setTimeout(() => { try { if (window.ActionFlowBuilder) ActionFlowBuilder.attach(); } catch (_) {} }, 0);
      return;
    }
    if (w.mode === 'existingProduct') {
      // V38.1.47 — Fix defensivo: setar via index (não confiar em mutação de
      // referência retornada por find()) e renormalizar o produto pra garantir
      // que audience.configured sobreviva ao próximo State.normalize do boot
      // (caso o cliente recarregue antes do push remoto debounced terminar).
      const products = App.state.products || [];
      const idx = products.findIndex(p => Number(p.id) === Number(w.productId));
      if (idx < 0) {
        App.state.audienceWizard = null;
        App.save(); App.render();
        return;
      }
      const existing = products[idx];
      const updated = window.ProductRevenueEngine
        ? ProductRevenueEngine.normalize({ ...existing, audience }, idx)
        : { ...existing, audience };
      App.state.products = [
        ...products.slice(0, idx),
        updated,
        ...products.slice(idx + 1)
      ];
      App.state.selectedProductId = updated.id;
      App.state.audienceWizard = null;
      App.save(); App.render();
      Utils.toast(`Audiência atualizada em ${updated.name}.`);
      return;
    }
    if (w.mode === 'draft') {
      // V38.1.37 — Salva no productDraft pré-submit. Não cria produto.
      App.state.productDraft = App.state.productDraft || {};
      App.state.productDraft.audience = audience;
      App.state.audienceWizard = null;
      App.save(); App.render(); Utils.toast('Audiência salva. Clique em "Criar Produto sem Mapa" pra finalizar.');
      return;
    }
    if (w.mode === 'mapaPopupDraft') {
      // V38.1.38 — Salva no popup do Mapa pré-submit. Não cria produto.
      if (App.state.newProductWithMapaPopup) {
        App.state.newProductWithMapaPopup.audience = audience;
      }
      App.state.audienceWizard = null;
      App.save(); App.render(); Utils.toast('Audiência salva. Clique em "Criar e ir pra Visão" pra finalizar.');
      return;
    }
    // createProduct OR createProductMapa
    const pendingDraft = w.pendingDraft || { name: 'Produto sem nome' };
    const isMapaFlow = w.mode === 'createProductMapa';
    App.state.audienceWizard = null;
    const product = this._finalizeProductCreation(pendingDraft, audience);
    if (isMapaFlow && product) {
      // mantém o fluxo do Mapa: abre o Mapa pro produto recém-criado
      setTimeout(() => {
        Actions.openStrategicMap(product.id);
        if (window.StrategicZoomNavigation) StrategicZoomNavigation.set('vision');
        App.save(); App.render();
      }, 80);
    }
  },

  // V31.2.5 — Caminho "estratégico-primeiro": botão Criar com Mapa abre popup
  // mínimo (só nome do produto) e em seguida joga direto no Mapa da Receita
  // pra construir Visão → Frentes → Números → Ações → Execução guiado.
  openNewProductWithMapaPopup() {
    if (this._demoGuard && this._demoGuard('Criar produto')) return;
    App.state.newProductWithMapaPopup = { open: true, name: '', type: '', revenueModel: 'Venda única', audience: null };
    App.render();
  },
  closeNewProductWithMapaPopup() {
    App.state.newProductWithMapaPopup = null;
    App.render();
  },
  updateNewProductWithMapaField(field, value) {
    if (!App.state.newProductWithMapaPopup) return;
    App.state.newProductWithMapaPopup[field] = value;
  },
  confirmNewProductWithMapa() {
    const draft = App.state.newProductWithMapaPopup;
    if (!draft) return;
    const name = String(draft.name || '').trim();
    if (!name) return Utils.toast('Digite um nome pro produto.');
    const pendingDraft = {
      name,
      type: String(draft.type || '').trim(),
      price: '',
      revenueModel: draft.revenueModel || 'Venda única',
      operationalCost: ''
    };
    // V38.1.38 — Se cliente já definiu audiência pelo botão no popup,
    // cria direto e abre Mapa. Caso contrário, fallback V38.1.36 abre wizard.
    if (draft.audience && draft.audience.configured) {
      const audience = draft.audience;
      App.state.newProductWithMapaPopup = null;
      const product = this._finalizeProductCreation(pendingDraft, audience);
      if (product) {
        setTimeout(() => {
          Actions.openStrategicMap(product.id);
          if (window.StrategicZoomNavigation) StrategicZoomNavigation.set('vision');
          App.save(); App.render();
        }, 80);
      }
      return;
    }
    App.state.newProductWithMapaPopup = null;
    this.openAudienceWizardForNewProduct(pendingDraft, 'createProductMapa');
  },

  createCampaign() {
    const d = App.state.campaignDraft;
    if (!d.name.trim()) return Utils.toast('Digite o nome da campanha.');
    if (!d.productId) return Utils.toast('Selecione o produto vinculado.');
    const campaign = { id: Date.now(), productId: Number(d.productId), name: d.name.trim(), objective: d.objective.trim(), owner: d.owner.trim(), sector: d.sector || 'Marketing', status: 'Ativa', createdAt: new Date().toISOString() };
    App.state.campaigns.unshift(campaign);
    App.state.selectedCampaignId = campaign.id;
    App.state.selectedProductId = Number(d.productId);
    App.state.actionDraft.campaignId = campaign.id;
    App.state.campaignDraft = { name: '', objective: '', productId: App.state.selectedProductId, owner: '', sector: 'Marketing' };
    App.state.activeTab = 'actions';
    App.save(); App.render(); Utils.toast('Campanha criada. Agora crie ações com OKRs operacionais.');
    // V37.4.3 — emit notification tenant_wide
    if (window.LJEmit) {
      const product = (App.state.products || []).find(p => Number(p.id) === Number(campaign.productId));
      window.LJEmit({
        audience: 'tenant_wide',
        kind: 'event.campaign_created',
        category: 'event',
        severity: 'info',
        title: `Nova campanha: ${campaign.name}`,
        body: product ? `No produto ${product.name}` : null,
        data: { campaignId: campaign.id, campaignName: campaign.name, productId: campaign.productId, productName: product?.name },
        entityKind: 'campaign',
        entityId: String(campaign.id)
      });
    }
  },
  updateActionContext(field, value) {
    App.state.actionDraft[field] = value;
    if (field === 'sector') App.state.actionDraft.originSector = value;
    if (field === 'funnel') App.state.actionDraft.originFunnel = value;
    App.state.actionDraft.okrs = OkrSuggestionEngine.defaultFor(App.state.actionDraft.sector, App.state.actionDraft.funnel, App.state.actionDraft.channel, App.state.actionDraft.actionType);
    App.save(); App.render();
  },
  updateActionDraftOkr(index, field, value) {
    App.state.actionDraft.okrs = App.state.actionDraft.okrs || [];
    App.state.actionDraft.okrs[index] = App.state.actionDraft.okrs[index] || { name: '', target: '', current: '' };
    App.state.actionDraft.okrs[index][field] = value;
    App.save();
  },
  addActionDraftOkr() { App.state.actionDraft.okrs = [...(App.state.actionDraft.okrs || []), { name: 'Novo OKR', target: '', current: '', unit: '', benchmark: '', trend: 'stable', health: 'Atenção' }]; App.save(); App.render(); },
  removeActionDraftOkr(index) { App.state.actionDraft.okrs = (App.state.actionDraft.okrs || []).filter((_, i) => i !== index); App.save(); App.render(); },
  // V37.0.9 — Sem mais parse de leadsText do mailing inline (removido). Ação
  // nasce com leads:[] e mailingDefined:false. Cliente anexa base depois via
  // Lead Import Wizard. Ações antigas com leads[] preservadas no normalize.
  createAction() {
    const d = App.state.actionDraft;
    const cleanName = String(d.name || '').trim();
    if (!cleanName) return Utils.toast('Digite o nome da ação.');
    // V38.1.54 — rejeita placeholders óbvios pra não cair "Ação sem nome" no card.
    if (cleanName.length < 3) return Utils.toast('Nome da ação muito curto — descreva o que ela faz.');
    if (/^(a[çc][aã]o\s+sem\s+nome|sem\s+nome|untitled|nova\s+a[çc][aã]o)$/i.test(cleanName)) return Utils.toast('Dê um nome real à ação (ex: "Post Instagram Ebook MOF").');
    const sector = d.sector || 'Marketing';
    const funnel = d.funnel || 'MOF';
    const originSector = d.originSector || sector;
    const originFunnel = d.originFunnel || funnel;
    const destinationSector = d.destinationSector || sector;
    const destinationFunnel = d.destinationFunnel || funnel;
    const flowPath = FlowResolutionEngine.resolve(originSector, originFunnel, destinationSector, destinationFunnel);
    const baseOkrs = State.normalizeOkrs(d.okrs || OkrSuggestionEngine.defaultFor(sector, funnel, d.channel, d.actionType));
    const action = {
      id: Date.now(),
      campaignId: App.state.selectedCampaignId,
      name: d.name.trim(),
      channel: d.channel,
      actionType: d.actionType || 'Post',
      sector, funnel,
      originSector, originFunnel, destinationSector, destinationFunnel,
      conversionObjective: d.conversionObjective || d.objective || '',
      objective: d.objective.trim(),
      expectedConversion: Number(d.expectedConversion || 25),
      mailingDefined: false,
      okrs: baseOkrs.map(okr => ({ ...okr, stageId: okr.stageId || flowPath[0] })),
      flowPath,
      scoreId: App.state.scores?.[0]?.id || 1,
      connected: false,
      connectionStatus: 'ready',
      status: 'Pronta para conectar',
      leads: [],
      flowConfig: FlowResolutionEngine.buildDefaultFlowConfig(flowPath, d.channel),
      createdAt: new Date().toISOString()
    };
    App.state.actions.unshift(action);
    App.state.selectedActionId = action.id;
    App.state.actionDraft = { ...State.initialActionDraft(), campaignId: App.state.selectedCampaignId };
    App.save(); App.render(); Utils.toast('Ação criada com OKRs e fluxo operacional.');
    // V37.4.3 — emit notification tenant_wide
    if (window.LJEmit) {
      const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(action.campaignId));
      window.LJEmit({
        audience: 'tenant_wide',
        kind: 'event.action_created',
        category: 'event',
        severity: 'info',
        title: `Nova ação: ${action.name}`,
        body: campaign ? `Na campanha ${campaign.name}` : null,
        data: { actionId: action.id, actionName: action.name, campaignId: action.campaignId, campaignName: campaign?.name, channel: action.channel },
        entityKind: 'action',
        entityId: String(action.id)
      });
    }
  },
  async importManualLeadsFromText() {
    // V34.0.0 Onda 3 — Manual import agora persiste no tenant DB via banco.
    if (!App.state.leadImportBankId) return Utils.toast('Selecione um banco antes de importar.');
    const text = String(App.state.leadManualText || '').trim();
    if (!text) return Utils.toast('Digite ao menos um lead para importar.');
    const parsed = LeadParser.parseProfileCsv(text, App.state.scores[0]?.id || 1);
    if (!parsed.length) return Utils.toast('Nenhum lead encontrado. Use: Nome, Telefone, Email, Idade, Estado, Cidade, Estado Civil, Sexo, Faixa Salarial, Tags');
    await Actions._submitImportBatch(parsed, 'mailing-manual', () => { App.state.leadManualText = ''; });
  },
  addManualLead() {
    const d = App.state.leadDraft || {};
    if (!String(d.name || '').trim() && !String(d.email || '').trim() && !String(d.phone || '').trim()) return Utils.toast('Preencha pelo menos nome, email ou telefone.');
    const lead = LeadParser.normalizeLead({ ...d, origem: 'manual', createdAt: new Date().toISOString() }, App.state.manualLeads.length, App.state.scores[0]?.id || 1);
    App.state.manualLeads = LeadIdentityEngine.mergeMany(App.state.manualLeads || [], [lead], 'manual');
    App.state.leadDraft = { name: '', phone: '', email: '', idade: '', estado: '', cidade: '', estadoCivil: '', sexo: '', faixaSalarial: '', tags: '' };
    App.save(); App.render(); Utils.toast('Lead triangulado na base global.');
  },
  async importGlobalLeadsFromCsv() {
    // V34.0.0 Onda 3 — CSV import agora persiste no tenant DB via banco.
    if (!App.state.leadImportBankId) return Utils.toast('Selecione um banco antes de importar.');
    const parsed = LeadParser.parseProfileCsv(App.state.leadCsvText, App.state.scores[0]?.id || 1);
    if (!parsed.length) return Utils.toast('Nenhum lead encontrado no CSV.');
    await Actions._submitImportBatch(parsed, 'mailing-csv', () => { App.state.leadCsvText = ''; });
  },

  // V34.0.0 Onda 3 + V34.6.h hotfix — Submit batch de leads em CHUNKS.
  // parsed = output do LeadParser.parseProfileCsv. source = 'mailing-csv' | 'mailing-manual'.
  // onSuccess = callback pra limpar inputs após submit OK.
  //
  // Chunking: divide em batches de CHUNK_SIZE (50) leads. Roda sequencial pra
  // evitar lock contention no DB. Cada chunk = 1 request HTTP. Agrega counts.
  // Resolve o bug "Processando batch por 5min+" causado por CSV grande estourar
  // o timeout de 30s do Railway.
  async _submitImportBatch(parsed, source, onSuccess) {
    const CHUNK_SIZE = 50;
    const bankId = App.state.leadImportBankId;
    if (!bankId) return Utils.toast('Banco não selecionado.');
    if (App.state.leadImportProcessing) return; // dedup
    App.state.leadImportProcessing = true;
    App.state.leadImportProgress = { current: 0, total: parsed.length, currentChunk: 0, totalChunks: 0 };
    App.render();

    const allLeads = parsed.map(p => ({
      name: p.name || null,
      email: p.email || null,
      phone: p.phone || null,
      // V34.9.8.2 — Split por vírgula/ponto-e-vírgula (não whitespace).
      // Antes: split(/\s+/) quebrava tags com espaço tipo "email ativo" em duas.
      tags: String(p.tags || '').split(/[,;]/).map(t => t.replace(/^#/, '').trim()).filter(Boolean),
      idade: p.idade || null,
      estado: p.estado || null,
      cidade: p.cidade || null,
      estadoCivil: p.estadoCivil || null,
      sexo: p.sexo || null,
      faixaSalarial: p.faixaSalarial || null
    }));

    const chunks = [];
    for (let i = 0; i < allLeads.length; i += CHUNK_SIZE) {
      chunks.push(allLeads.slice(i, i + CHUNK_SIZE));
    }
    App.state.leadImportProgress.totalChunks = chunks.length;

    let totalCreated = 0, totalUpdated = 0, totalSkipped = 0, totalMerged = 0;
    const errors = [];
    let abort = false;

    try {
      for (let idx = 0; idx < chunks.length; idx++) {
        if (abort) break;
        const chunk = chunks[idx];
        App.state.leadImportProgress = {
          current: idx * CHUNK_SIZE,
          total: parsed.length,
          currentChunk: idx + 1,
          totalChunks: chunks.length
        };
        App.render();
        try {
          const data = await this._trackerFetch('/api/leads-import-batch', {
            method: 'POST',
            body: JSON.stringify({ bank_id: bankId, source, leads: chunk })
          });
          if (!data.ok) {
            errors.push(`Lote ${idx + 1}: ${data.message || 'erro'}`);
            // Pra erros transitórios (404 banco, 503 db) — para tudo.
            // Pra erros por lead, segue (data.ok pode ser true mesmo com errors[]).
            if (data.message && /banco|conf|503|tenant/i.test(data.message)) {
              abort = true;
              continue;
            }
          } else {
            totalCreated += data.created || 0;
            totalUpdated += data.updated || 0;
            totalSkipped += data.skipped || 0;
            totalMerged += data.merged || 0;
          }
        } catch (err) {
          errors.push(`Lote ${idx + 1}: ${err.message}`);
          // Timeout/network: para pra não cascatear erros.
          abort = true;
        }
      }

      const parts = [`✓ ${totalCreated} criado(s)`, `${totalUpdated} atualizado(s)`];
      if (totalMerged) parts.push(`${totalMerged} duplicata(s) fundida(s)`);
      if (totalSkipped) parts.push(`${totalSkipped} ignorado(s)`);
      if (errors.length) parts.push(`${errors.length} lote(s) com erro`);
      Utils.toast(parts.join(', ') + '.');
      if (errors.length) console.error('[import-batch errors]', errors);

      if (typeof onSuccess === 'function' && !abort) onSuccess();
      if (!abort) App.state.showLeadImportModal = false;
      await Actions.loadLeadBanks();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    } finally {
      App.state.leadImportProcessing = false;
      App.state.leadImportProgress = null;
      App.save(); App.render();
    }
  },

  openCampaignResults(id) { App.state.selectedResultCampaignId = id; App.state.selectedActionId = null; App.state.selectedCampaignId = id; App.state.activeTab = 'results'; App.save(); App.render(); },
  backToCampaignResults() { App.state.selectedActionId = null; App.save(); App.render(); },
  backToResultsCampaignList() {
    // V33.0.0 — Smart: no modo novo (produto-first), volta pra Produto Overview
    // (mantém selectedResultProductId). No modo clássico, vai pra lista geral.
    App.state.selectedResultCampaignId = null;
    App.state.selectedActionId = null;
    if (App.state.resultsClassicMode) App.state.selectedResultProductId = null;
    App.save(); App.render();
  },
  openActionEditModal(actionId) {
    const action = (App.state.actions || []).find(a => Number(a.id) === Number(actionId));
    if (!action) return Utils.toast('Ação não encontrada.');
    App.state.actionEditDraft = JSON.parse(JSON.stringify(action));
    App.state.showActionEditModal = true;
    App.save(); App.render();
  },

  closeActionEditModal() {
    App.state.showActionEditModal = false;
    App.state.actionEditDraft = null;
    App.save(); App.render();
  },

  updateActionEditFieldSilent(field, value) {
    if (!App.state.actionEditDraft) return;
    App.state.actionEditDraft[field] = value;
    App.save();
  },

  updateActionEditField(field, value) {
    if (!App.state.actionEditDraft) return;
    App.state.actionEditDraft[field] = value;
    if (field === 'sector') App.state.actionEditDraft.originSector = value;
    if (field === 'funnel') App.state.actionEditDraft.originFunnel = value;
    App.save(); App.render();
  },

  addActionEditKpi() {
    if (!App.state.actionEditDraft) return;
    App.state.actionEditDraft.okrs = [...(App.state.actionEditDraft.okrs || []), { name: '', target: '', current: '', unit: '', benchmark: '', trend: 'stable', health: 'Atenção' }];
    App.save(); App.render();
  },

  removeActionEditKpi(index) {
    if (!App.state.actionEditDraft) return;
    App.state.actionEditDraft.okrs = (App.state.actionEditDraft.okrs || []).filter((_, i) => i !== index);
    App.save(); App.render();
  },

  updateActionEditKpiSilent(index, field, value) {
    if (!App.state.actionEditDraft) return;
    const list = App.state.actionEditDraft.okrs || [];
    if (!list[index]) return;
    list[index] = { ...list[index], [field]: value };
    App.state.actionEditDraft.okrs = list;
    App.save();
  },

  saveActionEdit() {
    const draft = App.state.actionEditDraft;
    if (!draft) {
      App.state.showActionEditModal = false;
      App.save(); App.render();
      return;
    }
    {
      const cleanName = String(draft.name || '').trim();
      if (!cleanName) return Utils.toast('Digite o nome da ação.');
      if (cleanName.length < 3) return Utils.toast('Nome da ação muito curto — descreva o que ela faz.');
      if (/^(a[çc][aã]o\s+sem\s+nome|sem\s+nome|untitled|nova\s+a[çc][aã]o)$/i.test(cleanName)) return Utils.toast('Dê um nome real à ação.');
    }
    const originSector = draft.originSector || draft.sector || 'Marketing';
    const originFunnel = draft.originFunnel || draft.funnel || 'MOF';
    const destinationSector = draft.destinationSector || originSector;
    const destinationFunnel = draft.destinationFunnel || originFunnel;
    const flowPath = FlowResolutionEngine.resolve(originSector, originFunnel, destinationSector, destinationFunnel);
    const sameFlow = Array.isArray(draft.flowConfig) && draft.flowConfig.length === flowPath.length && draft.flowConfig.every((step, i) => step.stageId === flowPath[i]);
    const flowConfig = sameFlow ? draft.flowConfig : FlowResolutionEngine.buildDefaultFlowConfig(flowPath, draft.channel);
    const previous = (App.state.actions || []).find(a => Number(a.id) === Number(draft.id));
    const channelChanged = Boolean(previous && previous.channel !== draft.channel);
    const next = {
      ...draft,
      name: String(draft.name).trim(),
      originSector,
      originFunnel,
      destinationSector,
      destinationFunnel,
      flowPath,
      flowConfig,
      connected: channelChanged ? false : Boolean(draft.connected),
      connectionStatus: channelChanged ? 'ready' : (draft.connectionStatus || 'ready'),
      status: channelChanged ? 'Canal selecionado' : (draft.status || 'Pronta para conectar')
    };
    // ORDEM CRÍTICA: fecha modal ANTES de mexer no array para evitar re-render no estado intermediário
    App.state.showActionEditModal = false;
    App.state.actionEditDraft = null;
    App.state.actions = (App.state.actions || []).map(a => Number(a.id) === Number(next.id) ? next : a);
    App.save();
    App.render();
    Utils.toast('Ação atualizada.');
    // V32.2.0 — Sync rename pro ClickUp (mirror) se o nome mudou.
    const oldName = previous ? String(previous.name || '').trim() : '';
    if (oldName !== next.name && window.Actions?._syncRenameToClickup) {
      Actions._syncRenameToClickup('action', next.id, next.name);
    }
  },

  deleteActionFromEdit() {
    const draft = App.state.actionEditDraft;
    if (!draft) return;
    const deletedId = draft.id;
    App.state.actions = (App.state.actions || []).filter(a => Number(a.id) !== Number(draft.id));
    if (Number(App.state.selectedActionId) === Number(draft.id)) App.state.selectedActionId = null;
    App.state.showActionEditModal = false;
    App.state.actionEditDraft = null;
    App.save(); App.render();
    Utils.toast('Ação excluída.');
    // V32.2.5 (Geraldo A15) — Sync delete pro ClickUp.
    if (deletedId && this._syncDeleteToClickup) {
      this._syncDeleteToClickup('action', deletedId);
    }
  },

  // V38.1.55 — ActionFlowModal eliminado. Botão "Ver Fluxo da Ação" do card virou
  // "Roadmap" (abre openCampaignFlowModal). Removidas as 9 actions órfãs:
  // open/closeActionFlowModal, toggle/saveActionFlowConfig/Edit,
  // updateActionFlowStep, toggleActionFlowStep, update/add/removeActionFlowOkr.
  openCampaignFlowModal(id) { App.state.campaignFlowModalId = id; App.state.showCampaignFlowModal = true; App.save(); App.render(); },
  closeCampaignFlowModal() { App.state.showCampaignFlowModal = false; App.state.campaignFlowModalId = null; App.save(); App.render(); },

  // V39.8.0 — Flow Builder whitelabel: card no menu Plugins não tem mais
  // seletor de campanha (a feature foi desvinculada de campanha/ação/produto).
  // A antiga `setPluginsFlowBuilderCampaign` foi removida junto com o dropdown.

  // V38.1.63 — Tela Execuções (ExecutionsModule). Draft de criação manual.
  updateExecutionDraft(field, value) {
    App.state.executionDraft = { ...(App.state.executionDraft || {}), [field]: field === 'actionId' ? Number(value) : value };
    if (field === 'actionId') App.render();
    // title não dispara render — preservar foco do input.
  },
  createExecutionFromDraft() {
    const draft = App.state.executionDraft || {};
    const actionId = Number(draft.actionId);
    const title = String(draft.title || '').trim();
    if (!actionId) return Utils.toast('Escolha uma ação primeiro.');
    if (!title) return Utils.toast('Dê um título à execução.');
    const action = (App.state.actions || []).find(a => Number(a.id) === actionId);
    if (!action) return Utils.toast('Ação não encontrada.');
    if (!window.ExecutionTaskStore) return Utils.toast('Engine de execuções indisponível.');
    ExecutionTaskStore.create({
      linked_action_id: actionId,
      linked_campaign_id: action.campaignId,
      title,
      status: 'pending',
      source_agent: 'manual'
    });
    App.state.executionDraft = { actionId, title: '' };
    App.save(); App.render();
    Utils.toast('✓ Execução criada.');
  },
  markExecutionDone(taskId) {
    if (!window.ExecutionTaskStore) return;
    ExecutionTaskStore.update(taskId, { status: 'completed', completed_at: new Date().toISOString() });
    App.save(); App.render();
  },
  // V38.1.70 — Reabre execução já concluída: status volta pra 'pending',
  // limpa completed_at. Local-only (não propaga pro provider ClickUp ainda;
  // mesma escolha consciente que markExecutionDone). Próximo sync pode
  // sobrescrever se o status no ClickUp continuar 'closed'.
  reopenExecution(taskId) {
    if (!window.ExecutionTaskStore) return;
    ExecutionTaskStore.update(taskId, { status: 'pending', completed_at: null });
    App.save(); App.render();
    Utils.toast('↺ Execução reaberta.');
  },
  // V38.1.71 — Botão engrenagem do card de execução: abre o mesmo modal
  // de criação/edição de tarefa do Mapa, em modo edit (passando taskId).
  openExecutionEditModal(taskId) {
    if (!window.ExecutionTaskStore) return Utils.toast('Engine de execuções indisponível.');
    const task = ExecutionTaskStore.byId(String(taskId));
    if (!task) return Utils.toast('Execução não encontrada.');
    if (!task.linked_action_id) return Utils.toast('Execução sem ação vinculada.');
    this.openTaskCreationModal(task.linked_action_id, task.task_id);
  },
  // V38.1.71 — Excluir execução a partir do modal de edição (rodapé rose).
  // Lê o editingTaskId do state do modal, confirma, remove e fecha o modal.
  deleteExecutionFromTaskModal() {
    const m = App.state.taskCreationModal;
    const taskId = m?.editingTaskId;
    if (!taskId) return;
    const task = window.ExecutionTaskStore ? ExecutionTaskStore.byId(taskId) : null;
    const title = task?.title || 'esta execução';
    if (!confirm(`Apagar "${title}"? (não apaga no provider externo)`)) return;
    if (window.ExecutionTaskStore) ExecutionTaskStore.remove(taskId);
    App.state.taskCreationModal = null;
    App.save(); App.render();
    Utils.toast('Execução removida.');
  },
  deleteExecution(taskId) {
    if (!window.ExecutionTaskStore) return;
    App.state.executionTasks = (App.state.executionTasks || []).filter(t => t.task_id !== taskId);
    App.save(); App.render();
  },

  // V38.1.69 — Abre o modal de criação de tarefa do Mapa (mesmo
  // `_taskCreationModalRender`) a partir do form da aba Execuções. Valida
  // título + ação, pré-preenche `name` com o título digitado e zera o draft
  // local. Cliente completa descrição/responsáveis/data no modal.
  openExecutionTaskFromTab() {
    const d = App.state.executionDraft || {};
    const actionId = Number(d.actionId);
    const title = String(d.title || '').trim();
    if (!actionId) return Utils.toast('Selecione uma ação primeiro.');
    if (!title) return Utils.toast('Digite o título da execução antes de prosseguir.');
    this.openTaskCreationModal(actionId);
    if (App.state.taskCreationModal && App.state.taskCreationModal.draft) {
      App.state.taskCreationModal.draft.name = title;
    }
    App.state.executionDraft = { ...d, title: '' };
    App.render();
  },

  // V38.1.68 — Filtros da lista de execuções (Campanha + Ação). Trocar campanha
  // limpa o filtro de ação pra evitar combinação inválida.
  setExecutionListFilter(field, value) {
    const next = { ...(App.state.executionListFilter || { campaignId: null, actionId: null }) };
    const parsed = value === '' || value == null ? null : Number(value);
    if (field === 'campaignId') {
      next.campaignId = parsed;
      next.actionId = null;
    } else if (field === 'actionId') {
      next.actionId = parsed;
    }
    App.state.executionListFilter = next;
    App.save(); App.render();
  },

  // V38.1.51 — Djow lê todas as ações da campanha (nome, canal, origem→destino,
  // taxa de cada etapa) e devolve 4-6 frases pragmáticas em prosa apontando
  // pontos de atenção ação por ação. Cacheia em App.state.roadmapInsights[id].
  async requestRoadmapInsight(campaignId) {
    const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(campaignId));
    if (!campaign) return Utils.toast('Campanha não encontrada.');
    const product = (App.state.products || []).find(p => Number(p.id) === Number(campaign.productId));
    const actions = (App.state.actions || []).filter(a => Number(a.campaignId) === Number(campaignId));
    if (!actions.length) return Utils.toast('Campanha sem ações pra Djow analisar.');

    App.state.roadmapInsights = { ...(App.state.roadmapInsights || {}), [campaignId]: { ...(App.state.roadmapInsights?.[campaignId] || {}), loading: true } };
    App.render();

    const actionsSummary = actions.map(a => {
      const f = FlowResolutionEngine.buildActionFlow(a);
      const steps = (f.steps || []).map(s => `${FlowResolutionEngine.sector(s.stageId)} ${FlowResolutionEngine.funnel(s.stageId)} (${s.converted}/${s.impacted}, ${s.conversionRate}%)`).join(' → ');
      const rate = f.impacted ? Math.round((f.converted / f.impacted) * 1000) / 10 : 0;
      return `- ${a.name} | canal: ${a.channel || '—'} | fluxo: ${steps} | conversão final: ${rate}%`;
    }).join('\n');

    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/djow-roadmap-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          campaignName: campaign.name,
          campaignStatus: campaign.status || 'Ativa',
          productName: product?.name || '',
          actionsCount: actions.length,
          actionsSummary
        })
      });
      const data = await r.json();
      if (!data.ok) throw new Error(data.message || 'Erro ao pedir análise.');
      App.state.roadmapInsights = {
        ...(App.state.roadmapInsights || {}),
        [campaignId]: {
          text: data.insight || '',
          model: data.model || '',
          timestamp: Date.now(),
          tokens_in: data.tokens_in || 0,
          tokens_out: data.tokens_out || 0
        }
      };
      App.save(); App.render();
    } catch (err) {
      const cur = { ...(App.state.roadmapInsights?.[campaignId] || {}) };
      delete cur.loading;
      App.state.roadmapInsights = { ...(App.state.roadmapInsights || {}), [campaignId]: cur };
      App.render();
      Utils.toast(`Djow falhou: ${err.message}`);
    }
  }
});
window.Actions = Actions;

// V10.4 - Products as master navigation layer.
Object.assign(Actions, {
  selectProduct(id) {
    App.state.selectedProductId = Number(id);
    App.state.campaignDraft.productId = Number(id);
    App.save(); App.render();
  },
  prepareCampaignForProduct(id) {
    if (!id) return Utils.toast('Selecione um produto para criar campanha.');
    App.state.selectedProductId = Number(id);
    App.state.campaignDraft = { ...App.state.campaignDraft, productId: Number(id), name: '', objective: '', owner: '', sector: 'Marketing' };
    App.state.showProductCampaignsModal = false;
    App.state.productCampaignsModalId = null;
    App.state.activeTab = 'campaigns';
    App.save(); App.render();
    Utils.toast('Campanha preparada e vinculada ao produto selecionado.');
  },
  viewProductCampaigns(id) {
    return this.openProductCampaignsModal(id);
  },
  openProductCampaignsModal(id) {
    const product = (App.state.products || []).find(item => Number(item.id) === Number(id));
    if (!product) return Utils.toast('Produto não encontrado.');
    App.state.selectedProductId = Number(id);
    App.state.campaignDraft.productId = Number(id);
    App.state.productCampaignsModalId = Number(id);
    App.state.showProductCampaignsModal = true;
    App.save(); App.render();
  },
  closeProductCampaignsModal() {
    App.state.showProductCampaignsModal = false;
    App.state.productCampaignsModalId = null;
    App.save(); App.render();
  },
  openProductConsolidatedFlow(id) {
    return this.openProductTotalFlowModal(id);
  },
  openProductTotalFlowModal(id = null) {
    if (!(App.state.products || []).length) return Utils.toast('Cadastre um produto para abrir o Fluxo Total de Produtos.');
    if (id) {
      const product = (App.state.products || []).find(item => Number(item.id) === Number(id));
      if (!product) return Utils.toast('Produto não encontrado.');
      App.state.selectedProductId = Number(id);
      App.state.productTotalFlowProductId = Number(id);
    } else {
      App.state.productTotalFlowProductId = null;
    }
    App.state.showProductTotalFlowModal = true;
    App.state.activeTab = 'products';
    App.save(); App.render();
  },
  selectProductInTotalFlow(id) {
    const product = (App.state.products || []).find(item => Number(item.id) === Number(id));
    if (!product) return Utils.toast('Produto não encontrado.');
    App.state.selectedProductId = Number(id);
    App.state.productTotalFlowProductId = Number(id);
    App.save(); App.render();
  },
  closeProductTotalFlowModal() {
    App.state.showProductTotalFlowModal = false;
    App.state.productTotalFlowProductId = null;
    App.save(); App.render();
  },
  clearCampaignProductFilter() {
    App.state.campaignProductFilterId = null;
    App.save(); App.render();
  },
  selectProductForCampaigns(value) {
    const id = value && String(value).trim() !== '' ? Number(value) : null;
    App.state.selectedProductId = Number.isFinite(id) ? id : null;
    App.save(); App.render();
  },
  openProductRevenueOverview(id) {
    const product = (App.state.products || []).find(item => Number(item.id) === Number(id));
    if (!product) return Utils.toast('Produto não encontrado.');
    App.state.selectedProductId = Number(id);
    App.state.revenueOverviewProductId = Number(id);
    App.state.showProductRevenueOverview = true;
    App.save(); App.render();
  },
  closeProductRevenueOverview() {
    App.state.showProductRevenueOverview = false;
    App.state.revenueOverviewProductId = null;
    App.save(); App.render();
  }
});



// V12.4.1 - Navegação operacional fluida.
Object.assign(Actions, {
  goToProduct(id) {
    const product = (App.state.products || []).find(item => Number(item.id) === Number(id));
    if (!product) return Utils.toast('Produto não encontrado.');
    App.goTo('products', { productId: Number(id) });
  },
  goToProductCampaigns(id) {
    const product = (App.state.products || []).find(item => Number(item.id) === Number(id));
    if (!product) return Utils.toast('Produto não encontrado.');
    App.goTo('campaigns', { productId: Number(id), campaignProductFilterId: Number(id) });
    Utils.toast('Campanhas filtradas para o produto selecionado.');
  },
  goToCampaignActions(id) {
    const campaign = (App.state.campaigns || []).find(item => Number(item.id) === Number(id));
    if (!campaign) return Utils.toast('Campanha não encontrada.');
    App.goTo('actions', { productId: campaign.productId, campaignId: campaign.id });
  },
  prepareActionForCampaign(id) {
    const campaign = (App.state.campaigns || []).find(item => Number(item.id) === Number(id));
    if (!campaign) return Utils.toast('Campanha não encontrada.');
    App.state.selectedCampaignId = Number(campaign.id);
    App.state.selectedProductId = Number(campaign.productId || App.state.selectedProductId || 0) || App.state.selectedProductId;
    App.state.actionDraft = { ...State.initialActionDraft(), campaignId: Number(campaign.id), scoreId: App.state.scores[0]?.id || 1 };
    App.state.showProductCampaignsModal = false;
    App.state.productCampaignsModalId = null;
    App.state.activeTab = 'actions';
    App.save(); App.render();
    Utils.toast('Ação preparada para a campanha selecionada.');
  },
  goToCampaignResults(id) {
    const campaign = (App.state.campaigns || []).find(item => Number(item.id) === Number(id));
    if (!campaign) return Utils.toast('Campanha não encontrada.');
    App.state.selectedResultCampaignId = Number(id);
    App.state.selectedActionId = null;
    App.state.selectedCampaignId = Number(id);
    App.state.selectedProductId = Number(campaign.productId || App.state.selectedProductId || 0) || App.state.selectedProductId;
    App.state.showProductCampaignsModal = false;
    App.state.productCampaignsModalId = null;
    App.state.activeTab = 'results';
    App.save(); App.render();
  },
  goToLeadsJourney() {
    App.state.activeTab = 'leads';
    App.state.activeLeadSubTab = 'pipeline';
    App.save(); App.render();
  }
});


// V12.3.1 - Edit product and campaign modals.
Object.assign(Actions, {
  openProductEditModal(id) {
    const product = (App.state.products || []).find(item => Number(item.id) === Number(id));
    if (!product) return Utils.toast('Produto não encontrado.');
    App.state.editProductId = Number(id);
    App.state.showProductEditModal = true;
    App.save(); App.render();
  },
  closeProductEditModal() {
    App.state.showProductEditModal = false;
    App.state.editProductId = null;
    App.save(); App.render();
  },
  updateEditingProductField(field, value) {
    const index = (App.state.products || []).findIndex(item => Number(item.id) === Number(App.state.editProductId));
    if (index < 0) return;
    App.state.products[index] = { ...App.state.products[index], [field]: value };
    App.save();
  },
  saveProductEdit() {
    const index = (App.state.products || []).findIndex(item => Number(item.id) === Number(App.state.editProductId));
    if (index < 0) return Utils.toast('Produto não encontrado.');
    const current = App.state.products[index];
    if (!String(current.name || '').trim()) return Utils.toast('Digite o nome do produto.');
    const oldName = String(current.name).trim();
    const newName = oldName; // current.name já foi atualizado por updateEditingProductField; este é o nome final salvo
    App.state.products[index] = ProductRevenueEngine.normalize({ ...current, name: newName }, index);
    App.state.selectedProductId = App.state.products[index].id;
    const productId = App.state.products[index].id;
    App.state.showProductEditModal = false;
    App.state.editProductId = null;
    App.save(); App.render(); Utils.toast('Produto atualizado.');
    // V32.2.0 — Sync rename pro ClickUp (mirror). Async, não-bloqueante.
    this._syncRenameToClickup('product', productId, newName);
  },
  openCampaignEditModal(id) {
    const campaign = (App.state.campaigns || []).find(item => Number(item.id) === Number(id));
    if (!campaign) return Utils.toast('Campanha não encontrada.');
    App.state.editCampaignId = Number(id);
    App.state.showCampaignEditModal = true;
    App.save(); App.render();
  },
  closeCampaignEditModal() {
    App.state.showCampaignEditModal = false;
    App.state.editCampaignId = null;
    App.save(); App.render();
  },
  updateEditingCampaignField(field, value) {
    const index = (App.state.campaigns || []).findIndex(item => Number(item.id) === Number(App.state.editCampaignId));
    if (index < 0) return;
    App.state.campaigns[index] = { ...App.state.campaigns[index], [field]: field === 'productId' ? Number(value) : value };
    if (field === 'productId') App.state.selectedProductId = Number(value);
    App.save();
  },
  saveCampaignEdit() {
    const index = (App.state.campaigns || []).findIndex(item => Number(item.id) === Number(App.state.editCampaignId));
    if (index < 0) return Utils.toast('Campanha não encontrada.');
    const campaign = App.state.campaigns[index];
    if (!String(campaign.name || '').trim()) return Utils.toast('Digite o nome da campanha.');
    if (!campaign.productId) return Utils.toast('Selecione o produto vinculado.');
    const newName = String(campaign.name).trim();
    App.state.campaigns[index] = { ...campaign, name: newName, objective: String(campaign.objective || '').trim(), owner: String(campaign.owner || '').trim(), sector: campaign.sector || 'Marketing', status: campaign.status || 'Ativa' };
    App.state.selectedCampaignId = App.state.campaigns[index].id;
    App.state.selectedProductId = Number(App.state.campaigns[index].productId);
    const campaignId = App.state.campaigns[index].id;
    App.state.showCampaignEditModal = false;
    App.state.editCampaignId = null;
    App.save(); App.render(); Utils.toast('Campanha atualizada.');
    // V32.2.0 — Sync rename pro ClickUp (mirror). Async, não-bloqueante.
    this._syncRenameToClickup('campaign', campaignId, newName);
  },

  // V32.2.0 — Helper interno: dispara rename mirror pro ClickUp.
  // Silent failure (sem toast erro) — sync best-effort. Loga warn no console.
  // Se ClickUp não conectado ou mirror desabilitado, backend retorna ok+skipped.
  async _syncRenameToClickup(ljKind, ljId, newName) {
    if (!ljId || !newName) return;
    const token = localStorage.getItem('lj_jwt');
    if (!token) return;
    try {
      const r = await fetch('/api/clickup-rename-mirror', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ lj_kind: ljKind, lj_id: Number(ljId), new_name: newName })
      });
      const data = await r.json();
      if (!data.ok) {
        console.warn(`[clickup-mirror-rename] ${ljKind}#${ljId}: ${data.message}`);
      } else if (data.skipped) {
        // OK silencioso (ex: ClickUp não conectado)
      } else if (data.kind) {
        // Sucesso: ClickUp sincronizado
        if (window.Utils?.toast) Utils.toast(`✓ Sincronizado no ClickUp: ${data.name}`);
      }
    } catch (err) {
      console.warn('[clickup-mirror-rename] erro:', err.message);
    }
  },

  // V32.2.5 (Geraldo A15) — Helper interno: dispara DELETE mirror pro ClickUp.
  // Chamado quando user deleta produto/campanha/ação no LJ. Remove o
  // folder/list/task pai correspondente no ClickUp + mapping no DB.
  async _syncDeleteToClickup(ljKind, ljId) {
    if (!ljId) return;
    const token = localStorage.getItem('lj_jwt');
    if (!token) return;
    try {
      const r = await fetch('/api/clickup-delete-mirror', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ lj_kind: ljKind, lj_id: Number(ljId) })
      });
      const data = await r.json();
      if (!data.ok) {
        console.warn(`[clickup-mirror-delete] ${ljKind}#${ljId}: ${data.message}`);
      } else if (data.skipped) {
        // silent — ClickUp não conectado / mirror off / sem mapping
      } else if (data.kind) {
        if (window.Utils?.toast) Utils.toast(`✓ Removido do ClickUp: ${data.kind} ${data.clickupId}`);
      }
    } catch (err) {
      console.warn('[clickup-mirror-delete] erro:', err.message);
    }
  }
});
window.Actions = Actions;

// Database settings and connection patch.
Object.assign(Actions, {
  openSettingsModal(section) {
    // V35.6.1 — Deep-links pras sections legacy 'rd' e 'clickup' agora abrem
    // os modais próprios (que embedam os painéis legacy internamente).
    // Mantém compatibilidade com callers antigos sem expor mais a section
    // como rota pública do SettingsModal.
    if (section === 'rd') {
      Actions.openRdConnectionModal();
      return;
    }
    if (section === 'clickup') {
      Actions.openClickupConnectionModal();
      return;
    }
    App.state.showSettingsModal = true;
    // V32.4.0 (Geraldo Item 6) — default agora 'myAccount' (V11 'database' removida)
    // V32.12.1 — aceita section opcional pra deep-link (ex: 'integrations' via
    // CTA "Conectar Meta/Google/Stripe" do card de Campanha).
    App.state.settingsActiveSection = typeof section === 'string' && section ? section : 'myAccount';
    App.save(); App.render();
  },
  closeSettingsModal() {
    App.state.showSettingsModal = false;
    App.save(); App.render();
  },
  // V32.4.0 (Geraldo Item 6) — Actions V11 database removidas:
  // selectDatabaseProvider, selectAmazonDatabaseType, updateDatabaseConfig,
  // testDatabaseConnection, toggleDatabaseTutorial.
  // Feature legacy de "escolher provider externo pra state" obsoleta após
  // V31+ multi-tenant. Snapshots agora vivem em journey_snapshots (DB tenant).

  // Canais e tipos customizados
  addCustomChannel() {
    const name = String(prompt('Nome do novo canal:') || '').trim();
    if (!name) return;
    App.state.customChannels = App.state.customChannels || [];
    if (App.state.customChannels.includes(name) || Config.channels.includes(name)) {
      Utils.toast('Esse canal já existe.');
      return;
    }
    App.state.customChannels.push(name);
    if (App.state.actionDraft) App.state.actionDraft.channel = name;
    App.save(); App.render();
    Utils.toast(`Canal "${name}" cadastrado.`);
  },

  addCustomActionType() {
    const name = String(prompt('Nome do novo tipo:') || '').trim();
    if (!name) return;
    App.state.customActionTypes = App.state.customActionTypes || [];
    if (App.state.customActionTypes.includes(name) || Config.actionTypes.includes(name)) {
      Utils.toast('Esse tipo já existe.');
      return;
    }
    App.state.customActionTypes.push(name);
    if (App.state.actionDraft) App.state.actionDraft.actionType = name;
    App.save(); App.render();
    Utils.toast(`Tipo "${name}" cadastrado.`);
  },

  setActionsListFilter(stageOrAll) {
    App.state.actionsListFilter = stageOrAll || 'all';
    App.save(); App.render();
  },

  setActionCreateTab(tab) {
    App.state.actionCreateTab = tab === 'ai' ? 'ai' : 'manual';
    App.save(); App.render();
  },

  updateActionAiDraft(field, value) {
    App.state.actionAiDraft = App.state.actionAiDraft || { prompt: '', count: 3 };
    if (field === 'count') App.state.actionAiDraft.count = Math.max(1, Math.min(20, Number(value || 1)));
    else App.state.actionAiDraft[field] = value;
    App.save();
  },

  // V26.2.0 — Substituído placeholder por integração real com Djow.
  // O botão "Gerar ações com IA" agora abre o modal Djow já contextualizado
  // com a campanha selecionada + o prompt do user + número de ações desejadas.
  // Djow extrai filtros/dados, usa create_action tool, e popula a campanha.
  async generateActionsViaAI() {
    const ai = App.state.actionAiDraft || { prompt: '', count: 3 };
    const prompt = String(ai.prompt || '').trim();
    const count = Math.max(1, Math.min(20, Number(ai.count || 3)));
    if (!prompt) return Utils.toast('Descreva o comando de geração antes.');
    const campaign = App.getSelectedCampaign();
    if (!campaign) return Utils.toast('Selecione uma campanha primeiro.');
    // Monta query estruturada pra Djow + abre modal + envia automaticamente
    const fullPrompt = `Crie ${count} ação(ões) para a campanha "${campaign.name}" (id=${campaign.id}). Descrição: ${prompt}\n\nUse a tool create_action pra cada ação. Defina campaignId=${campaign.id}, escolha channel/actionType/sector/funnel apropriados conforme a descrição.`;
    App.state.djowInput = fullPrompt;
    this.openDjowAIModal();
    // Pequeno delay pra modal montar
    setTimeout(() => this.sendDjowAIMessage(), 100);
  },

  // V39.8.0 — Flow Builder whitelabel: actions reescritas. State próprio
  // (`flowBuilderNodes` + `flowBuilderEdges`), sem vínculo com actions, campaigns
  // ou products. As 13 actions antigas da V15.1 (armFlowConnection,
  // cancelFlowConnection, requestFlowDisconnect, confirmFlowDisconnect,
  // cancelFlowDisconnect, openFlowBuilder(campaignId), closeFlowBuilder,
  // connectFlow, disconnectFlow, toggleFlowEnabled, dropActionToFlowCanvas,
  // setFlowActionType, setFlowStages, setFlowBuilderStartFilter) foram REMOVIDAS.

  // V39.9.3 — Range expandido (0.25–3.0) por causa do canvas infinito.
  setFlowBuilderZoom(delta) {
    const current = Number(App.state.flowBuilderZoom || 1.0);
    const next = Math.max(0.25, Math.min(3.0, Math.round((current + delta) * 100) / 100));
    App.state.flowBuilderZoom = next;
    App.save(); App.render();
    setTimeout(() => { try { ActionFlowBuilder.attach(); } catch (_) {} }, 0);
  },

  // V39.9.3 — Reset agora volta zoom E pan pra origem (cliente "perdeu" no canvas? clica e volta).
  resetFlowBuilderZoom() {
    App.state.flowBuilderZoom = 1.0;
    App.state.flowBuilderPanX = 0;
    App.state.flowBuilderPanY = 0;
    App.save(); App.render();
    setTimeout(() => { try { ActionFlowBuilder.attach(); } catch (_) {} }, 0);
  },

  toggleFlowBuilderHelp() {
    App.state.flowBuilderShowHelp = !App.state.flowBuilderShowHelp;
    App.save(); App.render();
  },

  openFlowBuilder() {
    App.state.showFlowBuilderModal = true;
    App.save(); App.render();
    setTimeout(() => { try { if (window.ActionFlowBuilder) ActionFlowBuilder.attach(); } catch (_) {} }, 0);
  },

  // Fecha modal e limpa TODOS os transients pendentes (armada, edit, disconnect,
  // clear, load). Reabrir sempre vem limpo.
  closeFlowBuilder() {
    App.state.showFlowBuilderModal = false;
    App.state.flowBuilderConnectionArm = null;
    App.state.flowBuilderDisconnectEdgeId = null;
    App.state.flowBuilderEditNodeId = null;
    App.state.flowBuilderEditNodeDraft = {};
    App.state.flowBuilderClearConfirm = false;
    App.state.flowBuilderLoadCampaignModal = false;
    App.state.flowBuilderDraftsModal = false;
    App.state.flowBuilderDraftNameDraft = '';
    App.state.flowBuilderSelectedNodeIds = [];
    App.state.flowBuilderMapResolveView = null;
    App.save(); App.render();
  },

  // V39.9.0 — Esteira abre modal de edição automaticamente (força preencher
  // nome + campos do tipo). Auxiliares entram com nome default (do tipo).
  // V39.12.1 — Bloqueia 2º Produto no canvas (cada esteira tem 1 só, alinha
  // com o paradigma "1 esteira = 1 jornada de produto"; evita ambiguidade no Salvar).
  addFlowBuilderNode(typeId) {
    if (!window.ActionFlowBuilder) return;
    const type = ActionFlowBuilder.typeById(typeId);
    if (!type) return Utils.toast('Tipo de bloco inválido.');
    const nodes = App.state.flowBuilderNodes || [];
    if (type.id === 'produto' && nodes.some(n => n.type === 'produto')) {
      return Utils.toast('Já existe um Produto no canvas. Cada esteira tem 1 só — apague o atual ou abra um rascunho novo pra fazer outro produto.');
    }
    const i = nodes.length;
    const isEsteira = ActionFlowBuilder.isEsteira(type.id);
    const node = {
      id: ActionFlowBuilder.genId(),
      type: type.id,
      name: isEsteira ? '' : type.label,
      x: 120 + (i % 5) * 30,
      y: 120 + Math.floor(i / 5) * 30,
      data: ActionFlowBuilder.defaultData(type.id),
      linkedRealId: null,
      // V39.12.2 — createdAt habilita regra "Delete sem confirm nos primeiros 10s".
      createdAt: Date.now()
    };
    App.state.flowBuilderNodes = [...nodes, node];
    if (isEsteira) {
      App.state.flowBuilderEditNodeId = node.id;
      App.state.flowBuilderEditNodeDraft = { ...node.data };
    }
    App.save(); App.render();
    setTimeout(() => { try { ActionFlowBuilder.attach(); } catch (_) {} }, 0);
  },

  removeFlowBuilderNode(nodeId) {
    const id = String(nodeId);
    App.state.flowBuilderNodes = (App.state.flowBuilderNodes || []).filter(n => String(n.id) !== id);
    App.state.flowBuilderEdges = (App.state.flowBuilderEdges || []).filter(e => String(e.fromId) !== id && String(e.toId) !== id);
    if (String(App.state.flowBuilderConnectionArm) === id) App.state.flowBuilderConnectionArm = null;
    App.save(); App.render();
    setTimeout(() => { try { ActionFlowBuilder.attach(); } catch (_) {} }, 0);
  },

  // V39.12.1 — Arm suporta massa: se nodeId faz parte de uma seleção múltipla,
  // arma TODOS os selecionados. Senão arma só o clicado (toggle).
  armFlowBuilderConnection(nodeId) {
    const selected = (App.state.flowBuilderSelectedNodeIds || []).map(String);
    const id = String(nodeId);
    const current = App.state.flowBuilderConnectionArm;
    const currentArr = Array.isArray(current) ? current.map(String) : (current ? [String(current)] : []);
    // Toggle: se já está armado E é o conjunto exato, desarma.
    if (currentArr.length && currentArr.includes(id)) {
      App.state.flowBuilderConnectionArm = null;
    } else if (selected.includes(id) && selected.length > 1) {
      // Massa: arma todos os selecionados (apenas os do mesmo tipo do clicado pra não dar problema na hierarquia).
      const nodes = App.state.flowBuilderNodes || [];
      const refType = nodes.find(n => String(n.id) === id)?.type;
      const armSet = selected.filter(sid => nodes.find(n => String(n.id) === sid)?.type === refType);
      App.state.flowBuilderConnectionArm = armSet;
    } else {
      App.state.flowBuilderConnectionArm = [id];
    }
    App.save(); App.render();
    setTimeout(() => { try { ActionFlowBuilder.attach(); } catch (_) {} }, 0);
  },

  cancelFlowBuilderConnection() {
    App.state.flowBuilderConnectionArm = null;
    App.save(); App.render();
    setTimeout(() => { try { ActionFlowBuilder.attach(); } catch (_) {} }, 0);
  },

  // V39.10.0 — Guardrails de hierarquia Produto→Campanha→Ação→Execução.
  // V39.12.1 — fromIdOrIds pode ser string única OU array (conexão em massa).
  // Em massa: cria N edges (1 por fromId válido), reportando quantos passaram/falharam.
  connectFlowBuilderNodes(fromIdOrIds, toId) {
    const to = String(toId);
    const fromIds = Array.isArray(fromIdOrIds) ? fromIdOrIds.map(String) : [String(fromIdOrIds)];
    if (!fromIds.length) return;
    const nodes = App.state.flowBuilderNodes || [];
    const toNode = nodes.find(n => String(n.id) === to);
    if (!toNode) return Utils.toast('Bloco destino não encontrado.');
    const allowed = window.ActionFlowBuilder?.ALLOWED_CONNECTIONS || {};
    const typeLabel = (id) => window.ActionFlowBuilder?.typeById(id)?.label || id;

    let edges = App.state.flowBuilderEdges || [];
    const created = [];
    const errors = [];
    for (const from of fromIds) {
      if (from === to) { errors.push(`Bloco não pode se conectar a si mesmo.`); continue; }
      const fromNode = nodes.find(n => String(n.id) === from);
      if (!fromNode) { errors.push(`Bloco origem ${from} não encontrado.`); continue; }
      const isEsteiraFrom = window.ActionFlowBuilder?.isEsteira(fromNode.type);
      const isEsteiraTo = window.ActionFlowBuilder?.isEsteira(toNode.type);
      if (isEsteiraFrom || isEsteiraTo) {
        if (!isEsteiraFrom || !isEsteiraTo) {
          errors.push(`${typeLabel(fromNode.type)} ↔ ${typeLabel(toNode.type)}: blocos da Esteira só conectam entre si.`);
          continue;
        }
        const validTargets = allowed[fromNode.type] || [];
        if (!validTargets.includes(toNode.type)) {
          errors.push(`${typeLabel(fromNode.type)} → ${typeLabel(toNode.type)}: hierarquia não permite.`);
          continue;
        }
      }
      if (edges.some(e => String(e.fromId) === from && String(e.toId) === to)) {
        // Silencioso: já existe, não conta como erro.
        continue;
      }
      // Ciclo
      const visited = new Set();
      const queue = [to];
      let cycle = false;
      while (queue.length) {
        const id = queue.shift();
        if (visited.has(id)) continue;
        if (id === from) { cycle = true; break; }
        visited.add(id);
        for (const e of edges) {
          if (String(e.fromId) === id) queue.push(String(e.toId));
        }
      }
      if (cycle) { errors.push(`${typeLabel(fromNode.type)} → ${typeLabel(toNode.type)}: cria ciclo.`); continue; }
      const newEdge = { id: `e_${Date.now()}_${Math.floor(Math.random() * 100000)}`, fromId: from, toId: to };
      edges = [...edges, newEdge];
      created.push(newEdge);
    }
    App.state.flowBuilderEdges = edges;
    App.save(); App.render();
    setTimeout(() => { try { ActionFlowBuilder.attach(); } catch (_) {} }, 0);
    if (created.length === 1 && !errors.length) {
      // Caso simples — sem toast (UX do single connect tradicional).
      return;
    }
    if (created.length > 1) Utils.toast(`✓ ${created.length} conexões criadas.`);
    if (created.length === 0 && errors.length === 1) Utils.toast(errors[0]);
    else if (errors.length) Utils.toast(`${created.length} criadas, ${errors.length} ${errors.length === 1 ? 'erro' : 'erros'}. Verifique a hierarquia.`);
  },

  requestFlowBuilderEdgeDisconnect(edgeId) {
    App.state.flowBuilderDisconnectEdgeId = String(edgeId);
    App.save(); App.render();
  },

  confirmFlowBuilderEdgeDisconnect() {
    const edgeId = App.state.flowBuilderDisconnectEdgeId;
    App.state.flowBuilderDisconnectEdgeId = null;
    if (!edgeId) { App.render(); return; }
    App.state.flowBuilderEdges = (App.state.flowBuilderEdges || []).filter(e => String(e.id) !== String(edgeId));
    App.save(); App.render();
    setTimeout(() => { try { ActionFlowBuilder.attach(); } catch (_) {} }, 0);
    Utils.toast('Conexão removida.');
  },

  cancelFlowBuilderEdgeDisconnect() {
    App.state.flowBuilderDisconnectEdgeId = null;
    App.save(); App.render();
  },

  openFlowBuilderEditNode(nodeId) {
    const node = (App.state.flowBuilderNodes || []).find(n => String(n.id) === String(nodeId));
    if (!node) return;
    const data = (node.data && typeof node.data === 'object') ? { ...node.data } : {};
    if (!data.name) data.name = node.name || '';
    App.state.flowBuilderEditNodeId = String(nodeId);
    App.state.flowBuilderEditNodeDraft = data;
    App.save(); App.render();
  },

  // V39.9.0 — Update por campo (atualiza objeto draft sem render).
  updateFlowBuilderEditNodeField(field, value) {
    const draft = (App.state.flowBuilderEditNodeDraft && typeof App.state.flowBuilderEditNodeDraft === 'object')
      ? App.state.flowBuilderEditNodeDraft
      : {};
    draft[String(field)] = String(value || '');
    App.state.flowBuilderEditNodeDraft = draft;
    // não chama render — preserva foco.
  },

  saveFlowBuilderEditNode() {
    const nodeId = App.state.flowBuilderEditNodeId;
    if (!nodeId) return;
    const draft = (App.state.flowBuilderEditNodeDraft && typeof App.state.flowBuilderEditNodeDraft === 'object')
      ? App.state.flowBuilderEditNodeDraft
      : {};
    const name = String(draft.name || '').trim() || 'Sem nome';
    App.state.flowBuilderNodes = (App.state.flowBuilderNodes || []).map(n => {
      if (String(n.id) !== String(nodeId)) return n;
      return { ...n, name, data: { ...(n.data || {}), ...draft, name } };
    });
    App.state.flowBuilderEditNodeId = null;
    App.state.flowBuilderEditNodeDraft = {};
    App.save(); App.render();
    setTimeout(() => { try { ActionFlowBuilder.attach(); } catch (_) {} }, 0);
  },

  cancelFlowBuilderEditNode() {
    // V39.9.0 — Se cancelou edição de bloco recém-criado da esteira (sem nome),
    // remove o bloco (não fica "Sem nome" pendurado no canvas).
    const nodeId = App.state.flowBuilderEditNodeId;
    if (nodeId) {
      const node = (App.state.flowBuilderNodes || []).find(n => String(n.id) === String(nodeId));
      if (node && window.ActionFlowBuilder?.isEsteira(node.type) && !node.linkedRealId && !String(node.name || '').trim()) {
        App.state.flowBuilderNodes = (App.state.flowBuilderNodes || []).filter(n => String(n.id) !== String(nodeId));
        App.state.flowBuilderEdges = (App.state.flowBuilderEdges || []).filter(e => String(e.fromId) !== String(nodeId) && String(e.toId) !== String(nodeId));
      }
    }
    App.state.flowBuilderEditNodeId = null;
    App.state.flowBuilderEditNodeDraft = {};
    App.save(); App.render();
    setTimeout(() => { try { ActionFlowBuilder.attach(); } catch (_) {} }, 0);
  },

  requestFlowBuilderClear() {
    App.state.flowBuilderClearConfirm = true;
    App.save(); App.render();
  },

  confirmFlowBuilderClear() {
    App.state.flowBuilderNodes = [];
    App.state.flowBuilderEdges = [];
    App.state.flowBuilderGhostSegmentations = [];
    App.state.flowBuilderConnectionArm = null;
    App.state.flowBuilderClearConfirm = false;
    App.save(); App.render();
    setTimeout(() => { try { ActionFlowBuilder.attach(); } catch (_) {} }, 0);
    Utils.toast('✓ Canvas apagado.');
  },

  // V39.11.0 — Painel inferior virou pílula overlay flutuante. 3 tabs:
  // esteira / segmentacao / mapaReceita. Click no botão ativo TOGGLE fecha
  // o painel expandido (deixa só a pílula visível). Click em outro abre o novo.
  setFlowBuilderPaletteTab(tab) {
    const valid = ['esteira', 'segmentacao', 'mapaReceita'];
    if (!valid.includes(tab)) tab = 'esteira';
    const current = App.state.flowBuilderPaletteTab;
    const isOpen = !!App.state.flowBuilderPaletteOpen;
    if (current === tab && isOpen) {
      App.state.flowBuilderPaletteOpen = false;
    } else {
      App.state.flowBuilderPaletteTab = tab;
      App.state.flowBuilderPaletteOpen = true;
    }
    // V39.13.0 — Sair do Mapa da Receita reseta a view de Resolver inline.
    if (tab !== 'mapaReceita') App.state.flowBuilderMapResolveView = null;
    App.save(); App.render();
  },

  // V39.10.0 — Subtabs da Segmentação (organic/paid/custom).
  setFlowBuilderSegCategory(cat) {
    App.state.flowBuilderSegCategory = ['organic','paid','custom'].includes(cat) ? cat : 'organic';
    App.save(); App.render();
  },

  // V39.10.0 — Custom segmentation modal (cor via input type=color).
  openFlowBuilderCustomSegModal() {
    App.state.flowBuilderCustomSegModal = true;
    App.state.flowBuilderCustomSegDraft = { name: '', color: '#a855f7' };
    App.save(); App.render();
  },

  closeFlowBuilderCustomSegModal() {
    App.state.flowBuilderCustomSegModal = false;
    App.state.flowBuilderCustomSegDraft = { name: '', color: '#a855f7' };
    App.save(); App.render();
  },

  updateFlowBuilderCustomSegDraft(field, value) {
    const draft = (App.state.flowBuilderCustomSegDraft && typeof App.state.flowBuilderCustomSegDraft === 'object')
      ? App.state.flowBuilderCustomSegDraft : { name: '', color: '#a855f7' };
    draft[String(field)] = String(value || '');
    App.state.flowBuilderCustomSegDraft = draft;
    if (field === 'color') App.render(); // re-render pra mostrar preview
  },

  saveFlowBuilderCustomSegmentation() {
    const draft = App.state.flowBuilderCustomSegDraft || {};
    const name = String(draft.name || '').trim();
    if (!name) return Utils.toast('Dê um nome à segmentação.');
    if (name.length < 2) return Utils.toast('Nome muito curto.');
    const color = /^#[0-9a-fA-F]{6}$/.test(String(draft.color || '')) ? draft.color : '#a855f7';
    const customs = App.state.customSegmentations || [];
    if (customs.some(s => s.name.toLowerCase() === name.toLowerCase())) {
      return Utils.toast(`Já existe segmentação chamada "${name}".`);
    }
    const key = `custom_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    App.state.customSegmentations = [...customs, { key, name, color, icon: 'square' }];
    App.state.flowBuilderCustomSegModal = false;
    App.state.flowBuilderCustomSegDraft = { name: '', color: '#a855f7' };
    App.save(); App.render();
    Utils.toast(`✓ Segmentação "${name}" salva no tenant.`);
  },

  deleteFlowBuilderCustomSegmentation(key) {
    if (!key) return;
    const seg = (App.state.customSegmentations || []).find(s => s.key === key);
    if (!seg) return;
    if (!confirm(`Apagar segmentação "${seg.name}" do tenant? (Badges já aplicadas em Ações ficam órfãs até serem removidas manualmente.)`)) return;
    App.state.customSegmentations = (App.state.customSegmentations || []).filter(s => s.key !== key);
    App.save(); App.render();
    Utils.toast(`✓ Segmentação "${seg.name}" removida do tenant.`);
  },

  // V39.10.0 — Fantasma de segmentação no canvas (rascunho até virar badge).
  addFlowBuilderGhostSegmentation(segKey, x, y) {
    if (!segKey || !window.ActionFlowBuilder?.segmentationByKey(segKey)) return;
    const ghost = {
      id: ActionFlowBuilder.genGhostId(),
      segKey: String(segKey),
      x: Math.round(Number(x) || 0),
      y: Math.round(Number(y) || 0)
    };
    App.state.flowBuilderGhostSegmentations = [...(App.state.flowBuilderGhostSegmentations || []), ghost];
    App.save(); App.render();
    setTimeout(() => { try { ActionFlowBuilder.attach(); } catch (_) {} }, 0);
  },

  removeFlowBuilderGhostSegmentation(ghostId) {
    if (!ghostId) return;
    App.state.flowBuilderGhostSegmentations = (App.state.flowBuilderGhostSegmentations || []).filter(g => String(g.id) !== String(ghostId));
    App.save(); App.render();
    setTimeout(() => { try { ActionFlowBuilder.attach(); } catch (_) {} }, 0);
  },

  // V39.10.0 — Aplica segmentação como badge em Ação (máx 2). Retorna boolean.
  applyFlowBuilderSegmentationToAction(segKey, nodeId) {
    const node = (App.state.flowBuilderNodes || []).find(n => String(n.id) === String(nodeId));
    if (!node) return false;
    if (node.type !== 'acao') {
      Utils.toast('Segmentação só pode ser aplicada em blocos de Ação.');
      return false;
    }
    const data = node.data || {};
    const segs = Array.isArray(data.segmentations) ? data.segmentations.slice() : [];
    if (segs.includes(segKey)) {
      Utils.toast('Essa segmentação já está aplicada nesta ação.');
      return false;
    }
    if (segs.length >= 2) {
      Utils.toast(`Máximo 2 segmentações por Ação. Remova uma badge antes (arraste pra fora ou pra lixeira) e tente de novo.`);
      return false;
    }
    segs.push(segKey);
    App.state.flowBuilderNodes = (App.state.flowBuilderNodes || []).map(n =>
      String(n.id) === String(nodeId) ? { ...n, data: { ...(n.data || {}), segmentations: segs } } : n
    );
    App.save(); App.render();
    setTimeout(() => { try { ActionFlowBuilder.attach(); } catch (_) {} }, 0);
    const seg = ActionFlowBuilder.segmentationByKey(segKey);
    Utils.toast(`✓ Badge "${seg?.name || segKey}" aplicada.`);
    return true;
  },

  removeFlowBuilderSegmentationFromAction(nodeId, segKey) {
    App.state.flowBuilderNodes = (App.state.flowBuilderNodes || []).map(n => {
      if (String(n.id) !== String(nodeId)) return n;
      const segs = Array.isArray(n.data?.segmentations) ? n.data.segmentations.filter(k => k !== segKey) : [];
      return { ...n, data: { ...(n.data || {}), segmentations: segs } };
    });
    App.save(); App.render();
    setTimeout(() => { try { ActionFlowBuilder.attach(); } catch (_) {} }, 0);
  },

  // V39.11.1 — Remove badge dentro do modal de edição (draft, não persiste até Salvar).
  removeFlowBuilderEditDraftSegmentation(segKey) {
    const draft = (App.state.flowBuilderEditNodeDraft && typeof App.state.flowBuilderEditNodeDraft === 'object')
      ? App.state.flowBuilderEditNodeDraft : {};
    const segs = Array.isArray(draft.segmentations) ? draft.segmentations.filter(k => k !== segKey) : [];
    App.state.flowBuilderEditNodeDraft = { ...draft, segmentations: segs };
    App.save(); App.render();
  },

  // V39.11.1 — Rascunhos: salvar snapshot do canvas atual com nome.
  openFlowBuilderDraftsModal() {
    App.state.flowBuilderDraftsModal = true;
    App.state.flowBuilderDraftNameDraft = '';
    App.save(); App.render();
  },

  closeFlowBuilderDraftsModal() {
    App.state.flowBuilderDraftsModal = false;
    App.state.flowBuilderDraftNameDraft = '';
    App.save(); App.render();
  },

  updateFlowBuilderDraftNameDraft(value) {
    App.state.flowBuilderDraftNameDraft = String(value || '');
  },

  saveFlowBuilderDraft() {
    const name = String(App.state.flowBuilderDraftNameDraft || '').trim();
    if (!name) return Utils.toast('Dá um nome pro rascunho antes de salvar.');
    const nodes = App.state.flowBuilderNodes || [];
    const edges = App.state.flowBuilderEdges || [];
    const ghosts = App.state.flowBuilderGhostSegmentations || [];
    if (!nodes.length && !ghosts.length) return Utils.toast('Canvas vazio — nada pra rascunhar.');
    const draft = {
      id: `dr_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
      name,
      savedAt: new Date().toISOString(),
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
      ghostSegmentations: JSON.parse(JSON.stringify(ghosts))
    };
    App.state.flowBuilderDrafts = [...(App.state.flowBuilderDrafts || []), draft];
    App.state.flowBuilderDraftNameDraft = '';
    Utils.toast(`✓ Rascunho "${name}" salvo.`);
    App.save(); App.render();
  },

  loadFlowBuilderDraft(draftId) {
    const drafts = App.state.flowBuilderDrafts || [];
    const draft = drafts.find(d => String(d.id) === String(draftId));
    if (!draft) return Utils.toast('Rascunho não encontrado.');
    App.state.flowBuilderNodes = JSON.parse(JSON.stringify(draft.nodes || []));
    App.state.flowBuilderEdges = JSON.parse(JSON.stringify(draft.edges || []));
    App.state.flowBuilderGhostSegmentations = JSON.parse(JSON.stringify(draft.ghostSegmentations || []));
    App.state.flowBuilderConnectionArm = null;
    App.state.flowBuilderDraftsModal = false;
    App.state.flowBuilderPanX = 0;
    App.state.flowBuilderPanY = 0;
    App.state.flowBuilderZoom = 1.0;
    Utils.toast(`✓ Rascunho "${draft.name}" carregado no canvas.`);
    App.save(); App.render();
    setTimeout(() => { try { ActionFlowBuilder.attach(); } catch (_) {} }, 0);
  },

  deleteFlowBuilderDraft(draftId) {
    const drafts = App.state.flowBuilderDrafts || [];
    const draft = drafts.find(d => String(d.id) === String(draftId));
    if (!draft) return;
    if (!confirm(`Apagar rascunho "${draft.name}"? Esta ação não pode ser desfeita.`)) return;
    App.state.flowBuilderDrafts = drafts.filter(d => String(d.id) !== String(draftId));
    Utils.toast(`Rascunho "${draft.name}" apagado.`);
    App.save(); App.render();
  },

  // V39.13.0 — Mapa da Receita no Builder: actions inline pro rascunho
  // (vision, owner por frente, KRs por área). Persistem direto em
  // App.state.strategicMaps[proto_<nodeId>] via StrategicMapEngine — quando
  // saveFlowBuilder rodar e criar o productId real, migração move pra strategicMaps[real].
  _flowBuilderMapKey() {
    const produtoNode = (App.state.flowBuilderNodes || []).find(n => n.type === 'produto');
    if (!produtoNode) return null;
    return produtoNode.linkedRealId ? Number(produtoNode.linkedRealId) : `proto_${produtoNode.id}`;
  },

  setFlowBuilderMapResolveView(view) {
    App.state.flowBuilderMapResolveView = ['vision', 'owner', 'krs'].includes(view) ? view : null;
    App.save(); App.render();
  },

  setFlowBuilderMapVision(value) {
    const key = Actions._flowBuilderMapKey();
    if (!key || !window.StrategicMapEngine) return;
    StrategicMapEngine.setVision(key, String(value || ''));
    App.save(); // sem render — preserva foco do textarea
  },

  setFlowBuilderMapOwner(area, value) {
    const key = Actions._flowBuilderMapKey();
    if (!key || !window.StrategicMapEngine || !['marketing', 'sales', 'cs'].includes(area)) return;
    const map = StrategicMapEngine.getForProduct(key) || {};
    const owners = { ...(map.areaOwners || {}), [area]: String(value || '') };
    StrategicMapEngine.save(key, { areaOwners: owners });
    App.save(); // sem render — preserva foco
  },

  addFlowBuilderMapKr(area) {
    const key = Actions._flowBuilderMapKey();
    if (!key || !window.StrategicMapEngine || !['marketing', 'sales', 'cs'].includes(area)) return;
    StrategicMapEngine.addProductKr(key, { area, name: 'KR-mãe sem nome' }, 'flow_builder');
    App.save(); App.render();
  },

  renameFlowBuilderMapKr(krId, value) {
    const key = Actions._flowBuilderMapKey();
    if (!key || !window.StrategicMapEngine) return;
    const map = StrategicMapEngine.getForProduct(key) || {};
    const list = (map.productKrs || []).map(k =>
      String(k.id) === String(krId) ? { ...k, name: String(value || '') } : k
    );
    StrategicMapEngine.save(key, { productKrs: list });
    App.save(); // sem render — preserva foco
  },

  removeFlowBuilderMapKr(krId) {
    const key = Actions._flowBuilderMapKey();
    if (!key || !window.StrategicMapEngine) return;
    const map = StrategicMapEngine.getForProduct(key) || {};
    const list = (map.productKrs || []).filter(k => String(k.id) !== String(krId));
    StrategicMapEngine.save(key, { productKrs: list });
    App.save(); App.render();
  },

  // V39.13.0 — Abre Mapa real direto num step específico (productId real OBRIGATÓRIO).
  openStrategicMapAtStep(productId, stepId) {
    if (!productId) return;
    Actions.openStrategicMap(Number(productId));
    setTimeout(() => {
      App.state.strategicMapZoom = String(stepId || 'vision');
      App.state.strategicSkipOnboarding = true;
      App.save(); App.render();
    }, 50);
  },

  // V39.12.0 — Abre o AudienceWizard do LJ com mode 'flowBuilderNode': ao final,
  // o audience vai pro node.data.audienceDraft (não pra product.audience). Hook
  // de interceptação fica em audienceWizardFinish().
  openFlowBuilderAudienceWizard(nodeId) {
    const node = (App.state.flowBuilderNodes || []).find(n => String(n.id) === String(nodeId));
    if (!node) return;
    const existing = (node.data && node.data.audienceDraft) || null;
    App.state.audienceWizard = {
      open: true,
      mode: 'flowBuilderNode',
      flowBuilderNodeId: String(nodeId),
      step: existing ? 3 : 0,
      modeloNegocio: existing?.modeloNegocio || null,
      modeloOperacional: existing?.modeloOperacional || null,
      salesChannel: existing?.salesChannel || null,
      customFields: existing?.customFields || { pa: [], icp: [], bp: [] },
      quadroPA: existing?.quadroPA || [],
      quadroICP: existing?.quadroICP || [],
      quadroBP: existing?.quadroBP || [],
      djowLoading: false,
      djowAnalise: null
    };
    App.save(); App.render();
  },

  // V39.12.2 — Delete key apaga cards selecionados. Regra:
  //   - Card criado há < 10s → apaga SEM confirm (drag/duplicação acidental).
  //   - Card antigo (≥ 10s ou createdAt ausente) → pede confirm geral.
  //   - Se houver mistura (jovens + antigos): apaga jovens silenciosamente E
  //     pede confirm pros antigos.
  // Implementado como global keydown listener registrado uma vez no attach().
  deleteFlowBuilderSelected() {
    const ids = (App.state.flowBuilderSelectedNodeIds || []).map(String);
    if (!ids.length) return;
    const nodes = App.state.flowBuilderNodes || [];
    const now = Date.now();
    const GRACE_MS = 10000;
    const selectedNodes = nodes.filter(n => ids.includes(String(n.id)));
    if (!selectedNodes.length) return;
    const youngs = selectedNodes.filter(n => n.createdAt && (now - Number(n.createdAt)) < GRACE_MS);
    const olds = selectedNodes.filter(n => !youngs.includes(n));
    const youngIds = new Set(youngs.map(n => String(n.id)));
    const oldIds = new Set(olds.map(n => String(n.id)));
    // Sempre apaga os jovens direto.
    let toDelete = new Set(youngIds);
    if (olds.length) {
      const names = olds.map(n => `"${String(n.data?.name || n.name || ActionFlowBuilder.typeById(n.type).label).trim()}"`).join(', ');
      const msg = olds.length === 1
        ? `Apagar o bloco ${names}? Este card já tem mais de 10 segundos.`
        : `Apagar ${olds.length} blocos antigos (${names})?`;
      if (confirm(msg)) {
        for (const id of oldIds) toDelete.add(id);
      }
    }
    if (!toDelete.size) return;
    const remainingNodes = nodes.filter(n => !toDelete.has(String(n.id)));
    const edges = App.state.flowBuilderEdges || [];
    const remainingEdges = edges.filter(e => !toDelete.has(String(e.fromId)) && !toDelete.has(String(e.toId)));
    App.state.flowBuilderNodes = remainingNodes;
    App.state.flowBuilderEdges = remainingEdges;
    App.state.flowBuilderSelectedNodeIds = (App.state.flowBuilderSelectedNodeIds || []).filter(id => !toDelete.has(String(id)));
    if (App.state.flowBuilderConnectionArm) {
      const arm = App.state.flowBuilderConnectionArm;
      const armArr = Array.isArray(arm) ? arm : [arm];
      const cleaned = armArr.filter(a => !toDelete.has(String(a)));
      App.state.flowBuilderConnectionArm = cleaned.length ? cleaned : null;
    }
    App.save(); App.render();
    setTimeout(() => { try { ActionFlowBuilder.attach(); } catch (_) {} }, 0);
    Utils.toast(`${toDelete.size} ${toDelete.size === 1 ? 'bloco apagado' : 'blocos apagados'}.`);
  },

  // V39.12.0 — Botão "Excluir bloco" dentro do modal de edição: apaga node
  // do canvas e suas conexões. Não desfaz o que já entrou no LJ (linkedRealId
  // preservado pra histórico/audit, mas o bloco some do desenho).
  removeFlowBuilderNodeFromModal(nodeId) {
    const id = String(nodeId);
    const node = (App.state.flowBuilderNodes || []).find(n => String(n.id) === id);
    if (!node) return;
    const displayName = String(node.data?.name || node.name || 'sem nome').trim();
    const wasLinked = !!node.linkedRealId;
    const msg = wasLinked
      ? `Apagar o bloco "${displayName}" do canvas? O que já está no LJ não é desfeito — só o desenho.`
      : `Apagar o bloco "${displayName}" do canvas?`;
    if (!confirm(msg)) return;
    App.state.flowBuilderNodes = (App.state.flowBuilderNodes || []).filter(n => String(n.id) !== id);
    App.state.flowBuilderEdges = (App.state.flowBuilderEdges || []).filter(e => String(e.fromId) !== id && String(e.toId) !== id);
    if (String(App.state.flowBuilderConnectionArm) === id) App.state.flowBuilderConnectionArm = null;
    App.state.flowBuilderEditNodeId = null;
    App.state.flowBuilderEditNodeDraft = {};
    App.save(); App.render();
    setTimeout(() => { try { ActionFlowBuilder.attach(); } catch (_) {} }, 0);
  },

  cancelFlowBuilderClear() {
    App.state.flowBuilderClearConfirm = false;
    App.save(); App.render();
  },

  // V39.12.0 — Salva esteira com SEMÂNTICA ALL-OR-NOTHING:
  //   1) Valida TUDO antes (nomes, conexões hierárquicas, cada bloco status='ready' ou 'saved').
  //      Se faltar QUALQUER coisa, NÃO toca em nada do LJ e devolve TODOS os erros num modal.
  //   2) Snapshot dos arrays antes (products/campaigns/actions/executionTasks) pra rollback.
  //   3) Topological: cria/atualiza Produto → Campanha → Ação → Execução.
  //      Bloco com linkedRealId existente → UPDATE silencioso (preserva ID, atualiza campos).
  //      Bloco sem linkedRealId → INSERT.
  //   4) Se qualquer exceção durante a criação, restaura os snapshots e avisa.
  saveFlowBuilder() {
    if (!window.ActionFlowBuilder) return;
    const nodes = App.state.flowBuilderNodes || [];
    const edges = App.state.flowBuilderEdges || [];
    const esteira = nodes.filter(n => ActionFlowBuilder.isEsteira(n.type));
    if (!esteira.length) return Utils.toast('Adicione pelo menos 1 bloco da Esteira (Produto/Campanha/Ação/Execução) antes de salvar.');

    // ===== Fase 1: validação completa, acumulando todos os erros =====
    const findIncoming = (nodeId, parentType) => {
      const in_ = edges.filter(e => String(e.toId) === String(nodeId));
      return in_.map(e => nodes.find(n => String(n.id) === String(e.fromId))).filter(n => n && n.type === parentType);
    };
    const problems = [];
    for (const n of esteira) {
      const typeLabel = ActionFlowBuilder.typeById(n.type).label;
      const displayName = String(n.data?.name || n.name || '').trim();
      const label = displayName ? `"${displayName}"` : `(sem nome)`;
      if (!displayName) problems.push(`${typeLabel} ${label}: falta nome.`);
      if (n.type === 'campanha') {
        const parents = findIncoming(n.id, 'produto');
        if (parents.length === 0) problems.push(`Campanha ${label}: falta conectar a um Produto.`);
        if (parents.length > 1)   problems.push(`Campanha ${label}: conectada a ${parents.length} Produtos (esperado 1).`);
      }
      if (n.type === 'acao') {
        const parents = findIncoming(n.id, 'campanha');
        if (parents.length === 0) problems.push(`Ação ${label}: falta conectar a uma Campanha.`);
        if (parents.length > 1)   problems.push(`Ação ${label}: conectada a ${parents.length} Campanhas (esperado 1).`);
      }
      if (n.type === 'execucao') {
        const parents = findIncoming(n.id, 'acao');
        if (parents.length === 0) problems.push(`Execução ${label}: falta conectar a uma Ação.`);
        if (parents.length > 1)   problems.push(`Execução ${label}: conectada a ${parents.length} Ações (esperado 1).`);
      }
    }
    if (problems.length) {
      const list = problems.map(p => `• ${p}`).join('\n');
      // Modal cancela tudo e avisa o que faltou (Felipe — fix 6, 2026-06-18).
      alert(`Não dá pra salvar — ${problems.length} ${problems.length === 1 ? 'problema' : 'problemas'} no canvas:\n\n${list}\n\nResolva e tente de novo. Nada foi alterado no LJ.`);
      return;
    }

    // ===== Fase 2: snapshot pra rollback =====
    const snap = {
      products: JSON.parse(JSON.stringify(App.state.products || [])),
      campaigns: JSON.parse(JSON.stringify(App.state.campaigns || [])),
      actions: JSON.parse(JSON.stringify(App.state.actions || [])),
      executionTasks: JSON.parse(JSON.stringify(App.state.executionTasks || [])),
      flowBuilderNodes: JSON.parse(JSON.stringify(nodes))
    };

    const created = { produtos: 0, campanhas: 0, acoes: 0, execucoes: 0 };
    const updated = { produtos: 0, campanhas: 0, acoes: 0, execucoes: 0 };
    let nextId = Date.now();
    const newId = () => ++nextId;
    const nodeMap = new Map(nodes.map(n => [String(n.id), n]));

    try {
      // ===== Fase 3: Produtos (INSERT ou UPDATE silencioso) =====
      // V39.13.0 — Migração do draft do Mapa da Receita: se o nó Produto tem
      // entrada `strategicMaps[proto_<nodeId>]` (preenchida pelo cliente no
      // popup do Builder), move pra `strategicMaps[productIdReal]` ao criar o
      // produto novo. Mantém vision/areaOwners/productKrs intactos.
      for (const n of esteira.filter(n => n.type === 'produto')) {
        const d = n.data || {};
        if (n.linkedRealId) {
          // UPDATE: aplica patch sem mudar id.
          const products = App.state.products || [];
          const idx = products.findIndex(p => Number(p.id) === Number(n.linkedRealId));
          if (idx < 0) continue;
          const existing = products[idx];
          const patched = {
            ...existing,
            name: String(d.name || n.name).trim() || existing.name,
            type: d.type !== undefined ? d.type : existing.type,
            revenueModel: d.revenueModel || existing.revenueModel,
            ...(d.audienceDraft ? { audience: d.audienceDraft } : {})
          };
          const normalized = window.ProductRevenueEngine?.normalize
            ? ProductRevenueEngine.normalize(patched, idx)
            : patched;
          App.state.products = [...products.slice(0, idx), normalized, ...products.slice(idx + 1)];
          updated.produtos++;
          continue;
        }
        const draft = {
          id: newId(),
          name: String(d.name || n.name).trim(),
          type: d.type || '',
          price: d.price || '',
          revenueModel: d.revenueModel || 'Venda única',
          operationalCost: d.operationalCost || '',
          ...(d.audienceDraft ? { audience: d.audienceDraft } : {})
        };
        const product = window.ProductRevenueEngine?.normalize
          ? ProductRevenueEngine.normalize({ ...draft, createdAt: new Date().toISOString() })
          : { ...draft, createdAt: new Date().toISOString() };
        App.state.products = [...(App.state.products || []), product];
        n.linkedRealId = product.id;
        created.produtos++;
        // V39.13.0 — Migra draft do Mapa da Receita (proto_<nodeId> → productIdReal).
        const protoKey = `proto_${n.id}`;
        const maps = App.state.strategicMaps || {};
        if (maps[protoKey]) {
          const migrated = { ...maps[protoKey], productId: product.id };
          const next = { ...maps };
          next[product.id] = migrated;
          delete next[protoKey];
          App.state.strategicMaps = next;
        }
      }

      // ===== Fase 4: Campanhas =====
      for (const n of esteira.filter(n => n.type === 'campanha')) {
        const parents = findIncoming(n.id, 'produto');
        const productId = parents[0]?.linkedRealId;
        if (!productId) continue;
        const d = n.data || {};
        if (n.linkedRealId) {
          const list = App.state.campaigns || [];
          const idx = list.findIndex(c => Number(c.id) === Number(n.linkedRealId));
          if (idx < 0) continue;
          const existing = list[idx];
          const patched = {
            ...existing,
            name: String(d.name || n.name).trim() || existing.name,
            objective: d.objective !== undefined ? String(d.objective).trim() : existing.objective,
            productId: Number(productId)
          };
          App.state.campaigns = [...list.slice(0, idx), patched, ...list.slice(idx + 1)];
          updated.campanhas++;
          continue;
        }
        const campaign = {
          id: newId(),
          productId: Number(productId),
          name: String(d.name || n.name).trim(),
          objective: String(d.objective || '').trim(),
          owner: '',
          sector: d.sector || 'Marketing',
          status: 'Ativa',
          createdAt: new Date().toISOString()
        };
        App.state.campaigns = [campaign, ...(App.state.campaigns || [])];
        n.linkedRealId = campaign.id;
        created.campanhas++;
        if (window.LJEmit) {
          const product = (App.state.products || []).find(p => Number(p.id) === Number(campaign.productId));
          try {
            window.LJEmit({
              audience: 'tenant_wide', kind: 'event.campaign_created', category: 'event', severity: 'info',
              title: `Nova campanha: ${campaign.name}`, body: product ? `No produto ${product.name}` : null,
              data: { campaignId: campaign.id, campaignName: campaign.name, productId: campaign.productId, productName: product?.name, source: 'flow_builder' },
              entityKind: 'campaign', entityId: String(campaign.id)
            });
          } catch (_) {}
        }
      }

      // ===== Fase 5: Ações =====
      for (const n of esteira.filter(n => n.type === 'acao')) {
        const parents = findIncoming(n.id, 'campanha');
        const campaignId = parents[0]?.linkedRealId;
        if (!campaignId) continue;
        const d = n.data || {};
        const sector = d.sector || 'Marketing';
        const funnel = d.funnel || 'MOF';
        const destSector = d.destinationSector || sector;
        const destFunnel = d.destinationFunnel || funnel;
        const channel = d.channel || 'Instagram Orgânico';
        const actionType = d.actionType || 'Post';
        const flowPath = window.FlowResolutionEngine ? FlowResolutionEngine.resolve(sector, funnel, destSector, destFunnel) : [];
        const flowConfig = window.FlowResolutionEngine ? FlowResolutionEngine.buildDefaultFlowConfig(flowPath, '') : {};
        if (n.linkedRealId) {
          const list = App.state.actions || [];
          const idx = list.findIndex(a => Number(a.id) === Number(n.linkedRealId));
          if (idx < 0) continue;
          const existing = list[idx];
          const patched = {
            ...existing,
            name: String(d.name || n.name).trim() || existing.name,
            sector, funnel, originSector: sector, originFunnel: funnel,
            destinationSector: destSector, destinationFunnel: destFunnel,
            channel, actionType,
            objective: d.objective !== undefined ? String(d.objective).trim() : existing.objective,
            flowPath, flowConfig,
            campaignId: Number(campaignId)
          };
          App.state.actions = [...list.slice(0, idx), patched, ...list.slice(idx + 1)];
          updated.acoes++;
          continue;
        }
        const action = {
          id: newId(),
          campaignId: Number(campaignId),
          name: String(d.name || n.name).trim(),
          channel, actionType,
          sector, funnel,
          originSector: sector, originFunnel: funnel,
          destinationSector: destSector, destinationFunnel: destFunnel,
          conversionObjective: '',
          objective: String(d.objective || '').trim(),
          expectedConversion: 25,
          mailingDefined: false,
          okrs: [],
          flowPath,
          scoreId: App.state.scores?.[0]?.id || 1,
          connected: false,
          connectionStatus: 'ready',
          status: 'Pronta para conectar',
          leads: [],
          flowConfig,
          createdAt: new Date().toISOString()
        };
        App.state.actions = [action, ...(App.state.actions || [])];
        n.linkedRealId = action.id;
        created.acoes++;
        if (window.LJEmit) {
          const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(action.campaignId));
          try {
            window.LJEmit({
              audience: 'tenant_wide', kind: 'event.action_created', category: 'event', severity: 'info',
              title: `Nova ação: ${action.name}`, body: campaign ? `Na campanha ${campaign.name}` : null,
              data: { actionId: action.id, actionName: action.name, campaignId: action.campaignId, source: 'flow_builder' },
              entityKind: 'action', entityId: String(action.id)
            });
          } catch (_) {}
        }
      }

      // ===== Fase 6: Execuções (via ExecutionTaskStore) =====
      for (const n of esteira.filter(n => n.type === 'execucao')) {
        const parents = findIncoming(n.id, 'acao');
        const actionId = parents[0]?.linkedRealId;
        if (!actionId) continue;
        if (!window.ExecutionTaskStore) continue;
        const action = (App.state.actions || []).find(a => Number(a.id) === Number(actionId));
        const d = n.data || {};
        const title = String(d.name || n.name).trim();
        if (n.linkedRealId) {
          // UPDATE: usa store.update se disponível, senão patch direto no array.
          if (typeof ExecutionTaskStore.update === 'function') {
            try {
              ExecutionTaskStore.update(n.linkedRealId, { title, linked_action_id: Number(actionId), linked_campaign_id: action?.campaignId });
            } catch (_) {}
          } else {
            const list = App.state.executionTasks || [];
            const idx = list.findIndex(t => String(t.task_id) === String(n.linkedRealId));
            if (idx >= 0) {
              const patched = { ...list[idx], title, linked_action_id: Number(actionId), linked_campaign_id: action?.campaignId };
              App.state.executionTasks = [...list.slice(0, idx), patched, ...list.slice(idx + 1)];
            }
          }
          updated.execucoes++;
          continue;
        }
        const task = ExecutionTaskStore.create({
          linked_action_id: Number(actionId),
          linked_campaign_id: action?.campaignId,
          title,
          status: 'pending',
          source_agent: 'flow_builder'
        });
        n.linkedRealId = task?.task_id || null;
        if (n.linkedRealId) created.execucoes++;
      }

      App.state.flowBuilderNodes = nodes.map(n => nodeMap.get(String(n.id)) || n);
    } catch (err) {
      // ===== Rollback completo se qualquer fase explodir =====
      App.state.products = snap.products;
      App.state.campaigns = snap.campaigns;
      App.state.actions = snap.actions;
      App.state.executionTasks = snap.executionTasks;
      App.state.flowBuilderNodes = snap.flowBuilderNodes;
      App.save(); App.render();
      alert(`Falha ao salvar esteira: ${err?.message || err}\n\nNada foi alterado no LJ — estado restaurado pro snapshot anterior.`);
      return;
    }

    App.save(); App.render();
    setTimeout(() => { try { ActionFlowBuilder.attach(); } catch (_) {} }, 0);

    const totalCreated = created.produtos + created.campanhas + created.acoes + created.execucoes;
    const totalUpdated = updated.produtos + updated.campanhas + updated.acoes + updated.execucoes;
    if (totalCreated === 0 && totalUpdated === 0) {
      Utils.toast('Nada pra salvar — canvas vazio de mudanças.');
      return;
    }
    const fmt = (counts, verb) => {
      const parts = [];
      if (counts.produtos)  parts.push(`${counts.produtos} ${counts.produtos === 1 ? 'produto' : 'produtos'}`);
      if (counts.campanhas) parts.push(`${counts.campanhas} ${counts.campanhas === 1 ? 'campanha' : 'campanhas'}`);
      if (counts.acoes)     parts.push(`${counts.acoes} ${counts.acoes === 1 ? 'ação' : 'ações'}`);
      if (counts.execucoes) parts.push(`${counts.execucoes} ${counts.execucoes === 1 ? 'execução' : 'execuções'}`);
      return parts.length ? `${verb} ${parts.join(' · ')}` : '';
    };
    const msg = [fmt(created, 'Criou'), fmt(updated, 'Atualizou')].filter(Boolean).join(' · ');
    Utils.toast(`✓ Esteira salva no LJ: ${msg}`);
  },

  // V39.9.0 — Modal de "Carregar campanha existente" pra continuar editando
  // uma campanha já criada (importa Produto + Campanha + Ações + Execuções
  // como blocos pré-linkados no canvas).
  openFlowBuilderLoadCampaign() {
    App.state.flowBuilderLoadCampaignModal = true;
    App.save(); App.render();
  },

  closeFlowBuilderLoadCampaign() {
    App.state.flowBuilderLoadCampaignModal = false;
    App.save(); App.render();
  },

  loadCampaignToFlowBuilder(campaignId) {
    if (!window.ActionFlowBuilder) return;
    const cid = Number(campaignId);
    const campaign = (App.state.campaigns || []).find(c => Number(c.id) === cid);
    if (!campaign) return Utils.toast('Campanha não encontrada.');
    const product = (App.state.products || []).find(p => Number(p.id) === Number(campaign.productId));
    const actionsOfCamp = (App.state.actions || []).filter(a => Number(a.campaignId) === cid);
    const tasksByAction = new Map();
    if (window.ExecutionTaskStore) {
      for (const a of actionsOfCamp) {
        const tasks = ExecutionTaskStore.byAction
          ? ExecutionTaskStore.byAction(Number(a.id))
          : (App.state.executionTasks || []).filter(t => Number(t.linked_action_id) === Number(a.id));
        tasksByAction.set(Number(a.id), tasks || []);
      }
    }

    const nodes = [];
    const edges = [];

    // Layout horizontal: Produto col 0, Campanha col 1, Ação col 2, Execução col 3
    const colX = [60, 340, 620, 900];
    const rowH = 140;

    let produtoNodeId = null;
    if (product) {
      produtoNodeId = ActionFlowBuilder.genId();
      nodes.push({
        id: produtoNodeId, type: 'produto', name: product.name || 'Produto',
        x: colX[0], y: 100,
        data: { name: product.name || '', revenueModel: product.revenueModel || 'Venda única', type: product.type || '', price: String(product.price || '') },
        linkedRealId: product.id
      });
    }

    const campNodeId = ActionFlowBuilder.genId();
    nodes.push({
      id: campNodeId, type: 'campanha', name: campaign.name,
      x: colX[1], y: 100,
      data: { name: campaign.name, sector: campaign.sector || 'Marketing', objective: campaign.objective || '' },
      linkedRealId: campaign.id
    });
    if (produtoNodeId) edges.push({ id: `e_${Date.now()}_${Math.floor(Math.random() * 100000)}_pc`, fromId: produtoNodeId, toId: campNodeId });

    actionsOfCamp.forEach((a, ai) => {
      const acaoNodeId = ActionFlowBuilder.genId();
      nodes.push({
        id: acaoNodeId, type: 'acao', name: a.name,
        x: colX[2], y: 60 + ai * rowH,
        data: { name: a.name, sector: a.sector || 'Marketing', funnel: a.funnel || 'MOF', objective: a.objective || '' },
        linkedRealId: a.id
      });
      edges.push({ id: `e_${Date.now()}_${Math.floor(Math.random() * 100000)}_ca${ai}`, fromId: campNodeId, toId: acaoNodeId });

      const tasks = tasksByAction.get(Number(a.id)) || [];
      tasks.forEach((t, ti) => {
        const execNodeId = ActionFlowBuilder.genId();
        nodes.push({
          id: execNodeId, type: 'execucao', name: t.title || 'Execução',
          x: colX[3], y: 60 + ai * rowH + ti * 40,
          data: { name: t.title || '' },
          linkedRealId: t.task_id
        });
        edges.push({ id: `e_${Date.now()}_${Math.floor(Math.random() * 100000)}_ae${ai}_${ti}`, fromId: acaoNodeId, toId: execNodeId });
      });
    });

    App.state.flowBuilderNodes = nodes;
    App.state.flowBuilderEdges = edges;
    App.state.flowBuilderConnectionArm = null;
    App.state.flowBuilderLoadCampaignModal = false;
    App.save(); App.render();
    setTimeout(() => { try { ActionFlowBuilder.attach(); } catch (_) {} }, 0);
    Utils.toast(`✓ Carregada: ${campaign.name} (${actionsOfCamp.length} ${actionsOfCamp.length === 1 ? 'ação' : 'ações'})`);
  },

  // V37.0.8 — Bloco "Landing Page actions" (V15 — openLpModal, closeLpModal,
  // updateLpDraftField/Silent, addLpCheckpoint, removeLpCheckpoint,
  // updateLpCheckpoint/Silent, reorderLpCheckpoint, saveLpAction,
  // copyLpTrackingScript, validateLpInstallation, pollLpEvents) REMOVIDO.
  //
  // Caminho era vestigial pré-Tracking V33: cliente preenchia draft + checkpoints
  // mas nenhum consumidor moderno lia o output (action.lp / lpRegistry). Pra LP
  // com tracking real hoje, fluxo é Tracking V33 (snippet → /api/tracker-event).

  // V15 — RD CRM actions
  _ensureRdCrmConfig() {
    App.state.integrations = App.state.integrations || {};
    if (!App.state.integrations.rdCrm) App.state.integrations.rdCrm = window.RdCrmConfig ? RdCrmConfig.defaultConfig() : {};
    return App.state.integrations.rdCrm;
  },

  async testRdCrmConnection() {
    const cfg = this._ensureRdCrmConfig();
    // V22.3.4 — Gate é CRM PAT, não OAuth (que é opcional p/ Marketing).
    if (!RdCrmConfig.hasCrmToken()) {
      cfg.lastSyncStatus = 'no_crm_token';
      cfg.lastSyncMessage = 'CRM Personal Token ausente.';
      App.save(); App.render();
      return Utils.toast('Configure o CRM Personal Token primeiro.');
    }
    Utils.toast('Testando conexão RD CRM...');
    const result = await RdCrmPipelineService.listPipelines();
    if (result.ok) {
      cfg.lastSyncStatus = 'success';
      cfg.lastSyncMessage = `Conexão OK • ${(result.pipelines || []).length} pipeline(s) acessíveis.`;
      Utils.toast('✓ Conexão RD CRM validada.');
    } else {
      cfg.lastSyncStatus = 'error';
      cfg.lastSyncMessage = result.message || 'Falha desconhecida ao testar.';
      Utils.toast('Falha ao conectar. Veja o card de status.');
    }
    App.save(); App.render();
  },

  async listRdCrmPipelines() {
    const cfg = this._ensureRdCrmConfig();
    Utils.toast('Listando pipelines do RD...');
    const result = await RdCrmPipelineService.listPipelines();
    if (!result.ok) {
      cfg.lastSyncStatus = 'pipeline_error';
      cfg.lastSyncMessage = result.message;
      App.save(); App.render();
      return Utils.toast(`Falha: ${result.message}`);
    }
    cfg.lastSyncStatus = 'success';
    cfg.lastSyncMessage = `${(result.pipelines || []).length} pipeline(s) encontrados.`;
    App.save(); App.render();
    Utils.toast(cfg.lastSyncMessage);
  },

  // V21.6 — Legacy: cria um pipeline global "Journey Revenue Pipeline" no RD.
  // Mantido para compat com botão antigo, mas a recomendação é usar
  // syncAllCampaignPipelines / syncCampaignPipeline (1 pipeline por campanha).
  async createJourneyRevenuePipeline() {
    const cfg = this._ensureRdCrmConfig();
    if (!RdCrmConfig.hasCrmToken()) return Utils.toast('Configure o CRM Personal Token primeiro.');
    Utils.toast('Criando Journey Revenue Pipeline no RD...');
    const result = await RdCrmPipelineService.createUniqueJourneyPipeline();
    if (!result.ok) {
      cfg.lastSyncStatus = 'pipeline_error';
      cfg.lastSyncMessage = result.message;
      App.save(); App.render();
      return Utils.toast(`Falha: ${result.message}`);
    }
    cfg.pipelineId = result.pipeline?.id || result.pipeline?._id || '';
    cfg.pipelineName = result.name || result.pipeline?.name || RdCrmConfig.defaultPipelineName;
    if (result.collisionAvoided) {
      Utils.toast(`Já existia "${result.requestedName}" no RD. Criamos "${cfg.pipelineName}" para não tocar no seu.`);
    }
    const stages = await RdCrmStageService.ensureJourneyStages(cfg.pipelineId);
    if (!stages.ok) {
      cfg.lastSyncStatus = 'stages_error';
      cfg.lastSyncMessage = stages.message;
      App.save(); App.render();
      return Utils.toast(`Pipeline OK, mas etapas falharam: ${stages.message}`);
    }
    cfg.stageMap = stages.stageMap;
    cfg.lastSyncStatus = 'success';
    cfg.lastSyncMessage = result.created
      ? `Pipeline criado e ${stages.created.length} etapa(s) criadas no RD.`
      : `Pipeline já existente conectado. ${stages.created.length} etapa(s) novas, ${stages.reused.length} reusadas.`;
    cfg.lastSyncAt = new Date().toISOString();
    App.save(); App.render();
    Utils.toast('✓ ' + cfg.lastSyncMessage);
  },

  // V21.6 — Sincroniza UMA campanha específica (cria pipeline próprio + 9 stages).
  async syncCampaignPipeline(campaignId) {
    if (!RdCrmConfig.hasCrmToken()) return Utils.toast('Configure o CRM Personal Token primeiro.');
    const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(campaignId));
    if (!campaign) return Utils.toast('Campanha não encontrada.');
    Utils.toast(`Sincronizando pipeline da campanha "${campaign.name}"...`);
    const result = await RdCrmSyncEngine.runSync({ campaignId: campaign.id });
    Utils.toast(result.ok ? `✓ ${result.message}` : `Falha: ${result.message}`);
  },

  // V22.0 — Alias semântico do botão "Gerar Pipeline" no card da campanha.
  // Encapsula a mesma lógica de syncCampaignPipeline mas com toast de UX
  // mais direto pra esse contexto.
  async generateCampaignPipeline(campaignId) {
    if (!RdCrmConfig.hasCrmToken()) return Utils.toast('Configure o CRM Personal Token em Configurações → RD Station primeiro.');
    const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(campaignId));
    if (!campaign) return Utils.toast('Campanha não encontrada.');
    Utils.toast(`Gerando pipeline no RD para "${campaign.name}"...`);
    const result = await RdCrmSyncEngine.runSync({ campaignId: campaign.id });
    if (result.ok) {
      Utils.toast(`✓ Pipeline criado no RD: "${campaign.name}".`);
    } else {
      Utils.toast(`Falha ao gerar pipeline: ${result.message}`);
    }
  },

  // V22.0 — Envia ICP da campanha (todos os leads vinculados a ela) pro RD.
  // Para cada lead: upsertContact + createDeal no Marketing TOF da campanha.
  // Reusa deals existentes via dealsByLead (idempotente).
  async pushCampaignICPToRD(campaignId) {
    if (!RdCrmConfig.hasCrmToken()) return Utils.toast('Configure o CRM Personal Token primeiro.');
    if (!RdCrmConfig.hasPipelineForCampaign(campaignId)) {
      return Utils.toast('Gere o pipeline da campanha antes de enviar leads.');
    }
    const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(campaignId));
    if (!campaign) return Utils.toast('Campanha não encontrada.');
    const pipelineInfo = RdCrmConfig.pipelineInfoForCampaign(campaignId);
    const stageMap = pipelineInfo?.stageMap || {};
    // V22.0 — Stage inicial: Marketing TOF (primeira do funil).
    const initialStage = stageMap.mkt_tof;
    if (!initialStage?.rdStageId) {
      return Utils.toast('Stage "Marketing TOF" não encontrada. Resincronize o pipeline.');
    }
    // V22.0/22.1 — Produto da campanha p/ derivar ticket médio inicial.
    // V22.1: prefere product.priceValue (já parseado pelo normalize) sobre
    // product.price (string crua). Fallback p/ parse manual.
    const product = (App.state.products || []).find(p => Number(p.id) === Number(campaign.productId));
    const productPrice = Number(product?.priceValue) > 0
      ? Number(product.priceValue)
      : (window.ProductRevenueEngine?.parseMoney
        ? ProductRevenueEngine.parseMoney(product?.price || product?.ticket || 0)
        : Number(String(product?.price || product?.ticket || '0').replace(/[^\d.,-]/g, '').replace(',', '.')) || 0);

    const leads = window.LeadBaseService?.forCampaign?.(campaignId) || [];
    if (!leads.length) {
      return Utils.toast('Nenhum lead vinculado a essa campanha.');
    }

    Utils.toast(`Enviando ${leads.length} lead(s) pro RD...`);
    let success = 0, skipped = 0, failed = 0;
    const failures = [];

    for (const lead of leads) {
      const leadKey = LeadBaseService.keyOf(lead);
      if (!leadKey) { failed += 1; continue; }
      // Já tem deal pra esse lead nessa campanha? Skip (idempotência).
      const existing = RdCrmConfig.dealForLead(leadKey, campaignId);
      if (existing?.rdDealId) { skipped += 1; continue; }
      try {
        const contactRes = await RdCrmContactService.upsertContact(lead);
        if (!contactRes.ok) {
          failed += 1;
          failures.push(`${lead.email || lead.name}: ${contactRes.message}`);
          continue;
        }
        // V22.1 — Usa internalId formatado como L-XXXXXX (últimos 6 chars
        // do id original). Fallback p/ primeiros 8 chars do leadKey.
        const idShort = lead.internalId
          ? `L-${String(lead.internalId).slice(-6)}`
          : `L-${String(leadKey).replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase()}`;
        const dealName = `${lead.name || lead.email} – ${idShort}`;
        const dealRes = await RdCrmDealService.createDeal({
          rdContactId: contactRes.rdContactId,
          pipelineId: pipelineInfo.pipelineId,
          stageId: initialStage.rdStageId,
          name: dealName,
          amount: productPrice
        });
        if (!dealRes.ok) {
          failed += 1;
          failures.push(`${lead.email || lead.name}: ${dealRes.message}`);
          continue;
        }
        RdCrmConfig.setDealForLead(leadKey, campaignId, {
          rdDealId: dealRes.rdDealId,
          rdContactId: contactRes.rdContactId,
          currentStageCode: 'mkt_tof',
          amount: productPrice,
          createdAt: new Date().toISOString(),
          lastMovedAt: new Date().toISOString()
        });
        success += 1;
      } catch (err) {
        failed += 1;
        failures.push(`${lead.email || lead.name}: ${err?.message || err}`);
      }
    }
    App.save();
    App.render();
    const msg = `${success} enviado(s), ${skipped} já existente(s), ${failed} falha(s).${failures.length ? ` Detalhes: ${failures.slice(0, 3).join('; ')}` : ''}`;
    Utils.toast(failed ? `⚠ ${msg}` : `✓ ${msg}`);
  },

  // V21.6 — Sincroniza TODAS as campanhas elegíveis (com ações, leads ou blueprint).
  async syncAllCampaignPipelines() {
    if (!RdCrmConfig.hasCrmToken()) return Utils.toast('Configure o CRM Personal Token primeiro.');
    Utils.toast('Sincronizando pipelines de todas as campanhas elegíveis...');
    const result = await RdCrmSyncEngine.runSync();
    Utils.toast(result.ok ? `✓ ${result.message}` : `Falha: ${result.message}`);
  },

  async listRdCrmStages() {
    const cfg = this._ensureRdCrmConfig();
    if (!cfg.pipelineId) return Utils.toast('Conecte um pipeline primeiro.');
    Utils.toast('Listando etapas do RD...');
    const result = await RdCrmStageService.listStages(cfg.pipelineId);
    if (!result.ok) {
      cfg.lastSyncMessage = result.message;
      App.save(); App.render();
      return Utils.toast(`Falha: ${result.message}`);
    }
    cfg.lastSyncMessage = `${(result.stages || []).length} etapa(s) lidas do RD.`;
    App.save(); App.render();
    Utils.toast(cfg.lastSyncMessage);
  },

  async runRdCrmSyncNow() {
    const result = await RdCrmSyncEngine.runSync();
    Utils.toast(result.ok ? `✓ ${result.message || 'Sync RD CRM concluído.'}` : `Falha: ${result.message}`);
  },

  toggleRdCrmAutoSync() {
    const cfg = this._ensureRdCrmConfig();
    if (cfg.autoSync) {
      RdCrmSyncEngine.stopAutoSync();
      Utils.toast('Sync automático RD CRM desativado.');
    } else {
      if (!RdCrmConfig.hasCrmToken()) {
        Utils.toast('Configure o CRM Personal Token primeiro.');
        return;
      }
      RdCrmSyncEngine.startAutoSync();
      Utils.toast('Sync automático ativado (5 min).');
    }
    App.save(); App.render();
  },

  setRdCrmAutoSyncMode(mode) {
    const cfg = this._ensureRdCrmConfig();
    cfg.autoSyncMode = ['frontend', 'electron', 'backend'].includes(mode) ? mode : 'frontend';
    if (cfg.autoSync) {
      RdCrmSyncEngine.stopAutoSync(false);
      RdCrmSyncEngine.startAutoSync();
    }
    App.save(); App.render();
  },

  linkActionToRdCrm(actionId, payload) {
    const result = RdCrmActionMapper.linkAction(actionId, payload || {});
    if (!result.ok) return Utils.toast(result.message);
    App.save(); App.render();
    Utils.toast('Ação vinculada ao pipeline RD CRM.');
  },

  unlinkActionFromRdCrm(actionId) {
    const result = RdCrmActionMapper.unlinkAction(actionId);
    if (!result.ok) return Utils.toast(result.message);
    App.save(); App.render();
    Utils.toast('Vínculo com RD CRM removido.');
  },
  // V32.4.0 (Geraldo Item 6) — saveDatabaseConfig, chooseLocalDatabaseFolder,
  // writeLocalFolderSnapshot removidas (eram do _localPanel V11).
  // V32.4.0 (Geraldo Item 6) — readLocalFolderSnapshot + syncDatabaseNow removidas (eram do _localPanel V11).
});
window.Actions = Actions;

// V12.4 — OKR/KPI Revenue Operating System actions.
Object.assign(Actions, {
  updateOkrDraft(field, value) {
    App.state.okrDraft = { ...(App.state.okrDraft || {}), [field]: value };
    App.save();
  },
  createStrategicOkr() {
    const d = App.state.okrDraft || {};
    const objective = String(d.objective || d.name || '').trim();
    if (!objective) return Utils.toast('Digite o objetivo estratégico do OKR.');
    const okr = {
      id: `okr_${Date.now()}`,
      name: objective,
      objective,
      keyResult: String(d.keyResult || '').trim(),
      target: d.target || '',
      current: d.current || '',
      unit: d.unit || 'R$',
      owner: d.owner || '',
      deadline: d.deadline || '',
      status: d.status || 'Em andamento',
      createdAt: new Date().toISOString()
    };
    App.state.strategicOkrs = [okr, ...(App.state.strategicOkrs || [])];
    App.state.selectedOkrId = okr.id;
    App.state.kpiDraft = { ...(App.state.kpiDraft || {}), relatedOkrId: okr.id };
    App.state.okrDraft = { objective: '', keyResult: '', target: '', unit: 'R$', owner: '', deadline: '', status: 'Em andamento' };
    App.save(); App.render(); Utils.toast('OKR estratégico criado e pronto para receber KPIs.');
  },
  selectStrategicOkr(id) {
    App.state.selectedOkrId = id;
    App.state.kpiDraft = { ...(App.state.kpiDraft || {}), relatedOkrId: id };
    App.save(); App.render();
  },
  deleteStrategicOkr(id) {
    App.state.strategicOkrs = (App.state.strategicOkrs || []).filter(okr => okr.id !== id);
    App.state.operationalKpis = (App.state.operationalKpis || []).map(kpi => kpi.relatedOkrId === id ? { ...kpi, relatedOkrId: null } : kpi);
    if (App.state.selectedOkrId === id) App.state.selectedOkrId = null;
    App.save(); App.render(); Utils.toast('OKR removido. KPIs foram mantidos sem vínculo.');
  },
  updateKpiDraft(field, value) {
    const numericFields = ['productId'];
    App.state.kpiDraft = { ...(App.state.kpiDraft || {}), [field]: numericFields.includes(field) && value ? Number(value) : value };
    App.save();
  },
  createOperationalKpi() {
    const d = App.state.kpiDraft || {};
    const name = String(d.name || '').trim();
    if (!name) return Utils.toast('Digite o nome do KPI.');
    const kpi = {
      id: `kpi_${Date.now()}`,
      name,
      metric: d.metric || 'revenue',
      scope: d.scope || 'global',
      productId: d.scope === 'product' ? Number(d.productId || App.state.selectedProductId || 0) : null,
      target: d.target || '',
      unit: d.unit || (['revenue','grossProfit','mrr'].includes(d.metric) ? 'R$' : d.metric === 'conversion' ? '%' : 'un'),
      frequency: d.frequency || 'Semanal',
      source: d.source || 'Automático pelo Revenue Engine',
      relatedOkrId: d.relatedOkrId || App.state.selectedOkrId || null,
      manualCurrent: d.manualCurrent || '',
      createdAt: new Date().toISOString()
    };
    App.state.operationalKpis = [kpi, ...(App.state.operationalKpis || [])];
    App.state.kpiDraft = { name: '', metric: 'revenue', scope: 'global', productId: App.state.selectedProductId || null, target: '', unit: 'R$', frequency: 'Semanal', source: 'Automático pelo Revenue Engine', relatedOkrId: App.state.selectedOkrId || null };
    App.save(); App.render(); Utils.toast('KPI operacional criado e calculado pelo motor RevOps.');
  },
  deleteOperationalKpi(id) {
    App.state.operationalKpis = (App.state.operationalKpis || []).filter(kpi => kpi.id !== id);
    App.save(); App.render(); Utils.toast('KPI removido.');
  },
  createDefaultRevenueOkrStack() {
    const target = (App.state.products || []).reduce((sum, p) => sum + (RevenueOKRKPIEngine.number(p.price) * 10), 0) || 100000;
    const okr = { id: `okr_${Date.now()}`, name: 'Escalar receita previsível', objective: 'Escalar receita previsível', keyResult: `Gerar ${RevenueOKRKPIEngine.money(target)} em receita atribuída`, target, unit: 'R$', owner: 'Revenue', deadline: '', status: 'Em andamento', createdAt: new Date().toISOString() };
    App.state.strategicOkrs = [okr, ...(App.state.strategicOkrs || [])];
    App.state.operationalKpis = [
      { id: `kpi_${Date.now()}_1`, name: 'Receita atribuída', metric: 'revenue', scope: 'global', target, unit: 'R$', frequency: 'Semanal', source: 'Produto × conversões', relatedOkrId: okr.id, createdAt: new Date().toISOString() },
      { id: `kpi_${Date.now()}_2`, name: 'Leads convertidos', metric: 'converted', scope: 'global', target: 50, unit: 'leads', frequency: 'Semanal', source: 'Fluxo das ações', relatedOkrId: okr.id, createdAt: new Date().toISOString() },
      { id: `kpi_${Date.now()}_3`, name: 'Conversão total', metric: 'conversion', scope: 'global', target: 12, unit: '%', frequency: 'Semanal', source: 'Leads impactados → convertidos', relatedOkrId: okr.id, createdAt: new Date().toISOString() }
    ].concat(App.state.operationalKpis || []);
    App.state.selectedOkrId = okr.id;
    App.save(); App.render(); Utils.toast('Stack OKR/KPI padrão criada.');
  }
});
window.Actions = Actions;


// V13 — RD Station integration actions.
Object.assign(Actions, {
  ensureIntegrations() {
    App.state.integrations = App.state.integrations || {};
    App.state.integrations.rd = {
      ...(window.RDConfig ? RDConfig.defaultConfig() : {}),
      ...(App.state.integrations.rd || {})
    };
  },

  updateRDConfig(field, value) {
    this.ensureIntegrations();
    const prev = App.state.integrations.rd[field];
    // V31.2.44 — Removido auto-/ (V31.2.42 quebrou caso RD app cadastrado SEM /).
    if (field === 'redirectUri' && typeof value === 'string') {
      value = value.trim();
    }
    App.state.integrations.rd[field] = value;
    // V22.3.6 — Quando o token CRM muda, força re-validação (crmTestStatus
    // volta a 'not_tested'). Sem isso o assistente acharia que a conexão
    // antiga ainda está válida com o novo token.
    if (field === 'crmPersonalToken' && prev !== value) {
      App.state.integrations.rd.crmTestStatus = 'not_tested';
      App.state.integrations.rd.crmTestAt = '';
    }
    App.save();
    // V31.2.36 — Write-through pro DB. Decide tipo pelo campo mutado.
    if (field === 'crmPersonalToken') this._persistRdToDb('crm_pat');
    else if (['accessToken', 'refreshToken', 'expiresAt', 'clientId', 'clientSecret', 'redirectUri', 'accountName', 'workspaceId', 'status'].includes(field)) this._persistRdToDb('marketing_oauth');
  },

  generateRDAuthUrl() {
    this.ensureIntegrations();
    const result = RDAuthService.buildAuthorizationUrl(App.state.integrations.rd);
    if (!result.ok) return Utils.toast(result.message);

    App.state.integrations.rd.authUrl = result.url;
    App.state.integrations.rd.status = 'ready_for_oauth';
    App.save();
    App.render();
    Utils.toast('URL OAuth do RD gerada.');
  },

  async testRDConnection() {
    this.ensureIntegrations();
    const result = await RDAuthService.testConnection(App.state.integrations.rd);
    // V22.3.6 — Escreve em campos SEPARADOS para CRM (que é o caminho
    // primário hoje). status/lastTestAt ficam reservados para OAuth Marketing.
    // Se o teste falhar com mensagem específica, mapeia pra status genérico.
    const isConnected = result.ok && result.status === 'connected';
    App.state.integrations.rd.crmTestStatus = isConnected ? 'connected' : (result.status || 'error');
    App.state.integrations.rd.crmTestAt = result.testedAt || new Date().toISOString();
    App.save();
    App.render();
    this._persistRdToDb('crm_pat'); // V31.2.36 — write-through
    Utils.toast(result.message || 'Teste RD finalizado.');
  },

  clearRDConfig() {
    this.ensureIntegrations();
    App.state.integrations.rd = RDConfig.defaultConfig();
    App.save();
    App.render();
    this._deleteRdCredentialFromDb(); // V31.2.36 — apaga TODOS os 3 tipos do DB
    Utils.toast('Configuração RD limpa.');
  },

  // V23.0.0 — Logout: limpa JWT + user cache + reload (vai pra tela de login).
  // V31.2.3 — Fix vazamento entre contas no mesmo navegador:
  //   1. Flush push pendente PRIMEIRO (garante deleções/edits no DB antes de sair)
  //   2. Limpa state localStorage SEMPRE (antes só sandbox limpava → vazava
  //      pra próxima conta que logasse no mesmo browser)
  // V36.5.1 — Logout-força-bruta sem confirm, sem flushNow, sem nada que pode
  // travar. Pra emergências quando JWT está órfão e nada normal funciona.
  // Limpa localStorage, sessionStorage, intervals, state em memória. Reload via
  // location.replace (sem voltar pelo back) com query bust pra zerar cache.
  forceFullLogout() {
    try {
      if (window._healthCheckInterval) clearInterval(window._healthCheckInterval);
      if (window._rdWebhookSyncInterval) clearInterval(window._rdWebhookSyncInterval);
      if (window._krSnapshotInterval) clearInterval(window._krSnapshotInterval);
    } catch (_) {}
    try { localStorage.clear(); } catch (_) {}
    try { sessionStorage.clear(); } catch (_) {}
    // Limpa cookies do domínio (se houver)
    try {
      document.cookie.split(';').forEach(c => {
        const eq = c.indexOf('=');
        const name = (eq > -1 ? c.substring(0, eq) : c).trim();
        document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
      });
    } catch (_) {}
    // Apaga state em memória
    try {
      if (window.App) {
        window.App.state = null;
        window.App.currentUser = null;
      }
    } catch (_) {}
    // Reload forçado sem cache
    window.location.replace('/?force_logout=' + Date.now());
  },

  async logout() {
    if (!confirm('Deslogar do LeadJourney? Mudanças não salvas podem ser perdidas.')) return;
    // 1. Flush push pendente. Se master/production tinha edit pendente (ex: apagou
    // produto e logou em < 2s do debounce), garante que o DB recebe antes do logout.
    try {
      if (window.RemoteSyncAdapter?.flushNow) await RemoteSyncAdapter.flushNow();
    } catch (_) { /* segue mesmo se push falhar */ }
    // 2. Limpa state local de QUALQUER user (master, production, demo, sandbox).
    // DB é fonte da verdade; localStorage é só cache. Evita vazamento entre contas.
    try { StorageAdapter?.clear?.(); } catch (_) {}
    // 3. Limpa auth cache.
    localStorage.removeItem('lj_jwt');
    localStorage.removeItem('lj_user');
    window.location.reload();
  },

  // ─────────────────────────────────────────────────────────────────
  // V32.12.4 — RELOGIN INLINE (jwt expirado, evita perda de dados)
  // ─────────────────────────────────────────────────────────────────
  //
  // Lei JWT silent failure: 401 em QUALQUER endpoint NUNCA pode ser silencioso.
  // Cravada após perda Sansone 2026-05-25 (ações criadas no Mapa nunca chegaram
  // ao DB porque _doPush deu 401 silencioso, snapshots automáticos idem).
  //
  // Comportamento: detecção 401 abre modal bloqueante. Cliente digita senha,
  // pegamos novo JWT, atualizamos localStorage, _doPush imediato pra empurrar
  // o que estava pendente. localStorage NUNCA é limpo (preserva trabalho).
  //
  // Caso cliente queira sair: botão "Sair mesmo assim" baixa JSON backup
  // automático ANTES de chamar logout normal.

  // V35.6.4 — opts.mode: 'urgent' (default — write 401, fundo vermelho) ou
  // 'friendly' (banner click — fundo neutro, sem dramatização). Friendly é
  // pra quando o user voluntariamente decide reentrar, não pra quando ele
  // tá pra perder trabalho.
  openReloginInlineModal(opts) {
    if (App.state.reloginInlineModal?.open) return; // idempotente
    const mode = (opts && opts.mode === 'friendly') ? 'friendly' : 'urgent';
    App.state.reloginInlineModal = { open: true, error: null, loading: false, mode };
    App.render();
  },

  // V35.4.3 — Banner discreto dispara reabertura do modal completo.
  // V35.6.4 — Banner abre em modo friendly (não-urgente).
  openReloginFromBanner() {
    Actions.openReloginInlineModal({ mode: 'friendly' });
  },

  closeReloginInlineModal() {
    App.state.reloginInlineModal = { open: false, error: null, loading: false };
    App.render();
  },

  async submitReloginInline(password) {
    const pwd = String(password || '');
    if (!pwd.trim()) {
      App.state.reloginInlineModal = { open: true, error: 'Informe a senha.', loading: false };
      App.render();
      return;
    }
    // Lê username do JWT atual (mesmo expirado, payload é legível).
    let username = null;
    try {
      const jwt = localStorage.getItem('lj_jwt');
      if (jwt) {
        const payload = JSON.parse(atob(jwt.split('.')[1]));
        username = payload?.username || null;
      }
    } catch (_) {}
    // Fallback: lê de lj_user cache
    if (!username) {
      try {
        const u = JSON.parse(localStorage.getItem('lj_user') || '{}');
        username = u.username || u.email || null;
      } catch (_) {}
    }
    if (!username) {
      App.state.reloginInlineModal = { open: true, error: 'Sem username em cache — vai precisar deslogar e logar manualmente.', loading: false };
      App.render();
      return;
    }
    // Loading
    App.state.reloginInlineModal = { open: true, error: null, loading: true };
    App.render();
    try {
      const res = await fetch('/api/auth-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: pwd })
      });
      const data = await res.json();
      if (!data.ok) {
        App.state.reloginInlineModal = { open: true, error: data.message || 'Senha inválida.', loading: false };
        App.render();
        return;
      }
      // SUCESSO: atualiza token SEM tocar em App.state nem StorageAdapter.
      localStorage.setItem('lj_jwt', data.token);
      localStorage.setItem('lj_user', JSON.stringify(data.user));
      // V36.1.3 — Limpar sessionExpired ANTES de flushNow. O guard V36.1.1
      // em _doPush rejeita push quando sessionExpired=true, o que estava
      // tornando o flushNow um no-op silencioso pós-relogin (trabalho ficava
      // em memória até próximo App.save). A ordem nova garante que o push
      // pendente realmente vá pro servidor. flushNow também passa force=true
      // como defesa em profundidade.
      App.state.sessionExpired = false;
      App.state.reloginInlineModal = { open: false, error: null, loading: false };
      // Empurra mudanças pendentes IMEDIATAMENTE.
      try {
        if (window.RemoteSyncAdapter?.flushNow) await RemoteSyncAdapter.flushNow();
      } catch (_) {}
      App.render();
      Utils.toast('✓ Sessão renovada. Suas alterações foram salvas.');
    } catch (err) {
      App.state.reloginInlineModal = { open: true, error: `Erro de rede: ${err?.message || err}`, loading: false };
      App.render();
    }
  },

  // "Sair mesmo assim" — baixa JSON backup ANTES de limpar localStorage.
  // Garante que cliente leva o trabalho atual mesmo desistindo do relogin.
  async logoutWithBackup() {
    const ok = confirm('Tem certeza? Vou baixar um JSON de backup do seu trabalho atual ANTES de sair — você poderá restaurar depois.');
    if (!ok) return;
    // Baixa snapshot do state atual ANTES de qualquer coisa destrutiva.
    try {
      if (Actions.downloadStateSnapshot) Actions.downloadStateSnapshot();
    } catch (e) {
      const proceed = confirm(`Falha ao baixar backup: ${e?.message || e}. Quer sair mesmo assim (vai perder o trabalho não-salvo)?`);
      if (!proceed) return;
    }
    // Limpa tudo e recarrega (fluxo logout normal, mas sem confirm dupla).
    try { StorageAdapter?.clear?.(); } catch (_) {}
    localStorage.removeItem('lj_jwt');
    localStorage.removeItem('lj_user');
    window.location.reload();
  },

  // V23.0.0 — Carrega lista de usuários (admin).
  async loadUsersList() {
    const token = localStorage.getItem('lj_jwt');
    if (!token) return Utils.toast('Sessão expirada — faça login de novo.');
    try {
      const res = await fetch('/api/users-list', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      App.state._usersListCache = data.users;
      App.save();
      App.render();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  async approveUser(userId, mode) {
    const token = localStorage.getItem('lj_jwt');
    try {
      const res = await fetch('/api/users-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ userId, mode })
      });
      const data = await res.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      Utils.toast(`✓ Usuário "${data.user.username}" aprovado (modo ${data.user.mode}).`);
      this.loadUsersList();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  async revokeUser(userId) {
    if (!confirm('Revogar acesso desse usuário?')) return;
    const token = localStorage.getItem('lj_jwt');
    try {
      const res = await fetch('/api/users-revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      Utils.toast(`✓ Acesso de "${data.user.username}" revogado.`);
      this.loadUsersList();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  async setUserMode(userId, mode) {
    const token = localStorage.getItem('lj_jwt');
    try {
      const res = await fetch('/api/users-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ userId, mode })
      });
      const data = await res.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      Utils.toast(`✓ "${data.user.username}" agora está em modo ${data.user.mode}.`);
      this.loadUsersList();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V34.7.h — Master habilita ou desabilita uso do saldo Anthropic do LJ
  // pra um cliente específico. Cliente desligado pode plugar API key própria
  // em Configurações → IA.
  async setUserMasterAi(userId, enabled) {
    const token = localStorage.getItem('lj_jwt');
    try {
      const res = await fetch('/api/users-toggle-master-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ userId, enabled: Boolean(enabled) })
      });
      const data = await res.json();
      if (!data.ok) {
        Utils.toast(`Falha: ${data.message}`);
        this.loadUsersList(); // recarrega pra desfazer o toggle visual
        return;
      }
      Utils.toast(`✓ IA master ${data.user.master_ai_enabled ? 'liberada' : 'revogada'} pra "${data.user.username}".`);
      this.loadUsersList();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
      this.loadUsersList();
    }
  },

  // V34.7.h — Cliente: lê estado da própria config de IA.
  // Retorna { configured, masterEnabled, source, provider, updatedAt }.
  async loadUserAiConfig() {
    const token = localStorage.getItem('lj_jwt');
    if (!token) return;
    try {
      const res = await fetch('/api/user-ai-config', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.ok) {
        App.state._userAiConfigCache = {
          configured: Boolean(data.configured),
          masterEnabled: Boolean(data.masterEnabled),
          source: data.source || null,
          provider: data.provider || null,
          updatedAt: data.updatedAt || null,
          loadedAt: Date.now()
        };
        App.save();
        App.render();
      }
    } catch (err) {
      console.warn('[loadUserAiConfig]', err.message);
    }
  },

  // V34.7.h — Cliente: salva própria API key Anthropic.
  // V36.1.0 — Gate: se applicable=true E !accepted, bloqueia salvar e
  // mostra mensagem pedindo aceite dos termos.
  async saveUserAiKey() {
    const draft = App.state._userAiKeyDraft || '';
    const apiKey = String(draft || '').trim();
    if (!apiKey) return Utils.toast('Cole sua API key Anthropic primeiro.');
    if (!/^sk-ant-/.test(apiKey)) return Utils.toast('Chave Anthropic deve começar com sk-ant-.');
    // V36.1.0 — Verifica aceite de termos
    const terms = App.state._aiTerms || {};
    if (terms.applicable && !terms.accepted) {
      return Utils.toast('Aceite os Termos de Uso de IA antes de salvar a chave.');
    }
    const token = localStorage.getItem('lj_jwt');
    try {
      const res = await fetch('/api/user-ai-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ provider: 'anthropic', api_key: apiKey })
      });
      const data = await res.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      Utils.toast('✓ Chave Anthropic salva. Agora você pode usar Djow e Enriquecer.');
      App.state._userAiKeyDraft = '';
      await this.loadUserAiConfig();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V36.1.0 — Carrega termos de IA + status de aceite.
  async loadAiTerms() {
    const token = localStorage.getItem('lj_jwt');
    if (!token) return;
    try {
      const r = await fetch('/api/ai-terms', { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      if (data.ok) {
        App.state._aiTerms = {
          content: data.content,
          version: data.version,
          accepted: Boolean(data.accepted),
          acceptedAt: data.acceptedAt,
          acceptedVersion: data.acceptedVersion,
          applicable: Boolean(data.applicable),
          loadedAt: Date.now()
        };
        App.render();
      }
    } catch (err) {
      console.warn('[loadAiTerms]', err.message);
    }
  },

  // V36.1.0 — Cliente marca/desmarca o checkbox "Li e aceito".
  toggleAiTermsCheckbox() {
    App.state._aiTermsCheckboxChecked = !App.state._aiTermsCheckboxChecked;
    App.render();
  },

  // V36.1.0 — Registra aceite no backend.
  async acceptAiTerms() {
    if (!App.state._aiTermsCheckboxChecked) return Utils.toast('Marque "Li e aceito" antes.');
    const token = localStorage.getItem('lj_jwt');
    try {
      const r = await fetch('/api/ai-terms-accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({})
      });
      const data = await r.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      Utils.toast('✓ Termos aceitos. Agora você pode plugar sua chave.');
      App.state._aiTermsCheckboxChecked = false;
      await this.loadAiTerms();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V36.1.0 — Revoga aceite. Bloqueia chave própria até reaceitar.
  async revokeAiTerms() {
    if (!confirm('Revogar aceite dos Termos de IA?\n\nO Djow para de funcionar com sua chave própria. Você pode reativar depois lendo a versão atual dos termos novamente.')) return;
    const token = localStorage.getItem('lj_jwt');
    try {
      const r = await fetch('/api/ai-terms-accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ revoke: true })
      });
      const data = await r.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      Utils.toast('Aceite revogado.');
      await this.loadAiTerms();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  toggleAiTermsExpanded() {
    App.state._aiTermsExpanded = !App.state._aiTermsExpanded;
    App.render();
  },

  // V34.7.h — Atualiza o draft do input da chave (sem re-render pra não perder foco).
  updateUserAiKeyDraft(value) {
    App.state._userAiKeyDraft = String(value || '');
  },

  // V34.7.h — Cliente: remove própria API key.
  async deleteUserAiKey() {
    if (!confirm('Remover sua chave Anthropic? Você não vai conseguir usar Djow/Enriquecer até plugar outra (ou pedir liberação ao master).')) return;
    const token = localStorage.getItem('lj_jwt');
    try {
      const res = await fetch('/api/user-ai-config', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      Utils.toast('✓ Chave removida.');
      await this.loadUserAiConfig();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V32.0.16 — Execution credentials novo padrão (encrypted DB).
  async loadExecutionCredentials() {
    const token = localStorage.getItem('lj_jwt');
    if (!token) return;
    try {
      const res = await fetch('/api/execution-credentials', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.ok) {
        App.state._executionCredentialsCache = data.providers || [];
        App.save();
        App.render();
      }
    } catch (err) { console.warn('[loadExecutionCredentials]', err); }
  },

  updateTrelloConnectDraftField(field, value) {
    App.state.trelloConnectDraft = {
      ...(App.state.trelloConnectDraft || { apiKey: '', token: '', board: '', listTodo: '', listDone: '' }),
      [field]: String(value || '')
    };
  },

  async connectTrelloNew() {
    const draft = App.state.trelloConnectDraft || {};
    if (!draft.apiKey || !draft.token) {
      return Utils.toast('API Key e Token são obrigatórios pra conectar.');
    }
    if (!draft.listTodo) {
      return Utils.toast('Informe o List ID "To Do" — sem ele tasks não nascem em lugar nenhum.');
    }
    const token = localStorage.getItem('lj_jwt');
    if (!token) return Utils.toast('Sessão expirada — faça login.');
    try {
      const res = await fetch('/api/execution-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          provider: 'trello',
          fields: {
            apiKey: draft.apiKey,
            token: draft.token,
            board: draft.board || null,
            listTodo: draft.listTodo,
            listDone: draft.listDone || null
          },
          meta: { board: draft.board || null }
        })
      });
      const data = await res.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      Utils.toast(`✓ ${data.message}`);
      App.state.trelloConnectDraft = { apiKey: '', token: '', board: '', listTodo: '', listDone: '' };
      await this.loadExecutionCredentials();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  async disconnectTrelloNew() {
    if (!confirm('Desconectar Trello?\n\nO LJ vai parar de criar cards lá. Credenciais criptografadas serão apagadas do DB.')) return;
    const token = localStorage.getItem('lj_jwt');
    try {
      const res = await fetch('/api/execution-disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ provider: 'trello' })
      });
      const data = await res.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      Utils.toast('✓ Trello desconectado.');
      await this.loadExecutionCredentials();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V32.1.1 — "Meu Banco" self-service (qualquer user com tenant).
  updateTenantDbPlugDraft(value) {
    App.state.tenantDbPlugDraft = String(value || '');
  },

  async plugOwnTenantDb() {
    const url = String(App.state.tenantDbPlugDraft || '').trim();
    if (!url) {
      App.state.tenantDbPlugError = 'Cole a connection string primeiro.';
      App.render();
      return;
    }
    if (!url.startsWith('postgres://') && !url.startsWith('postgresql://')) {
      App.state.tenantDbPlugError = 'URL precisa começar com postgres:// ou postgresql://';
      App.render();
      return;
    }
    if (!confirm('Plugar este Postgres no seu tenant?\n\n• A conexão será testada\n• Se OK, o schema do LJ será criado automaticamente (não destrói dados existentes — apenas adiciona tabelas faltantes)\n• Próximas requests suas vão pro banco novo\n• Dados que estão hoje no armazenamento compartilhado NÃO migram automaticamente\n\nConfirma?')) return;

    const token = localStorage.getItem('lj_jwt');
    if (!token) return Utils.toast('Sessão expirada — faça login.');
    App.state.tenantDbPlugError = '';
    App.render();

    try {
      const res = await fetch('/api/tenant-plug-own-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ connection_string: url })
      });
      const data = await res.json();
      if (!data.ok) {
        App.state.tenantDbPlugError = `${data.step ? '[' + data.step + '] ' : ''}${data.message || 'Falha desconhecida.'}`;
        App.render();
        return;
      }
      Utils.toast(`✓ ${data.message}`);
      App.state.tenantDbPlugDraft = '';
      App.state.tenantDbPlugError = '';
      // Refresca info do user (auth-me) — agora tenantDbPlugged = true
      await this._refreshCurrentUserInfo?.();
      App.render();
    } catch (err) {
      App.state.tenantDbPlugError = `Erro: ${err.message}`;
      App.render();
    }
  },

  async unplugOwnTenantDb() {
    if (!confirm('Desplugar seu banco?\n\n⚠ ATENÇÃO: dados que você criou neste banco próprio FICAM lá (não são deletados, mas o LJ deixa de ler).\n\nVocê volta a operar no armazenamento compartilhado. Pra recuperar acesso aos dados antigos, basta plugar a mesma URL de novo.\n\nConfirma?')) return;
    const token = localStorage.getItem('lj_jwt');
    try {
      const res = await fetch('/api/tenant-unplug-own-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ confirm: true })
      });
      const data = await res.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      Utils.toast(`✓ ${data.message}`);
      await this._refreshCurrentUserInfo?.();
      App.render();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V32.1.2 — "Minha Conta": user edita o próprio display_name.
  updateProfileDisplayNameDraft(value) {
    App.state.profileDisplayNameDraft = String(value || '');
  },

  // V32.5.7 — Sub-abas em Configurações → Minha Conta:
  // 'identity' (perfil) e 'products' (gerenciamento de produtos).
  setMyAccountTab(tab) {
    const valid = ['identity', 'products', 'mailing'];
    App.state.myAccountTab = valid.includes(tab) ? tab : 'identity';
    App.save(); App.render();
  },

  // V32.5.7 — Arquivar produto. Marca archived=true sem deletar nada.
  // Produto some das listas principais mas pode ser reativado em
  // Configurações → Minha Conta → Produtos.
  archiveProduct(productId) {
    if (this._demoGuard && this._demoGuard('Arquivar produto')) return;
    const pid = Number(productId);
    const product = (App.state.products || []).find(p => Number(p.id) === pid);
    if (!product) return Utils.toast('Produto não encontrado.');
    App.state.products = (App.state.products || []).map(p =>
      Number(p.id) === pid ? { ...p, archived: true, archivedAt: new Date().toISOString() } : p
    );
    // V32.5.7 — Se o produto selecionado virou arquivado, seleciona próximo ativo.
    if (Number(App.state.selectedProductId) === pid) {
      const nextActive = (App.state.products || []).find(p => !p.archived);
      App.state.selectedProductId = nextActive?.id || null;
    }
    App.save(); App.render();
    Utils.toast(`Produto "${product.name}" arquivado. Pode reativar em Minha Conta → Produtos.`);
  },

  // V32.5.7 — Reativa produto arquivado.
  unarchiveProduct(productId) {
    const pid = Number(productId);
    const product = (App.state.products || []).find(p => Number(p.id) === pid);
    if (!product) return Utils.toast('Produto não encontrado.');
    App.state.products = (App.state.products || []).map(p =>
      Number(p.id) === pid ? { ...p, archived: false, archivedAt: null } : p
    );
    App.save(); App.render();
    Utils.toast(`Produto "${product.name}" reativado.`);
  },

  // V32.5.7 — Helper invocado por botões "Deletar" em outras telas (e.g. modal
  // de edição do produto, engrenagem do card). Em vez de abrir flow inline,
  // navega o user pra Configurações → Minha Conta → Produtos com o flow de
  // delete pré-aberto pro produto solicitado.
  goToMyAccountProductsForDelete(productId) {
    App.state.showProductEditModal = false;
    App.state.showSettingsModal = true;
    App.state.settingsActiveSection = 'myAccount';
    App.state.myAccountTab = 'products';
    App.state.adminDeleteProductPending = { productId: Number(productId), typed: '' };
    App.save(); App.render();
  },

  async saveUserProfile() {
    const token = localStorage.getItem('lj_jwt');
    if (!token) return Utils.toast('Sessão expirada — faça login.');
    const displayName = String(App.state.profileDisplayNameDraft || '').trim();
    try {
      const res = await fetch('/api/user-update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ display_name: displayName })
      });
      const data = await res.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      Utils.toast(`✓ ${data.message}`);
      await this._refreshCurrentUserInfo();
      // Limpa draft pra próxima edição não confundir
      App.state.profileDisplayNameDraft = '';
      App.render();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V37.4.24 — Trocar email (self-service).
  openChangeEmailModal() {
    App.state.changeEmailModal = { newEmail: '', currentPassword: '', saving: false, error: null };
    App.render();
  },
  closeChangeEmailModal() {
    App.state.changeEmailModal = null;
    App.render();
  },
  updateChangeEmailField(field, value) {
    if (!App.state.changeEmailModal) return;
    App.state.changeEmailModal[field] = String(value || '');
    App.state.changeEmailModal.error = null;
  },
  async submitChangeEmail() {
    const m = App.state.changeEmailModal;
    if (!m) return;
    const newEmail = String(m.newEmail || '').trim().toLowerCase();
    const currentPassword = String(m.currentPassword || '');
    if (!newEmail.includes('@')) { m.error = 'Email inválido.'; App.render(); return; }
    if (!currentPassword) { m.error = 'Senha atual obrigatória.'; App.render(); return; }
    m.saving = true; m.error = null; App.render();
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/auth-change-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newEmail, currentPassword })
      });
      const data = await r.json();
      if (!data.ok) {
        m.error = data.message || 'Falha ao trocar email.';
        m.saving = false; App.render();
        return;
      }
      Utils.toast(`✓ ${data.message}`);
      App.state.changeEmailModal = null;
      await this._refreshCurrentUserInfo();
      App.render();
    } catch (err) {
      m.error = `Erro: ${err.message}`; m.saving = false; App.render();
    }
  },

  // V37.4.24 — Trocar senha (self-service).
  openChangePasswordModal() {
    App.state.changePasswordModal = { currentPassword: '', newPassword: '', confirmPassword: '', saving: false, error: null };
    App.render();
  },
  closeChangePasswordModal() {
    App.state.changePasswordModal = null;
    App.render();
  },
  updateChangePasswordField(field, value) {
    if (!App.state.changePasswordModal) return;
    App.state.changePasswordModal[field] = String(value || '');
    App.state.changePasswordModal.error = null;
  },
  async submitChangePassword() {
    const m = App.state.changePasswordModal;
    if (!m) return;
    const { currentPassword, newPassword, confirmPassword } = m;
    if (!currentPassword) { m.error = 'Senha atual obrigatória.'; App.render(); return; }
    if (!newPassword || newPassword.length < 8) { m.error = 'Nova senha precisa de no mínimo 8 caracteres.'; App.render(); return; }
    if (newPassword !== confirmPassword) { m.error = 'Nova senha e confirmação não batem.'; App.render(); return; }
    m.saving = true; m.error = null; App.render();
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/auth-change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await r.json();
      if (!data.ok) {
        m.error = data.message || 'Falha ao trocar senha.';
        m.saving = false; App.render();
        return;
      }
      Utils.toast(`✓ ${data.message}`);
      App.state.changePasswordModal = null;
      App.render();
    } catch (err) {
      m.error = `Erro: ${err.message}`; m.saving = false; App.render();
    }
  },

  // V37.4.24 — Ver minhas permissões (read-only).
  openMyPermissionsModal() {
    App.state.myPermissionsModal = true;
    App.render();
  },
  closeMyPermissionsModal() {
    App.state.myPermissionsModal = false;
    App.render();
  },

  // V32.1.1 — Helper: re-fetch auth-me pra atualizar App.currentUser (tenantDbPlugged etc).
  async _refreshCurrentUserInfo() {
    const token = localStorage.getItem('lj_jwt');
    if (!token) return;
    try {
      const res = await fetch('/api/auth-me', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data?.ok && data?.user) {
        App.currentUser = data.user;
        localStorage.setItem('lj_user', JSON.stringify(data.user));
        // V37.3.4 — Sincroniza App.state.user (usado pelo membersPanel)
        App.state.user = App.state.user || {};
        App.state.user.id = data.user.id;
        App.state.user.email = data.user.email;
        App.state.user.displayName = data.user.displayName;
        App.state.user.isMaster = data.user.isMaster;
        App.state.user.tenantId = data.user.tenantId;
        // V37.3.4 — Carrega permissões efetivas em background (não bloqueia render)
        Actions.loadMyPermissions();
        // V37.5.0 — Carrega pins ativos pra URL atual
        if (window.Actions?.loadPinsForCurrentUrl) Actions.loadPinsForCurrentUrl();
      }
    } catch (_) { /* silencioso */ }
  },

  // V32.0.12 — Tenants admin (master only).
  async loadTenantsList() {
    const token = localStorage.getItem('lj_jwt');
    if (!token) return Utils.toast('Sessão expirada — faça login de novo.');
    try {
      const res = await fetch('/api/tenants-list', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      App.state._tenantsListCache = data.tenants;
      App.save();
      App.render();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  updateTenantPlugDraft(tenantId, value) {
    App.state.tenantPlugDraft = App.state.tenantPlugDraft || {};
    App.state.tenantPlugDraft[String(tenantId)] = String(value || '');
    // Sem render — input em tempo real, é só store.
  },

  async plugTenantDb(tenantId) {
    const token = localStorage.getItem('lj_jwt');
    const draft = (App.state.tenantPlugDraft || {})[String(tenantId)];
    const connStr = String(draft || '').trim();
    if (!connStr) return Utils.toast('Cole a connection string primeiro.');
    if (!connStr.startsWith('postgres://') && !connStr.startsWith('postgresql://')) {
      return Utils.toast('Connection string precisa começar com postgres:// ou postgresql://');
    }
    if (!confirm(`Plugar este Postgres no tenant ${tenantId}?\n\nIMPORTANTE: rode lib/tenant-db-schema.sql contra esse DB ANTES, senão as tabelas vão estar vazias e endpoints vão dar erro.`)) return;
    try {
      const res = await fetch('/api/tenants-plug-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ tenant_id: tenantId, connection_string: connStr })
      });
      const data = await res.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      Utils.toast(`✓ ${data.message}`);
      delete App.state.tenantPlugDraft[String(tenantId)];
      await this.loadTenantsList();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  async unplugTenantDb(tenantId) {
    const token = localStorage.getItem('lj_jwt');
    if (!confirm(`Desplugar o DB do tenant ${tenantId}?\n\nO tenant volta a operar no control plane. Dados que estavam no DB plugado FICAM ÓRFÃOS (não são deletados, mas LJ deixa de ler).\n\nConfirma?`)) return;
    try {
      const res = await fetch('/api/tenants-unplug-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ tenant_id: tenantId, confirm: true })
      });
      const data = await res.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      Utils.toast(`✓ ${data.message}`);
      await this.loadTenantsList();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V36.8.0 — Dispensa permanente do alerta de boas-vindas.
  dismissWelcome() {
    App.state.welcomeDismissed = true;
    App.save();
    App.render();
    Utils.toast('Boas-vindas dispensadas. Próximo passo: conectar banco.');
  },

  // V36.8.0 — Abre wizard de conexão de banco de dados (cliente sem DB).
  openTenantDbWizard() {
    App.state.tenantDbWizard = {
      open: true,
      step: 1,
      provider: null,        // 'railway' | 'neon' | 'supabase' | 'custom'
      fields: { host: '', port: '5432', user: '', password: '', dbname: '' },
      connStr: '',
      saving: false,
      testing: false,
      testResult: null,
      error: null
    };
    // Fecha modal de notificações se estiver aberto
    App.state.importReportsModalOpen = false;
    App.render();
  },

  closeTenantDbWizard() {
    App.state.tenantDbWizard = null;
    App.render();
  },

  setTenantDbWizardStep(step) {
    if (!App.state.tenantDbWizard) return;
    App.state.tenantDbWizard.step = step;
    App.render();
  },

  setTenantDbProvider(provider) {
    if (!App.state.tenantDbWizard) return;
    App.state.tenantDbWizard.provider = provider;
    App.state.tenantDbWizard.step = 2;
    App.render();
  },

  updateTenantDbField(field, value) {
    if (!App.state.tenantDbWizard) return;
    App.state.tenantDbWizard.fields = App.state.tenantDbWizard.fields || {};
    App.state.tenantDbWizard.fields[field] = String(value || '');
    // Recompõe connection string em tempo real
    const f = App.state.tenantDbWizard.fields;
    if (f.host && f.user && f.password && f.dbname) {
      const port = f.port || '5432';
      App.state.tenantDbWizard.connStr = `postgresql://${f.user}:${encodeURIComponent(f.password)}@${f.host}:${port}/${f.dbname}`;
    } else {
      App.state.tenantDbWizard.connStr = '';
    }
  },

  // Conecta o DB do tenant ATUAL (cliente). Não é a mesma coisa que plugTenantDb
  // (que é o endpoint master pra outro tenant). Aqui o cliente conecta o próprio.
  async submitTenantDbConnect() {
    const w = App.state.tenantDbWizard;
    if (!w || !w.connStr) return;
    w.saving = true;
    w.error = null;
    App.render();
    try {
      const token = localStorage.getItem('lj_jwt');
      const cu = App.currentUser || {};
      const tenantId = cu.tenantId;
      if (!tenantId) {
        w.error = 'Tenant não identificado. Faça logout e login de novo.';
        w.saving = false;
        App.render();
        return;
      }
      const r = await fetch('/api/tenants-plug-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tenant_id: tenantId, connection_string: w.connStr })
      });
      const data = await r.json();
      if (!data.ok) {
        w.error = data.message || 'Falha ao plugar banco';
        w.saving = false;
        App.render();
        return;
      }
      // Sucesso — passa pra step 4 (sucesso)
      w.step = 4;
      w.saving = false;
      App.render();
      // Atualiza tenantDbPlugged no currentUser pra alerta sumir
      if (App.currentUser) App.currentUser.tenantDbPlugged = true;
      Utils.toast(`✓ Banco conectado! Próximas requests vão pro seu Postgres.`);
    } catch (err) {
      w.error = err.message;
      w.saving = false;
      App.render();
    }
  },

  // V36.8.0 — Modal "Criar novo cliente" (master only)
  openTenantCreateModal() {
    App.state.tenantCreateModal = {
      slug: '',
      name: '',
      masterEmail: '',
      teamEmails: [''],
      saving: false,
      error: null
    };
    App.render();
  },

  closeTenantCreateModal() {
    App.state.tenantCreateModal = null;
    App.render();
  },

  updateTenantCreateField(field, value) {
    if (!App.state.tenantCreateModal) return;
    App.state.tenantCreateModal[field] = String(value || '');
  },

  updateTenantTeamEmail(idx, value) {
    const m = App.state.tenantCreateModal;
    if (!m || !Array.isArray(m.teamEmails)) return;
    m.teamEmails[idx] = String(value || '');
  },

  addTenantTeamEmail() {
    const m = App.state.tenantCreateModal;
    if (!m) return;
    m.teamEmails = Array.isArray(m.teamEmails) ? m.teamEmails : [];
    m.teamEmails.push('');
    App.render();
  },

  removeTenantTeamEmail(idx) {
    const m = App.state.tenantCreateModal;
    if (!m || !Array.isArray(m.teamEmails)) return;
    m.teamEmails.splice(idx, 1);
    if (m.teamEmails.length === 0) m.teamEmails = [''];
    App.render();
  },

  async submitTenantCreate() {
    const m = App.state.tenantCreateModal;
    if (!m) return;
    m.saving = true;
    m.error = null;
    App.render();
    try {
      const token = localStorage.getItem('lj_jwt');
      const teamEmails = (m.teamEmails || []).filter(e => e && e.trim());
      const r = await fetch('/api/tenant-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          slug: m.slug,
          name: m.name,
          masterEmail: m.masterEmail,
          teamEmails
        })
      });
      const data = await r.json();
      if (!data.ok) {
        m.error = data.message || 'Falha desconhecida';
        m.saving = false;
        App.render();
        return;
      }
      // Fecha modal de criação, abre modal de credenciais
      App.state.tenantCreateModal = null;
      App.state.tenantCreatedCredentials = { tenant: data.tenant, credentials: data.credentials };
      await Actions.loadTenantsList();
      App.render();
      Utils.toast(`✓ Cliente "${data.tenant.name}" criado.`);
    } catch (err) {
      m.error = err.message;
      m.saving = false;
      App.render();
    }
  },

  closeTenantCredentialsModal() {
    App.state.tenantCreatedCredentials = null;
    App.render();
  },

  copyToClipboard(text, btn) {
    try {
      navigator.clipboard.writeText(text);
      if (btn) {
        const original = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="check" class="w-3.5 h-3.5"></i> Copiado';
        setTimeout(() => {
          btn.innerHTML = original;
          if (window.lucide?.createIcons) window.lucide.createIcons();
        }, 1500);
        if (window.lucide?.createIcons) window.lucide.createIcons();
      }
    } catch (_) {
      Utils.toast('Falhou ao copiar — copie manualmente.');
    }
  },

  // V23.1.0 — Troca aba ativa do painel "Conexão RD" (CRM | Marketing).
  // Estado persiste em App.state pra preservar entre re-renders.
  setRdActiveTab(tab) {
    if (!['crm', 'marketing'].includes(tab)) return;
    App.state.settingsRdActiveTab = tab;
    App.save();
    App.render();
  },

  // V23.0.0 — Liga/desliga o assistente de conexão RD no painel de configurações.
  toggleRdAssistant() {
    App.state.rdAssistantDismissed = !App.state.rdAssistantDismissed;
    App.save();
    App.render();
  },

  // V22.3.7 — Marca OAuth Marketing como "pulado" pelo usuário.
  // O assistente pula direto para 'done' (CRM já completo + Marketing
  // declaradamente ignorado). Pode reverter no botão "Conectar Marketing"
  // que continua disponível no card colapsado.
  skipMarketingOAuth() {
    this.ensureIntegrations();
    App.state.rdMarketingSkipped = true;
    App.save();
    App.render();
    Utils.toast('RD Marketing ignorado. CRM continua funcionando normalmente.');
  },

  // V22.3.7 — Reverte o skip pra retomar o fluxo OAuth Marketing.
  unskipMarketingOAuth() {
    App.state.rdMarketingSkipped = false;
    App.save();
    App.render();
  },

  // V24.0.0 — Copia a URL pública do webhook RD pro clipboard.
  // (mantido como utilitário fallback caso o cadastro automático falhe e
  // o usuário precise registrar manualmente via curl/Postman)
  async copyWebhookUrl() {
    const origin = window.location?.origin || 'https://leadjourney.up.railway.app';
    const url = `${origin}/api/rd-webhook`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        Utils.toast('URL copiada.');
      } else {
        const ta = document.createElement('textarea');
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        Utils.toast('URL copiada (fallback).');
      }
    } catch (err) {
      Utils.toast(`Falhou ao copiar: ${err?.message || err}. URL: ${url}`);
    }
  },

  // V24.0.0 — OAuth do CRM (app separado do Marketing no Publisher RD).
  // Mesmo fluxo do Marketing OAuth, mas grava em integrations.rd.crmOauth.
  // Razão: RD Publisher força 1 produto por app (CRM OU Marketing). Para
  // /crm/v2/* (webhooks, etc.) precisa de app criado como "RD Station CRM".
  _ensureCrmOauth() {
    this.ensureIntegrations();
    App.state.integrations.rd.crmOauth = App.state.integrations.rd.crmOauth || (window.RDConfig ? RDConfig.defaultCrmOauth() : {});
    return App.state.integrations.rd.crmOauth;
  },

  updateRdCrmOauthField(field, value) {
    const cfg = this._ensureCrmOauth();
    // V31.2.44 — Removido auto-/ no redirectUri (V31.2.42 quebrou pra users que
    // cadastram callback SEM / no RD app). Agora mantém EXATAMENTE o que o user
    // digitou. RD exige match exato — responsabilidade do user copiar igual.
    if (field === 'redirectUri' && typeof value === 'string') {
      cfg[field] = value.trim();
    } else {
      cfg[field] = value;
    }
    App.save();
  },

  generateRdCrmOauthUrl() {
    const cfg = this._ensureCrmOauth();
    const result = RDAuthService.buildAuthorizationUrl(cfg);
    if (!result.ok) return Utils.toast(result.message);
    cfg.authUrl = result.url;
    cfg.status = 'ready_for_oauth';
    App.save();
    App.render();
    Utils.toast('URL OAuth do CRM gerada. Clique em "Abrir URL".');
  },

  openRdCrmOauthUrl() {
    const cfg = this._ensureCrmOauth();
    let url = cfg.authUrl;
    if (!url) {
      const result = RDAuthService.buildAuthorizationUrl(cfg);
      if (!result.ok) return Utils.toast(result.message);
      url = result.url;
      cfg.authUrl = url;
      App.save();
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  },

  async exchangeRdCrmOauthCode() {
    const cfg = this._ensureCrmOauth();
    if (!cfg.authorizationCode) return Utils.toast('Cole o Authorization Code antes.');
    Utils.toast('Trocando code por token CRM...');
    const result = await RDAuthService.exchangeAuthorizationCode(cfg);
    if (!result.ok) {
      cfg.status = 'exchange_failed';
      cfg.lastTestAt = new Date().toISOString();
      App.save();
      App.render();
      return Utils.toast(`Falha: ${result.message}`);
    }
    cfg.accessToken = result.accessToken;
    cfg.refreshToken = result.refreshToken || cfg.refreshToken;
    cfg.expiresAt = result.expiresAt || '';
    cfg.status = 'connected';
    cfg.lastTestAt = new Date().toISOString();
    cfg.authorizationCode = ''; // one-shot
    App.save();
    App.render();
    this._persistRdToDb('crm_oauth'); // V31.2.36 — write-through
    Utils.toast('✓ OAuth CRM conectado.');
  },

  async refreshRdCrmOauthToken() {
    const cfg = this._ensureCrmOauth();
    if (!cfg.refreshToken) return Utils.toast('Sem refresh_token CRM. Refaça o OAuth.');
    Utils.toast('Renovando token CRM...');
    const result = await RDAuthService.refreshAccessToken(cfg);
    if (!result.ok) {
      cfg.status = 'refresh_failed';
      App.save();
      App.render();
      return Utils.toast(`Falha: ${result.message}`);
    }
    cfg.accessToken = result.accessToken;
    cfg.refreshToken = result.refreshToken || cfg.refreshToken;
    cfg.expiresAt = result.expiresAt || '';
    cfg.status = 'connected';
    cfg.lastTestAt = new Date().toISOString();
    App.save();
    App.render();
    this._persistRdToDb('crm_oauth'); // V31.2.36 — write-through após refresh
    Utils.toast('✓ Token CRM renovado.');
  },

  clearRdCrmOauth() {
    if (!confirm('Limpar credenciais OAuth CRM? Você precisará refazer o fluxo.')) return;
    App.state.integrations.rd.crmOauth = window.RDConfig ? RDConfig.defaultCrmOauth() : {};
    App.save();
    App.render();
    this._deleteRdCredentialFromDb('crm_oauth'); // V31.2.36 — apaga só crm_oauth no DB
    Utils.toast('OAuth CRM resetado.');
  },

  // V24.0.0 — Eventos do Webhook Service multiproduto do RD.
  // Endpoint: POST /integrations/webhooks (NÃO /crm/v2/webhooks que era 401
  // por global_credentials). RD aceita UM webhook por event_type — a gente
  // cadastra todos e guarda UUIDs em App.state.rdWebhooks pra poder deletar.
  //
  // Lista oficial dos events (extraída dos docs RD em 2026-05-16):
  //   CRM:       crm_deal_created, crm_deal_updated, crm_deal_deleted
  //   Marketing: WEBHOOK.CONVERTED, WEBHOOK.MARKED_OPPORTUNITY
  //
  // V24.0.0 entrega só CRM. Marketing webhooks ficam pra V24.x quando
  // adicionar suporte aos identificadores de conversão.
  _RD_WEBHOOK_EVENTS: [
    'crm_deal_created',
    'crm_deal_updated',
    'crm_deal_deleted'
  ],

  _webhookUrl() {
    const origin = window.location?.origin || 'https://leadjourney.up.railway.app';
    return `${origin}/api/rd-webhook`;
  },

  // V24.0.0 — GET /integrations/webhooks pra listar o que já existe no RD.
  // Endpoint multiproduto do RD (NÃO /crm/v2/webhooks). Usado pra deduplicar
  // antes de cadastrar e não criar duplicata.
  async refreshRdWebhooks() {
    if (!window.RdCrmApiClient) return { ok: false, message: 'RdCrmApiClient indisponível.' };
    const res = await RdCrmApiClient.get('/integrations/webhooks', { legacy: false, useCrmOauthV2: true });
    if (!res.ok) {
      App.state.rdWebhookRegistrationError = `GET /webhooks falhou (${res.status}): ${res.message}`;
      App.save();
      App.render();
      return { ok: false, message: res.message };
    }
    // V31.2.50 — Loga estrutura do response pra debug (RD não documenta formato consistente).
    // V31.2.53 — Stringify inline pra user conseguir ler sem expandir (e me mandar print).
    console.log('[rd] GET /integrations/webhooks raw:', JSON.stringify(res.data).slice(0, 800));
    const list = res.data?.webhooks || res.data?.subscriptions || res.data?.data
      || (Array.isArray(res.data) ? res.data : null) || [];
    // V31.2.50 — Match de URL mais tolerante (case-insensitive + strip trailing slash).
    const targetUrl = String(this._webhookUrl() || '').toLowerCase().replace(/\/$/, '');
    const ours = (Array.isArray(list) ? list : []).filter(w => {
      const url = String(w.url || w.callback_url || '').toLowerCase().replace(/\/$/, '');
      return url === targetUrl;
    }).map(w => ({
      id: w.uuid || w.id || '',
      eventName: w.event_type || w.event_name || '',
      url: w.url || w.callback_url || '',
      createdAt: w.created_at || ''
    }));
    // V31.2.53 — Smart merge: preserva entries locais marcadas alreadyExistedAtRd
    // se RD não retornou. RD GET /integrations/webhooks às vezes retorna vazio
    // mesmo com webhooks cadastrados (provavelmente paginação ou scope errado),
    // e a sobrescrita destruía as entradas que o handler DUPLICATED_URL adicionou.
    const localOrphans = (App.state.rdWebhooks || []).filter(l =>
      l.alreadyExistedAtRd && !ours.some(r => r.eventName === l.eventName)
    );
    const merged = [...ours, ...localOrphans];
    console.log(`[rd] webhooks dedup: rdList=${Array.isArray(list) ? list.length : 0}, ours=${ours.length}, orphansPreservados=${localOrphans.length}, total=${merged.length}, alvo=${targetUrl}`);
    App.state.rdWebhooks = merged;
    App.state.rdWebhookRegistrationError = '';
    // V31.2.52 — Timestamp pra UI mostrar 'última verificação há X min'.
    App.state.rdWebhooksLastSyncAt = new Date().toISOString();
    App.save();
    App.render();
    return { ok: true, webhooks: merged };
  },

  // V24.0.0 — Cadastra UM webhook por event_name no RD via API v2.
  // Roteia via /api/rd-proxy (legacy=false → OAuth Bearer) usando o
  // accessToken do user. Se o OAuth não tem scope CRM, RD devolve 401/403.
  async registerRdWebhooks() {
    if (!window.RdCrmApiClient) { Utils.toast('RdCrmApiClient indisponível.'); return; }
    // V24.0.0 — Usa o OAuth do app CRM (não do Marketing). Marketing OAuth
    // não tem scope pra /crm/v2/*. Verificamos no app CRM, não no Marketing.
    const oauthCrm = App.state.integrations?.rd?.crmOauth?.accessToken || '';
    if (!oauthCrm) {
      Utils.toast('OAuth CRM não conectado. Conecte na aba "CRM OAuth" primeiro.');
      return;
    }
    Utils.toast('Cadastrando webhooks no RD...');
    // 1. Lista o que já existe (deduplica).
    await this.refreshRdWebhooks();
    const existing = new Set((App.state.rdWebhooks || []).map(w => w.eventName));
    const toCreate = this._RD_WEBHOOK_EVENTS.filter(ev => !existing.has(ev));
    if (!toCreate.length) {
      Utils.toast(`Todos os ${this._RD_WEBHOOK_EVENTS.length} webhooks já estão cadastrados no RD.`);
      return;
    }
    const url = this._webhookUrl();
    let created = 0;
    let failures = [];
    for (const eventType of toCreate) {
      // V24.0.0 — Body schema do endpoint /integrations/webhooks (multiproduto).
      // Sem wrapper "data". entity_type é obrigatório:
      //   - 'DEAL' para eventos crm_deal_* (crm_deal_created, crm_deal_updated, crm_deal_deleted)
      //   - 'CONTACT' para eventos WEBHOOK.* (Marketing, ex: WEBHOOK.CONVERTED)
      // V31.2.48 — Fix: estava hardcoded 'CONTACT' pra TODOS, daí RD recusava
      // crm_deal_* com HTTP 422 (entity_type incompatível com event_type).
      const entityType = eventType.startsWith('crm_deal') ? 'DEAL' : 'CONTACT';
      const body = {
        event_type: eventType,
        entity_type: entityType,
        url,
        http_method: 'POST'
      };
      const res = await RdCrmApiClient.post('/integrations/webhooks', body, { legacy: false, useCrmOauthV2: true });
      if (res.ok) {
        created += 1;
        const uuid = res.data?.uuid || res.data?.id || '';
        App.state.rdWebhooks = App.state.rdWebhooks || [];
        App.state.rdWebhooks.push({
          id: uuid,
          eventName: eventType,
          url,
          createdAt: res.data?.created_at || new Date().toISOString()
        });
      } else {
        // V31.2.50 — Se RD retornar DUPLICATED_URL, a subscription JÁ EXISTE
        // (cadastro anterior bem-sucedido). Trata como sucesso pra UI não
        // marcar como falha. UUID fica vazio nesse caso — refreshRdWebhooks
        // depois preenche se conseguir listar.
        const errorBlob = JSON.stringify(res.data || {});
        if (errorBlob.includes('DUPLICATED_URL')) {
          created += 1;
          App.state.rdWebhooks = App.state.rdWebhooks || [];
          if (!App.state.rdWebhooks.some(w => w.eventName === eventType)) {
            App.state.rdWebhooks.push({
              id: '', // UUID desconhecido — RD não retornou no erro
              eventName: eventType,
              url,
              createdAt: new Date().toISOString(),
              alreadyExistedAtRd: true
            });
          }
        } else {
          failures.push(`${eventType}: HTTP ${res.status} ${res.message}`);
        }
      }
    }
    if (failures.length && !created) {
      App.state.rdWebhookRegistrationError = failures[0];
    } else if (created) {
      App.state.rdWebhookRegistrationError = '';
    }
    App.save();
    App.render();
    // V31.2.51 — Hardening: após qualquer mutação (cadastro novo OU
    // detecção de duplicado), refaz refresh do RD pra capturar UUIDs reais
    // e garantir que state local = verdade no RD. Previne situação onde
    // user cadastra → state diz ok mas UUID vazio → não consegue deletar.
    try { await this.refreshRdWebhooks(); } catch (_) {}
    if (created) {
      Utils.toast(`${created} webhook(s) cadastrado(s) no RD. ${failures.length ? `${failures.length} falharam.` : ''}`);
    } else {
      Utils.toast(`Nenhum webhook cadastrado. Erro: ${failures[0] || 'desconhecido'}`);
    }
  },

  // V31.2.51 — Classifica erros do RD em códigos acionáveis. Usado pra mostrar
  // mensagens consistentes e decidir auto-recovery (token expirado → refresh,
  // duplicado → idempotência, etc).
  _classifyRdError(res) {
    if (!res) return { code: 'unknown', message: 'Sem resposta.' };
    if (res.ok) return { code: 'ok', message: '' };
    const status = res.status || 0;
    const blob = JSON.stringify(res.data || {}).toLowerCase() + ' ' + String(res.message || '').toLowerCase();
    if (blob.includes('duplicated_url') || blob.includes('already exists')) {
      return { code: 'already_exists', message: 'Recurso já existe no RD.', friendly: 'Já cadastrado — está no ar.' };
    }
    if (blob.includes('invalid_token') || blob.includes('invalid token') || status === 401) {
      return { code: 'token_invalid', message: 'Token RD inválido ou expirado.', friendly: 'OAuth precisa reconectar. Vai em Configurações → RD.' };
    }
    if (blob.includes('access_denied') || blob.includes('permission denied') || status === 403) {
      return { code: 'forbidden', message: 'Sem permissão (scope errado).', friendly: 'App OAuth foi criado como produto errado. Verifique se é "RD Station CRM" no Publisher.' };
    }
    if (status === 422) {
      return { code: 'validation', message: res.message || 'Validação falhou.', friendly: `Validação RD: ${res.message || 'detalhes no console'}` };
    }
    if (status === 429) {
      return { code: 'rate_limited', message: 'Rate limit RD.', friendly: 'Muitas chamadas. Espera 1 min e tenta de novo.' };
    }
    if (status >= 500) {
      return { code: 'server_error', message: `RD ${status}.`, friendly: 'RD com problema. Tenta novamente em alguns minutos.' };
    }
    return { code: 'unknown', message: res.message || `HTTP ${status}`, friendly: res.message || `Erro inesperado (${status}).` };
  },

  // V31.2.51 — Sync explícito de webhooks: pull do RD, compara com local,
  // reconcilia. Útil pra recuperar quando state local diverge da verdade
  // no RD (deleção manual no RD, mudança de domínio, etc).
  async syncRdWebhooksWithRd() {
    const refreshResult = await this.refreshRdWebhooks();
    if (!refreshResult.ok) {
      const c = this._classifyRdError({ ok: false, status: 0, message: refreshResult.message });
      Utils.toast(`Sync falhou: ${c.friendly}`);
      return { ok: false, message: refreshResult.message };
    }
    const localEvents = new Set((App.state.rdWebhooks || []).map(w => w.eventName));
    const expected = new Set(this._RD_WEBHOOK_EVENTS);
    const missing = [...expected].filter(ev => !localEvents.has(ev));
    if (missing.length) {
      Utils.toast(`${missing.length} webhook(s) faltando no RD. Re-cadastrando...`);
      await this.registerRdWebhooks();
    } else {
      Utils.toast(`✓ Sync OK — ${App.state.rdWebhooks.length} webhook(s) ativos no RD.`);
    }
    return { ok: true, missing };
  },

  // V24.1.0 — Mailing RD: criar segmentação no RD Marketing a partir de leads
  // filtrados no Buscador de Perfil. State em App.state.rdMailings + Modal
  // controlado por showRdMailingModal/rdMailingDraft.
  openRdMailingModal() {
    App.state.showRdMailingModal = true;
    App.state.rdMailingDraft = App.state.rdMailingDraft || { name: '', campaignId: '', targetStage: 'mkt_tof' };
    App.save();
    App.render();
  },

  closeRdMailingModal() {
    App.state.showRdMailingModal = false;
    App.save();
    App.render();
  },

  updateRdMailingDraft(field, value) {
    App.state.rdMailingDraft = App.state.rdMailingDraft || { name: '', campaignId: '', targetStage: 'mkt_tof' };
    App.state.rdMailingDraft[field] = value;
    App.save();
    App.render();
  },

  // V34.6.l hotfix — versão silenciosa pra inputs de texto (oninput).
  // App.render() em oninput recria o DOM e o input perde foco a cada tecla.
  // Esse helper só salva no state e NÃO re-renderiza. O slug visível no resumo
  // atualiza no próximo render natural (blur, submit, switch de campo).
  updateRdMailingDraftSilent(field, value) {
    App.state.rdMailingDraft = App.state.rdMailingDraft || { name: '', campaignId: '', targetStage: 'mkt_tof' };
    App.state.rdMailingDraft[field] = value;
    App.save();
  },

  _slugifyMailingName(name) {
    return String(name || '').trim().toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  },

  async confirmCreateRdMailing() {
    const draft = App.state.rdMailingDraft || {};
    const name = String(draft.name || '').trim();
    if (name.length < 3) return Utils.toast('Nome do mailing precisa de pelo menos 3 caracteres.');
    if (!draft.campaignId) return Utils.toast('Selecione a campanha vinculada.');
    if (!draft.targetStage) return Utils.toast('Selecione o estágio do funil.');
    if (!window.RdMarketingContactService?.hasOAuth?.()) {
      return Utils.toast('RD Marketing OAuth não conectado. Configure em Configurações → RD → aba Marketing.');
    }
    // Pega os leads filtrados atuais
    const filtered = LeadsModule._getDisplayedLeads ? LeadsModule._getDisplayedLeads() : [];
    if (!filtered.length) return Utils.toast('Nenhum lead filtrado pra enviar.');

    const slug = this._slugifyMailingName(name);
    const mailingTag = `lj_mailing_${slug}`;
    const targetTag = `target_${draft.targetStage}`;

    // V34.6.m hotfix — chunking + abort-on-fail.
    // Antes: loop serial de 500 leads → bloqueava UI 5+ min OU cascateava 401.
    // Agora: progress bar visível + para imediatamente se token expirou.
    App.state.rdMailingSending = true;
    App.state.rdMailingProgress = { current: 0, total: filtered.length };
    App.render();

    let pushed = 0;
    let failed = 0;
    const failures = [];
    const leadIds = [];
    let aborted = false;
    let abortReason = null;
    let consecutiveFailures = 0;
    let lastFailStatus = null;
    let lastFailMessage = null;
    const ABORT_THRESHOLD = 5; // 5 falhas seguidas = problema sistêmico

    try {
      for (let idx = 0; idx < filtered.length; idx++) {
        const lead = filtered[idx];
        // V34.6.o — Progress agora reflete tentativas + sucessos + falhas separados.
        // Antes mostrava só "current/total" (idx) o que enganava se TUDO falhava.
        if (idx % 10 === 0) {
          App.state.rdMailingProgress = {
            current: idx,
            pushed,
            failed,
            total: filtered.length
          };
          App.render();
        }
        if (!lead?.email) { failed += 1; continue; }
        try {
          const r = await RdMarketingContactService.upsertContact({
            name: lead.name || lead.email,
            email: lead.email,
            phone: lead.phone || '',
            company: lead.company || '',
            tags: [mailingTag, targetTag]
          });
          if (r.ok) {
            pushed += 1;
            leadIds.push(lead.id || lead.email);
            consecutiveFailures = 0; // reseta cascata
          } else {
            failed += 1;
            consecutiveFailures++;
            lastFailStatus = r.status;
            lastFailMessage = r.message;
            if (failures.length < 3) failures.push(r.message || 'falha');
            // V34.6.m+ — Log do body do 1º erro pra diagnose
            if (failed === 1) {
              console.error('[rd-mailing] primeira falha:', { status: r.status, message: r.message, data: r.data });
            }
            // V34.6.n hotfix — Abort após N falhas SEGUIDAS (qualquer 4xx/5xx).
            // 401/403 = auth. 400 = payload OU token inválido (RD às vezes retorna 400).
            // 500+ = problema servidor. Em qualquer caso, parar é melhor que cascatear.
            if (consecutiveFailures >= ABORT_THRESHOLD) {
              aborted = true;
              abortReason = `${ABORT_THRESHOLD} falhas seguidas (HTTP ${lastFailStatus || '?'}). ${
                lastFailStatus === 401 || lastFailStatus === 403
                  ? 'Token RD Marketing inválido/expirado. Reconecte em Configurações → RD.'
                  : lastFailStatus === 400
                  ? 'RD rejeitou o payload. Pode ser token expirado OU formato. Reconecte RD e tente de novo. Detalhe: ' + (lastFailMessage || '')
                  : 'Provider RD com problema. Tente novamente em alguns minutos.'
              }`;
              Utils.toast(abortReason);
              break;
            }
          }
        } catch (err) {
          failed += 1;
          consecutiveFailures++;
          if (failures.length < 3) failures.push(err?.message || String(err));
        }
      }

      // V34.6.m — Se abortou (cascata 401), NÃO salva mailing nem fecha modal.
      // Cliente reconecta RD Marketing e tenta de novo. Mailing só existe quando
      // pelo menos uma parcela razoável dos contatos foi pushada.
      if (!aborted && pushed > 0) {
        // Salva o mailing no state pra mapear conversões → campanha depois
        App.state.rdMailings = Array.isArray(App.state.rdMailings) ? App.state.rdMailings : [];
        const mailing = {
          id: `mailing_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name,
          slug,
          tag: mailingTag,
          targetStage: draft.targetStage,
          responseTag: `#convert_${draft.targetStage}`,
          campaignId: Number(draft.campaignId),
          leadCount: pushed,
          leadIds,
          createdAt: new Date().toISOString(),
          lastConversionAt: null
        };
        App.state.rdMailings.unshift(mailing);
        App.state.rdMailings = App.state.rdMailings.slice(0, 100);

        // V24.1.0 — Auto-registra webhook WEBHOOK.CONVERTED do RD Marketing
        try {
          await this._ensureMarketingConversionWebhook();
        } catch (_) {}

        App.state.showRdMailingModal = false;
        App.state.rdMailingDraft = { name: '', campaignId: '', targetStage: 'mkt_tof' };
      }
    } finally {
      App.state.rdMailingSending = false;
      App.state.rdMailingProgress = null;
      App.save();
      App.render();
    }

    if (!aborted && pushed) {
      Utils.toast(`✓ Mailing "${name}" criado · ${pushed} contato(s) no RD${failed ? ` · ${failed} falha(s): ${failures[0] || ''}` : ''}`);
    } else if (!aborted) {
      Utils.toast(`Falhou: ${failures[0] || 'nenhum contato pushado'}`);
    }
  },

  // V24.1.0 — Registra (idempotente) o webhook WEBHOOK.CONVERTED do Marketing
  // se ainda não estiver no App.state.rdWebhooks. Usa OAuth Marketing (não CRM).
  async _ensureMarketingConversionWebhook() {
    const existing = (App.state.rdWebhooks || []).find(w => w.eventName === 'WEBHOOK.CONVERTED');
    if (existing) return { ok: true, alreadyExists: true };
    const oauth = App.state.integrations?.rd?.accessToken || '';
    if (!oauth) return { ok: false, message: 'Marketing OAuth ausente.' };
    const url = this._webhookUrl();
    const body = {
      event_type: 'WEBHOOK.CONVERTED',
      entity_type: 'CONTACT',
      url,
      http_method: 'POST'
    };
    // Marketing webhook usa OAuth Marketing, não CRM → não passar useCrmOauthV2.
    const res = await RdCrmApiClient.post('/integrations/webhooks', body, { legacy: false });
    if (!res.ok) {
      App.state.rdWebhookRegistrationError = `WEBHOOK.CONVERTED: HTTP ${res.status} ${res.message}`;
      App.save();
      return { ok: false, message: res.message };
    }
    App.state.rdWebhooks = App.state.rdWebhooks || [];
    App.state.rdWebhooks.push({
      id: res.data?.uuid || res.data?.id || '',
      eventName: 'WEBHOOK.CONVERTED',
      url,
      createdAt: res.data?.created_at || new Date().toISOString()
    });
    App.save();
    return { ok: true };
  },

  // V26.0.0 — Djow AI: ações pra chat + config.
  //
  // State usado:
  //   App.state.djowConfig = { model, allowedRoles }
  //   App.state.djowStatus = (preenchido por loadDjowStatus())
  //   App.state.djowConversation = { id, messages: [{role, content, ts}] }
  //   App.state.djowOpen = boolean (modal Ctrl+K aberto)
  //   App.state.djowSending = boolean (loading state)
  //   App.state.djowInput = string (input atual no modal/home)

  async loadDjowStatus() {
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/djow-status', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await r.json();
      if (data.ok) {
        App.state.djowStatus = data;
        App.save();
        App.render();
      }
    } catch (_) {}
  },

  updateDjowConfig(field, value) {
    App.state.djowConfig = App.state.djowConfig || { model: 'claude-sonnet-4-6', allowedRoles: ['master'] };
    App.state.djowConfig[field] = value;
    App.save();
    App.render();
  },

  updateDjowAllowedRoles(rolePreset) {
    App.state.djowConfig = App.state.djowConfig || { model: 'claude-sonnet-4-6', allowedRoles: ['master'] };
    if (rolePreset === 'master') App.state.djowConfig.allowedRoles = ['master'];
    else if (rolePreset === 'production') App.state.djowConfig.allowedRoles = ['master', 'production'];
    else if (rolePreset === 'all') App.state.djowConfig.allowedRoles = ['master', 'production', 'all'];
    App.save();
    App.render();
  },

  async testDjowConnection() {
    Utils.toast('Testando Djow...');
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/djow-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ message: 'Diga "ok" pra confirmar que tá funcionando.' })
      });
      const data = await r.json();
      if (data.ok) {
        Utils.toast(`✓ Djow respondeu: "${(data.message || '').slice(0, 60)}..." · custo: $${data.usage?.costUsd || '0'}`);
        this.loadDjowStatus();
      } else {
        Utils.toast(`Falhou: ${data.message || 'erro desconhecido'}`);
      }
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V26.0.5 — Renomeadas pra djowAI* porque existiam funções legacy (V16.3
  // djowModal Railway agent) com os mesmos nomes mais abaixo no arquivo,
  // que sobrescreviam estas via ordem de declaração. Resultado: o toggle
  // do modal AI rodava a função legacy (que setava showDjowModal/djowDraftMessage,
  // não djowOpen), então o modal nunca aparecia.
  // V32.4.1 (Geraldo Item 1) — Aceita context opcional pra unificação:
  //   openDjowAIModal()                     → modo global (Ctrl+K)
  //   openDjowAIModal({ actionId: 42 })     → contexto de ação (substitui DjowModal V16.3)
  //   openDjowAIModal({ seedPrompt: '...' }) → pré-preenche o input
  openDjowAIModal(opts = {}) {
    App.state.djowOpen = true;
    App.state.djowContext = (opts && opts.actionId) ? { actionId: Number(opts.actionId) } : null;
    if (opts && opts.seedPrompt) {
      App.state.djowInput = String(opts.seedPrompt);
    }
    App.save();
    App.render();
    setTimeout(() => {
      const input = document.getElementById('djowInput');
      if (input) {
        input.focus();
        // Se tem seedPrompt, posiciona cursor no fim pra user continuar digitando
        if (opts.seedPrompt) input.setSelectionRange(input.value.length, input.value.length);
      }
    }, 50);
  },

  closeDjowAIModal() {
    App.state.djowOpen = false;
    App.state.djowContext = null;
    App.save();
    App.render();
  },

  toggleDjowAIModal() {
    if (App.state.djowOpen) this.closeDjowAIModal();
    else this.openDjowAIModal();
  },

  updateDjowAIInput(value) {
    App.state.djowInput = value;
    // Não dá save+render aqui (cada keystroke recarregaria o modal e perderia foco)
  },

  async sendDjowAIMessage(event) {
    if (event && event.key && event.key !== 'Enter') return;
    if (event && event.shiftKey) return; // shift+enter = nova linha
    if (event && event.preventDefault) event.preventDefault();

    // V26.0.4 — Lê de QUALQUER input Djow (home ou modal). Antes só tentava o modal,
    // que falhava quando enviado pelo home (id diferente).
    const modalInput = document.getElementById('djowInput');
    const homeInput = document.getElementById('djowHomeInput');
    const message = (
      modalInput?.value ||
      homeInput?.value ||
      App.state.djowInput ||
      ''
    ).trim();
    if (!message) {
      Utils.toast('Digite uma pergunta primeiro.');
      return;
    }
    // V26.0.4 — Reset stuck state (caso uma chamada anterior tenha travado em fetch hang).
    // Se já tem 30s+ que djowSending=true, considera stuck e libera.
    if (App.state.djowSending) {
      const stuckSince = App.state._djowSendingStartedAt || 0;
      if (Date.now() - stuckSince < 30000) {
        Utils.toast('Já tem uma pergunta sendo processada. Aguarda.');
        return;
      }
      // 30s+ = liberar
      App.state.djowSending = false;
    }
    App.state._djowSendingStartedAt = Date.now();

    App.state.djowConversation = App.state.djowConversation || { id: null, messages: [] };
    App.state.djowConversation.messages.push({ role: 'user', content: message, ts: Date.now() });
    App.state.djowInput = '';
    // V26.0.4 — Limpa AMBOS inputs (home + modal) pra UX consistente.
    if (modalInput) modalInput.value = '';
    if (homeInput) homeInput.value = '';
    App.state.djowSending = true;
    App.render();

    try {
      const token = localStorage.getItem('lj_jwt');
      // V27.0.1 — Anexa flags de entrevista (uma vez só, consumidas aqui).
      // Backend usa pra augmentar system prompt; user não vê o prompt verboso.
      const reqBody = {
        message,
        conversationId: App.state.djowConversation.id
      };
      // V32.4.1 (Geraldo Item 1) — Quando modal aberto via contexto de ação
      // (substituindo DjowModal V16.3), anexa action_id no payload. Backend
      // + tool create_clickup_task já aceitam (V32.2.1+).
      if (App.state.djowContext?.actionId) {
        reqBody.actionId = App.state.djowContext.actionId;
      }
      if (App.state._djowInterviewStage) {
        reqBody.interviewStage = App.state._djowInterviewStage;
        reqBody.interviewProductName = App.state._djowInterviewProductName || '';
        reqBody.interviewProductId = App.state._djowInterviewProductId || null;
        // Limpa imediatamente — não queremos passar nas próximas mensagens
        App.state._djowInterviewStage = null;
        App.state._djowInterviewProductName = null;
        App.state._djowInterviewProductId = null;
      }
      const r = await fetch('/api/djow-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(reqBody)
      });
      const data = await r.json();
      App.state.djowSending = false;
      if (data.ok) {
        App.state.djowConversation.id = data.conversationId;
        App.state.djowConversation.messages.push({
          role: 'assistant',
          content: data.message,
          ts: Date.now(),
          usage: data.usage
        });
        // V29.1.2 — Djow chamou navigate_strategic_map: dispara abertura do Mapa.
        if (data.navTarget && data.navTarget.type === 'strategic-map') {
          const t = data.navTarget;
          setTimeout(() => {
            if (t.campaignId) Actions.openStrategicMapForCampaign(t.campaignId);
            else if (t.productId) Actions.openStrategicMap(t.productId);
          }, 100); // pequeno delay pra render do chat completar antes
        }
        // V26.2.0 — Se Djow criou entidades (state mutou no backend), puxa state
        // fresco do Postgres pro frontend ver os registros novos imediatamente.
        if (data.stateModified && window.App?._loadStateWithRemoteFallback) {
          try { await App._loadStateWithRemoteFallback(); } catch (_) {}
          if (Array.isArray(data.entitiesCreated) && data.entitiesCreated.length) {
            const names = data.entitiesCreated.map(e => {
              const t = e.kind === 'create_product' ? 'Produto' : e.kind === 'create_campaign' ? 'Campanha' : 'Ação';
              return `${t}: ${e.payload?.name || '?'}`;
            }).join(' · ');
            Utils.toast(`✓ Djow criou: ${names}`);
          }
        }
      } else {
        App.state.djowConversation.messages.push({
          role: 'assistant',
          content: `❌ Erro: ${data.message || 'falha desconhecida'}`,
          ts: Date.now(),
          isError: true
        });
      }
    } catch (err) {
      App.state.djowSending = false;
      App.state.djowConversation.messages.push({
        role: 'assistant',
        content: `❌ Erro de rede: ${err.message}`,
        ts: Date.now(),
        isError: true
      });
    }
    App.save();
    App.render();
    // Auto-scroll
    setTimeout(() => {
      const log = document.getElementById('djowMessages');
      if (log) log.scrollTop = log.scrollHeight;
    }, 50);
  },

  // V27.0.1 — Djow entrevista no Mapa da Receita.
  // User vê uma mensagem CURTA e amigável. O contexto verboso (instruções Doerr
  // pro Djow conduzir) vai via system prompt augmentation no backend, invisível
  // pro user. Antes (V27.0.0) o prompt verboso aparecia como "user message" no
  // chat — confundia visualmente.
  async djowInterviewStrategic(stage) {
    const productId = App.state.strategicMapProductId;
    const product = (App.state.products || []).find(p => Number(p.id) === Number(productId));
    if (!product) return Utils.toast('Selecione um produto primeiro.');

    const friendly = {
      vision: `Djow, me ajuda a definir a Visão do produto "${product.name}" no Mapa da Receita.`,
      objectives: `Djow, me ajuda com os Objectives do produto "${product.name}" no Mapa da Receita.`,
      keyresults: `Djow, me ajuda com os Key Results do produto "${product.name}" no Mapa da Receita.`
    };

    App.state.djowInput = friendly[stage] || friendly.vision;
    App.state._djowInterviewStage = stage;
    App.state._djowInterviewProductName = product.name;
    App.state._djowInterviewProductId = product.id;
    // V27.0.2 — Flush state pro Postgres antes de chamar Djow.
    // Sem isso, se user acabou de digitar a Visão e clica "Djow me entrevista"
    // dentro dos 2s do debounce, Djow lê state velho do banco e responde
    // como se a Visão estivesse vazia (desperdiça créditos).
    Utils.toast('Sincronizando state…');
    if (window.RemoteSyncAdapter?.flushNow) {
      try { await RemoteSyncAdapter.flushNow(); } catch (_) {}
    }
    this.openDjowAIModal();
    setTimeout(() => this.sendDjowAIMessage(), 100);
  },

  // V26.1.0 — Buscador de Perfil com Djow: usa Claude pra parsear a query em
  // filtros estruturados, depois aplica via ProfileFinder (mesma lista de leads
  // globais já existente). Vc digita "mulheres jovens com alta intenção em SP"
  // e o Djow extrai sexo:feminino + idade_range:18-30 + local:sp + temperatura:quente.
  async djowSearchProfile() {
    const query = String(App.state.profileQuery || '').trim();
    if (!query) return Utils.toast('Digite uma query primeiro.');
    if (query.length > 500) return Utils.toast('Query muito longa (max 500 caracteres).');
    if (App.state._djowSearchRunning) return;
    // V34.0.0 Onda 4 — gating: precisa ter banco(s) selecionado(s) antes.
    // Se ainda não rodou nenhuma busca, abre modal de seleção primeiro.
    if (!App.state.visitorSearchResults?.loadedAt) {
      return Actions.openSearchBankSelector('search');
    }
    App.state._djowSearchRunning = true;
    App.render();
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/djow-search-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ query })
      });
      const data = await r.json();
      if (!data.ok) {
        Utils.toast(`Djow falhou: ${data.message || 'erro desconhecido'}`);
        return;
      }
      // Aplica os filtros como o parser local faria (ProfileFinder.applyFilters
      // consome esse formato direto).
      App.state.profileFilters = data.filters || [];
      App.state.profileActive = (data.filters || []).length > 0;
      const count = data.filters?.length || 0;
      Utils.toast(`Djow extraiu ${count} filtro(s) · veja em Leads Globais abaixo`);
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    } finally {
      App.state._djowSearchRunning = false;
      App.save();
      App.render();
    }
  },

  clearDjowAIConversation() {
    if (!confirm('Limpar a conversa atual? O histórico fica no banco mas some daqui.')) return;
    App.state.djowConversation = { id: null, messages: [] };
    App.save();
    App.render();
  },

  // V24.1.0 — Refresh manual de TODAS as fontes RD (substituiu auto-loops).
  // Dispara: CRM (pipelines/deals via PAT), Marketing (conversões via OAuth),
  // webhook buffer (eventos em tempo real). Status fica em App.state.rdLastSyncAt.
  // Mostra toast com contadores no fim.
  async refreshAllRdData(opts = {}) {
    const silent = Boolean(opts.silent);
    if (App.state.rdRefreshing) return;
    App.state.rdRefreshing = true;
    if (!silent) App.render();
    let crmOk = 0, marketingOk = 0, webhookOk = 0;
    const errors = [];
    try {
      if (window.RdCrmLiveSyncEngine?.runOnce) {
        const r = await RdCrmLiveSyncEngine.runOnce(true);
        if (r?.ok) {
          crmOk = (r.upserted || 0) + (r.dealsApplied || 0);
          marketingOk = r.marketingUpserted || 0;
          webhookOk = r.webhookApplied || 0;
        } else if (r?.reason) {
          errors.push(`RD live: ${r.reason}`);
        }
      }
      // V37.0.8 — EventCollector.poll() removido (era pra polling de
      // /api/lp-events-fetch — endpoint legacy do fluxo LP modal vestigial).
    } catch (err) {
      errors.push(`Erro: ${err?.message || err}`);
    } finally {
      App.state.rdRefreshing = false;
      App.state.rdLastManualRefreshAt = new Date().toISOString();
      App.save();
      App.render();
    }
    if (!silent) {
      const parts = [];
      if (crmOk) parts.push(`${crmOk} CRM`);
      if (marketingOk) parts.push(`${marketingOk} Marketing`);
      if (webhookOk) parts.push(`${webhookOk} webhook`);
      const summary = parts.length ? parts.join(' · ') : 'nada novo';
      Utils.toast(`RD atualizado · ${summary}${errors.length ? ' · ' + errors[0] : ''}`);
    }
  },

  // V24.1.0 — DELETE /integrations/webhooks/:uuid pra desativar um evento.
  async deleteRdWebhook(id) {
    if (!id) return;
    if (!confirm('Desativar este webhook no RD? O Journey vai parar de receber esse evento em tempo real (volta pro polling de 5min).')) return;
    const res = await RdCrmApiClient.del(`/integrations/webhooks/${encodeURIComponent(id)}`, { legacy: false, useCrmOauthV2: true });
    if (res.ok || res.status === 404) {
      App.state.rdWebhooks = (App.state.rdWebhooks || []).filter(w => w.id !== id);
      App.save();
      App.render();
      Utils.toast('Webhook desativado.');
    } else {
      Utils.toast(`Falha ao desativar: HTTP ${res.status} ${res.message}`);
    }
  },

  // V22.1.1 — Snapshot pré-update: baixa um JSON com state completo,
  // nomeado com a versão atual. LEI do design director: rodar isso
  // antes de qualquer atualização do projeto.
  async downloadStateSnapshot(label = '') {
    if (!window.DatabaseSnapshotService?.generate) {
      return Utils.toast('Serviço de snapshot indisponível.');
    }
    const tag = label || (window.LJVersion || 'state');
    const result = await DatabaseSnapshotService.generate(`pre-${tag}`);
    if (result.ok) {
      Utils.toast(`✓ Snapshot baixado: ${result.filename} (${result.sizeKb} KB).`);
    } else {
      Utils.toast(`Falha ao gerar snapshot: ${result.message || 'erro desconhecido'}.`);
    }
  },

  // V32.9.1 (Geraldo Item 3) — Restore via upload de arquivo JSON. Aplica state
  // após confirmação dupla pra evitar destruir dados do cliente por engano.
  async restoreStateFromFile(file) {
    if (!file) return Utils.toast('Nenhum arquivo selecionado.');
    if (!file.name.endsWith('.json')) return Utils.toast('Arquivo precisa ser .json.');
    let parsed;
    try {
      const text = await file.text();
      parsed = JSON.parse(text);
    } catch (err) {
      return Utils.toast(`Arquivo inválido: ${err.message}`);
    }
    // Validação mínima: state precisa ter pelo menos UMA das chaves principais
    const hasRealData = parsed && typeof parsed === 'object' &&
      (Array.isArray(parsed.products) || Array.isArray(parsed.campaigns) || Array.isArray(parsed.actions));
    if (!hasRealData) return Utils.toast('JSON não parece um state válido (sem products/campaigns/actions).');

    const productsCount = (parsed.products || []).length;
    const campaignsCount = (parsed.campaigns || []).length;
    const actionsCount = (parsed.actions || []).length;
    const message = `Vai SUBSTITUIR o state atual por este snapshot:\n\n` +
      `  ${productsCount} produto(s)\n  ${campaignsCount} campanha(s)\n  ${actionsCount} ação(ões)\n\n` +
      `Você ESTÁ PERDENDO o que está no LJ agora se não baixou snapshot antes.\nConfirma?`;
    if (!confirm(message)) return;
    if (!confirm('Tem CERTEZA? Isso é irreversível sem snapshot prévio.')) return;

    try {
      App.state = State.normalize(parsed);
      App.state.lastSavedAt = new Date().toISOString();
      App.save();
      App.render();
      Utils.toast(`✓ Snapshot restaurado: ${productsCount} produtos · ${campaignsCount} campanhas · ${actionsCount} ações.`);
    } catch (err) {
      Utils.toast(`Falha ao aplicar: ${err.message}`);
    }
  },

  // V32.10.2 — Snapshots remotos (journey_snapshots no DB tenant).
  // Caso Sansone (perda de dados RevOps): aqui é onde ele recupera versão
  // anterior persistida no servidor (não depende do localStorage frágil).
  async loadRemoteSnapshots() {
    if (!App.state.remoteSnapshotsCache) App.state.remoteSnapshotsCache = { snapshots: [], loading: false, fetchedAt: null };
    App.state.remoteSnapshotsCache.loading = true;
    App.render();
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/snapshots-list', { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      if (!data.ok) {
        App.state.remoteSnapshotsCache = { snapshots: [], loading: false, fetchedAt: null, error: data.message };
        App.render();
        return;
      }
      App.state.remoteSnapshotsCache = {
        snapshots: data.snapshots || [],
        loading: false,
        fetchedAt: new Date().toISOString(),
        error: null
      };
      App.render();
    } catch (err) {
      App.state.remoteSnapshotsCache = { snapshots: [], loading: false, fetchedAt: null, error: err.message };
      App.render();
    }
  },

  async restoreFromRemoteSnapshot(snapshotId) {
    if (!snapshotId) return;
    const sc = (App.state.remoteSnapshotsCache?.snapshots || []).find(s => Number(s.id) === Number(snapshotId));
    const label = sc?.label || `snapshot #${snapshotId}`;
    const when = sc?.created_at ? new Date(sc.created_at).toLocaleString('pt-BR') : '?';
    if (!confirm(`Restaurar snapshot "${label}" (${when})?\n\nUm backup do state atual será criado ANTES (você não perde nada). Confirma?`)) return;
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/snapshots-restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ snapshotId: Number(snapshotId) })
      });
      const data = await r.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      Utils.toast(`✓ Snapshot restaurado. Recarregando…`);
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V32.10.2 → V32.10.4 — Cria snapshot remoto. Guarda contra state vazio:
  // não polui retention (50) com snapshots vazios + não mascara histórico bom.
  // silent=true: sem toast, sem render (uso interno em auto-snapshot).
  async createRemoteSnapshot(label = 'manual', silent = false) {
    const s = App.state || {};
    const totalReal = (s.products||[]).length + (s.campaigns||[]).length + (s.actions||[]).length;
    if (totalReal === 0) {
      if (!silent) Utils.toast('Snapshot pulado: nada pra salvar (state vazio).');
      console.warn(`[snapshot] "${label}" PULADO: state vazio.`);
      return null;
    }
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/snapshots-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ state: App.state, label })
      });
      const data = await r.json();
      if (!data.ok) {
        if (!silent) Utils.toast(`Falha snapshot: ${data.message}`);
        return null;
      }
      if (!silent) Utils.toast(`✓ Snapshot "${label}" criado.`);
      return data.snapshot;
    } catch (err) {
      if (!silent) Utils.toast(`Erro: ${err.message}`);
      return null;
    }
  },

  // V32.10.6 — Admin inspector: master lê snapshots de um tenant escolhido
  // com preview de conteúdo (contagem de products, RevOps groups, etc).
  // Permite identificar QUAL snapshot tem os dados completos antes de restaurar.
  async loadAdminTenantSnapshots(tenantSlug) {
    if (!tenantSlug) return Utils.toast('Tenant slug obrigatório.');
    if (!App.state.adminInspector) App.state.adminInspector = {};
    App.state.adminInspector.loading = true;
    App.state.adminInspector.tenantSlug = tenantSlug;
    App.state.adminInspector.error = null;
    App.render();
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch(`/api/admin-tenant-snapshots?tenant_slug=${encodeURIComponent(tenantSlug)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await r.json();
      if (!data.ok) {
        App.state.adminInspector.loading = false;
        App.state.adminInspector.error = data.message;
        App.render();
        return;
      }
      App.state.adminInspector = {
        ...App.state.adminInspector,
        loading: false,
        tenant: data.tenant,
        users: data.users,
        snapshots: data.snapshots,
        fetchedAt: new Date().toISOString(),
        error: null
      };
      App.save(); App.render();
    } catch (err) {
      App.state.adminInspector.loading = false;
      App.state.adminInspector.error = err.message;
      App.render();
    }
  },

  setAdminInspectorTenantSlug(slug) {
    if (!App.state.adminInspector) App.state.adminInspector = {};
    App.state.adminInspector.tenantSlug = String(slug || '').trim().toLowerCase();
    App.save();
  },

  // V32.10.6 — Restaura snapshot de um tenant pra um user específico, sem
  // o user precisar logar. Master controla o estrago do incidente Sansone.
  async adminRestoreTenantSnapshot(tenantSlug, snapshotId, snapshotPreview) {
    if (!tenantSlug || !snapshotId) return;
    const preview = snapshotPreview || {};
    const msg = `Restaurar este snapshot no tenant "${tenantSlug}"?\n\n` +
      `Conteúdo do snapshot:\n` +
      `  ${preview.products || 0} produtos\n` +
      `  ${preview.campaigns || 0} campanhas\n` +
      `  ${preview.actions || 0} ações\n` +
      `  ${preview.revopsGroups || 0} grupos RevOps · ${preview.revopsItems || 0} items\n\n` +
      `Um snapshot pre-restore-admin-* será criado ANTES (não perde nada).\nConfirma?`;
    if (!confirm(msg)) return;
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/admin-restore-tenant-snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tenant_slug: tenantSlug, snapshot_id: snapshotId })
      });
      const data = await r.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      Utils.toast(`✓ Restaurado: ${data.before.products}→${data.after.products} produtos, ${data.before.actions}→${data.after.actions} ações`);
      // Recarrega lista pra ver o pre-restore que entrou
      Actions.loadAdminTenantSnapshots(tenantSlug);
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V32.10.5 — Snapshot deploy-wide: salva state de TODOS os tenants ativos
  // antes de qualquer deploy de produção. Master-only. Workflow obrigatório:
  // Felipe dispara → backend itera tenants → snapshot por user → retention 10
  // por owner. Antídoto contra "atualizei nova versão e dados sumiram".
  async createDeploySnapshotAllTenants(version) {
    if (!confirm(`Criar snapshot pré-deploy de TODOS os tenants ativos?\n\nVersão atual: ${version || window.LJVersion}\n\nIsso é o vetor de segurança ANTES de promover pra prod. Confirma?`)) return;
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/admin-deploy-snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ version: version || window.LJVersion })
      });
      const data = await r.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      Utils.toast(`✓ ${data.message}`);
      console.log('[deploy-snapshot] stats:', data.stats);
      // Recarrega lista pra mostrar os novos
      Actions.loadRemoteSnapshots();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V32.10.2 — Auto-snapshot ao entrar/sair de áreas críticas. Guard por
  // sessão+label pra não spammar o backend.
  _autoSnapshotOnce(label) {
    if (!App._autoSnapshotDone) App._autoSnapshotDone = new Set();
    if (App._autoSnapshotDone.has(label)) return;
    App._autoSnapshotDone.add(label);
    // Fire-and-forget — não bloqueia UI nem mostra toast.
    Actions.createRemoteSnapshot(label, true);
  },

  // V32.14.0 — Filtro escopo no Acompanhamento (Etapa 6).
  // 'campaign' = só campanha atual | 'product' = todas campanhas do produto.
  setAcompanhamentoScope(scope) {
    App.state.strategicAcompanhamentoScope = scope === 'product' ? 'product' : 'campaign';
    App.save(); App.render();
  },

  // V32.14.1 — Drill-down do KR no Acompanhamento (lupa). Mostra ações e
  // tasks daquele KR específico com status agregado.
  openAcompanhamentoKrDetail(krId, branchCampaignId) {
    App.state.acompanhamentoKrDetail = {
      krId: String(krId),
      branchCampaignId: branchCampaignId ? Number(branchCampaignId) : null
    };
    App.render();
  },

  closeAcompanhamentoKrDetail() {
    App.state.acompanhamentoKrDetail = null;
    App.render();
  },

  // V32.14.2 — Drill-down da Ação no Acompanhamento. Mostra detalhe da ação
  // + KRs que ela move + tasks com status agregado.
  openAcompanhamentoActionDetail(actionId) {
    App.state.acompanhamentoActionDetail = { actionId: Number(actionId) };
    App.render();
  },

  closeAcompanhamentoActionDetail() {
    App.state.acompanhamentoActionDetail = null;
    App.render();
  },

  // V32.14.3 — Duplica task de execução do mind-map. Felipe alinhou: cliente
  // clica botão "Duplicar" → cria nova task local com mesmas infos (provider,
  // descrição, due_date, assignees, custom_fields) mas nome incrementado.
  // NÃO cria task nova no ClickUp — é só duplicação local pra cliente
  // organizar mais branches visualmente. Cliente pode depois "Executar
  // Ação" da duplicada pra criar real no ClickUp se quiser.
  duplicateExecutionTask(taskId) {
    if (!window.ExecutionTaskStore) return Utils.toast('ExecutionTaskStore indisponível.');
    const original = ExecutionTaskStore.byId(taskId);
    if (!original) return Utils.toast('Task original não encontrada.');
    // Conta duplicatas existentes pra incrementar o nome
    const baseName = String(original.title || 'Task').replace(/\s*\(\d+\)$/, '');
    const linkedTasks = ExecutionTaskStore.byAction(original.linked_action_id) || [];
    const sameBaseCount = linkedTasks.filter(t => String(t.title || '').replace(/\s*\(\d+\)$/, '') === baseName).length;
    const newName = `${baseName} (${sameBaseCount + 1})`;
    // V32.14.6 — Duplicata entra com status='review' (não 'pending'): cliente
    // precisa REVISAR e editar antes de criar no ClickUp.
    ExecutionTaskStore.create({
      linked_action_id: original.linked_action_id,
      title: newName,
      description: original.description,
      status: 'review',
      provider: 'manual',  // local-only enquanto não executar real
      due_date: original.due_date || null,
      assignees: original.assignees || []
    });
    App.save(); App.render();
    Utils.toast(`✓ Task duplicada: "${newName}" (Em revisão). Clique em Editar pra revisar antes de criar no ClickUp.`);
  },

  // V33.0.0-alpha17 — Promove task LOCAL (manual/duplicada) pra ClickUp.
  // Felipe alinhou: card "Não listada" no mind-map → click no modal abre
  // botão "Executar no ClickUp" → cria task real como ramificação da action,
  // atualiza provider/provider_task_id/external_url, fecha modal.
  async promoteManualTaskToClickup(taskId) {
    if (!window.ExecutionTaskStore) return Utils.toast('ExecutionTaskStore indisponível.');
    const task = ExecutionTaskStore.byId(taskId);
    if (!task) return Utils.toast('Task não encontrada.');
    if (task.provider_task_id) return Utils.toast('Esta task já está listada no provider.');

    // Marca pending no modal pra feedback visual
    App.state.executionTaskDetail = { ...App.state.executionTaskDetail, syncing: true };
    App.render();

    try {
      const action = (App.state.actions || []).find(a => Number(a.id) === Number(task.linked_action_id));
      const campaign = action ? (App.state.campaigns || []).find(c => Number(c.id) === Number(action.campaignId)) : null;
      const payload = {
        actionId: task.linked_action_id,
        name: task.title || 'Task sem nome',
        description: task.description || `Ação operacional: ${action?.name || ''}. Canal: ${action?.channel || ''}.`,
        priority: task.priority || 'normal',
        due_date: task.due_date || null,
        assignees: task.assignees || []
      };
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/clickup-create-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await r.json();
      if (!data.ok) throw new Error(data.message || data.data?.err || 'Falha desconhecida');

      // Atualiza local pra refletir que agora está no ClickUp
      ExecutionTaskStore.update(taskId, {
        provider: 'clickup',
        provider_task_id: data.providerTaskId,
        external_url: data.externalUrl,
        status: 'pending'  // sai de review/manual pra pending no ClickUp
      });

      App.state.executionTaskDetail = { ...App.state.executionTaskDetail, syncing: false };
      App.save(); App.render();
      Utils.toast(`✓ Task agora listada no ClickUp.`);
    } catch (err) {
      App.state.executionTaskDetail = { ...App.state.executionTaskDetail, syncing: false };
      App.render();
      Utils.toast(`Falhou: ${err.message}`);
    }
  },

  // V32.13.17 — Auto-sync silencioso de tasks ClickUp ao entrar na Etapa 5.
  // Guard por chave + intervalo mínimo (5min) pra não estourar API e nem
  // chamar a cada re-render. Roda em setTimeout pra não bloquear UI.
  _autoSyncClickupTasksOnce(key) {
    if (!App._autoSyncClickup) App._autoSyncClickup = new Map();
    const last = App._autoSyncClickup.get(key) || 0;
    const now = Date.now();
    if (now - last < 5 * 60 * 1000) return;  // 5min cooldown
    App._autoSyncClickup.set(key, now);
    setTimeout(() => {
      if (typeof Actions.syncClickupTaskStatuses === 'function') {
        Actions.syncClickupTaskStatuses(true);  // silent
      }
    }, 300);
  },

  // V32.9.1 — Restaura state de um backup rotativo do localStorage (slots 1-3).
  // StorageAdapter já mantém 3 slots automaticamente. Cliente recupera versão
  // anterior sem precisar de arquivo.
  restoreFromLocalBackup(slot) {
    const raw = localStorage.getItem(`lj_state_v2__backup_${slot}`);
    if (!raw) return Utils.toast(`Slot ${slot} vazio.`);
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch (_) { return Utils.toast(`Slot ${slot} corrompido.`); }
    const productsCount = (parsed.products || []).length;
    const campaignsCount = (parsed.campaigns || []).length;
    const actionsCount = (parsed.actions || []).length;
    if (!confirm(`Restaurar slot ${slot}? Vai substituir o atual por:\n${productsCount} produtos · ${campaignsCount} campanhas · ${actionsCount} ações.`)) return;
    try {
      App.state = State.normalize(parsed);
      App.state.lastSavedAt = new Date().toISOString();
      App.save();
      App.render();
      Utils.toast(`✓ Slot ${slot} restaurado.`);
    } catch (err) {
      Utils.toast(`Falha: ${err.message}`);
    }
  },

  // V21.8 — Troca authorization_code por access_token via fetch direto ao RD.
  async exchangeRDAuthorizationCode() {
    this.ensureIntegrations();
    const cfg = App.state.integrations.rd;
    if (!cfg.authorizationCode) return Utils.toast('Cole o Authorization Code antes.');
    Utils.toast('Trocando code por token no RD...');
    const result = await RDAuthService.exchangeAuthorizationCode(cfg);
    if (!result.ok) {
      cfg.status = 'exchange_failed';
      cfg.lastTestAt = new Date().toISOString();
      App.save(); App.render();
      return Utils.toast(`Falha: ${result.message}`);
    }
    cfg.accessToken = result.accessToken;
    cfg.refreshToken = result.refreshToken || cfg.refreshToken;
    cfg.expiresAt = result.expiresAt || '';
    cfg.status = 'connected';
    cfg.lastTestAt = new Date().toISOString();
    // V21.8 — code é one-shot: o RD invalida após troca. Limpamos pra não confundir.
    cfg.authorizationCode = '';
    App.save(); App.render();
    this._persistRdToDb('marketing_oauth'); // V31.2.36 — write-through
    Utils.toast('✓ Token RD obtido e salvo.');
  },

  // V21.8 — Força refresh do accessToken usando refresh_token.
  async refreshRDAccessToken() {
    this.ensureIntegrations();
    const cfg = App.state.integrations.rd;
    if (!cfg.refreshToken) return Utils.toast('Sem refresh_token. Refaça o OAuth.');
    Utils.toast('Renovando token RD...');
    const result = await RDAuthService.refreshAccessToken(cfg);
    if (!result.ok) {
      cfg.status = 'refresh_failed';
      App.save(); App.render();
      return Utils.toast(`Falha: ${result.message}`);
    }
    cfg.accessToken = result.accessToken;
    cfg.refreshToken = result.refreshToken || cfg.refreshToken;
    cfg.expiresAt = result.expiresAt || '';
    cfg.status = 'connected';
    cfg.lastTestAt = new Date().toISOString();
    App.save(); App.render();
    this._persistRdToDb('marketing_oauth'); // V31.2.36 — write-through após refresh
    Utils.toast('✓ Token RD renovado.');
  },

  updateActionDraftRDEmail(field, value) {
    App.state.actionDraft.rdEmailConfig = {
      ...(window.RDConfig ? RDConfig.emailDefaults() : {}),
      ...(App.state.actionDraft.rdEmailConfig || {})
    };
    App.state.actionDraft.rdEmailConfig[field] = value;
    App.save();
  }
});

// V13 — Preserve existing createAction logic and enrich RD Email actions after creation.
const __LJ_createAction_before_rd_v13 = Actions.createAction;
Actions.createAction = function() {
  const draft = App.state.actionDraft || {};
  const isRD = window.RDMapper?.isRDEmailAction?.(draft);
  const rdEmailConfig = { ...(window.RDConfig ? RDConfig.emailDefaults() : {}), ...(draft.rdEmailConfig || {}) };

  __LJ_createAction_before_rd_v13.call(Actions);

  if (isRD && App.state.actions && App.state.actions[0]) {
    App.state.actions[0] = RDMapper.mapActionPayload({
      ...App.state.actions[0],
      rdEmailConfig,
      rdEmailStats: { ...(draft.rdEmailStats || {}) },
      kpis: window.RDKpiMapper ? RDKpiMapper.mapStatsToKpis(draft.rdEmailStats || RDKpiMapper.emptyStatsTemplate(), draft.kpis || []) : [...(draft.kpis || [])]
    });
    App.save();
    Utils.toast('Ação RD Email criada com campos e KPIs preparados.');
  }
};

window.Actions = Actions;

Object.assign(Actions, {
  updateActionDraftRDStats(field, value) {
    App.state.actionDraft.rdEmailStats = { ...(window.RDKpiMapper ? RDKpiMapper.emptyStatsTemplate() : {}), ...(App.state.actionDraft.rdEmailStats || {}) };
    App.state.actionDraft.rdEmailStats[field] = Number(value || 0);
    if (window.RDKpiMapper) App.state.actionDraft.kpis = RDKpiMapper.mapStatsToKpis(App.state.actionDraft.rdEmailStats, App.state.actionDraft.kpis || []);
    App.save();
  },
  refreshActionRDKpis(actionId) {
    const action = App.state.actions.find(a => Number(a.id) === Number(actionId));
    if (!action || !window.RDKpiMapper) return Utils.toast('Ação RD não encontrada.');
    const next = RDKpiMapper.applyToAction(action, action.rdEmailStats || {});
    App.state.actions = App.state.actions.map(a => Number(a.id) === Number(actionId) ? next : a);
    App.save(); App.render(); Utils.toast('KPIs RD recalculados.');
  }
});

Object.assign(Actions, {
  async syncRDAction(actionId) {
    const result = await RDSyncEngine.syncAction(actionId);
    App.render();
    Utils.toast(result.message || (result.ok ? 'Sync RD realizado.' : 'Falha no sync RD.'));
  },
  async syncAllRDActions() {
    const result = await RDSyncEngine.syncAll();
    App.render();
    Utils.toast(`Sync RD concluído: ${result.total} ação(ões).`);
  }
});
window.Actions = Actions;


// V13.0.2 — direct RD settings opener
Object.assign(Actions, {
  openRDSettings() {
    App.state.showSettingsModal = true;
    App.state.settingsActiveSection = 'rd';
    App.state.integrations = App.state.integrations || {};
    App.state.integrations.rd = { ...(window.RDConfig ? RDConfig.defaultConfig() : {}), ...(App.state.integrations.rd || {}) };
    App.save();
    App.render();
    setTimeout(() => window.RDSettingsInjection?.inject?.(), 0);
    // V24.1.0 — lazy refresh ao abrir a seção RD
    if (typeof this._maybeAutoRefreshRd === 'function') this._maybeAutoRefreshRd();
  }
});
window.Actions = Actions;


// V13.0.3 — Settings section navigation
// V24.1.0 — Quando o user entra na seção 'rd', dispara refresh automático
// 1x (lazy load). Evita rodar polling em background pra escala.
// Cache: só re-dispara se faz mais de 5min do último refresh.
Object.assign(Actions, {
  setSettingsSection(section) {
    App.state.settingsActiveSection = section;
    App.save();
    App.render();
    if (section === 'rd') this._maybeAutoRefreshRd();
  },
  _maybeAutoRefreshRd() {
    const last = App.state.rdLastManualRefreshAt;
    const ageMs = last ? Date.now() - new Date(last).getTime() : Infinity;
    const stale = ageMs > 5 * 60 * 1000;
    if (!stale) return;
    if (App.state.rdRefreshing) return;
    // Só refresca se houver pelo menos uma fonte configurada
    const rdCfg = App.state.integrations?.rd || {};
    const hasAny = Boolean(rdCfg.crmPersonalToken || rdCfg.accessToken || rdCfg.crmOauth?.accessToken);
    if (!hasAny) return;
    this.refreshAllRdData({ silent: true });
    // V31.2.51 — Hardening: também refresh os webhooks especificamente.
    // Detecta se state local diverge do RD (ex: user deletou no RD manualmente).
    if (rdCfg.crmOauth?.accessToken) {
      this.refreshRdWebhooks().catch(_ => {});
    }
  }
});
window.Actions = Actions;


// V32.4.0 (Geraldo Item 6) — Comentário antigo do stub V13.0.4 removido —
// referenciava actions database que foram aposentadas inteiras.


// V13.1.1 — OAuth Runtime Fix
Object.assign(Actions, {
  ensureRDConfig() {
    App.state.integrations = App.state.integrations || {};
    App.state.integrations.rd = {
      ...(window.RDConfig ? RDConfig.defaultConfig() : {}),
      ...(App.state.integrations.rd || {})
    };
    return App.state.integrations.rd;
  },

  generateRDAuthUrl() {
    const cfg = this.ensureRDConfig();
    const result = RDAuthService.buildAuthorizationUrl(cfg);

    if (!result.ok) {
      Utils.toast(result.message);
      return;
    }

    App.state.integrations.rd.authUrl = result.url;
    App.state.integrations.rd.status = "ready_for_oauth";
    App.save();
    App.render();

    Utils.toast("URL OAuth gerada. Clique em Abrir URL OAuth.");
  },

  openRDAuthUrl() {
    const cfg = this.ensureRDConfig();
    let url = cfg.authUrl;

    if (!url) {
      const result = RDAuthService.buildAuthorizationUrl(cfg);
      if (!result.ok) {
        Utils.toast(result.message);
        return;
      }
      url = result.url;
      App.state.integrations.rd.authUrl = url;
      App.state.integrations.rd.status = "ready_for_oauth";
      App.save();
    }

    try {
      window.open(url, "_blank", "noopener,noreferrer");
      Utils.toast("URL OAuth aberta em nova aba.");
    } catch (error) {
      Utils.toast("O navegador bloqueou a abertura. Copie a URL gerada manualmente.");
    }

    App.render();
  },

  async copyRDAuthUrl() {
    const cfg = this.ensureRDConfig();
    let url = cfg.authUrl;

    if (!url) {
      const result = RDAuthService.buildAuthorizationUrl(cfg);
      if (!result.ok) {
        Utils.toast(result.message);
        return;
      }
      url = result.url;
      App.state.integrations.rd.authUrl = url;
      App.state.integrations.rd.status = "ready_for_oauth";
      App.save();
    }

    try {
      await navigator.clipboard.writeText(url);
      Utils.toast("URL OAuth copiada.");
    } catch (error) {
      Utils.toast("Não consegui copiar automaticamente. Selecione e copie a URL exibida.");
    }

    App.render();
  }
});
window.Actions = Actions;


// V14 — RevOps & Governança actions.
Object.assign(Actions, {
  _revopsEnsureConfig(productId) {
    const id = Number(productId || App.state.revopsSelectedProductId || App.state.products?.[0]?.id);
    if (!id) return null;
    if (!App.state.revopsSelectedProductId || Number(App.state.revopsSelectedProductId) !== id) {
      App.state.revopsSelectedProductId = id;
    }
    App.state.revopsFinance = App.state.revopsFinance || {};
    if (!App.state.revopsFinance[id]) App.state.revopsFinance[id] = RevopsFinanceEngine.defaultConfig(id);
    App.state.revopsFinance[id] = RevopsFinanceEngine.normalize(App.state.revopsFinance[id], id);
    return App.state.revopsFinance[id];
  },

  setRevopsProduct(productId) {
    if (!productId) return;
    App.state.revopsSelectedProductId = Number(productId);
    this._revopsEnsureConfig(productId);
    App.save(); App.render();
  },

  addRevopsOffer() {
    const config = this._revopsEnsureConfig();
    if (!config) return Utils.toast('Selecione um produto antes de adicionar ofertas.');
    config.offers = [...(config.offers || []), RevopsFinanceEngine.emptyOffer()];
    App.save(); App.render();
  },

  removeRevopsOffer(offerId) {
    const config = this._revopsEnsureConfig();
    if (!config) return;
    config.offers = (config.offers || []).filter(offer => offer.id !== offerId);
    App.save(); App.render();
  },

  updateRevopsOfferSilent(offerId, field, value) {
    const config = this._revopsEnsureConfig();
    if (!config) return;
    config.offers = (config.offers || []).map(offer => {
      if (offer.id !== offerId) return offer;
      return { ...offer, [field]: field === 'name' ? value : RevopsFinanceEngine.number(value) };
    });
    App.save();
  },

  updateRevopsOffer(offerId, field, value) {
    this.updateRevopsOfferSilent(offerId, field, value);
    App.render();
  },

  toggleRevopsOfferSelected(offerId) {
    const config = this._revopsEnsureConfig();
    if (!config) return;
    config.offers = (config.offers || []).map(offer => offer.id === offerId ? { ...offer, selectedForTicket: !offer.selectedForTicket } : offer);
    App.save(); App.render();
  },

  setRevopsTicketMode(mode) {
    const config = this._revopsEnsureConfig();
    if (!config) return;
    config.ticketMode = ['weighted', 'manual', 'sumSelected'].includes(mode) ? mode : 'weighted';
    App.save(); App.render();
  },

  updateRevopsTicketManualValueSilent(value) {
    const config = this._revopsEnsureConfig();
    if (!config) return;
    config.ticketManualValue = RevopsFinanceEngine.number(value);
    App.save();
  },

  updateRevopsTicketManualValue(value) {
    this.updateRevopsTicketManualValueSilent(value);
    App.render();
  },

  openRevopsFixedCostsModal(category) {
    const valid = RevopsFinanceEngine.FIXED_CATEGORIES.some(c => c.id === category);
    if (!valid) return;
    const config = this._revopsEnsureConfig();
    if (!config) return Utils.toast('Selecione um produto.');
    App.state.showRevopsFixedCostsModal = true;
    App.state.revopsFixedCostsCategory = category;
    App.save(); App.render();
  },

  closeRevopsFixedCostsModal() {
    App.state.showRevopsFixedCostsModal = false;
    App.state.revopsFixedCostsCategory = null;
    App.save(); App.render();
  },

  // ─────────────────────────────────────────────────────────────
  // V32.8.1 — RevOps Whitelabel (Onda 2): actions do painel novo.
  // ─────────────────────────────────────────────────────────────

  // Helper interno: pega config V2 do produto, garante que existe (migra do
  // legacy se ainda não), aplica mutador, salva. Mutador recebe a config e
  // retorna a versão modificada (ou só muta in-place).
  _revopsV2Mutate(productId, mutator) {
    if (!productId) return;
    const pid = String(productId);
    if (!App.state.revopsFinanceV2) App.state.revopsFinanceV2 = {};
    let cfg = App.state.revopsFinanceV2[pid];
    if (!cfg) {
      const legacy = App.state.revopsFinance?.[pid];
      cfg = legacy ? RevopsWhitelabelEngine.migrateFromLegacy(legacy) : RevopsWhitelabelEngine.defaultConfig(pid);
      cfg.productId = pid;
    }
    const next = mutator(cfg) || cfg;
    App.state.revopsFinanceV2[pid] = next;
    App.save(); App.render();
  },

  setRevopsActiveProductId(productId) {
    App.state.revopsSelectedProductId = productId ? Number(productId) : null;
    App.save(); App.render();
  },

  // V38.1.1 — Entra na governança de um produto específico vindo do Overview.
  selectRevopsProduct(productId) {
    App.state.revopsSelectedProductId = Number(productId);
    App.save(); App.render();
  },

  // V38.1.1 — Volta pro Overview consolidado (todos produtos).
  backToRevopsOverview() {
    App.state.revopsSelectedProductId = null;
    App.save(); App.render();
  },

  setRevopsWhitelabelTab(tabId) {
    App.state.revopsWhitelabelActiveTab = String(tabId || 'costs');
    App.save(); App.render();
  },

  toggleRevopsClassicMode() {
    App.state.revopsClassicMode = !App.state.revopsClassicMode;
    App.save(); App.render();
  },

  // V32.8.2 — Toggle Modo Builder (A) ↔ Modo Excel (B) na tab Custos.
  setRevopsExcelMode(on) {
    App.state.revopsExcelMode = !!on;
    App.save(); App.render();
  },

  // V32.8.3 — Pede análise contextual do Djow pra uma tab do RevOps Whitelabel.
  // One-shot: backend chama Claude Haiku c/ resumo enxuto, retorna 3-5 frases.
  // Cache em App.state.revopsDjowSuggestions[tabId] — cliente clica explicit
  // pra refrescar (evita custo de tokens automático).
  async askRevopsDjow(productId, tabId) {
    if (!productId || !tabId) return;
    const pid = String(productId);
    const cfg = App.state.revopsFinanceV2?.[pid];
    if (!cfg) return Utils.toast('Configure o RevOps deste produto primeiro.');
    const ev = window.RevopsWhitelabelEngine?.evaluate(cfg);
    if (!ev) return Utils.toast('Engine RevOps não carregada.');

    // Set loading
    App.state.revopsDjowSuggestions = {
      ...(App.state.revopsDjowSuggestions || {}),
      [tabId]: { loading: true, suggestion: null, askedAt: null, error: null }
    };
    App.render();

    // Monta resumo compacto pro Claude (limita tokens trafegados)
    const product = (App.state.products || []).find(p => Number(p.id) === Number(pid));
    const lines = [];
    lines.push(`Produto: ${product?.name || pid} (período: ${cfg.period})`);
    lines.push(`Vendas previstas: ${ev.sales} · Ticket: R$${ev.ticket.toFixed(2)}`);
    lines.push(`Fat Bruto: R$${ev.fatBruto.toFixed(0)} · Fat Líquido: R$${ev.fatLiquido.toFixed(0)} · EBITDA: R$${ev.ebitda.toFixed(0)} (${ev.ebitdaMargin.toFixed(1)}%)`);
    lines.push(`Totais: G&A R$${ev.fixedTotal.toFixed(0)} · Aquisição R$${ev.acquisitionTotal.toFixed(0)} · Variáveis R$${ev.variableTotal.toFixed(0)}`);
    lines.push('');
    lines.push('GRUPOS DE CUSTOS:');
    (cfg.groups || []).forEach(g => {
      const t = ev.groupTotals[g.id] || 0;
      lines.push(`- [${g.bucket}] ${g.label} (total R$${t.toFixed(0)}):`);
      (g.items || []).forEach(it => {
        const v = ev.itemValues[it.id] || 0;
        const calcDesc = it.calc?.mode === 'fixed' ? `R$${it.calc.value || 0}`
                       : it.calc?.mode === 'percent_of' ? `${it.calc.factor}% de ${it.calc.base}`
                       : it.calc?.mode === 'percent_self' ? `${it.calc.factor}% de R$${it.calc.baseValue}`
                       : it.calc?.mode === 'derived' ? `total de ${it.calc.groupRef}`
                       : it.calc?.mode === 'custom_formula' ? `fórmula: ${it.calc.formula}`
                       : '?';
        lines.push(`  • ${it.name} = ${calcDesc} → R$${v.toFixed(0)}`);
      });
    });
    lines.push('');
    lines.push('OFERTAS:');
    (cfg.offers || []).forEach(o => {
      lines.push(`- ${o.name}: R$${o.price} (mix ${o.mix}%${o.selectedForTicket ? ', conta no TM' : ''})`);
    });
    if ((cfg.customKpis || []).length) {
      lines.push('');
      lines.push('KPIs CUSTOM:');
      (cfg.customKpis || []).forEach(k => {
        const v = ev.customKpiValues?.[k.id] || 0;
        lines.push(`- ${k.name}: ${k.formula} → ${v.toFixed(2)} ${k.unit}`);
      });
    }
    const summary = lines.join('\n');

    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/djow-revops-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ product_id: pid, tab_id: tabId, summary })
      });
      const data = await r.json();
      if (!data.ok) {
        App.state.revopsDjowSuggestions[tabId] = { loading: false, suggestion: null, askedAt: null, error: data.message || 'Erro Djow' };
        App.render();
        return;
      }
      App.state.revopsDjowSuggestions[tabId] = {
        loading: false,
        suggestion: data.suggestion,
        askedAt: new Date().toISOString(),
        error: null
      };
      App.save(); App.render();
    } catch (err) {
      App.state.revopsDjowSuggestions[tabId] = { loading: false, suggestion: null, askedAt: null, error: err.message };
      App.render();
    }
  },

  clearRevopsDjowSuggestion(tabId) {
    if (!App.state.revopsDjowSuggestions) return;
    delete App.state.revopsDjowSuggestions[tabId];
    App.save(); App.render();
  },

  // V32.8.4 — Simulator inline. Toggle on/off + overrides voláteis pra cliente
  // testar "e se vendas fossem +20%? E se ticket fosse R$X?". Sem persistir
  // no cfg (não polui o real). Δ vs baseline mostrado nos cards de Resultado.
  toggleRevopsSimulator() {
    if (!App.state.revopsSimulator) App.state.revopsSimulator = { salesOverride: null, ticketOverride: null, active: false };
    App.state.revopsSimulator.active = !App.state.revopsSimulator.active;
    if (!App.state.revopsSimulator.active) {
      // Limpa overrides ao desligar
      App.state.revopsSimulator.salesOverride = null;
      App.state.revopsSimulator.ticketOverride = null;
    }
    App.save(); App.render();
  },

  setRevopsSimulatorOverride(field, value) {
    if (!App.state.revopsSimulator) App.state.revopsSimulator = { salesOverride: null, ticketOverride: null, active: false };
    const numeric = value === '' || value == null ? null : Number(value);
    if (field === 'salesOverride' || field === 'ticketOverride') {
      App.state.revopsSimulator[field] = Number.isFinite(numeric) ? numeric : null;
    }
    App.save(); App.render();
  },

  resetRevopsSimulator() {
    App.state.revopsSimulator = { salesOverride: null, ticketOverride: null, active: false };
    App.save(); App.render();
  },

  // V32.8.5 — Salva os overrides atuais do simulator como cenário nomeado.
  // Cenário é puro snapshot: sales/ticket overrides + nome + timestamp.
  // Custos do cfg NÃO entram (cliente preserva como referência viva).
  saveRevopsScenario(productId, name) {
    if (!productId) return Utils.toast('Sem produto ativo.');
    const sim = App.state.revopsSimulator;
    if (!sim || !sim.active) return Utils.toast('Ative o Simulador antes de salvar cenário.');
    const cleanName = String(name || '').trim();
    if (!cleanName) return Utils.toast('Dê um nome pro cenário.');
    const pid = String(productId);
    if (!App.state.revopsScenarios) App.state.revopsScenarios = {};
    if (!App.state.revopsScenarios[pid]) App.state.revopsScenarios[pid] = [];
    App.state.revopsScenarios[pid].push({
      id: `sc_${Date.now().toString(36)}`,
      name: cleanName.slice(0, 64),
      salesOverride: sim.salesOverride,
      ticketOverride: sim.ticketOverride,
      savedAt: new Date().toISOString()
    });
    App.save(); App.render();
    Utils.toast(`✓ Cenário "${cleanName}" salvo.`);
  },

  loadRevopsScenario(productId, scenarioId) {
    const pid = String(productId);
    const sc = (App.state.revopsScenarios?.[pid] || []).find(s => s.id === scenarioId);
    if (!sc) return;
    App.state.revopsSimulator = {
      active: true,
      salesOverride: sc.salesOverride,
      ticketOverride: sc.ticketOverride
    };
    App.save(); App.render();
    Utils.toast(`Cenário "${sc.name}" carregado no Simulador.`);
  },

  deleteRevopsScenario(productId, scenarioId) {
    const pid = String(productId);
    if (!App.state.revopsScenarios?.[pid]) return;
    App.state.revopsScenarios[pid] = App.state.revopsScenarios[pid].filter(s => s.id !== scenarioId);
    // Limpa seleção se cenário deletado estava sendo comparado
    const sel = App.state.revopsCompareSelection || {};
    if (sel.left === scenarioId) sel.left = null;
    if (sel.right === scenarioId) sel.right = null;
    App.state.revopsCompareSelection = sel;
    App.save(); App.render();
  },

  setRevopsCompareSlot(slot, scenarioId) {
    if (!App.state.revopsCompareSelection) App.state.revopsCompareSelection = { left: null, right: null };
    if (slot === 'left' || slot === 'right') {
      App.state.revopsCompareSelection[slot] = scenarioId || null;
    }
    App.save(); App.render();
  },

  clearRevopsCompare() {
    App.state.revopsCompareSelection = { left: null, right: null };
    App.save(); App.render();
  },

  // V32.10.0 — Override de MCU/MSU na tab RevOps (cascata).
  // Cliente pode escolher modo single ('manual') ou múltiplas deduções ('composed').
  // Helper interno: get-or-init override do produto+kpi.
  _revopsGetOverride(productId, kpi) {
    if (!App.state.revopsKpiOverrides) App.state.revopsKpiOverrides = {};
    const pid = String(productId);
    if (!App.state.revopsKpiOverrides[pid]) App.state.revopsKpiOverrides[pid] = {};
    if (!App.state.revopsKpiOverrides[pid][kpi]) {
      App.state.revopsKpiOverrides[pid][kpi] = { mode: 'auto', value: null, components: [] };
    }
    return App.state.revopsKpiOverrides[pid][kpi];
  },

  setRevopsKpiOverrideMode(productId, kpi, mode) {
    const o = Actions._revopsGetOverride(productId, kpi);
    o.mode = ['auto', 'manual', 'composed'].includes(mode) ? mode : 'auto';
    if (o.mode === 'composed' && !Array.isArray(o.components)) o.components = [];
    if (o.mode === 'manual' && (o.value == null || o.value === '')) o.value = '';
    App.save(); App.render();
  },

  setRevopsKpiOverrideValue(productId, kpi, value) {
    const o = Actions._revopsGetOverride(productId, kpi);
    o.value = value;
    App.save(); App.render();
  },

  addRevopsKpiComponent(productId, kpi) {
    const o = Actions._revopsGetOverride(productId, kpi);
    o.mode = 'composed';
    if (!Array.isArray(o.components)) o.components = [];
    o.components.push({ name: 'Nova dedução', value: '0' });
    App.save(); App.render();
  },

  updateRevopsKpiComponent(productId, kpi, index, field, value) {
    const o = Actions._revopsGetOverride(productId, kpi);
    if (!Array.isArray(o.components) || !o.components[index]) return;
    o.components[index][field] = String(value || '');
    App.save();
    // não render — evita perder foco em input. Re-render via onchange.
  },

  // V36.8.5 — Aplica correção de escala numa linha (substitui fat_bruto/fat_liquido
  // por tm). Usado pelo botão "Aplicar correção" da linha amber.
  applyRevopsScaleFix(productId, kpi, index) {
    const o = Actions._revopsGetOverride(productId, kpi);
    if (!Array.isArray(o.components) || !o.components[index]) return;
    const c = o.components[index];
    const raw = String(c.value || '').trim();
    if (!raw.startsWith('=')) return; // só fórmulas
    c.value = raw.replace(/\b(fat_bruto|fat_liquido)\b/gi, 'tm');
    App.save();
    App.render();
    Utils.toast('✓ Fórmula corrigida pra contexto unitário.');
  },

  // V36.8.5 — Aplica correção em TODAS as linhas com fat_bruto/fat_liquido do KPI.
  // Botão "Corrigir todas" no banner do topo da Composição.
  applyAllRevopsScaleFixes(productId, kpi) {
    const o = Actions._revopsGetOverride(productId, kpi);
    if (!Array.isArray(o.components)) return;
    let fixed = 0;
    o.components.forEach(c => {
      const raw = String(c.value || '').trim();
      if (raw.startsWith('=') && /\b(fat_bruto|fat_liquido)\b/i.test(raw)) {
        c.value = raw.replace(/\b(fat_bruto|fat_liquido)\b/gi, 'tm');
        fixed++;
      }
    });
    if (!fixed) return;
    App.save();
    App.render();
    Utils.toast(`✓ ${fixed} fórmula(s) corrigida(s) pra contexto unitário.`);
  },

  // V32.10.3 — Swap fórmula do campo Nome pro campo Valor (cliente confundiu).
  // Detecção: nome começa com '=' ou contém handle conhecido. Botão "Mover →"
  // dispara isso, move o conteúdo, limpa o nome (cliente renomeia depois).
  moveRevopsComponentFormulaToValue(productId, kpi, index) {
    const o = Actions._revopsGetOverride(productId, kpi);
    if (!Array.isArray(o.components) || !o.components[index]) return;
    const c = o.components[index];
    c.value = c.name || c.value;
    c.name = ''; // cliente renomeia manualmente
    App.save(); App.render();
  },

  deleteRevopsKpiComponent(productId, kpi, index) {
    const o = Actions._revopsGetOverride(productId, kpi);
    if (!Array.isArray(o.components)) return;
    o.components.splice(index, 1);
    App.save(); App.render();
  },

  resetRevopsKpiOverride(productId, kpi) {
    const o = Actions._revopsGetOverride(productId, kpi);
    o.mode = 'auto';
    o.value = null;
    o.components = [];
    App.save(); App.render();
  },

  // V32.10.7 — Handle picker (olhinho): toggla painel com lista de handles
  // disponíveis (tm, ticket, sales, mcu, etc) ao lado de qualquer input de
  // fórmula. Estado UI volátil (não persiste).
  toggleRevopsHandlePicker(pickerKey) {
    const cur = App.state.revopsHandlePickerKey;
    App.state.revopsHandlePickerKey = (cur === pickerKey) ? null : String(pickerKey);
    App.render();
  },

  // V32.10.7 — Copia handle pro clipboard. Cliente cola no input de fórmula.
  // Fallback execCommand pra contextos sem Clipboard API (iframes restritos etc).
  async copyRevopsHandle(handleId) {
    const id = String(handleId || '').trim();
    if (!id) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(id);
      } else {
        const ta = document.createElement('textarea');
        ta.value = id;
        ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select(); document.execCommand('copy');
        document.body.removeChild(ta);
      }
      Utils.toast(`✓ "${id}" copiado — cole na fórmula (ex: =${id}*0,15)`);
    } catch (err) {
      Utils.toast(`Falha ao copiar: ${err.message}`);
    }
  },

  // ─────────────────────────────────────────────────────────────
  // V32.10.9 — DRE FLEX (Felipe formato planilha)
  // ─────────────────────────────────────────────────────────────
  //
  // Cliente insere linhas extras entre fases da DRE (FB → Deduções → VL →
  // LB → S&M → G&A → LL). Cada extra tem nome + valor (handle ou número) +
  // sinal (+/−). Persiste em revopsFinanceV2.{productId}.dreExtraLines.

  addDreExtraLine(productId, afterStep) {
    Actions._revopsV2Mutate(productId, cfg => {
      if (!Array.isArray(cfg.dreExtraLines)) cfg.dreExtraLines = [];
      const step = String(afterStep || 'lucro_bruto');
      // V36.13.5 — Fix crítico: pra 'deducoes_inside', signal default '+' (item
      // SOMA à categoria deduções). Antes era '-' que invertia matemática e
      // fazia Lucro Líquido inflar. Outros afterStep mantêm '-' (custo extra
      // entre fases por default).
      const defaultSignal = step === 'deducoes_inside' ? '+' : '-';
      cfg.dreExtraLines.push({
        id: `dre_${Date.now().toString(36).slice(-4)}_${Math.random().toString(36).slice(2,5)}`,
        name: '',
        value: '',
        signal: defaultSignal,
        afterStep: step
      });
    });
  },

  updateDreExtraLine(productId, lineId, field, value) {
    Actions._revopsV2Mutate(productId, cfg => {
      const line = (cfg.dreExtraLines || []).find(l => l.id === lineId);
      if (!line) return;
      if (field === 'signal') line.signal = value === '+' ? '+' : '-';
      else if (field === 'name') line.name = String(value || '');
      else if (field === 'value') line.value = String(value || '');
    });
  },

  deleteDreExtraLine(productId, lineId) {
    Actions._revopsV2Mutate(productId, cfg => {
      cfg.dreExtraLines = (cfg.dreExtraLines || []).filter(l => l.id !== lineId);
    });
  },

  // V36.13.0 — CRUD de grupos extras (linha-banner laranja + cards filhos).
  addDreExtraGroup(productId, afterStep) {
    Actions._revopsV2Mutate(productId, cfg => {
      if (!Array.isArray(cfg.dreExtraGroups)) cfg.dreExtraGroups = [];
      cfg.dreExtraGroups.push({
        id: `dreg_${Date.now().toString(36).slice(-4)}_${Math.random().toString(36).slice(2,5)}`,
        name: '',
        signal: '+',
        afterStep: String(afterStep || 'lucro_bruto'),
        items: []
      });
    });
  },

  updateDreExtraGroup(productId, groupId, field, value) {
    Actions._revopsV2Mutate(productId, cfg => {
      const g = (cfg.dreExtraGroups || []).find(x => x.id === groupId);
      if (!g) return;
      if (field === 'signal') g.signal = value === '+' ? '+' : '-';
      else if (field === 'name') g.name = String(value || '');
    });
  },

  deleteDreExtraGroup(productId, groupId) {
    Actions._revopsV2Mutate(productId, cfg => {
      cfg.dreExtraGroups = (cfg.dreExtraGroups || []).filter(g => g.id !== groupId);
    });
  },

  addDreExtraGroupItem(productId, groupId) {
    Actions._revopsV2Mutate(productId, cfg => {
      const g = (cfg.dreExtraGroups || []).find(x => x.id === groupId);
      if (!g) return;
      if (!Array.isArray(g.items)) g.items = [];
      g.items.push({
        id: `dregi_${Date.now().toString(36).slice(-4)}_${Math.random().toString(36).slice(2,5)}`,
        name: '',
        value: ''
      });
    });
  },

  updateDreExtraGroupItem(productId, groupId, itemId, field, value) {
    Actions._revopsV2Mutate(productId, cfg => {
      const g = (cfg.dreExtraGroups || []).find(x => x.id === groupId);
      if (!g) return;
      const it = (g.items || []).find(i => i.id === itemId);
      if (!it) return;
      if (field === 'name') it.name = String(value || '');
      else if (field === 'value') it.value = String(value || '');
    });
  },

  deleteDreExtraGroupItem(productId, groupId, itemId) {
    Actions._revopsV2Mutate(productId, cfg => {
      const g = (cfg.dreExtraGroups || []).find(x => x.id === groupId);
      if (!g) return;
      g.items = (g.items || []).filter(i => i.id !== itemId);
    });
  },

  toggleRevopsDreGroupMenu(groupId) {
    App.state.revopsDreGroupMenuOpen = (App.state.revopsDreGroupMenuOpen === groupId) ? null : groupId;
    App.save(); App.render();
  },

  toggleDreDeducoesExpanded(productId) {
    if (!App.state.revopsDreDeducoesExpanded) App.state.revopsDreDeducoesExpanded = {};
    const cur = !!App.state.revopsDreDeducoesExpanded[productId];
    App.state.revopsDreDeducoesExpanded[productId] = !cur;
    App.save(); App.render();
  },

  // V32.12.1 — Toggle da faixa "Performance Externa" no card de Campanha.
  // Persiste por campanha; backend (Meta/Google/Stripe) chega na V32.12.2+.
  toggleCampaignPerfExpanded(campaignId) {
    if (!App.state.campaignPerfExpanded) App.state.campaignPerfExpanded = {};
    const cur = !!App.state.campaignPerfExpanded[campaignId];
    App.state.campaignPerfExpanded[campaignId] = !cur;
    App.save(); App.render();
  },

  // V32.9.4 — Collapse/Lock por grupo no RevOps.
  // Collapse: UI state, qualquer click expande. Lock: persistido, pede senha
  // do user logado pra destravar (anti edição acidental em login compartilhado).
  toggleRevopsGroupCollapsed(groupId) {
    if (!App.state.revopsGroupCollapsed) App.state.revopsGroupCollapsed = {};
    // Não permite expandir se trancado
    if (App.state.revopsGroupLocked?.[groupId]) {
      return Actions.requestUnlockRevopsGroup(groupId);
    }
    App.state.revopsGroupCollapsed[groupId] = !App.state.revopsGroupCollapsed[groupId];
    App.save(); App.render();
  },

  lockRevopsGroup(groupId) {
    if (!App.state.revopsGroupLocked) App.state.revopsGroupLocked = {};
    if (!App.state.revopsGroupCollapsed) App.state.revopsGroupCollapsed = {};
    App.state.revopsGroupLocked[groupId] = true;
    App.state.revopsGroupCollapsed[groupId] = true;  // lock força collapse
    App.save(); App.render();
    Utils.toast('🔒 Grupo trancado. Só destrava com sua senha de login.');
  },

  // Pede senha via prompt e valida no backend. Se ok, destrava.
  async requestUnlockRevopsGroup(groupId) {
    const pwd = prompt('Senha do seu login pra destravar este grupo:');
    if (!pwd) return; // cancelou
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/auth-verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password: pwd })
      });
      const data = await r.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      if (!data.valid) {
        if (data.code === 'no_password') {
          return Utils.toast(data.message || 'Você não tem senha cadastrada.');
        }
        return Utils.toast('Senha incorreta.');
      }
      // Senha correta — destrava
      if (!App.state.revopsGroupLocked) App.state.revopsGroupLocked = {};
      if (!App.state.revopsGroupCollapsed) App.state.revopsGroupCollapsed = {};
      App.state.revopsGroupLocked[groupId] = false;
      App.state.revopsGroupCollapsed[groupId] = false;
      App.save(); App.render();
      Utils.toast('🔓 Grupo destravado.');
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V32.8.2 — Save direto de fórmula via Modo Excel. Vira custom_formula.
  // Se a fórmula puder ser reduzida pra um modo Builder mais simples (ex:
  // só um número), simplifica de volta — preserva A/B sync transparente.
  saveRevopsExcelFormula(productId, groupId, itemId, formula) {
    Actions._revopsV2Mutate(productId, cfg => {
      const g = (cfg.groups || []).find(x => x.id === groupId);
      const it = g?.items?.find(i => i.id === itemId);
      if (!it) return;
      const raw = String(formula || '').trim().replace(/^=/, '').trim();
      // Reduz pra fixed se for puramente numérico (ex: "=115.29")
      const asNum = Number(raw.replace(',', '.'));
      if (Number.isFinite(asNum) && /^-?[0-9.]+$/.test(raw.replace(/\s/g, ''))) {
        it.calc = { mode: 'fixed', value: asNum };
      } else {
        it.calc = { mode: 'custom_formula', formula: `=${raw}` };
      }
    });
  },

  setRevopsWhitelabelPeriod(productId, period) {
    Actions._revopsV2Mutate(productId, cfg => {
      cfg.period = ['monthly', 'quarterly', 'yearly'].includes(period) ? period : 'monthly';
    });
  },

  setRevopsSalesProjection(productId, value) {
    Actions._revopsV2Mutate(productId, cfg => {
      cfg.salesProjection = Number(value) || 0;
    });
  },

  // GRUPOS
  addRevopsGroup(productId, bucket) {
    Actions._revopsV2Mutate(productId, cfg => {
      const labels = { fixed: 'Novo grupo fixo', acquisition: 'Nova origem de aquisição', variable: 'Novo custo variável', custom: 'Novo grupo custom' };
      const g = RevopsWhitelabelEngine.emptyGroup(labels[bucket] || 'Novo grupo', bucket);
      cfg.groups = [...(cfg.groups || []), g];
    });
  },

  renameRevopsGroup(productId, groupId, newLabel) {
    Actions._revopsV2Mutate(productId, cfg => {
      const g = (cfg.groups || []).find(x => x.id === groupId);
      if (g) g.label = String(newLabel || g.label).trim();
    });
  },

  deleteRevopsGroup(productId, groupId) {
    Actions._revopsV2Mutate(productId, cfg => {
      cfg.groups = (cfg.groups || []).filter(g => g.id !== groupId);
    });
  },

  // ITEMS
  addRevopsItem(productId, groupId) {
    Actions._revopsV2Mutate(productId, cfg => {
      const g = (cfg.groups || []).find(x => x.id === groupId);
      if (g) g.items = [...(g.items || []), RevopsWhitelabelEngine.emptyItem('Novo item')];
    });
  },

  renameRevopsItem(productId, groupId, itemId, newName) {
    Actions._revopsV2Mutate(productId, cfg => {
      const g = (cfg.groups || []).find(x => x.id === groupId);
      const it = g?.items?.find(i => i.id === itemId);
      if (!it) return;
      // V35.9.1 — Items travados (auto-gerados pelo LJ) não podem ser renomeados.
      if (it.locked) { Utils.toast('Esse item é gerenciado pelo LJ. Pra alterar, desvincule as campanhas Ads.'); return; }
      it.name = String(newName || it.name).trim();
    });
  },

  deleteRevopsItem(productId, groupId, itemId) {
    Actions._revopsV2Mutate(productId, cfg => {
      const g = (cfg.groups || []).find(x => x.id === groupId);
      if (!g) return;
      // V35.9.1 — Bloqueia delete de items travados.
      const target = (g.items || []).find(i => i.id === itemId);
      if (target?.locked) { Utils.toast('Esse item é gerenciado pelo LJ. Pra removê-lo, desvincule as campanhas Ads.'); return; }
      g.items = (g.items || []).filter(i => i.id !== itemId);
    });
  },

  changeRevopsItemMode(productId, groupId, itemId, mode) {
    Actions._revopsV2Mutate(productId, cfg => {
      const g = (cfg.groups || []).find(x => x.id === groupId);
      const it = g?.items?.find(i => i.id === itemId);
      if (!it) return;
      // V35.9.1 — Items travados não permitem troca de modo de cálculo.
      if (it.locked) { Utils.toast('Esse item é gerenciado pelo LJ — modo de cálculo travado.'); return; }
      it.calc = RevopsWhitelabelEngine.emptyCalc(mode);
    });
  },

  updateRevopsItemCalc(productId, groupId, itemId, field, value) {
    Actions._revopsV2Mutate(productId, cfg => {
      const g = (cfg.groups || []).find(x => x.id === groupId);
      const it = g?.items?.find(i => i.id === itemId);
      if (!it || !it.calc) return;
      // V35.9.1 — Items travados não permitem update manual de valor.
      if (it.locked) return;
      // Numéricos: coerce. Strings (base, groupRef, formula): direto.
      const numericFields = ['value', 'factor', 'baseValue'];
      it.calc[field] = numericFields.includes(field) ? (Number(value) || 0) : String(value || '');
    });
  },

  // OFFERS
  addRevopsOffer(productId) {
    Actions._revopsV2Mutate(productId, cfg => {
      // V38.0.3 — Usa defaultOffer (com kind e metaVendas zerados). Nome
      // "Nova oferta" como hoje, cliente renomeia.
      const o = window.RevopsWhitelabelEngine?.defaultOffer
        ? RevopsWhitelabelEngine.defaultOffer('Nova oferta', 0)
        : { id: `offer_${Date.now().toString(36).slice(-4)}`, name: 'Nova oferta', price: 0, mix: 0, selectedForTicket: true, kind: 'main', metaVendas: 0 };
      cfg.offers = [...(cfg.offers || []), o];
    });
  },

  renameRevopsOffer(productId, offerId, name) {
    Actions._revopsV2Mutate(productId, cfg => {
      const o = (cfg.offers || []).find(x => x.id === offerId);
      if (o) o.name = String(name || o.name).trim();
    });
  },

  updateRevopsOfferField(productId, offerId, field, value) {
    Actions._revopsV2Mutate(productId, cfg => {
      const o = (cfg.offers || []).find(x => x.id === offerId);
      if (!o) return;
      // V38.0.3 — kind é string enum, demais campos são numéricos.
      if (field === 'kind') {
        o.kind = ['main', 'cross-sell', 'up-sell', 'down-sell'].includes(value) ? value : 'main';
      } else {
        o[field] = Number(value) || 0;
      }
    });
  },

  toggleRevopsOfferTicket(productId, offerId) {
    Actions._revopsV2Mutate(productId, cfg => {
      const o = (cfg.offers || []).find(x => x.id === offerId);
      if (o) o.selectedForTicket = !o.selectedForTicket;
    });
  },

  deleteRevopsOffer(productId, offerId) {
    Actions._revopsV2Mutate(productId, cfg => {
      cfg.offers = (cfg.offers || []).filter(o => o.id !== offerId);
    });
  },

  setRevopsTicketMode(productId, mode) {
    Actions._revopsV2Mutate(productId, cfg => {
      cfg.ticketMode = mode === 'manual' ? 'manual' : 'weighted';
    });
  },

  setRevopsTicketManual(productId, value) {
    Actions._revopsV2Mutate(productId, cfg => {
      cfg.ticketManualValue = Number(value) || 0;
    });
  },

  // CUSTOM KPIs
  addRevopsCustomKpi(productId) {
    Actions._revopsV2Mutate(productId, cfg => {
      cfg.customKpis = [...(cfg.customKpis || []), {
        id: `kpi_${Date.now().toString(36).slice(-4)}`,
        name: 'Novo KPI',
        formula: '=0',
        unit: 'BRL'
      }];
    });
  },

  updateRevopsCustomKpi(productId, kpiId, field, value) {
    Actions._revopsV2Mutate(productId, cfg => {
      const k = (cfg.customKpis || []).find(x => x.id === kpiId);
      if (k) k[field] = String(value || '');
    });
  },

  deleteRevopsCustomKpi(productId, kpiId) {
    Actions._revopsV2Mutate(productId, cfg => {
      cfg.customKpis = (cfg.customKpis || []).filter(k => k.id !== kpiId);
    });
  },

  openRevopsAcquisitionModal() {
    const config = this._revopsEnsureConfig();
    if (!config) return Utils.toast('Selecione um produto.');
    if (!config.acquisitionCosts) config.acquisitionCosts = { items: [] };
    App.state.showRevopsAcquisitionModal = true;
    App.save(); App.render();
  },

  closeRevopsAcquisitionModal() {
    App.state.showRevopsAcquisitionModal = false;
    App.save(); App.render();
  },

  addRevopsAcquisitionItem() {
    const config = this._revopsEnsureConfig();
    if (!config) return;
    if (!config.acquisitionCosts) config.acquisitionCosts = { items: [] };
    config.acquisitionCosts.items = [...(config.acquisitionCosts.items || []), RevopsFinanceEngine.emptyAcquisitionItem()];
    App.save(); App.render();
  },

  removeRevopsAcquisitionItem(itemId) {
    const config = this._revopsEnsureConfig();
    if (!config || !config.acquisitionCosts) return;
    // V35.9.0 — Bloqueia delete manual de items travados (auto-gerados pelo LJ).
    const target = (config.acquisitionCosts.items || []).find(it => it.id === itemId);
    if (target?.locked) {
      Utils.toast('Esse item é gerenciado pelo LJ. Pra removê-lo, desvincule as campanhas Ads.');
      return;
    }
    config.acquisitionCosts.items = (config.acquisitionCosts.items || []).filter(item => item.id !== itemId);
    App.save(); App.render();
  },

  updateRevopsAcquisitionItemSilent(itemId, field, value) {
    const config = this._revopsEnsureConfig();
    if (!config || !config.acquisitionCosts) return;
    config.acquisitionCosts.items = (config.acquisitionCosts.items || []).map(item => {
      if (item.id !== itemId) return item;
      // V35.9.0 — Ignora updates em items travados (auto-gerados).
      if (item.locked) return item;
      return { ...item, [field]: field === 'name' ? value : RevopsFinanceEngine.number(value) };
    });
    App.save();
  },

  addRevopsFixedItem(category) {
    const config = this._revopsEnsureConfig();
    if (!config) return;
    const cat = config.fixedCosts?.[category];
    if (!cat) return;
    cat.items = [...(cat.items || []), RevopsFinanceEngine.emptyFixedItem()];
    App.save(); App.render();
  },

  removeRevopsFixedItem(category, itemId) {
    const config = this._revopsEnsureConfig();
    if (!config) return;
    const cat = config.fixedCosts?.[category];
    if (!cat) return;
    cat.items = (cat.items || []).filter(item => item.id !== itemId);
    App.save(); App.render();
  },

  updateRevopsFixedItemSilent(category, itemId, field, value) {
    const config = this._revopsEnsureConfig();
    if (!config) return;
    const cat = config.fixedCosts?.[category];
    if (!cat) return;
    cat.items = (cat.items || []).map(item => {
      if (item.id !== itemId) return item;
      return { ...item, [field]: field === 'name' ? value : RevopsFinanceEngine.number(value) };
    });
    App.save();
  },

  addRevopsVariableCost() {
    const config = this._revopsEnsureConfig();
    if (!config) return Utils.toast('Selecione um produto.');
    config.variableCosts = [...(config.variableCosts || []), RevopsFinanceEngine.emptyVariableCost()];
    App.save(); App.render();
  },

  removeRevopsVariableCost(itemId) {
    const config = this._revopsEnsureConfig();
    if (!config) return;
    config.variableCosts = (config.variableCosts || []).filter(item => item.id !== itemId);
    App.save(); App.render();
  },

  updateRevopsVariableCostSilent(itemId, field, value) {
    const config = this._revopsEnsureConfig();
    if (!config) return;
    config.variableCosts = (config.variableCosts || []).map(item => {
      if (item.id !== itemId) return item;
      if (field === 'name') return { ...item, name: value };
      if (field === 'value') return { ...item, value: RevopsFinanceEngine.number(value) };
      return item;
    });
    App.save();
  },

  updateRevopsVariableCost(itemId, field, value) {
    const config = this._revopsEnsureConfig();
    if (!config) return;
    config.variableCosts = (config.variableCosts || []).map(item => {
      if (item.id !== itemId) return item;
      if (field === 'type') return { ...item, type: ['percent', 'fixed'].includes(value) ? value : 'percent' };
      if (field === 'appliesTo') return { ...item, appliesTo: ['grossRevenue', 'netRevenue', 'afterFixed'].includes(value) ? value : 'grossRevenue' };
      if (field === 'value') return { ...item, value: RevopsFinanceEngine.number(value) };
      return { ...item, [field]: value };
    });
    App.save(); App.render();
  },

  updateRevopsPeriod(period) {
    const config = this._revopsEnsureConfig();
    if (!config) return;
    config.period = ['monthly', 'quarterly', 'yearly'].includes(period) ? period : 'monthly';
    App.save(); App.render();
  },

  updateRevopsSalesProjectionSilent(value) {
    const config = this._revopsEnsureConfig();
    if (!config) return;
    config.salesProjection = RevopsFinanceEngine.number(value);
    App.save();
  },

  updateRevopsSalesProjection(value) {
    this.updateRevopsSalesProjectionSilent(value);
    App.render();
  },

  saveRevopsConfig() {
    const config = this._revopsEnsureConfig();
    if (!config) return Utils.toast('Selecione um produto antes de salvar.');
    config.savedAt = new Date().toISOString();
    App.save(); App.render();
    Utils.toast('Configuração operacional do produto salva.');
  },

  openRevopsSimulation() {
    const config = this._revopsEnsureConfig();
    if (!config) return Utils.toast('Selecione um produto para simular.');
    App.state.revopsSimulationDraft = JSON.parse(JSON.stringify(config));
    App.state.revopsSimulationLoadedScenarioId = null;
    App.state.showRevopsSimulationModal = true;
    App.save(); App.render();
  },

  closeRevopsSimulation() {
    App.state.showRevopsSimulationModal = false;
    App.state.revopsSimulationDraft = null;
    App.state.revopsSimulationLoadedScenarioId = null;
    App.save(); App.render();
  },

  resetRevopsSimulation() {
    const productId = App.state.revopsSelectedProductId;
    const original = (App.state.revopsFinance || {})[productId];
    App.state.revopsSimulationDraft = original ? JSON.parse(JSON.stringify(original)) : RevopsFinanceEngine.defaultConfig(productId);
    App.state.revopsSimulationLoadedScenarioId = null;
    App.save(); App.render();
    Utils.toast('Simulador resetado para a configuração oficial do produto.');
  },

  updateRevopsSimulationSilent(field, value) {
    if (!App.state.revopsSimulationDraft) return;
    if (field === 'period') {
      App.state.revopsSimulationDraft.period = ['monthly', 'quarterly', 'yearly'].includes(value) ? value : 'monthly';
    } else {
      App.state.revopsSimulationDraft[field] = RevopsFinanceEngine.number(value);
    }
    App.save();
  },

  updateRevopsSimulation(field, value) {
    this.updateRevopsSimulationSilent(field, value);
    App.render();
  },

  addRevopsSimulationFixedItem(category) {
    if (!App.state.revopsSimulationDraft) return;
    const fc = App.state.revopsSimulationDraft.fixedCosts || {};
    const cat = fc[category] || (fc[category] = { items: [] });
    cat.items = [...(cat.items || []), RevopsFinanceEngine.emptyFixedItem()];
    App.state.revopsSimulationDraft.fixedCosts = fc;
    App.save(); App.render();
  },

  removeRevopsSimulationFixedItem(category, itemId) {
    if (!App.state.revopsSimulationDraft) return;
    const fc = App.state.revopsSimulationDraft.fixedCosts || {};
    const cat = fc[category];
    if (!cat) return;
    cat.items = (cat.items || []).filter(item => item.id !== itemId);
    App.save(); App.render();
  },

  updateRevopsSimulationFixedItemSilent(category, itemId, field, value) {
    if (!App.state.revopsSimulationDraft) return;
    const fc = App.state.revopsSimulationDraft.fixedCosts || {};
    const cat = fc[category];
    if (!cat) return;
    cat.items = (cat.items || []).map(item => {
      if (item.id !== itemId) return item;
      return { ...item, [field]: field === 'name' ? value : RevopsFinanceEngine.number(value) };
    });
    App.save();
  },

  addRevopsSimulationVariableCost() {
    if (!App.state.revopsSimulationDraft) return;
    App.state.revopsSimulationDraft.variableCosts = [...(App.state.revopsSimulationDraft.variableCosts || []), RevopsFinanceEngine.emptyVariableCost()];
    App.save(); App.render();
  },

  removeRevopsSimulationVariableCost(itemId) {
    if (!App.state.revopsSimulationDraft) return;
    App.state.revopsSimulationDraft.variableCosts = (App.state.revopsSimulationDraft.variableCosts || []).filter(item => item.id !== itemId);
    App.save(); App.render();
  },

  updateRevopsSimulationVariableCostSilent(itemId, field, value) {
    if (!App.state.revopsSimulationDraft) return;
    App.state.revopsSimulationDraft.variableCosts = (App.state.revopsSimulationDraft.variableCosts || []).map(item => {
      if (item.id !== itemId) return item;
      if (field === 'name') return { ...item, name: value };
      if (field === 'value') return { ...item, value: RevopsFinanceEngine.number(value) };
      return item;
    });
    App.save();
  },

  updateRevopsSimulationVariableCost(itemId, field, value) {
    if (!App.state.revopsSimulationDraft) return;
    App.state.revopsSimulationDraft.variableCosts = (App.state.revopsSimulationDraft.variableCosts || []).map(item => {
      if (item.id !== itemId) return item;
      if (field === 'type') return { ...item, type: ['percent', 'fixed'].includes(value) ? value : 'percent' };
      if (field === 'appliesTo') return { ...item, appliesTo: ['grossRevenue', 'netRevenue', 'afterFixed'].includes(value) ? value : 'grossRevenue' };
      if (field === 'value') return { ...item, value: RevopsFinanceEngine.number(value) };
      return { ...item, [field]: value };
    });
    App.save(); App.render();
  },

  addRevopsSimulationOffer() {
    if (!App.state.revopsSimulationDraft) return;
    App.state.revopsSimulationDraft.offers = [...(App.state.revopsSimulationDraft.offers || []), RevopsFinanceEngine.emptyOffer()];
    App.save(); App.render();
  },

  removeRevopsSimulationOffer(offerId) {
    if (!App.state.revopsSimulationDraft) return;
    App.state.revopsSimulationDraft.offers = (App.state.revopsSimulationDraft.offers || []).filter(offer => offer.id !== offerId);
    App.save(); App.render();
  },

  updateRevopsSimulationOfferSilent(offerId, field, value) {
    if (!App.state.revopsSimulationDraft) return;
    App.state.revopsSimulationDraft.offers = (App.state.revopsSimulationDraft.offers || []).map(offer => {
      if (offer.id !== offerId) return offer;
      return { ...offer, [field]: field === 'name' ? value : RevopsFinanceEngine.number(value) };
    });
    App.save();
  },

  updateRevopsSimulationOffer(offerId, field, value) {
    this.updateRevopsSimulationOfferSilent(offerId, field, value);
    App.render();
  },

  toggleRevopsSimulationOfferSelected(offerId) {
    if (!App.state.revopsSimulationDraft) return;
    App.state.revopsSimulationDraft.offers = (App.state.revopsSimulationDraft.offers || []).map(offer => offer.id === offerId ? { ...offer, selectedForTicket: !offer.selectedForTicket } : offer);
    App.save(); App.render();
  },

  setRevopsSimulationTicketMode(mode) {
    if (!App.state.revopsSimulationDraft) return;
    App.state.revopsSimulationDraft.ticketMode = ['weighted', 'manual', 'sumSelected'].includes(mode) ? mode : 'weighted';
    App.save(); App.render();
  },

  updateRevopsSimulationTicketManualValueSilent(value) {
    if (!App.state.revopsSimulationDraft) return;
    App.state.revopsSimulationDraft.ticketManualValue = RevopsFinanceEngine.number(value);
    App.save();
  },

  updateRevopsSimulationTicketManualValue(value) {
    this.updateRevopsSimulationTicketManualValueSilent(value);
    App.render();
  },

  openRevopsScenarioName() {
    if (!App.state.revopsSimulationDraft) return;
    const loadedId = App.state.revopsSimulationLoadedScenarioId;
    const config = (App.state.revopsFinance || {})[App.state.revopsSelectedProductId];
    const loaded = loadedId && config ? (config.scenarios || []).find(s => s.id === loadedId) : null;
    App.state.revopsScenarioDraftName = loaded ? loaded.name : '';
    App.state.showRevopsScenarioNameModal = true;
    App.save(); App.render();
  },

  cancelRevopsScenarioName() {
    App.state.showRevopsScenarioNameModal = false;
    App.state.revopsScenarioDraftName = '';
    App.save(); App.render();
  },

  confirmRevopsScenarioName() {
    const name = String(App.state.revopsScenarioDraftName || '').trim();
    if (!name) return Utils.toast('Dê um nome ao cenário.');
    if (!App.state.revopsSimulationDraft) return;
    const productId = App.state.revopsSelectedProductId;
    const config = this._revopsEnsureConfig(productId);
    if (!config) return;
    const snapshot = RevopsFinanceEngine.scenarioSnapshot(App.state.revopsSimulationDraft, name);
    const loadedId = App.state.revopsSimulationLoadedScenarioId;
    config.scenarios = Array.isArray(config.scenarios) ? config.scenarios : [];
    if (loadedId) {
      config.scenarios = config.scenarios.map(s => s.id === loadedId ? { ...snapshot, id: loadedId } : s);
      Utils.toast(`Cenário "${name}" atualizado.`);
    } else {
      config.scenarios.unshift(snapshot);
      App.state.revopsSimulationLoadedScenarioId = snapshot.id;
      Utils.toast(`Cenário "${name}" salvo.`);
    }
    App.state.showRevopsScenarioNameModal = false;
    App.state.revopsScenarioDraftName = '';
    App.save(); App.render();
  },

  openRevopsScenarios() {
    const productId = App.state.revopsSelectedProductId;
    if (!productId) return Utils.toast('Selecione um produto para ver cenários.');
    App.state.showRevopsScenariosModal = true;
    App.save(); App.render();
  },

  closeRevopsScenarios() {
    App.state.showRevopsScenariosModal = false;
    App.save(); App.render();
  },

  loadRevopsScenario(scenarioId) {
    const productId = App.state.revopsSelectedProductId;
    const config = (App.state.revopsFinance || {})[productId];
    if (!config) return;
    const scenario = (config.scenarios || []).find(s => s.id === scenarioId);
    if (!scenario) return Utils.toast('Cenário não encontrado.');
    App.state.revopsSimulationDraft = RevopsFinanceEngine.applyScenario(config, scenario);
    App.state.revopsSimulationLoadedScenarioId = scenarioId;
    App.state.showRevopsSimulationModal = true;
    App.state.showRevopsScenariosModal = false;
    App.save(); App.render();
  },

  deleteRevopsScenario(scenarioId) {
    const productId = App.state.revopsSelectedProductId;
    const config = (App.state.revopsFinance || {})[productId];
    if (!config) return;
    config.scenarios = (config.scenarios || []).filter(s => s.id !== scenarioId);
    if (App.state.revopsSimulationLoadedScenarioId === scenarioId) App.state.revopsSimulationLoadedScenarioId = null;
    App.save(); App.render();
    Utils.toast('Cenário removido.');
  },

  applyRevopsSimulationToProduct() {
    if (!App.state.revopsSimulationDraft) return;
    const productId = App.state.revopsSelectedProductId;
    if (!productId) return;
    const previousScenarios = ((App.state.revopsFinance || {})[productId]?.scenarios) || [];
    App.state.revopsFinance = App.state.revopsFinance || {};
    App.state.revopsFinance[productId] = RevopsFinanceEngine.normalize({
      ...App.state.revopsSimulationDraft,
      scenarios: previousScenarios,
      savedAt: new Date().toISOString()
    }, productId);
    App.state.showRevopsSimulationModal = false;
    App.state.revopsSimulationDraft = null;
    App.state.revopsSimulationLoadedScenarioId = null;
    App.save(); App.render();
    Utils.toast('Configuração oficial do produto atualizada com a projeção.');
  }
});
window.Actions = Actions;


// V14.3 — Motor de OKRs: vínculos entre KPIs RevOps, campanhas e ações.
Object.assign(Actions, {
  openRevopsOkr(scope, productId, editingId = null, campaignId = null) {
    const resolvedScope = scope === 'campaign' ? 'campaign' : 'product';
    let draft;
    if (editingId) {
      if (resolvedScope === 'product') {
        const existing = (App.state.strategicOkrs || []).find(o => o.id === editingId);
        if (!existing) return Utils.toast('OKR não encontrado.');
        draft = {
          scope: 'product',
          productId: existing.productId || productId,
          editingId,
          objective: existing.objective || existing.name || '',
          keyResults: (existing.keyResults || []).map(kr => ({ ...kr }))
        };
      } else {
        const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(campaignId));
        if (!campaign) return Utils.toast('Campanha não encontrada.');
        const existing = (campaign.okrs || []).find(o => o.id === editingId);
        if (!existing) return Utils.toast('OKR da campanha não encontrado.');
        draft = {
          scope: 'campaign',
          productId: productId || campaign.productId,
          campaignId: campaign.id,
          editingId,
          objective: existing.objective || '',
          keyResults: (existing.keyResults || []).map(kr => ({ ...kr }))
        };
      }
    } else {
      draft = {
        scope: resolvedScope,
        productId: productId || App.state.revopsSelectedProductId,
        campaignId: resolvedScope === 'campaign' ? campaignId : null,
        editingId: null,
        objective: '',
        keyResults: [RevopsFinanceEngine.defaultKeyResult(resolvedScope === 'product' ? 'ebitda' : 'campaignCAC')]
      };
    }
    App.state.revopsOkrDraft = draft;
    App.state.showRevopsOkrModal = true;
    App.save(); App.render();
  },

  openRevopsOkrFromKpi(productId, metricId, currentValue) {
    const meta = RevopsFinanceEngine.METRIC_CATALOG[metricId];
    if (!meta) return Utils.toast('Métrica não suportada.');
    const baseTarget = meta.direction === 'lower' && Number(currentValue) > 0
      ? Math.max(1, Math.round(Number(currentValue) * 0.7))
      : Math.max(Number(currentValue) || 0, 1) * 1.2;
    App.state.revopsOkrDraft = {
      scope: 'product',
      productId: productId || App.state.revopsSelectedProductId,
      editingId: null,
      objective: `Mover ${meta.label} para a zona saudável`,
      keyResults: [{
        id: `kr_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        label: `${meta.direction === 'lower' ? 'Reduzir' : 'Elevar'} ${meta.label}`,
        metric: metricId,
        target: Math.round(baseTarget * 100) / 100,
        parentKrId: null
      }]
    };
    App.state.showRevopsOkrModal = true;
    App.save(); App.render();
  },

  openRevopsOkrFromAlert(productId, encodedSuggest) {
    let suggest = {};
    try { suggest = JSON.parse(decodeURIComponent(encodedSuggest)); } catch (_) {}
    const metricId = suggest.metric || 'ebitda';
    const target = suggest.target ?? 0;
    return this.openRevopsOkrFromKpi(productId, metricId, target);
  },

  closeRevopsOkr() {
    App.state.showRevopsOkrModal = false;
    App.state.revopsOkrDraft = null;
    App.save(); App.render();
  },

  updateRevopsOkrDraft(field, value) {
    if (!App.state.revopsOkrDraft) return;
    App.state.revopsOkrDraft[field] = value;
    App.save();
  },

  addRevopsOkrKr() {
    if (!App.state.revopsOkrDraft) return;
    const scope = App.state.revopsOkrDraft.scope || 'product';
    const defaultMetric = scope === 'product' ? 'ebitda' : 'campaignCAC';
    App.state.revopsOkrDraft.keyResults = [...(App.state.revopsOkrDraft.keyResults || []), RevopsFinanceEngine.defaultKeyResult(defaultMetric)];
    App.save(); App.render();
  },

  removeRevopsOkrKr(index) {
    if (!App.state.revopsOkrDraft) return;
    App.state.revopsOkrDraft.keyResults = (App.state.revopsOkrDraft.keyResults || []).filter((_, i) => i !== index);
    App.save(); App.render();
  },

  updateRevopsOkrKrField(index, field, value) {
    if (!App.state.revopsOkrDraft) return;
    const list = App.state.revopsOkrDraft.keyResults || [];
    if (!list[index]) return;
    if (field === 'metric') {
      const meta = RevopsFinanceEngine.METRIC_CATALOG[value];
      list[index] = { ...list[index], metric: value, label: list[index].label || meta?.label || 'KR' };
    } else if (field === 'target') {
      list[index] = { ...list[index], target: RevopsFinanceEngine.number(value) };
    } else if (field === 'parentKrId') {
      list[index] = { ...list[index], parentKrId: value || null };
    } else {
      list[index] = { ...list[index], [field]: value };
    }
    App.state.revopsOkrDraft.keyResults = list;
    App.save();
    if (field === 'metric' || field === 'parentKrId') App.render();
  },

  saveRevopsOkr() {
    const draft = App.state.revopsOkrDraft;
    if (!draft) return;
    const objective = String(draft.objective || '').trim();
    if (!objective) return Utils.toast('Descreva o objetivo qualitativo.');
    if (!(draft.keyResults || []).length) return Utils.toast('Adicione ao menos um KR.');

    if (draft.scope === 'product') {
      const productId = draft.productId;
      if (!productId) return Utils.toast('Selecione um produto.');
      const payload = {
        id: draft.editingId || `okr_strategic_${Date.now()}`,
        objective,
        name: objective,
        productId: Number(productId),
        keyResults: (draft.keyResults || []).map(kr => ({ ...kr, target: RevopsFinanceEngine.number(kr.target) })),
        keyResult: '',
        target: '',
        current: '',
        unit: 'R$',
        owner: '',
        deadline: '',
        status: 'Em andamento',
        createdAt: new Date().toISOString()
      };
      const list = Array.isArray(App.state.strategicOkrs) ? App.state.strategicOkrs : [];
      if (draft.editingId) {
        App.state.strategicOkrs = list.map(o => o.id === draft.editingId ? { ...o, ...payload } : o);
      } else {
        App.state.strategicOkrs = [payload, ...list];
      }
      Utils.toast(`OKR estratégico ${draft.editingId ? 'atualizado' : 'criado'}.`);
    } else {
      const campaignId = Number(draft.campaignId);
      if (!campaignId) return Utils.toast('Selecione uma campanha.');
      const campaignIndex = (App.state.campaigns || []).findIndex(c => Number(c.id) === campaignId);
      if (campaignIndex < 0) return Utils.toast('Campanha não encontrada.');
      const campaign = App.state.campaigns[campaignIndex];
      const okrs = Array.isArray(campaign.okrs) ? campaign.okrs : [];
      const payload = {
        id: draft.editingId || `okrc_${Date.now()}`,
        objective,
        keyResults: (draft.keyResults || []).map(kr => ({ ...kr, target: RevopsFinanceEngine.number(kr.target) })),
        createdAt: new Date().toISOString()
      };
      const nextOkrs = draft.editingId
        ? okrs.map(o => o.id === draft.editingId ? { ...o, ...payload } : o)
        : [...okrs, payload];
      App.state.campaigns = App.state.campaigns.map((c, i) => i === campaignIndex ? { ...c, okrs: nextOkrs } : c);
      Utils.toast(`OKR tático ${draft.editingId ? 'atualizado' : 'criado'} na campanha.`);
    }

    App.state.showRevopsOkrModal = false;
    App.state.revopsOkrDraft = null;
    App.save(); App.render();
  },

  deleteRevopsOkr() {
    const draft = App.state.revopsOkrDraft;
    if (!draft || !draft.editingId) return;
    if (draft.scope === 'product') {
      App.state.strategicOkrs = (App.state.strategicOkrs || []).filter(o => o.id !== draft.editingId);
    } else {
      App.state.campaigns = (App.state.campaigns || []).map(c => {
        if (Number(c.id) !== Number(draft.campaignId)) return c;
        return { ...c, okrs: (c.okrs || []).filter(o => o.id !== draft.editingId) };
      });
      const krIdsRemoved = (draft.keyResults || []).map(kr => kr.id);
      App.state.actions = (App.state.actions || []).map(action => krIdsRemoved.includes(action.linkedCampaignKrId) ? { ...action, linkedCampaignKrId: null } : action);
    }
    App.state.showRevopsOkrModal = false;
    App.state.revopsOkrDraft = null;
    App.save(); App.render();
    Utils.toast('OKR removido.');
  },

  linkActionToCampaignKr(actionId, krId) {
    App.state.actions = (App.state.actions || []).map(action => Number(action.id) === Number(actionId) ? { ...action, linkedCampaignKrId: krId || null } : action);
    App.save(); App.render();
    Utils.toast(krId ? 'Ação vinculada ao KR da campanha.' : 'Vínculo removido.');
  }
});
window.Actions = Actions;

// V16.3 — Execution Provider Layer + Djow Agent
Object.assign(Actions, {
  setDefaultExecutionProvider(providerId) {
    if (!window.ExecutionProviderRegistry) return;
    const cfg = App.state.executionConfig || ExecutionProviderRegistry.defaultConfig();
    App.state.executionConfig = { ...cfg, defaultProvider: ExecutionProviderRegistry.byId(providerId).id };
    App.save(); App.render();
    Utils.toast(`Provider padrão: ${ExecutionProviderRegistry.byId(providerId).label}.`);
  },

  updateExecutionProviderField(providerId, field, value) {
    const cfg = App.state.executionConfig || ExecutionProviderRegistry.defaultConfig();
    const providers = { ...cfg.providers };
    providers[providerId] = { ...(providers[providerId] || {}), [field]: value };
    App.state.executionConfig = { ...cfg, providers };
    App.save();
  },

  async testExecutionProvider(providerId) {
    const provider = window.ExecutionProviders?.[providerId];
    if (!provider) return Utils.toast('Provider não encontrado.');
    const cfg = ExecutionProviderRegistry.getProviderConfig(providerId);
    Utils.toast(`Testando ${providerId}...`);
    const res = await provider.testConnection(cfg);
    const next = { ...cfg, connected: Boolean(res.ok), lastTested: new Date().toISOString(), lastError: res.ok ? null : res.message };
    const stateCfg = App.state.executionConfig || ExecutionProviderRegistry.defaultConfig();
    App.state.executionConfig = { ...stateCfg, providers: { ...stateCfg.providers, [providerId]: next } };
    App.save(); App.render();
    Utils.toast(res.message || (res.ok ? 'Conectado.' : 'Falhou.'));
  },

  updateAgentField(agentId, field, value) {
    const cfg = App.state.agentConfig || AgentRegistry.defaultConfig();
    const next = { ...(cfg[agentId] || {}), [field]: field === 'timeoutMs' ? Number(value || 0) : value };
    App.state.agentConfig = { ...cfg, [agentId]: next };
    App.save();
  },

  toggleAgentEnabled(agentId) {
    const cfg = App.state.agentConfig || AgentRegistry.defaultConfig();
    const next = { ...(cfg[agentId] || {}), enabled: !cfg[agentId]?.enabled };
    App.state.agentConfig = { ...cfg, [agentId]: next };
    App.save(); App.render();
    Utils.toast(next.enabled ? 'Agente ativado.' : 'Agente desativado.');
  },

  async testAgentConnection(agentId) {
    if (!window.AgentHealthMonitor) return;
    Utils.toast('Testando Djow...');
    const res = await AgentHealthMonitor.ping();
    App.render();
    Utils.toast(res.ok ? `Online · ${res.latencyMs}ms` : `Offline: ${res.message}`);
  },

  saveAgentConfig() {
    App.save();
    Utils.toast('Agente salvo.');
  },

  resetAgentConfig(agentId) {
    if (!window.AgentRegistry) return;
    const fresh = AgentRegistry.defaultConfig();
    App.state.agentConfig = { ...(App.state.agentConfig || {}), [agentId]: fresh[agentId] };
    App.save(); App.render();
    Utils.toast('Agente reiniciado.');
  },

  // V32.4.1 (Geraldo Item 1) — Actions DjowModal V16.3 removidas:
  //   openDjowModal, closeDjowModal, updateDjowDraft, sendDjowMessage
  // Substituídas por openDjowAIModal({ actionId }) — DjowAIModal V26+ com
  // Claude + tools (create_clickup_task com cache Redis V32.3.4) faz o
  // mesmo, melhor. Botões em tasksModal.js + actions.js atualizados.

  openTasksModal(actionId) {
    App.state.tasksModalActionId = Number(actionId);
    App.state.showTasksModal = true;
    App.save(); App.render();
  },

  closeTasksModal() {
    App.state.showTasksModal = false;
    App.state.tasksModalActionId = null;
    App.save(); App.render();
  },

  async startExecutionTask(taskId) {
    if (!window.ExecutionTaskEngine) return;
    await ExecutionTaskEngine.startTask(taskId);
    App.save(); App.render();
  },

  async completeExecutionTask(taskId) {
    if (!window.ExecutionTaskEngine) return;
    await ExecutionTaskEngine.completeTask(taskId);
    App.save(); App.render();
    Utils.toast('Tarefa concluída.');
  },

  // V32.3.0 (Geraldo Novo-1) — Async pra await provider.deleteTask antes do
  // render (evita race do user clicar de novo). ClickUp subtask delete vai
  // junto — não fica órfã no ClickUp do cliente.
  async removeExecutionTask(taskId) {
    if (!window.ExecutionTaskEngine) return;
    await ExecutionTaskEngine.removeTask(taskId);
    App.save(); App.render();
    Utils.toast('Tarefa removida.');
  },

  async syncExecutionTasks() {
    if (!window.ExecutionSyncEngine) return;
    Utils.toast('Sincronizando providers...');
    const res = await ExecutionSyncEngine.syncAll();
    App.save(); App.render();
    Utils.toast(`Sync concluído: ${res.synced} tarefa(s).`);
  }
});
window.Actions = Actions;

// V17 — Revenue Strategic Map
Object.assign(Actions, {
  // V29.0.0 — Abre Mapa em vista PRODUTO (CEO mode): Visão + KRs-mãe + lista de branches.
  // V38.1.12 — Click numa área (Marketing/Vendas/CS) no card do produto.
  // Se o produto NÃO tem Mapa configurado (sem vision E sem KR criado em
  // nenhuma branch), mostra aviso e leva pra Etapa 1 (Visão). Caso contrário,
  // abre o Mapa direto na Etapa 3 (Os Números) — onde estão os KRs das áreas.
  openProductAreaInMap(productId, areaId) {
    if (!window.StrategicMapEngine) return;
    const map = StrategicMapEngine.getForProduct(productId);
    const hasVision = !!String(map?.vision || '').trim();
    const branches = (typeof StrategicMapEngine.getBranchesByProduct === 'function')
      ? StrategicMapEngine.getBranchesByProduct(productId) || []
      : [];
    const totalKrs = branches.reduce((s, b) => s + (b.objectives || []).reduce((ss, o) => ss + (o.okrs?.length || 0), 0), 0);
    const isConfigurado = hasVision && totalKrs > 0;

    if (!isConfigurado) {
      Utils.toast('⚠ Crie o Mapa da Receita primeiro pra editar KRs por área.');
      setTimeout(() => {
        Actions.openStrategicMap(productId);
        if (window.StrategicZoomNavigation?.set) StrategicZoomNavigation.set('vision');
        App.save(); App.render();
      }, 400);
      return;
    }

    Actions.openStrategicMap(productId);
    if (window.StrategicZoomNavigation?.set) StrategicZoomNavigation.set('okrs');
    App.save(); App.render();
  },

  openStrategicMap(productId) {
    if (!productId) return Utils.toast('Selecione um produto.');
    // V31.0.5 — Demo abria direto na primeira branch pra ver etapas 4-6 com conteúdo.
    // V31.1.1 — Aplicado a TODOS users: se produto tem branches, abre na primeira
    // (sem CEO/Gestor distinction = "criar livre"). Se não tem branches, abre em
    // mode='product' (estado inicial) — etapa 4 hub vai oferecer criar campanha.
    const branchesForRedirect = window.StrategicMapEngine?.getBranchesByProduct
      ? StrategicMapEngine.getBranchesByProduct(Number(productId))
      : [];
    if (branchesForRedirect.length) {
      return Actions.openStrategicMapForCampaign(branchesForRedirect[0].campaignId);
    }
    App.state.strategicMapProductId = Number(productId);
    App.state.strategicMapCampaignId = null;        // V29 — vista produto, não campanha
    App.state.strategicMapMode = 'product';         // V29 — 'product' | 'campaign'
    App.state.showStrategicMap = true;
    App.state.strategicMapZoom = 'vision'; // V29.1.0 — CEO comeca pelo Objetivo (etapa 1)
    App.state.strategicSkipOnboarding = false; // V31.2.0 — welcome screen sempre aparece
    App.state.strategicObjectiveDraft = null;
    App.state.strategicOkrDraft = null;
    App.state.strategicActiveArea = null;
    App.state.strategicCampaignPrompt = null;
    // V36.9.0 — Reset modo edição/tutorial da etapa 1. inTutorial = true só se
    // o produto não tem vision ainda (cliente novo). Senão revisão direto.
    App.state.strategicVisionEditDraft = null;
    App.state.strategicVisionInTutorial = false; // será setado abaixo após ensure
    if (window.StrategicMapEngine) {
      StrategicMapEngine.ensure(Number(productId));
      if (typeof StrategicMapEngine.migrateLegacyStrategicCampaigns === 'function') {
        const mergedCount = StrategicMapEngine.migrateLegacyStrategicCampaigns(Number(productId));
        if (mergedCount > 0) Utils.toast(`Encontradas ${mergedCount} campanha(s) duplicada(s) — mescladas.`);
      }
      if (typeof StrategicMapEngine.migrateLegacyStrategicActions === 'function') {
        const fixedCount = StrategicMapEngine.migrateLegacyStrategicActions(Number(productId));
        if (fixedCount > 0) Utils.toast(`${fixedCount} ação(ões) tiveram setor/funil corrigidos.`);
      }
      // V29.2.3 — garante campos compat (leads, okrs, flowPath) em ações estratégicas
      // antigas pra não quebrar ActionModule.card.
      if (typeof StrategicMapEngine.migrateStrategicActionsCompatFields === 'function') {
        StrategicMapEngine.migrateStrategicActionsCompatFields(Number(productId));
      }
      // V29 — Lazy migration: se há strategicCampaignId e ainda há legacy objectives,
      // move pra branch automaticamente.
      const map = StrategicMapEngine.getForProduct(productId);
      if (map?.strategicCampaignId && (map.objectives || []).length > 0) {
        StrategicMapEngine._lazyMigrateLegacyToBranch(productId, map.strategicCampaignId);
        Utils.toast('Mapa migrado pro novo modelo (branches por campanha).');
      }
    }
    // V36.9.0 — Define tutorial mode da etapa 1 baseado em vision atual.
    if (window.StrategicMapEngine) {
      const v = String(StrategicMapEngine.getForProduct(Number(productId))?.vision || '').trim();
      App.state.strategicVisionInTutorial = !v;
    }
    App.save(); App.render();
  },

  closeStrategicMap() {
    App.state.showStrategicMap = false;
    App.state.strategicObjectiveDraft = null;
    App.state.strategicOkrDraft = null;
    App.save(); App.render();
  },

  // V32.15.0 — Click numa estação do Pulso da Receita (página Início) abre o
  // Mapa da Receita direto na etapa equivalente. Mapeamento estação→zoom:
  //   produto    → vision     (Etapa 1)
  //   campanhas  → campaign   (Etapa 4 unificada — escolher + ações)
  //   acoes      → campaign   (Etapa 4 — fundida; era operations)
  //   execucoes  → execution  (Etapa 5 / Acompanhamento)
  //   receita    → execution  (Receita vive dentro do Acompanhamento)
  // Reusa openStrategicMap[ForCampaign] e sobrescreve o zoom no fim.
  openPulsoStation(productId, stationId) {
    if (!productId) return Utils.toast('Selecione um produto.');
    const zoomMap = {
      produto: 'vision',
      campanhas: 'campaign',
      acoes: 'campaign',
      execucoes: 'execution',
      receita: 'execution'
    };
    const targetZoom = zoomMap[stationId] || 'vision';
    const branches = window.StrategicMapEngine?.getBranchesByProduct
      ? StrategicMapEngine.getBranchesByProduct(Number(productId))
      : [];
    if (branches.length) {
      Actions.openStrategicMapForCampaign(branches[0].campaignId);
    } else {
      Actions.openStrategicMap(Number(productId));
    }
    App.state.strategicMapZoom = targetZoom;
    App.state.strategicSkipOnboarding = true;
    App.save(); App.render();
  },

  // V32.15.0 — Toggle recolher de um bloco da Etapa 6 (Acompanhamento).
  // Felipe pediu na revisão: cada layer (Números/Ações/Carga/Gantt) com chevron.
  toggleAcompanhamentoSection(key) {
    if (!['krs', 'actions', 'carga', 'gantt'].includes(key)) return;
    const cur = App.state.acompanhamentoSectionsCollapsed || { krs: false, actions: false, carga: false, gantt: false };
    App.state.acompanhamentoSectionsCollapsed = { ...cur, [key]: !cur[key] };
    App.save(); App.render();
  },

  openStrategicOverview() {
    App.state.showStrategicOverview = true;
    App.save(); App.render();
  },

  closeStrategicOverview() {
    App.state.showStrategicOverview = false;
    App.save(); App.render();
  },

  // V18 — Revenue Score Center
  openRevenueScoreCreator(campaignId, editing) {
    const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(campaignId));
    if (!campaign) return Utils.toast('Campanha não encontrada.');
    const existing = editing && window.RevenueScoreEngine ? RevenueScoreEngine.getBlueprint(campaignId) : null;
    App.state.revenueScoreCreatorCtx = {
      campaignId: Number(campaignId),
      editing: Boolean(editing),
      stepIndex: 0,
      answers: existing?.answers ? { ...existing.answers } : {},
      djowMessages: [{
        text: editing
          ? `Vamos revisar o ICP de "${campaign.name}". Suas respostas anteriores já estão preenchidas — ajuste o que precisar.`
          : `Vamos descobrir o ICP de "${campaign.name}" juntos. Respostas honestas geram leitura mais precisa depois.`,
        kind: 'info',
        ts: new Date().toISOString()
      }]
    };
    App.state.showRevenueScoreCreator = true;
    App.save(); App.render();
  },

  _appendDjowCreatorMessage(text, kind) {
    const ctx = App.state.revenueScoreCreatorCtx;
    if (!ctx) return;
    const list = Array.isArray(ctx.djowMessages) ? ctx.djowMessages : [];
    // Evita duplicar a última mensagem idêntica.
    if (list.length && list[list.length - 1].text === text) return;
    App.state.revenueScoreCreatorCtx = {
      ...ctx,
      djowMessages: [...list, { text, kind: kind || 'info', ts: new Date().toISOString() }]
    };
  },

  cancelRevenueScoreCreator() {
    App.state.showRevenueScoreCreator = false;
    App.state.revenueScoreCreatorCtx = null;
    App.save(); App.render();
  },

  answerRevenueScoreQuestion(questionId, value, mode) {
    const ctx = App.state.revenueScoreCreatorCtx;
    if (!ctx) return;
    const answers = { ...(ctx.answers || {}) };
    if (mode === 'multi') {
      // Backwards-compat: resposta antiga em string vira [string] antes do toggle.
      const current = answers[questionId];
      const list = Array.isArray(current) ? [...current] : (current ? [String(current)] : []);
      const idx = list.indexOf(value);
      if (idx >= 0) list.splice(idx, 1); else list.push(value);
      answers[questionId] = list;
    } else {
      answers[questionId] = value;
    }
    App.state.revenueScoreCreatorCtx = { ...ctx, answers };
    // Djow gatilho 2: resposta de texto muito curta → alerta amigável
    if (mode === 'text' && String(value || '').trim().length > 0 && String(value || '').trim().length < 12) {
      Actions._appendDjowCreatorMessage('Sua resposta está bem curta — quer detalhar um pouco? Isso melhora a precisão do Revenue Score depois.', 'warning');
    }
    App.render();
    // Auto-advance em single-choice com microdelay (200ms) — UX não brusca
    if (mode === 'single') {
      setTimeout(() => {
        // Re-checa: o usuário pode ter cancelado o modal nesse meio tempo.
        if (App.state.showRevenueScoreCreator && App.state.revenueScoreCreatorCtx?.answers?.[questionId] === value) {
          Actions.nextRevenueScoreStep();
        }
      }, 220);
    }
  },

  nextRevenueScoreStep() {
    const ctx = App.state.revenueScoreCreatorCtx;
    if (!ctx) return;
    const segment = ctx.answers?.segment || null;
    const total = segment ? IcpConversationFlow.totalSteps(segment) : 5;
    const currentIdx = Number(ctx.stepIndex || 0);
    const nextIdx = Math.min(currentIdx + 1, total);
    App.state.revenueScoreCreatorCtx = { ...ctx, stepIndex: nextIdx };
    // Djow gatilho 3: transição entre etapas (mensagem do próximo tópico)
    const nextQuestion = window.IcpConversationFlow ? IcpConversationFlow.questionAt(segment, nextIdx) : null;
    if (nextQuestion && nextIdx < total) {
      Actions._appendDjowCreatorMessage(this._transitionMessage(currentIdx, nextQuestion), 'info');
    }
    // Djow gatilho 4: fechamento (entrou na revisão)
    if (nextIdx >= total) {
      const positives = (App.state.revenueScoreCreatorCtx.answers?.qualificationSignals || App.state.revenueScoreCreatorCtx.answers?.interestSignals || []).length;
      Actions._appendDjowCreatorMessage(`Pronto. ${positives ? `Captei ${positives} sinal(is) positivo(s) — vou gerar o blueprint com decay temporal e thresholds dinâmicos.` : 'Sem sinais positivos selecionados, o engagement vai ficar baixo. Considere voltar e marcar pelo menos um.'}`, 'celebrate');
    }
    App.save(); App.render();
  },

  _transitionMessage(prevIdx, nextQuestion) {
    const topicMap = {
      segment: 'o segmento',
      decisionMaker: 'quem decide',
      companySize: 'o tamanho das empresas',
      painPoint: 'a dor principal',
      qualificationSignals: 'os sinais de qualificação',
      ageRange: 'a faixa etária',
      interest: 'o interesse principal',
      interestSignals: 'os sinais de interesse',
      negativeSignals: 'o que NÃO é seu público'
    };
    const topic = topicMap[nextQuestion.id] || 'o próximo ponto';
    return `Boa. Agora vou perguntar sobre ${topic}.`;
  },

  previousRevenueScoreStep() {
    const ctx = App.state.revenueScoreCreatorCtx;
    if (!ctx) return;
    const prev = Math.max(0, Number(ctx.stepIndex || 0) - 1);
    App.state.revenueScoreCreatorCtx = { ...ctx, stepIndex: prev };
    App.save(); App.render();
  },

  commitRevenueScoreBlueprint() {
    const ctx = App.state.revenueScoreCreatorCtx;
    if (!ctx || !window.RevenueScoreBlueprintEngine) return;
    const action = ctx.editing ? 'updateFromAnswers' : 'createFromAnswers';
    const bp = RevenueScoreBlueprintEngine[action](ctx.campaignId, ctx.answers || {});
    const wasCreate = !ctx.editing;
    App.state.showRevenueScoreCreator = false;
    App.state.revenueScoreCreatorCtx = null;
    // V21 — Pós-criação: oferece buscar leads aderentes na base global
    if (wasCreate) {
      App.state.showPostScoreSearchPrompt = true;
      App.state.postScoreSearchCampaignId = Number(ctx.campaignId);
    }
    App.save(); App.render();
    Utils.toast(`Revenue Score ${ctx.editing ? 'atualizado' : 'criado'}: ${bp.segment}.`);
  },

  cancelPostScoreSearch() {
    App.state.showPostScoreSearchPrompt = false;
    App.state.postScoreSearchCampaignId = null;
    App.save(); App.render();
  },

  // V21.2 — Abre o prompt de conexão para qualquer campanha (usado pelo
  // botão de status no Center e pela ação "Conectar" do dashboard).
  openConnectLeadsForCampaign(campaignId) {
    if (!campaignId) return;
    App.state.postScoreSearchCampaignId = Number(campaignId);
    App.state.showPostScoreSearchPrompt = true;
    App.state.showRevenueScoreDashboard = false;
    App.save(); App.render();
  },

  goToBuscadorWithContext() {
    const campaignId = App.state.postScoreSearchCampaignId;
    if (!campaignId) return Actions.cancelPostScoreSearch();
    const blueprint = window.RevenueScoreEngine?.getBlueprint(campaignId);
    App.state.profileCampaignContext = Number(campaignId);
    App.state.profileIcpContext = blueprint?.profileSummary || null;
    App.state.profileActive = true;
    App.state.showPostScoreSearchPrompt = false;
    App.state.postScoreSearchCampaignId = null;
    App.state.showRevenueScoreDashboard = false;
    App.setTab('leads');
    Utils.toast('Buscador filtrando pela campanha. Selecione e clique em "Vincular à campanha".');
  },

  clearProfileCampaignContext() {
    App.state.profileCampaignContext = null;
    App.state.profileIcpContext = null;
    App.save(); App.render();
  },

  linkLeadToCampaignFromBuscador(leadKey) {
    const campaignId = App.state.profileCampaignContext;
    if (!campaignId) return Utils.toast('Defina o contexto da campanha primeiro.');
    if (!window.LeadBaseService) return Utils.toast('LeadBaseService indisponível.');
    const added = LeadBaseService.linkToCampaign(leadKey, campaignId);
    if (!added) return Utils.toast('Esse lead já está vinculado.');
    App.save(); App.render();
    Utils.toast('Lead vinculado à campanha.');
  },

  // V21.3 — Bulk-link de todos os leads do resultado atual (filtro ou não)
  linkAllDisplayedLeads() {
    const campaignId = App.state.profileCampaignContext;
    if (!campaignId) return Utils.toast('Sem contexto de campanha.');
    if (!window.LeadBaseService || !window.LeadsModule) return Utils.toast('Serviços indisponíveis.');
    const leads = LeadsModule._getDisplayedLeads();
    if (!leads.length) return Utils.toast('Sem leads no resultado pra vincular.');
    let added = 0, already = 0;
    for (const lead of leads) {
      const ok = LeadBaseService.linkToCampaign(lead.id, campaignId);
      if (ok) added += 1; else already += 1;
    }
    if (!added) {
      Utils.toast(`Todos os ${already} lead(s) já estavam vinculados.`);
      return;
    }
    App.save(); App.render();
    Utils.toast(`${added} lead(s) vinculado(s)${already ? ` · ${already} já estavam` : ''}.`);
  },

  unlinkLeadFromCampaign(leadKey, campaignId) {
    if (!window.LeadBaseService) return;
    LeadBaseService.unlinkFromCampaign(leadKey, campaignId);
    App.save(); App.render();
    Utils.toast('Vínculo removido.');
  },

  // V21 — Sync manual do RD CRM
  async syncRdCrmNow() {
    if (!window.RdCrmLiveSyncEngine) return Utils.toast('RD Live Sync indisponível.');
    Utils.toast('Sincronizando com RD CRM...');
    await RdCrmLiveSyncEngine.runOnce(false);
  },

  openRevenueScoreDashboard(campaignId) {
    App.state.revenueScoreDashboardCampaignId = Number(campaignId);
    App.state.showRevenueScoreDashboard = true;
    App.save(); App.render();
  },

  closeRevenueScoreDashboard() {
    App.state.showRevenueScoreDashboard = false;
    App.state.revenueScoreDashboardCampaignId = null;
    App.save(); App.render();
  },

  // V18.1 — Auto-dispatch de Revenue Ready para tarefa no provider (V16.3).
  // Identifica novos Revenue Ready (não disparados ainda) e cria uma tarefa
  // por lead via ExecutionTaskEngine. Persistido em revenueReadyTriggered.
  async dispatchRevenueReadyTasks(campaignId) {
    if (!window.ExecutionTaskEngine) return Utils.toast('Execution engine indisponível.');
    const v2 = window.LeadScoringV2 ? LeadScoringV2.classifyCampaign(campaignId) : null;
    if (!v2?.ok) return Utils.toast(v2?.message || 'Sem classification.');
    const blueprint = v2.blueprint;
    const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(campaignId));
    const pending = this._pendingRevenueReadyLeads(campaignId, v2.classified);
    if (!pending.length) return Utils.toast('Nenhum novo lead Revenue Ready para disparar.');
    const triggeredMap = { ...(App.state.revenueReadyTriggered || {}) };
    const byCampaign = { ...(triggeredMap[campaignId] || {}) };
    let created = 0, failed = 0;
    for (const item of pending) {
      const key = this._leadKey(item.lead);
      const pkg = window.HandoffProtocol ? HandoffProtocol.buildPackage(item, campaign, blueprint) : null;
      const parsed = pkg ? HandoffProtocol.toTaskPayload(pkg) : {
        title: `[Revenue Ready] ${item.lead?.name || item.lead?.email || 'Lead'}`,
        description: `Tier ${item.tier} · ${item.revenueScore}% revenue score`,
        priority: 'high',
        assignee: campaign?.owner || '',
        due_date: null
      };
      try {
        const res = await ExecutionTaskEngine.createFromParsedResponse(item.actionId, parsed, 'revenue-score-v2');
        if (res?.ok) { created += 1; byCampaign[key] = new Date().toISOString(); }
        else failed += 1;
      } catch (_) { failed += 1; }
    }
    triggeredMap[campaignId] = byCampaign;
    App.state.revenueReadyTriggered = triggeredMap;
    App.save(); App.render();
    Utils.toast(`${created} hand-off(s) enviado(s)${failed ? ` · ${failed} falharam` : ''}.`);
  },

  _pendingRevenueReadyLeads(campaignId, classified) {
    const triggered = (App.state.revenueReadyTriggered || {})[campaignId] || {};
    return (classified || []).filter(c => c.revenueReady && !triggered[this._leadKey(c.lead)]);
  },

  _leadKey(lead) {
    return String(lead?.email || lead?.id || lead?.name || '').toLowerCase().trim() || `lead_${Math.random().toString(36).slice(2, 8)}`;
  },

  // V19 — Outcome + Lifecycle + Negative Selection + Recycling + Signal recording
  markLeadOutcome(leadKey, campaignId, outcome) {
    if (!window.OutcomeTracker) return;
    OutcomeTracker.mark(leadKey, campaignId, outcome);
    App.save(); App.render();
    Utils.toast(`Outcome do lead marcado como "${outcome}".`);
  },

  setLeadLifecycleStage(leadKey, campaignId, stageId) {
    if (!window.LifecycleEngine) return;
    App.state.actions = (App.state.actions || []).map(action => ({
      ...action,
      leads: (action.leads || []).map(lead => {
        const k = String(lead?.email || lead?.id || lead?.name || '').toLowerCase().trim();
        if (k !== String(leadKey).toLowerCase().trim()) return lead;
        return LifecycleEngine.transition(lead, stageId);
      })
    }));
    App.save(); App.render();
    Utils.toast(`Stage atualizado para ${stageId}.`);
  },

  recycleStaleLead(leadKey, campaignId) {
    if (!window.LeadRecyclingEngine || !window.LifecycleEngine) return;
    App.state.actions = (App.state.actions || []).map(action => ({
      ...action,
      leads: (action.leads || []).map(lead => {
        const k = String(lead?.email || lead?.id || lead?.name || '').toLowerCase().trim();
        if (k !== String(leadKey).toLowerCase().trim()) return lead;
        return LeadRecyclingEngine.recycle(lead);
      })
    }));
    App.save(); App.render();
    Utils.toast('Lead reciclado para stage anterior.');
  },

  excludeAccountDomain(domain) {
    if (!window.NegativeSelectionEngine) return;
    NegativeSelectionEngine.excludeDomain(domain);
    App.save(); App.render();
    Utils.toast(`Domínio "${domain}" excluído (Negative Selection).`);
  },

  removeExcludedDomain(domain) {
    if (!window.NegativeSelectionEngine) return;
    NegativeSelectionEngine.remove('domain', domain);
    App.save(); App.render();
    Utils.toast(`Domínio "${domain}" removido da exclusão.`);
  },

  setLeadBuyingRole(leadKey, role) {
    App.state.actions = (App.state.actions || []).map(action => ({
      ...action,
      leads: (action.leads || []).map(lead => {
        const k = String(lead?.email || lead?.id || lead?.name || '').toLowerCase().trim();
        return k === String(leadKey).toLowerCase().trim() ? { ...lead, buyingRole: role } : lead;
      })
    }));
    App.save(); App.render();
  },

  updateLeadMeddic(leadKey, field, value) {
    if (!window.MeddicEngine) return;
    App.state.actions = (App.state.actions || []).map(action => ({
      ...action,
      leads: (action.leads || []).map(lead => {
        const k = String(lead?.email || lead?.id || lead?.name || '').toLowerCase().trim();
        return k === String(leadKey).toLowerCase().trim() ? MeddicEngine.update(lead, { [field]: value }) : lead;
      })
    }));
    App.save();
  },

  recordLeadSignal(leadKey, signal) {
    const key = String(leadKey).toLowerCase().trim();
    if (!key) return;
    const all = App.state.leadEngagementHistory || {};
    const current = Array.isArray(all[key]) ? all[key] : [];
    App.state.leadEngagementHistory = { ...all, [key]: [...current, { signal, ts: new Date().toISOString() }] };
    App.save();
  },

  // V19.1 — Lead Detail Modal: tags manuais, edição de campos, aliases, custom signals
  openLeadDetailModal(campaignId, actionId, leadKey) {
    App.state.leadDetailContext = { campaignId: Number(campaignId), actionId: Number(actionId), leadKey: String(leadKey) };
    App.state.showLeadDetailModal = true;
    App.save(); App.render();
  },

  closeLeadDetailModal() {
    App.state.showLeadDetailModal = false;
    App.state.leadDetailContext = null;
    App.save(); App.render();
  },

  _findLeadByKey(leadKey) {
    const target = String(leadKey).toLowerCase().trim();
    for (const action of (App.state.actions || [])) {
      for (const lead of (action.leads || [])) {
        const k = String(lead?.email || lead?.id || lead?.name || '').toLowerCase().trim();
        if (k === target) return { lead, action };
      }
    }
    return null;
  },

  updateLeadField(leadKey, field, value) {
    const target = String(leadKey).toLowerCase().trim();
    let targetEmail = null;
    App.state.actions = (App.state.actions || []).map(action => ({
      ...action,
      leads: (action.leads || []).map(lead => {
        const k = String(lead?.email || lead?.id || lead?.name || '').toLowerCase().trim();
        if (k !== target) return lead;
        if (lead?.email) targetEmail = String(lead.email).toLowerCase().trim();
        return { ...lead, [field]: value };
      })
    }));
    App.save();

    // V34.7.h.9 — Persiste no lj_visitors via /api/visitors-update (debounced).
    // Só pra campos que existem no DB (name, phone). Outros (idade, sexo, etc.)
    // continuam só no state legacy. Sem email → não dá pra resolver visitor.
    if (!targetEmail || !['name', 'phone'].includes(field)) return;
    this._scheduleVisitorPersist(targetEmail, field, value);
  },

  // V34.7.h.9 — Debounce 1.2s por (email,field). Cada edit reinicia o timer;
  // após pausa, faz POST /api/visitors-update. Falhas viram warn no console
  // (não interrompem digitação — UX prevalece, RD pega no próximo cron).
  _scheduleVisitorPersist(email, field, value) {
    if (!this._visitorPersistTimers) this._visitorPersistTimers = {};
    const key = `${email}::${field}`;
    if (this._visitorPersistTimers[key]) clearTimeout(this._visitorPersistTimers[key]);
    this._visitorPersistTimers[key] = setTimeout(async () => {
      try {
        const token = localStorage.getItem('lj_jwt');
        if (!token) return;
        const res = await fetch('/api/visitors-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ email, [field]: value })
        });
        const data = await res.json().catch(() => ({}));
        if (!data.ok) {
          console.warn('[visitors-update] falhou:', data.message || res.status);
          return;
        }
        if (data.markedForRdSync) {
          console.log(`[visitors-update] ${email} ${field}="${value}" → pending no RD CRM`);
        }
      } catch (err) {
        console.warn('[visitors-update] erro:', err.message);
      }
    }, 1200);
  },

  // V34.9.4 — Sininho agrega 3 tipos de notificação. Counts-only modo rápido
  // pra badge; lists modo completo pra modal.
  async loadReconciliationCounts() {
    const token = localStorage.getItem('lj_jwt');
    if (!token) return;
    try {
      const res = await fetch('/api/reconciliation-alerts', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.ok) return;
      const counts = data.counts || {};
      App.state.pendingReconciliationCount = counts.totalUnread || 0;
      App.state.reconciliationCounts = counts;
      App.save(); App.render();
    } catch (err) {
      console.warn('[loadReconciliationCounts]', err.message);
    }
  },

  async loadReconciliationAlerts() {
    // Compat: continua chamado mas usa o endpoint novo com listas
    const token = localStorage.getItem('lj_jwt');
    if (!token) return;
    try {
      const res = await fetch('/api/reconciliation-alerts?include=lists', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.ok) return;
      const counts = data.counts || {};
      App.state.pendingReconciliationCount = counts.totalUnread || 0;
      App.state.reconciliationCounts = counts;
      App.state.reconciliationModal = {
        ...(App.state.reconciliationModal || {}),
        alerts: data.alerts || [],
        stagePending: data.stagePending || [],
        dealPending: data.dealPending || [],
        loadedAt: Date.now(),
        loading: false
      };
      App.save(); App.render();
    } catch (err) {
      console.warn('[loadReconciliationAlerts]', err.message);
    }
  },

  // V34.9.4 — Quando o modal abre, marca conflitos como lidos (sai do badge).
  async markReconciliationAlertsRead() {
    const token = localStorage.getItem('lj_jwt');
    if (!token) return;
    try {
      await fetch('/api/reconciliation-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'mark_read' })
      });
    } catch (_) {}
  },

  openReconciliationModal() {
    App.state.reconciliationModal = {
      ...(App.state.reconciliationModal || { alerts: [], stagePending: [], dealPending: [] }),
      open: true,
      loading: true
    };
    App.render();
    this.loadReconciliationAlerts().then(() => this.markReconciliationAlertsRead()).then(() => this.loadReconciliationCounts());
  },

  closeReconciliationModal() {
    App.state.reconciliationModal = {
      ...(App.state.reconciliationModal || {}),
      open: false,
      loading: false,
      resolvingId: null
    };
    App.render();
  },

  // resolution: 'keep_lj' | 'keep_rd' | 'dismiss'
  async resolveReconciliationAlert(alertId, resolution) {
    const m = App.state.reconciliationModal;
    if (!m || m.resolvingId) return;
    App.state.reconciliationModal = { ...m, resolvingId: alertId };
    App.render();
    const token = localStorage.getItem('lj_jwt');
    try {
      const res = await fetch('/api/reconciliation-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ alert_id: alertId, resolution })
      });
      const data = await res.json();
      if (!data.ok) {
        Utils.toast(`Falha: ${data.message}`);
        App.state.reconciliationModal = { ...App.state.reconciliationModal, resolvingId: null };
        App.render();
        return;
      }
      const label = resolution === 'keep_lj' ? 'mantido LJ (vai pro RD)'
                  : resolution === 'keep_rd' ? 'aplicado valor do RD'
                  : 'descartado';
      Utils.toast(`✓ Alerta resolvido — ${label}`);
      await this.loadReconciliationAlerts();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
      App.state.reconciliationModal = { ...App.state.reconciliationModal, resolvingId: null };
      App.render();
    }
  },

  // V34.9.6 — Modal "Score Breakdown" item por item.
  async openScoreBreakdownModal(visitorId) {
    const vid = String(visitorId || '').trim();
    if (!vid) return Utils.toast('visitor_id obrigatório.');
    App.state.scoreBreakdownModal = {
      open: true,
      visitorId: vid,
      loading: true,
      data: null
    };
    App.render();
    const token = localStorage.getItem('lj_jwt');
    try {
      const res = await fetch(`/api/visitor-score-breakdown?visitor_id=${encodeURIComponent(vid)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.ok) {
        Utils.toast(`Erro: ${data.message}`);
        App.state.scoreBreakdownModal.loading = false;
        App.render();
        return;
      }
      App.state.scoreBreakdownModal = {
        ...App.state.scoreBreakdownModal,
        data,
        loading: false
      };
      App.render();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
      App.state.scoreBreakdownModal.loading = false;
      App.render();
    }
  },

  closeScoreBreakdownModal() {
    App.state.scoreBreakdownModal = { open: false, visitorId: null, loading: false, data: null };
    App.render();
  },

  // V34.9.5 / V34.9.10 — Painel Score Engine.
  async openScoreConfigModal(campaignId) {
    const cid = campaignId && campaignId !== 'all' ? Number(campaignId) : null;
    App.state.scoreConfigModal = {
      ...(App.state.scoreConfigModal || {}),
      open: true,
      campaignId: cid,
      activeTab: 'score',
      scoreSubTab: 'general',
      ruleDraft: null
    };
    App.render();
    // Carrega modelo ativo + regras + ICP em background
    this.loadScoreModel();
    this.loadScoreRules();
    this.loadIcpProfile();
  },

  closeScoreConfigModal() {
    App.state.scoreConfigModal = { ...(App.state.scoreConfigModal || {}), open: false };
    App.render();
  },

  setScoreConfigTab(tab) {
    App.state.scoreConfigModal = {
      ...(App.state.scoreConfigModal || {}),
      activeTab: tab === 'settings' ? 'settings' : 'score'
    };
    App.render();
  },

  setScoreSubTab(sub) {
    App.state.scoreConfigModal = {
      ...(App.state.scoreConfigModal || {}),
      scoreSubTab: sub === 'campaign' ? 'campaign' : 'general'
    };
    App.render();
  },

  // V34.9.10 — Modelo ativo de scoring
  async loadScoreModel() {
    const token = localStorage.getItem('lj_jwt');
    try {
      const res = await fetch('/api/score-model', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.ok) {
        App.state.scoreConfigModal = { ...(App.state.scoreConfigModal || {}), activeModel: data.model };
        App.render();
      }
    } catch (_) {}
  },

  async setActiveScoreModel(model) {
    const token = localStorage.getItem('lj_jwt');
    try {
      const res = await fetch('/api/score-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ model })
      });
      const data = await res.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      App.state.scoreConfigModal = { ...(App.state.scoreConfigModal || {}), activeModel: data.model };
      Utils.toast(`✓ Modelo de score: ${data.model}. Recalculando todos os leads…`);
      App.render();
      // V34.9.10.4 — Dispara recálculo em batch pra refletir nos scores existentes
      try {
        const r = await fetch('/api/score-recalc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ batch_decay: true, max_visitors: 1000 })
        });
        const rd = await r.json();
        if (rd.ok) {
          Utils.toast(`✓ ${rd.processed || 0} lead(s) recalculados com modelo ${data.model}.`);
        }
      } catch (_) {}
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V34.9.10 — Score Rules (modelo Critérios)
  async loadScoreRules() {
    const token = localStorage.getItem('lj_jwt');
    try {
      const res = await fetch('/api/score-rules', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.ok) {
        App.state.scoreConfigModal = { ...(App.state.scoreConfigModal || {}), scoreRules: data.rules || [] };
        App.render();
      }
    } catch (_) {}
  },

  startScoreRuleDraft() {
    App.state.scoreConfigModal = {
      ...(App.state.scoreConfigModal || {}),
      ruleDraft: { trigger_type: 'tag', trigger_param: '', points: 10, category: 'engagement' }
    };
    App.render();
  },

  cancelScoreRuleDraft() {
    App.state.scoreConfigModal = { ...(App.state.scoreConfigModal || {}), ruleDraft: null };
    App.render();
  },

  updateScoreRuleDraft(field, value) {
    const d = App.state.scoreConfigModal?.ruleDraft;
    if (!d) return;
    const next = { ...d };
    if (field === 'points') next.points = Number(value) || 0;
    else next[field] = value;
    App.state.scoreConfigModal.ruleDraft = next;
  },

  async saveScoreRuleDraft() {
    const draft = App.state.scoreConfigModal?.ruleDraft;
    if (!draft) return;
    const token = localStorage.getItem('lj_jwt');
    try {
      const res = await fetch('/api/score-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(draft)
      });
      const data = await res.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      Utils.toast('✓ Regra criada.');
      App.state.scoreConfigModal.ruleDraft = null;
      await this.loadScoreRules();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  async toggleScoreRuleActive(ruleId, isActive) {
    const token = localStorage.getItem('lj_jwt');
    try {
      const res = await fetch('/api/score-rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: ruleId, is_active: Boolean(isActive) })
      });
      const data = await res.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      await this.loadScoreRules();
    } catch (err) { Utils.toast(`Erro: ${err.message}`); }
  },

  // V34.9.11 — ICP Profile
  async loadIcpProfile() {
    const token = localStorage.getItem('lj_jwt');
    try {
      const res = await fetch('/api/icp-profile', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.ok) {
        App.state.scoreConfigModal = { ...(App.state.scoreConfigModal || {}), icpProfile: data.profile };
        App.render();
      }
    } catch (_) {}
  },

  startIcpDraft() {
    const m = App.state.scoreConfigModal || {};
    const profile = m.icpProfile || { fields_json: {} };
    const draft = JSON.parse(JSON.stringify(profile));
    // V34.9.13: garante defaults dos campos de regras
    if (!draft.tier_method) draft.tier_method = 'percentage';
    if (!draft.tier_rules_json || typeof draft.tier_rules_json !== 'object') {
      draft.tier_rules_json = { tier_1: [], tier_2: [], tier_3: [] };
    }
    ['tier_1', 'tier_2', 'tier_3'].forEach(k => {
      if (!Array.isArray(draft.tier_rules_json[k])) draft.tier_rules_json[k] = [];
    });
    App.state.scoreConfigModal = { ...m, icpDraft: draft };
    App.render();
  },

  cancelIcpDraft() {
    App.state.scoreConfigModal = { ...(App.state.scoreConfigModal || {}), icpDraft: null };
    App.render();
  },

  updateIcpDraftField(key, value) {
    const m = App.state.scoreConfigModal;
    if (!m?.icpDraft) return;
    const fields = { ...(m.icpDraft.fields_json || {}) };
    if (value === '' || value === null || value === undefined) {
      delete fields[key];
    } else if (typeof value === 'string' && value.includes(',')) {
      // Lista de valores separados por vírgula → array
      fields[key] = value.split(',').map(v => v.trim()).filter(Boolean);
    } else {
      fields[key] = value;
    }
    App.state.scoreConfigModal.icpDraft.fields_json = fields;
  },

  // V34.9.13 — Builder de regras de tier (modo HubSpot puro).
  // Estrutura: icpDraft.tier_rules_json = { tier_1: [[cond, cond], [cond]], tier_2: [...], tier_3: [...] }
  // Cada tier tem grupos AND (OR entre grupos).

  // V34.9.14 — Preserva scroll do modal entre renders pra evitar pulos visuais.
  _renderPreservingScroll() {
    const backdrop = document.getElementById('scoreConfigBackdrop');
    const scrollTop = backdrop?.scrollTop || 0;
    App.render();
    requestAnimationFrame(() => {
      const newBackdrop = document.getElementById('scoreConfigBackdrop');
      if (newBackdrop) newBackdrop.scrollTop = scrollTop;
    });
  },

  setIcpDraftTierMethod(method) {
    const d = App.state.scoreConfigModal?.icpDraft;
    if (!d) return;
    d.tier_method = (method === 'rules') ? 'rules' : 'percentage';
    if (!d.tier_rules_json) d.tier_rules_json = { tier_1: [], tier_2: [], tier_3: [] };
    Actions._renderPreservingScroll();
  },

  _ensureTierRules(d) {
    if (!d.tier_rules_json) d.tier_rules_json = { tier_1: [], tier_2: [], tier_3: [] };
    ['tier_1', 'tier_2', 'tier_3'].forEach(k => {
      if (!Array.isArray(d.tier_rules_json[k])) d.tier_rules_json[k] = [];
    });
    return d.tier_rules_json;
  },

  addTierRuleGroup(tier) {
    const d = App.state.scoreConfigModal?.icpDraft;
    if (!d) return;
    const rules = Actions._ensureTierRules(d);
    rules[`tier_${tier}`].push([{ field: 'estado', op: '=', value: '' }]);
    Actions._renderPreservingScroll();
  },

  removeTierRuleGroup(tier, groupIndex) {
    const d = App.state.scoreConfigModal?.icpDraft;
    if (!d) return;
    const rules = Actions._ensureTierRules(d);
    rules[`tier_${tier}`].splice(groupIndex, 1);
    Actions._renderPreservingScroll();
  },

  addTierRuleCondition(tier, groupIndex) {
    const d = App.state.scoreConfigModal?.icpDraft;
    if (!d) return;
    const rules = Actions._ensureTierRules(d);
    const group = rules[`tier_${tier}`][groupIndex];
    if (!group) return;
    group.push({ field: 'estado', op: '=', value: '' });
    Actions._renderPreservingScroll();
  },

  removeTierRuleCondition(tier, groupIndex, condIndex) {
    const d = App.state.scoreConfigModal?.icpDraft;
    if (!d) return;
    const rules = Actions._ensureTierRules(d);
    const group = rules[`tier_${tier}`][groupIndex];
    if (!group) return;
    group.splice(condIndex, 1);
    if (group.length === 0) rules[`tier_${tier}`].splice(groupIndex, 1);
    Actions._renderPreservingScroll();
  },

  updateTierRuleCondition(tier, groupIndex, condIndex, key, value) {
    const d = App.state.scoreConfigModal?.icpDraft;
    if (!d) return;
    const rules = Actions._ensureTierRules(d);
    const cond = rules[`tier_${tier}`]?.[groupIndex]?.[condIndex];
    if (!cond) return;
    if (key === 'value' && typeof value === 'string' && value.includes(',')) {
      cond.value = value.split(',').map(v => v.trim()).filter(Boolean);
    } else if (key === 'value' && (cond.op === '>' || cond.op === '<' || cond.op === '>=' || cond.op === '<=')) {
      cond.value = Number(value) || 0;
    } else {
      cond[key] = value;
    }
    // Render só em mudança de operador/campo (não em valor — perderia foco)
    if (key !== 'value') Actions._renderPreservingScroll();
  },

  async saveIcpDraft() {
    const draft = App.state.scoreConfigModal?.icpDraft;
    if (!draft) return;
    const token = localStorage.getItem('lj_jwt');
    try {
      const res = await fetch('/api/icp-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(draft)
      });
      const data = await res.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      Utils.toast('✓ ICP salvo. Recalculando leads…');
      App.state.scoreConfigModal.icpProfile = data.profile;
      App.state.scoreConfigModal.icpDraft = null;
      App.render();
      // Dispara recálculo em batch (fit afeta scores)
      try {
        await fetch('/api/score-recalc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ batch_decay: true, max_visitors: 1000 })
        });
      } catch (_) {}
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // ===== V34.9.20 — Sub-Funil Modal (mini-funil por bolinha × campanha) =====

  async openSubStageFunnelModal(campaignId, parentStage) {
    App.state.subStageFunnelModal = {
      open: true,
      campaignId: Number(campaignId),
      parentStage: String(parentStage),
      substages: [],
      knownTags: App.state._knownTagsCache || [],
      loading: true,
      savingId: null
    };
    App.render();
    try {
      const token = localStorage.getItem('lj_jwt');
      const [subsRes, tagsRes] = await Promise.all([
        fetch(`/api/substages?campaign_id=${campaignId}&parent_stage=${encodeURIComponent(parentStage)}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/known-tags', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      const data = await subsRes.json();
      const tagsData = await tagsRes.json();
      App.state.subStageFunnelModal.substages = data.ok && Array.isArray(data.substages) ? data.substages : [];
      App.state.subStageFunnelModal.knownTags = tagsData.ok && Array.isArray(tagsData.tags) ? tagsData.tags : [];
      App.state._knownTagsCache = App.state.subStageFunnelModal.knownTags;
      App.state.subStageFunnelModal.loading = false;
      App.render();
    } catch (err) {
      App.state.subStageFunnelModal.loading = false;
      App.render();
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  closeSubStageFunnelModal() {
    App.state.subStageFunnelModal = { open: false, campaignId: null, parentStage: null, substages: [], loading: false, savingId: null };
    App.render();
  },

  // V35.2.0 — Carrega sugestões Hotmart pra bolinha atual e expõe na UI.
  async loadHotmartSuggestions() {
    const m = App.state.subStageFunnelModal;
    if (!m?.open) return;
    const token = localStorage.getItem('lj_jwt');
    try {
      const r = await fetch(`/api/hotmart-event-suggestions?parent_stage=${encodeURIComponent(m.parentStage)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await r.json();
      m.hotmartSuggestions = data.ok ? (data.suggestions || []) : [];
      m.hotmartSuggestionsOpen = true;
      App.render();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  hideHotmartSuggestions() {
    const m = App.state.subStageFunnelModal;
    if (!m?.open) return;
    m.hotmartSuggestionsOpen = false;
    App.render();
  },

  // V35.2.0 — Cria sub-stage a partir de sugestão Hotmart (nome + tag pré-preenchidos).
  async createSubStageFromSuggestion(tag, name) {
    const m = App.state.subStageFunnelModal;
    if (!m?.open) return;
    const orderIdx = (m.substages || []).length;
    const token = localStorage.getItem('lj_jwt');
    try {
      const r = await fetch('/api/substages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          campaign_id: m.campaignId,
          parent_stage: m.parentStage,
          order_idx: orderIdx,
          name: name,
          tag_trigger: tag
        })
      });
      const data = await r.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      m.substages.push({ ...data.substage, leadCount: 0 });
      Utils.toast(`✓ "${name}" criado`);
      App.render();
      Actions._refetchSubStageCounts();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  async addSubStage() {
    const m = App.state.subStageFunnelModal;
    if (!m?.open) return;
    const token = localStorage.getItem('lj_jwt');
    const orderIdx = m.substages.length; // próxima posição
    const nextName = `Sub-stage ${orderIdx + 1}`;
    try {
      const r = await fetch('/api/substages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          campaign_id: m.campaignId,
          parent_stage: m.parentStage,
          order_idx: orderIdx,
          name: nextName,
          tag_trigger: null
        })
      });
      const data = await r.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      m.substages.push({ ...data.substage, leadCount: 0 });
      App.render();
    } catch (err) { Utils.toast(`Erro: ${err.message}`); }
  },

  // V34.9.20 — Atualização local de campo (preserva foco do input).
  // Persiste em background sem App.render.
  updateSubStageLocal(id, field, value) {
    const m = App.state.subStageFunnelModal;
    if (!m?.open) return;
    const sub = m.substages.find(s => Number(s.id) === Number(id));
    if (!sub) return;
    sub[field] = value;
    // V34.9.21 — Valida tag_trigger inline + render leve só do estado de erro
    if (field === 'tag_trigger') {
      const ok = Actions._validateSubStageTag(sub);
      // Atualiza o status visual do erro sem perder foco (busca o elemento direto)
      const errEl = document.getElementById(`substage-tag-err-${id}`);
      if (errEl) errEl.textContent = sub._tagError || '';
      const inputEl = document.querySelector(`[data-substage-tag-input="${id}"]`);
      if (inputEl) inputEl.classList.toggle('border-red-400', !!sub._tagError);
      if (!ok) return; // não persiste se duplicado
    }
    Actions._scheduleSubStageSave(id);
  },

  _subStageSaveTimers: {},
  _scheduleSubStageSave(id) {
    clearTimeout(Actions._subStageSaveTimers[id]);
    Actions._subStageSaveTimers[id] = setTimeout(() => Actions.persistSubStage(id), 600);
  },

  async persistSubStage(id) {
    const m = App.state.subStageFunnelModal;
    if (!m?.open) return;
    const sub = m.substages.find(s => Number(s.id) === Number(id));
    if (!sub) return;
    // V34.9.21 — Não persiste se há erro de tag duplicada
    if (sub._tagError) return;
    const token = localStorage.getItem('lj_jwt');
    try {
      m.savingId = id;
      const r = await fetch('/api/substages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          id: sub.id,
          campaign_id: m.campaignId,
          parent_stage: m.parentStage,
          order_idx: sub.order_idx,
          name: sub.name || `Sub-stage ${sub.order_idx + 1}`,
          tag_trigger: sub.tag_trigger || null,
          color: sub.color || null
        })
      });
      const data = await r.json();
      if (!data.ok) Utils.toast(`Falha: ${data.message}`);
      m.savingId = null;
      // V34.9.21 — Refetch contagens pra refletir redistribuição dos leads pela nova tag
      if (data.ok) Actions._refetchSubStageCounts();
    } catch (err) {
      m.savingId = null;
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  async deleteSubStage(id) {
    if (!confirm('Remover este sub-stage? Leads vão recair na entrada padrão.')) return;
    const token = localStorage.getItem('lj_jwt');
    const m = App.state.subStageFunnelModal;
    try {
      const r = await fetch(`/api/substages?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await r.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      if (m?.open) {
        m.substages = m.substages.filter(s => Number(s.id) !== Number(id));
        App.render();
        Actions._refetchSubStageCounts();
      }
    } catch (err) { Utils.toast(`Erro: ${err.message}`); }
  },

  // V35.0.0 — Abre Buscador com filtro de sub-stage ativo. Fecha o modal sub-funil
  // e navega pra tab Leads.
  async openBuscadorWithSubStageFilter(substageId) {
    const m = App.state.subStageFunnelModal;
    if (!m?.open) return;
    const sub = m.substages.find(s => Number(s.id) === Number(substageId));
    if (!sub) return;
    App.state.subStageActiveFilter = {
      campaignId: m.campaignId,
      parentStage: m.parentStage,
      substageId: Number(substageId),
      substageName: sub.name || `Sub-stage ${sub.order_idx + 1}`,
      leads: [],
      loading: true
    };
    Actions.closeSubStageFunnelModal();
    App.state.activeTab = 'leads';
    App.save();
    App.render();
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch(`/api/substage-leads?campaign_id=${m.campaignId}&parent_stage=${encodeURIComponent(m.parentStage)}&substage_id=${substageId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await r.json();
      App.state.subStageActiveFilter.leads = data.ok && Array.isArray(data.leads) ? data.leads : [];
      App.state.subStageActiveFilter.loading = false;
      App.render();
    } catch (err) {
      App.state.subStageActiveFilter.loading = false;
      App.render();
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  clearSubStageActiveFilter() {
    App.state.subStageActiveFilter = null;
    App.save();
    App.render();
  },

  // ===== V35.1.0 — Dashboard Checkout =====
  // V35.3.4 — aceita 5 tabs paralelas (overview | checkout | alunos | meta-ads | google-ads)
  setDashboardTab(tab) {
    // V36.10.3 — Adicionadas tabs 'ga4' e 'tarefas'.
    const valid = ['overview', 'checkout', 'alunos', 'meta-ads', 'google-ads', 'ga4', 'tarefas'];
    App.state.activeDashboardTab = valid.includes(tab) ? tab : 'overview';
    App.save();
    App.render();
  },

  // V36.10.3 — Filtros da sub-tab Tarefas do Dashboard.
  setTasksDashboardRange(range) {
    const valid = ['all', '7d', '30d', 'overdue'];
    App.state.tasksDashboardRange = valid.includes(range) ? range : 'all';
    App.save(); App.render();
  },

  setTasksDashboardProvider(provider) {
    App.state.tasksDashboardProvider = String(provider || 'all');
    App.save(); App.render();
  },

  // V37.1.0 — Sub-aba "Por Pessoa" da aba Tarefas (cross-space ClickUp).
  setTasksDashboardSubTab(tab) {
    const valid = ['geral', 'porPessoa'];
    App.state.tasksDashboardSubTab = valid.includes(tab) ? tab : 'geral';
    App.save();
    if (App.state.tasksDashboardSubTab === 'porPessoa') {
      Actions.loadTasksPersonData();
    }
    App.render();
  },

  // V37.1.9 — Modal de detalhe da pessoa substitui o expand inline (V37.1.0).
  openTasksPersonModal(userId) {
    App.state.tasksPersonModalUserId = String(userId || '');
    App.render();
  },

  closeTasksPersonModal() {
    App.state.tasksPersonModalUserId = null;
    App.render();
  },

  // ============================================================
  // V37.3.2 — Membros do tenant (UI gerenciar)
  // ============================================================
  async loadTenantMembers(force = false) {
    const cache = App.state.membersCache = App.state.membersCache || { loading: false, error: null, members: [], pendingInvites: [], loadedAt: null };
    if (!force && cache.loadedAt && (Date.now() - cache.loadedAt) < 60_000) return;
    if (cache.loading) return;
    cache.loading = true; cache.error = null;
    App.render();
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/tenant-members-list', { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      if (!data.ok) throw new Error(data.message || 'Falha ao listar membros.');
      cache.members = data.members || [];
      cache.pendingInvites = data.pendingInvites || [];
      cache.loadedAt = Date.now();
      cache.loading = false;
      App.render();
    } catch (err) {
      cache.error = err.message;
      cache.loading = false;
      App.render();
    }
  },

  refreshTenantMembers() {
    Actions.loadTenantMembers(true);
  },

  openMemberEditModal(userId) {
    const member = (App.state.membersCache?.members || []).find(m => m.userId === userId);
    if (!member) return Utils.toast('Membro não encontrado.');
    App.state.memberEditModal = {
      userId,
      saving: false,
      sendingReset: false,
      sendingEmailChange: false,
      actionResult: null,
      draft: {
        role: member.role,
        overrides: { ...(member.permissionsOverrides || {}) },
        effective: this._computeEffectivePermissionsFromTemplate(member.role, member.permissionsOverrides || {})
      }
    };
    App.render();
  },

  closeMemberEditModal() {
    App.state.memberEditModal = null;
    App.state.memberPermissionsModal = false;
    App.render();
  },

  // V37.4.28 — Sub-modal de permissões granulares (sobreposto ao Editar Membro).
  openMemberPermissionsModal() {
    App.state.memberPermissionsModal = true;
    App.render();
  },
  closeMemberPermissionsModal() {
    App.state.memberPermissionsModal = false;
    App.render();
  },

  // V37.4.31 — Reset de senha SEM email. Marca user pra trocar senha no próximo login.
  // Não envia link, não gera senha temporária. Janela de 24h.
  async triggerMemberPasswordReset(userId) {
    const modal = App.state.memberEditModal;
    if (!modal) return;
    if (!confirm('Marcar este membro pra resetar a senha?\n\nNo próximo login, ele vai cair direto na tela de "Defina nova senha" — sem precisar saber a senha atual. Janela de 24h.')) return;
    modal.sendingReset = true; modal.actionResult = null; App.render();
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/tenant-member-reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId })
      });
      const data = await r.json();
      modal.sendingReset = false;
      if (!data.ok) {
        Utils.toast(`Erro: ${data.message}`);
      } else {
        Utils.toast(`✓ ${data.message}`);
      }
      App.render();
    } catch (err) {
      modal.sendingReset = false; App.render();
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V37.4.28 — Owner manda email pro membro com link mágico de reset de senha.
  // (Backup pra quando SMTP estiver configurado com domínio próprio — hoje
  // V37.4.31 mudou pro fluxo sem email como default.)
  async sendMemberPasswordReset(userId) {
    const modal = App.state.memberEditModal;
    if (!modal) return;
    if (!confirm('Enviar email com link de reset de senha pra este membro?\n\nO link permite criar uma nova senha sem precisar da atual.')) return;
    modal.sendingReset = true; modal.actionResult = null; App.render();
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/tenant-member-send-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId })
      });
      const data = await r.json();
      modal.sendingReset = false;
      if (!data.ok) {
        Utils.toast(`Erro: ${data.message}`);
      } else {
        modal.actionResult = data;
        Utils.toast(data.emailSent ? '✓ Email enviado.' : 'Convite criado — copie o link.');
      }
      App.render();
    } catch (err) {
      modal.sendingReset = false; App.render();
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V37.4.28 — Owner solicita ao membro a troca do próprio email.
  async sendMemberEmailChange(userId) {
    const modal = App.state.memberEditModal;
    if (!modal) return;
    if (!confirm('Enviar email com link pra trocar o email da conta?\n\nO membro precisa abrir o link no email ATUAL e confirmar a troca com a senha atual.')) return;
    modal.sendingEmailChange = true; modal.actionResult = null; App.render();
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/tenant-member-send-email-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId })
      });
      const data = await r.json();
      modal.sendingEmailChange = false;
      if (!data.ok) {
        Utils.toast(`Erro: ${data.message}`);
      } else {
        modal.actionResult = data;
        Utils.toast(data.emailSent ? '✓ Email enviado.' : 'Link criado — copie e envie.');
      }
      App.render();
    } catch (err) {
      modal.sendingEmailChange = false; App.render();
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  copyMemberActionUrl() {
    const url = App.state.memberEditModal?.actionResult?.actionUrl;
    if (!url) return Utils.toast('Link não disponível.');
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url);
      Utils.toast('✓ Link copiado.');
    } else {
      prompt('Copie este link:', url);
    }
  },

  updateMemberEditDraft(field, value) {
    const modal = App.state.memberEditModal;
    if (!modal) return;
    if (field === 'role') {
      modal.draft.role = value;
      modal.draft.effective = this._computeEffectivePermissionsFromTemplate(value, modal.draft.overrides);
    }
    App.render();
  },

  toggleMemberPermissionOverride(key, value) {
    const modal = App.state.memberEditModal;
    if (!modal) return;
    modal.draft.overrides = { ...(modal.draft.overrides || {}), [key]: Boolean(value) };
    modal.draft.effective = this._computeEffectivePermissionsFromTemplate(modal.draft.role, modal.draft.overrides);
    App.render();
  },

  clearMemberPermissionOverride(key) {
    const modal = App.state.memberEditModal;
    if (!modal) return;
    const next = { ...(modal.draft.overrides || {}) };
    delete next[key];
    modal.draft.overrides = next;
    modal.draft.effective = this._computeEffectivePermissionsFromTemplate(modal.draft.role, modal.draft.overrides);
    App.render();
  },

  async saveMemberEdit() {
    const modal = App.state.memberEditModal;
    if (!modal || modal.saving) return;
    modal.saving = true; App.render();
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/tenant-member-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          tenantId: App.state.user?.tenantId,
          userId: modal.userId,
          role: modal.draft.role,
          permissionsOverrides: modal.draft.overrides
        })
      });
      const data = await r.json();
      if (!data.ok) throw new Error(data.message || 'Falha ao salvar.');
      Utils.toast('✓ Permissões atualizadas.');
      App.state.memberEditModal = null;
      await Actions.refreshTenantMembers();
    } catch (err) {
      modal.saving = false;
      Utils.toast(`Erro: ${err.message}`);
      App.render();
    }
  },

  async removeTenantMember(userId, email) {
    if (!confirm(`Remover ${email} do tenant? O usuário fica cadastrado, mas perde acesso a este workspace.`)) return;
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/tenant-member-remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tenantId: App.state.user?.tenantId, userId })
      });
      const data = await r.json();
      if (!data.ok) throw new Error(data.message || 'Falha ao remover.');
      Utils.toast('✓ Membro removido.');
      await Actions.refreshTenantMembers();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // Helper: aplica template base + overrides pra preview de permissões efetivas.
  // Mantém em sincronia com lib/permission-engine.js (cópia client-side).
  _computeEffectivePermissionsFromTemplate(role, overrides) {
    const TEMPLATES = {
      owner: {
        'view.dashboard': true, 'view.mapa': true, 'view.dre': true,
        'view.revops': true, 'view.financeiro': true, 'view.score': true,
        'view.leads': true, 'view.checkout': true, 'view.tarefas': true,
        'edit.mapa': true, 'edit.campanha': true, 'edit.acao': true,
        'edit.produto': true, 'edit.score': true, 'edit.kpi': true, 'edit.kr': true,
        'ops.integracoes': true, 'ops.lead_import': true, 'ops.lead_export': true,
        'ops.rd_sync': true, 'ops.tasks': true,
        'admin.convidar_membro': true, 'admin.editar_role': true,
        'admin.remover_membro': true, 'admin.editar_billing': true,
        'admin.editar_db_tenant': true, 'djow': true
      },
      manager: {
        'view.dashboard': true, 'view.mapa': true, 'view.dre': true,
        'view.revops': true, 'view.financeiro': true, 'view.score': true,
        'view.leads': true, 'view.checkout': true, 'view.tarefas': true,
        'edit.mapa': true, 'edit.campanha': true, 'edit.acao': true,
        'edit.produto': true, 'edit.score': false, 'edit.kpi': true, 'edit.kr': true,
        'ops.integracoes': false, 'ops.lead_import': true, 'ops.lead_export': true,
        'ops.rd_sync': true, 'ops.tasks': true,
        'admin.convidar_membro': false, 'admin.editar_role': false,
        'admin.remover_membro': false, 'admin.editar_billing': false,
        'admin.editar_db_tenant': false, 'djow': true
      },
      user: {
        'view.dashboard': true, 'view.mapa': true, 'view.dre': false,
        'view.revops': false, 'view.financeiro': false, 'view.score': false,
        'view.leads': false, 'view.checkout': false, 'view.tarefas': true,
        'edit.mapa': false, 'edit.campanha': false, 'edit.acao': false,
        'edit.produto': false, 'edit.score': false, 'edit.kpi': false, 'edit.kr': false,
        'ops.integracoes': false, 'ops.lead_import': false, 'ops.lead_export': false,
        'ops.rd_sync': false, 'ops.tasks': true,
        'admin.convidar_membro': false, 'admin.editar_role': false,
        'admin.remover_membro': false, 'admin.editar_billing': false,
        'admin.editar_db_tenant': false, 'djow': true
      }
    };
    const base = TEMPLATES[role] || TEMPLATES.user;
    const out = { ...base };
    if (overrides && typeof overrides === 'object') {
      for (const [k, v] of Object.entries(overrides)) {
        if (typeof v === 'boolean') out[k] = v;
      }
    }
    return out;
  },

  // V37.3.3 — Convite por email (com fallback "Copiar Link" quando SMTP off).
  openInviteMemberModal() {
    App.state.inviteModal = {
      email: '',
      role: 'user',
      saving: false,
      result: null   // { acceptUrl, emailSent, emailSimulated, smtpConfigured }
    };
    App.render();
  },

  closeInviteMemberModal() {
    App.state.inviteModal = null;
    App.render();
  },

  updateInviteDraft(field, value) {
    if (!App.state.inviteModal) return;
    if (field === 'email') App.state.inviteModal.email = String(value || '').trim().toLowerCase();
    else if (field === 'role') App.state.inviteModal.role = value;
    // não chama render (mantém foco do input)
  },

  async sendInvite() {
    const modal = App.state.inviteModal;
    if (!modal || modal.saving) return;
    if (!modal.email || !modal.email.includes('@')) return Utils.toast('Email inválido.');
    modal.saving = true; App.render();
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/tenant-invite-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          email: modal.email,
          role: modal.role,
          tenantId: App.state.user?.tenantId
        })
      });
      const data = await r.json();
      if (!data.ok) throw new Error(data.message || 'Falha ao convidar.');
      modal.result = {
        acceptUrl: data.acceptUrl,
        emailSent: Boolean(data.emailSent),
        emailSimulated: Boolean(data.emailSimulated),
        smtpConfigured: Boolean(data.smtpConfigured),
        expiresAt: data.expiresAt
      };
      modal.saving = false;
      await Actions.refreshTenantMembers();
      App.render();
    } catch (err) {
      modal.saving = false;
      Utils.toast(`Erro: ${err.message}`);
      App.render();
    }
  },

  copyAcceptUrlFromModal() {
    const url = App.state.inviteModal?.result?.acceptUrl;
    if (!url) return;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(
        () => Utils.toast('✓ Link copiado pra área de transferência.'),
        () => Utils.toast('Não consegui copiar — selecione manualmente.')
      );
    } else {
      const ta = document.createElement('textarea');
      ta.value = url; document.body.appendChild(ta);
      ta.select(); document.execCommand('copy');
      ta.remove();
      Utils.toast('✓ Link copiado.');
    }
  },

  // ============================================================
  // V37.4.0 — Sininho expandido (notification system)
  // ============================================================
  async loadNotifications(force = false) {
    const cache = App.state.notificationsCache = App.state.notificationsCache || { items: [], counts: { inbox: 0, saved: 0, archive: 0, snoozed: 0, criticalUnread: 0, warningUnread: 0, infoUnread: 0 }, loadedAt: null, loading: false, error: null, activeStatus: 'inbox', activeCategory: null, activeSeverity: null };
    if (!force && cache.loadedAt && (Date.now() - cache.loadedAt) < 30_000) return;
    if (cache.loading) return;
    cache.loading = true; cache.error = null;
    App.render();
    try {
      const token = localStorage.getItem('lj_jwt');
      const params = new URLSearchParams({ status: cache.activeStatus || 'inbox' });
      if (cache.activeCategory) params.set('category', cache.activeCategory);
      if (cache.activeSeverity) params.set('severity', cache.activeSeverity);
      const r = await fetch(`/api/notifications-list?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      if (!data.ok) throw new Error(data.message || 'Falha ao carregar.');
      cache.items = data.items || [];
      cache.counts = data.counts || cache.counts;
      cache.loadedAt = Date.now();
      cache.loading = false;
      App.render();
    } catch (err) {
      cache.error = err.message;
      cache.loading = false;
      App.render();
    }
  },

  refreshNotifications() {
    Actions.loadNotifications(true);
  },

  toggleNotificationsPanel() {
    App.state.notificationsPanelOpen = !App.state.notificationsPanelOpen;
    if (App.state.notificationsPanelOpen) Actions.loadNotifications();
    App.render();
  },

  closeNotificationsPanel() {
    App.state.notificationsPanelOpen = false;
    App.render();
  },

  setNotificationStatus(status) {
    const cache = App.state.notificationsCache;
    if (!cache) return;
    cache.activeStatus = ['inbox', 'saved', 'archive', 'snoozed'].includes(status) ? status : 'inbox';
    cache.loadedAt = null;
    Actions.loadNotifications(true);
  },

  setNotificationCategoryFilter(category) {
    const cache = App.state.notificationsCache;
    if (!cache) return;
    cache.activeCategory = category || null;
    cache.loadedAt = null;
    Actions.loadNotifications(true);
  },

  setNotificationSeverityFilter(severity) {
    const cache = App.state.notificationsCache;
    if (!cache) return;
    cache.activeSeverity = severity || null;
    cache.loadedAt = null;
    Actions.loadNotifications(true);
  },

  async updateNotification(id, action, snoozeUntil = null) {
    try {
      const token = localStorage.getItem('lj_jwt');
      const body = { id, action };
      if (snoozeUntil) body.snoozeUntil = snoozeUntil;
      const r = await fetch('/api/notification-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      const data = await r.json();
      if (!data.ok) throw new Error(data.message || 'Falha ao atualizar.');
      await Actions.refreshNotifications();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V37.5.2 + V37.4.9 — Handler universal de click numa notification.
  // Switch por kind + data.action pra rotear pra ação certa do app.
  handleNotificationClick(id) {
    const cache = App.state.notificationsCache;
    const n = (cache?.items || []).find(x => x.id === id);
    if (!n) return Actions.updateNotification(id, 'read');

    // Special-case Pin-Up
    if (n.kind === 'handoff.pin_mentioned' && n.data?.targetUrl && n.data?.pinId) {
      Actions.updateNotification(id, 'read');
      Actions.closeNotificationsPanel();
      // V38.0.1 — targetUrl agora vem como `${pathname}#tab=<activeTab>`.
      // Se for só mudança de aba (mesmo pathname), faz switch sem reload.
      const target = String(n.data.targetUrl || '');
      const currentScope = window.PinUp?._currentPinScope?.() || (window.location.pathname + window.location.search);
      if (currentScope === target) {
        setTimeout(() => Actions.openPinView(Number(n.data.pinId)), 100);
      } else {
        const hashIdx = target.indexOf('#tab=');
        const targetPath = hashIdx >= 0 ? target.slice(0, hashIdx) : target;
        const targetTab = hashIdx >= 0 ? target.slice(hashIdx + 5) : null;
        // Mesmo pathname → só troca aba in-place e abre pin.
        if (targetPath === window.location.pathname && targetTab) {
          App.state.activeTab = targetTab;
          App.save();
          App.render();
          setTimeout(() => Actions.openPinView(Number(n.data.pinId)), 200);
        } else {
          // Pathname diferente (caso futuro multi-route) — recarrega.
          sessionStorage.setItem('lj_pin_to_open_after_nav', String(n.data.pinId));
          window.location.href = target;
        }
      }
      return;
    }

    // V37.4.9 — Routing por data.action (alertas legados migrados)
    const action = n.data?.action;
    if (action) {
      Actions.updateNotification(id, 'read');
      Actions.closeNotificationsPanel();
      setTimeout(() => {
        switch (action) {
          case 'open_recon':
            if (window.Actions?.openReconciliationModal) Actions.openReconciliationModal();
            else if (window.Actions?.openNotificationsModal) Actions.openNotificationsModal();
            break;
          case 'open_import_reports':
            if (window.Actions?.openLeadImportReportsModal) Actions.openLeadImportReportsModal();
            else if (window.Actions?.openLeadImportWizard) Actions.openLeadImportWizard();
            break;
          case 'open_releases':
            if (window.Actions?.openReleasesModal) Actions.openReleasesModal();
            else if (window.Actions?.openNotificationsModal) Actions.openNotificationsModal();
            break;
          case 'open_ads_orphans':
            if (window.Actions?.setView) Actions.setView('dashboard');
            App.state.googleAdsDashboardSubTab = 'orphans';
            App.render();
            break;
          case 'open_ga4':
            if (window.Actions?.openGa4Wizard) Actions.openGa4Wizard();
            else if (window.Actions?.openSettingsModal) {
              Actions.openSettingsModal();
              Actions.setSettingsSection?.('integrations');
            }
            break;
          case 'open_monthly_closing':
            if (window.Actions?.setView) Actions.setView('revops');
            App.render();
            break;
          default:
            console.warn('[handleNotificationClick] action desconhecida:', action);
        }
      }, 100);
      return;
    }

    // Default: só mark as read
    Actions.updateNotification(id, 'read');
  },

  // ============================================================
  // V37.5.0 — Pin-Up MVP
  // ============================================================
  togglePinMode() {
    App.state.pinModeActive = !App.state.pinModeActive;
    if (App.state.pinModeActive) {
      // Carrega membros se ainda não tiver pra modal de cravar
      if (!App.state.membersCache?.loadedAt) Actions.loadTenantMembers();
      // ESC cancela
      const escHandler = (e) => {
        if (e.key === 'Escape') {
          App.state.pinModeActive = false;
          App.render();
          document.removeEventListener('keydown', escHandler);
        }
      };
      document.addEventListener('keydown', escHandler);
    }
    App.render();
  },

  capturePinPosition(event) {
    if (!App.state.pinModeActive) return;
    const xPct = (event.clientX / window.innerWidth) * 100;
    const yPct = (event.clientY / window.innerHeight) * 100;
    App.state.pinModeActive = false;
    App.state.pinUp = App.state.pinUp || { pinsForCurrentUrl: [], createModal: null, viewModal: null };
    App.state.pinUp.createModal = {
      xPct: Math.round(xPct * 100) / 100,
      yPct: Math.round(yPct * 100) / 100,
      audienceUserIds: [],
      text: '',
      saving: false
    };
    App.render();
  },

  closePinCreate() {
    if (App.state.pinUp) App.state.pinUp.createModal = null;
    App.render();
  },

  togglePinAudience(userId, checked) {
    const modal = App.state.pinUp?.createModal;
    if (!modal) return;
    const set = new Set(modal.audienceUserIds || []);
    if (checked) set.add(userId); else set.delete(userId);
    modal.audienceUserIds = Array.from(set);
    App.render();
  },

  updatePinDraft(field, value) {
    const modal = App.state.pinUp?.createModal;
    if (!modal) return;
    modal[field] = value;
    // não render — mantém foco
  },

  async submitPin() {
    const modal = App.state.pinUp?.createModal;
    if (!modal || modal.saving) return;
    if (!modal.audienceUserIds.length) return Utils.toast('Marque pelo menos 1 membro.');
    if (!modal.text || !modal.text.trim()) return Utils.toast('Escreva uma mensagem.');
    modal.saving = true; App.render();
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/pin-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          // V38.0.1 — Scope inclui aba ativa (`pathname#tab=<activeTab>`) — antes
          // pins vazavam entre abas porque LJ é SPA.
          targetUrl: window.PinUp?._currentPinScope?.() || (window.location.pathname + window.location.search),
          anchorXPct: modal.xPct,
          anchorYPct: modal.yPct,
          text: modal.text.trim(),
          audienceUserIds: modal.audienceUserIds
        })
      });
      const data = await r.json();
      if (!data.ok) throw new Error(data.message || 'Falha ao cravar pin.');
      Utils.toast('✓ Pin cravado.');
      App.state.pinUp.createModal = null;
      await Actions.loadPinsForCurrentUrl();
    } catch (err) {
      modal.saving = false;
      Utils.toast(`Erro: ${err.message}`);
      App.render();
    }
  },

  async loadPinsForCurrentUrl() {
    App.state.pinUp = App.state.pinUp || { pinsForCurrentUrl: [], createModal: null, viewModal: null, clusterExpanded: false };
    try {
      const token = localStorage.getItem('lj_jwt');
      // V38.0.1 — Scope inclui aba ativa (vide PinUp._currentPinScope).
      const url = window.PinUp?._currentPinScope?.() || (window.location.pathname + window.location.search);
      const r = await fetch(`/api/pins-list?targetUrl=${encodeURIComponent(url)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await r.json();
      if (data.ok) {
        App.state.pinUp.pinsForCurrentUrl = data.pins || [];
        // V37.5.2 — Se voltou de navegação via notification, abre o pin solicitado
        const pinToOpen = sessionStorage.getItem('lj_pin_to_open_after_nav');
        if (pinToOpen) {
          sessionStorage.removeItem('lj_pin_to_open_after_nav');
          setTimeout(() => Actions.openPinView(Number(pinToOpen)), 200);
        }
        App.render();
      }
    } catch (err) {
      console.warn('[loadPinsForCurrentUrl]', err.message);
    }
  },

  // ============================================================
  // V37.4.6 — Notification Preferences
  // ============================================================
  async loadNotificationPrefs(force = false) {
    const cache = App.state.notificationPrefsCache = App.state.notificationPrefsCache || { loading: false, prefs: null, weeklyDigest: false, lastDigestSentAt: null, error: null };
    if (!force && cache.prefs) return;
    cache.loading = true; cache.error = null;
    App.render();
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/notification-preferences', { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      if (!data.ok) throw new Error(data.message || 'Falha ao carregar preferências.');
      cache.prefs = data.preferences || {};
      cache.weeklyDigest = Boolean(data.weeklyDigest);
      cache.lastDigestSentAt = data.lastDigestSentAt || null;
      cache.loading = false;
      App.render();
    } catch (err) {
      cache.loading = false;
      cache.error = err.message;
      App.render();
    }
  },

  async updateNotificationPref(category, field, value) {
    const cache = App.state.notificationPrefsCache;
    if (!cache?.prefs) return;
    cache.prefs[category] = cache.prefs[category] || { inApp: true, email: false };
    cache.prefs[category][field] = value;
    App.render();
    try {
      const token = localStorage.getItem('lj_jwt');
      const body = { category };
      body[field] = value;
      const other = field === 'inApp' ? 'email' : 'inApp';
      body[other] = Boolean(cache.prefs[category][other]);
      const r = await fetch('/api/notification-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      const data = await r.json();
      if (!data.ok) throw new Error(data.message || 'Falha ao salvar.');
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
      Actions.loadNotificationPrefs(true);
    }
  },

  async updateWeeklyDigest(enabled) {
    const cache = App.state.notificationPrefsCache;
    if (!cache) return;
    cache.weeklyDigest = enabled;
    App.render();
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/notification-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ weeklyDigest: enabled })
      });
      const data = await r.json();
      if (!data.ok) throw new Error(data.message || 'Falha ao salvar.');
      Utils.toast(enabled ? '✓ Digest semanal ativado.' : '✓ Digest desativado.');
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
      Actions.loadNotificationPrefs(true);
    }
  },

  // V37.5.2 — Toggle cluster expansion (quando >5 pins)
  togglePinCluster() {
    if (!App.state.pinUp) return;
    App.state.pinUp.clusterExpanded = !App.state.pinUp.clusterExpanded;
    App.render();
  },

  openPinView(id) {
    const pin = (App.state.pinUp?.pinsForCurrentUrl || []).find(p => p.id === id);
    if (!pin) return;
    App.state.pinUp.viewModal = { pin };
    App.render();
    // Auto-marca como visto após abrir
    if (!pin.seenByMe) Actions.markPinSeen(id, true);
  },

  closePinView() {
    if (App.state.pinUp) App.state.pinUp.viewModal = null;
    App.render();
  },

  async markPinSeen(id, silent = false) {
    try {
      const token = localStorage.getItem('lj_jwt');
      await fetch('/api/pin-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, action: 'mark_seen' })
      });
      await Actions.loadPinsForCurrentUrl();
      if (!silent) Utils.toast('✓ Marcado como visto.');
    } catch (err) {
      if (!silent) Utils.toast(`Erro: ${err.message}`);
    }
  },

  async archivePin(id) {
    if (!confirm('Arquivar este pin? Some pra todos os marcados.')) return;
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/pin-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, action: 'archive' })
      });
      const data = await r.json();
      if (!data.ok) throw new Error(data.message || 'Falha ao arquivar.');
      Utils.toast('✓ Pin arquivado.');
      App.state.pinUp.viewModal = null;
      await Actions.loadPinsForCurrentUrl();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V37.4.38 — "Remover" do creator: alias semântico de archive, mas com confirm
  // diferente ("Remover" em vez de "Arquivar pra todos") pra ficar mais natural.
  async deletePin(id) {
    if (!confirm('Remover este pin? Ele some pra todo mundo.')) return;
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/pin-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, action: 'archive' })
      });
      const data = await r.json();
      if (!data.ok) throw new Error(data.message || 'Falha ao remover.');
      Utils.toast('✓ Pin removido.');
      App.state.pinUp.viewModal = null;
      await Actions.loadPinsForCurrentUrl();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V37.4.38 — Abrir modal de edição: preenche com valores atuais do pin.
  openPinEdit(id) {
    const pin = (App.state.pinUp?.pinsForCurrentUrl || []).find(p => p.id === id);
    if (!pin) return;
    App.state.pinUp.editModal = {
      id: pin.id,
      text: pin.text || '',
      audienceUserIds: Array.isArray(pin.audienceUserIds) ? [...pin.audienceUserIds] : [],
      saving: false
    };
    App.state.pinUp.viewModal = null;
    App.render();
  },

  closePinEdit() {
    if (App.state.pinUp) App.state.pinUp.editModal = null;
    App.render();
  },

  updatePinEditField(field, value) {
    const modal = App.state.pinUp?.editModal;
    if (!modal) return;
    modal[field] = value;
  },

  togglePinEditAudience(userId, checked) {
    const modal = App.state.pinUp?.editModal;
    if (!modal) return;
    const set = new Set(modal.audienceUserIds || []);
    if (checked) set.add(userId); else set.delete(userId);
    modal.audienceUserIds = Array.from(set);
    App.render();
  },

  async submitPinEdit() {
    const modal = App.state.pinUp?.editModal;
    if (!modal || modal.saving) return;
    if (!modal.audienceUserIds.length) return Utils.toast('Marque pelo menos 1 membro.');
    if (!modal.text || !modal.text.trim()) return Utils.toast('Escreva uma mensagem.');
    modal.saving = true; App.render();
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/pin-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          id: modal.id,
          text: modal.text.trim(),
          audienceUserIds: modal.audienceUserIds
        })
      });
      const data = await r.json();
      if (!data.ok) throw new Error(data.message || 'Falha ao salvar pin.');
      Utils.toast('✓ Pin atualizado.');
      App.state.pinUp.editModal = null;
      await Actions.loadPinsForCurrentUrl();
    } catch (err) {
      modal.saving = false;
      Utils.toast(`Erro: ${err.message}`);
      App.render();
    }
  },

  // V37.4.4 — Cluster expand toggle
  toggleClusterExpanded(key) {
    if (!App.state.notificationClusterExpanded) App.state.notificationClusterExpanded = {};
    App.state.notificationClusterExpanded[key] = !App.state.notificationClusterExpanded[key];
    App.render();
  },

  // V37.4.4 — Bom Dia card actions
  dismissBomDia() {
    if (window.BomDiaCard) window.BomDiaCard.markAsSeen();
    App.state.bomDiaDismissed = true;
    App.render();
  },

  openNotificationsFromBomDia() {
    if (window.BomDiaCard) window.BomDiaCard.markAsSeen();
    App.state.bomDiaDismissed = true;
    App.state.notificationsPanelOpen = true;
    Actions.loadNotifications(true);
    App.render();
  },

  snoozeNotificationPrompt(id) {
    // Snooze rápido: oferece presets em modal simples via prompt.
    // V37.4.4 pode evoluir pra dropdown elegante.
    const choice = prompt('Adiar por: 1=1h, 2=amanhã 9h, 3=próxima segunda 9h, 4=1 semana');
    if (!choice) return;
    const now = new Date();
    let until = null;
    if (choice === '1') {
      until = new Date(now.getTime() + 60 * 60 * 1000);
    } else if (choice === '2') {
      until = new Date(now);
      until.setDate(until.getDate() + 1);
      until.setHours(9, 0, 0, 0);
    } else if (choice === '3') {
      until = new Date(now);
      const dow = until.getDay();
      const daysToMon = ((1 - dow + 7) % 7) || 7;
      until.setDate(until.getDate() + daysToMon);
      until.setHours(9, 0, 0, 0);
    } else if (choice === '4') {
      until = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    } else {
      return Utils.toast('Opção inválida.');
    }
    Actions.updateNotification(id, 'snooze', until.toISOString());
  },

  async markAllNotificationsAsRead() {
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/notification-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bulk: 'mark_all_read' })
      });
      const data = await r.json();
      if (!data.ok) throw new Error(data.message || 'Falha.');
      Utils.toast('✓ Tudo marcado como lido.');
      await Actions.refreshNotifications();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V37.3.4 — Carrega permissões efetivas do user logado no tenant ativo.
  // Chamado no boot (depois de auth-me). Popula App.state.userPermissions
  // que window.LJCan(key) consome em toda a UI.
  async loadMyPermissions() {
    try {
      const token = localStorage.getItem('lj_jwt');
      if (!token) return;
      let r = await fetch('/api/my-permissions', { headers: { Authorization: `Bearer ${token}` } });
      let data = await r.json();

      // V37.4.20 — Self-healing pra users legados (pré-V37.3) sem row em
      // tenant_members. Se role=null mas não é Master e tem tenant → tenta
      // backfill self-service. Re-consulta my-permissions depois.
      if (data.ok && data.permissions && data.permissions.role === null
          && !data.permissions.isMaster && (App.currentUser?.tenantId || App.state.user?.tenantId)) {
        try {
          const bf = await fetch('/api/auth-backfill-membership', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
          });
          const bfData = await bf.json();
          if (bfData.ok && bfData.action === 'inserted') {
            console.info('[loadMyPermissions] backfill', bfData.role, '→ refetching permissions');
            r = await fetch('/api/my-permissions', { headers: { Authorization: `Bearer ${token}` } });
            data = await r.json();
          }
        } catch (bfErr) {
          console.warn('[loadMyPermissions] backfill falhou (segue com role=null):', bfErr.message);
        }
      }

      if (data.ok && data.permissions) {
        App.state.userPermissions = data.permissions;
        // Atualiza tb App.state.user pro membersPanel checar role
        if (!App.state.user) App.state.user = {};
        App.state.user.tenantId = App.currentUser?.tenantId || App.state.user.tenantId;
        App.state.user.isMaster = data.permissions.isMaster;
        App.render();
      }
    } catch (err) {
      console.warn('[loadMyPermissions] erro silencioso:', err.message);
    }
  },

  async copyInviteLink(inviteId) {
    // V37.3.3 — Re-emite o convite (mesma API tenant-invite-create) e copia o link.
    const cache = App.state.membersCache;
    const invite = (cache?.pendingInvites || []).find(i => i.id === inviteId);
    if (!invite) return Utils.toast('Convite não encontrado.');
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/tenant-invite-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          email: invite.email,
          role: invite.role,
          tenantId: App.state.user?.tenantId
        })
      });
      const data = await r.json();
      if (!data.ok) throw new Error(data.message || 'Falha ao re-emitir.');
      const url = data.acceptUrl;
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        Utils.toast('✓ Link de convite copiado.');
      } else {
        prompt('Copie este link:', url);
      }
      await Actions.refreshTenantMembers();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V37.4.27 — Cancela convite pendente.
  async cancelInvite(inviteId) {
    const cache = App.state.membersCache;
    const invite = (cache?.pendingInvites || []).find(i => i.id === inviteId);
    if (!invite) return Utils.toast('Convite não encontrado.');
    if (!confirm(`Cancelar convite pra ${invite.email}?\n\nO link de aceite vira inválido imediatamente.`)) return;
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/tenant-invite-cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ inviteId })
      });
      const data = await r.json();
      if (!data.ok) throw new Error(data.message || 'Falha ao cancelar.');
      Utils.toast(`✓ ${data.message}`);
      await Actions.refreshTenantMembers();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  async loadTasksPersonData(force = false) {
    const cache = App.state.tasksPersonCache = App.state.tasksPersonCache || { fetchedAt: null, users: [], horizonDays: [], loading: false, error: null, journeyHours: 8 };
    const TTL = 5 * 60 * 1000;
    if (!force && cache.fetchedAt && (Date.now() - cache.fetchedAt) < TTL) return;
    if (cache.loading) return;

    if (!App.state.clickupStatus?.connected) {
      cache.error = 'ClickUp não conectado.';
      App.render();
      return;
    }

    const allTasks = window.ExecutionTaskStore ? (ExecutionTaskStore.all() || []) : [];
    const userIdSet = new Set();
    allTasks.forEach(t => {
      (Array.isArray(t.assignees) ? t.assignees : []).forEach(aid => userIdSet.add(String(aid)));
    });
    const userIds = Array.from(userIdSet);

    cache.loading = true;
    cache.error = null;
    App.render();

    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/clickup-user-tasks-count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ user_ids: userIds.length ? userIds : null })
      });
      const data = await r.json();
      if (!data.ok) throw new Error(data.message || 'Falha ao carregar tarefas por pessoa.');
      cache.users = data.users || [];
      cache.horizonDays = data.horizon_days || [];
      cache.journeyHours = data.journey_hours || 8;
      cache.fetchedAt = Date.now();
      cache.loading = false;
      App.render();
    } catch (err) {
      cache.error = err.message;
      cache.loading = false;
      App.render();
    }
  },

  refreshTasksPersonData() {
    Actions.loadTasksPersonData(true);
  },

  // V36.12.0 — Djow RevOps (painel lateral do DRE).
  selectDjowRevopsLine(productId, lineId, afterStep) {
    App.state.revopsDjowSelectedLine = { productId, lineId, afterStep, groupId: null };
    App.save(); App.render();
  },

  // V36.13.0 — Seleção de item DENTRO de um grupo (linha-banner).
  selectDjowRevopsGroupItem(productId, groupId, itemId) {
    App.state.revopsDjowSelectedLine = { productId, groupId, lineId: itemId, afterStep: 'group' };
    App.save(); App.render();
  },

  // V36.14.0 — Seleção de componente da Composição RevOps (MCU/MSU).
  selectDjowRevopsComponent(productId, kpi, idx) {
    App.state.revopsDjowSelectedLine = { productId, kpi, componentIdx: idx, afterStep: `revops_${kpi}` };
    App.save(); App.render();
  },

  // V37.0.0 — Selector de período na aba Resultado. Cliente vê/edita meta de
  // qualquer mês (passado, corrente, futuro). Default = mês corrente.
  setResultadoPeriod(productId, period) {
    if (!productId || !period) return;
    App.state.resultadoPeriod = App.state.resultadoPeriod || {};
    App.state.resultadoPeriod[productId] = String(period);
    App.save(); App.render();
  },

  // V37.0.1 — Switcher de escopo na aba Fechamento: 'product' | 'monthly' | 'custom'
  setRevopsFechamentoScope(productId, scope) {
    if (!productId) return;
    const valid = ['product', 'monthly', 'custom'];
    if (!valid.includes(scope)) return;
    App.state.revopsFechamentoScope = App.state.revopsFechamentoScope || {};
    App.state.revopsFechamentoScope[productId] = scope;
    App.save(); App.render();
  },

  // V37.0.3 → V37.0.4 — Carrega TODOS os snapshots do user (sem filtro de
  // produto). Frontend filtra por escopo + produto. Cache TTL 60s.
  // Cache shape: App.state.governanceClosings = { loading, loadedAt, error, list }
  // (NÃO mais por productId — simplifica sininho e escopo consolidado.)
  async loadGovernanceClosings(productIdLegacy, opts = {}) {
    // Compat com chamadas antigas (V37.0.3) que passavam productId — ignorado agora.
    if (typeof productIdLegacy === 'object' && productIdLegacy !== null) {
      opts = productIdLegacy;
    }
    const cache = App.state.governanceClosings || {};
    const fresh = cache.loadedAt && (Date.now() - cache.loadedAt) < 60_000;
    if (fresh && !opts.force) return;
    App.state.governanceClosings = { ...cache, loading: true, error: null };
    App.render();
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/governance-closings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        App.state.governanceClosings = {
          loading: false,
          loadedAt: Date.now(),
          error: data?.message || `HTTP ${r.status}`,
          list: cache.list || []
        };
      } else {
        App.state.governanceClosings = {
          loading: false,
          loadedAt: Date.now(),
          error: null,
          list: Array.isArray(data.closings) ? data.closings : []
        };
      }
    } catch (err) {
      App.state.governanceClosings = {
        loading: false,
        loadedAt: Date.now(),
        error: err.message,
        list: cache.list || []
      };
    }
    App.render();
  },

  // V37.0.4 — Conta consolidated_monthly status=partial (pra sininho de pendências)
  getMonthlyClosingPendingCount() {
    const list = App.state.governanceClosings?.list || [];
    return list.filter(c => c.kind === 'consolidated_monthly' && c.status === 'partial').length;
  },

  // V37.0.3 — Cria snapshot kind='product_custom' do produto no período. Cliente
  // ajusta os dados live ANTES de clicar (não há edição histórica retroativa).
  // Snapshot captura o estado atual do state.products[productId].
  async createProductCustomClosing(productId, period, name) {
    if (!productId || !period) return;
    if (!/^\d{4}-\d{2}$/.test(String(period))) {
      return Utils.toast('Período inválido (use YYYY-MM).');
    }
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/governance-closings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          kind: 'product_custom',
          period: String(period),
          product_ids: [String(productId)],
          name: name ? String(name).slice(0, 200) : null
        })
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        return Utils.toast(`Erro ao refechar: ${data?.message || 'falha desconhecida'}`);
      }
      Utils.toast(`✓ Snapshot custom criado pra ${period}`);
      await Actions.loadGovernanceClosings({ force: true });
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V37.0.4 — Associa produtos a um consolidated_monthly partial → vira complete.
  // productIds vazio + intentionallyEmpty=true → "não consolidar este mês".
  async associateMonthlyConsolidated(closingId, productIds, intentionallyEmpty) {
    if (!closingId) return;
    const ids = Array.isArray(productIds) ? productIds.map(String) : [];
    const empty = !!intentionallyEmpty;
    if (!ids.length && !empty) {
      return Utils.toast('Marque ao menos 1 produto OU confirme "não consolidar este mês".');
    }
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch(`/api/governance-closings?id=${closingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'associate', product_ids: ids })
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        return Utils.toast(`Erro: ${data?.message || 'falha desconhecida'}`);
      }
      Utils.toast(empty ? '✓ Fechamento mensal salvo (sem consolidação)' : `✓ ${ids.length} produto(s) consolidado(s)`);
      App.state.fechamentoAssociacao = null;
      await Actions.loadGovernanceClosings({ force: true });
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V37.0.4 — UI: marca/desmarca produto no card de associação (consolidated_monthly partial)
  toggleFechamentoAssociacaoProduct(closingId, productId) {
    App.state.fechamentoAssociacao = App.state.fechamentoAssociacao || {};
    const key = String(closingId);
    App.state.fechamentoAssociacao[key] = App.state.fechamentoAssociacao[key] || new Set();
    const set = App.state.fechamentoAssociacao[key];
    // Set não persiste em JSON — convertemos pra array nos saves. Aqui só UI volátil.
    if (set instanceof Set) {
      if (set.has(String(productId))) set.delete(String(productId)); else set.add(String(productId));
    } else {
      const arr = Array.isArray(set) ? [...set] : [];
      const idx = arr.indexOf(String(productId));
      if (idx >= 0) arr.splice(idx, 1); else arr.push(String(productId));
      App.state.fechamentoAssociacao[key] = arr;
    }
    App.render();
  },

  // V37.0.6 — Exporta snapshot da governança em PDF (frontend via html2pdf).
  // Monta HTML standalone com layout executivo (inline styles, sem dep Tailwind
  // no PDF) e dispara download. 1 PDF = 1 snapshot.
  async exportGovernanceClosingPdf(closingId) {
    if (!closingId) return;
    if (typeof window.html2pdf !== 'function') {
      return Utils.toast('Biblioteca de PDF não carregada. Recarrega a página e tenta de novo.');
    }
    const list = App.state.governanceClosings?.list || [];
    const closing = list.find(c => Number(c.id) === Number(closingId));
    if (!closing) return Utils.toast('Snapshot não encontrado.');

    const periodLabel = (() => {
      try {
        const [y, m] = String(closing.period).split('-').map(Number);
        const d = new Date(y, m - 1, 1);
        let lbl = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        return lbl.charAt(0).toUpperCase() + lbl.slice(1);
      } catch (_) { return closing.period; }
    })();
    const closedDate = closing.closed_at ? new Date(closing.closed_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
    const snap = closing.snapshot_json || {};
    const isProduct = closing.kind === 'product_auto' || closing.kind === 'product_custom';
    const kindLabel = {
      product_auto: 'Snapshot Automático · Produto',
      product_custom: 'Snapshot Custom · Produto',
      consolidated_monthly: closing.status === 'partial' ? 'Mensal Consolidado · Parcial' : 'Mensal Consolidado · Completo',
      consolidated_custom: 'Custom Consolidado'
    }[closing.kind] || closing.kind;

    const fmtMoney = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(v) || 0);
    const fmtNum = (v) => Math.round(Number(v) || 0).toLocaleString('pt-BR');

    // Bloco principal: inputs do snapshot
    let mainBlock = '';
    if (isProduct) {
      const meta = snap.metas || { vendas: 0, cac: 0 };
      const groups = Array.isArray(snap.revopsConfig?.groups) ? snap.revopsConfig.groups : [];
      const offers = Array.isArray(snap.revopsConfig?.offers) ? snap.revopsConfig.offers : [];
      const itemsCount = groups.reduce((acc, g) => acc + ((g.items || []).length), 0);
      const ticketMedio = snap.revopsConfig?.ticketMedio || 0;
      const cell = (label, value) => `<div style="border:1px solid #e7e5e4;border-radius:8px;padding:12px;background:#fafaf9;">
        <p style="font-size:9px;font-weight:900;color:#78716c;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 4px;">${label}</p>
        <p style="font-size:18px;font-weight:900;color:#1c1917;margin:0;">${value}</p>
      </div>`;
      mainBlock = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">
        ${cell('Produto', Utils.escape(snap.productName || '—'))}
        ${cell('Vendas previstas', fmtNum(snap.salesProjection))}
        ${cell('Meta de Vendas', fmtNum(meta.vendas))}
        ${cell('Meta de CAC', fmtMoney(meta.cac))}
        ${cell('Ticket Médio (input)', ticketMedio > 0 ? fmtMoney(ticketMedio) : '—')}
        ${cell('Grupos de custos', String(groups.length))}
        ${cell('Items totais', String(itemsCount))}
        ${cell('Ofertas cadastradas', String(offers.length))}
      </div>`;
    } else {
      const products = Array.isArray(snap.products) ? snap.products : [];
      const productRows = products.length ? products.map(p => `<div style="border:1px solid #e7e5e4;border-radius:8px;padding:10px;background:#fafaf9;margin-bottom:6px;">
        <div style="display:flex;justify-content:space-between;align-items:start;gap:10px;">
          <div>
            <p style="font-size:13px;font-weight:900;color:#1c1917;margin:0;">${Utils.escape(p.productName || p.productId)}</p>
            <p style="font-size:10px;color:#57534e;margin:2px 0 0;">Meta: ${fmtNum(p.metas?.vendas)} vendas · CAC ${fmtMoney(p.metas?.cac)}</p>
          </div>
          <p style="font-size:11px;font-weight:900;color:#7c3aed;margin:0;white-space:nowrap;">${fmtNum(p.salesProjection)} previstas</p>
        </div>
      </div>`).join('') : '<p style="font-size:12px;color:#78716c;font-style:italic;">Nenhum produto associado (cliente optou por não consolidar este mês).</p>';
      mainBlock = `<div style="margin-bottom:16px;">
        <p style="font-size:10px;font-weight:900;color:#78716c;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 8px;">Produtos consolidados (${products.length})</p>
        ${productRows}
      </div>`;
    }

    const reopens = Array.isArray(closing.reopens_log) ? closing.reopens_log : [];
    const reopensBlock = reopens.length ? `<div style="border:1px solid #fcd34d;background:#fffbeb;border-radius:8px;padding:10px;margin-top:12px;">
      <p style="font-size:10px;font-weight:900;color:#92400e;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 4px;">Log de Reabertura</p>
      <ul style="margin:0;padding-left:14px;font-size:11px;color:#78350f;line-height:1.4;">
        ${reopens.map(r => `<li>${new Date(r.at).toLocaleString('pt-BR')}${r.reason ? ' — ' + Utils.escape(r.reason) : ''}</li>`).join('')}
      </ul>
    </div>` : '';

    const generatedAt = new Date().toLocaleString('pt-BR');

    const html = `<div style="font-family:'Inter',system-ui,-apple-system,sans-serif;padding:24px;color:#1c1917;max-width:700px;">
      <div style="border-bottom:2px solid #7c3aed;padding-bottom:12px;margin-bottom:16px;">
        <p style="font-size:10px;font-weight:900;color:#7c3aed;text-transform:uppercase;letter-spacing:0.1em;margin:0;">LeadJourney · Fechamento</p>
        <h1 style="font-size:24px;font-weight:900;margin:6px 0 4px;color:#1c1917;">${Utils.escape(periodLabel)}</h1>
        ${closing.name ? `<p style="font-size:14px;font-weight:700;color:#44403c;margin:0;">${Utils.escape(closing.name)}</p>` : ''}
        <p style="font-size:11px;color:#78716c;margin:6px 0 0;">${kindLabel} · Criado em ${closedDate} · Fonte: ${closing.source === 'auto' ? 'Automática (cron)' : 'Manual'}</p>
      </div>

      <div style="background:#f5f3f0;border:1px solid #e7e5e0;border-radius:10px;padding:14px;margin-bottom:14px;">
        <p style="font-size:11px;color:#44403c;margin:0;line-height:1.5;"><b>Snapshot imutável</b> — foto dos inputs da governança no instante do fechamento. Reconstrução completa de DRE/KPIs/Custos com cálculo no front em vista interativa.</p>
      </div>

      ${mainBlock}
      ${reopensBlock}

      <div style="margin-top:24px;padding-top:10px;border-top:1px solid #e7e5e4;">
        <p style="font-size:9px;color:#a8a29e;text-align:center;margin:0;">Gerado por LeadJourney em ${generatedAt} · v${window.LJVersion || '37.x'}</p>
      </div>
    </div>`;

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.innerHTML = html;
    document.body.appendChild(container);
    try {
      const filename = `fechamento-${closing.period}-${closing.kind}-${closing.id}.pdf`;
      await window.html2pdf().set({
        margin: 10,
        filename,
        image: { type: 'jpeg', quality: 0.92 },
        html2canvas: { scale: 2, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      }).from(container.firstChild).save();
      Utils.toast(`✓ PDF baixado: ${filename}`);
    } catch (err) {
      Utils.toast(`Erro ao gerar PDF: ${err.message}`);
    } finally {
      document.body.removeChild(container);
    }
  },

  // V37.0.10 — Recolhe/expande linha-banner DRE ou card RevOps.
  // key: 'dre:fat_bruto' | 'dre:deducoes' | 'dre:s_m' | 'dre:g_a' |
  //      'dre:group_<id>' | 'revops:mcu' | 'revops:msu'. Default open.
  toggleRevopsCollapsed(productId, key) {
    if (!productId || !key) return;
    App.state.revopsCollapsed = App.state.revopsCollapsed || {};
    App.state.revopsCollapsed[productId] = App.state.revopsCollapsed[productId] || {};
    App.state.revopsCollapsed[productId][key] = !App.state.revopsCollapsed[productId][key];
    App.save(); App.render();
  },

  // V37.0.5 — Inicia draft de Custom Consolidado. Default: mês anterior.
  startCustomConsolidadoDraft() {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const y = prev.getFullYear();
    const m = String(prev.getMonth() + 1).padStart(2, '0');
    App.state.customConsolidadoDraft = {
      period: `${y}-${m}`,
      name: '',
      productIds: []
    };
    App.save(); App.render();
  },

  // V37.0.5 — Atualiza campo do draft (sem render pra preservar foco em inputs)
  updateCustomConsolidadoDraftField(field, value) {
    if (!App.state.customConsolidadoDraft) return;
    if (field === 'name') {
      App.state.customConsolidadoDraft.name = String(value || '').slice(0, 200);
    } else if (field === 'period') {
      const v = String(value || '');
      if (/^\d{4}-\d{2}$/.test(v)) App.state.customConsolidadoDraft.period = v;
    }
    // Sem render — input mantém foco
  },

  // V37.0.5 — Toggle produto no draft (com render — é checkbox)
  toggleCustomConsolidadoDraftProduct(productId) {
    if (!App.state.customConsolidadoDraft) return;
    const ids = Array.isArray(App.state.customConsolidadoDraft.productIds) ? [...App.state.customConsolidadoDraft.productIds] : [];
    const pid = String(productId);
    const idx = ids.indexOf(pid);
    if (idx >= 0) ids.splice(idx, 1); else ids.push(pid);
    App.state.customConsolidadoDraft.productIds = ids;
    App.render();
  },

  cancelCustomConsolidadoDraft() {
    App.state.customConsolidadoDraft = null;
    App.save(); App.render();
  },

  // V37.0.5 — Cria snapshot kind='consolidated_custom' (POST /api/governance-closings).
  // Cliente já preencheu nome + período + selecionou produtos.
  async createConsolidatedCustom() {
    const draft = App.state.customConsolidadoDraft;
    if (!draft) return;
    const productIds = Array.isArray(draft.productIds) ? draft.productIds.map(String) : [];
    if (!productIds.length) return Utils.toast('Escolha ao menos 1 produto.');
    if (!/^\d{4}-\d{2}$/.test(String(draft.period))) return Utils.toast('Período inválido.');
    const name = String(draft.name || '').trim() || `Custom · ${draft.period}`;
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/governance-closings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          kind: 'consolidated_custom',
          period: draft.period,
          product_ids: productIds,
          name
        })
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        return Utils.toast(`Erro ao criar custom: ${data?.message || 'falha desconhecida'}`);
      }
      Utils.toast(`✓ Custom "${name}" criado (${productIds.length} produtos)`);
      App.state.customConsolidadoDraft = null;
      await Actions.loadGovernanceClosings({ force: true });
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V37.0.4 — Atalho pro sininho: pula pra produto X aba Fechamento escopo monthly
  openFechamentoMonthlyFromBell(productId) {
    Actions.closeNotificationsModal?.();
    // Seleciona produto se diferente do atual
    if (productId && App.state.activeProductId !== productId) {
      App.state.activeProductId = productId;
    }
    App.state.activeView = 'revopsWhitelabel';
    App.state.revopsWhitelabelActiveTab = 'fechamento';
    App.state.revopsFechamentoScope = App.state.revopsFechamentoScope || {};
    if (productId) App.state.revopsFechamentoScope[productId] = 'monthly';
    App.save(); App.render();
  },

  // V37.0.3 — Reabre um snapshot. Pra product_*: registra log de reabertura
  // (snapshot continua imutável). Pra consolidated_monthly: volta status pra
  // partial pra cliente associar de novo.
  async reopenGovernanceClosing(closingId, reason) {
    if (!closingId) return;
    if (!confirm('Reabrir este fechamento? O snapshot original fica imutável — o ato fica registrado no log de auditoria.')) return;
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch(`/api/governance-closings?id=${closingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'reopen', reason: reason || null })
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        return Utils.toast(`Erro ao reabrir: ${data?.message || 'falha desconhecida'}`);
      }
      Utils.toast('✓ Reabertura registrada');
      await Actions.loadGovernanceClosings({ force: true });
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V37.0.3 — Abre vista detalhada do snapshot (renderiza o snapshot_json congelado).
  openGovernanceClosingView(closingId) {
    App.state.governanceClosingOpen = closingId ? Number(closingId) : null;
    App.render();
  },

  closeGovernanceClosingView() {
    App.state.governanceClosingOpen = null;
    App.render();
  },

  // V37.0.0 — Edita meta de Vendas ou CAC do produto pra um período YYYY-MM.
  // field: 'vendas' | 'cac'. Valor numérico (parseado pelo caller).
  updateMetaResultado(productId, period, field, value) {
    if (!productId || !period) return;
    if (field !== 'vendas' && field !== 'cac') return;
    App.state.metasResultado = App.state.metasResultado || {};
    App.state.metasResultado[productId] = App.state.metasResultado[productId] || {};
    App.state.metasResultado[productId][period] = App.state.metasResultado[productId][period] || { vendas: 0, cac: 0 };
    const num = Number(value) || 0;
    App.state.metasResultado[productId][period][field] = num < 0 ? 0 : num;
    App.save(); App.render();
  },

  updateDjowRevopsInput(value) {
    App.state.revopsDjowInput = String(value || '');
    // Sem render — preserva foco do textarea.
  },

  askDjowRevops() {
    const text = String(App.state.revopsDjowInput || '').trim();
    if (!text) return;
    if (!window.DjowRevOpsPanel) return Utils.toast('Djow RevOps não carregado.');
    const messages = Array.isArray(App.state.revopsDjowMessages) ? [...App.state.revopsDjowMessages] : [];
    const selected = App.state.revopsDjowSelectedLine;
    messages.push({ role: 'user', text });
    const result = DjowRevOpsPanel.resolve(text, selected ? { afterStep: selected.afterStep } : null);
    // V37.0.11 — Preserva createCommand junto com reply pra o UI renderizar
    // o card de "Confirmar criação".
    messages.push({
      role: 'djow',
      text: result.reply,
      suggestion: result.suggestion || null,
      createCommand: result.createCommand || null,
      createApplied: false
    });
    App.state.revopsDjowMessages = messages;
    App.state.revopsDjowInput = '';
    App.save(); App.render();
  },

  applyDjowRevopsSuggestion(messageIdx) {
    const messages = Array.isArray(App.state.revopsDjowMessages) ? App.state.revopsDjowMessages : [];
    const msg = messages[messageIdx];
    const selected = App.state.revopsDjowSelectedLine;
    if (!msg || !msg.suggestion) return Utils.toast('Mensagem sem fórmula sugerida.');
    if (!selected) return Utils.toast('Clique numa linha primeiro pra eu aplicar.');
    if (selected.kpi && typeof selected.componentIdx === 'number') {
      Actions.updateRevopsKpiComponent(selected.productId, selected.kpi, selected.componentIdx, 'value', msg.suggestion);
    } else if (selected.groupId) {
      Actions.updateDreExtraGroupItem(selected.productId, selected.groupId, selected.lineId, 'value', msg.suggestion);
    } else {
      Actions.updateDreExtraLine(selected.productId, selected.lineId, 'value', msg.suggestion);
    }
    Utils.toast('✓ Fórmula aplicada.');
  },

  // V37.0.11 — Executa o createCommand de uma mensagem Djow.
  applyDjowRevopsCreate(messageIdx) {
    const messages = Array.isArray(App.state.revopsDjowMessages) ? App.state.revopsDjowMessages : [];
    const msg = messages[messageIdx];
    if (!msg || !msg.createCommand) return Utils.toast('Mensagem sem comando de criação.');
    if (msg.createApplied) return Utils.toast('Esse comando já foi aplicado.');
    const productId = (typeof RevopsWhitelabelPanel !== 'undefined' && RevopsWhitelabelPanel._currentProductId)
      ? RevopsWhitelabelPanel._currentProductId()
      : (App.state.products?.[0]?.id);
    if (!productId) return Utils.toast('Nenhum produto selecionado.');
    try {
      Actions._djowExecuteCreate(productId, msg.createCommand);
      msg.createApplied = true;
      Utils.toast(`✓ ${msg.createCommand.name} criado.`);
      App.save(); App.render();
    } catch (err) {
      Utils.toast(`Erro ao criar: ${err.message}`);
    }
  },

  // V37.0.11 — Cancela o createCommand de uma mensagem (descarta sem executar).
  dismissDjowRevopsCreate(messageIdx) {
    const messages = Array.isArray(App.state.revopsDjowMessages) ? App.state.revopsDjowMessages : [];
    const msg = messages[messageIdx];
    if (!msg || !msg.createCommand) return;
    msg.createCommand = null;
    App.save(); App.render();
  },

  // V37.0.11 — Executa a criação física no cfg do produto. Cobre 3 kinds:
  //   - dre_line: nova linha extra no DRE (afterStep deducoes_inside/s_m/g_a)
  //   - revops_item: novo item de Custos no bucket apropriado (cria grupo se faltar)
  //   - revops_component: novo componente do MCU/MSU (vira modo composed)
  _djowExecuteCreate(productId, cmd) {
    if (!cmd || !cmd.kind) throw new Error('createCommand inválido.');

    if (cmd.kind === 'revops_component') {
      const o = Actions._revopsGetOverride(productId, cmd.kpi);
      o.mode = 'composed';
      if (!Array.isArray(o.components)) o.components = [];
      o.components.push({ name: cmd.name, value: cmd.formula });
      App.save(); App.render();
      return;
    }

    Actions._revopsV2Mutate(productId, cfg => {
      if (cmd.kind === 'dre_line') {
        if (!Array.isArray(cfg.dreExtraLines)) cfg.dreExtraLines = [];
        const step = String(cmd.afterStep || 'deducoes_inside');
        cfg.dreExtraLines.push({
          id: `dre_${Date.now().toString(36).slice(-4)}_${Math.random().toString(36).slice(2,5)}`,
          name: cmd.name,
          value: cmd.formula,
          signal: step === 'deducoes_inside' ? '+' : '-',
          afterStep: step
        });
      } else if (cmd.kind === 'revops_item') {
        // Acha grupo existente do bucket (primeiro) OU cria novo
        let g = (cfg.groups || []).find(x => x.bucket === cmd.bucket);
        if (!g && window.RevopsWhitelabelEngine) {
          const labels = { fixed: 'Fixos (G&A)', acquisition: 'Aquisição (S&M)', variable: 'Variáveis', custom: 'Outros' };
          g = RevopsWhitelabelEngine.emptyGroup(labels[cmd.bucket] || 'Novo grupo', cmd.bucket);
          cfg.groups = [...(cfg.groups || []), g];
        }
        if (!g) throw new Error('Engine RevOps não carregado.');
        // Cria item com fórmula avançada (custom_formula). Se formula é só
        // número, usa fixed. Senão custom_formula.
        const isFixed = /^\d+(?:[\.,]\d+)?$/.test(cmd.formula);
        const item = RevopsWhitelabelEngine.emptyItem(cmd.name);
        if (isFixed) {
          item.calc = { mode: 'fixed', value: Number(cmd.formula.replace(',', '.')) || 0 };
        } else {
          item.calc = { mode: 'custom_formula', formula: cmd.formula };
        }
        g.items = [...(g.items || []), item];
      } else {
        throw new Error(`Kind desconhecido: ${cmd.kind}`);
      }
    });
  },

  clearDjowRevopsHistory() {
    App.state.revopsDjowMessages = [];
    App.save(); App.render();
  },

  toggleRevopsDreCardMenu(lineId) {
    App.state.revopsDreCardMenuOpen = (App.state.revopsDreCardMenuOpen === lineId) ? null : lineId;
    App.save(); App.render();
  },

  // V36.11.0 — Filtros da Visão Geral consolidada.
  setOverviewRange(range) {
    const valid = ['7d', '30d', '90d'];
    App.state.overviewRange = valid.includes(range) ? range : '7d';
    App.save(); App.render();
  },

  setOverviewBranchFilter(branchId) {
    App.state.overviewBranchFilter = String(branchId || 'all');
    App.save(); App.render();
  },

  // V35.6.0 — Integrações IPI: troca aba ativa (Injetar/Propagar/Iterar).
  setIntegrationsTab(tab) {
    const valid = ['injetar', 'propagar', 'iterar'];
    App.state.integrationsTab = valid.includes(tab) ? tab : 'injetar';
    App.save();
    App.render();
  },

  // V35.6.0-alpha4 — Modal próprio RD (aba Iterar).
  openRdConnectionModal() {
    App.state.rdConnectionModalOpen = true;
    if (window.Actions?.loadRdConnectionStatus) {
      setTimeout(() => Actions.loadRdConnectionStatus?.(), 0);
    }
    App.render();
  },
  closeRdConnectionModal() {
    App.state.rdConnectionModalOpen = false;
    App.render();
  },

  // V35.6.0-alpha4 — Modal próprio ClickUp (aba Iterar).
  openClickupConnectionModal() {
    App.state.clickupConnectionModalOpen = true;
    if (window.Actions?.loadClickupStatus) {
      setTimeout(() => Actions.loadClickupStatus(), 0);
    }
    App.render();
  },
  closeClickupConnectionModal() {
    App.state.clickupConnectionModalOpen = false;
    App.render();
  },

  // V35.6.0-alpha6 — Sai do modo manage Google Ads e entra no wizard de update.
  switchGoogleAdsToWizard() {
    if (!App.state.googleAdsWizard) return;
    App.state.googleAdsWizard.mode = 'wizard';
    App.state.googleAdsWizard.step = 1;
    App.render();
  },

  // V36.6.4 — Atalho pra ir DIRETO ao Step 3 (seleção de Customer) quando
  // OAuth já foi feito mas selectedCustomerId está vazio. Felipe relatou
  // 2026-06-08: clicar "Atualizar credenciais" abre Step 1 com campos vazios
  // e ele NÃO precisa redigitar — só precisa selecionar a conta.
  async openGoogleAdsAccountPicker() {
    if (!App.state.googleAdsWizard) Actions.openGoogleAdsWizard();
    App.state.googleAdsWizard.mode = 'wizard';
    App.state.googleAdsWizard.step = 3;
    App.state.googleAdsWizard.accounts = [];
    App.state.googleAdsWizard.loadingAccounts = true; // V36.7.0
    App.state.googleAdsWizard.error = null;
    App.render();
    // Dispara load da lista de contas via /api/google-ads-list-accounts
    await Actions.loadGoogleAdsAccounts();
    if (App.state.googleAdsWizard) {
      App.state.googleAdsWizard.loadingAccounts = false;
      App.render();
    }
  },

  // V36.7.0 — Dismiss permanente do checklist de pré-requisitos no Step 1.
  // Cliente que já configurou Google Cloud + MCC + Developer Token não precisa
  // ver de novo. Persiste em App.state.googleAdsWizard.checklistDismissed.
  dismissGoogleAdsChecklist() {
    if (!App.state.googleAdsWizard) return;
    App.state.googleAdsWizard.checklistDismissed = true;
    App.save();
    App.render();
  },

  // V35.7.0-alpha1 — Carrega campanhas Google Ads.
  // V35.7.0-alpha4 — Tenta dados reais (endpoint /api/google-ads-campaigns-list)
  // primeiro. Se vier vazio (sync nunca rodou ou conta nova) OU 401/erro,
  // cai pro mock. Quando há dados reais, isMock=false e o badge "Dados de
  // exemplo" some.
  async loadGoogleAdsCampaigns() {
    // V36.8.6 — 3 estados em vez de 2:
    //   (a) RealEmpty: sync rodou mas conta não tem campanhas no Google Ads
    //   (b) RealWithData: tem dados reais
    //   (c) Mock: sync nunca rodou ou erro de fetch
    // Antes (V35.7.0): só real vs mock. Conta sem campanhas caía pro mock e
    // confundia cliente (Sansone reportou 2026-06-09).
    let usedReal = false;
    let realEmpty = false;
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/google-ads-campaigns-list', { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) {
        const data = await r.json();
        if (data.ok && Array.isArray(data.campaigns)) {
          if (data.campaigns.length > 0) {
            // (b) RealWithData
            App.state.googleAdsCampaignsCache = data.campaigns;
            App.state.googleAdsCampaignsLoadedAt = new Date().toISOString();
            App.state.googleAdsCampaignsAreMock = false;
            App.state.googleAdsCampaignsRealEmpty = false;
            usedReal = true;
            App.render();
          } else {
            // Campanhas vazias. Sync já rodou? (status tem lastSyncAt)
            const status = App.state.googleAdsStatus || {};
            if (status.lastSyncAt) {
              // (a) RealEmpty — conta conectada mas sem campanhas no Google Ads
              App.state.googleAdsCampaignsCache = [];
              App.state.googleAdsCampaignsLoadedAt = new Date().toISOString();
              App.state.googleAdsCampaignsAreMock = false;
              App.state.googleAdsCampaignsRealEmpty = true;
              realEmpty = true;
              App.render();
            }
          }
        }
      }
    } catch (_) { /* fallback */ }
    if (!usedReal && !realEmpty) {
      // (c) Mock — sync nunca rodou (cliente novo) ou erro de fetch
      const mocks = window.GoogleAdsMockCampaigns?.list() || [];
      App.state.googleAdsCampaignsCache = mocks;
      App.state.googleAdsCampaignsLoadedAt = new Date().toISOString();
      App.state.googleAdsCampaignsAreMock = true;
      App.state.googleAdsCampaignsRealEmpty = false;
      App.render();
    }
  },

  // V35.7.0-alpha4 — Trigger manual de sync. Chama /api/google-ads-sync-trigger
  // (roda GAQL + UPSERT no DB) e em seguida recarrega cache.
  async triggerGoogleAdsSync() {
    const status = App.state.googleAdsStatus || {};
    if (!status.oauthCompleted) return Utils.toast('Conecte o Google Ads primeiro.');
    // V36.7.0 — Flag de UI pro botão "Sincronizar agora" mostrar loading.
    App.state.googleAdsSyncTriggering = true;
    App.render();
    Utils.toast('⏳ Sincronizando Google Ads…');
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/google-ads-sync-trigger', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      if (!data.ok) {
        Utils.toast(`Erro: ${data.error || data.message || 'falha no sync'}`);
        return;
      }
      Utils.toast(`✓ Sync OK — ${data.rowsUpserted} linhas atualizadas.`);
      await Actions.loadGoogleAdsCampaigns();
      // Atualiza lastSyncAt no status
      await Actions.loadGoogleAdsStatus();
    } catch (err) {
      Utils.toast(`Erro de rede: ${err.message}`);
    } finally {
      App.state.googleAdsSyncTriggering = false;
      App.render();
    }
  },

  // V35.7.0-alpha1 — Sub-aba do Dashboard Google Ads.
  // V35.7.1 — 3 sub-abas: 'overview' (Visão Geral nova) | 'linked' (Associadas)
  // | 'orphans' (Não associadas).
  setGoogleAdsDashboardSubTab(tab) {
    const valid = ['overview', 'linked', 'orphans'];
    App.state.googleAdsDashboardSubTab = valid.includes(tab) ? tab : 'overview';
    App.save();
    App.render();
  },

  // V35.7.1 — Toggle "incluir não associadas no consolidado" da Visão Geral.
  toggleGoogleAdsOverviewIncludeOrphans() {
    App.state.googleAdsOverviewIncludeOrphans = !App.state.googleAdsOverviewIncludeOrphans;
    App.save();
    App.render();
  },

  // V35.7.1 — Expande/colapsa um card de ads vinculada na sub-aba "Associadas".
  toggleGoogleAdsExpandedAd(campaignId) {
    const id = String(campaignId);
    const set = new Set((App.state.googleAdsExpandedAds || []).map(String));
    if (set.has(id)) set.delete(id); else set.add(id);
    App.state.googleAdsExpandedAds = Array.from(set);
    App.render();
  },

  // V35.7.1 — Abre modal "Avançados" com 25 indicadores da campanha Ads.
  openGoogleAdsAdvancedModal(campaignId) {
    App.state.googleAdsAdvancedModalCampaignId = String(campaignId);
    App.render();
  },
  closeGoogleAdsAdvancedModal() {
    App.state.googleAdsAdvancedModalCampaignId = null;
    App.render();
  },

  // V35.7.2 — Filtros multi-select da Visão Geral.
  toggleGoogleAdsOverviewProduct(productId) {
    const id = Number(productId);
    const set = new Set((App.state.googleAdsOverviewSelectedProducts || []).map(Number));
    if (set.has(id)) set.delete(id); else set.add(id);
    App.state.googleAdsOverviewSelectedProducts = Array.from(set);
    App.save(); App.render();
  },
  toggleGoogleAdsOverviewLjCampaign(ljCampaignId) {
    const id = Number(ljCampaignId);
    const set = new Set((App.state.googleAdsOverviewSelectedLjCampaigns || []).map(Number));
    if (set.has(id)) set.delete(id); else set.add(id);
    App.state.googleAdsOverviewSelectedLjCampaigns = Array.from(set);
    App.save(); App.render();
  },
  clearGoogleAdsOverviewFilters() {
    App.state.googleAdsOverviewSelectedProducts = [];
    App.state.googleAdsOverviewSelectedLjCampaigns = [];
    App.save(); App.render();
  },

  // V35.7.2 — KPI help modal compartilhado.
  openKpiHelp(key) {
    if (!key) return;
    App.state.kpiHelpModalKey = String(key);
    App.render();
  },
  closeKpiHelp() {
    App.state.kpiHelpModalKey = null;
    App.render();
  },

  // V35.7.0-alpha1 — Vincula 1 ou mais campanhas externas (Google Ads) a
  // uma Campanha LJ. campaignExternalIds: array de strings (campaign_id da
  // plataforma). ljCampaignId: id da Campanha LJ destino.
  // V35.9.0 — Dispara recalc de [LJ]Google ads em RevOps Aquisição após vincular.
  linkGoogleAdsCampaignsToLj(ljCampaignId, campaignExternalIds) {
    if (!ljCampaignId || !Array.isArray(campaignExternalIds) || !campaignExternalIds.length) return;
    const lj = (App.state.campaigns || []).find(c => Number(c.id) === Number(ljCampaignId));
    if (!lj) return Utils.toast('Campanha LJ não encontrada.');
    if (!lj.externalLinks) lj.externalLinks = { googleAds: [], metaAds: [], ga4: { sessionCampaignNames: [] } };
    if (!Array.isArray(lj.externalLinks.googleAds)) lj.externalLinks.googleAds = [];
    // V35.9.0 — Coleta Produtos afetados ANTES da mudança (caso steal de outras
    // Campanhas LJ tire ads de outros Produtos — eles também precisam recalc).
    const affectedProductIds = new Set([Number(lj.productId)]);
    const setIds = new Set(campaignExternalIds.map(String));
    (App.state.campaigns || []).forEach(c => {
      if (Number(c.id) === Number(ljCampaignId)) return;
      if (!c.externalLinks?.googleAds) return;
      const hadAny = c.externalLinks.googleAds.some(id => setIds.has(String(id)));
      if (hadAny) affectedProductIds.add(Number(c.productId));
      c.externalLinks.googleAds = c.externalLinks.googleAds.filter(id => !setIds.has(String(id)));
    });
    // Adicionar ao destino (dedup).
    const existing = new Set(lj.externalLinks.googleAds.map(String));
    campaignExternalIds.forEach(id => existing.add(String(id)));
    lj.externalLinks.googleAds = Array.from(existing);

    // V35.9.0/9.1 — Recalcula [LJ]Google ads em RevOps Aquisição (V1 e V2)
    // de cada Produto afetado. V2 (whitelabel) é o painel ativo da UI atual.
    affectedProductIds.forEach(pid => {
      if (!pid) return;
      if (window.RevopsFinanceEngine?.recomputeAcquisitionAutoItem) RevopsFinanceEngine.recomputeAcquisitionAutoItem(pid, 'auto-google-ads');
      if (window.RevopsWhitelabelEngine?.recomputeAcquisitionAutoItem) RevopsWhitelabelEngine.recomputeAcquisitionAutoItem(pid, 'auto-google-ads');
    });

    App.save(); App.render();
    Utils.toast(`✓ ${campaignExternalIds.length} campanha(s) Ads vinculada(s) a "${lj.name}".`);
  },

  // V35.7.0-alpha3 — Cooldown global do sininho de ads órfãs.
  //
  // Mecânica (decidida com Felipe):
  // - 1 notificação por campanha Ads órfã (count = quantas órfãs existem)
  // - Click no sininho remove a bolinha visual (dismissedAt = Date.now())
  // - 10 min depois, se ainda tem órfã, bolinha volta (cooldown global)
  // - Bypass: se chega ads órfã com ID NÃO presente no snapshot do dismiss,
  //   bolinha volta IMEDIATAMENTE (sem esperar 10min)
  // - Quando órfã é associada de fato, sai automaticamente do count
  ADS_ORPHAN_BELL_COOLDOWN_MS: 10 * 60 * 1000,

  _adsOrphanIds() {
    const allAds = Array.isArray(App.state.googleAdsCampaignsCache) ? App.state.googleAdsCampaignsCache : [];
    const ljCampaigns = Array.isArray(App.state.campaigns) ? App.state.campaigns : [];
    const linkedSet = new Set();
    ljCampaigns.forEach(c => (c.externalLinks?.googleAds || []).forEach(id => linkedSet.add(String(id))));
    return allAds.filter(a => !linkedSet.has(String(a.campaign_id))).map(a => String(a.campaign_id));
  },

  // Quantas órfãs aparecem no sininho AGORA (respeitando cooldown).
  getAdsOrphanBellCount() {
    const orphans = Actions._adsOrphanIds();
    if (!orphans.length) return 0;
    const dismissedAt = App.state.googleAdsOrphanBellDismissedAt;
    if (!dismissedAt) return orphans.length;
    const snapshot = new Set((App.state.googleAdsOrphanBellSnapshot || []).map(String));
    // Bypass: alguma órfã atual NÃO estava no snapshot do dismiss → nova chegou.
    const hasNew = orphans.some(id => !snapshot.has(id));
    if (hasNew) return orphans.length;
    // Cooldown expirou: volta a mostrar.
    if (Date.now() - dismissedAt >= Actions.ADS_ORPHAN_BELL_COOLDOWN_MS) return orphans.length;
    // Dentro do cooldown e sem novas: silenciado.
    return 0;
  },

  // Click no sininho: tira bolinha visual + memoriza snapshot atual pra
  // permitir detectar "novas" depois.
  dismissAdsOrphanBell() {
    App.state.googleAdsOrphanBellDismissedAt = Date.now();
    App.state.googleAdsOrphanBellSnapshot = Actions._adsOrphanIds();
    // Agenda re-render quando cooldown expirar (forçar bolinha voltar).
    if (window._adsOrphanBellTimer) clearTimeout(window._adsOrphanBellTimer);
    window._adsOrphanBellTimer = setTimeout(() => {
      if (window.App?.render) App.render();
    }, Actions.ADS_ORPHAN_BELL_COOLDOWN_MS + 500);
    App.save();
  },

  // Click no sininho com ads pendentes — navega pra sub-aba "Não associadas"
  // do Dashboard > Google Ads e dispensa a bolinha pelo cooldown.
  openAdsOrphanInbox() {
    Actions.dismissAdsOrphanBell();
    App.state.activeTab = 'dashboard';
    App.state.activeDashboardTab = 'google-ads';
    App.state.googleAdsDashboardSubTab = 'orphans';
    App.save();
    App.render();
  },

  // V35.7.0-alpha2 — Wizard de associação (4 steps).
  openAdsAssociationWizard(platform, externalIdsArg) {
    const externalIds = Array.isArray(externalIdsArg) ? externalIdsArg.map(String) : [];
    if (platform !== 'google-ads') {
      Utils.toast('Por enquanto só Google Ads. Meta/GA4 chegam em release futura.');
      return;
    }
    const allAds = Array.isArray(App.state.googleAdsCampaignsCache) ? App.state.googleAdsCampaignsCache : [];
    const ljCampaigns = Array.isArray(App.state.campaigns) ? App.state.campaigns : [];
    const linkedSet = new Set();
    ljCampaigns.forEach(c => (c.externalLinks?.googleAds || []).forEach(id => linkedSet.add(String(id))));
    // Se preSelected vazio, marca TODAS as órfãs (CTA "Associar todas").
    const startSelection = externalIds.length
      ? externalIds
      : allAds.filter(a => !linkedSet.has(String(a.campaign_id))).map(a => String(a.campaign_id));

    App.state.adsAssociationWizard = {
      open: true,
      platform: 'google-ads',
      step: 1,
      selectedExternalIds: startSelection,
      selectedLjId: null,
      creatingNewLj: false,
      newLjDraft: { name: '', objective: '', owner: '', sector: 'Marketing', productId: null }
    };
    App.render();
  },

  closeAdsAssociationWizard() {
    App.state.adsAssociationWizard = null;
    App.render();
  },

  adsWizardSetStep(step) {
    if (!App.state.adsAssociationWizard) return;
    App.state.adsAssociationWizard.step = Math.max(1, Math.min(4, Number(step) || 1));
    App.render();
  },

  adsWizardToggleExternal(externalId) {
    const w = App.state.adsAssociationWizard;
    if (!w) return;
    const id = String(externalId);
    const set = new Set((w.selectedExternalIds || []).map(String));
    if (set.has(id)) set.delete(id); else set.add(id);
    w.selectedExternalIds = Array.from(set);
    App.render();
  },

  adsWizardSetLjId(ljId) {
    if (!App.state.adsAssociationWizard) return;
    App.state.adsAssociationWizard.selectedLjId = ljId ? Number(ljId) : null;
    App.state.adsAssociationWizard.creatingNewLj = false;
    App.render();
  },

  adsWizardToggleCreateForm() {
    const w = App.state.adsAssociationWizard;
    if (!w) return;
    w.creatingNewLj = !w.creatingNewLj;
    if (w.creatingNewLj) w.selectedLjId = null;
    App.render();
  },

  adsWizardUpdateDraft(field, value) {
    const w = App.state.adsAssociationWizard;
    if (!w) return;
    if (!w.newLjDraft) w.newLjDraft = { name: '', objective: '', owner: '', sector: 'Marketing', productId: null };
    w.newLjDraft[field] = (field === 'productId') ? (value ? Number(value) : null) : String(value || '');
    // Não chama render — evita perder foco do input enquanto digita.
  },

  // V35.7.0-alpha2 — Confirma: cria nova Campanha LJ (se for o caso) e
  // amarra as Ads selecionadas.
  confirmAdsAssociation() {
    const w = App.state.adsAssociationWizard;
    if (!w) return;
    let ljId = w.selectedLjId;
    if (w.creatingNewLj) {
      const d = w.newLjDraft || {};
      if (!String(d.name || '').trim()) return Utils.toast('Dê um nome à Campanha LJ nova.');
      if (!d.productId) return Utils.toast('Escolha o produto da Campanha LJ nova.');
      const campaign = {
        id: Date.now(),
        productId: Number(d.productId),
        name: String(d.name).trim(),
        objective: String(d.objective || '').trim(),
        owner: String(d.owner || '').trim(),
        sector: d.sector || 'Marketing',
        status: 'Ativa',
        mediaInvestment: 0,
        okrs: [],
        createdAt: new Date().toISOString(),
        externalLinks: { googleAds: [], metaAds: [], ga4: { sessionCampaignNames: [] } }
      };
      if (!Array.isArray(App.state.campaigns)) App.state.campaigns = [];
      App.state.campaigns.unshift(campaign);
      ljId = campaign.id;
    }
    if (!ljId) return Utils.toast('Escolha uma Campanha LJ.');
    Actions.linkGoogleAdsCampaignsToLj(ljId, w.selectedExternalIds || []);
    // Vai pro step 4 (Pronto)
    App.state.adsAssociationWizard.step = 4;
    App.render();
  },

  // V35.7.0-alpha1 — Desvincula 1 campanha externa de Google Ads de qualquer
  // Campanha LJ. campaignExternalId: string.
  // V35.9.0 — Dispara recalc do item auto em RevOps Aquisição após desvincular.
  unlinkGoogleAdsCampaignFromLj(campaignExternalId) {
    if (!campaignExternalId) return;
    const targetId = String(campaignExternalId);
    let removed = false;
    const affectedProductIds = new Set();
    (App.state.campaigns || []).forEach(c => {
      if (!c.externalLinks?.googleAds) return;
      const before = c.externalLinks.googleAds.length;
      c.externalLinks.googleAds = c.externalLinks.googleAds.filter(id => String(id) !== targetId);
      if (c.externalLinks.googleAds.length !== before) {
        removed = true;
        if (c.productId) affectedProductIds.add(Number(c.productId));
      }
    });
    if (removed) {
      // V35.9.0/9.1 — Recalcula [LJ]Google ads em V1 e V2 de cada Produto afetado.
      affectedProductIds.forEach(pid => {
        if (!pid) return;
        if (window.RevopsFinanceEngine?.recomputeAcquisitionAutoItem) RevopsFinanceEngine.recomputeAcquisitionAutoItem(pid, 'auto-google-ads');
        if (window.RevopsWhitelabelEngine?.recomputeAcquisitionAutoItem) RevopsWhitelabelEngine.recomputeAcquisitionAutoItem(pid, 'auto-google-ads');
      });
      App.save(); App.render();
      Utils.toast('✓ Campanha Ads voltou para "Não associadas".');
    }
  },

  // V35.6.0-alpha5 — Modal nested "X + LeadJourney" (deep-dive do fluxo de dados).
  openIntegrationDeepDive(integrationId) {
    const validIds = window.IntegrationDeepDiveModal?.CONTENT
      ? Object.keys(IntegrationDeepDiveModal.CONTENT)
      : ['rd', 'clickup', 'google-ads', 'hotmart', 'meta-ads', 'stripe'];
    App.state.integrationDeepDiveOpen = validIds.includes(String(integrationId)) ? String(integrationId) : null;
    App.render();
  },
  closeIntegrationDeepDive() {
    App.state.integrationDeepDiveOpen = null;
    App.render();
  },

  setCheckoutSubTab(productIdOrAll) {
    const c = App.state.checkoutDashboard || {};
    c.activeSubTab = String(productIdOrAll);
    c.loadedAt = null; // força refetch
    App.render();
    Actions.loadCheckoutDashboard();
  },

  setCheckoutPeriod(days) {
    const c = App.state.checkoutDashboard || {};
    c.period = { days };
    c.loadedAt = null;
    App.render();
    Actions.loadCheckoutDashboard();
  },

  async loadCheckoutDashboard() {
    const c = App.state.checkoutDashboard || {};
    const days = c.period?.days || 30;
    const sub = c.activeSubTab || 'all';
    const reasonParam = c.reasonFilter ? `&reason=${encodeURIComponent(c.reasonFilter)}` : '';
    const token = localStorage.getItem('lj_jwt');
    try {
      const r = await fetch(`/api/hotmart-dashboard-metrics?product_id_hotmart=${encodeURIComponent(sub)}&days=${days}&limit=50${reasonParam}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await r.json();
      if (!data.ok) {
        Utils.toast(`Erro: ${data.message || 'falha ao carregar checkout'}`);
        return;
      }
      App.state.checkoutDashboard = {
        ...c,
        loadedAt: Date.now(),
        period: data.period,
        products: data.products || [],
        kpis: data.kpis || {},
        transactions: data.transactions || [],
        series: data.series || [],
        pagination: data.pagination || { limit: 50, offset: 0, total: 0 },
        cancellationReasons: data.cancellationReasons || []
      };
      App.render();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V35.2.1 — Filtra a tabela de transações pelo motivo de recusa
  setCheckoutReasonFilter(reasonCode) {
    const c = App.state.checkoutDashboard || {};
    c.reasonFilter = reasonCode === c.reasonFilter ? null : reasonCode; // toggle
    c.loadedAt = null;
    App.render();
    Actions.loadCheckoutDashboard();
  },

  clearCheckoutReasonFilter() {
    const c = App.state.checkoutDashboard || {};
    c.reasonFilter = null;
    c.loadedAt = null;
    App.render();
    Actions.loadCheckoutDashboard();
  },

  toggleCheckoutOthersModal() {
    const c = App.state.checkoutDashboard || {};
    c.othersModalOpen = !c.othersModalOpen;
    App.render();
  },

  // ===== V35.1.1 — Djow Checkout (painel lateral IA) =====
  // Hash do contexto pra saber quando regenerar resumo/sugestões.
  _djowContextHash() {
    const c = App.state.checkoutDashboard || {};
    return `${c.activeSubTab || 'all'}|${c.period?.days || 30}|${c.kpis?.totalCount || 0}`;
  },

  _djowContextPayload() {
    const c = App.state.checkoutDashboard || {};
    return {
      activeSubTab: c.activeSubTab,
      period: c.period,
      kpis: c.kpis,
      products: c.products,
      transactions: c.transactions,
      series: c.series
    };
  },

  // Roda resumo + sugestões quando o contexto muda. Idempotente — cacheia por hash.
  async ensureDjowCheckout() {
    const d = App.state.djowCheckout;
    if (!d) return;
    const hash = Actions._djowContextHash();
    if (d.loadedFor === hash && d.summary) return;
    if (d.summaryLoading) return;
    // Reset (fresh por sessão — nova hash zera mensagens também)
    App.state.djowCheckout = {
      ...d,
      loadedFor: hash,
      summary: null,
      summaryLoading: true,
      suggestions: [],
      suggestionsLoading: true,
      messages: []
    };
    App.render();

    const token = localStorage.getItem('lj_jwt');
    const context = Actions._djowContextPayload();
    try {
      const [summaryRes, suggestRes] = await Promise.all([
        fetch('/api/djow-checkout-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: 'summary', context })
        }).then(r => r.json()),
        fetch('/api/djow-checkout-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: 'suggestions', context })
        }).then(r => r.json())
      ]);
      App.state.djowCheckout = {
        ...App.state.djowCheckout,
        summaryLoading: false,
        suggestionsLoading: false,
        summary: summaryRes.ok ? summaryRes.text : (summaryRes.message || 'IA indisponível'),
        suggestions: suggestRes.ok ? (suggestRes.suggestions || []) : []
      };
      App.render();
    } catch (err) {
      App.state.djowCheckout = {
        ...App.state.djowCheckout,
        summaryLoading: false,
        suggestionsLoading: false,
        summary: `Erro: ${err.message}`
      };
      App.render();
    }
  },

  updateDjowCheckoutInput(value) {
    App.state.djowCheckout = { ...(App.state.djowCheckout || {}), input: value };
    // Sem render — preserva foco do input
  },

  async askDjowCheckout(presetQuestion = null) {
    const d = App.state.djowCheckout || {};
    const question = String(presetQuestion || d.input || '').trim();
    if (!question || d.asking) return;
    App.state.djowCheckout = {
      ...d,
      asking: true,
      input: '',
      messages: [...(d.messages || []), { role: 'user', text: question, ts: Date.now() }]
    };
    App.render();
    const token = localStorage.getItem('lj_jwt');
    const context = Actions._djowContextPayload();
    const history = App.state.djowCheckout.messages.slice(0, -1); // sem a mensagem atual
    try {
      const r = await fetch('/api/djow-checkout-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'ask', context, question, history })
      });
      const data = await r.json();
      const text = data.ok ? data.text : (data.message || 'Erro IA');
      App.state.djowCheckout = {
        ...App.state.djowCheckout,
        asking: false,
        messages: [...App.state.djowCheckout.messages, { role: 'assistant', text, ts: Date.now() }]
      };
      App.render();
    } catch (err) {
      App.state.djowCheckout = {
        ...App.state.djowCheckout,
        asking: false,
        messages: [...App.state.djowCheckout.messages, { role: 'assistant', text: `Erro: ${err.message}`, ts: Date.now() }]
      };
      App.render();
    }
  },

  async syncHotmartHistory(windowDays = null) {
    const token = localStorage.getItem('lj_jwt');
    Utils.toast('Sincronizando histórico Hotmart…');
    try {
      const r = await fetch('/api/hotmart-sync-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(windowDays ? { window_days: windowDays } : {})
      });
      const data = await r.json();
      if (!data.ok) {
        Utils.toast(`Falha: ${data.message || data.fatal || 'erro desconhecido'}`);
        return;
      }
      Utils.toast(`✓ Sync ok: ${data.processed || 0} processada(s), ${data.promoted || 0} promovida(s)`);
      Actions.loadCheckoutDashboard();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V34.9.21 — Expande/recolhe lista de leads do sub-stage. Lazy-load.
  async toggleSubStageLeads(substageId) {
    const m = App.state.subStageFunnelModal;
    if (!m?.open) return;
    const sub = m.substages.find(s => Number(s.id) === Number(substageId));
    if (!sub) return;
    if (sub._expanded) {
      sub._expanded = false;
      App.render();
      return;
    }
    sub._expanded = true;
    sub._leads = null; // sinaliza loading
    App.render();
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch(`/api/substage-leads?campaign_id=${m.campaignId}&parent_stage=${encodeURIComponent(m.parentStage)}&substage_id=${substageId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await r.json();
      sub._leads = data.ok && Array.isArray(data.leads) ? data.leads : [];
      App.render();
    } catch (err) {
      sub._leads = [];
      App.render();
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V34.9.21 — Refetch contagem sem perder edição em curso.
  // Preserva _expanded/_leads dos sub-stages abertos.
  async _refetchSubStageCounts() {
    const m = App.state.subStageFunnelModal;
    if (!m?.open) return;
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch(`/api/substages?campaign_id=${m.campaignId}&parent_stage=${encodeURIComponent(m.parentStage)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await r.json();
      if (!data.ok || !Array.isArray(data.substages)) return;
      // Atualiza leadCount preservando campos editáveis e estado expandido
      for (const fresh of data.substages) {
        const existing = m.substages.find(s => Number(s.id) === Number(fresh.id));
        if (existing) {
          existing.leadCount = fresh.leadCount;
          if (existing._expanded) {
            // Recarrega leads expandidos pra refletir mudança
            existing._leads = null;
            Actions.toggleSubStageLeads(existing.id);
            existing._expanded = true;
          }
        }
      }
      App.render();
    } catch (_) {}
  },

  // V35.0.0 — Drag-and-drop pra reordenar sub-stages.
  // HTML5 native drag, sem libs. dataTransfer guarda o id da fonte.
  subStageDragStart(event, id) {
    try { event.dataTransfer.setData('text/substage-id', String(id)); event.dataTransfer.effectAllowed = 'move'; } catch (_) {}
    const target = event.currentTarget;
    if (target?.classList) target.classList.add('opacity-50');
  },
  subStageDragOver(event) {
    event.preventDefault();
    try { event.dataTransfer.dropEffect = 'move'; } catch (_) {}
  },
  subStageDragEnd(event) {
    const target = event.currentTarget;
    if (target?.classList) target.classList.remove('opacity-50');
  },
  async subStageDrop(event, targetId) {
    event.preventDefault();
    const sourceId = Number(event.dataTransfer.getData('text/substage-id'));
    if (!sourceId || sourceId === Number(targetId)) return;
    const m = App.state.subStageFunnelModal;
    if (!m?.open) return;
    const arr = m.substages;
    const srcIdx = arr.findIndex(s => Number(s.id) === sourceId);
    const tgtIdx = arr.findIndex(s => Number(s.id) === Number(targetId));
    if (srcIdx < 0 || tgtIdx < 0) return;
    const [moved] = arr.splice(srcIdx, 1);
    arr.splice(tgtIdx, 0, moved);
    // Recalcula order_idx local
    arr.forEach((s, i) => { s.order_idx = i; });
    App.render();
    // Persiste no backend
    const token = localStorage.getItem('lj_jwt');
    try {
      const r = await fetch('/api/substages-reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          campaign_id: m.campaignId,
          parent_stage: m.parentStage,
          ordered_ids: arr.map(s => s.id)
        })
      });
      const data = await r.json();
      if (!data.ok) Utils.toast(`Falha ao reordenar: ${data.message}`);
      else Actions._refetchSubStageCounts();
    } catch (err) { Utils.toast(`Erro: ${err.message}`); }
  },

  // V35.0.0 — Color picker.
  toggleSubStageColorPicker(id) {
    const m = App.state.subStageFunnelModal;
    if (!m?.open) return;
    const sub = m.substages.find(s => Number(s.id) === Number(id));
    if (!sub) return;
    sub._colorOpen = !sub._colorOpen;
    App.render();
  },
  async setSubStageColor(id, color) {
    const m = App.state.subStageFunnelModal;
    if (!m?.open) return;
    const sub = m.substages.find(s => Number(s.id) === Number(id));
    if (!sub) return;
    sub.color = color;
    sub._colorOpen = false;
    App.render();
    Actions._scheduleSubStageSave(id);
  },

  // V35.0.0 — Confirm delete via modal genérico (no lugar do confirm() nativo).
  requestDeleteSubStage(id) {
    const m = App.state.subStageFunnelModal;
    const sub = m?.substages?.find(s => Number(s.id) === Number(id));
    const name = sub?.name || 'este sub-stage';
    Actions.openConfirmModal({
      title: 'Remover sub-stage',
      message: `Tem certeza que quer remover "${name}"? Os leads que estavam nele recairão na entrada padrão (sub-stage 1).`,
      confirmLabel: 'Remover',
      confirmTone: 'red',
      onConfirm: () => Actions.deleteSubStage(id)
    });
  },

  // ===== Confirm Modal genérico =====
  openConfirmModal({ title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', confirmTone = 'slate', onConfirm = null }) {
    App.state.confirmModal = {
      open: true,
      title, message, confirmLabel, cancelLabel, confirmTone,
      _onConfirm: onConfirm
    };
    App.render();
  },
  closeConfirmModal() {
    App.state.confirmModal = { open: false };
    App.render();
  },
  runConfirmModal() {
    const cb = App.state.confirmModal?._onConfirm;
    Actions.closeConfirmModal();
    if (typeof cb === 'function') cb();
  },

  // V34.9.21 — Valida tag_trigger no front antes de persistir (UNIQUE no banco).
  // Marca o sub-stage com _tagError pra UI mostrar feedback visual.
  _validateSubStageTag(sub) {
    const m = App.state.subStageFunnelModal;
    if (!m?.open) return true;
    const tag = String(sub.tag_trigger || '').trim().toLowerCase();
    if (!tag) {
      sub._tagError = null;
      return true;
    }
    const conflict = m.substages.find(s =>
      Number(s.id) !== Number(sub.id) &&
      String(s.tag_trigger || '').trim().toLowerCase() === tag
    );
    sub._tagError = conflict ? `Tag já usada em "${conflict.name || `Sub-stage ${conflict.order_idx + 1}`}"` : null;
    return !conflict;
  },

  async deleteScoreRule(ruleId) {
    if (!confirm('Remover esta regra? Esta ação não pode ser desfeita.')) return;
    const token = localStorage.getItem('lj_jwt');
    try {
      const res = await fetch('/api/score-rules', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: ruleId })
      });
      const data = await res.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      Utils.toast('✓ Regra removida.');
      await this.loadScoreRules();
    } catch (err) { Utils.toast(`Erro: ${err.message}`); }
  },

  // V34.9.3 — Triggers Engine: CRUD da modal de triggers do Flow Map.
  async openTriggersModal(campaignId) {
    const cid = Number(campaignId);
    if (!cid) return Utils.toast('Selecione uma campanha primeiro.');
    App.state.triggersModal = {
      ...(App.state.triggersModal || {}),
      open: true,
      loading: true,
      campaignId: cid,
      triggers: [],
      draft: null,
      editingId: null
    };
    App.render();
    await this.loadTriggers(cid);
  },

  closeTriggersModal() {
    App.state.triggersModal = { ...(App.state.triggersModal || {}), open: false, loading: false, draft: null, editingId: null };
    App.render();
  },

  async loadTriggers(campaignId) {
    const cid = Number(campaignId || App.state.triggersModal?.campaignId);
    if (!cid) return;
    const token = localStorage.getItem('lj_jwt');
    try {
      const [tRes, sRes] = await Promise.all([
        fetch(`/api/triggers?campaign_id=${cid}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/transitions-summary?campaign_id=${cid}`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      const tData = await tRes.json();
      const sData = await sRes.json().catch(() => ({}));
      if (!tData.ok) {
        Utils.toast(`Falha: ${tData.message}`);
        return;
      }
      App.state.triggersModal = {
        ...(App.state.triggersModal || {}),
        triggers: tData.triggers || [],
        transitionCounts: sData.ok ? (sData.counts || {}) : {},
        loading: false
      };
      App.render();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // Inicia rascunho de novo trigger pra um par específico (ou Master se isMaster=true).
  startTriggerDraft(fromStage, toStage, isMaster = false) {
    App.state.triggersModal = {
      ...(App.state.triggersModal || {}),
      draft: {
        is_master: Boolean(isMaster),
        from_stage: isMaster ? null : fromStage,
        to_stage: toStage,
        trigger_type: 'cta',
        trigger_param: '',
        trigger_value_int: null
      }
    };
    App.render();
  },

  cancelTriggerDraft() {
    App.state.triggersModal = { ...(App.state.triggersModal || {}), draft: null };
    App.render();
  },

  updateTriggerDraft(field, value) {
    const d = App.state.triggersModal?.draft;
    if (!d) return;
    App.state.triggersModal.draft = { ...d, [field]: value };
    // não chama App.render — evita perder foco do input
  },

  async saveTriggerDraft() {
    const m = App.state.triggersModal;
    if (!m?.draft || !m.campaignId) return;
    const token = localStorage.getItem('lj_jwt');
    try {
      const res = await fetch('/api/triggers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ campaign_id: m.campaignId, ...m.draft })
      });
      const data = await res.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      Utils.toast('✓ Trigger criado.');
      App.state.triggersModal.draft = null;
      await this.loadTriggers(m.campaignId);
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  async toggleTriggerActive(triggerId, isActive) {
    const token = localStorage.getItem('lj_jwt');
    try {
      const res = await fetch('/api/triggers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: triggerId, is_active: Boolean(isActive) })
      });
      const data = await res.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      await this.loadTriggers();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  async updateTriggerField(triggerId, field, value) {
    const token = localStorage.getItem('lj_jwt');
    try {
      const res = await fetch('/api/triggers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: triggerId, [field]: value })
      });
      const data = await res.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      await this.loadTriggers();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  async deleteTrigger(triggerId) {
    if (!confirm('Remover este trigger? Esta ação não pode ser desfeita.')) return;
    const token = localStorage.getItem('lj_jwt');
    try {
      const res = await fetch('/api/triggers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: triggerId })
      });
      const data = await res.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      Utils.toast('✓ Trigger removido.');
      await this.loadTriggers();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  async mirrorTriggersFrom(sourceCampaignId) {
    const targetId = App.state.triggersModal?.campaignId;
    if (!targetId || !sourceCampaignId) return;
    if (Number(sourceCampaignId) === Number(targetId)) {
      return Utils.toast('Origem e destino são a mesma campanha.');
    }
    if (!confirm('Espelhar triggers desta campanha origem? Triggers já existentes serão preservados.')) return;
    const token = localStorage.getItem('lj_jwt');
    try {
      const res = await fetch('/api/triggers-mirror', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ source_campaign_id: Number(sourceCampaignId), target_campaign_id: targetId })
      });
      const data = await res.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      Utils.toast(`✓ ${data.copied} trigger(s) copiado(s) · ${data.skipped} já existiam`);
      await this.loadTriggers();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  addLeadTagFromInput(leadKey) {
    const el = document.getElementById('leadTagInput');
    if (!el) return;
    const value = String(el.value || '').trim().replace(/^#/, '');
    if (!value) return;
    Actions.addLeadTag(leadKey, value);
    el.value = '';
  },

  addLeadTag(leadKey, tag) {
    const value = String(tag || '').trim().replace(/^#/, '');
    if (!value) return;
    const target = String(leadKey).toLowerCase().trim();
    App.state.actions = (App.state.actions || []).map(action => ({
      ...action,
      leads: (action.leads || []).map(lead => {
        const k = String(lead?.email || lead?.id || lead?.name || '').toLowerCase().trim();
        if (k !== target) return lead;
        const tags = Array.isArray(lead.tags) ? lead.tags : String(lead.tags || '').split(/[,;]/).map(t => t.trim()).filter(Boolean);
        if (tags.includes(value)) return lead;
        return { ...lead, tags: [...tags, value] };
      })
    }));
    App.save(); App.render();
    Utils.toast(`Tag "${value}" adicionada.`);
  },

  // V20 — Trigger events do lead (Bloco B)
  addLeadTriggerEvent(leadKey, selectId) {
    const el = document.getElementById(selectId);
    if (!el || !el.value) return Utils.toast('Escolha um evento.');
    const kind = el.value;
    const target = String(leadKey).toLowerCase().trim();
    App.state.actions = (App.state.actions || []).map(action => ({
      ...action,
      leads: (action.leads || []).map(lead => {
        const k = String(lead?.email || lead?.id || lead?.name || '').toLowerCase().trim();
        if (k !== target) return lead;
        const events = Array.isArray(lead.triggerEvents) ? lead.triggerEvents : [];
        return { ...lead, triggerEvents: [...events, { kind, ts: new Date().toISOString() }] };
      })
    }));
    el.value = '';
    App.save(); App.render();
    Utils.toast('Evento-gatilho registrado.');
  },

  removeLeadTriggerEvent(leadKey, index) {
    const target = String(leadKey).toLowerCase().trim();
    App.state.actions = (App.state.actions || []).map(action => ({
      ...action,
      leads: (action.leads || []).map(lead => {
        const k = String(lead?.email || lead?.id || lead?.name || '').toLowerCase().trim();
        if (k !== target) return lead;
        const events = Array.isArray(lead.triggerEvents) ? lead.triggerEvents : [];
        return { ...lead, triggerEvents: events.filter((_, i) => i !== Number(index)) };
      })
    }));
    App.save(); App.render();
  },

  removeLeadTag(leadKey, tag) {
    const target = String(leadKey).toLowerCase().trim();
    App.state.actions = (App.state.actions || []).map(action => ({
      ...action,
      leads: (action.leads || []).map(lead => {
        const k = String(lead?.email || lead?.id || lead?.name || '').toLowerCase().trim();
        if (k !== target) return lead;
        const tags = Array.isArray(lead.tags) ? lead.tags : String(lead.tags || '').split(/[,;]/).map(t => t.trim()).filter(Boolean);
        return { ...lead, tags: tags.filter(t => t !== tag) };
      })
    }));
    App.save(); App.render();
  },

  // Adiciona texto livre numa pergunta multi-text (interest, painPoint).
  // Comportamento: append no array da resposta. Se já existe, ignora (silent).
  addRevenueScoreMultiText(questionId, inputId) {
    const el = document.getElementById(inputId);
    if (!el) return;
    const value = String(el.value || '').trim();
    if (!value) return;
    const ctx = App.state.revenueScoreCreatorCtx;
    if (!ctx) return;
    const existing = ctx.answers?.[questionId];
    const arr = Array.isArray(existing) ? existing : (existing ? [String(existing)] : []);
    if (arr.includes(value)) { el.value = ''; return; }
    App.state.revenueScoreCreatorCtx = { ...ctx, answers: { ...ctx.answers, [questionId]: [...arr, value] } };
    el.value = '';
    App.save(); App.render();
  },

  // Custom signal cadastrado inline (sem window.prompt). Bucket dependente
  // da questão (positivo B2B / positivo B2C / negativo). Auto-marca como
  // selecionado já que o usuário acabou de digitar com intenção clara.
  addCustomScoreSignalFromInput(questionId, inputId) {
    const el = document.getElementById(inputId);
    if (!el) return;
    const name = String(el.value || '').trim();
    if (!name) return;
    const ctx = App.state.revenueScoreCreatorCtx;
    if (!ctx) return;
    const added = window.IcpConversationFlow?.addCustomSignalForQuestion?.(questionId, name);
    if (!added) {
      Utils.toast('Esse sinal já existe.');
      el.value = '';
      return;
    }
    // Auto-marca como selecionado na pergunta atual
    const current = ctx.answers?.[questionId];
    const list = Array.isArray(current) ? [...current] : (current ? [String(current)] : []);
    if (!list.includes(name)) list.push(name);
    App.state.revenueScoreCreatorCtx = { ...ctx, answers: { ...ctx.answers, [questionId]: list } };
    el.value = '';
    App.save(); App.render();
    Utils.toast(`"${name}" cadastrado e marcado.`);
  },

  // Tag aliases por signal (mapeia tag-do-RD/CSV ao signal do blueprint)
  addTagAliasFromInput(signal, inputId) {
    const el = document.getElementById(inputId);
    if (!el) return;
    const raw = String(el.value || '').trim();
    if (!raw) return;
    const tags = raw.split(/[,;]/).map(t => t.trim().replace(/^#/, '')).filter(Boolean);
    for (const t of tags) Actions.addTagAlias(signal, t);
    el.value = '';
  },

  addTagAlias(signal, tag) {
    const ctx = App.state.revenueScoreCreatorCtx;
    if (!ctx) return;
    const value = String(tag || '').trim().replace(/^#/, '');
    if (!value) return;
    const aliases = { ...(ctx.answers?.tagAliases || {}) };
    const list = Array.isArray(aliases[signal]) ? aliases[signal] : [];
    if (list.includes(value)) return;
    aliases[signal] = [...list, value];
    App.state.revenueScoreCreatorCtx = { ...ctx, answers: { ...ctx.answers, tagAliases: aliases } };
    App.render();
  },

  removeTagAlias(signal, tag) {
    const ctx = App.state.revenueScoreCreatorCtx;
    if (!ctx) return;
    const aliases = { ...(ctx.answers?.tagAliases || {}) };
    const list = Array.isArray(aliases[signal]) ? aliases[signal] : [];
    aliases[signal] = list.filter(t => t !== tag);
    App.state.revenueScoreCreatorCtx = { ...ctx, answers: { ...ctx.answers, tagAliases: aliases } };
    App.render();
  },

  dismissStrategicOnboarding() {
    // V31.2.0 — Agora SÓ pula welcome dessa sessão de visualização (não persiste).
    // Mantém StrategicOnboarding.markSeen pra compat com chamadas legacy.
    const productId = App.state.strategicMapProductId;
    if (productId && window.StrategicOnboarding) StrategicOnboarding.markSeen(productId);
    App.state.strategicSkipOnboarding = true;
    // Garante que entra na etapa Vision (semântica "Começar pela Visão")
    if (window.StrategicZoomNavigation) StrategicZoomNavigation.set('vision');
    App.save(); App.render();
  },

  // V31.2.0 — "Já configurou?" → pula welcome sem resetar etapa atual.
  skipStrategicOnboarding() {
    App.state.strategicSkipOnboarding = true;
    App.save(); App.render();
  },

  openStrategicOnboarding() {
    const productId = App.state.strategicMapProductId;
    if (!productId || !window.StrategicOnboarding) return;
    StrategicOnboarding.reset(productId);
    App.state.strategicSkipOnboarding = false; // re-mostra welcome
    App.save(); App.render();
  },

  setStrategicZoom(level) {
    if (!window.StrategicZoomNavigation) return;
    StrategicZoomNavigation.set(level);
    // V36.9.0 — Ao entrar na etapa 1 com vision vazio, marcar inTutorial pra
    // manter modo tutorial estável durante typing (sem swap surpresa pra revisão).
    if (level === 'vision' || level === 'strategy') {
      const productId = App.state.strategicMapProductId;
      const vision = productId && window.StrategicMapEngine
        ? String(StrategicMapEngine.getForProduct(productId).vision || '').trim()
        : '';
      App.state.strategicVisionInTutorial = !vision;
      App.state.strategicVisionEditDraft = null;
    } else {
      App.state.strategicVisionInTutorial = false;
      App.state.strategicVisionEditDraft = null;
    }
    App.save(); App.render();
    // V31.1.1 — Reseta scroll do container do Mapa pra topo ao trocar etapa.
    // Junto com o stepper sticky, garante que o user vê a etapa do início.
    setTimeout(() => {
      const c = document.getElementById('strategicMapScrollContainer');
      if (c) c.scrollTop = 0;
    }, 30);
  },

  advanceStrategicStep() {
    if (!window.StrategicZoomNavigation) return;
    if (StrategicZoomNavigation.isLast()) return;
    // V32.5.2 (Leonardo) — Hand-off de transição: Djow lateral celebra a
    // saída da etapa + anuncia a chegada na próxima. Reduz a "sala silenciosa"
    // que cliente sentia antes (cada etapa abria sozinha, sem rastro).
    const current = StrategicZoomNavigation.current();
    const next = StrategicZoomNavigation.next();
    if (window.DjowStrategicAssistant && App.state.strategicMapProductId) {
      // V36.10.0 — Etapa "campaign" fundiu Selecionar Campanha + As Ações.
      // Não há mais handoff entre elas (era passo morto). Handoff de "okrs"
      // agora aponta direto pro trabalho unificado.
      const handoffMessages = {
        vision:     '✓ Objetivo cravado. Agora vamos atribuir os donos das 3 frentes comerciais.',
        objectives: '✓ Donos definidos. Hora de definir os números que cada frente precisa entregar.',
        okrs:       '✓ Números prontos. Escolha a campanha e desenhe as ações que vão mover esses números.',
        campaign:   '✓ Ações ativadas. Pronto pra acompanhar — vamos pra Etapa 5.'
      };
      const text = handoffMessages[current];
      if (text) {
        DjowStrategicAssistant.append(App.state.strategicMapProductId, {
          role: 'transition',
          text,
          thermal: next.thermal || 'indigo',
          ts: new Date().toISOString()
        });
      }
    }
    StrategicZoomNavigation.set(next.id);
    // V36.9.0 — Saiu da etapa 1: tutorial mode desliga; próxima entrada em
    // vision (já preenchido) cai em modo revisão.
    App.state.strategicVisionInTutorial = false;
    App.state.strategicVisionEditDraft = null;
    App.save(); App.render();
  },

  toggleStrategicOkrAction(objectiveId, okrId, actionId) {
    const productId = App.state.strategicMapProductId;
    if (!productId || !window.StrategicOkrEngine) return;
    StrategicOkrEngine.toggleAction(productId, objectiveId, okrId, actionId);
    App.save(); App.render();
  },

  syncStrategicOkrSingle(objectiveId, okrId) {
    const productId = App.state.strategicMapProductId;
    if (!productId || !window.StrategicMapEngine || !window.StrategicRevenueBridge) return;
    const map = StrategicMapEngine.getForProduct(productId);
    const obj = (map.objectives || []).find(o => o.id === objectiveId);
    const kr = obj?.okrs?.find(k => k.id === okrId);
    if (!kr) return Utils.toast('OKR não encontrado.');
    const current = StrategicRevenueBridge.computeCurrent(productId, kr);
    StrategicOkrEngine.update(productId, objectiveId, okrId, { current });
    App.save(); App.render();
    Utils.toast(`OKR atualizado: ${current} ${kr.metric}.`);
  },

  openQuickActionModal(productId, objectiveId, okrId) {
    const campaigns = (App.state.campaigns || []).filter(c => Number(c.productId) === Number(productId));
    if (!campaigns.length) {
      Utils.toast('Crie uma campanha para este produto antes de criar ações.');
      return;
    }
    App.state.quickActionContext = { productId: Number(productId), objectiveId, okrId };
    const channels = window.Config?.allChannels?.() || [];
    const types = window.Config?.allActionTypes?.() || [];
    App.state.quickActionDraft = {
      name: '',
      campaignId: Number(campaigns[0].id),
      channel: channels[0] || 'Instagram Orgânico',
      actionType: types[0] || 'Post'
    };
    App.state.showQuickActionModal = true;
    App.save(); App.render();
  },

  updateQuickActionDraft(field, value) {
    App.state.quickActionDraft = { ...(App.state.quickActionDraft || {}), [field]: value };
  },

  closeQuickActionModal() {
    App.state.showQuickActionModal = false;
    App.state.quickActionContext = null;
    App.state.quickActionDraft = { name: '', campaignId: null, channel: '', actionType: '' };
    App.save(); App.render();
  },

  createQuickAction() {
    const draft = App.state.quickActionDraft || {};
    const ctx = App.state.quickActionContext;
    if (!ctx) return Utils.toast('Contexto perdido. Reabra pelo OKR.');
    const name = String(draft.name || '').trim();
    if (!name) return Utils.toast('Digite o nome da ação.');
    const campaignId = Number(draft.campaignId);
    if (!campaignId) return Utils.toast('Selecione uma campanha.');
    const sector = 'Marketing', funnel = 'MOF';
    const flowPath = FlowResolutionEngine.resolve(sector, funnel, sector, funnel);
    const channel = draft.channel || 'Instagram Orgânico';
    const actionType = draft.actionType || 'Post';
    const action = {
      id: Date.now(),
      campaignId,
      name,
      channel,
      actionType,
      sector, funnel,
      originSector: sector, originFunnel: funnel, destinationSector: sector, destinationFunnel: funnel,
      conversionObjective: '',
      objective: '',
      expectedConversion: 25,
      mailingDefined: false,
      okrs: [],
      flowPath,
      scoreId: App.state.scores?.[0]?.id || 1,
      connected: false,
      connectionStatus: 'ready',
      status: 'Rascunho — completar em Ações',
      leads: [],
      flowConfig: FlowResolutionEngine.buildDefaultFlowConfig ? FlowResolutionEngine.buildDefaultFlowConfig(flowPath, channel) : null,
      isDraft: true,
      createdAt: new Date().toISOString()
    };
    App.state.actions = [action, ...(App.state.actions || [])];
    if (window.StrategicOkrEngine) {
      StrategicOkrEngine.toggleAction(ctx.productId, ctx.objectiveId, ctx.okrId, action.id);
    }
    App.state.showQuickActionModal = false;
    App.state.quickActionContext = null;
    App.state.quickActionDraft = { name: '', campaignId: null, channel: '', actionType: '' };
    App.save(); App.render();
    Utils.toast(`"${name}" criada como rascunho e conectada ao OKR. Complete em Ações de Campanha para a leitura ficar precisa.`);
  },

  // V30.0.0 — Agora abre o CreateClickupTaskModal (Caminho híbrido C) ao invés de
  // mandar tudo via chat Djow. Pré-preenche título/descrição com contexto do OKR;
  // user pode refinar via botão "Falar com Djow" no próprio modal.
  createTaskFromOkr(productId, objectiveId, okrId, actionId) {
    const map = window.StrategicMapEngine ? StrategicMapEngine.getForProduct(productId) : null;
    const obj = map?.objectives?.find(o => o.id === objectiveId);
    const kr = obj?.okrs?.find(k => k.id === okrId);
    const action = (App.state.actions || []).find(a => Number(a.id) === Number(actionId));
    if (!kr || !action) return Utils.toast('OKR ou ação não encontrada.');
    const suggestedName = `[${kr.name}] ${action.name}`;
    const descLines = [
      `OKR: ${kr.name}`,
      `Objetivo: ${obj.label}`,
      `Meta: ${kr.target} ${kr.metric} (atual: ${kr.current || 0})`,
      kr.deadline ? `Prazo do OKR: ${kr.deadline}` : null,
      `Ação operacional: ${action.name}`,
      kr.owner ? `Responsável sugerido: ${kr.owner}` : null
    ].filter(Boolean).join('\n');
    App.state.showStrategicMap = false;
    Actions.openCreateClickupTaskModal({
      summary: `OKR "${kr.name}" · Ação "${action.name}"`,
      productId, objectiveId, okrId, actionId: Number(actionId),
      suggestedName,
      suggestedDescription: descLines,
      suggestedDueDate: kr.deadline || ''
    });
  },

  updateStrategicVision(value) {
    const productId = App.state.strategicMapProductId;
    if (!productId || !window.StrategicMapEngine) return;
    // V32.4.4 — Re-render só na transição vazio↔preenchido pra habilitar o
    // botão "Próximo passo" sem perder foco do textarea durante typing normal.
    const wasFilled = Boolean(String(StrategicMapEngine.getForProduct(productId).vision || '').trim());
    StrategicMapEngine.setVision(productId, value);
    App.save();
    const isFilled = Boolean(String(value || '').trim());
    if (wasFilled !== isFilled) App.render();
  },

  // V36.9.0 — Etapa 1 em modo REVISÃO: cliente clica "Editar" pra mexer na frase.
  // Draft separado pra Cancel reverter (ao contrário do tutorial que salva direto).
  startStrategicVisionEdit() {
    const productId = App.state.strategicMapProductId;
    if (!productId || !window.StrategicMapEngine) return;
    const current = String(StrategicMapEngine.getForProduct(productId).vision || '');
    App.state.strategicVisionEditDraft = current;
    App.render();
  },

  updateStrategicVisionDraft(value) {
    if (App.state.strategicVisionEditDraft === null || App.state.strategicVisionEditDraft === undefined) return;
    App.state.strategicVisionEditDraft = String(value || '');
  },

  saveStrategicVisionEdit() {
    const productId = App.state.strategicMapProductId;
    if (!productId || !window.StrategicMapEngine) return;
    const draft = String(App.state.strategicVisionEditDraft || '').trim();
    if (!draft) return Utils.toast('O objetivo não pode ficar vazio.');
    StrategicMapEngine.setVision(productId, draft);
    App.state.strategicVisionEditDraft = null;
    App.save(); App.render();
    Utils.toast('Objetivo atualizado.');
  },

  cancelStrategicVisionEdit() {
    App.state.strategicVisionEditDraft = null;
    App.render();
  },

  startStrategicObjectiveDraft() {
    App.state.strategicObjectiveDraft = { label: '', owner: '', deadline: '', wizardStep: 1 };
    App.render();
  },

  updateStrategicObjectiveDraft(field, value) {
    if (!App.state.strategicObjectiveDraft) return;
    App.state.strategicObjectiveDraft = { ...App.state.strategicObjectiveDraft, [field]: value };
  },

  nextStrategicObjectiveStep() {
    const draft = App.state.strategicObjectiveDraft;
    if (!draft) return;
    const step = Number(draft.wizardStep || 1);
    App.state.strategicObjectiveDraft = { ...draft, wizardStep: Math.min(step + 1, 3) };
    App.render();
  },

  prevStrategicObjectiveStep() {
    const draft = App.state.strategicObjectiveDraft;
    if (!draft) return;
    const step = Number(draft.wizardStep || 1);
    App.state.strategicObjectiveDraft = { ...draft, wizardStep: Math.max(step - 1, 1) };
    App.render();
  },

  cancelStrategicObjectiveDraft() {
    App.state.strategicObjectiveDraft = null;
    App.render();
  },

  saveStrategicObjectiveDraft() {
    const productId = App.state.strategicMapProductId;
    const draft = App.state.strategicObjectiveDraft;
    if (!productId || !draft) return;
    if (!String(draft.label || '').trim()) return Utils.toast('Dê um nome à batalha.');
    StrategicObjectiveEngine.add(productId, { label: draft.label, owner: draft.owner, deadline: draft.deadline });
    App.state.strategicObjectiveDraft = null;
    App.save(); App.render();
    Utils.toast('Batalha adicionada.');
  },

  // V28.0.0 — Carrega as 4 batalhas da Cacau Show direto como objetivos salvos.
  // O usuário usa como ponto de partida e ajusta dono/prazo depois.
  loadCacauShowBatalhasExample() {
    const productId = App.state.strategicMapProductId;
    if (!productId || !window.StrategicObjectiveEngine) return;
    const exemplos = [
      'Estar presente em mais bairros do Brasil',
      'Fazer cada cliente voltar mais vezes no ano',
      'Garantir que todo mundo lembre da gente nas datas comemorativas',
      'Conquistar quem hoje compra chocolate importado'
    ];
    exemplos.forEach(label => StrategicObjectiveEngine.add(productId, { label, owner: '', deadline: '' }));
    App.state.strategicObjectiveDraft = null;
    App.save(); App.render();
    Utils.toast('4 batalhas Cacau Show carregadas como rascunho. Ajuste dono e prazo de cada uma.');
  },

  removeStrategicObjective(objectiveId) {
    const productId = App.state.strategicMapProductId;
    if (!productId) return;
    StrategicObjectiveEngine.remove(productId, objectiveId);
    App.save(); App.render();
    Utils.toast('Frente removida.');
  },

  // V28.1.1 — Toggle de balão de ajuda (?) em qualquer etapa do Mapa.
  // key: identificador único do balão (ex: 'vision-objetivo-comercial').
  toggleStrategicHelp(key) {
    const current = App.state.strategicHelpOpen || {};
    App.state.strategicHelpOpen = { ...current, [key]: !current[key] };
    App.render();
  },

  // V28.1 — Edita campo de uma frente comercial (Marketing/Vendas/CS).
  // areaId: 'marketing'|'sales'|'cs'; field: 'owner'|'deadline'|'label'.
  updateStrategicAreaField(areaId, field, value) {
    const productId = App.state.strategicMapProductId;
    if (!productId || !window.StrategicMapEngine) return;
    const objective = StrategicMapEngine.getObjectiveByArea(productId, areaId);
    if (!objective) return;
    const patch = field === 'deadline' ? { deadline: value || null } : { [field]: String(value || '') };
    StrategicObjectiveEngine.update(productId, objective.id, patch);
    App.save();
  },

  startStrategicOkrDraft(objectiveId) {
    App.state.strategicOkrDraft = {
      objectiveId,
      name: '',
      metric: 'quantidade',
      target: 0,
      current: 0,
      startValue: 0,
      owner: '',
      deadline: '',
      impact: '',
      commitmentType: 'stretch',
      connectedActionIds: [],
      wizardStep: 1
    };
    App.render();
  },

  nextStrategicOkrStep() {
    const draft = App.state.strategicOkrDraft;
    if (!draft) return;
    const step = Number(draft.wizardStep || 1);
    App.state.strategicOkrDraft = { ...draft, wizardStep: Math.min(step + 1, 7) };
    App.render();
  },

  prevStrategicOkrStep() {
    const draft = App.state.strategicOkrDraft;
    if (!draft) return;
    const step = Number(draft.wizardStep || 1);
    App.state.strategicOkrDraft = { ...draft, wizardStep: Math.max(step - 1, 1) };
    App.render();
  },

  updateStrategicOkrDraft(field, value) {
    if (!App.state.strategicOkrDraft) return;
    App.state.strategicOkrDraft = { ...App.state.strategicOkrDraft, [field]: value };
  },

  toggleStrategicOkrDraftAction(actionId) {
    const draft = App.state.strategicOkrDraft;
    if (!draft) return;
    const numId = Number(actionId);
    const current = (draft.connectedActionIds || []).map(Number);
    const exists = current.includes(numId);
    App.state.strategicOkrDraft = { ...draft, connectedActionIds: exists ? current.filter(id => id !== numId) : [...current, numId] };
    App.render();
  },

  cancelStrategicOkrDraft() {
    App.state.strategicOkrDraft = null;
    App.render();
  },

  saveStrategicOkrDraft() {
    const productId = App.state.strategicMapProductId;
    const draft = App.state.strategicOkrDraft;
    if (!productId || !draft) return;
    if (!String(draft.name || '').trim()) return Utils.toast('Dê um nome ao OKR.');
    // V31.2.10 — Roteia baseado em draft.area (V29 productKr) vs draft.objectiveId (legacy V28).
    if (draft.area) {
      const target = Number(draft.target || 0);
      const tipo = draft.commitmentType === 'committed' ? 'committed' : 'stretch';
      StrategicMapEngine.addProductKr(Number(productId), {
        area: draft.area,
        name: draft.name,
        metric: draft.metric || 'quantidade',
        // commitmentType decide se 'target' vai pra targetCommitted (seguro) ou targetStretch (avançado)
        targetCommitted: tipo === 'committed' ? target : null,
        targetStretch: tipo === 'stretch' ? target : null,
        period: 90,
        owner: String(draft.owner || '').trim()
      });
    } else {
      StrategicOkrEngine.add(productId, draft.objectiveId, draft);
    }
    App.state.strategicOkrDraft = null;
    App.save(); App.render();
    Utils.toast('Número adicionado.');
  },

  removeStrategicOkr(objectiveId, okrId) {
    const productId = App.state.strategicMapProductId;
    if (!productId) return;
    StrategicOkrEngine.remove(productId, objectiveId, okrId);
    App.save(); App.render();
    Utils.toast('Número removido.');
  },

  // V28.2 — Ativa um número do catálogo guiado (Marketing/Vendas/CS).
  activateStrategicKpi(areaId, kpiId) {
    const productId = App.state.strategicMapProductId;
    if (!productId || !window.StrategicMapEngine) return;
    const already = StrategicMapEngine.getActivatedCatalogIds(productId, areaId);
    if (already.has(kpiId)) return Utils.toast('Esse número já está ativo.');
    StrategicMapEngine.activateCatalogKpi(productId, areaId, kpiId);
    App.save(); App.render();
    Utils.toast('Número ativado. Preencha a meta.');
  },

  // V28.2 — Edita campo de um número inline. V28.2.1: aceita null pra valores vazios.
  updateStrategicOkrField(objectiveId, okrId, field, value) {
    const productId = App.state.strategicMapProductId;
    if (!productId || !window.StrategicOkrEngine) return;
    const numericFields = ['current', 'target', 'targetCommitted', 'targetStretch', 'startValue', 'period'];
    const patch = {};
    if (numericFields.includes(field)) {
      patch[field] = (value === '' || value === null || value === undefined) ? null : Number(value);
      // Sincroniza `target` legado com targetCommitted.
      if (field === 'targetCommitted') patch.target = patch.targetCommitted ?? 0;
    } else if (field === 'deadline') {
      patch.deadline = value || null;
    } else {
      patch[field] = String(value || '');
    }
    StrategicOkrEngine.update(productId, objectiveId, okrId, patch);
    App.save();
  },

  // V28.2.1 — Seta período (em dias) e recalcula deadline a partir de hoje.
  setStrategicNumeroPeriod(objectiveId, okrId, periodDays) {
    const productId = App.state.strategicMapProductId;
    if (!productId || !window.StrategicOkrEngine) return;
    const period = Number(periodDays);
    const deadline = StrategicOkrEngine._computeDeadline ? StrategicOkrEngine._computeDeadline(period) : null;
    StrategicOkrEngine.update(productId, objectiveId, okrId, { period, deadline });
    App.save(); App.render();
  },

  // V28.2.3 — Tenta mudar período. Se for 90, aplica direto. Se for 30 ou 60,
  // abre balão do Djow com explicação antes — user confirma ou volta.
  tryChangeStrategicPeriod(objectiveId, okrId, periodDays) {
    const days = Number(periodDays);
    if (days === 90) {
      App.state.strategicPeriodWarning = null;
      return Actions.setStrategicNumeroPeriod(objectiveId, okrId, 90);
    }
    App.state.strategicPeriodWarning = { krId: okrId, objectiveId, attemptedDays: days };
    App.render();
  },

  // V28.2.3 — Confirma a mudança pra período não-recomendado (após ler o aviso do Djow).
  confirmStrategicPeriodChange(objectiveId, okrId) {
    const warning = App.state.strategicPeriodWarning;
    if (!warning || warning.krId !== okrId) return;
    Actions.setStrategicNumeroPeriod(objectiveId, okrId, warning.attemptedDays);
    App.state.strategicPeriodWarning = null;
    App.render();
  },

  // V28.2.3 — Fecha o aviso e mantém em 90 dias.
  dismissStrategicPeriodWarning(objectiveId, okrId) {
    App.state.strategicPeriodWarning = null;
    Actions.setStrategicNumeroPeriod(objectiveId, okrId, 90);
  },

  // V28.2.1 — Confirma um número (valida que tem current + 2 metas + período).
  // Se for o último de todos, dispara mensagem do Djow.
  // V28.2.3 — Auto-avança a aba ativa quando próximo unconfirmed está em outra área.
  confirmStrategicNumero(objectiveId, okrId) {
    const productId = App.state.strategicMapProductId;
    if (!productId || !window.StrategicOkrEngine) return;
    const objectives = (StrategicMapEngine.getForProduct(productId)?.objectives) || [];
    const obj = objectives.find(o => o.id === objectiveId);
    const kr = obj?.okrs?.find(k => k.id === okrId);
    if (!kr) return;
    if (!StrategicOkrEngine.isComplete(kr)) {
      return Utils.toast('Preencha Atual, Meta Segura, Meta Avançada e Período Tático antes de confirmar.');
    }
    const currentAreaId = obj?.area;
    StrategicOkrEngine.update(productId, objectiveId, okrId, { confirmed: true });
    App.save();
    // V29.0.1 — Mensagem do Djow agora é contextual à branch (campanha).
    // O "allKrsConfirmed" opera sobre a branch ativa, não sobre o produto inteiro.
    const campaignId = App.state.strategicMapCampaignId;
    const campaign = campaignId ? (App.state.campaigns || []).find(c => Number(c.id) === Number(campaignId)) : null;
    if (StrategicMapEngine.allKrsConfirmed(productId, campaignId) && window.DjowStrategicAssistant) {
      const branchLabel = campaign ? `da campanha "${campaign.name}"` : 'desta branch';
      const msg = `🎯 Boa! Você cobriu todos os números ${branchLabel} (Marketing, Vendas e Sucesso do Cliente).\n\nEsses números agora alimentam o rollup dos KRs-mãe do produto via soma automática.\n\nA partir de agora vou ficar de olho neles — se algum sair da rota, te aviso. E se eu perceber que precisa pivotar, te chamo aqui mesmo.\n\nPróximo passo: conectar cada número à ação operacional que move o ponteiro nesta campanha.`;
      DjowStrategicAssistant.append(productId, { role: 'agent', text: msg, ts: new Date().toISOString() });
      App.state.strategicHandoffPopup = true;
      Utils.toast('🎯 Todos os números confirmados nesta branch.');
    } else {
      // V28.2.3 — auto-advance: se próximo unconfirmed está em outra frente, mudar aba ativa.
      const next = StrategicMapEngine.nextUnconfirmedKr(productId);
      if (next && next.areaId && next.areaId !== currentAreaId) {
        App.state.strategicActiveArea = next.areaId;
        Utils.toast(`Número confirmado. Avançando pra próxima frente.`);
      } else {
        Utils.toast('Número confirmado.');
      }
    }
    App.render();
  },

  // V28.2.3 — Seleciona qual frente está ativa (tab nav). V28.3: compartilhado
  // entre as etapas Números e Ações.
  // V32.13.0 — Toggle: clicar na mesma frente desmarca (volta neutro).
  // Permite estado "nenhuma selecionada" no stack vertical.
  setStrategicActiveArea(areaId) {
    const cur = App.state.strategicActiveArea;
    App.state.strategicActiveArea = (cur === areaId) ? null : areaId;
    // V32.13.1 — Trocar de frente fecha qualquer KR picker aberto.
    App.state.strategicKrPickerOpen = null;
    App.render();
  },

  // V32.13.1 — KR Picker: mini-modal que pergunta qual KR-mãe a nova ação
  // vai mover. Aberto via botão "+ Adicionar ação" no card da frente ativa.
  openStrategicKrPicker(areaId) {
    App.state.strategicKrPickerOpen = { areaId: String(areaId) };
    App.render();
  },

  closeStrategicKrPicker() {
    App.state.strategicKrPickerOpen = null;
    App.render();
  },

  // V32.13.6 — Cliente escolheu o KR-mãe no mini-modal. Cria action STUB
  // (sem nome ainda) já plugada ao KR + frente + campanha. Não abre modal
  // de inserção — a action aparece como retângulo amber (pendente) no
  // mind-map; cliente clica nela pra preencher.
  //
  // Reproduz a lógica do connectWizardConfirm: ensure branch + objective +
  // childKr + connectedActionIds. Diferença: cria a action stub primeiro.
  chooseKrInPicker(areaId, krId) {
    const campaignId = App.state.strategicMapCampaignId;
    const productId = App.state.strategicMapProductId;
    if (!campaignId || !productId) {
      Utils.toast('Sem campanha/produto ativos — não dá pra criar ação.');
      App.state.strategicKrPickerOpen = null;
      App.render();
      return;
    }
    const productKr = (StrategicMapEngine.getProductKrs(productId) || []).find(k => k.id === krId);
    if (!productKr) {
      Utils.toast('KR-mãe não encontrado.');
      App.state.strategicKrPickerOpen = null;
      App.render();
      return;
    }

    // 1. Cria action STUB (vazia) com strategic fields
    const owner = (window.StrategicMapEngine?.getAreaOwner && StrategicMapEngine.getAreaOwner(productId, areaId)) || '';
    const newAction = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      name: '',
      campaignId: Number(campaignId),
      channel: '',
      actionType: '',
      strategicAreaId: areaId,
      strategicOwner: owner,
      strategicStatus: 'planned',
      strategicConfirmed: true,
      strategicCadence: null,
      strategicCatalogId: null,
      strategicDescription: '',
      leads: [],
      createdAt: new Date().toISOString()
    };
    App.state.actions = [...(App.state.actions || []), newAction];

    // 2. Ensure branch
    let branch = StrategicMapEngine.getBranchMap(campaignId);
    if (!branch) branch = StrategicMapEngine.ensureBranchMap(campaignId, productId);
    if (!branch) {
      Utils.toast('Falha ao criar branch da campanha.');
      App.state.strategicKrPickerOpen = null;
      App.render();
      return;
    }

    // 3. Ensure objective (frente) dentro da branch
    branch.objectives = branch.objectives || [];
    let objective = branch.objectives.find(o => o.area === areaId);
    if (!objective) {
      const areaDef = (StrategicMapEngine.COMERCIAL_AREAS || []).find(a => a.id === areaId);
      objective = {
        id: `obj_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        label: areaDef?.label || areaId,
        area: areaId,
        owner,
        deadline: '',
        okrs: [],
        createdAt: new Date().toISOString()
      };
      branch.objectives.push(objective);
    }

    // 4. Ensure child KR com parentProductKrId = productKr.id
    let childKr = (objective.okrs || []).find(k => k.parentProductKrId === productKr.id);
    if (!childKr) {
      childKr = {
        id: `okr_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        name: productKr.name,
        metric: productKr.metric || 'quantidade',
        catalogId: productKr.catalogId || null,
        isHandoff: false,
        current: 0,
        targetCommitted: productKr.targetCommitted ?? productKr.target ?? null,
        targetStretch: productKr.targetStretch ?? null,
        period: productKr.period || 90,
        confirmed: false,
        connectedActionIds: [],
        parentProductKrId: productKr.id
      };
      objective.okrs = [...(objective.okrs || []), childKr];
    }

    // 5. Conecta action.id ao childKr.connectedActionIds
    const ids = new Set((childKr.connectedActionIds || []).map(Number));
    ids.add(Number(newAction.id));
    childKr.connectedActionIds = Array.from(ids);

    // 6. Persiste + fecha mini-modal + marca id pra animação no card
    branch.updatedAt = new Date().toISOString();
    App.state.strategicCampaignMaps = { ...(App.state.strategicCampaignMaps || {}), [campaignId]: branch };
    App.state.strategicKrPickerOpen = null;
    App.state.strategicJustCreatedActionId = newAction.id;  // pra anim CSS "entrar"
    App.save();
    App.render();
    Utils.toast(`✓ Ação criada (vazia). Clique no retângulo amber pra preencher.`);
    // Limpa flag de animação após o keyframe rodar (1100ms + margem) pra não
    // re-animar em re-renders subsequentes (edição, etc).
    setTimeout(() => {
      if (App.state.strategicJustCreatedActionId === newAction.id) {
        App.state.strategicJustCreatedActionId = null;
      }
    }, 1500);
  },

  // V32.13.12 — Editor de ação acionado pelo click no card do mind-map.
  // Visual do Print 1 (KR plugado + checkboxes outros KRs + nome + onde
  // começa + pra onde leva + canal). Opera sobre action EXISTENTE (não cria).
  openMindMapActionEditor(actionId) {
    App.state.strategicMindMapActionEditor = { actionId: Number(actionId) };
    App.render();
  },

  closeMindMapActionEditor() {
    App.state.strategicMindMapActionEditor = null;
    App.render();
  },

  // Salva edição da action stub. Atualiza nome + canal + actionType +
  // funnelPoint + destSector + destFunnelPoint + KRs vinculados.
  saveMindMapAction(payload) {
    const ed = App.state.strategicMindMapActionEditor;
    if (!ed?.actionId) return;
    const action = (App.state.actions || []).find(a => Number(a.id) === Number(ed.actionId));
    if (!action) return Utils.toast('Ação não encontrada.');
    const data = payload || {};
    // Validação básica
    if (!String(data.name || '').trim()) return Utils.toast('Dê um nome à ação.');
    if (!data.channel) return Utils.toast('Escolha o canal.');
    if (!data.actionType) return Utils.toast('Escolha o tipo.');
    if (!data.funnelPoint) return Utils.toast('Escolha onde a ação começa.');
    if (!data.destSector || !data.destFunnelPoint) return Utils.toast('Escolha pra onde a ação leva.');
    // Atualiza
    action.name = String(data.name).trim();
    action.channel = String(data.channel || '').trim();
    action.actionType = String(data.actionType || '').trim();
    action.funnelPoint = data.funnelPoint;
    action.destSector = data.destSector;
    action.destFunnelPoint = data.destFunnelPoint;
    // Atualiza KRs vinculados na branch
    const campaignId = Number(action.campaignId);
    const branch = StrategicMapEngine.getBranchMap(campaignId);
    if (branch) {
      const objective = (branch.objectives || []).find(o => o.area === action.strategicAreaId);
      if (objective) {
        const selectedKrIds = Array.isArray(data.selectedKrIds) ? data.selectedKrIds.map(String) : [];
        // Remove action.id de todos KRs daquela área primeiro
        (objective.okrs || []).forEach(kr => {
          const ids = (kr.connectedActionIds || []).map(Number).filter(id => id !== Number(action.id));
          kr.connectedActionIds = ids;
        });
        // Adiciona action.id nos KRs selecionados (criando childKr se necessário)
        selectedKrIds.forEach(parentKrId => {
          let childKr = (objective.okrs || []).find(k => k.parentProductKrId === parentKrId);
          if (!childKr) {
            const productKr = (StrategicMapEngine.getProductKrs(App.state.strategicMapProductId) || []).find(k => k.id === parentKrId);
            if (!productKr) return;
            childKr = {
              id: `okr_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
              name: productKr.name,
              metric: productKr.metric || 'quantidade',
              catalogId: productKr.catalogId || null,
              isHandoff: false,
              current: 0,
              targetCommitted: productKr.targetCommitted ?? productKr.target ?? null,
              targetStretch: productKr.targetStretch ?? null,
              period: productKr.period || 90,
              confirmed: false,
              connectedActionIds: [],
              parentProductKrId: parentKrId
            };
            objective.okrs = [...(objective.okrs || []), childKr];
          }
          const ids = new Set((childKr.connectedActionIds || []).map(Number));
          ids.add(Number(action.id));
          childKr.connectedActionIds = Array.from(ids);
        });
        branch.updatedAt = new Date().toISOString();
        App.state.strategicCampaignMaps = { ...(App.state.strategicCampaignMaps || {}), [campaignId]: branch };
      }
    }
    App.state.strategicMindMapActionEditor = null;
    App.save(); App.render();
    Utils.toast(`✓ Ação "${action.name}" criada.`);
  },

  // V32.13.15 — Click no botão "Executar Ação" no card do mind-map.
  // Abre o modal taskCreationModal existente, pré-populado com dados da ação.
  // Cliente confirma → cria task no ClickUp via integração existente → mapeamento
  // action_id → clickup_task_id é guardado pra renderizar a branch de execução
  // no mind-map.
  executeStrategicAction(actionId) {
    if (typeof Actions.openTaskCreationModal === 'function') {
      Actions.openTaskCreationModal(Number(actionId));
    } else {
      Utils.toast('Função openTaskCreationModal indisponível.');
    }
  },

  // V35.13.3 — Resolver de ação órfã. Quando KR-mãe é deletado, ações que
  // dependiam dele ficam sem `primaryKrId` no mind-map. Card vira cinza
  // apagado com overlay "Resolver" que abre este resolver: 2 caminhos
  // (Deletar tudo / Conectar a outro KR).
  openOrphanActionResolver(actionId, mode) {
    App.state.orphanActionResolver = {
      actionId: Number(actionId),
      mode: mode === 'reconnect' ? 'reconnect' : 'choose'
    };
    App.render();
  },

  closeOrphanActionResolver() {
    App.state.orphanActionResolver = null;
    App.render();
  },

  setOrphanResolverMode(mode) {
    const cur = App.state.orphanActionResolver;
    if (!cur) return;
    App.state.orphanActionResolver = {
      ...cur,
      mode: mode === 'reconnect' ? 'reconnect' : 'choose'
    };
    App.render();
  },

  // Reconecta a ação órfã ao parentKr escolhido — garante childKr na branch
  // e injeta o actionId em connectedActionIds. Reusa exatamente a mesma
  // lógica de saveMindMapAction (linha ~9091) pra criar childKr stub.
  reconnectOrphanActionToParentKr(actionId, parentKrId) {
    const numActionId = Number(actionId);
    const action = (App.state.actions || []).find(a => Number(a.id) === numActionId);
    if (!action) return Utils.toast('Ação não encontrada.');
    const campaignId = Number(action.campaignId);
    const branch = StrategicMapEngine.getBranchMap(campaignId);
    if (!branch) return Utils.toast('Branch da campanha não encontrada.');
    const objective = (branch.objectives || []).find(o => o.area === action.strategicAreaId);
    if (!objective) return Utils.toast('Frente da ação não encontrada na branch.');
    const productId = Number(action.campaignId)
      ? ((App.state.campaigns || []).find(c => Number(c.id) === campaignId)?.productId)
      : App.state.strategicMapProductId;
    const productKrs = StrategicMapEngine.getProductKrs(productId) || [];
    const productKr = productKrs.find(k => k.id === parentKrId);
    if (!productKr) return Utils.toast('Número não encontrado.');
    // V35.13.3.1 — Antes de adicionar no novo childKr, remove o actionId de
    // childKrs órfãos (sem parent OU com parent apontando pra productKr que
    // não existe mais) na mesma frente. Senão `_actionsForFrente` (que pega a
    // 1ª ocorrência via Map.has) continuaria devolvendo o childKr órfão como
    // primaryKr e a ação ficaria órfã visualmente mesmo após reconectar.
    const productKrIdSet = new Set(productKrs.map(k => k.id));
    (objective.okrs || []).forEach(k => {
      const isOrphanChild = !k.parentProductKrId || !productKrIdSet.has(k.parentProductKrId);
      if (isOrphanChild) {
        const ids = (k.connectedActionIds || []).map(Number).filter(id => id !== numActionId);
        if (ids.length !== (k.connectedActionIds || []).length) {
          k.connectedActionIds = ids;
        }
      }
    });
    let childKr = (objective.okrs || []).find(k => k.parentProductKrId === parentKrId);
    if (!childKr) {
      childKr = {
        id: `okr_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        name: productKr.name,
        metric: productKr.metric || 'quantidade',
        catalogId: productKr.catalogId || null,
        isHandoff: false,
        current: 0,
        targetCommitted: productKr.targetCommitted ?? productKr.target ?? null,
        targetStretch: productKr.targetStretch ?? null,
        period: productKr.period || 90,
        confirmed: false,
        connectedActionIds: [],
        parentProductKrId: parentKrId
      };
      objective.okrs = [...(objective.okrs || []), childKr];
    }
    const ids = new Set((childKr.connectedActionIds || []).map(Number));
    ids.add(numActionId);
    childKr.connectedActionIds = Array.from(ids);
    branch.updatedAt = new Date().toISOString();
    App.state.strategicCampaignMaps = { ...(App.state.strategicCampaignMaps || {}), [campaignId]: branch };
    App.state.orphanActionResolver = null;
    App.save(); App.render();
    Utils.toast(`✓ Ação reconectada a "${productKr.name}".`);
  },

  // Confirma exclusão da ação órfã: remove execution tasks (que internamente
  // disparam DELETE no provider ClickUp), limpa connectedActionIds residual,
  // remove a ação do state e dispara mirror delete pro folder/list ClickUp.
  async deleteOrphanActionCascade(actionId) {
    const numActionId = Number(actionId);
    const action = (App.state.actions || []).find(a => Number(a.id) === numActionId);
    if (!action) {
      App.state.orphanActionResolver = null;
      App.render();
      return Utils.toast('Ação não encontrada.');
    }
    const tasks = window.ExecutionTaskStore ? (ExecutionTaskStore.byAction(numActionId) || []) : [];
    // 1) Remove cada execution task — internamente dispara provider delete.
    for (const t of tasks) {
      try {
        if (window.ExecutionTaskEngine) await ExecutionTaskEngine.removeTask(t.task_id);
      } catch (err) {
        console.warn('[orphan-delete] task remove falhou:', t.task_id, err?.message);
      }
    }
    // 2) Limpa connectedActionIds residual em todas branches do produto.
    const campaignId = Number(action.campaignId);
    const branch = StrategicMapEngine.getBranchMap(campaignId);
    if (branch) {
      let dirty = false;
      (branch.objectives || []).forEach(o => {
        (o.okrs || []).forEach(kr => {
          const before = (kr.connectedActionIds || []).map(Number);
          const after = before.filter(id => id !== numActionId);
          if (after.length !== before.length) {
            kr.connectedActionIds = after;
            dirty = true;
          }
        });
      });
      if (dirty) {
        branch.updatedAt = new Date().toISOString();
        App.state.strategicCampaignMaps = { ...(App.state.strategicCampaignMaps || {}), [campaignId]: branch };
      }
    }
    // 3) Remove a ação do state.
    App.state.actions = (App.state.actions || []).filter(a => Number(a.id) !== numActionId);
    if (Number(App.state.selectedActionId) === numActionId) App.state.selectedActionId = null;
    // 4) Fecha resolver.
    App.state.orphanActionResolver = null;
    App.save(); App.render();
    Utils.toast(`✓ Ação excluída${tasks.length ? ` (e ${tasks.length} task${tasks.length === 1 ? '' : 's'} no ClickUp)` : ''}.`);
    // 5) Sync delete pro mirror ClickUp (subtask "action" no folder/list).
    if (typeof Actions._syncDeleteToClickup === 'function') {
      Actions._syncDeleteToClickup('action', numActionId);
    }
  },

  // V32.13.16 / V32.14.7 — Detalhe da task de execução. Auto-sync silencioso
  // ao abrir (resolve cenário "atualizei no ClickUp e LJ não puxou ainda").
  openExecutionTaskDetail(taskId) {
    App.state.executionTaskDetail = { taskId: String(taskId), syncing: false };
    App.render();
    // V32.14.7 — auto-sync individual (sem cooldown) ao abrir detail
    setTimeout(() => {
      const task = window.ExecutionTaskStore?.byId(String(taskId));
      if (task && task.provider === 'clickup' && task.provider_task_id) {
        Actions.syncExecutionTask();  // silent path interno já existe
      }
    }, 200);
  },

  closeExecutionTaskDetail() {
    App.state.executionTaskDetail = null;
    App.render();
  },

  // Sincroniza status com provider externo (ClickUp/Trello/etc).
  // Reusa ExecutionSyncEngine.syncTask que já existe (V16.3).
  async syncExecutionTask() {
    const detail = App.state.executionTaskDetail;
    if (!detail?.taskId) return;
    const task = ExecutionTaskStore.byId(detail.taskId);
    if (!task) return Utils.toast('Task não encontrada localmente.');
    App.state.executionTaskDetail = { ...detail, syncing: true };
    App.render();
    try {
      const result = await ExecutionSyncEngine.syncTask(task);
      if (result.ok) {
        Utils.toast('✓ Status sincronizado com o provider.');
      } else {
        Utils.toast(`Sync falhou: ${result.message || 'erro desconhecido'}`);
      }
    } catch (err) {
      Utils.toast(`Erro: ${err?.message || err}`);
    } finally {
      App.state.executionTaskDetail = { ...App.state.executionTaskDetail, syncing: false };
      App.save(); App.render();
    }
  },

  // Marca task como concluída sem chamar o provider (fallback manual).
  markExecutionTaskComplete() {
    const detail = App.state.executionTaskDetail;
    if (!detail?.taskId) return;
    if (!confirm('Marcar esta task como concluída? (não atualiza o provider externo)')) return;
    ExecutionTaskStore.update(detail.taskId, {
      status: 'completed',
      completed_at: new Date().toISOString()
    });
    App.save(); App.render();
    Utils.toast('✓ Task marcada como concluída.');
  },

  // Remove task local (não apaga no provider).
  deleteExecutionTask() {
    const detail = App.state.executionTaskDetail;
    if (!detail?.taskId) return;
    const task = ExecutionTaskStore.byId(detail.taskId);
    if (!task) return;
    if (!confirm(`Apagar a task "${task.title}" desta ação? (não apaga no provider)`)) return;
    ExecutionTaskStore.remove(detail.taskId);
    App.state.executionTaskDetail = null;
    App.save(); App.render();
    Utils.toast('Task removida.');
  },

  // V28.3.1 — Fecha o popup didático do passe do bastão (estratégia → tático).
  // Se `advance=true`, navega pra etapa "As Ações"; caso contrário, só fecha.
  dismissStrategicHandoffPopup(advance) {
    App.state.strategicHandoffPopup = false;
    if (advance) {
      App.state.strategicMapZoom = 'operations';
    }
    App.save(); App.render();
  },

  // V28.3.0 — Ativa uma ação do catálogo na frente selecionada.
  // V28.4.1 — Se a campanha estratégica do produto ainda não foi nomeada,
  // abre prompt bloqueante e guarda a ativação como pendente.
  activateStrategicCatalogAction(areaId, templateId) {
    const productId = App.state.strategicMapProductId;
    if (!productId || !window.StrategicMapEngine) return;
    const already = StrategicMapEngine.getActivatedCatalogActionIds(productId, areaId);
    if (already.has(templateId)) return Utils.toast('Essa ação já está ativa.');
    const result = StrategicMapEngine.activateCatalogAction(productId, areaId, templateId);
    if (result?.needsCampaign) {
      // Abre prompt e guarda a ativação como pendente.
      App.state.strategicCampaignPrompt = { productId: Number(productId), pending: { areaId, templateId } };
      App.render();
      return;
    }
    if (result?.error || !result?.action) return Utils.toast('Não consegui ativar essa ação.');
    const action = result.action;
    App.save(); App.render();
    const linkedKrs = (StrategicMapEngine.getObjectiveByArea(productId, areaId)?.okrs || []).filter(k => (k.connectedActionIds || []).map(Number).includes(Number(action.id))).length;
    Utils.toast(linkedKrs ? `Ação ativada e vinculada a ${linkedKrs} número(s).` : 'Ação ativada. Preencha dono e cadência.');
  },

  // V28.4.1 — Atualiza o draft do prompt de campanha (input do nome).
  updateStrategicCampaignDraft(field, value) {
    const current = App.state.strategicCampaignPrompt || {};
    App.state.strategicCampaignPrompt = { ...current, [field]: value };
  },

  // V28.4.1 — Confirma a campanha estratégica e roda a ativação pendente.
  // mode: 'new' (cria com nome) ou 'existing' (vincula a campanha existente).
  confirmStrategicCampaign(mode) {
    const prompt = App.state.strategicCampaignPrompt;
    if (!prompt) return;
    const { productId, pending } = prompt;
    if (!productId) return;
    let campaign;
    if (mode === 'existing') {
      const id = Number(prompt.existingCampaignId);
      if (!id) return Utils.toast('Escolha uma campanha existente.');
      campaign = StrategicMapEngine.setStrategicCampaign(productId, null, id);
    } else {
      const name = String(prompt.newName || '').trim();
      if (!name) return Utils.toast('Dê um nome à campanha estratégica.');
      campaign = StrategicMapEngine.setStrategicCampaign(productId, name, null);
    }
    if (!campaign) return Utils.toast('Não consegui criar/vincular a campanha.');
    App.state.strategicCampaignPrompt = null;
    // Roda a ativação que estava pendente.
    if (pending) {
      const result = StrategicMapEngine.activateCatalogAction(productId, pending.areaId, pending.templateId);
      if (result?.action) {
        const linkedKrs = (StrategicMapEngine.getObjectiveByArea(productId, pending.areaId)?.okrs || []).filter(k => (k.connectedActionIds || []).map(Number).includes(Number(result.action.id))).length;
        Utils.toast(`Campanha "${campaign.name}" definida e ação ativada${linkedKrs ? ` (vinculada a ${linkedKrs} número(s))` : ''}.`);
      } else {
        Utils.toast(`Campanha "${campaign.name}" definida.`);
      }
    } else {
      Utils.toast(`Campanha "${campaign.name}" definida.`);
    }
    App.save(); App.render();
  },

  // V28.4.1 — Cancela o prompt sem definir campanha (ativação pendente é descartada).
  dismissStrategicCampaignPrompt() {
    App.state.strategicCampaignPrompt = null;
    App.render();
  },

  // V29.0.0 — Ativa Mapa pra uma campanha como BRANCH (compartilha visão do produto).
  // Cada campanha vira uma branch independente em strategicCampaignMaps.
  // Não troca mais o strategicCampaignId global — cada branch é autônoma.
  // Se for a 1ª branch do produto, vira a default (strategicCampaignId).
  activateStrategicMapForCampaign(campaignId) {
    const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(campaignId));
    if (!campaign) return Utils.toast('Campanha não encontrada.');
    const productId = campaign.productId;
    if (!productId) return Utils.toast('Esta campanha não tem produto vinculado.');
    // V29.0.2 — Não marca mais isStrategicHost (deprecado): visual vem do branchMap
    // via getCampaignStrategicStatus. Marcar quebrava a migração legacy.
    if (window.StrategicMapEngine) {
      StrategicMapEngine.ensureBranchMap(Number(campaignId), Number(productId));
      StrategicMapEngine.ensureComercialAreas(productId, Number(campaignId));
      // Se era a 1ª branch, vira a default do produto.
      const map = StrategicMapEngine.getForProduct(productId);
      if (!map?.strategicCampaignId) {
        StrategicMapEngine.save(productId, { strategicCampaignId: Number(campaignId) });
      }
    }
    Utils.toast(`Mapa da Receita ativado em "${campaign.name}". Branch criada — preencha os números desta campanha.`);
    Actions.openStrategicMapForCampaign(Number(campaignId));
  },

  // V29.0.0 — Abre Mapa em vista CAMPANHA (5 etapas da branch).
  openStrategicMapForCampaign(campaignId) {
    const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(campaignId));
    if (!campaign) return Utils.toast('Campanha não encontrada.');
    App.state.strategicMapProductId = Number(campaign.productId);
    App.state.strategicMapCampaignId = Number(campaignId);   // V29 — vista campanha
    App.state.strategicMapMode = 'campaign';                  // V29
    App.state.showStrategicMap = true;
    App.state.strategicMapZoom = 'campaign'; // V29.1.0 — Gestor abre na etapa Campanha (onde pluga KRs)
    // V31.2.16 — Quando o Mapa é aberto VINDO de uma campanha (card de campanha,
    // Djow, action, etc.), pula o welcome — só aparece pelo caminho 'Mapa da
    // Receita' do menu Produtos ou 'Criar Produto com Mapa'.
    App.state.strategicSkipOnboarding = true;
    App.state.strategicObjectiveDraft = null;
    App.state.strategicOkrDraft = null;
    App.state.strategicActiveArea = null;
    App.state.strategicCampaignPrompt = null;
    if (window.StrategicMapEngine) {
      StrategicMapEngine.ensure(Number(campaign.productId));
      StrategicMapEngine.ensureBranchMap(Number(campaignId), Number(campaign.productId));
      StrategicMapEngine.ensureComercialAreas(Number(campaign.productId), Number(campaignId));
    }
    // V36.9.0 — Abre na etapa 4 (campaign), não vision. Tutorial mode da etapa 1
    // só importa se cliente voltar pra ela e estiver vazia.
    App.state.strategicVisionEditDraft = null;
    App.state.strategicVisionInTutorial = false;
    App.save(); App.render();
  },

  // V31.2.41 — Modal info "RD + LeadJourney" (accordion das 3 conexões).
  openRdInfoModal() {
    App.state.rdInfoModal = { open: true, openSection: null };
    App.render();
  },
  closeRdInfoModal() {
    App.state.rdInfoModal = null;
    App.render();
  },
  toggleRdInfoSection(section) {
    if (!App.state.rdInfoModal) return;
    const current = App.state.rdInfoModal.openSection;
    App.state.rdInfoModal = { ...App.state.rdInfoModal, openSection: current === section ? null : section };
    App.render();
  },

  // V31.2.41 — Testa as 3 conexões RD em sequência e atualiza rdConnectionStatus.
  // Status por conexão:
  //   - 'missing': sem token configurado
  //   - 'connected': RD respondeu 2xx
  //   - 'error': RD respondeu 4xx/5xx OU falha de rede
  async testAllRdConnections() {
    if (App.state.rdTestingConnections) return;
    App.state.rdTestingConnections = true;
    App.render();
    const rdCfg = App.state.integrations?.rd || {};
    const jwt = localStorage.getItem('lj_jwt');
    const now = new Date().toISOString();

    const tests = [
      {
        key: 'crm_pat',
        hasToken: Boolean(rdCfg.crmPersonalToken),
        method: 'GET', path: '/deal_pipelines', legacy: true, useQueryToken: true
      },
      {
        // V31.2.56 — Era /platform/account_info que retornava 404 (RD mudou
        // ou o path nunca existiu). Troca pra /integrations/webhooks que é
        // multi-produto (qualquer OAuth válido passa). Mesmo padrão do
        // crm_oauth (V31.2.55).
        key: 'marketing_oauth',
        hasToken: Boolean(rdCfg.accessToken),
        method: 'GET', path: '/integrations/webhooks', legacy: false, useQueryToken: false
      },
      {
        // V31.2.55 — Era /crm/v2/deals?limit=1 mas alguns apps OAuth só tem
        // scope de cadastrar webhook (não de ler deals). Testando /integrations/webhooks
        // (multi-produto, mesmo endpoint que cadastra webhook), bate exatamente
        // a permissão que essa feature usa. Se GET aqui funciona, o OAuth é OK
        // pra propósito de receber eventos em tempo real.
        key: 'crm_oauth',
        hasToken: Boolean(rdCfg.crmOauth?.accessToken),
        method: 'GET', path: '/integrations/webhooks', legacy: false, useQueryToken: false, useCrmOauthV2: true
      }
    ];

    const results = {};
    for (const t of tests) {
      if (!t.hasToken) {
        results[t.key] = { status: 'missing', message: 'Não conectado — clique nos passos abaixo pra configurar', testedAt: now };
        continue;
      }
      try {
        const token = t.key === 'crm_pat' ? rdCfg.crmPersonalToken
          : t.key === 'marketing_oauth' ? rdCfg.accessToken
          : rdCfg.crmOauth?.accessToken;
        const r = await fetch('/api/rd-proxy', {
          method: 'POST',
          headers: jwt ? { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` } : { 'Content-Type': 'application/json' },
          body: JSON.stringify({ method: t.method, path: t.path, token, token_source: t.key, legacy: t.legacy, useQueryToken: t.useQueryToken })
        });
        if (r.ok) {
          results[t.key] = { status: 'connected', message: 'RD respondeu OK', testedAt: now };
        } else {
          const body = await r.json().catch(() => ({}));
          const msg = body?.error || body?.message || `HTTP ${r.status}`;
          results[t.key] = { status: 'error', message: `${r.status}: ${msg}`, testedAt: now };
        }
      } catch (err) {
        results[t.key] = { status: 'error', message: `Rede: ${err.message}`, testedAt: now };
      }
    }

    App.state.rdConnectionStatus = results;
    App.state.rdTestingConnections = false;
    App.save(); App.render();
    const connected = Object.values(results).filter(r => r.status === 'connected').length;
    Utils.toast(`Teste finalizado: ${connected}/3 conectada(s).`);
  },

  // V31.2.36 — RD STATION/CRM CREDENTIALS WRITE-THROUGH
  // Strategy: tokens continuam vivendo em App.state.integrations.rd (mesma
  // API de leitura interna), mas TODA mutação dispara save criptografado no
  // backend pra DB sobreviver a perda de state. No boot, hidrata do DB pra
  // recuperar conexões caso state tenha sido limpo.

  async loadRdCredentialsFromDb() {
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/rd-credentials', { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      if (!data.ok) return;
      const creds = data.credentials || {};
      // V31.2.38 — Migration one-shot: se DB está vazio mas App.state tem tokens
      // de versões antigas (pré V31.2.36), backfill o DB com o que tem em state.
      // Isso cobre o gap onde write-through só dispara em mutação.
      const hasDbAny = Boolean(creds.crm_pat?.access_token || creds.marketing_oauth?.access_token || creds.crm_oauth?.access_token);
      if (!hasDbAny) {
        const rdState = App.state.integrations?.rd || {};
        const stateHasAny = Boolean(rdState.crmPersonalToken || rdState.accessToken || rdState.crmOauth?.accessToken);
        if (stateHasAny) {
          console.log('[rd] DB vazio + state com tokens → backfill DB (one-shot migration).');
          this._persistRdToDb('crm_pat');
          this._persistRdToDb('marketing_oauth');
          this._persistRdToDb('crm_oauth');
          // Não chama loadRdCredentialsFromDb recursivo. Próximo boot vai ler do DB normalmente.
          return;
        }
      }
      const rd = App.state.integrations?.rd || (window.RDConfig ? RDConfig.defaultConfig() : {});
      let changed = false;
      // CRM PAT (estático)
      if (creds.crm_pat?.access_token && !rd.crmPersonalToken) {
        rd.crmPersonalToken = creds.crm_pat.access_token;
        if (creds.crm_pat.status) rd.crmTestStatus = creds.crm_pat.status;
        changed = true;
      }
      // Marketing OAuth
      const mkt = creds.marketing_oauth;
      if (mkt && (!rd.accessToken || !rd.refreshToken)) {
        if (mkt.access_token) rd.accessToken = mkt.access_token;
        if (mkt.refresh_token) rd.refreshToken = mkt.refresh_token;
        if (mkt.client_id) rd.clientId = mkt.client_id;
        if (mkt.client_secret) rd.clientSecret = mkt.client_secret;
        if (mkt.redirect_uri) rd.redirectUri = mkt.redirect_uri;
        if (mkt.expires_at) rd.expiresAt = mkt.expires_at;
        if (mkt.account_name) rd.accountName = mkt.account_name;
        if (mkt.workspace_id) rd.workspaceId = mkt.workspace_id;
        if (mkt.status) rd.status = mkt.status;
        changed = true;
      }
      // CRM OAuth v2 (nested em rd.crmOauth)
      const crmO = creds.crm_oauth;
      if (crmO && (!rd.crmOauth?.accessToken || !rd.crmOauth?.refreshToken)) {
        rd.crmOauth = rd.crmOauth || {};
        if (crmO.access_token) rd.crmOauth.accessToken = crmO.access_token;
        if (crmO.refresh_token) rd.crmOauth.refreshToken = crmO.refresh_token;
        if (crmO.client_id) rd.crmOauth.clientId = crmO.client_id;
        if (crmO.client_secret) rd.crmOauth.clientSecret = crmO.client_secret;
        if (crmO.redirect_uri) rd.crmOauth.redirectUri = crmO.redirect_uri;
        if (crmO.expires_at) rd.crmOauth.expiresAt = crmO.expires_at;
        if (crmO.status) rd.crmOauth.status = crmO.status;
        changed = true;
      }
      if (changed) {
        App.state.integrations = { ...(App.state.integrations || {}), rd };
        App.save(); App.render();
      }
    } catch (err) { console.warn('[rd] loadCredentialsFromDb erro:', err); }
  },

  // Salva 1 token type no DB criptografado. Não-bloqueante: erro de rede só
  // loga warn. Frontend continua usando App.state normal — DB é shadow copy.
  async _saveRdCredentialToDb(tokenType, fields) {
    try {
      const token = localStorage.getItem('lj_jwt');
      const body = { token_type: tokenType, ...fields };
      const r = await fetch('/api/rd-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        console.warn(`[rd] saveCredential ${tokenType} falhou: ${data.message || r.status}`);
      }
    } catch (err) { console.warn(`[rd] saveCredential ${tokenType} erro:`, err); }
  },

  // Dispara write-through pros 3 token types lendo do estado atual.
  // Chamado sempre que alguma action muta os tokens.
  async _persistRdToDb(tokenType) {
    const rd = App.state.integrations?.rd;
    if (!rd) return;
    if (tokenType === 'crm_pat' || !tokenType) {
      if (rd.crmPersonalToken) {
        this._saveRdCredentialToDb('crm_pat', {
          access_token: rd.crmPersonalToken,
          status: rd.crmTestStatus || null
        });
      }
    }
    if (tokenType === 'marketing_oauth' || !tokenType) {
      if (rd.accessToken || rd.refreshToken || rd.clientId) {
        this._saveRdCredentialToDb('marketing_oauth', {
          access_token: rd.accessToken || null,
          refresh_token: rd.refreshToken || null,
          client_id: rd.clientId || null,
          client_secret: rd.clientSecret || null,
          redirect_uri: rd.redirectUri || null,
          expires_at: rd.expiresAt || null,
          account_name: rd.accountName || null,
          workspace_id: rd.workspaceId || null,
          status: rd.status || null
        });
      }
    }
    if (tokenType === 'crm_oauth' || !tokenType) {
      const co = rd.crmOauth;
      if (co && (co.accessToken || co.refreshToken || co.clientId)) {
        this._saveRdCredentialToDb('crm_oauth', {
          access_token: co.accessToken || null,
          refresh_token: co.refreshToken || null,
          client_id: co.clientId || null,
          client_secret: co.clientSecret || null,
          redirect_uri: co.redirectUri || null,
          expires_at: co.expiresAt || null,
          status: co.status || null
        });
      }
    }
  },

  async _deleteRdCredentialFromDb(tokenType) {
    try {
      const token = localStorage.getItem('lj_jwt');
      const qs = tokenType ? `?token_type=${encodeURIComponent(tokenType)}` : '';
      await fetch('/api/rd-credentials' + qs, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (err) { console.warn(`[rd] deleteCredential ${tokenType || 'all'} erro:`, err); }
  },

  // V30.0.0 — INTEGRAÇÃO CLICKUP. Actions pra Settings UI + criar task via modal.

  // Carrega status ClickUp do backend.
  // V32.1.3 — agora também hidrata defaultListId/Name/SpaceId pra UI mostrar
  // qual list o LJ vai usar (substitui auto-discovery).
  async loadClickupStatus() {
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/clickup-config', { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      if (data.ok) {
        // V32.6.1 — detecta transição "acabou de conectar sem raiz" pra
        // abrir o wizard automaticamente (cliente não fica perdido procurando).
        const wasConnected = !!(App.state.clickupStatus && App.state.clickupStatus.connected);
        const nowConnected = !!data.connected;
        const hasRoot = !!(data.rootId || data.ljSpaceId);
        const justConnected = nowConnected && !wasConnected && !hasRoot;
        App.state.clickupStatus = {
          configured: data.configured,
          connected: data.connected,
          workspaceName: data.workspaceName,
          encryptionReady: data.encryptionReady,
          // V32.5.6 — tokenType ('oauth' | 'pat' | null) diferencia método na UI
          tokenType: data.tokenType || null,
          defaultListId: data.defaultListId || null,
          defaultListName: data.defaultListName || null,
          defaultSpaceId: data.defaultSpaceId || null,
          // V32.1.4-1.6 — settings expandidas
          ljTagName: data.ljTagName || null,
          taskPrefix: data.taskPrefix || null,
          statusMap: data.statusMap || null,
          writeEnabled: data.writeEnabled !== false,
          // V32.2.0 — hierarquia espelhada (back-compat)
          ljSpaceId: data.ljSpaceId || null,
          mirrorEnabled: data.mirrorEnabled !== false,
          // V32.6.0 — raiz flexível
          rootId: data.rootId || null,
          rootKind: data.rootKind || null,
          rootName: data.rootName || null
        };
        App.save(); App.render();
        // V31.2.33 — Quando conecta, pre-fetch metadata pra modal de criar task abrir instantâneo.
        if (data.connected && !App.state.clickupMeta?.loaded) {
          this.loadClickupMetadata();
        }
        // V32.6.1 — Empurra o cliente direto pro setup wizard logo após conectar.
        // Evita o usuário ficar perdido procurando "onde escolher a list?".
        if (justConnected && !App.state.clickupSpaceWizard?.open) {
          setTimeout(() => Actions.openClickupSpaceWizard(), 400);
        }
      }
    } catch (err) { console.warn('[clickup] loadStatus erro:', err); }
  },

  // V32.1.3 — Picker de list ClickUp (Geraldo safe integration).
  openClickupListPicker() {
    App.state.showClickupListPicker = true;
    App.save(); App.render();
    if (!App.state._clickupTreeCache) {
      this.loadClickupTree();
    }
  },

  closeClickupListPicker() {
    App.state.showClickupListPicker = false;
    App.save(); App.render();
  },

  async loadClickupTree() {
    const token = localStorage.getItem('lj_jwt');
    if (!token) return;
    App.state.clickupTreeLoading = true;
    App.render();
    try {
      const r = await fetch('/api/clickup-tree', { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      if (data.ok) {
        App.state._clickupTreeCache = data;
      } else {
        Utils.toast(`Falha ao carregar árvore: ${data.message}`);
      }
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    } finally {
      App.state.clickupTreeLoading = false;
      App.render();
    }
  },

  // V32.1.4 — Drafts e save de marcação automática (tag + prefix).
  updateClickupMarkerDraft(field, value) {
    App.state.clickupMarkerDrafts = {
      ...(App.state.clickupMarkerDrafts || { ljTagName: '', taskPrefix: '' }),
      [field]: String(value || '')
    };
  },

  async saveClickupMarkers() {
    const token = localStorage.getItem('lj_jwt');
    const drafts = App.state.clickupMarkerDrafts || {};
    const status = App.state.clickupStatus || {};
    // Só envia campos que mudaram — UI usa current value como placeholder,
    // então draft vazio significa "manter atual". Pra LIMPAR o user manda 'null'
    // via botão dedicado (não implementado nesta UI inicial).
    const body = {};
    if (drafts.ljTagName && drafts.ljTagName !== status.ljTagName) {
      body.lj_tag_name = drafts.ljTagName;
    }
    if (drafts.taskPrefix !== '' && drafts.taskPrefix !== status.taskPrefix) {
      body.task_prefix = drafts.taskPrefix;
    }
    if (!Object.keys(body).length) {
      return Utils.toast('Nenhuma mudança pra salvar.');
    }
    try {
      const r = await fetch('/api/clickup-update-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      const data = await r.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      Utils.toast('✓ Marcação ClickUp atualizada.');
      App.state.clickupMarkerDrafts = { ljTagName: '', taskPrefix: '' };
      await this.loadClickupStatus();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V32.5.9 → V32.6.0 — Setup Wizard ClickUp.
  // Cliente navega tree do workspace (Space → Folder → List) e escolhe um nó
  // como raiz LJ. Tipo do nó define o modo de espelhamento:
  //   - Space  → cascado completo (Folder=Produto, List=Campanha, ...)
  //   - Folder → cascado parcial (List=Campanha, ...). Produto vira só metadado LJ.
  //   - List   → achatado: tarefas viram Tasks na list direto.
  // Princípio (workspace-sovereignty): LJ nunca cria nada sem cliente mandar.

  openClickupSpaceWizard() {
    App.state.clickupSpaceWizard = {
      open: true,
      loading: true,
      tree: [],
      workspaceName: null,
      currentRootId: null,
      currentRootKind: null,
      mode: 'select',
      expandedSpaces: [],
      expandedFolders: [],
      selectedNode: null,
      newName: 'LeadJourney',
      submitting: false,
      error: null
    };
    App.save(); App.render();
    this.loadClickupSpaceWizard();
  },

  closeClickupSpaceWizard() {
    App.state.clickupSpaceWizard = {
      ...App.state.clickupSpaceWizard,
      open: false,
      submitting: false,
      error: null
    };
    App.save(); App.render();
  },

  async loadClickupSpaceWizard() {
    const w = App.state.clickupSpaceWizard;
    w.loading = true;
    w.error = null;
    App.save(); App.render();
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/clickup-tree', { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      if (!data.ok) {
        w.loading = false;
        w.error = data.message || 'Falha ao listar árvore do ClickUp.';
        App.save(); App.render();
        return;
      }
      w.loading = false;
      w.tree = Array.isArray(data.spaces) ? data.spaces : [];
      w.workspaceName = data.workspaceName || null;
      // Pega raiz atual do clickupStatus (loadClickupStatus já rodou em paralelo).
      const st = App.state.clickupStatus || {};
      w.currentRootId = st.rootId || st.ljSpaceId || null;
      w.currentRootKind = st.rootKind || (st.ljSpaceId ? 'space' : null);
      // Pré-seleciona o nó atual + expande os ancestrais pra usuário ver onde tá.
      if (w.currentRootId && w.currentRootKind) {
        const found = Actions._findNodeInTree(w.tree, w.currentRootId, w.currentRootKind);
        if (found) {
          w.selectedNode = { id: found.node.id, kind: w.currentRootKind, name: found.node.name };
          if (found.spaceId && !w.expandedSpaces.includes(found.spaceId)) w.expandedSpaces.push(found.spaceId);
          if (found.folderId && !w.expandedFolders.includes(found.folderId)) w.expandedFolders.push(found.folderId);
        }
      }
      App.save(); App.render();
    } catch (err) {
      w.loading = false;
      w.error = err.message;
      App.save(); App.render();
    }
  },

  // Helper interno (não é Action UI-callable): localiza nó na tree por kind+id.
  // Retorna { node, spaceId, folderId? } se achar, null caso contrário.
  _findNodeInTree(tree, targetId, targetKind) {
    if (!Array.isArray(tree)) return null;
    for (const space of tree) {
      if (targetKind === 'space' && space.id === targetId) {
        return { node: space, spaceId: null, folderId: null };
      }
      if (targetKind === 'list') {
        const fl = (space.folderlessLists || []).find(l => l.id === targetId);
        if (fl) return { node: fl, spaceId: space.id, folderId: null };
        for (const folder of (space.folders || [])) {
          const li = (folder.lists || []).find(l => l.id === targetId);
          if (li) return { node: li, spaceId: space.id, folderId: folder.id };
        }
      }
      if (targetKind === 'folder') {
        const folder = (space.folders || []).find(f => f.id === targetId);
        if (folder) return { node: folder, spaceId: space.id, folderId: null };
      }
    }
    return null;
  },

  setClickupSpaceWizardMode(mode) {
    App.state.clickupSpaceWizard.mode = (mode === 'create') ? 'create' : 'select';
    App.save(); App.render();
  },

  toggleClickupWizardSpace(spaceId) {
    const w = App.state.clickupSpaceWizard;
    const id = String(spaceId);
    const idx = w.expandedSpaces.indexOf(id);
    if (idx >= 0) w.expandedSpaces.splice(idx, 1);
    else w.expandedSpaces.push(id);
    App.save(); App.render();
  },

  toggleClickupWizardFolder(folderId) {
    const w = App.state.clickupSpaceWizard;
    const id = String(folderId);
    const idx = w.expandedFolders.indexOf(id);
    if (idx >= 0) w.expandedFolders.splice(idx, 1);
    else w.expandedFolders.push(id);
    App.save(); App.render();
  },

  setClickupWizardSelectedNode(id, kind, name) {
    App.state.clickupSpaceWizard.selectedNode = {
      id: String(id || ''),
      kind: (kind === 'space' || kind === 'folder' || kind === 'list') ? kind : 'space',
      name: String(name || '')
    };
    App.save(); App.render();
  },

  setClickupSpaceWizardNewName(name) {
    App.state.clickupSpaceWizard.newName = String(name || '').slice(0, 64);
    App.save();
    // não chama render — evita perder foco do input
  },

  async confirmClickupSpaceWizard() {
    const w = App.state.clickupSpaceWizard;
    if (w.submitting) return;

    const body = {};
    if (w.mode === 'create') {
      const name = String(w.newName || '').trim();
      if (!name) {
        w.error = 'Dê um nome pro Space novo.';
        App.save(); App.render();
        return;
      }
      body.space_name = name;
    } else {
      if (!w.selectedNode || !w.selectedNode.id) {
        w.error = 'Selecione um nó da árvore (Space, Folder ou List) ou troque pra criar novo.';
        App.save(); App.render();
        return;
      }
      body.root_id = w.selectedNode.id;
      body.root_kind = w.selectedNode.kind;
    }

    w.submitting = true;
    w.error = null;
    App.save(); App.render();

    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/clickup-setup-space', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      const data = await r.json();
      if (!data.ok) {
        w.submitting = false;
        w.error = data.message || 'Falha ao configurar raiz.';
        App.save(); App.render();
        return;
      }
      Utils.toast(`✓ ${data.message}`);
      App.state.clickupSpaceWizard = {
        ...App.state.clickupSpaceWizard,
        open: false,
        submitting: false,
        error: null
      };
      App.save();
      await this.loadClickupStatus();
      await this.loadClickupMappings();
      App.render();
    } catch (err) {
      w.submitting = false;
      w.error = err.message;
      App.save(); App.render();
    }
  },

  // V32.2.5 (Geraldo A12) — Migra estrutura LJ pro ClickUp em lote.
  // Útil pra cliente que já tem produtos/campanhas/ações no LJ e quer pré-criar
  // toda a hierarquia no ClickUp dele de uma vez (sem esperar primeira task).
  async migrateClickupToMirror() {
    const products = App.state.products || [];
    if (!products.length) return Utils.toast('Sem produtos pra migrar.');
    if (!confirm(`Migrar ${products.length} produto(s) e toda hierarquia (campanhas + ações) pro Space LeadJourney no ClickUp?\n\nIsso cria folder/list/task pai pra cada entity. Operação demora 1-5min em árvores grandes.\n\nConfirma?`)) return;

    // Monta árvore enxuta (id + name) pro POST
    const campaigns = App.state.campaigns || [];
    const actions = App.state.actions || [];
    const tree = products.map(p => ({
      id: Number(p.id),
      name: String(p.name || `Produto ${p.id}`),
      campaigns: campaigns
        .filter(c => Number(c.productId) === Number(p.id))
        .map(c => ({
          id: Number(c.id),
          name: String(c.name || `Campanha ${c.id}`),
          actions: actions
            .filter(a => Number(a.campaignId) === Number(c.id))
            .map(a => ({ id: Number(a.id), name: String(a.name || `Ação ${a.id}`) }))
        }))
    }));

    const token = localStorage.getItem('lj_jwt');
    Utils.toast('Migrando... pode demorar.');
    try {
      const r = await fetch('/api/clickup-migrate-to-mirror', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ products: tree })
      });
      const data = await r.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      Utils.toast(`✓ ${data.message}`);
      if (data.errors?.length) {
        console.warn('[migrate-to-mirror] erros parciais:', data.errors);
      }
      await this.loadClickupMappings();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V32.2.3 (Geraldo A6) — Testa acessibilidade do Space LeadJourney sob demanda.
  async testClickupSpace() {
    const token = localStorage.getItem('lj_jwt');
    Utils.toast('Testando raiz LJ no ClickUp…');
    try {
      const r = await fetch('/api/clickup-test-space', { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      if (data.accessible) {
        Utils.toast(`✓ ${data.message}`);
      } else {
        Utils.toast(`⚠ ${data.message}`);
      }
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  async loadClickupMappings() {
    const token = localStorage.getItem('lj_jwt');
    if (!token) return;
    try {
      const r = await fetch('/api/clickup-mappings-list', { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      if (data.ok) {
        App.state._clickupMappingsCache = data;
        App.save(); App.render();
      }
    } catch (err) { console.warn('[clickup-mappings] load erro:', err); }
  },

  async toggleClickupMirror() {
    const status = App.state.clickupStatus || {};
    const next = !(status.mirrorEnabled !== false);
    const confirmMsg = next
      ? 'Reativar modo espelhado?\n\nLJ vai voltar a criar folder/list/task na hierarquia Produto>Campanha>Ação no ClickUp.'
      : '⚠ Desativar modo espelhado?\n\nNovas tasks vão pra default_list_id (modelo simples). Tasks já criadas na hierarquia ficam como estão.\n\nNão recomendado pra cliente em produção.';
    if (!confirm(confirmMsg)) return;
    const token = localStorage.getItem('lj_jwt');
    try {
      const r = await fetch('/api/clickup-update-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mirror_enabled: next })
      });
      // V32.2.0 — endpoint precisa aceitar mirror_enabled (vou adicionar)
      const data = await r.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      Utils.toast(next ? '✓ Modo espelhado REATIVADO.' : '✓ Modo espelhado DESATIVADO.');
      await this.loadClickupStatus();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V32.1.6 — Toggle modo escrita do ClickUp (read-only safety switch).
  async toggleClickupWriteMode() {
    const token = localStorage.getItem('lj_jwt');
    const status = App.state.clickupStatus || {};
    const next = !(status.writeEnabled !== false); // se atual=true, vira false; se false, vira true
    const confirmMsg = next
      ? 'Reativar modo de escrita do ClickUp?\n\nLJ voltará a criar/atualizar tasks no ClickUp do cliente.'
      : 'Ativar modo somente-leitura do ClickUp?\n\nLJ NÃO criará nem atualizará tasks até reativar. Útil pra teste/pausa.';
    if (!confirm(confirmMsg)) return;
    try {
      const r = await fetch('/api/clickup-update-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ write_enabled: next })
      });
      const data = await r.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      Utils.toast(next ? '✓ Modo escrita REATIVADO.' : '✓ Modo somente-leitura ATIVADO.');
      await this.loadClickupStatus();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V32.1.5 — Status mapping LJ → ClickUp.
  updateClickupStatusMapDraft(ljStatus, remoteStatus) {
    App.state.clickupStatusMapDraft = {
      ...(App.state.clickupStatusMapDraft || { pending: '', in_progress: '', completed: '' }),
      [ljStatus]: String(remoteStatus || '')
    };
    App.render();
  },

  async saveClickupStatusMap() {
    const token = localStorage.getItem('lj_jwt');
    const drafts = App.state.clickupStatusMapDraft || {};
    const current = App.state.clickupStatus?.statusMap || {};
    // Merge atual com drafts (só campos que mudaram). Mantém o que user não tocou.
    const merged = {
      pending: drafts.pending || current.pending || null,
      in_progress: drafts.in_progress || current.in_progress || null,
      completed: drafts.completed || current.completed || null
    };
    if (!merged.pending && !merged.in_progress && !merged.completed) {
      return Utils.toast('Mapeia pelo menos um status antes de salvar.');
    }
    try {
      const r = await fetch('/api/clickup-update-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status_map_json: merged })
      });
      const data = await r.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      Utils.toast('✓ Mapping de status atualizado.');
      App.state.clickupStatusMapDraft = { pending: '', in_progress: '', completed: '' };
      await this.loadClickupStatus();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  async clearClickupStatusMap() {
    if (!confirm('Remover mapping de status? Tasks novas vão usar o status default da list (ClickUp escolhe).')) return;
    const token = localStorage.getItem('lj_jwt');
    try {
      const r = await fetch('/api/clickup-update-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status_map_json: null })
      });
      const data = await r.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      Utils.toast('✓ Mapping removido.');
      await this.loadClickupStatus();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  async clearClickupMarker(field) {
    // field: 'lj_tag_name' ou 'task_prefix' — manda null pra LIMPAR no DB.
    if (!confirm(field === 'lj_tag_name'
      ? 'Remover tag automática? Tasks novas não vão mais ser marcadas (mais difícil de identificar o que veio do LJ).'
      : 'Remover prefixo do nome? Tasks novas não vão mais ter o prefixo.'
    )) return;
    const token = localStorage.getItem('lj_jwt');
    try {
      const r = await fetch('/api/clickup-update-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ [field]: null })
      });
      const data = await r.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      Utils.toast('✓ Removido.');
      await this.loadClickupStatus();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  async selectClickupList(listId, spaceId, listName) {
    const token = localStorage.getItem('lj_jwt');
    try {
      const r = await fetch('/api/clickup-set-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ list_id: listId, space_id: spaceId, list_name: listName })
      });
      const data = await r.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      Utils.toast(`✓ ${data.message}`);
      App.state.showClickupListPicker = false;
      // Re-hidrata status pra mostrar lista nova
      await this.loadClickupStatus();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V31.2.33 — Pre-fetch members/statuses/tags/custom_fields do ClickUp.
  // Chamado após login + connected, ou ao abrir modal de criar task se cache vazio.
  async loadClickupMetadata() {
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/clickup-metadata', { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      if (data.ok) {
        App.state.clickupMeta = {
          loaded: true,
          loadedAt: Date.now(),
          workspaceId: data.workspaceId,
          listId: data.listId,
          spaceId: data.spaceId,
          members: data.members || [],
          statuses: data.statuses || [],
          tags: data.tags || [],
          customFields: data.customFields || []
        };
        App.save();
        // Re-render se modal de task já tá aberto (pra preencher os dropdowns).
        if (App.state.taskCreationModal?.open) App.render();
      } else {
        console.warn('[clickup] loadMetadata falhou:', data.message);
      }
    } catch (err) { console.warn('[clickup] loadMetadata erro:', err); }
  },

  updateClickupConfigDraft(field, value) {
    App.state.clickupConfigDraft = { ...(App.state.clickupConfigDraft || {}), [field]: value };
  },

  async saveClickupConfig() {
    const draft = App.state.clickupConfigDraft || {};
    if (!draft.client_id || !draft.client_secret) return Utils.toast('Preencha Client ID e Client Secret.');
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/clickup-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ client_id: draft.client_id, client_secret: draft.client_secret })
      });
      const data = await r.json();
      if (data.ok) {
        Utils.toast('✓ Credenciais salvas. Agora clique em Conectar.');
        App.state.clickupConfigDraft = { client_id: '', client_secret: '' };
        await Actions.loadClickupStatus();
      } else {
        Utils.toast(`Erro: ${data.message}`);
      }
    } catch (err) { Utils.toast(`Erro de rede: ${err.message}`); }
  },

  // V31.2.33 — TASK CREATION MODAL: ponte ação → execução ClickUp.
  // Substitui o clique direto do antigo "Criar tarefa via Djow" no Mapa.
  // 3 modos: form Normal (obrigatório), expand Avançado (opcional), botão Djow (auto).
  // V32.14.6 — Aceita editingTaskId opcional: se passado, pré-popula draft
  // com infos da task existente (modo edit). Sem ele, comportamento original
  // (criar nova task).
  openTaskCreationModal(actionId, editingTaskId) {
    const action = (App.state.actions || []).find(a => Number(a.id) === Number(actionId));
    if (!action) return Utils.toast('Ação não encontrada.');
    // Pre-fetch metadata se ainda não tem
    if (!App.state.clickupMeta?.loaded) this.loadClickupMetadata();

    // Modo edit: lê task existente
    const editingTask = editingTaskId && window.ExecutionTaskStore
      ? ExecutionTaskStore.byId(String(editingTaskId))
      : null;

    const draftDefaults = {
      name: action.name || '',
      description: action.strategicDescription && action.strategicDescription !== 'Ação custom criada via engine'
        ? action.strategicDescription
        : `Ação operacional: ${action.name}. Canal: ${action.channel || '—'}.`,
      assignees: [],
      priority: '',
      status: '',
      due_date: '',
      due_date_time: false,
      start_date: '',
      start_date_time: false,
      tags: [],
      time_estimate_hours: '',
      points: '',
      parent: '',
      links_to: '',
      markdown_content: '',
      custom_fields: {}
    };

    // Sobrepõe com infos da task existente quando em modo edit
    const draft = editingTask ? {
      ...draftDefaults,
      name: editingTask.title || draftDefaults.name,
      description: editingTask.description || draftDefaults.description,
      assignees: Array.isArray(editingTask.assignees) ? editingTask.assignees : [],
      due_date: editingTask.due_date || '',
      start_date: editingTask.start_date || '',
      custom_fields: editingTask.custom_fields || {}
    } : draftDefaults;

    App.state.taskCreationModal = {
      open: true,
      actionId: Number(actionId),
      editingTaskId: editingTask ? String(editingTask.task_id) : null,
      showAdvanced: false,
      djowLoading: false,
      submitting: false,
      draft
    };
    App.render();
  },

  closeTaskCreationModal() {
    App.state.taskCreationModal = null;
    App.render();
  },

  updateTaskDraft(field, value) {
    if (!App.state.taskCreationModal) return;
    App.state.taskCreationModal = {
      ...App.state.taskCreationModal,
      draft: { ...App.state.taskCreationModal.draft, [field]: value }
    };
  },

  toggleTaskAssignee(memberId) {
    if (!App.state.taskCreationModal) return;
    const list = App.state.taskCreationModal.draft.assignees || [];
    const id = Number(memberId);
    const next = list.includes(id) ? list.filter(x => x !== id) : [...list, id];
    this.updateTaskDraft('assignees', next);
    App.render();
  },

  toggleTaskTag(tagName) {
    if (!App.state.taskCreationModal) return;
    const list = App.state.taskCreationModal.draft.tags || [];
    const next = list.includes(tagName) ? list.filter(x => x !== tagName) : [...list, tagName];
    this.updateTaskDraft('tags', next);
    App.render();
  },

  toggleTaskAdvanced() {
    if (!App.state.taskCreationModal) return;
    App.state.taskCreationModal = {
      ...App.state.taskCreationModal,
      showAdvanced: !App.state.taskCreationModal.showAdvanced
    };
    App.render();
  },

  // V31.2.34 — Abre modal de chat Djow acima do taskCreationModal.
  // User digita o que precisa, Djow propõe drafts (tool propose_task_draft),
  // user clica "Aplicar" pra copiar pra modal pai.
  openDjowTaskChat() {
    if (!App.state.taskCreationModal?.open) return;
    App.state.djowTaskChat = {
      open: true,
      actionId: App.state.taskCreationModal.actionId,
      messages: [],
      input: '',
      loading: false
    };
    App.render();
  },

  closeDjowTaskChat() {
    App.state.djowTaskChat = null;
    App.render();
  },

  updateDjowChatInput(value) {
    if (!App.state.djowTaskChat) return;
    App.state.djowTaskChat = { ...App.state.djowTaskChat, input: String(value || '') };
  },

  async sendDjowTaskMessage() {
    const c = App.state.djowTaskChat;
    if (!c || c.loading) return;
    const text = String(c.input || '').trim();
    if (!text) return;
    const userMsg = { role: 'user', content: text };
    const newMessages = [...(c.messages || []), userMsg];
    App.state.djowTaskChat = { ...c, messages: newMessages, input: '', loading: true };
    App.render();
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/djow-task-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          actionId: c.actionId,
          messages: newMessages.map(m => ({ role: m.role, content: m.content }))
        })
      });
      const data = await r.json();
      if (data.ok) {
        const assistantMsg = { role: 'assistant', content: data.reply || '...', _draft: data.draft || null };
        App.state.djowTaskChat = {
          ...App.state.djowTaskChat,
          messages: [...newMessages, assistantMsg],
          loading: false
        };
        App.render();
      } else {
        App.state.djowTaskChat = {
          ...App.state.djowTaskChat,
          messages: [...newMessages, { role: 'assistant', content: `Erro: ${data.message || 'falha desconhecida'}` }],
          loading: false
        };
        App.render();
      }
    } catch (err) {
      App.state.djowTaskChat = {
        ...App.state.djowTaskChat,
        messages: [...newMessages, { role: 'assistant', content: `Erro de rede: ${err.message}` }],
        loading: false
      };
      App.render();
    }
  },

  // Aplica o draft proposto pelo Djow no taskCreationModal. Sobrescreve só
  // os campos preenchidos pelo Djow — não toca o que o user já tinha digitado
  // se o draft veio sem aquele campo.
  applyDjowDraftToTask(draft) {
    if (!App.state.taskCreationModal?.open || !draft) return;
    const cur = App.state.taskCreationModal.draft;
    const next = { ...cur };
    if (draft.name) next.name = draft.name;
    if (draft.description) next.description = draft.description;
    if (draft.priority) next.priority = draft.priority;
    if (draft.status) next.status = draft.status;
    if (draft.due_date) { next.due_date = draft.due_date; next.due_date_time = String(draft.due_date).includes('T'); }
    if (draft.start_date) { next.start_date = draft.start_date; next.start_date_time = String(draft.start_date).includes('T'); }
    if (Array.isArray(draft.tags) && draft.tags.length) next.tags = draft.tags;
    if (Number.isFinite(draft.time_estimate_hours)) next.time_estimate_hours = String(draft.time_estimate_hours);
    if (Number.isFinite(draft.points)) next.points = String(draft.points);
    // Assignees: tenta matchar hints com members do workspace
    if (Array.isArray(draft.assignees_hints) && draft.assignees_hints.length && App.state.clickupMeta?.members?.length) {
      const members = App.state.clickupMeta.members;
      const matched = [];
      draft.assignees_hints.forEach(hint => {
        const h = String(hint || '').toLowerCase().trim();
        if (!h) return;
        const found = members.find(m =>
          String(m.username || '').toLowerCase().includes(h)
          || String(m.email || '').toLowerCase().includes(h)
        );
        if (found && !matched.includes(found.id)) matched.push(found.id);
      });
      if (matched.length) next.assignees = matched;
    }
    App.state.taskCreationModal = { ...App.state.taskCreationModal, draft: next };
    App.state.djowTaskChat = null;
    App.render();
    Utils.toast('✓ Draft aplicado. Revisa e clica em "Criar no ClickUp".');
  },

  // Submit: valida Normal + envia tudo ao backend.
  async submitTaskCreation() {
    const m = App.state.taskCreationModal;
    if (!m) return;
    const d = m.draft;
    // Validação Normal
    if (!String(d.name || '').trim()) return Utils.toast('Nome é obrigatório.');
    if (!String(d.description || '').trim()) return Utils.toast('Descrição é obrigatória.');
    if (!Array.isArray(d.assignees) || !d.assignees.length) return Utils.toast('Selecione pelo menos 1 responsável.');
    // V32.14.0 — Data de entrega obrigatória (alimenta Etapa 6 acompanhamento).
    if (!String(d.due_date || '').trim()) return Utils.toast('Data de entrega é obrigatória pra acompanhar atrasos na Etapa 6.');

    // V32.14.8 — Custom fields ClickUp NÃO são obrigatórios no LJ (Felipe
    // alinhou): cliente pode criar a task sem preencher categorias.
    // Se o ClickUp rejeitar, o erro aparece via API normal.

    App.state.taskCreationModal = { ...m, submitting: true };
    App.render();

    // Monta payload pro backend
    const payload = {
      name: d.name.trim(),
      description: d.description.trim(),
      assignees: d.assignees,
      list_id: App.state.clickupMeta?.listId || undefined
    };
    // Avançados — só inclui se preenchidos
    if (d.priority) payload.priority = d.priority;
    if (d.status) payload.status = d.status;
    if (d.due_date) { payload.due_date = d.due_date; payload.due_date_time = !!d.due_date_time; }
    if (d.start_date) { payload.start_date = d.start_date; payload.start_date_time = !!d.start_date_time; }
    if (Array.isArray(d.tags) && d.tags.length) payload.tags = d.tags;
    if (d.time_estimate_hours && Number(d.time_estimate_hours) > 0) payload.time_estimate = Math.round(Number(d.time_estimate_hours) * 3600000);
    if (d.points !== '' && Number.isFinite(Number(d.points))) payload.points = Number(d.points);
    if (d.parent) payload.parent = d.parent;
    if (d.links_to) payload.links_to = d.links_to;
    if (d.markdown_content && d.markdown_content.trim()) payload.markdown_content = d.markdown_content.trim();
    // custom_fields: transforma object {id: value} em array [{id, value}]
    if (d.custom_fields && Object.keys(d.custom_fields).length) {
      payload.custom_fields = Object.entries(d.custom_fields)
        .filter(([_, v]) => v !== '' && v != null)
        .map(([id, value]) => ({ id, value }));
    }

    // V32.14.6 — Modo edit: se editingTaskId existe E task já tem
    // provider_task_id (já está no ClickUp), faz PUT pra atualizar no ClickUp
    // via clickup-proxy. Se tem editingTaskId mas SEM provider_task_id (task
    // local/duplicada/em revisão), cria primeira vez no ClickUp e atualiza a
    // task local pra apontar pro novo provider_task_id.
    const editingTask = m.editingTaskId && window.ExecutionTaskStore
      ? ExecutionTaskStore.byId(m.editingTaskId)
      : null;
    const isEditWithProvider = editingTask && editingTask.provider_task_id;

    try {
      const token = localStorage.getItem('lj_jwt');
      let r, data;

      if (isEditWithProvider) {
        // UPDATE task existente no ClickUp via proxy
        const updateBody = {
          name: payload.name,
          description: payload.description,
          assignees: { add: payload.assignees || [] }
        };
        if (payload.due_date) updateBody.due_date = payload.due_date;
        if (payload.due_date_time !== undefined) updateBody.due_date_time = payload.due_date_time;
        if (payload.start_date) updateBody.start_date = payload.start_date;
        if (payload.start_date_time !== undefined) updateBody.start_date_time = payload.start_date_time;
        if (payload.priority) updateBody.priority = payload.priority;
        if (payload.status) updateBody.status = payload.status;
        r = await fetch('/api/clickup-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            method: 'PUT',
            path: `/task/${editingTask.provider_task_id}`,
            body: updateBody
          })
        });
        data = await r.json();
        if (data.ok && data.status >= 200 && data.status < 300) {
          // Atualiza task local
          ExecutionTaskStore.update(editingTask.task_id, {
            title: payload.name,
            description: payload.description,
            due_date: payload.due_date || null,
            assignees: payload.assignees || []
          });
          // TODO: atualizar custom_fields requer PUT individual por campo (API ClickUp)
          App.state.taskCreationModal = null;
          App.save(); App.render();
          Utils.toast(`✓ Task atualizada no ClickUp.`);
        } else {
          App.state.taskCreationModal = { ...m, submitting: false };
          App.render();
          Utils.toast(`Falhou atualizar: ${data.message || data.data?.err || 'erro desconhecido'}`);
        }
      } else {
        // CREATE (comportamento original): cria nova no ClickUp
        r = await fetch('/api/clickup-create-task', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload)
        });
        data = await r.json();
        if (data.ok) {
          if (window.ExecutionTaskStore) {
            if (editingTask) {
              // Era uma task local (review/manual) sendo materializada no ClickUp.
              // Update do registro local em vez de criar duplicata.
              ExecutionTaskStore.update(editingTask.task_id, {
                title: payload.name,
                description: payload.description,
                status: 'pending',  // sai de 'review' pra 'pending' agora no ClickUp
                provider: 'clickup',
                provider_task_id: data.providerTaskId,
                external_url: data.externalUrl,
                due_date: payload.due_date || null,
                assignees: payload.assignees || []
              });
              Utils.toast(`✓ Task criada no ClickUp${data.externalUrl ? '. Clique no toast pra abrir.' : '.'}`);
            } else {
              // Criação nova pura (não vinculada a stub existente).
              ExecutionTaskStore.create({
                linked_action_id: m.actionId,
                title: payload.name,
                description: payload.description,
                status: 'pending',
                provider: 'clickup',
                provider_task_id: data.providerTaskId,
                external_url: data.externalUrl,
                due_date: payload.due_date || null,
                assignees: payload.assignees || []
              });
              Utils.toast(`✓ Task criada no ClickUp${data.externalUrl ? '. Clique no toast pra abrir.' : '.'}`);
            }
          }
          App.state.taskCreationModal = null;
          App.save(); App.render();
        } else {
          App.state.taskCreationModal = { ...m, submitting: false };
          App.render();
          Utils.toast(`Falhou: ${data.message || 'erro desconhecido'}`);
        }
      }
    } catch (err) {
      App.state.taskCreationModal = { ...m, submitting: false };
      App.render();
      Utils.toast(`Erro de rede: ${err.message}`);
    }
  },

  // V32.7.3 (Geraldo A5) — Cliente reconhece o risco de deletar a raiz LJ.
  // Marca ack vinculado ao rootId atual. Se ele trocar de raiz depois, modal
  // aparece de novo (risco renovado).
  acknowledgeClickupDeleteWarning() {
    const rootId = App.state.clickupStatus?.rootId || App.state.clickupStatus?.ljSpaceId || null;
    if (!rootId) return;
    App.state.clickupDeleteWarningAck = {
      rootId: String(rootId),
      ackAt: new Date().toISOString()
    };
    App.save(); App.render();
  },

  // V32.9.2 (Geraldo A16) — Pré-check de custom fields obrigatórios.
  // Carrega fields de uma list do ClickUp e cacheia. Modal de criar task
  // usa pra mostrar campos required ANTES do submit (mata 422 silencioso).
  async loadClickupListFields(listId) {
    if (!listId) return;
    const lid = String(listId);
    if (!App.state.clickupListFieldsCache) App.state.clickupListFieldsCache = {};
    const existing = App.state.clickupListFieldsCache[lid];
    if (existing && existing.fetchedAt && !existing.error) return; // cache hit
    App.state.clickupListFieldsCache[lid] = { fields: [], fetchedAt: null, loading: true, error: null };
    App.render();
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch(`/api/clickup-list-fields?list_id=${encodeURIComponent(lid)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await r.json();
      if (!data.ok) {
        App.state.clickupListFieldsCache[lid] = { fields: [], fetchedAt: null, loading: false, error: data.message };
        App.render();
        return;
      }
      App.state.clickupListFieldsCache[lid] = {
        fields: data.fields || [],
        fetchedAt: new Date().toISOString(),
        loading: false,
        error: null
      };
      App.save(); App.render();
    } catch (err) {
      App.state.clickupListFieldsCache[lid] = { fields: [], fetchedAt: null, loading: false, error: err.message };
      App.render();
    }
  },

  // V32.9.2 — Resolve qual list o modal de criar task vai usar (pra pré-check).
  // Em modo flat (raiz=list): retorna lj_root_id. Modo mirror cascado:
  // procura mapping pela ação. Modo manual: usa o list_id selecionado/default.
  _resolveClickupTargetList(m) {
    if (!m) return null;
    const status = App.state.clickupStatus || {};
    const draftListId = m.draft?.list_id;
    if (draftListId) return String(draftListId);
    if (status.rootKind === 'list' && status.rootId) return String(status.rootId);
    if (status.defaultListId) return String(status.defaultListId);
    return null;
  },

  // V32.9.2 — Update de custom_field value no draft do modal.
  updateClickupCustomField(fieldId, value) {
    const m = App.state.taskCreationModal;
    if (!m) return;
    m.draft = m.draft || {};
    m.draft.custom_fields = m.draft.custom_fields || {};
    m.draft.custom_fields[fieldId] = value;
    App.save();
    // não re-render — input perderia foco
  },

  // V32.7.0 — Pull subtasks reais do ClickUp via mapping cascado.
  // ClickUp = source of truth no step 6 (substitui ExecutionTaskStore que era
  // frágil — multi-aba, snapshot restore, race condition do sync remoto
  // faziam tasks sumirem).
  //
  // Aceita actionIds explícitos OU pega todas conectadas a OKRs do produto atual.
  // silent=true pula toast (auto-call no abrir do step). Default false (manual).
  async pullClickupActionSubtasks(actionIds = null, silent = false) {
    if (!App.state.clickupStatus?.connected) {
      if (!silent) Utils.toast('ClickUp não conectado.');
      return;
    }
    // Se não passou actionIds, pega todas as ações conectadas a algum OKR do produto.
    if (!Array.isArray(actionIds) || !actionIds.length) {
      const productId = App.state.strategicMapProductId;
      const campaignId = App.state.strategicMapCampaignId;
      const source = (campaignId && window.StrategicMapEngine?.getBranchMap)
        ? (StrategicMapEngine.getBranchMap(campaignId) || { objectives: [] })
        : (productId && StrategicMapEngine.getForProduct(productId)) || { objectives: [] };
      const ids = new Set();
      (source.objectives || []).forEach(o => (o.okrs || []).forEach(kr => {
        (kr.connectedActionIds || []).forEach(id => ids.add(Number(id)));
      }));
      actionIds = Array.from(ids).filter(Boolean);
    }
    if (!actionIds.length) {
      if (!silent) Utils.toast('Nenhuma ação conectada pra puxar tasks.');
      return;
    }
    const cache = App.state.clickupActionSubtasks || { byActionId: {}, fetchedAt: null };
    cache.loading = true;
    App.state.clickupActionSubtasks = cache;
    App.render();
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/clickup-pull-action-subtasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action_ids: actionIds })
      });
      const data = await r.json();
      if (!data.ok) {
        cache.loading = false;
        App.state.clickupActionSubtasks = cache;
        App.render();
        if (!silent) Utils.toast(`Falha: ${data.message}`);
        return;
      }
      // Merge: mantém entries antigas que não vieram no response (caso request parcial)
      const merged = { ...(cache.byActionId || {}), ...(data.subtasksByAction || {}) };
      App.state.clickupActionSubtasks = {
        byActionId: merged,
        fetchedAt: new Date().toISOString(),
        loading: false,
        rootKind: data.rootKind || null,
        skipped: data.skipped || null
      };
      // V32.9.0 — Subtasks frescas chegaram → recomputa strategicStatus de
      // todas as ações dessa pull. Continuity loop: ClickUp → cache → engine
      // → action.strategicStatus → UI do step 4 (As Ações) reflete realidade
      // sem cliente fazer nada manual.
      if (window.StrategicStatusEngine && actionIds.length) {
        let changed = 0;
        actionIds.forEach(aid => {
          if (StrategicStatusEngine.recompute(aid) !== null) changed++;
        });
        if (changed > 0 && !silent) {
          Utils.toast(`✓ ${changed} ação(ões) tiveram status atualizado pelo ClickUp.`);
        }
      }
      App.save(); App.render();
      if (!silent) {
        const totalSubs = Object.values(data.subtasksByAction || {}).reduce((sum, arr) => sum + arr.length, 0);
        Utils.toast(`✓ ${totalSubs} subtask(s) puxada(s) do ClickUp.`);
      }
    } catch (err) {
      cache.loading = false;
      App.state.clickupActionSubtasks = cache;
      App.render();
      if (!silent) Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V32.6.9 — Sync status das tasks do ClickUp. Itera ExecutionTaskStore,
  // pega provider_task_ids da provider='clickup', POST pro endpoint que
  // retorna status atual de cada uma. Atualiza store local in-place.
  //
  // Mapping ClickUp → LJ:
  //   statusType='closed' → status LJ 'completed'
  //   statusType='open' + status contém 'progress'/'doing' → 'in_progress'
  //   resto → 'pending'
  //
  // silent=true pula toast (uso em auto-sync). Default false (uso manual).
  async syncClickupTaskStatuses(silent = false) {
    if (!window.ExecutionTaskStore) return;
    if (!App.state.clickupStatus?.connected) {
      if (!silent) Utils.toast('ClickUp não conectado.');
      return;
    }
    const tasks = ExecutionTaskStore.all().filter(t => t.provider === 'clickup' && t.provider_task_id);
    if (!tasks.length) return;
    const taskIds = tasks.map(t => t.provider_task_id);
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/clickup-pull-task-statuses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ task_ids: taskIds })
      });
      const data = await r.json();
      if (!data.ok) {
        if (!silent) Utils.toast(`Falha sync: ${data.message}`);
        return;
      }
      // V32.15.2 — Aplica updates no store local. Além do status LJ mapeado,
      // grava o status RAW do ClickUp (label + cor) pra o badge no card mostrar
      // exatamente o que o user definiu no ClickUp (ex: "parado" com cor #ff0000).
      let updatedCount = 0;
      for (const task of tasks) {
        const remote = data.statuses?.[task.provider_task_id];
        if (!remote || remote.error) continue;
        const newStatus = this._mapClickupStatusToLj(remote);
        const remoteLabel = remote.status ? String(remote.status) : null;
        const remoteColor = remote.statusColor ? String(remote.statusColor) : null;
        const changed = (newStatus && newStatus !== task.status)
          || (remoteLabel && remoteLabel !== task.provider_status_label)
          || (remoteColor && remoteColor !== task.provider_status_color);
        if (changed) {
          const patch = {
            status: newStatus || task.status,
            provider_status_label: remoteLabel,
            provider_status_color: remoteColor
          };
          if (patch.status === 'in_progress' && !task.started_at) patch.started_at = new Date().toISOString();
          if (patch.status === 'completed') patch.completed_at = new Date().toISOString();
          ExecutionTaskStore.update(task.task_id, patch);
          updatedCount++;
        }
      }
      // V32.14.8 — Grava timestamp da última sync pra mostrar no botão.
      App.state.clickupLastSyncAt = Date.now();
      if (updatedCount > 0) {
        App.save(); App.render();
        if (!silent) Utils.toast(`✓ ${updatedCount} task(s) atualizada(s) do ClickUp.`);
      } else {
        App.save();
        if (!silent) Utils.toast('Tudo sincronizado — nenhuma task mudou status.');
        else App.render();
      }
    } catch (err) {
      if (!silent) Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V32.6.9 — Helper interno: mapping ClickUp status → LJ status.
  _mapClickupStatusToLj(remote) {
    if (!remote) return null;
    // V38.1.31 — Fix: ClickUp manda statusType='custom' pra status custom da
    // list ("CONCLUÍDO", "PENDENTE"), nao 'closed'. Antes o mapper exigia
    // statusType==='closed' e por isso todas as tasks viravam 'pending' aqui.
    // Agora tambem casa por LABEL: concluido/closed/done/finalizado/etc.
    if (remote.statusType === 'closed') return 'completed';
    const s = String(remote.status || '').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, ''); // sem acento
    const COMPLETED_KEYWORDS = ['concluido', 'closed', 'done', 'finalizado', 'completo', 'completed', 'feito', 'entregue', 'pronto'];
    if (COMPLETED_KEYWORDS.some(k => s.includes(k))) return 'completed';
    const IN_PROGRESS_KEYWORDS = ['progress', 'doing', 'andamento', 'fazendo', 'execucao'];
    if (IN_PROGRESS_KEYWORDS.some(k => s.includes(k))) return 'in_progress';
    return 'pending';
  },

  // V31.2.29 — Conexão via Personal API Token. Substitui o flow OAuth na UI.
  updateClickupPatDraft(value) {
    App.state.clickupPatDraft = String(value || '');
  },

  async connectClickupWithPAT() {
    const pat = String(App.state.clickupPatDraft || '').trim();
    if (!pat) return Utils.toast('Cole o Personal API Token primeiro.');
    if (!pat.startsWith('pk_')) return Utils.toast('Token inválido — Personal API Token do ClickUp começa com "pk_".');
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/clickup-connect-pat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pat })
      });
      const data = await r.json();
      if (data.ok) {
        App.state.clickupPatDraft = '';
        Utils.toast(`✓ Conectado ao workspace "${data.workspaceName || '—'}".`);
        await Actions.loadClickupStatus();
      } else {
        Utils.toast(`Falhou: ${data.message || 'erro desconhecido'}`);
      }
    } catch (err) { Utils.toast(`Erro de rede: ${err.message}`); }
  },

  async connectClickup() {
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/clickup-oauth-init', {
        method: 'GET', headers: { Authorization: `Bearer ${token}` }
      });
      const data = await r.json();
      if (data.ok && data.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer');
        Utils.toast('Aguarde autorização no ClickUp...');
        // Pollar status a cada 2s por até 60s pra detectar quando conecta
        let attempts = 0;
        const poll = setInterval(async () => {
          attempts++;
          await Actions.loadClickupStatus();
          if (App.state.clickupStatus?.connected || attempts >= 30) clearInterval(poll);
        }, 2000);
      } else {
        Utils.toast(`Erro: ${data.message}`);
      }
    } catch (err) { Utils.toast(`Erro: ${err.message}`); }
  },

  async disconnectClickup() {
    if (!confirm('Tem certeza que quer desconectar o ClickUp?')) return;
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/clickup-config', {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
      });
      const data = await r.json();
      if (data.ok) {
        Utils.toast('ClickUp desconectado.');
        await Actions.loadClickupStatus();
      } else {
        Utils.toast(`Erro: ${data.message}`);
      }
    } catch (err) { Utils.toast(`Erro: ${err.message}`); }
  },

  // V32.4.3 — Revela o PAT do ClickUp salvo (descriptografa do DB).
  // Use case: cliente já colou PAT antes + ClickUp mascarou (não dá pra copiar
  // de novo) + ele quer plugar mesmo PAT em outra integração sem regenerar.
  async revealClickupPat() {
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/clickup-reveal-pat', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await r.json();
      if (!data.ok) return Utils.toast(`Erro: ${data.message || 'falha'}`);

      // Mostra o token em prompt nativo — user dá Ctrl+A, Ctrl+C, fecha.
      // Prompt seleciona o conteúdo todo automaticamente em chrome/firefox.
      window.prompt(
        `Personal API Token do ClickUp (workspace: ${data.workspaceName || '—'})\n\n` +
        `Selecione (Ctrl+A) e copie (Ctrl+C). Trate como senha — não compartilhe em telas/repos.`,
        data.token
      );
      // Audit hint no console pro user saber que a action rolou
      console.log('[clickup-reveal-pat] PAT revelado em prompt. Token NÃO persiste em log.');
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V32.5.6 — Tabs OAuth | PAT no card ClickUp em Configurações → Integrações.
  // Cliente escolhe método de conexão. Backend já suporta os 2 via token_type.
  setClickupConnectTab(tab) {
    App.state.clickupConnectTab = (tab === 'pat') ? 'pat' : 'oauth';
    App.save(); App.render();
  },

  // V32.5.6 — Draft do form OAuth (Client ID + Client Secret). Não chama render
  // pra não perder foco do input enquanto digita (padrão dos outros drafts).
  updateClickupOAuthDraftField(field, value) {
    App.state.clickupOAuthDraft = App.state.clickupOAuthDraft || { clientId: '', clientSecret: '' };
    App.state.clickupOAuthDraft[field] = String(value || '');
    App.save();
  },

  // V32.5.8 — Toggle do <details> "Configurações avançadas" no card ClickUp.
  // <details> HTML nativo perde o atributo `open` em todo innerHTML re-render
  // (App.render dispara isso). Cliente percebia como "fecha sozinho". Persistir
  // em state sobrevive re-renders.
  toggleClickupAdvanced() {
    App.state.clickupAdvancedOpen = !App.state.clickupAdvancedOpen;
    App.save(); App.render();
  },

  // V32.5.6 — Salva Client ID/Secret do OAuth App em clickup_config (criptografado
  // no backend via lib/clickup-crypto). Depois disso o user pode clicar
  // "Autorizar no ClickUp" pra abrir a janela OAuth — fluxo handled em
  // Actions.connectClickup() (linha 6152, já existente desde V30).
  async saveClickupOAuthConfig() {
    const draft = App.state.clickupOAuthDraft || {};
    const clientId = String(draft.clientId || '').trim();
    const clientSecret = String(draft.clientSecret || '').trim();
    if (!clientId || !clientSecret) return Utils.toast('Client ID e Client Secret obrigatórios.');
    // V32.6.3 — Guard: browser autofill costuma colocar email no Client ID.
    // Client ID do ClickUp OAuth App tem ~32 chars hexadecimais. Bloqueia.
    if (/@/.test(clientId)) {
      return Utils.toast('Client ID parece um email (autopreenchido pelo browser). Apague e cole o Client ID real do OAuth App.');
    }
    if (clientId.length < 10) {
      return Utils.toast('Client ID muito curto. Confere se você copiou o valor inteiro do OAuth App no ClickUp.');
    }
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/clickup-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret })
      });
      const data = await r.json();
      if (data.ok) {
        Utils.toast('✓ Credenciais salvas. Clique em "Autorizar no ClickUp" pra prosseguir.');
        App.state.clickupOAuthDraft = { clientId: '', clientSecret: '' };
        await Actions.loadClickupStatus();
      } else {
        Utils.toast(`Erro: ${data.message}`);
      }
    } catch (err) { Utils.toast(`Erro: ${err.message}`); }
  },

  // V30.0.0 — Proxy genérico pra chamar ClickUp API do frontend (sem expor token).
  async clickupApi(method, path, body) {
    const token = localStorage.getItem('lj_jwt');
    const r = await fetch('/api/clickup-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ method, path, body })
    });
    return r.json();
  },

  // V30.0.0 — Abre o modal de criar task. Recebe contexto (KR/ação) e pré-preenche.
  openCreateClickupTaskModal(seedContext) {
    // V32.1.7 — Pré-seleciona a default_list_id configurada (Geraldo safe).
    // User pode trocar via dropdown se quiser override.
    const defaultListId = App.state.clickupStatus?.defaultListId || '';
    App.state.createClickupTaskModal = {
      open: true,
      loading: true,
      loadError: null,
      expanded: false,
      lists: [],
      users: [],
      seedContext: seedContext || null,
      draft: {
        list_id: defaultListId,
        name: seedContext?.suggestedName || '',
        description: seedContext?.suggestedDescription || '',
        priority: 3,
        due_date: seedContext?.suggestedDueDate || '',
        assignees: [],
        tags: []
      }
    };
    App.render();
    // Carrega lists + users do ClickUp em paralelo.
    (async () => {
      try {
        const teamsRes = await Actions.clickupApi('GET', '/team', null);
        const teams = teamsRes?.data?.teams || [];
        if (!teams.length) throw new Error('Nenhum workspace encontrado.');
        const teamId = teams[0].id;
        const [lists, users] = await Promise.all([
          Actions._loadAllClickupLists(teamId),
          Actions._loadClickupTeamMembers(teamId)
        ]);
        if (App.state.createClickupTaskModal) {
          App.state.createClickupTaskModal.lists = lists;
          App.state.createClickupTaskModal.users = users;
          App.state.createClickupTaskModal.loading = false;
          App.render();
        }
      } catch (err) {
        if (App.state.createClickupTaskModal) {
          App.state.createClickupTaskModal.loading = false;
          App.state.createClickupTaskModal.loadError = err.message || 'Falha ao carregar dados do ClickUp.';
          App.render();
        }
      }
    })();
  },

  // V30.0.0 — Walka a hierarquia Workspace > Space > (Folder >) List e retorna flat list
  // com labels "Space > Folder > List" ou "Space > List".
  async _loadAllClickupLists(teamId) {
    const spacesRes = await Actions.clickupApi('GET', `/team/${teamId}/space`, null);
    const spaces = spacesRes?.data?.spaces || [];
    const all = [];
    await Promise.all(spaces.map(async space => {
      const [folderlessRes, foldersRes] = await Promise.all([
        Actions.clickupApi('GET', `/space/${space.id}/list`, null),
        Actions.clickupApi('GET', `/space/${space.id}/folder`, null)
      ]);
      (folderlessRes?.data?.lists || []).forEach(l => {
        all.push({ id: l.id, label: `${space.name} > ${l.name}` });
      });
      const folders = foldersRes?.data?.folders || [];
      await Promise.all(folders.map(async folder => {
        const listsRes = await Actions.clickupApi('GET', `/folder/${folder.id}/list`, null);
        (listsRes?.data?.lists || []).forEach(l => {
          all.push({ id: l.id, label: `${space.name} > ${folder.name} > ${l.name}` });
        });
      }));
    }));
    all.sort((a, b) => a.label.localeCompare(b.label));
    return all;
  },

  async _loadClickupTeamMembers(teamId) {
    const r = await Actions.clickupApi('GET', `/team/${teamId}/member`, null);
    const members = r?.data?.members || [];
    return members.map(m => ({
      id: m.user?.id || m.id,
      username: m.user?.username || m.username || '—',
      email: m.user?.email || m.email || ''
    }));
  },

  closeCreateClickupTaskModal() {
    App.state.createClickupTaskModal = null;
    App.render();
  },

  updateClickupTaskField(field, value) {
    if (!App.state.createClickupTaskModal) return;
    App.state.createClickupTaskModal.draft = { ...App.state.createClickupTaskModal.draft, [field]: value };
  },

  toggleClickupTaskExpanded() {
    if (!App.state.createClickupTaskModal) return;
    App.state.createClickupTaskModal.expanded = !App.state.createClickupTaskModal.expanded;
    App.render();
  },

  toggleClickupAssignee(userId) {
    const m = App.state.createClickupTaskModal;
    if (!m) return;
    const uid = Number(userId);
    const arr = Array.isArray(m.draft.assignees) ? m.draft.assignees.slice() : [];
    const idx = arr.indexOf(uid);
    if (idx >= 0) arr.splice(idx, 1); else arr.push(uid);
    m.draft.assignees = arr;
    App.render();
  },

  updateClickupTaskTags(rawValue) {
    const m = App.state.createClickupTaskModal;
    if (!m) return;
    m.draft.tags = String(rawValue || '').split(',').map(t => t.trim()).filter(Boolean);
  },

  // V32.1.7 + V32.2.1 — Modal manual passa pelo /api/clickup-create-task com
  // mirror_context resolvido (igual Djow). Guards V32.1.4-1.6 + hierarquia
  // V32.2.0 aplicados.
  async submitClickupTask() {
    const m = App.state.createClickupTaskModal;
    if (!m) return;
    const d = m.draft;
    if (!d.name) return Utils.toast('Título obrigatório.');

    const status = App.state.clickupStatus || {};
    const mirrorOn = Boolean(status.ljSpaceId) && status.mirrorEnabled !== false;

    // V32.2.1 — Resolve mirror_context a partir de seedContext.actionId (vem do
    // botão "Criar tarefa via Djow" no Mapa da Receita). Sem seedContext, modal
    // tá em modo "standalone" — só funciona se mirror desativado OU se cliente
    // selecionou list_id explícito + cair no fallback.
    let mirror_context = null;
    if (mirrorOn && m.seedContext?.actionId) {
      const actionId = Number(m.seedContext.actionId);
      const action = (App.state.actions || []).find(a => Number(a.id) === actionId);
      if (action) {
        const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(action.campaignId));
        const product = campaign ? (App.state.products || []).find(p => Number(p.id) === Number(campaign.productId)) : null;
        if (campaign && product) {
          mirror_context = {
            product: { id: product.id, name: product.name },
            campaign: { id: campaign.id, name: campaign.name },
            action: { id: action.id, name: action.name }
          };
        }
      }
    }

    // V32.2.1 — Standalone sem mirror_context: bloqueia se mirror ON
    // (sem actionId, LJ não sabe onde criar na hierarquia espelhada).
    if (mirrorOn && !mirror_context && !d.list_id) {
      return Utils.toast('Modo espelhado ativo: abra esta task pelo Mapa da Receita (botão "Criar tarefa" em uma ação específica) pra LJ resolver a hierarquia.');
    }

    if (!mirror_context && !d.list_id) {
      return Utils.toast('Escolha a Lista no ClickUp.');
    }

    const token = localStorage.getItem('lj_jwt');
    const body = {
      name: d.name,
      description: d.description,
      priority: Number(d.priority) || 3,
      due_date: d.due_date ? new Date(d.due_date).getTime() : undefined,
      assignees: d.assignees,
      tags: d.tags,
      mirror_context  // V32.2.1 — null se modo legado/standalone, populated se from Mapa
    };
    // Só manda list_id se NÃO tem mirror (mirror resolve list sozinho)
    if (!mirror_context && d.list_id) body.list_id = d.list_id;

    // V32.2.3 (Geraldo A4) — Feedback durante create. Em mirror em workspace
    // virgem pode demorar 2-4s criando folder+list+task pai. Antes era silêncio.
    if (mirror_context) {
      Utils.toast('Espelhando hierarquia no ClickUp...');
    }

    try {
      const res = await fetch('/api/clickup-create-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.ok) {
        const mirrorMsg = data.mirror?.createdAny
          ? ' · estrutura espelhada atualizada'
          : '';
        Utils.toast(`✓ Tarefa criada no ClickUp${mirrorMsg}${data.externalUrl ? ' · clique pra abrir' : ''}`);
        App.state.createClickupTaskModal = null;
        App.save(); App.render();
        if (data.externalUrl) window.open(data.externalUrl, '_blank', 'noopener,noreferrer');
      } else if (data.code === 'clickup_read_only') {
        Utils.toast('ClickUp em modo somente-leitura — task NÃO criada. Reative em Configurações → ClickUp.');
      } else if (data.code === 'no_default_list') {
        Utils.toast('Configure a list de destino padrão em Configurações → ClickUp antes de criar tasks.');
      } else if (data.step === 'mirror_resolve') {
        Utils.toast(`Falha na hierarquia espelhada: ${data.message}`);
      } else {
        Utils.toast(`Erro: ${data.message || 'falha desconhecida'}`);
      }
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // Refinar via Djow: abre o chat Djow com a sugestão de modificar a task que o user tá editando.
  openDjowFromClickupModal() {
    const m = App.state.createClickupTaskModal;
    if (!m) return;
    const d = m.draft;
    const seed = `Djow, ajuda a refinar essa tarefa que vou criar no ClickUp:
Título: ${d.name}
Descrição: ${d.description}
Prazo: ${d.due_date || 'sem prazo'}
Prioridade: ${d.priority}

[me sugere melhorias e me ajuda a ajustar]`;
    App.state.djowInput = seed;
    Actions.openDjowAIModal();
  },

  // V29.0.0 — Troca a branch ativa dentro do Mapa (switcher no header).
  switchStrategicBranch(campaignId) {
    Actions.openStrategicMapForCampaign(Number(campaignId));
  },

  // V31.2.25 — Abre o modal de detalhe da ação operacional inline no Mapa.
  // Substitui o redirect pro menu Ações que existia quando clicava em pill.
  openStrategicActionDetail(actionId) {
    const action = (App.state.actions || []).find(a => Number(a.id) === Number(actionId));
    if (!action) return Utils.toast('Ação não encontrada.');
    App.state.strategicActionDetailModalId = Number(actionId);
    App.render();
  },

  closeStrategicActionDetail() {
    App.state.strategicActionDetailModalId = null;
    App.render();
  },

  // V31.2.25 — Editar ação a partir do modal de detalhe: fecha o detalhe e
  // delega pro ActionEditModal já existente. Reusa toda a engine de edição.
  editActionFromDetail(actionId) {
    App.state.strategicActionDetailModalId = null;
    if (typeof this.openActionEditModal === 'function') this.openActionEditModal(actionId);
    else App.render();
  },

  // V31.2.25 — Desplugar: remove a ação de TODOS os childKrs que ela toca
  // (across todas as branches do produto). Mantém o Action record + tasks +
  // leads — só remove os vínculos. Confirma antes listando os KRs afetados.
  desplugActionFromDetail(actionId) {
    const action = (App.state.actions || []).find(a => Number(a.id) === Number(actionId));
    if (!action) return Utils.toast('Ação não encontrada.');
    const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(action.campaignId));
    const productId = campaign?.productId || App.state.strategicMapProductId;
    if (!productId) return Utils.toast('Produto não encontrado.');
    const branches = StrategicMapEngine.getBranchesByProduct(productId) || [];
    const linked = [];
    branches.forEach(b => {
      const c = (App.state.campaigns || []).find(x => Number(x.id) === Number(b.campaignId));
      (b.objectives || []).forEach(o => {
        (o.okrs || []).forEach(kr => {
          if ((kr.connectedActionIds || []).map(Number).includes(Number(actionId))) {
            linked.push({ branch: b, objective: o, kr, campaign: c });
          }
        });
      });
    });
    if (!linked.length) return Utils.toast('Ação já está desplugada.');
    const msg = `Vai DESPLUGAR a ação "${action.name}".\n\n` +
      `Você vai perder a contribuição dela pros seguintes KRs:\n` +
      linked.map(l => `  • ${l.kr.name} (campanha "${l.campaign?.name || '—'}")`).join('\n') +
      `\n\nA ação continua existindo (você pode replugar depois). Confirma?`;
    if (!confirm(msg)) return;
    linked.forEach(({ objective, kr, branch }) => {
      if (window.StrategicOkrEngine) {
        StrategicOkrEngine.toggleAction(productId, objective.id, kr.id, Number(actionId), branch.campaignId);
      }
    });
    App.save(); App.render();
    Utils.toast(`Ação "${action.name}" desplugada de ${linked.length} KR(s).`);
  },

  // V31.2.25 — Deletar ação. Só permite se desplugada (linkedKrs vazio).
  // Senão alerta pra desplugar primeiro. Quando deletar, remove o Action +
  // todas tasks de execução vinculadas. Operação irreversível.
  deleteActionFromDetail(actionId) {
    const action = (App.state.actions || []).find(a => Number(a.id) === Number(actionId));
    if (!action) return Utils.toast('Ação não encontrada.');
    const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(action.campaignId));
    const productId = campaign?.productId || App.state.strategicMapProductId;
    let connectedCount = 0;
    if (productId) {
      const branches = StrategicMapEngine.getBranchesByProduct(productId) || [];
      branches.forEach(b => {
        (b.objectives || []).forEach(o => {
          (o.okrs || []).forEach(kr => {
            if ((kr.connectedActionIds || []).map(Number).includes(Number(actionId))) connectedCount++;
          });
        });
      });
    }
    if (connectedCount > 0) {
      alert(
        `Não dá pra deletar "${action.name}" enquanto estiver plugada (${connectedCount} KR(s)).\n\n` +
        `Pra deletar:\n  1) Clique em "Desplugar" pra remover de todos os KRs\n  2) Depois clique em "Deletar"\n\n` +
        `Motivo: deletar uma ação plugada apaga toda a contribuição dela (leads, score) dos KRs que ela alimenta. Essa proteção evita que dados estratégicos sumam sem aviso.`
      );
      return;
    }
    const tasksCount = (window.ExecutionTaskStore?.byAction(actionId) || []).length;
    const leadsCount = (action.leads || []).length;
    const ok = confirm(
      `DELETAR PERMANENTEMENTE a ação "${action.name}"?\n\n` +
      `Isso vai apagar:\n` +
      `  • A ação\n` +
      `  • ${tasksCount} task(s) de execução\n` +
      `  • ${leadsCount} lead(s) vinculados\n\n` +
      `Esta operação é IRREVERSÍVEL. Confirma?`
    );
    if (!ok) return;
    App.state.executionTasks = (App.state.executionTasks || []).filter(t => Number(t.linked_action_id) !== Number(actionId));
    App.state.actions = (App.state.actions || []).filter(a => Number(a.id) !== Number(actionId));
    App.state.strategicActionDetailModalId = null;
    App.save(); App.render();
    Utils.toast(`Ação "${action.name}" deletada.`);
  },

  // V31.1.0 — Abre ação operacional desde o Mapa da Receita (caminho inverso).
  // Fecha o Mapa, navega pra aba Ações de Campanha, seleciona a campanha + ação.
  openActionFromMap(actionId) {
    const action = (App.state.actions || []).find(a => Number(a.id) === Number(actionId));
    if (!action) return Utils.toast('Ação não encontrada.');
    App.state.showStrategicMap = false;
    App.state.selectedActionId = Number(actionId);
    App.state.selectedCampaignId = action.campaignId;
    App.state.activeTab = 'actions';
    App.save(); App.render();
  },

  // V31.1.0 — Wizard "Conectar ao Mapa da Receita" (Frente → KR-mãe → Confirmar).
  // Plug uma ação operacional (do menu Ações de Campanha) num KR-mãe do produto.
  openConnectActionToMapa(actionId) {
    if (this._demoGuard && this._demoGuard('Conectar ao Mapa')) return;
    App.state.connectActionWizard = { open: true, actionId: Number(actionId), step: 1, areaId: null, productKrId: null };
    App.render();
  },
  closeConnectWizard() {
    App.state.connectActionWizard = null;
    App.render();
  },
  connectWizardPickArea(areaId) {
    if (!App.state.connectActionWizard) return;
    App.state.connectActionWizard.areaId = String(areaId);
    App.state.connectActionWizard.productKrId = null; // reset se trocou de área
    App.render();
  },
  connectWizardPickProductKr(productKrId) {
    if (!App.state.connectActionWizard) return;
    App.state.connectActionWizard.productKrId = String(productKrId);
    App.render();
  },
  connectWizardNext() {
    const wiz = App.state.connectActionWizard;
    if (!wiz) return;
    if (wiz.step === 1 && !wiz.areaId) return Utils.toast('Escolha uma frente comercial.');
    if (wiz.step === 2 && !wiz.productKrId) return Utils.toast('Escolha um KR-mãe.');
    wiz.step = Math.min(wiz.step + 1, 3);
    App.render();
  },
  connectWizardBack() {
    const wiz = App.state.connectActionWizard;
    if (!wiz) return;
    wiz.step = Math.max(wiz.step - 1, 1);
    App.render();
  },
  connectWizardConfirm() {
    const wiz = App.state.connectActionWizard;
    if (!wiz) return;
    const { actionId, areaId, productKrId } = wiz;
    const action = (App.state.actions || []).find(a => Number(a.id) === Number(actionId));
    if (!action) return Utils.toast('Ação não encontrada.');
    const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(action.campaignId));
    if (!campaign || !campaign.productId) return Utils.toast('Campanha sem produto vinculado.');
    const productId = Number(campaign.productId);
    const map = window.StrategicMapEngine?.getForProduct(productId);
    const productKr = (map?.productKrs || []).find(k => k.id === productKrId);
    if (!productKr) return Utils.toast('KR-mãe não encontrado.');

    // 1. Set strategic fields na ação
    action.strategicAreaId = areaId;
    action.strategicOwner = (window.StrategicMapEngine?.getAreaOwner && StrategicMapEngine.getAreaOwner(productId, areaId)) || '';
    action.strategicStatus = action.strategicStatus || 'planned';
    action.strategicConfirmed = true;
    action.strategicCadence = action.strategicCadence || null;
    action.strategicCatalogId = action.strategicCatalogId || null;
    action.strategicDescription = action.strategicDescription || '';

    // 2. Ensure branch (strategicCampaignMap) pra essa campanha
    let branch = window.StrategicMapEngine?.getBranchMap(campaign.id);
    if (!branch) {
      branch = window.StrategicMapEngine?.ensureBranchMap(campaign.id, productId);
    }
    if (!branch) return Utils.toast('Falha ao criar branch da campanha.');

    // 3. Ensure objective (frente) dentro da branch
    branch.objectives = branch.objectives || [];
    let objective = branch.objectives.find(o => o.area === areaId);
    if (!objective) {
      const areaDef = (window.StrategicMapEngine?.COMERCIAL_AREAS || []).find(a => a.id === areaId);
      objective = {
        id: `obj_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        label: areaDef?.label || areaId,
        area: areaId,
        owner: action.strategicOwner,
        deadline: '',
        okrs: [],
        createdAt: new Date().toISOString()
      };
      branch.objectives.push(objective);
    }

    // 4. Ensure child KR com parentProductKrId = productKr.id
    let childKr = (objective.okrs || []).find(k => k.parentProductKrId === productKr.id);
    if (!childKr) {
      childKr = {
        id: `okr_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        name: productKr.name,
        metric: productKr.metric || 'quantidade',
        catalogId: productKr.catalogId || null,
        isHandoff: false,
        current: 0,
        targetCommitted: productKr.targetCommitted ?? productKr.target ?? null,
        targetStretch: productKr.targetStretch ?? null,
        period: productKr.period || 90,
        confirmed: false,
        connectedActionIds: [],
        parentProductKrId: productKr.id
      };
      objective.okrs = [...(objective.okrs || []), childKr];
    }

    // 5. Add action.id ao connectedActionIds (idempotente)
    const ids = new Set((childKr.connectedActionIds || []).map(Number));
    ids.add(Number(action.id));
    childKr.connectedActionIds = Array.from(ids);

    // 6. Persiste e fecha
    branch.updatedAt = new Date().toISOString();
    App.state.strategicCampaignMaps = { ...(App.state.strategicCampaignMaps || {}), [campaign.id]: branch };
    App.state.connectActionWizard = null;
    App.save(); App.render();
    Utils.toast(`Ação plugada em ${productKr.name}. Retângulo azul ativado.`);
  },

  // V31.2.10 — Tabs Mkt/Vendas/CS na etapa "Os Números do Produto".
  setStrategicNumberAreaTab(areaId) {
    App.state.strategicNumberAreaTab = String(areaId);
    App.state.strategicOkrDraft = null; // limpa draft ao trocar de aba
    App.render();
  },

  // V31.2.10 — Inicia o wizard 7-passos pra criar productKr custom numa área.
  // Reutiliza _okrDraftCard (existente) marcando draft.area pra rotear no save.
  startStrategicProductKrDraft(areaId) {
    if (this._demoGuard && this._demoGuard('Criar KR-mãe customizado')) return;
    App.state.strategicOkrDraft = {
      area: String(areaId),        // V29 marker: salva como productKr
      name: '',
      metric: 'quantidade',
      target: 0,
      current: 0,
      startValue: 0,
      owner: '',
      deadline: '',
      impact: '',
      commitmentType: 'stretch',
      connectedActionIds: [],
      wizardStep: 1
    };
    App.render();
  },

  // V31.2.21 — "Abrir no Mapa" do retângulo azul (_strategicTag) leva direto
  // pra etapa 5 "Ações" da campanha da ação, NÃO mais pra etapa 4 hub.
  openActionOnMap(productId, actionId) {
    const action = (App.state.actions || []).find(a => Number(a.id) === Number(actionId));
    if (!action) return Utils.toast('Ação não encontrada.');
    const campaignId = Number(action.campaignId);
    if (!campaignId) return Utils.toast('Ação sem campanha.');
    // Abre na branch da campanha + etapa Ações
    Actions.openStrategicMapForCampaign(campaignId);
    setTimeout(() => {
      if (window.StrategicZoomNavigation) StrategicZoomNavigation.set('operations');
      App.state.strategicActiveArea = action.strategicAreaId || null;
      App.state.strategicSkipOnboarding = true;
      App.save(); App.render();
    }, 50);
  },

  // V31.2.20 — Modal-on-modal "Ver ações plugadas": mini-dashboard + lista
  // de ações conectadas a um KR-mãe (across todas branches do produto).
  openPluggedActionsModal(pkrId) {
    App.state.pluggedActionsModal = { open: true, pkrId };
    App.render();
  },
  closePluggedActionsModal() {
    App.state.pluggedActionsModal = null;
    App.render();
  },

  // V31.2.21 — Modal "Conectar ação a KRs" (pra ação já existente, sem KR vinculado).
  openConnectActionToKrsModal(actionId) {
    if (this._demoGuard && this._demoGuard('Conectar ação a KRs')) return;
    App.state.connectActionToKrsModal = { open: true, actionId: Number(actionId), selectedKrIds: [] };
    App.render();
  },
  closeConnectActionToKrsModal() {
    App.state.connectActionToKrsModal = null;
    App.render();
  },
  toggleConnectActionKr(krId) {
    const m = App.state.connectActionToKrsModal;
    if (!m) return;
    const list = Array.isArray(m.selectedKrIds) ? m.selectedKrIds.slice() : [];
    const idx = list.indexOf(krId);
    if (idx >= 0) list.splice(idx, 1); else list.push(krId);
    App.state.connectActionToKrsModal = { ...m, selectedKrIds: list };
    App.render();
  },
  confirmConnectActionToKrs() {
    const m = App.state.connectActionToKrsModal;
    if (!m) return;
    if (!m.selectedKrIds || !m.selectedKrIds.length) return Utils.toast('Marque pelo menos um KR.');
    const productId = App.state.strategicMapProductId;
    const campaignId = App.state.strategicMapCampaignId;
    if (!productId || !campaignId) return Utils.toast('Sem branch ativa.');
    const branch = StrategicMapEngine.getBranchMap(campaignId);
    if (!branch) return Utils.toast('Branch não encontrada.');
    // Pra cada KR marcado: garante childKr na branch (se não tem) e adiciona action.id em connectedActionIds
    m.selectedKrIds.forEach(krId => {
      const pkr = StrategicMapEngine.getProductKrs(productId).find(k => k.id === krId);
      if (!pkr) return;
      const objective = (branch.objectives || []).find(o => o.area === pkr.area);
      if (!objective) return;
      let childKr = (objective.okrs || []).find(k => k.parentProductKrId === krId);
      if (!childKr) {
        // Cria childKr na branch herdando do pkr
        const newId = `okr_${Date.now()}_${Math.floor(Math.random()*1000)}`;
        childKr = {
          id: newId,
          name: pkr.name,
          metric: pkr.metric,
          catalogId: pkr.catalogId,
          isHandoff: Boolean(pkr.isHandoff),
          current: pkr.current != null ? Number(pkr.current) : null,
          targetCommitted: pkr.targetCommitted != null ? Number(pkr.targetCommitted) : null,
          targetStretch: pkr.targetStretch != null ? Number(pkr.targetStretch) : null,
          period: pkr.period || 90,
          confirmed: false,
          connectedActionIds: [],
          parentProductKrId: pkr.id
        };
        objective.okrs = [...(objective.okrs || []), childKr];
      }
      // Adiciona action.id (idempotente)
      const ids = new Set((childKr.connectedActionIds || []).map(Number));
      ids.add(Number(m.actionId));
      childKr.connectedActionIds = Array.from(ids);
    });
    branch.updatedAt = new Date().toISOString();
    App.state.strategicCampaignMaps = { ...(App.state.strategicCampaignMaps || {}), [campaignId]: branch };
    App.state.connectActionToKrsModal = null;
    App.save(); App.render();
    Utils.toast(`Ação conectada a ${m.selectedKrIds.length} KR(s).`);
  },

  // V31.2.21 — Editar ação a partir do Mapa: reusa Actions.openActionEditModal existente.
  openEditActionFromMap(actionId) {
    if (typeof this.openActionEditModal === 'function') return this.openActionEditModal(actionId);
  },

  // V29.3.0 — Abre a engine de criação de ação custom no contexto de um KR.
  // V31.2.18 — Adicionado selectedKrIds (multi-select). Pre-marca o KR de origem.
  openCustomActionEngine(areaId, parentProductKrId) {
    const productId = App.state.strategicMapProductId;
    const productKr = StrategicMapEngine.getProductKrs(productId).find(k => k.id === parentProductKrId);
    App.state.customActionEngine = {
      open: true,
      areaId,
      parentProductKrId,
      selectedKrIds: parentProductKrId ? [parentProductKrId] : [],
      originKrCatalogId: productKr?.catalogId || null,
      name: '',
      funnelPoint: '',          // 'TOF' | 'MOF' | 'BOF'
      destSector: areaId,        // default: mesma área
      destFunnelPoint: '',
      channel: '',
      channelOther: ''
    };
    App.render();
  },

  // V31.2.18 — Marca/desmarca um KR da lista de OKRs que essa ação vai mover.
  // V31.2.19 — Se tentar DESMARCAR o KR de origem (parentProductKrId), confirma
  // antes via popup. Se confirmar retirada, o frame da engine fica vermelho com
  // aviso pedindo pra remarcar o KR original (não bloqueia mas avisa o usuário
  // que os KRs ficaram desfigurados da verdade).
  toggleCustomActionEngineKr(krId) {
    const eng = App.state.customActionEngine;
    if (!eng) return;
    const list = Array.isArray(eng.selectedKrIds) ? eng.selectedKrIds.slice() : [];
    const idx = list.indexOf(krId);
    const isRemoving = idx >= 0;
    const isOriginKr = String(krId) === String(eng.parentProductKrId);
    if (isRemoving && isOriginKr) {
      const ok = confirm(
        'Esse KR é o do lugar onde você abriu a engine — ele é o destino "óbvio" dessa ação.\n\n' +
        'Se você retirar, os KRs ficam desfigurados da verdade (a ação que nasceu pra cobrir esse número vai mover outros). ' +
        'Tem certeza que quer desmarcar?'
      );
      if (!ok) return;
    }
    if (isRemoving) list.splice(idx, 1); else list.push(krId);
    App.state.customActionEngine = { ...eng, selectedKrIds: list };
    App.render();
  },

  updateCustomActionEngineField(field, value) {
    if (!App.state.customActionEngine) return;
    App.state.customActionEngine = { ...App.state.customActionEngine, [field]: value };
  },

  closeCustomActionEngine() {
    App.state.customActionEngine = null;
    App.render();
  },

  // V31.2.22 — "Criar" agora SÓ adiciona ao catálogo (sem plugar).
  // Os KRs marcados na engine ficam guardados em pendingKrTargets pra serem
  // usados quando o user clicar "Plugar" no chip em "Como cobrir esse número?".
  // V31.2.24 — Suporta edit mode: se eng.editingCustomId, atualiza o catálogo
  // em vez de criar novo (toggle via Actions.editCoverageChip).
  createCustomAction() {
    const eng = App.state.customActionEngine;
    if (!eng) return;
    const name = String(eng.name || '').trim();
    if (!name) return Utils.toast('Dê um nome à ação.');
    if (!eng.funnelPoint) return Utils.toast('Escolha onde a ação começa.');
    if (!eng.destSector || !eng.destFunnelPoint) return Utils.toast('Escolha pra onde a ação leva.');
    if (!eng.channel) return Utils.toast('Escolha o canal.');
    const productId = App.state.strategicMapProductId;
    const finalChannel = eng.channel === 'Outro' && eng.channelOther ? `Outro: ${String(eng.channelOther).trim()}` : eng.channel;
    const pendingKrTargets = Array.isArray(eng.selectedKrIds) && eng.selectedKrIds.length
      ? eng.selectedKrIds.slice()
      : (eng.parentProductKrId ? [eng.parentProductKrId] : []);
    // V31.2.24 — Edit mode: atualiza catálogo direto e propaga p/ Actions já plugados.
    if (eng.editingCustomId) {
      const existing = (App.state.customActionCatalog || []).find(c => c.id === eng.editingCustomId);
      if (!existing) return Utils.toast('Ação não encontrada no catálogo.');
      // Dedup: outro custom com mesmo nome (case-insensitive) que NÃO seja o editado
      const dup = (App.state.customActionCatalog || []).find(c =>
        c.id !== eng.editingCustomId && String(c.name).toLowerCase() === name.toLowerCase()
      );
      if (dup) return Utils.toast(`Já existe outra ação custom chamada "${dup.name}".`);
      App.state.customActionCatalog = (App.state.customActionCatalog || []).map(c => c.id === eng.editingCustomId ? ({
        ...c,
        name,
        sector: eng.areaId,
        funnel: eng.funnelPoint,
        destinationSector: eng.destSector,
        destinationFunnel: eng.destFunnelPoint,
        channel: finalChannel,
        pendingKrTargets
      }) : c);
      // Propaga pros Actions já criados dessa custom (name + channel visíveis na UI)
      App.state.actions = (App.state.actions || []).map(a => a.strategicCustomActionId === eng.editingCustomId ? ({
        ...a, name, channel: finalChannel
      }) : a);
      App.state.customActionEngine = null;
      App.state.coverageChipSelected = eng.editingCustomId;
      App.save(); App.render();
      return Utils.toast(`Ação "${name}" atualizada.`);
    }
    const result = StrategicMapEngine.addCustomAction({
      name,
      sector: eng.areaId,
      funnel: eng.funnelPoint,
      destinationSector: eng.destSector,
      destinationFunnel: eng.destFunnelPoint,
      channel: finalChannel,
      actionType: 'Outro',
      originProductId: productId,
      originKrCatalogId: eng.originKrCatalogId,
      pendingKrTargets
    });
    if (!result.ok) return Utils.toast(result.error);
    // V31.2.22 — Sobrescreve pendingKrTargets também no caso "revived" (já existia).
    if (result.revived) {
      App.state.customActionCatalog = (App.state.customActionCatalog || []).map(c =>
        c.id === result.action.id ? { ...c, pendingKrTargets } : c
      );
    }
    App.state.customActionEngine = null;
    // Pré-seleciona a chip recém-criada pra abrir a barra Plugar/Desplugar.
    App.state.coverageChipSelected = result.action.id;
    App.save(); App.render();
    Utils.toast(result.revived
      ? `✨ Ação "${result.action.name}" já existia. Selecione em "Como cobrir" + Plugar.`
      : `Ação custom "${name}" criada. Selecione em "Como cobrir" + Plugar.`);
  },

  // V29.3.0 — Ativa custom action já existente no catálogo (clicando no chip).
  activateExistingCustomAction(areaId, customActionId, parentProductKrId) {
    const productId = App.state.strategicMapProductId;
    const result = StrategicMapEngine.activateCustomAction(productId, areaId, customActionId, parentProductKrId);
    if (result?.error) return Utils.toast(result.error);
    App.save(); App.render();
    Utils.toast('Ação plugada.');
  },

  // V31.2.23 — Expande o card plugado pra mostrar engine + chips. Default
  // dos cards plugados é colapsado (visual igual aos desplugados, só com pills).
  // Auto-abre a engine ao expandir (matches "+ Criar ação" mental model).
  expandPluggedKrCard(areaId, pkrId) {
    App.state.strategicKrCardOpen = { ...(App.state.strategicKrCardOpen || {}), [pkrId]: true };
    this.openCustomActionEngine(areaId, pkrId);
  },

  // V31.2.23 — Recolhe o card plugado (fecha engine + limpa seleção de chip).
  collapsePluggedKrCard(pkrId) {
    App.state.strategicKrCardOpen = { ...(App.state.strategicKrCardOpen || {}), [pkrId]: false };
    if (App.state.customActionEngine && App.state.customActionEngine.parentProductKrId === pkrId) {
      App.state.customActionEngine = null;
    }
    App.state.coverageChipSelected = null;
    App.render();
  },

  // V31.2.24 — Abre a engine em modo edição pré-preenchida com os campos da
  // custom selecionada. Salvar atualiza o catálogo (e propaga name/channel
  // pros Actions já plugados dessa custom).
  editCoverageChip(customId, areaId, parentProductKrId) {
    const custom = (App.state.customActionCatalog || []).find(c => c.id === customId);
    if (!custom) return Utils.toast('Ação não encontrada.');
    const isOutro = String(custom.channel || '').startsWith('Outro:');
    App.state.customActionEngine = {
      open: true,
      editingCustomId: customId,
      areaId: areaId || custom.sector,
      parentProductKrId: parentProductKrId || (Array.isArray(custom.pendingKrTargets) ? custom.pendingKrTargets[0] : null),
      selectedKrIds: Array.isArray(custom.pendingKrTargets) ? custom.pendingKrTargets.slice() : (parentProductKrId ? [parentProductKrId] : []),
      originKrCatalogId: custom.origin?.krCatalogId || null,
      name: custom.name || '',
      funnelPoint: custom.funnel || '',
      destSector: custom.destinationSector || custom.sector || '',
      destFunnelPoint: custom.destinationFunnel || '',
      channel: isOutro ? 'Outro' : (custom.channel || ''),
      channelOther: isOutro ? String(custom.channel).slice('Outro:'.length).trim() : ''
    };
    // Garante que o card do KR atual está expandido pra engine ficar visível
    if (parentProductKrId) {
      App.state.strategicKrCardOpen = { ...(App.state.strategicKrCardOpen || {}), [parentProductKrId]: true };
    }
    App.state.coverageChipSelected = null;
    App.render();
  },

  // V31.2.22 — Seleciona/deseleciona uma chip custom em "Como cobrir esse número?".
  // Antes a chip ativava direto; agora seleciona pra mostrar Plugar/Desplugar.
  toggleCoverageChip(customId) {
    const current = App.state.coverageChipSelected;
    App.state.coverageChipSelected = (current === customId ? null : customId);
    App.render();
  },

  // V31.2.22 — Pluga a custom selecionada. Usa pendingKrTargets do catálogo
  // (KRs que o user marcou na engine quando criou). Idempotente: se já tinha
  // sido plugada antes nesta campanha, só vincula KRs faltantes ao Action existente.
  plugCoverageChip(customId, areaId, parentProductKrId) {
    const productId = App.state.strategicMapProductId;
    const campaignId = App.state.strategicMapCampaignId;
    const custom = (App.state.customActionCatalog || []).find(c => c.id === customId);
    if (!custom) return Utils.toast('Ação custom não encontrada.');
    const targets = (Array.isArray(custom.pendingKrTargets) && custom.pendingKrTargets.length)
      ? custom.pendingKrTargets.slice()
      : [parentProductKrId];
    // Se já existe um Action record dessa custom nesta campanha, reusa em vez de duplicar.
    const existing = (App.state.actions || []).find(a =>
      a.strategicCustomActionId === customId && Number(a.campaignId) === Number(campaignId)
    );
    if (existing) {
      const branch = StrategicMapEngine.getBranchMap(campaignId);
      let linkedNow = 0;
      targets.forEach(parentKrId => {
        if (!parentKrId) return;
        (branch?.objectives || []).forEach(obj => {
          (obj.okrs || []).forEach(kr => {
            if (kr.parentProductKrId !== parentKrId) return;
            const linked = (kr.connectedActionIds || []).map(Number).includes(Number(existing.id));
            if (!linked && window.StrategicOkrEngine) {
              StrategicOkrEngine.toggleAction(productId, obj.id, kr.id, existing.id, campaignId);
              linkedNow++;
            }
          });
        });
      });
      App.state.coverageChipSelected = null;
      App.state.customActionEngine = null;
      App.state.strategicKrCardOpen = { ...(App.state.strategicKrCardOpen || {}), [parentProductKrId]: false };
      App.save(); App.render();
      Utils.toast(linkedNow ? `Ação "${custom.name}" plugada em mais ${linkedNow} KR(s).` : `Ação "${custom.name}" já estava plugada nestes KR(s).`);
      return;
    }
    // Primeiro plug: cria Action record + vincula a todos os KRs em targets.
    let actionId = null;
    let activationError = null;
    targets.forEach((krId, idx) => {
      if (!krId) return;
      if (idx === 0) {
        const act = StrategicMapEngine.activateCustomAction(productId, areaId, customId, krId, campaignId);
        if (act?.error) { activationError = act.error; return; }
        actionId = act?.action?.id;
      } else if (actionId && window.StrategicOkrEngine) {
        const branch = StrategicMapEngine.getBranchMap(campaignId);
        (branch?.objectives || []).forEach(obj => {
          (obj.okrs || []).forEach(kr => {
            if (kr.parentProductKrId === krId && !(kr.connectedActionIds || []).map(Number).includes(Number(actionId))) {
              StrategicOkrEngine.toggleAction(productId, obj.id, kr.id, actionId, campaignId);
            }
          });
        });
      }
    });
    if (activationError) return Utils.toast(activationError);
    App.state.coverageChipSelected = null;
    App.state.customActionEngine = null;
    App.state.strategicKrCardOpen = { ...(App.state.strategicKrCardOpen || {}), [parentProductKrId]: false };
    App.save(); App.render();
    Utils.toast(`Ação "${custom.name}" plugada em ${targets.length} KR(s).`);
  },

  // V31.2.22 — Desconecta TODOS os Actions desta custom na campanha atual:
  // remove vínculos com KRs (toggleAction off) + remove os registros de App.state.actions.
  // V31.2.23 — Colapsa o card do parentProductKrId após desplugar.
  unplugCoverageChip(customId, areaId, parentProductKrId) {
    const productId = App.state.strategicMapProductId;
    const campaignId = App.state.strategicMapCampaignId;
    const matching = (App.state.actions || []).filter(a =>
      a.strategicCustomActionId === customId && Number(a.campaignId) === Number(campaignId)
    );
    if (!matching.length) {
      App.state.coverageChipSelected = null;
      App.render();
      return Utils.toast('Essa ação não está plugada nesta campanha.');
    }
    const branch = StrategicMapEngine.getBranchMap(campaignId);
    matching.forEach(action => {
      if (branch && window.StrategicOkrEngine) {
        (branch.objectives || []).forEach(obj => {
          (obj.okrs || []).forEach(kr => {
            if ((kr.connectedActionIds || []).map(Number).includes(Number(action.id))) {
              StrategicOkrEngine.toggleAction(productId, obj.id, kr.id, action.id, campaignId);
            }
          });
        });
      }
      App.state.actions = (App.state.actions || []).filter(a => Number(a.id) !== Number(action.id));
    });
    App.state.coverageChipSelected = null;
    if (parentProductKrId) {
      App.state.strategicKrCardOpen = { ...(App.state.strategicKrCardOpen || {}), [parentProductKrId]: false };
    }
    App.save(); App.render();
    Utils.toast(`Ação desplugada (${matching.length} registro(s) removido(s)).`);
  },

  // V29.3.0 — Toggle balão de ajuda (?) inline nas metas.
  toggleStrategicMetaHelp(key) {
    const current = App.state.strategicMetaHelpOpen || {};
    App.state.strategicMetaHelpOpen = { ...current, [key]: !current[key] };
    App.render();
  },

  // V29.2.0 → V36.10.0 — Etapa 4 (Selecionar Campanha) e 5 (As Ações) fundidas.
  // selectAndAdvanceCampaign mantém a mesma assinatura pra não quebrar callers
  // antigos, mas agora SÓ troca a campanha ativa — não muda zoom (continua em
  // 'campaign'). Sem transition no Djow (cliente continua na mesma etapa).
  selectAndAdvanceCampaign(campaignId) {
    return Actions.selectStrategicCampaign(campaignId);
  },

  selectStrategicCampaign(campaignId) {
    const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(campaignId));
    if (!campaign) return;
    App.state.strategicMapProductId = Number(campaign.productId);
    App.state.strategicMapCampaignId = Number(campaignId);
    App.state.strategicMapMode = 'campaign';
    if (window.StrategicMapEngine) {
      StrategicMapEngine.ensureBranchMap(Number(campaignId), Number(campaign.productId));
      StrategicMapEngine.ensureComercialAreas(Number(campaign.productId), Number(campaign.id));
    }
    App.state.strategicMapZoom = 'campaign';
    App.save(); App.render();
    Utils.toast(`Trabalhando em ${campaign.name}.`);
  },

  // V38.1.28 — Sai do modo "Editando a campanha X" da Etapa 4 do Mapa.
  // Não fecha o Mapa todo — só limpa a campanha ativa e volta pra vista
  // produto (lista de campanhas + empty state "Selecione uma campanha").
  exitStrategicCampaignEdit() {
    App.state.strategicMapCampaignId = null;
    App.state.strategicMapMode = 'product';
    App.save(); App.render();
  },

  // V29.1.3 — "Executar Métricas" = publicar KRs-mãe pros gestores.
  // Botão dourado do CEO. Antes desse botão, KRs-mãe ficam como rascunho do CEO.
  // Abre popup de confirmação (com lista de campanhas plugadas/desplugadas).
  // Se já foi executado antes, abre popup informando + opção de re-publicar (que sobrescreve).
  executeStrategicMetrics() {
    const productId = App.state.strategicMapProductId;
    if (!productId || !window.StrategicMapEngine) return;
    const productKrs = StrategicMapEngine.getProductKrs(productId);
    if (!productKrs.length) return Utils.toast('Adicione pelo menos 1 KR-mãe antes de executar.');
    App.state.strategicExecuteMetricsPopup = true;
    App.render();
    // V29.1.4 — Scroll container do Mapa pro topo pra garantir que popup
    // (centralizado dentro do container scrollable) fica visível na viewport.
    setTimeout(() => {
      const c = document.getElementById('strategicMapScrollContainer');
      if (c) c.scrollTop = 0;
    }, 50);
  },

  // V29.1.3 — Confirma a publicação: marca timestamp + notifica branches via Djow lateral.
  confirmExecuteMetrics() {
    const productId = App.state.strategicMapProductId;
    if (!productId || !window.StrategicMapEngine) return;
    const wasAlreadyExecuted = StrategicMapEngine.isMetricsExecuted(productId);
    StrategicMapEngine.markMetricsExecuted(productId);
    // Notifica todas as branches via chat lateral do Djow.
    const branches = StrategicMapEngine.getBranchesByProduct(productId);
    if (window.DjowStrategicAssistant) {
      const product = (App.state.products || []).find(p => Number(p.id) === Number(productId));
      const productKrs = StrategicMapEngine.getProductKrs(productId);
      const msg = wasAlreadyExecuted
        ? `🔄 CEO atualizou os números do produto "${product?.name || ''}" (${productKrs.length} KR-mãe). Revise se sua campanha precisa plugar números novos.`
        : `🎯 CEO publicou os números do produto "${product?.name || ''}" (${productKrs.length} KR-mãe). Vá pra etapa Campanha do Mapa e pluga os que sua campanha vai contribuir.`;
      branches.forEach(b => {
        DjowStrategicAssistant.append(productId, { role: 'agent', text: msg, ts: new Date().toISOString() });
      });
    }
    App.state.strategicExecuteMetricsPopup = false;
    App.save(); App.render();
    Utils.toast(wasAlreadyExecuted ? '🔄 Métricas re-publicadas. Gestores notificados.' : '🎯 Métricas publicadas. Gestores notificados.');
  },

  dismissExecuteMetricsPopup() {
    App.state.strategicExecuteMetricsPopup = false;
    App.render();
  },

  // V29.1.3 — Destrava o CEO pra trabalhar como gestor de uma branch.
  // V29.1.4 — Sem campanha: modal pra criar nova.
  // V29.2.1 — Smart routing:
  //   - 0 campanhas do produto → modal criar nova
  //   - 1 campanha (plugada ou não) → assume essa, ativa Mapa se preciso, abre direto
  //   - 2+ campanhas → popup pra escolher qual
  // V35.3.5 — Abre o popup de criar nova campanha, independente de quantas
  // já existem no produto. Botão "+ Criar nova campanha" no hub de campanhas
  // deve sempre criar uma nova (semantic da copy), não reabrir a existente.
  openCreateNewCampaignPopup() {
    const productId = App.state.strategicMapProductId;
    if (!productId) return;
    App.state.strategicCreateCampaignPopup = { newName: '' };
    App.render();
    setTimeout(() => {
      const c = document.getElementById('strategicMapScrollContainer');
      if (c) c.scrollTop = 0;
    }, 50);
  },

  unlockCeoAsGestor() {
    const productId = App.state.strategicMapProductId;
    if (!productId || !window.StrategicMapEngine) return;
    const allCampaigns = (App.state.campaigns || []).filter(c => Number(c.productId) === Number(productId));
    if (!allCampaigns.length) {
      // Cenário A: nenhuma campanha no produto → modal criar.
      App.state.strategicCreateCampaignPopup = { newName: '' };
      App.render();
      setTimeout(() => {
        const c = document.getElementById('strategicMapScrollContainer');
        if (c) c.scrollTop = 0;
      }, 50);
      return;
    }
    if (allCampaigns.length === 1) {
      // Cenário B/C: 1 campanha só → ativa Mapa nela (se precisar) + abre como gestor.
      const only = allCampaigns[0];
      const branch = StrategicMapEngine.getBranchMap(only.id);
      if (!branch) {
        // Não plugada ainda — ativa Mapa direto (cria branch).
        Actions.activateStrategicMapForCampaign(only.id);
      } else {
        // Já plugada — abre como gestor direto.
        Utils.toast(`Editando ${only.name} como Gestor.`);
        Actions.openStrategicMapForCampaign(only.id);
      }
      return;
    }
    // Cenário D: 2+ campanhas → popup escolher.
    App.state.strategicUnlockCeoPopup = true;
    App.render();
    setTimeout(() => {
      const c = document.getElementById('strategicMapScrollContainer');
      if (c) c.scrollTop = 0;
    }, 50);
  },

  // V29.1.4 — Cria campanha nova, vincula ao produto, ativa Mapa (cria branch),
  // e abre direto como gestor.
  createCampaignAndUnlockAsGestor() {
    const draft = App.state.strategicCreateCampaignPopup;
    if (!draft) return;
    const productId = App.state.strategicMapProductId;
    const name = String(draft.newName || '').trim();
    if (!name) return Utils.toast('Dê um nome à campanha.');
    if (!productId) return Utils.toast('Produto não selecionado.');
    const campaign = {
      id: Date.now() + Math.floor(Math.random() * 100),
      productId: Number(productId),
      name,
      objective: '',
      createdAt: new Date().toISOString()
    };
    App.state.campaigns = [campaign, ...(App.state.campaigns || [])];
    App.state.strategicCreateCampaignPopup = null;
    App.save();
    // Ativa Mapa nessa campanha (cria branch) e abre como gestor.
    Actions.activateStrategicMapForCampaign(campaign.id);
  },

  updateStrategicCreateCampaignDraft(field, value) {
    const current = App.state.strategicCreateCampaignPopup || {};
    App.state.strategicCreateCampaignPopup = { ...current, [field]: value };
  },

  dismissStrategicCreateCampaignPopup() {
    App.state.strategicCreateCampaignPopup = null;
    App.render();
  },

  // V29.1.3 — Confirma destravagem e abre branch como gestor.
  // V29.2.1 — Se campanha escolhida não tem branch ainda, ativa Mapa nela primeiro.
  confirmUnlockCeoAsGestor(campaignId) {
    App.state.strategicUnlockCeoPopup = false;
    App.save(); App.render();
    const branch = StrategicMapEngine.getBranchMap(Number(campaignId));
    if (!branch) {
      Utils.toast('🔓 Ativando Mapa nesta campanha e editando como Gestor.');
      Actions.activateStrategicMapForCampaign(Number(campaignId));
    } else {
      Utils.toast('🔓 Você está editando como Gestor. Lembre-se: idealmente este trabalho é do dono da campanha.');
      Actions.openStrategicMapForCampaign(Number(campaignId));
    }
  },

  dismissUnlockCeoPopup() {
    App.state.strategicUnlockCeoPopup = false;
    App.render();
  },

  // V29.0.0 — Adiciona um KR-mãe no produto (vista CEO).
  // V31.2.11 — Inicia em estado editing (confirmed=false). Vira confirmed só
  // após user preencher Meta Segura + Meta Avançada e clicar "Confirmar número".
  addProductKrAction(productId, area, catalogId) {
    if (!productId || !window.StrategicMapEngine) return;
    if (this._demoGuard && this._demoGuard('Adicionar KR-mãe')) return;
    const kpi = (StrategicMapEngine.KPI_CATALOG[area] || []).find(k => k.id === catalogId);
    if (!kpi) return Utils.toast('KPI não encontrado.');
    const existing = StrategicMapEngine.getProductKrs(productId).find(k => k.area === area && k.catalogId === catalogId);
    if (existing) return Utils.toast('Este KR-mãe já existe.');
    StrategicMapEngine.addProductKr(productId, {
      area, catalogId,
      name: kpi.name,
      metric: kpi.metric,
      catalogDescription: kpi.description || '',
      isHandoff: Boolean(kpi.handoff),
      current: null,
      targetCommitted: null,
      targetStretch: null,
      period: 90,
      owner: '',
      confirmed: false
    }, 'ceo');
    Actions._ensureStrategicOkrsAreaExpanded(area);
    App.save(); App.render();
    Utils.toast(`KR-mãe "${kpi.name}" ativado. Preencha Atual + Meta Segura + Meta Avançada e confirme.`);
  },

  // V31.2.12 — Modal "Ativar KPI do catálogo": abre janela com 3 inputs (atual,
  // meta segura, meta avançada). Sem período. Confirma → cria productKr com
  // confirmed:true direto, sem etapa intermediária de edição inline.
  openActivateCatalogKrModal(productId, area, catalogId) {
    if (this._demoGuard && this._demoGuard('Ativar KR-mãe do catálogo')) return;
    App.state.activateCatalogKrModal = {
      open: true,
      productId: Number(productId),
      area: String(area),
      catalogId: String(catalogId),
      current: '',
      targetCommitted: '',
      targetStretch: ''
    };
    App.render();
  },
  closeActivateCatalogKrModal() {
    App.state.activateCatalogKrModal = null;
    App.render();
  },
  updateActivateCatalogKrModalField(field, value) {
    if (!App.state.activateCatalogKrModal) return;
    App.state.activateCatalogKrModal[field] = value;
  },
  confirmActivateCatalogKr() {
    const m = App.state.activateCatalogKrModal;
    if (!m || !m.open) return;
    if (!window.StrategicMapEngine) return;
    // KPI pode estar no catálogo curado OU no aprendido (customKpiCatalog)
    const curated = (StrategicMapEngine.KPI_CATALOG[m.area] || []).find(k => k.id === m.catalogId);
    const learned = ((App.state.customKpiCatalog || {})[m.area] || []).find(k => k.id === m.catalogId);
    const kpi = curated || learned;
    if (!kpi) return Utils.toast('KPI não encontrado.');
    const existing = StrategicMapEngine.getProductKrs(m.productId).find(k => k.area === m.area && k.catalogId === m.catalogId);
    if (existing) return Utils.toast('Este KR-mãe já existe.');
    StrategicMapEngine.addProductKr(m.productId, {
      area: m.area,
      catalogId: m.catalogId,
      name: kpi.name,
      metric: kpi.metric,
      catalogDescription: kpi.description || '',
      isHandoff: Boolean(kpi.handoff),
      current: m.current !== '' ? Number(m.current) : null,
      targetCommitted: m.targetCommitted !== '' ? Number(m.targetCommitted) : null,
      targetStretch: m.targetStretch !== '' ? Number(m.targetStretch) : null,
      period: 90,
      owner: '',
      confirmed: true
    }, 'ceo');
    // V36.9.5 — Garante que a frente fica expandida pra cliente ver o novo KR.
    Actions._ensureStrategicOkrsAreaExpanded(m.area);
    App.state.activateCatalogKrModal = null;
    App.save(); App.render();
    Utils.toast(`✓ "${kpi.name}" confirmado em ${m.area}.`);
  },

  // V31.2.12 — Modal "Criar KR-mãe customizado": 5 inputs (nome, unidade,
  // atual, segura, avançada). Sem período. Confirma → cria productKr +
  // adiciona ao customKpiCatalog[area] (base de conhecimento aprendida).
  async openCreateCustomKrModal(productId, area) {
    if (this._demoGuard && this._demoGuard('Criar KR-mãe customizado')) return;
    // V35.8.0-alpha4 — Mapeia area pro setor que o backend espera.
    const setorMap = { marketing: 'marketing', vendas: 'vendas', cs: 'cs' };
    const setor = setorMap[String(area).toLowerCase()] || String(area).toLowerCase();
    App.state.createCustomKrModal = {
      open: true,
      productId: Number(productId),
      area: String(area),
      name: '',
      metric: 'quantidade',
      current: '',
      targetCommitted: '',
      targetStretch: '',
      // V35.8.0-alpha3 — estrutura do Djow no modal (3 zonas + progressivo)
      // V35.8.0-alpha4 — sessionId real do backend
      djow: {
        sessionId: null,
        starting: true,
        analyzing: false,
        falaHistory: [],
        layerOptions: [],
        selectedIds: [],
        numbersUnlocked: false,
        showHistorico: false,
        lastProcessedName: null,
        classification: null,
        krMeta: null
      }
    };
    App.render();

    // Inicia sessão no backend (best-effort). Se falhar, fallback pro
    // mock local funciona — UX não bloqueia.
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/djow-kr-infer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ step: 'start', setor, productId: Number(productId) })
      });
      const data = await r.json();
      if (data.ok && data.sessionId && App.state.createCustomKrModal?.open) {
        App.state.createCustomKrModal.djow.sessionId = data.sessionId;
      }
    } catch (_) { /* offline ou erro — segue com mock local */ }
    if (App.state.createCustomKrModal?.open) {
      App.state.createCustomKrModal.djow.starting = false;
      App.render();
    }
  },
  closeCreateCustomKrModal() {
    App.state.createCustomKrModal = null;
    App.render();
  },
  updateCreateCustomKrModalField(field, value) {
    if (!App.state.createCustomKrModal) return;
    App.state.createCustomKrModal[field] = value;
    // V31.2.13 — Trocar unidade re-renderiza pra refletir prefix/suffix nos inputs.
    if (field === 'metric') App.render();
  },

  // V35.8.0-alpha3 — STUB inicial.
  // V35.8.0-alpha4 — Chama endpoint real /api/djow-kr-infer step='name'.
  // Mantém mock local como fallback se backend falhar (offline, 500, etc).
  async djowProcessKrName(rawName) {
    const m = App.state.createCustomKrModal;
    if (!m || !m.open) return;
    const name = String(rawName || '').trim();
    if (!name) return;
    if (!m.djow) return;
    if (m.djow.lastProcessedName === name) return;
    m.djow.lastProcessedName = name;
    m.djow.analyzing = true;
    App.render();

    // Tenta backend real
    if (m.djow.sessionId) {
      try {
        const token = localStorage.getItem('lj_jwt');
        const r = await fetch('/api/djow-kr-infer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ step: 'name', sessionId: m.djow.sessionId, nome: name })
        });
        const data = await r.json();
        if (data.ok && App.state.createCustomKrModal?.open) {
          const mm = App.state.createCustomKrModal;
          mm.djow.classification = data.classification;
          mm.djow.falaHistory = data.fala_history || [];
          mm.djow.layerOptions = data.layer_options || [];
          mm.djow.selectedIds = [];
          mm.djow.numbersUnlocked = (data.layer_options || []).length === 0;  // manual = libera direto
          mm.djow.krMeta = data.kr_meta || null;
          mm.djow.analyzing = false;
          if (data.kr_meta?.unit) mm.metric = data.kr_meta.unit;
          App.save(); App.render();
          return;
        }
      } catch (_) { /* fallback local */ }
    }

    // Fallback: mock local (mantém usabilidade quando backend indisponível)
    Actions._djowProcessKrNameMockLocal(name);
    if (App.state.createCustomKrModal?.open) {
      App.state.createCustomKrModal.djow.analyzing = false;
      App.render();
    }
  },

  // V35.8.0-alpha4 — Mock local mantido como fallback.
  // V35.11.4 — Deriva { integration_id, field } a partir do id da option
  // do mockLocal (formato "<prefix>::<key>"). Mapping curto pra evitar que
  // selectedSources fique com integration_id=null se mocks futuros forem
  // adicionados sem setar os campos explicitamente.
  _deriveSourceFromId(id) {
    const out = { integration_id: null, field: null };
    if (!id || typeof id !== 'string') return out;
    if (id.startsWith('gads::')) {
      out.integration_id = 'google_ads';
      const key = id.slice(6);
      const map = {
        impressions: 'metrics.impressions',
        clicks: 'metrics.clicks',
        ctr: 'metrics.ctr',
        cpc: 'metrics.average_cpc',
        cpm: 'metrics.average_cpm',
        conversions: 'metrics.conversions',
        receita_atribuida: 'metrics.conversions_value',
        gasto: 'metrics.cost_micros',
        cpa: 'metrics.cost_per_conversion'
      };
      out.field = map[key] || null;
    } else if (id.startsWith('rd::')) {
      out.integration_id = 'rd_station';
      out.field = id.slice(4); // mantém label simbólico ('deals_tag_mql' etc)
    } else if (id.startsWith('hotmart::')) {
      out.integration_id = 'hotmart';
      out.field = id.slice(9);
    } else if (id.startsWith('clickup::')) {
      out.integration_id = 'clickup';
      out.field = id.slice(9);
    }
    return out;
  },

  _djowProcessKrNameMockLocal(name) {
    const m = App.state.createCustomKrModal;
    if (!m?.djow) return;
    const nLower = name.toLowerCase();
    let fala, layerOptions, unit;
    if (/\bltv\b/.test(nLower) || /lifetime value/.test(nLower)) {
      fala = `"${name}" é um número derivado — vou calcular pela fórmula: (Faturamento ÷ Nº Clientes) × Retenção média - CAC. Preciso plugar 4 insumos. Te mostro as opções abaixo.`;
      layerOptions = [
        { id: 'input::faturamento', label: 'Faturamento — vou puxar do Hotmart' },
        { id: 'input::clientes',    label: 'Nº de Clientes — vou puxar do Hotmart' },
        { id: 'input::retencao',    label: 'Tempo médio de retenção (meses)', default_label: 'Sem dado: vou usar 12 meses como padrão' },
        { id: 'input::cac',         label: 'CAC (Custo de Aquisição)',         default_label: 'Crie o KR de CAC pra incluir aqui' }
      ];
      unit = 'reais';
    } else if (/\bmql\b/.test(nLower)) {
      fala = `Reconheci "${name}" como MQL (Marketing Qualified Lead). Você tem RD Station conectado — vou propor puxar daí. Escolhe a opção que faz mais sentido pro seu caso.`;
      layerOptions = [
        { id: 'rd::deals_tag_mql', label: 'RD Station — deals com tag MQL', integration_id: 'rd_station', field: 'deals_with_tag', aggregation: 'count' },
        { id: 'rd::contacts_mql',  label: 'RD Station — contatos no estágio MQL', integration_id: 'rd_station', field: 'contacts_in_stage', aggregation: 'count' },
        { id: 'manual::',          label: 'Manual (você atualiza o valor)' }
      ];
      unit = 'quantidade';
    } else if (/\broas\b/.test(nLower)) {
      // V35.14.6 — GA4 também pode entregar ROAS direto via returnOnAdSpend
      // (calculado pelo Google quando GA4↔Google Ads linkado), ou os 2 insumos
      // separados (purchaseRevenue + googleAdsCost). Prioriza Google Ads se conectado.
      const ga4On = Boolean(App.state.ga4Status?.oauthCompleted);
      const gAdsOn = Boolean(App.state.googleAdsStatus?.oauthCompleted);
      fala = `"${name}" é Return on Ad Spend — derivado. Vou calcular: Receita atribuída ÷ Gasto em mídia.`;
      layerOptions = [];
      if (gAdsOn) {
        layerOptions.push({ id: 'gads::receita_atribuida', label: 'Google Ads — receita das conversões', integration_id: 'google_ads', field: 'metrics.conversions_value', aggregation: 'sum' });
        layerOptions.push({ id: 'gads::gasto',             label: 'Google Ads — gasto em mídia',         integration_id: 'google_ads', field: 'metrics.cost_micros',        aggregation: 'sum' });
      } else if (ga4On) {
        layerOptions.push({ id: 'ga4::returnOnAdSpend',  label: 'GA4 — ROAS direto (já calculado)',        integration_id: 'ga4', field: 'returnOnAdSpend', aggregation: 'sum' });
        layerOptions.push({ id: 'ga4::purchaseRevenue',  label: 'GA4 — receita de compras (insumo)',       integration_id: 'ga4', field: 'purchaseRevenue', aggregation: 'sum' });
        layerOptions.push({ id: 'ga4::googleAdsCost',    label: 'GA4 — gasto Google Ads (insumo)',         integration_id: 'ga4', field: 'googleAdsCost',   aggregation: 'sum' });
      }
      unit = 'numero';
    } else if (/\bnps\b/.test(nLower)) {
      fala = `NPS normalmente vem de Delighted, Wootric ou HubSpot CSAT. Você não tem nenhuma conectada agora. Vou criar como número manual — você atualiza o valor periodicamente. Quando integrar uma dessas, te aviso.`;
      layerOptions = [];   // sem fonte
      unit = 'pontuacao';
    } else if (/alcan|impress/.test(nLower)) {
      fala = `Reconheci "${name}" como Alcance/Impressões. Você tem Google Ads conectado — vou propor puxar daí.`;
      layerOptions = [
        { id: 'gads::impressions', label: 'Google Ads — impressões', integration_id: 'google_ads', field: 'metrics.impressions', aggregation: 'sum' },
        { id: 'manual::',          label: 'Manual (você atualiza o valor)' }
      ];
      unit = 'quantidade';
    } else if (/sess[oõ]es|visitas|tr[aá]fego|visitantes|usu[aá]rios|users/.test(nLower)) {
      // V35.14.6 — GA4 como fonte principal pra tráfego/sessões/usuários.
      const ga4On = Boolean(App.state.ga4Status?.oauthCompleted);
      fala = ga4On
        ? `Reconheci "${name}" como métrica de tráfego/audiência. Você tem GA4 conectado — vou propor puxar daí.`
        : `Reconheci "${name}" como tráfego, mas você não tem GA4 conectado. Vou criar como manual — conecte GA4 em Integrações pra automatizar.`;
      layerOptions = ga4On ? [
        { id: 'ga4::sessions',    label: 'GA4 — sessões totais',     integration_id: 'ga4', field: 'sessions',    aggregation: 'sum' },
        { id: 'ga4::totalUsers',  label: 'GA4 — usuários únicos',    integration_id: 'ga4', field: 'totalUsers',  aggregation: 'sum' },
        { id: 'ga4::newUsers',    label: 'GA4 — usuários novos',     integration_id: 'ga4', field: 'newUsers',    aggregation: 'sum' },
        { id: 'ga4::activeUsers', label: 'GA4 — usuários ativos',    integration_id: 'ga4', field: 'activeUsers', aggregation: 'sum' },
        { id: 'manual::',         label: 'Manual (você atualiza o valor)' }
      ] : [{ id: 'manual::', label: 'Manual (você atualiza o valor)' }];
      unit = 'quantidade';
    } else if (/convers[aã]o|convers[oõ]es/.test(nLower)) {
      // V35.14.6 — Conversões podem vir de Google Ads OU GA4.
      const ga4On = Boolean(App.state.ga4Status?.oauthCompleted);
      const gAdsOn = Boolean(App.state.googleAdsStatus?.oauthCompleted);
      fala = `Reconheci "${name}" como conversões. Vou propor as fontes disponíveis.`;
      layerOptions = [];
      if (gAdsOn) layerOptions.push({ id: 'gads::conversions', label: 'Google Ads — conversões', integration_id: 'google_ads', field: 'metrics.conversions', aggregation: 'sum' });
      if (ga4On)  layerOptions.push({ id: 'ga4::conversions', label: 'GA4 — conversões (key events)', integration_id: 'ga4', field: 'conversions', aggregation: 'sum' });
      layerOptions.push({ id: 'manual::', label: 'Manual (você atualiza o valor)' });
      unit = 'quantidade';
    } else if (/receita|faturamento|vendas|revenue/.test(nLower)) {
      // V35.14.6 — Receita pode vir de Hotmart, Google Ads OU GA4 (e-commerce).
      const ga4On = Boolean(App.state.ga4Status?.oauthCompleted);
      const gAdsOn = Boolean(App.state.googleAdsStatus?.oauthCompleted);
      fala = `Reconheci "${name}" como receita. Vou propor as fontes disponíveis.`;
      layerOptions = [];
      if (gAdsOn) layerOptions.push({ id: 'gads::receita_atribuida', label: 'Google Ads — receita atribuída', integration_id: 'google_ads', field: 'metrics.conversions_value', aggregation: 'sum' });
      if (ga4On)  layerOptions.push({ id: 'ga4::purchaseRevenue', label: 'GA4 — receita de compras (e-commerce)', integration_id: 'ga4', field: 'purchaseRevenue', aggregation: 'sum' });
      if (ga4On)  layerOptions.push({ id: 'ga4::totalRevenue',    label: 'GA4 — receita total (todos eventos)', integration_id: 'ga4', field: 'totalRevenue',    aggregation: 'sum' });
      layerOptions.push({ id: 'manual::', label: 'Manual (você atualiza o valor)' });
      unit = 'reais';
    } else {
      fala = `Não consegui mapear "${name}" em fonte automática. Vou criar como número manual — você atualiza o valor periodicamente.`;
      layerOptions = [];
      unit = 'numero';
    }

    m.djow.falaHistory.push({ at: new Date().toISOString(), text: fala });
    m.djow.layerOptions = layerOptions;
    m.djow.selectedIds = [];
    m.djow.numbersUnlocked = layerOptions.length === 0;  // sem fonte = manual = libera direto
    m.metric = unit;
    App.save(); App.render();
  },

  djowToggleSourceOption(optionId) {
    const m = App.state.createCustomKrModal;
    if (!m?.djow) return;
    const set = new Set((m.djow.selectedIds || []).map(String));
    if (set.has(optionId)) set.delete(optionId); else set.add(optionId);
    m.djow.selectedIds = Array.from(set);
    App.render();
  },

  // V35.8.0-alpha4 — Confirma fontes via backend (com fallback local).
  async djowConfirmSources() {
    const m = App.state.createCustomKrModal;
    if (!m?.djow) return;
    const selectedCount = (m.djow.selectedIds || []).length;
    if (!selectedCount) return Utils.toast('Selecione pelo menos uma fonte.');

    if (m.djow.sessionId) {
      try {
        const token = localStorage.getItem('lj_jwt');
        const r = await fetch('/api/djow-kr-infer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ step: 'select-source', sessionId: m.djow.sessionId, selected_ids: m.djow.selectedIds })
        });
        const data = await r.json();
        if (data.ok && App.state.createCustomKrModal?.open) {
          const mm = App.state.createCustomKrModal;
          mm.djow.falaHistory = data.fala_history || mm.djow.falaHistory;
          mm.djow.numbersUnlocked = true;
          App.render();
          return;
        }
      } catch (_) { /* fallback local */ }
    }

    // V36.0 — Se >1 fonte selecionada E não tem reconciliationRule confirmada,
    // entra em modo "conciliação" (Djow propõe regra). Senão libera números.
    const ids = Array.isArray(m.djow.selectedIds) ? m.djow.selectedIds : [];
    const reconciliationConfirmed = Boolean(m.djow.reconciliationConfirmed);
    if (ids.length > 1 && !reconciliationConfirmed) {
      Actions.djowProposeReconciliation();
      return;
    }
    // Fallback local — 1 fonte só ou rule já confirmada
    m.djow.numbersUnlocked = true;
    m.djow.falaHistory.push({
      at: new Date().toISOString(),
      text: `Boa escolha. Agora libere os números abaixo — atual, meta segura e meta avançada.`
    });
    App.render();
  },

  // V36.0 — Djow Conciliador: analisa fontes selecionadas e propõe uma
  // reconciliationRule. Heurísticas locais (sem chamar backend ainda):
  //   - Se 'hotmart' está entre as fontes E nome envolve vendas/receita →
  //     primary=hotmart, contexto=Google Ads, GA4
  //   - Se Google Ads + GA4 sem Hotmart → primary=Google Ads (paridade
  //     com regra do auto-item RevOps), contexto=GA4
  //   - Senão → sum (comportamento legado, soma todas)
  // Cliente vê a regra proposta e pode ajustar manualmente.
  djowProposeReconciliation() {
    const m = App.state.createCustomKrModal;
    if (!m?.djow) return;
    const ids = Array.isArray(m.djow.selectedIds) ? m.djow.selectedIds : [];
    if (ids.length < 2) {
      // Não precisa conciliar. Vai direto pra números.
      m.djow.numbersUnlocked = true;
      App.render();
      return;
    }
    const opts = Array.isArray(m.djow.layerOptions) ? m.djow.layerOptions : [];
    const selectedOpts = opts.filter(o => ids.includes(o.id));
    const integrations = new Set(selectedOpts.map(o => o.integration_id || Actions._deriveSourceFromId(o.id)?.integration_id));
    const nameLower = String(m.name || '').toLowerCase();

    let rule;
    let proposalText;

    const hasHotmart = integrations.has('hotmart');
    const hasGAds = integrations.has('google_ads');
    const hasGa4 = integrations.has('ga4');
    const sellTopic = /vendas|receita|faturamento|purchases|revenue/.test(nameLower);

    if (hasHotmart && sellTopic) {
      // Hotmart é verdade pra vendas reais
      const hotmartOpt = selectedOpts.find(o => (o.integration_id || Actions._deriveSourceFromId(o.id)?.integration_id) === 'hotmart');
      const contextIds = selectedOpts.filter(o => o.id !== hotmartOpt.id).map(o => o.id);
      rule = {
        mode: 'primary',
        primarySourceId: hotmartOpt.id,
        fallbackSourceIds: [],
        contextSourceIds: contextIds
      };
      proposalText = `Você marcou ${ids.length} fontes mas elas medem coisas parecidas. **Hotmart** é o sistema de pagamento real — vou usar ele como verdade. As outras viram contexto (atribuição) sem entrar na conta.`;
    } else if (hasGAds && hasGa4) {
      const gAdsOpt = selectedOpts.find(o => (o.integration_id || Actions._deriveSourceFromId(o.id)?.integration_id) === 'google_ads');
      const contextIds = selectedOpts.filter(o => o.id !== gAdsOpt.id).map(o => o.id);
      rule = {
        mode: 'primary',
        primarySourceId: gAdsOpt.id,
        fallbackSourceIds: [],
        contextSourceIds: contextIds
      };
      proposalText = `**Google Ads** mede os mesmos dados que o GA4 puxa (com diferença pequena de atribuição). Vou usar Google Ads como verdade — mesma regra do RevOps Aquisição.`;
    } else {
      // Padrão: soma todas. Não há overlap óbvio detectado.
      rule = {
        mode: 'sum',
        primarySourceId: null,
        fallbackSourceIds: [],
        contextSourceIds: []
      };
      proposalText = `${ids.length} fontes selecionadas — vou somar todas porque não detectei sobreposição entre elas. Se alguma é só atribuição (não deve entrar na conta), marque como contexto abaixo.`;
    }

    m.djow.reconciliationRule = rule;
    m.djow.reconciliationProposed = true;
    m.djow.reconciliationConfirmed = false;
    m.djow.falaHistory.push({ at: new Date().toISOString(), text: proposalText });
    App.render();
  },

  setReconciliationMode(mode) {
    const m = App.state.createCustomKrModal;
    if (!m?.djow?.reconciliationRule) return;
    const valid = ['sum', 'primary', 'first-available', 'avg', 'max', 'min'];
    if (!valid.includes(mode)) return;
    m.djow.reconciliationRule.mode = mode;
    // Se vira 'sum'/'avg'/'max'/'min', limpa primary/fallback (não fazem sentido).
    if (!['primary', 'first-available'].includes(mode)) {
      m.djow.reconciliationRule.primarySourceId = null;
      m.djow.reconciliationRule.fallbackSourceIds = [];
    }
    App.render();
  },

  setReconciliationPrimary(sourceId) {
    const m = App.state.createCustomKrModal;
    if (!m?.djow?.reconciliationRule) return;
    m.djow.reconciliationRule.primarySourceId = String(sourceId);
    // Se source virou primary, tira de fallback e de context.
    m.djow.reconciliationRule.fallbackSourceIds = (m.djow.reconciliationRule.fallbackSourceIds || []).filter(id => id !== sourceId);
    m.djow.reconciliationRule.contextSourceIds = (m.djow.reconciliationRule.contextSourceIds || []).filter(id => id !== sourceId);
    App.render();
  },

  toggleReconciliationFallback(sourceId) {
    const m = App.state.createCustomKrModal;
    if (!m?.djow?.reconciliationRule) return;
    const ids = new Set(m.djow.reconciliationRule.fallbackSourceIds || []);
    if (ids.has(sourceId)) ids.delete(sourceId);
    else {
      ids.add(sourceId);
      // Tira de context se tava lá
      m.djow.reconciliationRule.contextSourceIds = (m.djow.reconciliationRule.contextSourceIds || []).filter(id => id !== sourceId);
    }
    m.djow.reconciliationRule.fallbackSourceIds = Array.from(ids);
    App.render();
  },

  toggleReconciliationContext(sourceId) {
    const m = App.state.createCustomKrModal;
    if (!m?.djow?.reconciliationRule) return;
    const ids = new Set(m.djow.reconciliationRule.contextSourceIds || []);
    if (ids.has(sourceId)) ids.delete(sourceId);
    else {
      ids.add(sourceId);
      // Tira de fallback se tava lá; e se era primary, libera primary
      m.djow.reconciliationRule.fallbackSourceIds = (m.djow.reconciliationRule.fallbackSourceIds || []).filter(id => id !== sourceId);
      if (m.djow.reconciliationRule.primarySourceId === sourceId) m.djow.reconciliationRule.primarySourceId = null;
    }
    m.djow.reconciliationRule.contextSourceIds = Array.from(ids);
    App.render();
  },

  confirmReconciliation() {
    const m = App.state.createCustomKrModal;
    if (!m?.djow?.reconciliationRule) return;
    const r = m.djow.reconciliationRule;
    if (['primary', 'first-available'].includes(r.mode) && !r.primarySourceId) {
      return Utils.toast('Escolha qual fonte é a verdade (primária).');
    }
    m.djow.reconciliationConfirmed = true;
    m.djow.numbersUnlocked = true;
    m.djow.falaHistory.push({
      at: new Date().toISOString(),
      text: `Regra confirmada (${r.mode}). Agora libere os números abaixo.`
    });
    App.render();
  },

  // V36.2.0 — Djow Conciliador: chama o backend pra sugerir regra.
  // Heurística primeiro no servidor, LLM como fallback quando ambíguo.
  // Substitui a regra atual no modal e marca origem do palpite.
  async suggestReconciliationWithDjow() {
    const m = App.state.createCustomKrModal;
    if (!m?.djow?.reconciliationRule) return;
    const opts = Array.isArray(m.djow.layerOptions) ? m.djow.layerOptions : [];
    const selectedIds = Array.isArray(m.djow.selectedSourceIds) ? m.djow.selectedSourceIds : [];
    const sources = opts
      .filter(o => selectedIds.includes(o.id))
      .map(o => ({
        id: o.id,
        integration_id: o.integration_id || null,
        field: o.field || null,
        label: o.label || o.id
      }));
    if (sources.length < 2) {
      return Utils.toast('Selecione 2+ fontes pra Djow sugerir regra.');
    }
    m.djow.reconciliationSuggesting = true;
    App.render();
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/djow-reconcile-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          krName: m.name || '',
          krUnit: m.djow.krMeta?.unit || 'numero',
          krDirection: m.djow.krMeta?.direction || 'higher',
          sources
        })
      });
      const data = await r.json();
      if (!data.ok) {
        Utils.toast(data.message || 'Djow não conseguiu sugerir.');
        return;
      }
      m.djow.reconciliationRule = {
        mode: data.mode,
        primarySourceId: data.primarySourceId || null,
        fallbackSourceIds: data.fallbackSourceIds || [],
        contextSourceIds: data.contextSourceIds || []
      };
      m.djow.reconciliationSource = data.usedLLM ? 'djow-ia' : 'djow-heuristic';
      m.djow.reconciliationReasoning = data.reasoning || '';
      m.djow.falaHistory.push({
        at: new Date().toISOString(),
        text: `Djow sugeriu: ${data.reasoning || 'regra atualizada.'} ${data.usedLLM ? '(IA)' : '(heurística)'}`
      });
    } catch (err) {
      Utils.toast(`Djow falhou: ${err.message}`);
    } finally {
      const cur = App.state.createCustomKrModal;
      if (cur?.djow) cur.djow.reconciliationSuggesting = false;
      App.render();
    }
  },

  djowToggleHistorico(show) {
    const m = App.state.createCustomKrModal;
    if (!m?.djow) return;
    m.djow.showHistorico = Boolean(show);
    App.render();
  },
  // V35.10.0-alpha1 — Captura metadados do Djow (nature_id, formula_id,
  // selected_sources, kr_meta) e persiste no KR pra alpha2 puxar o
  // current ao vivo da fonte real. Compat: se sessão Djow não rolou
  // (fallback mock ou backend caiu), djowMeta fica null e KR vira manual.
  async confirmCreateCustomKr() {
    const m = App.state.createCustomKrModal;
    if (!m || !m.open) return;
    const name = String(m.name || '').trim();
    if (!name) return Utils.toast('Digite o nome do KR-mãe.');
    if (!window.StrategicMapEngine) return;

    // V35.10.0-alpha1 — Tenta finalizar sessão Djow (best-effort) pra
    // pegar kr_payload com selected_sources e fórmula. Se backend cair,
    // monta djowMeta com o que o frontend tem na sessão local.
    let djowMeta = null;
    if (m.djow?.sessionId) {
      try {
        const token = localStorage.getItem('lj_jwt');
        // step numbers (se ainda não rodou validação no backend)
        await fetch('/api/djow-kr-infer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            step: 'numbers',
            sessionId: m.djow.sessionId,
            atual: Number(m.current || 0),
            segura: Number(m.targetCommitted || 0),
            avancada: Number(m.targetStretch || 0)
          })
        });
        // step confirm — recebe kr_payload final estruturado pelo backend
        const r = await fetch('/api/djow-kr-infer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ step: 'confirm', sessionId: m.djow.sessionId })
        });
        const data = await r.json();
        if (data.ok && data.kr_payload) {
          djowMeta = {
            classification: data.kr_payload.type || m.djow.classification || 'manual',
            natureId: data.kr_payload.nature_id || null,
            formulaId: data.kr_payload.formula_id || null,
            formulaDisplay: data.kr_payload.formula_display || null,
            formulaSymbolic: data.kr_payload.formula_symbolic || null,
            selectedSources: Array.isArray(data.kr_payload.selected_sources) ? data.kr_payload.selected_sources : [],
            createdSession: data.kr_payload.created_by_djow_session || m.djow.sessionId,
            direction: data.kr_payload.direction || m.djow.krMeta?.direction || 'higher'
          };
        }
      } catch (_) { /* fallback abaixo */ }
    }
    // Fallback local: monta djowMeta com o que tá na sessão do frontend
    if (!djowMeta && m.djow?.layerOptions?.length) {
      const selectedOptions = (m.djow.layerOptions || []).filter(o => (m.djow.selectedIds || []).includes(o.id));
      djowMeta = {
        classification: m.djow.classification || 'atomic',
        natureId: m.djow.krMeta?.nature_id || null,
        formulaId: m.djow.krMeta?.formula_id || null,
        formulaDisplay: m.djow.krMeta?.formula_display || null,
        formulaSymbolic: m.djow.krMeta?.formula_symbolic || null,
        // V35.11.4 — Backstop: se integration_id/field vierem null, deriva
        // do prefixo do id (gads::X, rd::X). Garante que mocks futuros que
        // esqueçam de setar os campos não quebrem o engine ao vivo.
        selectedSources: selectedOptions.map(o => {
          const derived = Actions._deriveSourceFromId(o.id);
          return {
            id: o.id,
            label: o.label,
            integration_id: o.integration_id || derived.integration_id,
            field: o.field || derived.field,
            aggregation: o.aggregation || 'sum'
          };
        }),
        createdSession: m.djow.sessionId || null,
        direction: m.djow.krMeta?.direction || 'higher',
        // V36.0 — Reconciliation rule (sempre presente, default sum).
        reconciliationRule: m.djow.reconciliationRule || { mode: 'sum', primarySourceId: null, fallbackSourceIds: [], contextSourceIds: [] }
      };
    }
    // V36.0 — Garante que mesmo o caminho do backend persista a rule local.
    if (djowMeta && !djowMeta.reconciliationRule && m.djow?.reconciliationRule) {
      djowMeta.reconciliationRule = m.djow.reconciliationRule;
    }

    // 1. Adiciona ao customKpiCatalog (base de conhecimento global)
    const learnedKpi = StrategicMapEngine.addCustomKpiToCatalog(m.area, {
      name,
      metric: m.metric || 'quantidade',
      description: `Custom criado em ${m.area}`,
      handoff: false
    });
    // 2. Cria productKr no produto atual já confirmed + djowMeta
    StrategicMapEngine.addProductKr(m.productId, {
      area: m.area,
      catalogId: learnedKpi ? learnedKpi.id : null,
      name,
      metric: m.metric || 'quantidade',
      catalogDescription: `Custom (aprendido) em ${m.area}`,
      isHandoff: false,
      current: m.current !== '' ? Number(m.current) : null,
      targetCommitted: m.targetCommitted !== '' ? Number(m.targetCommitted) : null,
      targetStretch: m.targetStretch !== '' ? Number(m.targetStretch) : null,
      period: 90,
      owner: '',
      confirmed: true,
      djowMeta
    }, 'ceo');
    // V36.9.5 — Garante que a frente fica expandida pra cliente ver o novo KR.
    Actions._ensureStrategicOkrsAreaExpanded(m.area);
    App.state.createCustomKrModal = null;
    App.save(); App.render();
    Utils.toast(`✓ "${name}" criado${djowMeta ? ' e conectado à fonte' : ''}.`);
  },

  // V35.12.0 — Processa snapshots de TODOS os productKrs uma vez por sessão.
  // Roda em background 200ms após cada session boot. Itera produtos → KRs,
  // computa valor atual via KrLiveValueEngine, e se shouldSnapshot, atualiza
  // os buckets:
  //   - rollPrevious=true: snap atual (de um dia passado) rola pra previous,
  //     novo snap = (value, today)
  //   - rollPrevious=false: 1ª vez, só cria snap = (value, today), previous null
  // Idempotente via flag de sessão (App.state._krSnapshotsProcessedAt).
  _processKrSnapshots() {
    if (!window.KrLiveValueEngine || !window.StrategicMapEngine) return;
    const today = new Date().toISOString().slice(0, 10);
    // Idempotente: se já processou hoje nesta sessão, pula
    if (App.state._krSnapshotsProcessedAt === today) return;
    const products = Array.isArray(App.state.products) ? App.state.products : [];
    let touched = 0;
    products.forEach(p => {
      const krs = StrategicMapEngine.getProductKrs(p.id) || [];
      krs.forEach(kr => {
        const live = KrLiveValueEngine.computeCurrentValue(kr, { productId: p.id });
        if (!live?.shouldSnapshot || !live.newSnapshot) return;
        const patch = {
          snapshotValue: live.newSnapshot.value,
          snapshotDate: live.newSnapshot.date
        };
        // Se rolando: snap atual (que está pra ser sobrescrito) vira previous
        if (live.newSnapshot.rollPrevious) {
          patch.previousSnapshotValue = kr.snapshotValue;
          patch.previousSnapshotDate = kr.snapshotDate;
        }
        StrategicMapEngine.updateProductKr(p.id, kr.id, patch);
        touched++;
      });
    });
    App.state._krSnapshotsProcessedAt = today;
    if (touched > 0) { App.save(); App.render(); }
  },

  // V31.2.11 — Confirma o KR-mãe (estado editing → confirmed verde).
  // Exige Meta Segura e Meta Avançada preenchidas pra confirmar.
  confirmProductKr(productId, krId) {
    if (!productId || !window.StrategicMapEngine) return;
    const kr = StrategicMapEngine.getProductKrs(productId).find(k => k.id === krId);
    if (!kr) return Utils.toast('KR-mãe não encontrado.');
    const hasSafe = Number(kr.targetCommitted || 0) > 0;
    const hasAdv = Number(kr.targetStretch || 0) > 0;
    if (!hasSafe || !hasAdv) return Utils.toast('Preencha Meta Segura E Meta Avançada antes de confirmar.');
    StrategicMapEngine.updateProductKr(productId, krId, { confirmed: true });
    App.save(); App.render();
    Utils.toast(`✓ Número confirmado.`);
  },

  // V31.2.11 — Volta KR confirmado pra estado editing (pra ajustar).
  editProductKr(productId, krId) {
    if (!productId || !window.StrategicMapEngine) return;
    StrategicMapEngine.updateProductKr(productId, krId, { confirmed: false });
    App.save(); App.render();
  },

  // V29.0.0 — Edita campo do KR-mãe.
  // V31.2.11 — Adicionado 'current' aos campos numéricos.
  updateProductKrField(productId, krId, field, value) {
    if (!productId || !window.StrategicMapEngine) return;
    const numericFields = ['current', 'targetCommitted', 'targetStretch', 'period'];
    const patch = {};
    if (numericFields.includes(field)) {
      patch[field] = (value === '' || value === null || value === undefined) ? null : Number(value);
    } else {
      patch[field] = String(value || '');
    }
    StrategicMapEngine.updateProductKr(productId, krId, patch);
    App.save();
  },

  // V29.0.1 — Dono compartilhado da área (Marketing/Vendas/CS) — mesmo across branches.
  setStrategicAreaOwner(productId, areaId, owner) {
    if (!productId || !window.StrategicMapEngine) return;
    // V32.4.4 — Re-render só na transição "todos preenchidos ↔ algum vazio"
    // pra habilitar/desabilitar o botão "Próximo passo" sem perder foco do input.
    const areas = StrategicMapEngine.COMERCIAL_AREAS || [];
    const wasAllSet = areas.every(a => String(StrategicMapEngine.getAreaOwner(productId, a.id) || '').trim());
    StrategicMapEngine.setAreaOwner(productId, areaId, owner);
    App.save();
    const isAllSet = areas.every(a => String(StrategicMapEngine.getAreaOwner(productId, a.id) || '').trim());
    if (wasAllSet !== isAllSet) App.render();
  },

  // V29.0.1 — L (top-down): gestor confirma plugar um KR-mãe que o CEO criou,
  // criando o filho correspondente na branch atual com defaults do catálogo.
  // V29.1.0 — Aceita metas opcionais (D2): plugar + definir meta na mesma tela.
  plugProductKrIntoBranch(productKrId, opts) {
    const productId = App.state.strategicMapProductId;
    const campaignId = App.state.strategicMapCampaignId;
    if (!productId || !campaignId || !window.StrategicMapEngine) return;
    const pkr = (StrategicMapEngine.getProductKrs(productId)).find(k => k.id === productKrId);
    if (!pkr) return Utils.toast('KR-mãe não encontrado.');
    const objective = StrategicMapEngine.getObjectiveByArea(productId, pkr.area, campaignId);
    if (!objective || !window.StrategicOkrEngine) return Utils.toast('Frente não encontrada nesta branch.');
    const kpi = (StrategicMapEngine.KPI_CATALOG[pkr.area] || []).find(k => k.id === pkr.catalogId);
    const o = opts || {};
    // V31.2.17 — Default-fill com valores do pkr-mãe. Antes vinha tudo null (placeholder
    // "piso"/"sonho"). Agora a contribuição da campanha começa igualada à meta-mãe;
    // gestor ajusta pra refletir o pedaço real que essa campanha vai entregar.
    StrategicOkrEngine.add(productId, objective.id, {
      name: pkr.name,
      metric: pkr.metric,
      catalogId: pkr.catalogId,
      catalogDescription: kpi?.description || '',
      isHandoff: Boolean(kpi?.handoff),
      current: o.current != null ? Number(o.current) : (pkr.current != null ? Number(pkr.current) : null),
      targetCommitted: o.targetCommitted != null ? Number(o.targetCommitted) : (pkr.targetCommitted != null ? Number(pkr.targetCommitted) : null),
      targetStretch: o.targetStretch != null ? Number(o.targetStretch) : (pkr.targetStretch != null ? Number(pkr.targetStretch) : null),
      period: o.period != null ? Number(o.period) : 90,
      confirmed: false,
      parentProductKrId: pkr.id
    }, campaignId);
    App.save(); App.render();
    Utils.toast(`"${pkr.name}" plugado nesta campanha (metas herdadas do KR-mãe — ajuste se necessário).`);
  },

  // V29.0.0 — Remove KR-mãe (e desvincula filhas).
  removeProductKrAction(productId, krId) {
    if (!productId || !window.StrategicMapEngine) return;
    StrategicMapEngine.removeProductKr(productId, krId);
    App.save(); App.render();
    Utils.toast('KR-mãe removido. Filhas viraram órfãs.');
  },

  // V28.4.1 — Renomeia a campanha estratégica via UI no header da etapa Ações.
  renameStrategicCampaignAction(newName) {
    const productId = App.state.strategicMapProductId;
    if (!productId || !window.StrategicMapEngine) return;
    const clean = String(newName || '').trim();
    if (!clean) return Utils.toast('Nome não pode ficar vazio.');
    const ok = StrategicMapEngine.renameStrategicCampaign(productId, clean);
    if (ok) {
      App.save(); App.render();
      Utils.toast('Campanha renomeada.');
    }
  },

  // V28.3.0 — Edita campo de uma ação estratégica (dono / cadência / status).
  updateStrategicActionField(actionId, field, value) {
    if (!actionId) return;
    App.state.actions = (App.state.actions || []).map(a =>
      Number(a.id) === Number(actionId) ? { ...a, [field]: (typeof value === 'string' ? value : value) } : a
    );
    App.save();
    if (field === 'strategicStatus' || field === 'strategicCadence') App.render();
  },

  // V28.3.0 — Confirma uma ação (valida que tem dono e cadência).
  // V32.6.6 — Após confirmar, auto-foca na PRÓXIMA ação pendente da mesma frente.
  confirmStrategicAcao(actionId) {
    const action = (App.state.actions || []).find(a => Number(a.id) === Number(actionId));
    if (!action) return;
    if (!String(action.strategicOwner || '').trim()) return Utils.toast('Defina o dono da ação antes de confirmar.');
    if (!action.strategicCadence) return Utils.toast('Defina a cadência da ação antes de confirmar.');
    App.state.actions = (App.state.actions || []).map(a =>
      Number(a.id) === Number(actionId) ? { ...a, strategicConfirmed: true, strategicStatus: a.strategicStatus || 'planned' } : a
    );
    // V32.6.6 — Auto-foca na próxima pendente da mesma frente (campaign + area).
    // Reduz "e agora?" — cliente já vê a próxima decisão exposta.
    const sameFrenteNextPending = (App.state.actions || []).find(a =>
      Number(a.id) !== Number(actionId)
      && Number(a.campaignId) === Number(action.campaignId)
      && a.strategicAreaId === action.strategicAreaId
      && !a.strategicConfirmed
    );
    App.state.strategicActiveActionId = sameFrenteNextPending ? Number(sameFrenteNextPending.id) : null;
    App.save(); App.render();
    Utils.toast(sameFrenteNextPending ? 'Ação confirmada. Próxima pendente em foco.' : 'Ação confirmada. Frente fechada.');
  },

  // V28.3.0 — Reabre uma ação confirmada pra edição.
  // V32.6.6 — Reabrir = trazer pro foco também.
  editStrategicAcao(actionId) {
    App.state.actions = (App.state.actions || []).map(a =>
      Number(a.id) === Number(actionId) ? { ...a, strategicConfirmed: false } : a
    );
    App.state.strategicActiveActionId = Number(actionId);
    App.save(); App.render();
  },

  // V32.6.6 — Coloca uma ação pendente em foco (a anterior fecha automaticamente
  // porque só 1 active por vez). Click no card collapsed dispara isso.
  setStrategicActiveAction(actionId) {
    App.state.strategicActiveActionId = actionId ? Number(actionId) : null;
    App.save(); App.render();
  },

  // V28.3.0 — Remove uma ação estratégica: tira de App.state.actions
  // E remove o vínculo de todos os KRs que apontavam pra ela.
  removeStrategicCatalogAction(actionId) {
    const productId = App.state.strategicMapProductId;
    if (!productId) return;
    const numId = Number(actionId);
    App.state.actions = (App.state.actions || []).filter(a => Number(a.id) !== numId);
    // Limpa connectedActionIds em todos os KRs do produto.
    const map = StrategicMapEngine.getForProduct(productId);
    const objectives = (map?.objectives || []).map(o => ({
      ...o,
      okrs: (o.okrs || []).map(kr => ({
        ...kr,
        connectedActionIds: (kr.connectedActionIds || []).filter(id => Number(id) !== numId)
      }))
    }));
    StrategicMapEngine.save(productId, { objectives });
    App.save(); App.render();
    Utils.toast('Ação removida.');
  },

  // V28.2.1 — Reabre um número confirmado pra edição.
  editStrategicNumero(objectiveId, okrId) {
    const productId = App.state.strategicMapProductId;
    if (!productId || !window.StrategicOkrEngine) return;
    StrategicOkrEngine.update(productId, objectiveId, okrId, { confirmed: false });
    App.save(); App.render();
  },

  syncStrategicOkrsFromOps() {
    const productId = App.state.strategicMapProductId;
    if (!productId || !window.StrategicRevenueBridge) return;
    StrategicRevenueBridge.syncOkrFromOperations(productId);
    App.save(); App.render();
    Utils.toast('OKRs atualizados com leitura operacional.');
  },

  updateStrategicDjowDraft(value) {
    App.state.strategicDjowDraft = String(value || '');
  },

  // V36.9.2 — Toggle das sugestões do Djow (recolhe/expande).
  toggleStrategicDjowHints() {
    App.state.strategicDjowHintsExpanded = !App.state.strategicDjowHintsExpanded;
    App.render();
  },

  // V36.9.3 — Etapa 2 (Comercial): edita uma frente já preenchida. Botão
  // "Editar" abre o form inline; "Pronto" volta pro display.
  startStrategicAreaEdit(areaId) {
    App.state.strategicAreaEditingId = String(areaId || '');
    App.render();
  },

  finishStrategicAreaEdit() {
    App.state.strategicAreaEditingId = null;
    App.save(); App.render();
  },

  // V36.9.5 — Etapa 3 (Os Números): toggle colapso de uma frente e do
  // catálogo dentro dela. Default: tudo fechado (cliente abre só o que mexer).
  toggleStrategicOkrsArea(areaId) {
    const id = String(areaId || '');
    const arr = Array.isArray(App.state.strategicOkrsExpandedAreas) ? App.state.strategicOkrsExpandedAreas : [];
    App.state.strategicOkrsExpandedAreas = arr.includes(id) ? arr.filter(a => a !== id) : [...arr, id];
    App.render();
  },

  toggleStrategicOkrsCatalog(areaId) {
    const id = String(areaId || '');
    const arr = Array.isArray(App.state.strategicOkrsCatalogExpandedAreas) ? App.state.strategicOkrsCatalogExpandedAreas : [];
    App.state.strategicOkrsCatalogExpandedAreas = arr.includes(id) ? arr.filter(a => a !== id) : [...arr, id];
    App.render();
  },

  // V36.9.5 — Quando cliente adiciona/ativa um KR numa frente, AUTO-expande
  // ela (senão o KR fica criado mas escondido atrás do header colapsado).
  _ensureStrategicOkrsAreaExpanded(areaId) {
    const id = String(areaId || '');
    const arr = Array.isArray(App.state.strategicOkrsExpandedAreas) ? App.state.strategicOkrsExpandedAreas : [];
    if (!arr.includes(id)) App.state.strategicOkrsExpandedAreas = [...arr, id];
  },

  // V36.9.9 — Menu popover (engrenagem) de um KR. Click no ícone toggle, click
  // numa opção (Editar/Remover) fecha pelo closeStrategicKrMenu chamado antes.
  toggleStrategicKrMenu(krId) {
    const id = String(krId || '');
    App.state.strategicKrMenuOpen = App.state.strategicKrMenuOpen === id ? null : id;
    App.render();
  },

  closeStrategicKrMenu() {
    App.state.strategicKrMenuOpen = null;
  },

  async askStrategicDjow(prefilled) {
    App.state.strategicDjowDraft = prefilled || '';
    App.render();
    await Actions.sendStrategicDjow();
  },

  async sendStrategicDjow() {
    const productId = App.state.strategicMapProductId;
    const message = String(App.state.strategicDjowDraft || '').trim();
    if (!productId || !message || !window.DjowStrategicAssistant) return;
    DjowStrategicAssistant.append(productId, { role: 'user', text: message, ts: new Date().toISOString() });
    App.state.strategicDjowDraft = '';
    App.state.strategicDjowSending = true;
    App.save(); App.render();
    try {
      const res = await DjowStrategicAssistant.dispatch(productId, message);
      if (res?.text) DjowStrategicAssistant.append(productId, { role: 'agent', text: res.text, source: res.source, ts: new Date().toISOString() });
    } catch (err) {
      DjowStrategicAssistant.append(productId, { role: 'agent', text: `Erro: ${err?.message || err}`, ts: new Date().toISOString() });
    } finally {
      App.state.strategicDjowSending = false;
      App.save(); App.render();
    }
  }
});

// V33.0.0 — Onda 1 Fase 2: actions do tracker.
// Frontend chama /api/visitors-list, /api/visitor-detail, /api/tracker-status,
// /api/tracker-snippet. Sem await em render — actions atualizam state e
// disparam re-render quando dados chegam.
Object.assign(Actions, {
  _trackerFetch(path, init = {}) {
    const token = localStorage.getItem('lj_jwt');
    return fetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers || {})
      }
    }).then(r => r.json());
  },

  async loadVisitorCounts(productId = null) {
    if (App.state.trackerVisitorsCache.loading) return;
    App.state.trackerVisitorsCache = { ...App.state.trackerVisitorsCache, loading: true };
    try {
      const qs = new URLSearchParams({ counts_only: 'true' });
      if (productId) qs.set('product_id', String(productId));
      const data = await this._trackerFetch(`/api/visitors-list?${qs.toString()}`);
      if (!data.ok) {
        // Silent fail: pode ser tenant sem schema novo ainda (master sem default tenant).
        console.warn('[loadVisitorCounts]', data.message);
        App.state.trackerVisitorsCache = {
          counts: { total: 0, byEntityType: { suspect: 0, lead: 0, customer: 0 }, byStage: {} },
          list: [], loadedAt: Date.now(), loading: false, error: data.message
        };
      } else {
        App.state.trackerVisitorsCache = {
          ...App.state.trackerVisitorsCache,
          counts: { total: data.total, byEntityType: data.byEntityType, byStage: data.byStage },
          loadedAt: Date.now(),
          loading: false
        };
      }
    } catch (err) {
      console.error('[loadVisitorCounts]', err);
      App.state.trackerVisitorsCache = { ...App.state.trackerVisitorsCache, loading: false, error: err.message };
    }
    App.render();
  },

  async loadVisitorsList(filters = {}) {
    const qs = new URLSearchParams();
    if (filters.productId) qs.set('product_id', String(filters.productId));
    if (filters.campaignId) qs.set('campaign_id', String(filters.campaignId));
    if (filters.entityType) qs.set('entity_type', filters.entityType);
    if (filters.currentStage) qs.set('current_stage', filters.currentStage);
    if (filters.limit) qs.set('limit', String(filters.limit));
    if (filters.offset) qs.set('offset', String(filters.offset));
    try {
      const data = await this._trackerFetch(`/api/visitors-list?${qs.toString()}`);
      if (!data.ok) return [];
      App.state.trackerVisitorsCache = {
        ...App.state.trackerVisitorsCache,
        list: data.visitors,
        loadedAt: Date.now()
      };
      App.render();
      return data.visitors;
    } catch (err) {
      console.error('[loadVisitorsList]', err);
      return [];
    }
  },

  async loadVisitorDetail(visitorId) {
    if (!visitorId) return;
    App.state.trackerVisitorDetail = { lj_visitor_id: visitorId, data: null, loading: true };
    App.render();
    try {
      const data = await this._trackerFetch(`/api/visitor-detail?lj_visitor_id=${encodeURIComponent(visitorId)}`);
      if (data.ok) {
        App.state.trackerVisitorDetail = { lj_visitor_id: visitorId, data, loading: false };
      } else {
        App.state.trackerVisitorDetail = { lj_visitor_id: visitorId, data: null, loading: false, error: data.message };
      }
    } catch (err) {
      App.state.trackerVisitorDetail = { lj_visitor_id: visitorId, data: null, loading: false, error: err.message };
    }
    App.render();
  },

  closeVisitorDetail() {
    App.state.trackerVisitorDetail = null;
    App.render();
  },

  async loadTrackerStatus(campaignId) {
    if (!campaignId) return;
    try {
      const data = await this._trackerFetch(`/api/tracker-status?campaign_id=${campaignId}`);
      if (data.ok) {
        App.state.trackerStatusByCampaign = {
          ...App.state.trackerStatusByCampaign,
          [campaignId]: { ...data, loadedAt: Date.now() }
        };
        App.render();
      }
    } catch (err) {
      console.error('[loadTrackerStatus]', err);
    }
  },

  async openTrackerWizard(campaignId) {
    if (!campaignId) return Utils.toast('Selecione uma campanha.');
    App.state.trackerWizardOpen = { campaignId, step: 1, snippet: null, trackerToken: null, apiBase: null, copied: false, loading: true };
    App.render();
    try {
      const data = await this._trackerFetch(`/api/tracker-snippet?campaign_id=${campaignId}`);
      if (!data.ok) {
        App.state.trackerWizardOpen = { ...App.state.trackerWizardOpen, loading: false, error: data.message };
      } else {
        App.state.trackerWizardOpen = {
          ...App.state.trackerWizardOpen,
          snippet: data.snippet,
          trackerToken: data.trackerToken,
          apiBase: data.apiBase,
          loading: false
        };
      }
    } catch (err) {
      App.state.trackerWizardOpen = { ...App.state.trackerWizardOpen, loading: false, error: err.message };
    }
    App.render();
  },

  closeTrackerWizard() {
    App.state.trackerWizardOpen = null;
    App.render();
  },

  setTrackerWizardStep(step) {
    if (!App.state.trackerWizardOpen) return;
    App.state.trackerWizardOpen = { ...App.state.trackerWizardOpen, step: Number(step) || 1 };
    App.render();
  },

  async copyTrackerSnippet() {
    const wizard = App.state.trackerWizardOpen;
    if (!wizard?.snippet) return;
    try {
      await navigator.clipboard.writeText(wizard.snippet);
      App.state.trackerWizardOpen = { ...wizard, copied: true };
      Utils.toast('✓ Snippet copiado pra área de transferência.');
      App.render();
      setTimeout(() => {
        if (App.state.trackerWizardOpen) {
          App.state.trackerWizardOpen = { ...App.state.trackerWizardOpen, copied: false };
          App.render();
        }
      }, 2500);
    } catch (err) {
      Utils.toast('Não consegui copiar — selecione e copie manualmente.');
    }
  },

  async testTrackerConnection(campaignId) {
    if (!campaignId) return;
    Utils.toast('Buscando últimos eventos...');
    await Actions.loadTrackerStatus(campaignId);
    const status = App.state.trackerStatusByCampaign[campaignId];
    if (!status) return Utils.toast('Não foi possível verificar agora.');
    if (status.connected) {
      const since = status.lastEventAt ? new Date(status.lastEventAt).toLocaleString('pt-BR') : '—';
      Utils.toast(`✓ Conectado! ${status.totalVisitors} visitor(s). Último evento: ${since}`);
    } else {
      Utils.toast('Aguardando primeiro evento. Acesse a LP pra disparar um page_view.');
    }
  },

  // V33.0.0 — Resultados produto-first.
  openResultProduct(productId) {
    App.state.selectedResultProductId = Number(productId) || null;
    App.state.selectedResultCampaignId = null;
    App.state.selectedActionId = null;
    App.save(); App.render();
  },
  backToResultsProductList() {
    App.state.selectedResultProductId = null;
    App.state.selectedResultCampaignId = null;
    App.state.selectedActionId = null;
    App.save(); App.render();
  },
  toggleResultsClassicMode() {
    App.state.resultsClassicMode = !App.state.resultsClassicMode;
    App.save(); App.render();
  },

  // ---- V33.0.0 ONDA 2 — Hotmart ----
  async loadHotmartStatus() {
    try {
      const data = await this._trackerFetch('/api/hotmart-config');
      App.state.hotmartStatus = data.ok ? data : { ok: false, configured: false, error: data.message };
      App.render();
    } catch (err) {
      App.state.hotmartStatus = { ok: false, configured: false, error: err.message };
      App.render();
    }
  },

  // V36.3.0 — Cache de KPIs Hotmart pra KRs ao vivo (KrLiveValueEngine).
  // Reutiliza /api/hotmart-dashboard-metrics (já agrega tudo no SQL — barato).
  // Loader fica em sessionStorage de cache (1 chamada por sessão por janela).
  async loadHotmartKrCache(opts) {
    const days = Number(opts?.days || 30);
    const productIdHotmart = opts?.productIdHotmart || 'all';
    if (!App.state.hotmartStatus?.configured) {
      App.state.hotmartKrCache = { loaded: false, error: 'not-configured' };
      return;
    }
    const cur = App.state.hotmartKrCache;
    // Throttle: se cache fresh (<5min), não rebusca
    if (cur?.loaded && cur.fetchedAt && Date.now() - cur.fetchedAt < 5 * 60 * 1000) return;
    // Guard contra loops do engine: se já loading OU se falhou nos últimos 30s, skip
    if (cur?.loading) return;
    if (cur?.error && cur.failedAt && Date.now() - cur.failedAt < 30 * 1000) return;
    App.state.hotmartKrCache = { ...(cur || {}), loading: true };
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch(
        `/api/hotmart-dashboard-metrics?product_id_hotmart=${encodeURIComponent(productIdHotmart)}&days=${days}&limit=1`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await r.json();
      if (!data.ok) {
        App.state.hotmartKrCache = { loaded: false, loading: false, error: data.message || 'fetch-failed', failedAt: Date.now() };
        return;
      }
      const k = data.kpis || {};
      App.state.hotmartKrCache = {
        loaded: true,
        fetchedAt: Date.now(),
        days,
        // Counts
        approved_count: Number(k.approvedCount || 0),
        refunded_count: Number(k.refundedCount || 0),
        chargeback_count: Number(k.chargebackCount || 0),
        canceled_count: Number(k.canceledCount || 0),
        billet_count: Number(k.billetCount || 0),
        total_count: Number(k.totalCount || 0),
        // Money (em reais — converte centavos)
        total_revenue: Number(k.totalRevenueCents || 0) / 100,
        total_commission: Number(k.totalCommissionCents || 0) / 100,
        avg_ticket: Number(k.avgTicketCents || 0) / 100,
        // Por produto (se quiser filtrar depois)
        by_product: (data.products || []).map(p => ({
          productIdHotmart: p.productIdHotmart,
          productName: p.productName,
          approved_count: Number(p.purchaseCount || 0),
          total_revenue: Number(p.revenueCents || 0) / 100
        }))
      };
      // Re-render pra KRs Hotmart pegarem o valor recém-carregado.
      if (App.render) App.render();
    } catch (err) {
      App.state.hotmartKrCache = { loaded: false, loading: false, error: err.message, failedAt: Date.now() };
    }
  },

  openHotmartWizard() {
    // V35.6.0-alpha6 — Detecta status existente. Se conectado, abre em modo
    // 'manage' (status card + botões). Se não, abre wizard normal step 1.
    const connected = Boolean(App.state.hotmartStatus?.configured);
    App.state.hotmartWizardOpen = {
      step: 1,
      mode: connected ? 'manage' : 'wizard',
      draft: { hottok: '', productMappings: {} },
      saving: false,
      error: null
    };
    if (!App.state.hotmartStatus) Actions.loadHotmartStatus();
    App.render();
  },

  // V35.6.0-alpha6 — Sai do modo manage e entra no wizard de update (step 2 — atualizar HOTTOK).
  switchHotmartToWizard() {
    if (!App.state.hotmartWizardOpen) return;
    App.state.hotmartWizardOpen.mode = 'wizard';
    App.state.hotmartWizardOpen.step = 2;
    App.render();
  },

  closeHotmartWizard() {
    App.state.hotmartWizardOpen = null;
    App.render();
  },

  // ===== V35.5.0 — Google Ads wizard =====

  async loadGoogleAdsStatus() {
    const token = localStorage.getItem('lj_jwt');
    try {
      const r = await fetch('/api/google-ads-config', { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      App.state.googleAdsStatus = data;
      App.render();
    } catch (_) {}
  },

  openGoogleAdsWizard() {
    // V35.6.0-alpha6 — Detecta status existente. Se conectado (OAuth completo),
    // abre em modo 'manage'. Se não, abre wizard normal step 1.
    const s = App.state.googleAdsStatus || {};
    const connected = Boolean(s.configured && s.oauthCompleted);
    App.state.googleAdsWizard = {
      step: 1,
      mode: connected ? 'manage' : 'wizard',
      draft: {
        clientId: '',
        clientSecret: '',
        developerToken: '',
        loginCustomerId: ''
      },
      saving: false,
      authorizing: false,
      accounts: [],
      selectedCustomerId: null,
      accountSearch: '',
      error: null
    };
    if (!App.state.googleAdsStatus) Actions.loadGoogleAdsStatus();
    App.render();
    // V35.5.0 — Escuta postMessage do popup OAuth pra detectar sucesso/erro
    if (!window._googleAdsOAuthListener) {
      window._googleAdsOAuthListener = true;
      window.addEventListener('message', (ev) => {
        if (ev.data?.type !== 'google-ads-oauth') return;
        if (ev.data.ok) {
          Utils.toast('✓ Google Ads autorizado!');
          Actions.loadGoogleAdsStatus();
          // Avança pro step 3 (escolher conta)
          if (App.state.googleAdsWizard) {
            App.state.googleAdsWizard.step = 3;
            App.state.googleAdsWizard.authorizing = false;
            App.render();
            Actions.loadGoogleAdsAccounts();
          }
        } else {
          const w = App.state.googleAdsWizard;
          if (w) { w.error = ev.data.message || 'OAuth falhou'; w.authorizing = false; App.render(); }
        }
      });
    }
  },

  closeGoogleAdsWizard() {
    App.state.googleAdsWizard = null;
    App.render();
  },

  setGoogleAdsWizardStep(step) {
    if (!App.state.googleAdsWizard) return;
    App.state.googleAdsWizard.step = Number(step) || 1;
    App.render();
  },

  updateGoogleAdsDraft(field, value) {
    if (!App.state.googleAdsWizard) return;
    const w = App.state.googleAdsWizard;
    w.draft[field] = value;
    // Sem render — preserva foco
  },

  async saveGoogleAdsCredentials() {
    const w = App.state.googleAdsWizard;
    if (!w) return;
    const d = w.draft;
    if (!d.clientId || !d.clientSecret || !d.developerToken) {
      return Utils.toast('Preencha Client ID, Client Secret e Developer Token.');
    }
    w.saving = true;
    w.error = null;
    App.render();
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/google-ads-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          clientId: d.clientId.trim(),
          clientSecret: d.clientSecret.trim(),
          developerToken: d.developerToken.trim(),
          loginCustomerId: d.loginCustomerId.trim() || null
        })
      });
      const data = await r.json();
      if (!data.ok) {
        w.error = data.message || 'Falha ao salvar.';
        w.saving = false;
        App.render();
        return;
      }
      w.saving = false;
      w.step = 2; // avança pra Autorizar
      App.render();
      await Actions.loadGoogleAdsStatus();
    } catch (err) {
      w.error = err.message;
      w.saving = false;
      App.render();
    }
  },

  async startGoogleAdsAuthorization() {
    const w = App.state.googleAdsWizard;
    if (!w) return;
    w.authorizing = true;
    w.error = null;
    App.render();
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/google-ads-oauth-init', { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      if (!data.ok) {
        w.error = data.message || 'Falha ao iniciar OAuth.';
        w.authorizing = false;
        App.render();
        return;
      }
      // Abre popup com a URL de auth do Google
      const popup = window.open(data.authUrl, 'google-ads-oauth', 'width=600,height=700');
      if (!popup) {
        w.error = 'Popup bloqueado pelo navegador. Permita popups pra este site e tente de novo.';
        w.authorizing = false;
        App.render();
      }
      // O postMessage do callback vai disparar avanço pro step 3
    } catch (err) {
      w.error = err.message;
      w.authorizing = false;
      App.render();
    }
  },

  async loadGoogleAdsAccounts() {
    const w = App.state.googleAdsWizard;
    if (!w) return;
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/google-ads-list-accounts', { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      if (data.ok) {
        w.accounts = Array.isArray(data.accounts) ? data.accounts : [];
      } else {
        w.error = data.message || 'Não consegui listar contas.';
      }
      App.render();
    } catch (err) {
      w.error = err.message;
      App.render();
    }
  },

  setGoogleAdsSelectedCustomer(customerId) {
    const w = App.state.googleAdsWizard;
    if (!w) return;
    w.selectedCustomerId = String(customerId);
    App.render();
  },

  async confirmGoogleAdsAccount() {
    const w = App.state.googleAdsWizard;
    if (!w || !w.selectedCustomerId) return Utils.toast('Selecione uma conta.');
    w.saving = true;
    App.render();
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/google-ads-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          selectedCustomerId: w.selectedCustomerId,
          accountDescriptiveName: `Customer ${w.selectedCustomerId}`
        })
      });
      const data = await r.json();
      if (!data.ok) {
        w.error = data.message;
        w.saving = false;
        App.render();
        return;
      }
      w.saving = false;
      w.step = 4; // Sucesso final
      App.render();
      await Actions.loadGoogleAdsStatus();
    } catch (err) {
      w.error = err.message;
      w.saving = false;
      App.render();
    }
  },

  async disconnectGoogleAds() {
    if (!confirm('Desconectar Google Ads? Você vai perder o histórico cacheado.')) return;
    try {
      const token = localStorage.getItem('lj_jwt');
      await fetch('/api/google-ads-config', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      Utils.toast('Google Ads desconectado.');
      App.state.googleAdsStatus = { ok: true, configured: false };
      App.render();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // ============================================================================
  // V35.14.2 — Google Analytics 4 (GA4) Actions
  // ============================================================================
  // Espelham padrão das Google Ads Actions (V35.5.0). Endpoints backend já
  // entregues nas V35.14.0 + .1. Wizard mínimo funcional aqui pra OAuth
  // end-to-end. Sub-wizard de customs + fluxo dedicado e-commerce vêm depois.

  async loadGa4Status() {
    const token = localStorage.getItem('lj_jwt');
    try {
      const r = await fetch('/api/ga4-config', { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      App.state.ga4Status = data;
      App.render();
    } catch (_) {}
  },

  openGa4Wizard() {
    const s = App.state.ga4Status || {};
    const connected = Boolean(s.configured && s.oauthCompleted && s.selectedPropertyId);
    App.state.ga4Wizard = {
      step: 1,
      mode: connected ? 'manage' : 'wizard',
      // step 1: businessProfile (leadgen / ecommerce / content / institutional / custom)
      // step 2: credentials (client_id + client_secret)
      // step 3: authorize + pick property
      // step 4: packs + frequency + finish
      businessProfile: s.businessProfile || null,
      draft: {
        clientId: '',
        clientSecret: ''
      },
      selectedPropertyId: s.selectedPropertyId || null,
      selectedPropertyDisplayName: s.propertyDisplayName || null,
      selectedPacks: Array.isArray(s.selectedPacks) && s.selectedPacks.length
        ? [...s.selectedPacks]
        : ['essential'],
      syncFrequencyPerDay: Number(s.syncFrequencyPerDay || 2),
      backfillDays: Number(s.backfillDays || 30),
      saving: false,
      authorizing: false,
      loadingProperties: false,
      error: null
    };
    if (!App.state.ga4Status) Actions.loadGa4Status();
    App.render();
    // Listener pro postMessage do popup OAuth (uma vez por sessão).
    if (!window._ga4OAuthListener) {
      window._ga4OAuthListener = true;
      window.addEventListener('message', (ev) => {
        if (ev.data?.type !== 'ga4-oauth') return;
        if (ev.data.ok) {
          Utils.toast('✓ GA4 autorizado!');
          Actions.loadGa4Status();
          if (App.state.ga4Wizard) {
            App.state.ga4Wizard.step = 3;
            App.state.ga4Wizard.authorizing = false;
            App.render();
            Actions.loadGa4Properties();
          }
        } else {
          const w = App.state.ga4Wizard;
          if (w) { w.error = ev.data.message || 'OAuth falhou'; w.authorizing = false; App.render(); }
        }
      });
    }
  },

  closeGa4Wizard() {
    App.state.ga4Wizard = null;
    App.render();
  },

  setGa4WizardStep(step) {
    if (!App.state.ga4Wizard) return;
    App.state.ga4Wizard.step = Number(step) || 1;
    App.render();
  },

  setGa4BusinessProfile(profile) {
    if (!App.state.ga4Wizard) return;
    const w = App.state.ga4Wizard;
    w.businessProfile = String(profile || 'leadgen');
    // Default packs por perfil (mapeado em lib/ga4-packs.js).
    const defaults = {
      ecommerce:     ['essential', 'ecommerce'],
      leadgen:       ['essential', 'leadgen'],
      content:       ['essential', 'content'],
      institutional: ['essential', 'institutional'],
      custom:        ['essential']
    };
    w.selectedPacks = defaults[w.businessProfile] || ['essential'];
    App.render();
  },

  updateGa4Draft(field, value) {
    if (!App.state.ga4Wizard) return;
    App.state.ga4Wizard.draft[field] = value;
    // Sem render — preserva foco do input
  },

  toggleGa4Pack(packId) {
    if (!App.state.ga4Wizard) return;
    const w = App.state.ga4Wizard;
    if (packId === 'essential') return; // essential é sempre on
    const ids = new Set(w.selectedPacks || []);
    if (ids.has(packId)) ids.delete(packId);
    else ids.add(packId);
    w.selectedPacks = Array.from(ids);
    App.render();
  },

  setGa4SyncFrequency(perDay) {
    if (!App.state.ga4Wizard) return;
    App.state.ga4Wizard.syncFrequencyPerDay = Math.max(0, Math.min(24, Number(perDay) || 2));
    App.render();
  },

  async saveGa4Credentials() {
    const w = App.state.ga4Wizard;
    if (!w) return;
    const d = w.draft;
    if (!d.clientId || !d.clientSecret) {
      return Utils.toast('Preencha Client ID e Client Secret.');
    }
    w.saving = true;
    w.error = null;
    App.render();
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/ga4-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          clientId: d.clientId.trim(),
          clientSecret: d.clientSecret.trim(),
          businessProfile: w.businessProfile || 'leadgen'
        })
      });
      const data = await r.json();
      if (!data.ok) {
        w.error = data.message || 'Falha ao salvar.';
        w.saving = false;
        App.render();
        return;
      }
      w.saving = false;
      w.step = 3; // avança pra Autorizar
      App.render();
      await Actions.loadGa4Status();
    } catch (err) {
      w.error = err.message;
      w.saving = false;
      App.render();
    }
  },

  async startGa4Authorization() {
    const w = App.state.ga4Wizard;
    if (!w) return;
    w.authorizing = true;
    w.error = null;
    App.render();
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/ga4-oauth-init', { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      if (!data.ok) {
        w.error = data.message || 'Falha ao iniciar OAuth.';
        w.authorizing = false;
        App.render();
        return;
      }
      // Abre popup do Google. postMessage do callback vai disparar listener.
      const popup = window.open(data.authUrl, 'ga4-oauth', 'width=720,height=820');
      if (!popup) {
        w.error = 'Popup bloqueado. Permita popups deste site e tente de novo.';
        w.authorizing = false;
        App.render();
      }
    } catch (err) {
      w.error = err.message;
      w.authorizing = false;
      App.render();
    }
  },

  async loadGa4Properties() {
    const w = App.state.ga4Wizard;
    if (w) { w.loadingProperties = true; App.render(); }
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/ga4-list-properties', { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      if (!data.ok) {
        if (w) { w.error = data.message; w.loadingProperties = false; App.render(); }
        return;
      }
      App.state.ga4PropertiesCache = data.properties || [];
      if (w) { w.loadingProperties = false; App.render(); }
    } catch (err) {
      if (w) { w.error = err.message; w.loadingProperties = false; App.render(); }
    }
  },

  selectGa4Property(propertyId, displayName) {
    const w = App.state.ga4Wizard;
    if (!w) return;
    w.selectedPropertyId = String(propertyId);
    w.selectedPropertyDisplayName = String(displayName || propertyId);
    App.render();
  },

  async saveGa4WizardFinal() {
    const w = App.state.ga4Wizard;
    if (!w) return;
    if (!w.selectedPropertyId) return Utils.toast('Escolha uma property antes.');
    w.saving = true;
    w.error = null;
    App.render();
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/ga4-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          selectedPropertyId: w.selectedPropertyId,
          propertyDisplayName: w.selectedPropertyDisplayName,
          businessProfile: w.businessProfile,
          selectedPacks: w.selectedPacks,
          syncFrequencyPerDay: w.syncFrequencyPerDay,
          backfillDays: w.backfillDays
        })
      });
      const data = await r.json();
      if (!data.ok) {
        w.error = data.message;
        w.saving = false;
        App.render();
        return;
      }
      w.saving = false;
      App.render();
      await Actions.loadGa4Status();
      // V35.14.3 — Dispara descoberta de customs. Se houver, vai pra step 6
      // (sub-wizard de customs). Senão pula direto pro step 7 (sucesso) +
      // dispara sync inicial em background.
      const meta = await Actions.loadGa4MetadataForWizard();
      if (meta?.counts?.customs > 0) {
        w.step = 6;
        App.render();
      } else {
        w.step = 7;
        App.render();
        Actions.triggerGa4Sync();
        // V35.14.5 — Se Google Ads também conectado, dispara modal de
        // conciliação após pequeno delay (deixa user ver tela de sucesso 1.5s).
        if (Actions._hasBothGa4AndGoogleAds && Actions._hasBothGa4AndGoogleAds()) {
          setTimeout(() => {
            if (App.state.ga4Wizard) Actions.closeGa4Wizard();
            Actions.openGa4GoogleAdsReconciliationModal();
          }, 1800);
        }
      }
    } catch (err) {
      w.error = err.message;
      w.saving = false;
      App.render();
    }
  },

  async triggerGa4Sync() {
    try {
      Utils.toast('Sincronizando GA4...');
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/ga4-sync-trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({})
      });
      const data = await r.json();
      if (!data.ok) {
        Utils.toast(`Sync falhou: ${data.message || 'erro'}`);
        return;
      }
      const n = data.result?.rowsUpserted || 0;
      Utils.toast(`✓ Sync ok: ${n} linha(s) atualizadas.`);
      await Actions.loadGa4Status();
      await Actions.loadGa4Reports(30);
      // V35.14.6 — Recalcula auto-items RevOps (Google Ads prevalece sobre GA4).
      if (window.RevopsWhitelabelEngine?.recomputeAllAutoItems) {
        try { RevopsWhitelabelEngine.recomputeAllAutoItems(); App.save(); } catch (_) {}
      }
      App.render();
    } catch (err) {
      Utils.toast(`Erro no sync: ${err.message}`);
    }
  },

  setGa4DashboardSubTab(tab) {
    App.state.ga4DashboardSubTab = ['overview', 'breakdown', 'customs'].includes(tab) ? tab : 'overview';
    App.render();
  },

  async loadGa4Reports(days) {
    const d = Math.max(1, Math.min(365, Number(days || 30)));
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch(`/api/ga4-reports-list?days=${d}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      if (!data.ok) return;
      App.state.ga4ReportsCache = {
        rows: data.rows || [],
        loadedAt: Date.now(),
        days: d,
        propertyId: data.propertyId,
        propertyDisplayName: data.propertyDisplayName
      };
      // V35.14.6 — Recalcula auto-items quando reports atualizam.
      if (window.RevopsWhitelabelEngine?.recomputeAllAutoItems) {
        try { RevopsWhitelabelEngine.recomputeAllAutoItems(); App.save(); } catch (_) {}
      }
      App.render();
    } catch (_) {}
  },

  // V36.6.0 — Renova manualmente o token OAuth do RD Marketing.
  // Botão "Renovar agora" no card Marketing conectado. force=true ignora o
  // TTL check, sempre renova.
  async refreshRdMarketingTokenNow() {
    App.state.rdMarketingRefresh = { loading: true, lastResult: null };
    App.render();
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/rd-marketing-refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ force: true })
      });
      const data = await r.json();
      App.state.rdMarketingRefresh = { loading: false, lastResult: data };
      if (data.ok && data.refreshed) {
        Utils.toast('✓ Token RD Marketing renovado.');
      } else if (data.ok) {
        Utils.toast(`Token ainda válido (${data.expires_in_minutes} min restantes).`);
      } else {
        Utils.toast(`Erro: ${data.message || 'Falha ao renovar'}`);
      }
    } catch (err) {
      App.state.rdMarketingRefresh = { loading: false, lastResult: { ok: false, message: err.message } };
      Utils.toast(`Erro: ${err.message}`);
    }
    App.render();
  },

  // V36.5.0 — Health Check Panel: toggle expandir/recuar.
  toggleHealthCheck() {
    if (!App.state.healthCheck) App.state.healthCheck = { items: [], loading: false, expanded: false };
    App.state.healthCheck.expanded = !App.state.healthCheck.expanded;
    App.save();
    App.render();
    // Se expandindo e nunca rodou, dispara check
    if (App.state.healthCheck.expanded && (!App.state.healthCheck.items || !App.state.healthCheck.items.length)) {
      Actions.runHealthCheck();
    }
  },

  // V36.5.0 — Health Check: roda checks em paralelo, popula state.healthCheck.items.
  async runHealthCheck() {
    if (!App.state.healthCheck) App.state.healthCheck = { items: [], loading: false, expanded: false };
    // V36.5.1 — Skip se sessionExpired (não gera ruído de 401 enquanto banner está aberto).
    if (App.state.sessionExpired) {
      App.state.healthCheck.loading = false;
      return;
    }
    App.state.healthCheck.loading = true;
    App.render();
    const token = localStorage.getItem('lj_jwt');
    const auth = { Authorization: `Bearer ${token}` };
    const items = [];

    const safe = async (label, shortDetail, fn) => {
      try {
        const result = await fn();
        items.push({ key: label, label, ...result, shortDetail: result.shortDetail || shortDetail });
      } catch (err) {
        items.push({ key: label, label, status: 'error', detail: err.message, shortDetail });
      }
    };

    await Promise.all([
      safe('Servidor', 'auth-me', async () => {
        const t0 = Date.now();
        const r = await fetch('/api/auth-me', { headers: auth });
        const dt = Date.now() - t0;
        const data = await r.json();
        if (data.authenticated) return { status: 'ok', shortDetail: `${dt}ms`, detail: `auth-me 200 em ${dt}ms` };
        return { status: 'error', shortDetail: 'rejeitou token', detail: 'Servidor rejeitou seu passe (JWT órfão? expirado?)' };
      }),

      safe('Sessão', 'JWT', async () => {
        if (!token) return { status: 'error', shortDetail: 'sem token', detail: 'Não há lj_jwt no localStorage' };
        const payload = JSON.parse(atob(token.split('.')[1]));
        const now = Math.floor(Date.now()/1000);
        const remH = Math.round((payload.exp - now) / 3600);
        if (payload.exp < now) return { status: 'error', shortDetail: 'expirou', detail: 'JWT expirou — relogue' };
        return { status: 'ok', shortDetail: `vale ${remH}h`, detail: `Expira em ${remH}h (${new Date(payload.exp*1000).toLocaleString()})` };
      }),

      safe('State sync', 'GET /api/state-sync', async () => {
        // V36.8.3 — CAUSA RAIZ da perda de dados Sansone (2026-06-08/09): a versão
        // V36.5.0 deste check mandava POST com body { state: { hc_ping: true } }
        // achando que o endpoint ignorava — mas /api/state-sync POST SALVA o body
        // literal no banco, sobrescrevendo state legítimo a cada 30s do panel timer.
        // Agora usa GET (read-only): testa conectividade sem escrever. Bonus: dá
        // pra cruzar a contagem remota com a local pra detectar drift.
        const t0 = Date.now();
        const r = await fetch('/api/state-sync', { headers: auth });
        const dt = Date.now() - t0;
        if (!r.ok) return { status: 'error', shortDetail: `HTTP ${r.status}`, detail: `state-sync retornou ${r.status}` };
        try {
          const data = await r.json();
          const remoteProducts = (data?.state?.products || []).length;
          const localProducts = (App.state?.products || []).length;
          const drift = remoteProducts !== localProducts;
          return {
            status: drift ? 'error' : 'ok',
            shortDetail: drift ? `drift ${localProducts}↔${remoteProducts}` : `${dt}ms · ${remoteProducts} prods`,
            detail: drift
              ? `Local tem ${localProducts} produtos, banco tem ${remoteProducts}. Pode ser sync pendente ou perda.`
              : `GET state-sync 200 em ${dt}ms · ${remoteProducts} produtos no banco`
          };
        } catch (_) {
          return { status: 'ok', shortDetail: `${dt}ms`, detail: `GET state-sync 200 em ${dt}ms (sem JSON parseável)` };
        }
      }),

      safe('Banco', 'tenant DB', async () => {
        const u = App.currentUser || JSON.parse(localStorage.getItem('lj_user') || '{}');
        if (u.tenantDbPlugged) return { status: 'ok', shortDetail: 'próprio', detail: `Tenant ${u.tenantName || u.tenantId} com DB próprio` };
        if (u.tenantId) return { status: 'ok', shortDetail: 'control plane', detail: 'Sem DB próprio (usa control plane)' };
        return { status: 'ok', shortDetail: 'master', detail: 'Master no control plane' };
      }),

      safe('Google Ads', 'OAuth', async () => {
        const s = App.state.googleAdsStatus || {};
        if (!s.configured) return { status: 'not-configured', shortDetail: 'não config', detail: 'Sem credenciais cadastradas' };
        if (!s.oauthCompleted) return { status: 'error', shortDetail: 'OAuth pendente', detail: 'Cadastrou credenciais mas não autorizou' };
        if (!s.selectedCustomerId) return { status: 'error', shortDetail: 'sem Customer', detail: 'OAuth ok mas Customer não foi escolhida' };
        return { status: 'ok', shortDetail: `Customer ${s.selectedCustomerId}`, detail: `Conectado · ${s.lastSyncAt ? 'último sync ' + new Date(s.lastSyncAt).toLocaleString() : 'sem sync ainda'}` };
      }),

      safe('GA4', 'OAuth', async () => {
        const s = App.state.ga4Status || {};
        if (!s.configured) return { status: 'not-configured', shortDetail: 'não config', detail: 'Sem credenciais cadastradas' };
        if (!s.oauthCompleted) return { status: 'error', shortDetail: 'OAuth pendente', detail: 'Cadastrou credenciais mas não autorizou' };
        return { status: 'ok', shortDetail: 'OAuth ativo', detail: `Property ${s.propertyId || '?'}` };
      }),

      safe('Hotmart', 'config', async () => {
        const s = App.state.hotmartStatus || {};
        if (!s.configured) return { status: 'not-configured', shortDetail: 'não config', detail: 'Sem HOTTOK cadastrado' };
        return { status: 'ok', shortDetail: 'conectado', detail: 'HOTTOK cadastrado' };
      }),

      safe('ClickUp', 'OAuth/PAT', async () => {
        const s = App.state.clickupStatus || {};
        if (!s.connected) return { status: 'not-configured', shortDetail: 'não config', detail: 'Sem ClickUp conectado' };
        return { status: 'ok', shortDetail: s.workspaceName || 'conectado', detail: `${s.tokenType === 'oauth' ? 'OAuth' : 'PAT'} · ${s.workspaceName || ''}` };
      }),

      safe('RD Station', 'tokens', async () => {
        // V36.6.1 — Health Check RD: lê 2 fontes pra detectar conexão.
        //   (a) App.state.rdConnectionStatus — populado quando user roda "Testar conexão"
        //       (mais autoritativo: status real testado contra a API)
        //   (b) App.state.integrations.rd — credenciais salvas (heurística por presença)
        // Antes lia App.state.rdCredentials que não existe → mostrava sempre "não config".
        const status = App.state.rdConnectionStatus || {};
        const rd = App.state.integrations?.rd || {};
        const crm = App.state.integrations?.rdCrm || {};
        const testedConn = ['crm_pat', 'crm_oauth', 'marketing_oauth']
          .filter(k => status[k]?.status === 'connected');
        if (testedConn.length) {
          const labels = { crm_pat: 'PAT', crm_oauth: 'CRM', marketing_oauth: 'Mkt' };
          const conn = testedConn.map(k => labels[k]).join('+');
          return { status: 'ok', shortDetail: conn, detail: `Conexões testadas: ${conn}` };
        }
        // Fallback: detecta presença de credenciais (sem teste recente)
        const hasPat = Boolean(crm.pat || rd.pat);
        const hasCrmOauth = Boolean(rd.crmOauth?.accessToken);
        const hasMktOauth = Boolean(rd.accessToken);
        const detected = [hasPat && 'PAT', hasCrmOauth && 'CRM', hasMktOauth && 'Mkt'].filter(Boolean);
        if (detected.length) {
          return { status: 'ok', shortDetail: detected.join('+'), detail: `Credenciais detectadas: ${detected.join('+')} (clique "Testar conexão" no RD pra validar)` };
        }
        return { status: 'not-configured', shortDetail: 'não config', detail: 'Sem RD conectado' };
      })
    ]);

    App.state.healthCheck.items = items;
    App.state.healthCheck.loading = false;
    App.state.healthCheck.checkedAt = new Date().toISOString();
    App.saveLocal();
    App.render();
  },

  // V35.14.7 — Roda lib/tenant-db-schema.sql contra o banco. Idempotente.
  async runAdminMigrateSchema() {
    if (!confirm('Rodar migrate de schema? É idempotente — não destrói dados, só cria/atualiza tabelas e índices.')) return;
    App.state.adminMigrateStatus = { running: true, lastResult: null };
    App.render();
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/admin-migrate-schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({})
      });
      const data = await r.json();
      App.state.adminMigrateStatus = { running: false, lastResult: data };
      App.render();
      if (data.ok) {
        Utils.toast(`✓ Schema atualizado em ${data.durationMs}ms.`);
        // Recarrega status das integrações que podem ter dependido das tabelas novas.
        if (Actions.loadGa4Status) setTimeout(() => Actions.loadGa4Status(), 200);
      } else {
        Utils.toast(`Migrate falhou: ${data.message || 'erro'}`);
      }
    } catch (err) {
      App.state.adminMigrateStatus = { running: false, lastResult: { ok: false, message: err.message } };
      App.render();
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  async disconnectGa4() {
    if (!confirm('Desconectar GA4? Você vai perder o histórico cacheado.')) return;
    try {
      const token = localStorage.getItem('lj_jwt');
      await fetch('/api/ga4-config', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      Utils.toast('GA4 desconectado.');
      App.state.ga4Status = { ok: true, configured: false };
      App.state.ga4PropertiesCache = null;
      App.state.ga4ReportsCache = null;
      App.state.ga4CustomsCache = null;
      App.render();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V35.14.3 — GA4 Custom Dimensions/Metrics Discovery
  // Chama /api/ga4-metadata pra descobrir o que o cliente CRIOU no GA4 dele
  // que não está nas listas nativas. Pra cada custom, cliente pode:
  //   - habilitar/desabilitar (entra no sync ou não)
  //   - dar nome amigável (substitui o apiName técnico no dashboard)
  //   - marcar categoria opcional
  //   - marcar se vira KR disponível pro Djow
  async loadGa4MetadataForWizard() {
    const w = App.state.ga4Wizard;
    if (w) { w.loadingCustoms = true; w.error = null; App.render(); }
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/ga4-metadata', { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      if (!data.ok) {
        if (w) { w.error = data.message; w.loadingCustoms = false; App.render(); }
        return { customs: [], counts: { customs: 0 } };
      }
      const customs = data.customs || [];
      App.state.ga4CustomsCache = customs;
      // Inicializa customsDraft no wizard: cada custom começa marcado SE for métrica
      // (mais provável que entre em KR/dashboard) e desmarcado se for dimensão.
      // Cliente pode mudar tudo manualmente.
      if (w) {
        const existing = (App.state.ga4Status?.customSettings) || {};
        w.customsDraft = {};
        customs.forEach(c => {
          const prev = existing[c.apiName] || {};
          w.customsDraft[c.apiName] = {
            enabled: prev.enabled != null ? Boolean(prev.enabled) : c.kind === 'metric',
            kind: c.kind,
            friendlyName: prev.friendlyName || c.uiName || c.apiName,
            category: prev.category || c.category || (c.kind === 'metric' ? 'Métrica' : 'Dimensão'),
            asKr: prev.asKr != null ? Boolean(prev.asKr) : false,
            apiName: c.apiName,
            description: c.description || ''
          };
        });
        w.detectedCustomsCount = customs.length;
        w.loadingCustoms = false;
        App.render();
      }
      return { customs, counts: data.counts || { customs: customs.length } };
    } catch (err) {
      if (w) { w.error = err.message; w.loadingCustoms = false; App.render(); }
      return { customs: [], counts: { customs: 0 } };
    }
  },

  toggleGa4Custom(apiName) {
    const w = App.state.ga4Wizard;
    if (!w || !w.customsDraft || !w.customsDraft[apiName]) return;
    w.customsDraft[apiName].enabled = !w.customsDraft[apiName].enabled;
    App.render();
  },

  setGa4CustomConfig(apiName, field, value) {
    const w = App.state.ga4Wizard;
    if (!w || !w.customsDraft || !w.customsDraft[apiName]) return;
    if (field === 'asKr') {
      w.customsDraft[apiName].asKr = Boolean(value);
      App.render();
    } else {
      w.customsDraft[apiName][field] = String(value || '');
      // Sem render — preserva foco do input em campos text
    }
  },

  toggleGa4CustomExpanded(apiName) {
    const w = App.state.ga4Wizard;
    if (!w) return;
    w.customExpanded = w.customExpanded === apiName ? null : apiName;
    App.render();
  },

  async saveGa4Customs() {
    const w = App.state.ga4Wizard;
    if (!w || !w.customsDraft) return;
    w.saving = true;
    w.error = null;
    App.render();
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/ga4-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ customSettings: w.customsDraft })
      });
      const data = await r.json();
      if (!data.ok) {
        w.error = data.message;
        w.saving = false;
        App.render();
        return;
      }
      w.saving = false;
      w.step = 7; // Sucesso final
      App.render();
      await Actions.loadGa4Status();
      // Re-dispara sync pra incluir customs marcados como enabled
      Actions.triggerGa4Sync();
    } catch (err) {
      w.error = err.message;
      w.saving = false;
      App.render();
    }
  },

  // V35.14.5 — Detecta alertas GA4 pro sininho.
  // Categorias:
  //   - 'ga4-sync-failed' (critical): last_sync_result tem error ou perChunk com falhas
  //   - 'ga4-customs-new' (warning): availableCustoms tem item que não está em customSettings
  //   - 'ga4-stale' (warning): última sync > 48h (cliente esperava 2x/dia)
  _getGa4Alerts() {
    const alerts = [];
    const s = App.state.ga4Status;
    if (!s || !s.configured) return alerts;
    if (!s.oauthCompleted || !s.selectedPropertyId) return alerts;

    // 1. Sync falhou
    const lastResult = s.lastSyncResult;
    if (lastResult && typeof lastResult === 'object') {
      const perChunk = Array.isArray(lastResult.perChunk) ? lastResult.perChunk : [];
      const errors = perChunk.filter(c => c && c.error);
      if (errors.length > 0) {
        alerts.push({
          id: 'ga4-sync-failed',
          icon: 'alert-triangle',
          title: `GA4 sync falhou (${errors.length} chunk${errors.length === 1 ? '' : 's'})`,
          description: errors[0].error || 'Verifique se OAuth ainda está válido e cota da Data API não estourou.',
          action: "Actions.triggerGa4Sync()",
          actionLabel: 'Tentar de novo',
          severity: 'critical'
        });
      }
    }

    // 2. Custom novo detectado
    const available = Array.isArray(s.availableCustoms) ? s.availableCustoms : [];
    const configured = s.customSettings || {};
    const newCustoms = available.filter(c => !configured[c.apiName]);
    if (newCustoms.length > 0) {
      alerts.push({
        id: 'ga4-customs-new',
        icon: 'sparkles',
        title: `${newCustoms.length} custom novo${newCustoms.length === 1 ? '' : 's'} no GA4`,
        description: `Você criou ${newCustoms.length === 1 ? 'um campo customizado' : `${newCustoms.length} campos customizados`} no GA4 que ainda não estão configurados aqui. Configure pra entrar no sync.`,
        action: "Actions.openGa4Wizard(); if (App.state.ga4Wizard) { App.state.ga4Wizard.step = 6; Actions.loadGa4MetadataForWizard(); App.render(); }",
        actionLabel: 'Configurar agora',
        severity: 'warning'
      });
    }

    // 3. Sync atrasado (>48h sem sync)
    if (s.lastSyncAt) {
      const ageMs = Date.now() - new Date(s.lastSyncAt).getTime();
      const ageHours = ageMs / (1000 * 60 * 60);
      if (ageHours > 48 && Number(s.syncFrequencyPerDay) > 0) {
        alerts.push({
          id: 'ga4-stale',
          icon: 'clock',
          title: `GA4 sem sync há ${Math.floor(ageHours)}h`,
          description: 'Esperava 2× ao dia mas o último sync foi há muito tempo. Pode ser cota da API ou OAuth expirado.',
          action: "Actions.triggerGa4Sync()",
          actionLabel: 'Forçar sync',
          severity: 'warning'
        });
      }
    }

    return alerts;
  },

  // Helper público — count agregado pra badge do sininho.
  getGa4AlertCount() {
    if (!Actions._getGa4Alerts) return 0;
    return Actions._getGa4Alerts().length;
  },

  // V35.14.5 — Modal de conciliação Google Ads x GA4.
  // Dispara quando wizard GA4 conclui (após save final) E o LJ detecta que
  // Google Ads também está conectado. Mostra a regra do RevOps e oferece
  // opção de desligar 1 dos dois pra evitar dupla contagem.
  openGa4GoogleAdsReconciliationModal() {
    App.state.ga4GoogleAdsReconciliation = {
      open: true,
      step: 'inform' // 'inform' | 'choose'
    };
    App.render();
  },

  closeGa4GoogleAdsReconciliationModal() {
    App.state.ga4GoogleAdsReconciliation = null;
    App.render();
  },

  setGa4ReconciliationStep(step) {
    if (!App.state.ga4GoogleAdsReconciliation) return;
    App.state.ga4GoogleAdsReconciliation.step = step;
    App.render();
  },

  // Helper — checa se ambos GA4 e Google Ads estão conectados.
  _hasBothGa4AndGoogleAds() {
    const ga4 = App.state.ga4Status || {};
    const gAds = App.state.googleAdsStatus || {};
    const ga4On = Boolean(ga4.configured && ga4.oauthCompleted && ga4.selectedPropertyId);
    const gAdsOn = Boolean(gAds.configured && gAds.oauthCompleted);
    return ga4On && gAdsOn;
  },

  setHotmartWizardStep(step) {
    if (!App.state.hotmartWizardOpen) return;
    App.state.hotmartWizardOpen = { ...App.state.hotmartWizardOpen, step: Number(step) || 1 };
    App.render();
  },

  updateHotmartDraft(field, value) {
    if (!App.state.hotmartWizardOpen) return;
    const draft = { ...(App.state.hotmartWizardOpen.draft || {}) };
    draft[field] = value;
    App.state.hotmartWizardOpen = { ...App.state.hotmartWizardOpen, draft };
    // V35.1.0 — toggles e seletor de janela precisam render; inputs de texto não
    if (field === 'oauthExpanded' || field === 'syncWindowDays') App.render();
  },

  async saveHotmartConfig() {
    const w = App.state.hotmartWizardOpen;
    if (!w?.draft?.hottok) return Utils.toast('Cole o HOTTOK primeiro.');
    App.state.hotmartWizardOpen = { ...w, saving: true, error: null };
    App.render();
    try {
      // V35.1.0 — Envia OAuth + janela quando preenchidos (todos opcionais)
      const body = {
        hottok: w.draft.hottok.trim(),
        productMappings: w.draft.productMappings || {}
      };
      if (w.draft.clientId)      body.clientId      = String(w.draft.clientId).trim();
      if (w.draft.clientSecret)  body.clientSecret  = String(w.draft.clientSecret).trim();
      if (w.draft.syncWindowDays) body.syncWindowDays = Number(w.draft.syncWindowDays);

      const data = await this._trackerFetch('/api/hotmart-config', {
        method: 'POST',
        body: JSON.stringify(body)
      });
      if (!data.ok) {
        App.state.hotmartWizardOpen = { ...App.state.hotmartWizardOpen, saving: false, error: data.message };
        App.render();
        return;
      }
      Utils.toast('✓ Hotmart conectado.');
      await Actions.loadHotmartStatus();
      App.state.hotmartWizardOpen = { ...App.state.hotmartWizardOpen, saving: false, error: null, step: 3 };
      App.render();
      // V35.1.0 — Se OAuth foi configurado, dispara sync inicial em background
      if (body.clientId && body.clientSecret) {
        Actions.syncHotmartHistory(body.syncWindowDays || 90);
      }
    } catch (err) {
      App.state.hotmartWizardOpen = { ...App.state.hotmartWizardOpen, saving: false, error: err.message };
      App.render();
    }
  },

  async disconnectHotmart() {
    if (!confirm('Desconectar Hotmart? O LJ vai parar de receber compras desta integração.')) return;
    try {
      await this._trackerFetch('/api/hotmart-config', { method: 'DELETE' });
      Utils.toast('Hotmart desconectado.');
      App.state.hotmartStatus = { ok: true, configured: false };
      App.render();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V34.0.0 Onda 2 — Bancos de Leads CRUD frontend.
  async loadLeadBanks() {
    if (App.state.leadBanksCache?.loading) return;
    App.state.leadBanksCache = { ...App.state.leadBanksCache, loading: true };
    try {
      const data = await this._trackerFetch('/api/lead-banks');
      if (data.ok) {
        App.state.leadBanksCache = { banks: data.banks || [], loadedAt: Date.now(), loading: false };
      } else {
        App.state.leadBanksCache = { banks: [], loadedAt: Date.now(), loading: false, error: data.message };
      }
    } catch (err) {
      App.state.leadBanksCache = { ...App.state.leadBanksCache, loading: false, error: err.message };
    }
    App.render();
  },

  openLeadBankEditModal(bankId = null) {
    if (bankId) {
      const bank = (App.state.leadBanksCache?.banks || []).find(b => Number(b.id) === Number(bankId));
      if (!bank) return Utils.toast('Banco não encontrado.');
      App.state.leadBankEditModal = { mode: 'edit', bank: { ...bank }, saving: false, error: null };
    } else {
      App.state.leadBankEditModal = { mode: 'create', bank: { name: '', description: '', is_default: false }, saving: false, error: null };
    }
    App.render();
  },

  closeLeadBankEditModal() {
    App.state.leadBankEditModal = null;
    App.render();
  },

  updateLeadBankDraft(field, value) {
    if (!App.state.leadBankEditModal) return;
    const bank = { ...(App.state.leadBankEditModal.bank || {}) };
    bank[field] = (field === 'is_default') ? Boolean(value) : value;
    App.state.leadBankEditModal = { ...App.state.leadBankEditModal, bank };
    // não chama render — perde foco do input
  },

  async saveLeadBank() {
    const m = App.state.leadBankEditModal;
    if (!m) return;
    const name = String(m.bank?.name || '').trim();
    if (!name) return Utils.toast('Nome do banco obrigatório.');

    App.state.leadBankEditModal = { ...m, saving: true, error: null };
    App.render();

    const body = {
      name,
      description: String(m.bank?.description || '').trim() || null,
      is_default: Boolean(m.bank?.is_default)
    };
    const method = m.mode === 'edit' ? 'PATCH' : 'POST';
    const url = m.mode === 'edit' ? `/api/lead-banks?id=${m.bank.id}` : '/api/lead-banks';

    try {
      const data = await this._trackerFetch(url, { method, body: JSON.stringify(body) });
      if (!data.ok) {
        App.state.leadBankEditModal = { ...App.state.leadBankEditModal, saving: false, error: data.message };
        App.render();
        return;
      }
      Utils.toast(m.mode === 'edit' ? '✓ Banco atualizado.' : `✓ Banco "${data.bank.name}" criado.`);
      App.state.leadBankEditModal = null;
      // V34.6.g hotfix — Se modal de Import está aberto e ainda não tem banco
      // selecionado, auto-seleciona o recém-criado pra desbloquear o botão "Importar".
      // Antes: <select> mostrava o banco visualmente (default HTML) mas state ficava null.
      if (m.mode === 'create' && data.bank?.id && App.state.showLeadImportModal && !App.state.leadImportBankId) {
        App.state.leadImportBankId = Number(data.bank.id);
      }
      await Actions.loadLeadBanks(); // refetch
    } catch (err) {
      App.state.leadBankEditModal = { ...App.state.leadBankEditModal, saving: false, error: err.message };
      App.render();
    }
  },

  async deleteLeadBank(bankId) {
    const bank = (App.state.leadBanksCache?.banks || []).find(b => Number(b.id) === Number(bankId));
    if (!bank) return Utils.toast('Banco não encontrado.');
    const msg = `Apagar o banco "${bank.name}"? Os ${bank.visitor_count || 0} lead(s) dele continuam no sistema (apenas sem banco vinculado).`;
    if (!confirm(msg)) return;
    try {
      const data = await this._trackerFetch(`/api/lead-banks?id=${bankId}`, { method: 'DELETE' });
      if (data.ok) {
        Utils.toast(data.message || '✓ Banco removido.');
        await Actions.loadLeadBanks();
      } else {
        Utils.toast(`Erro: ${data.message}`);
      }
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V34.0.0 Onda 4 — Buscador server-side com seleção de bancos.
  //
  // Fluxo:
  //   1. User clica Buscar → openSearchBankSelector() abre modal
  //   2. User marca bancos OR clica Todos → confirmSearchBankSelection()
  //   3. Roda _runVisitorSearch() que chama /api/visitors-search
  //   4. Resultado vira visitorSearchResults, ProfileFinder roda Djow em cima
  //
  async openSearchBankSelector(pendingAction = 'search') {
    if (!App.state.leadBanksCache?.loadedAt) {
      await Actions.loadLeadBanks();
    }
    const banks = App.state.leadBanksCache?.banks || [];
    if (!banks.length) {
      Utils.toast('Crie um banco de leads antes de buscar.');
      return Actions.openLeadBankEditModal();
    }
    // Pre-popula seleção: se já existe busca anterior, mantém os bancos dela;
    // caso contrário, default = Todos (null).
    const previous = App.state.visitorSearchResults?.bankIds;
    App.state.searchBankSelectionModal = {
      open: true,
      selected: Array.isArray(previous) ? [...previous] : null,
      pendingAction
    };
    App.render();
  },

  closeSearchBankSelector() {
    App.state.searchBankSelectionModal = { open: false, selected: null, pendingAction: null };
    App.render();
  },

  toggleSearchBank(bankId) {
    const m = App.state.searchBankSelectionModal;
    if (!m?.open) return;
    const id = Number(bankId);
    const current = Array.isArray(m.selected) ? [...m.selected] : null;
    if (current === null) {
      // Saindo de "Todos" → marca só este banco
      App.state.searchBankSelectionModal = { ...m, selected: [id] };
    } else if (current.includes(id)) {
      const next = current.filter(b => b !== id);
      App.state.searchBankSelectionModal = { ...m, selected: next.length ? next : null };
    } else {
      App.state.searchBankSelectionModal = { ...m, selected: [...current, id] };
    }
    App.render();
  },

  toggleAllSearchBanks() {
    const m = App.state.searchBankSelectionModal;
    if (!m?.open) return;
    // Toggle: se não está em "Todos", vai pra "Todos" (null). Se já está, mantém vazio.
    const goingToAll = m.selected !== null;
    App.state.searchBankSelectionModal = { ...m, selected: goingToAll ? null : [] };
    App.render();
  },

  async confirmSearchBankSelection() {
    const m = App.state.searchBankSelectionModal;
    if (!m?.open) return;
    const selected = m.selected; // null OR array
    const pendingAction = m.pendingAction;
    // Validação: array vazio = sem banco escolhido → bloqueia.
    if (Array.isArray(selected) && selected.length === 0) {
      Utils.toast('Selecione ao menos um banco ou marque "Todos".');
      return;
    }
    App.state.searchBankSelectionModal = { open: false, selected: null, pendingAction: null };
    await Actions._runVisitorSearch(selected);
    if (pendingAction === 'search') {
      // Roda Djow após resultados carregarem (se há query)
      const q = String(App.state.profileQuery || '').trim();
      if (q) await Actions.djowSearchProfile();
    }
  },

  async _runVisitorSearch(bankIds) {
    App.state.visitorSearchResults = {
      ...App.state.visitorSearchResults,
      loading: true,
      error: null
    };
    App.render();
    try {
      const data = await this._trackerFetch('/api/visitors-search', {
        method: 'POST',
        body: JSON.stringify({ bank_ids: bankIds })
      });
      if (!data.ok) {
        App.state.visitorSearchResults = { visitors: [], bankIds, bankNames: [], loadedAt: Date.now(), loading: false, error: data.message };
        Utils.toast(`Erro: ${data.message}`);
        App.render();
        return;
      }
      const banks = App.state.leadBanksCache?.banks || [];
      const bankNames = bankIds
        ? bankIds.map(id => (banks.find(b => Number(b.id) === Number(id))?.name) || `Banco #${id}`)
        : ['Todos'];
      const normalized = (data.visitors || []).map(v => Actions._normalizeVisitorAsLead(v));
      App.state.visitorSearchResults = {
        visitors: normalized,
        bankIds,
        bankNames,
        loadedAt: Date.now(),
        loading: false,
        error: null
      };
      Utils.toast(`${normalized.length} lead(s) carregado(s) ${bankIds ? `de ${bankNames.length} banco(s)` : 'de todos os bancos'}.`);
    } catch (err) {
      App.state.visitorSearchResults = { visitors: [], bankIds, bankNames: [], loadedAt: Date.now(), loading: false, error: err.message };
      Utils.toast(`Erro: ${err.message}`);
    } finally {
      App.render();
    }
  },

  // Normaliza row de lj_visitors → formato Lead que ProfileFinder/UI consome.
  // ProfileFinder espera: id, name, email, phone, idade, sexo, estado, cidade,
  // estadoCivil, faixaSalarial, behaviorTags[], temperature, globalScore.
  _normalizeVisitorAsLead(v) {
    const tags = Array.isArray(v.tags) ? v.tags : [];
    const score = Number(v.global_score || 0);
    const temp = score >= 70 ? 'Quente' : (score >= 40 ? 'Morno' : 'Frio');
    return {
      id: v.lj_visitor_id || String(v.id),
      internalId: v.lj_visitor_id,
      name: v.name || '(sem nome)',
      email: v.email || '',
      phone: v.phone || '',
      idade: 0,
      sexo: '',
      genero: '',
      estado: '',
      cidade: '',
      estadoCivil: '',
      faixaSalarial: '',
      tags: tags.join(' '),
      behaviorTags: tags,
      campaigns: [],
      channels: [],
      actions: [],
      interactions: 0,
      lastChannel: '',
      lastAction: '',
      bankId: v.bank_id,
      bankName: v.bank_name,
      entityType: v.entity_type,
      currentStage: v.current_stage,
      globalScore: score,
      score: score,
      temperature: temp,
      origem: 'tenant-db'
    };
  },

  clearVisitorSearch() {
    App.state.visitorSearchResults = { visitors: [], bankIds: null, bankNames: [], loadedAt: null, loading: false, error: null };
    App.state.profileQuery = '';
    App.state.profileFilters = [];
    App.state.profileActive = false;
    App.save(); App.render();
  },

  // V34.0.0 Onda 4 — Export CSV dos leads filtrados pelo Buscador.
  exportSearchResultsCsv() {
    const results = App.state.visitorSearchResults?.visitors || [];
    if (!results.length) return Utils.toast('Sem leads pra exportar.');
    const filtered = (App.state.profileActive && App.state.profileFilters.length && window.ProfileFinder)
      ? ProfileFinder.applyFilters(results, App.state.profileFilters)
      : results;
    if (!filtered.length) return Utils.toast('Refino zerou os resultados — nada pra exportar.');
    const header = ['name', 'email', 'phone', 'bank', 'entity_type', 'current_stage', 'global_score', 'tags'];
    const rows = filtered.map(l => [
      l.name || '', l.email || '', l.phone || '', l.bankName || '',
      l.entityType || '', l.currentStage || '', l.globalScore || 0,
      (l.behaviorTags || []).join('|')
    ]);
    const csv = [header, ...rows].map(r => r.map(c => {
      const s = String(c == null ? '' : c);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lj-busca-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    Utils.toast(`${filtered.length} lead(s) exportado(s).`);
  },

  // V34.0.0 Onda 5 — Modal de imputar leads do Buscador numa campanha LJ.
  // Pega os leads filtrados (com filters aplicados), abre modal pra escolher
  // a campanha de destino, e dispara o endpoint que cria estado em
  // lj_visitor_campaign_state + tagueia + audita.
  openImputeCampaignModal() {
    const results = App.state.visitorSearchResults?.visitors || [];
    const filtered = (App.state.profileActive && App.state.profileFilters.length && window.ProfileFinder)
      ? ProfileFinder.applyFilters(results, App.state.profileFilters)
      : results;
    if (!filtered.length) return Utils.toast('Sem leads pra imputar.');
    const visitorIds = filtered.map(l => l.internalId || l.id).filter(Boolean);
    if (!visitorIds.length) return Utils.toast('Leads sem ID de visitor — não consigo imputar.');
    // V34.5.b — Pre-seta pushToRd=true se crm_pat conectado. UI mostra checkbox.
    const crmConnected = App.state.rdConnectionStatus?.crm_pat?.status === 'connected';
    App.state.imputeCampaignModal = {
      open: true,
      campaignId: (App.state.campaigns?.[0]?.id) || null,
      visitorIds,
      pushToRd: crmConnected,
      processing: false,
      error: null
    };
    App.render();
  },

  toggleImputePushToRd() {
    const m = App.state.imputeCampaignModal;
    if (!m?.open) return;
    App.state.imputeCampaignModal = { ...m, pushToRd: !m.pushToRd };
    App.render();
  },

  closeImputeCampaignModal() {
    App.state.imputeCampaignModal = { open: false, campaignId: null, visitorIds: [], pushToRd: false, processing: false, error: null };
    App.render();
  },

  // V34.7.f.3 — Recalcula + carrega breakdown RFV de 1 visitor pro detalhe.
  async loadVisitorScoreDetail(visitorId) {
    const vid = String(visitorId || '').trim();
    if (!vid) return;
    App.state._visitorScoreLoading = { ...(App.state._visitorScoreLoading || {}), [vid]: true };
    App.render();
    try {
      const data = await this._trackerFetch('/api/score-recalc', {
        method: 'POST',
        body: JSON.stringify({ visitor_id: vid })
      });
      if (data.ok) {
        // Resposta inclui { score, R, F, V, breakdown, weights, campaignScores }
        App.state.visitorScoreDetail = {
          ...(App.state.visitorScoreDetail || {}),
          [vid]: {
            score: data.globalScore || data.score,
            R: data.R,
            F: data.F,
            V: data.V,
            breakdown: data.breakdown,
            weights: data.weights,
            campaignScores: data.campaignScores || []
          }
        };
        Utils.toast(`✓ Score recalculado: ${data.globalScore || data.score}`);
      } else {
        Utils.toast(`Erro: ${data.message}`);
      }
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    } finally {
      App.state._visitorScoreLoading = { ...(App.state._visitorScoreLoading || {}), [vid]: false };
      App.render();
    }
  },

  // V34.6.aa + V34.7.g — Carrega counts por stage de uma campanha (com filtro opcional de banco).
  // Cache por chave campaignId::bankId pra suportar cross-filter.
  async loadCampaignPipelineCounts(campaignId, bankId = null) {
    const cId = Number(campaignId || 0);
    if (!cId) return;
    const bId = bankId ? Number(bankId) : null;
    const cacheKey = `${cId}${bId ? `::${bId}` : ''}`;
    try {
      let url = `/api/campaign-pipeline-counts?campaign_id=${cId}`;
      if (bId) url += `&bank_id=${bId}`;
      const data = await this._trackerFetch(url);
      if (data.ok) {
        App.state.campaignPipelineCounts = {
          ...(App.state.campaignPipelineCounts || {}),
          [cacheKey]: { counts: data.counts || {}, total: data.total || 0, bankId: bId, loadedAt: Date.now() }
        };
        App.render();
      }
    } catch (err) {
      console.warn('[loadCampaignPipelineCounts]', err.message);
    }
  },

  // V34.7.g — Setter pro banco selecionado no Journey Pipeline (cross-filter).
  setPipelineBankFilter(bankId) {
    App.state.selectedPipelineBankId = bankId ? Number(bankId) : null;
    App.save(); App.render();
  },

  // V34.7.g.3 — Dropdown rápido de banco no Buscador (Leads Globais view).
  // Atalho que dispara busca server-side V34 sem precisar abrir modal.
  async quickPickBuscadorBank(bankIdRaw) {
    const bankId = Number(bankIdRaw || 0);
    if (!bankId) return;
    // Dispara busca server-side com esse banco (mesmo caminho que o modal)
    await Actions._runVisitorSearch([bankId]);
  },

  // V34.6.z — Backlog RD push: visitors imputados mas que não entraram no RD CRM.
  async openRdBacklogModal(campaignId) {
    const cId = Number(campaignId || 0);
    if (!cId) return Utils.toast('Campanha inválida.');
    App.state.rdBacklogModal = { open: true, loading: true, campaignId: cId, total: 0, byReason: {}, visitors: [], retrying: false, error: null };
    App.render();
    try {
      const data = await this._trackerFetch(`/api/visitors-rd-backlog?campaign_id=${cId}`);
      if (!data.ok) {
        App.state.rdBacklogModal = { ...App.state.rdBacklogModal, loading: false, error: data.message };
        App.render();
        return;
      }
      App.state.rdBacklogModal = {
        open: true,
        loading: false,
        campaignId: cId,
        total: Number(data.total || 0),
        byReason: data.byReason || {},
        visitors: data.visitors || [],
        retrying: false,
        error: null
      };
      App.render();
    } catch (err) {
      App.state.rdBacklogModal = { ...App.state.rdBacklogModal, loading: false, error: err.message };
      App.render();
    }
  },

  closeRdBacklogModal() {
    App.state.rdBacklogModal = { open: false, loading: false, campaignId: null, total: 0, byReason: {}, visitors: [], retrying: false, error: null };
    App.render();
  },

  // V34.6.z — Retenta TODOS os visitors do backlog. Reaproveita o endpoint
  // impute-rd-push (idempotente). Chunks de 10, abort em 5 falhas seguidas.
  async retryRdBacklog() {
    const m = App.state.rdBacklogModal;
    if (!m?.open || m.retrying) return;
    const campaignId = m.campaignId;
    const visitorIds = (m.visitors || []).map(v => v.lj_visitor_id).filter(Boolean);
    if (!visitorIds.length) return Utils.toast('Nenhum visitor no backlog.');

    App.state.rdBacklogModal = { ...m, retrying: true };
    App.render();

    const RD_CHUNK = 10;
    const chunks = [];
    for (let i = 0; i < visitorIds.length; i += RD_CHUNK) {
      chunks.push(visitorIds.slice(i, i + RD_CHUNK));
    }
    let totalPushed = 0, totalSkipped = 0, totalAlready = 0;
    let pipelineMatched = null;
    let consecutiveFailures = 0;
    const ABORT_THRESHOLD = 5;

    for (let idx = 0; idx < chunks.length; idx++) {
      try {
        const data = await this._trackerFetch('/api/leads-impute-rd-push', {
          method: 'POST',
          body: JSON.stringify({ campaign_id: campaignId, visitor_ids: chunks[idx] })
        });
        if (!data.ok) {
          if (data.rateLimit) {
            Utils.toast(`Rate limit. Aguardando 5s...`);
            await new Promise(r => setTimeout(r, 5000));
            idx--;
            continue;
          }
          consecutiveFailures++;
          if (consecutiveFailures >= ABORT_THRESHOLD) {
            Utils.toast(`${ABORT_THRESHOLD} lotes seguidos falharam. Aborto.`);
            break;
          }
          continue;
        }
        consecutiveFailures = 0;
        if (pipelineMatched === null) pipelineMatched = data.pipelineMatched;
        if (!data.pipelineMatched) {
          Utils.toast(`Pipeline RD "${data.pipelineName}" não encontrado.`);
          break;
        }
        totalPushed += data.rdPushed || 0;
        totalAlready += data.rdAlready || 0;
        totalSkipped += data.rdSkipped || 0;
      } catch (err) {
        consecutiveFailures++;
        if (consecutiveFailures >= ABORT_THRESHOLD) break;
      }
      await new Promise(r => setTimeout(r, 500));
    }

    Utils.toast(`✓ Retry: +${totalPushed} no RD${totalSkipped ? ` · ${totalSkipped} ainda falharam` : ''}`);
    await Actions.openRdBacklogModal(campaignId); // re-load
  },

  setImputeCampaignId(campaignId) {
    const m = App.state.imputeCampaignModal;
    if (!m?.open) return;
    App.state.imputeCampaignModal = { ...m, campaignId: Number(campaignId) || null };
    App.render();
  },

  async confirmImputeCampaign() {
    const m = App.state.imputeCampaignModal;
    if (!m?.open) return;
    const campaignId = Number(m.campaignId || 0);
    const visitorIds = Array.isArray(m.visitorIds) ? m.visitorIds : [];
    const pushToRd = Boolean(m.pushToRd);
    if (!campaignId) return Utils.toast('Selecione uma campanha.');
    if (!visitorIds.length) return Utils.toast('Nenhum visitor pra imputar.');
    if (m.processing) return;

    // V34.6.x — chunk RD = 10 (volta config razoável agora que URL está certa).
    // Problema era api.rd.services/crm/v1 retornando 404, não timeout.
    const DB_CHUNK = 50;
    const RD_CHUNK = 10;

    App.state.imputeCampaignModal = {
      ...m,
      processing: true,
      error: null,
      progress: { phase: 'db', current: 0, total: visitorIds.length, currentChunk: 0, totalChunks: Math.ceil(visitorIds.length / DB_CHUNK) }
    };
    App.render();

    let totalImputed = 0, totalAlreadyIn = 0, totalSkipped = 0;
    let campaignNameResolved = null;
    let abort = false;

    try {
      // STEP 1 — DB chunking
      const dbChunks = [];
      for (let i = 0; i < visitorIds.length; i += DB_CHUNK) {
        dbChunks.push(visitorIds.slice(i, i + DB_CHUNK));
      }
      for (let idx = 0; idx < dbChunks.length; idx++) {
        if (abort) break;
        App.state.imputeCampaignModal = {
          ...App.state.imputeCampaignModal,
          progress: { phase: 'db', current: idx * DB_CHUNK, total: visitorIds.length, currentChunk: idx + 1, totalChunks: dbChunks.length }
        };
        App.render();
        try {
          const data = await this._trackerFetch('/api/leads-impute-to-campaign', {
            method: 'POST',
            body: JSON.stringify({ campaign_id: campaignId, visitor_ids: dbChunks[idx] })
          });
          if (!data.ok) {
            Utils.toast(`DB lote ${idx + 1}: ${data.message || 'erro'}`);
            if (/banco|campanha|tenant|503/i.test(data.message || '')) { abort = true; }
            continue;
          }
          totalImputed += data.imputed || 0;
          totalAlreadyIn += data.alreadyIn || 0;
          totalSkipped += data.skipped || 0;
          if (!campaignNameResolved && data.campaign?.name) campaignNameResolved = data.campaign.name;
        } catch (err) {
          Utils.toast(`DB lote ${idx + 1} erro: ${err.message}`);
          abort = true;
        }
      }
      const dbParts = [`✓ ${totalImputed} imputado(s)${campaignNameResolved ? ` em "${campaignNameResolved}"` : ''}`];
      if (totalAlreadyIn) dbParts.push(`${totalAlreadyIn} já estavam`);
      if (totalSkipped) dbParts.push(`${totalSkipped} ignorado(s)`);
      Utils.toast(dbParts.join(' · '));

      // STEP 2 — RD push chunking (só se DB rodou OK e cliente marcou).
      // V34.6.y — delay 500ms entre chunks RD pra dar respiro ao rate limit
      // do RD CRM (~60 calls/min). Cada chunk faz ~30 calls.
      const RD_INTER_CHUNK_DELAY_MS = 500;
      if (pushToRd && !abort) {
        const rdChunks = [];
        for (let i = 0; i < visitorIds.length; i += RD_CHUNK) {
          rdChunks.push(visitorIds.slice(i, i + RD_CHUNK));
        }
        let totalRdPushed = 0, totalRdAlready = 0, totalRdSkipped = 0;
        let pipelineMatched = null, pipelineName = null;

        // V34.6.s — abort em cascata de erros 502/timeout (igual mailing RD).
        let rdConsecutiveFailures = 0;
        const RD_ABORT_THRESHOLD = 5;
        for (let idx = 0; idx < rdChunks.length; idx++) {
          // V34.6.s — progress agora carrega pushed/already/skipped (honesto)
          App.state.imputeCampaignModal = {
            ...App.state.imputeCampaignModal,
            progress: {
              phase: 'rd',
              current: idx * RD_CHUNK,
              pushed: totalRdPushed,
              already: totalRdAlready,
              skipped: totalRdSkipped,
              total: visitorIds.length,
              currentChunk: idx + 1,
              totalChunks: rdChunks.length
            }
          };
          App.render();
          try {
            const rdData = await this._trackerFetch('/api/leads-impute-rd-push', {
              method: 'POST',
              body: JSON.stringify({ campaign_id: campaignId, visitor_ids: rdChunks[idx] })
            });
            if (!rdData.ok) {
              // V34.6.y — rateLimit é retryable: dorme + tenta de novo o mesmo chunk
              if (rdData.rateLimit) {
                Utils.toast(`RD rate limit. Aguardando 5s antes de continuar...`);
                await new Promise(r => setTimeout(r, 5000));
                idx--; // re-tenta o mesmo chunk
                continue;
              }
              Utils.toast(`RD lote ${idx + 1}: ${rdData.message || 'erro'}`);
              rdConsecutiveFailures++;
              if (/pipeline.*não encontrado|pipeline.*not found/i.test(rdData.message || '')) break;
              if (rdConsecutiveFailures >= RD_ABORT_THRESHOLD) {
                Utils.toast(`${RD_ABORT_THRESHOLD} lotes RD seguidos falhando. Provider RD com problema — aborto.`);
                break;
              }
              continue;
            }
            rdConsecutiveFailures = 0; // sucesso reseta
            if (pipelineMatched === null) pipelineMatched = rdData.pipelineMatched;
            if (!pipelineName) pipelineName = rdData.pipelineName;
            if (!rdData.pipelineMatched) {
              Utils.toast(`RD: pipeline "${rdData.pipelineName}" não encontrado. Crie no RD com esse nome exato.`);
              break;
            }
            totalRdPushed += rdData.rdPushed || 0;
            totalRdAlready += rdData.rdAlready || 0;
            totalRdSkipped += rdData.rdSkipped || 0;
          } catch (err) {
            Utils.toast(`RD lote ${idx + 1} erro: ${err.message}`);
            rdConsecutiveFailures++;
            if (rdConsecutiveFailures >= RD_ABORT_THRESHOLD) {
              Utils.toast(`${RD_ABORT_THRESHOLD} lotes RD seguidos com erro de rede. Aborto.`);
              break;
            }
          }
          // V34.6.y — delay entre chunks pra não saturar rate limit RD
          if (idx < rdChunks.length - 1) {
            await new Promise(r => setTimeout(r, RD_INTER_CHUNK_DELAY_MS));
          }
        }
        if (pipelineMatched) {
          const rdParts = [`✓ RD: ${totalRdPushed} push(es) no pipeline "${pipelineName}"`];
          if (totalRdAlready) rdParts.push(`${totalRdAlready} já tinham deal`);
          if (totalRdSkipped) rdParts.push(`${totalRdSkipped} pulado(s)`);
          Utils.toast(rdParts.join(' · '));
        }
      }

      // V34.6.z — Se push RD tinha falhas, abre o backlog automaticamente
      const hadRdFailures = pushToRd && !abort; // ran RD push, completou
      const finalCampaignId = campaignId;
      App.state.imputeCampaignModal = { open: false, campaignId: null, visitorIds: [], pushToRd: false, processing: false, progress: null, error: null };
      const bankIds = App.state.visitorSearchResults?.bankIds;
      await Actions._runVisitorSearch(bankIds);
      if (hadRdFailures) {
        // Delay 1s pra render limpar antes de abrir o backlog
        setTimeout(() => Actions.openRdBacklogModal(finalCampaignId), 1000);
      }
    } catch (err) {
      App.state.imputeCampaignModal = { ...App.state.imputeCampaignModal, processing: false, progress: null, error: err.message };
      Utils.toast(`Erro: ${err.message}`);
      App.render();
    }
  },

  // V34.0.0 Onda 4 — Compat alias antigo (placeholder original chama esse nome).
  // Mantém pra não quebrar onclick existente; redireciona pro modal real.
  imputeSearchResultsToCampaignPlaceholder() {
    return Actions.openImputeCampaignModal();
  },

  // V34.0.0 Onda 6 — Identity Resolution: busca + funde duplicatas do tenant.
  async openDuplicatesModal() {
    App.state.duplicatesModal = { open: true, loading: true, emailGroups: [], phoneGroups: [], loadedAt: null, mergingKey: null, error: null };
    App.render();
    try {
      const data = await this._trackerFetch('/api/visitors-find-duplicates');
      if (!data.ok) {
        App.state.duplicatesModal = { ...App.state.duplicatesModal, loading: false, error: data.message };
        App.render();
        return;
      }
      App.state.duplicatesModal = {
        open: true,
        loading: false,
        emailGroups: data.emailGroups || [],
        phoneGroups: data.phoneGroups || [],
        loadedAt: Date.now(),
        mergingKey: null,
        error: null
      };
      // V34.6.d — Refresh counts (badge no botão) consistente com o modal.
      Actions.loadPendingCounts();
    } catch (err) {
      App.state.duplicatesModal = { ...App.state.duplicatesModal, loading: false, error: err.message };
    }
    App.render();
  },

  // V34.0.0 Onda 6.e — Dispara reconcile RD ↔ LJ manualmente. Master-only.
  async triggerRdTagReconcile() {
    if (!App.currentUser?.isMaster) return Utils.toast('Apenas master pode rodar reconcile manual.');
    if (!confirm('Reconciliar tags do RD com lj_visitor_tags? Pode demorar 1-2 min (1 chamada RD por visitor).')) return;
    Utils.toast('Reconciliando... pode demorar.');
    try {
      const data = await this._trackerFetch('/api/rd-tag-reconcile', {
        method: 'POST',
        body: JSON.stringify({ max_visitors: 100 })
      });
      if (!data.ok) {
        Utils.toast(`Erro: ${data.message}`);
        return;
      }
      const parts = [
        `✓ ${data.usersProcessed} user(s)`,
        `${data.visitorsProcessed} visitor(s) verificado(s)`,
        `+${data.tagsAdded} adicionada(s)`,
        `-${data.tagsRemoved} removida(s)`
      ];
      Utils.toast(parts.join(' · '));
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V34.0.0 Onda 6.d — Counts leve pra badge no botão Duplicatas + sininho futuro.
  // Roda em background ao abrir Leads e após cada merge.
  async loadPendingCounts() {
    try {
      const data = await this._trackerFetch('/api/visitors-pending-counts');
      if (!data.ok) return;
      App.state.pendingCounts = {
        duplicateGroupsTotal: Number(data.duplicateGroupsTotal || 0),
        duplicateGroupsEmail: Number(data.duplicateGroupsEmail || 0),
        duplicateGroupsPhone: Number(data.duplicateGroupsPhone || 0),
        recentMerges24h: Number(data.recentMerges24h || 0),
        lastMergeAt: data.lastMergeAt || null,
        // V34.7.a.2 — novos counts (enrichment + rd sync)
        enrichablePending: Number(data.enrichablePending || 0),
        rdContactSyncPending: Number(data.rdContactSyncPending || 0),
        enrichedLast24h: Number(data.enrichedLast24h || 0),
        totalPending: Number(data.totalPending || 0),
        loadedAt: Date.now()
      };
      App.render();
    } catch (err) {
      // silencioso — counts são opcionais
      console.warn('[loadPendingCounts]', err.message);
    }
  },

  // V34.7.h.5 — Enriquece TODOS os leads elegíveis em loop, com barra de progresso.
  // Cada POST processa max 100. Backend devolve eligibleRemaining; loop até zerar.
  async triggerEnrichNames() {
    if (App.state._enrichRunning) return Utils.toast('Já está rodando.');
    App.state._enrichRunning = true;
    App.state.enrichProgress = { running: true, total: 0, done: 0, currentBatch: 0 };
    App.render();

    let totalEnriched = 0;
    let totalProcessed = 0;
    let sumByHeuristic = 0;
    let sumByDjow = 0;
    let sumMarkedForRd = 0;
    let totalInitial = 0;
    let iteration = 0;
    const MAX_ITERATIONS = 50; // safety: 50 * 100 = 5000 leads
    const BATCH_SIZE = 100;

    try {
      while (iteration < MAX_ITERATIONS) {
        iteration++;
        App.state.enrichProgress.currentBatch = iteration;
        App.render();

        const data = await this._trackerFetch('/api/visitors-enrich-names', {
          method: 'POST',
          body: JSON.stringify({ max_visitors: BATCH_SIZE })
        });

        if (!data.ok) {
          Utils.toast(`Erro no batch ${iteration}: ${data.message}`);
          break;
        }

        // Primeira iteração descobre o total elegível (processed + remaining)
        if (iteration === 1) {
          totalInitial = (data.processed || 0) + (data.eligibleRemaining || 0);
          App.state.enrichProgress.total = totalInitial;
        }

        totalProcessed += data.processed || 0;
        totalEnriched += data.enriched || 0;
        sumByHeuristic += data.byHeuristic || 0;
        sumByDjow += data.byDjow || 0;
        sumMarkedForRd += data.markedForRdSync || 0;

        App.state.enrichProgress.done = totalInitial - (data.eligibleRemaining || 0);
        App.render();

        // Acabou: nada mais elegível OU o batch não processou nada (defesa)
        if ((data.eligibleRemaining || 0) === 0) break;
        if ((data.processed || 0) === 0) break;
      }

      if (totalInitial === 0) {
        Utils.toast('Nenhum lead precisava de enriquecimento (todos já têm nome real).');
      } else {
        const parts = [`✓ ${totalEnriched} de ${totalInitial} nome(s) enriquecido(s)`];
        if (sumByHeuristic) parts.push(`${sumByHeuristic} via heurística`);
        if (sumByDjow) parts.push(`${sumByDjow} via Djow`);
        if (sumMarkedForRd) parts.push(`${sumMarkedForRd} marcados pra sync RD`);
        if (iteration > 1) parts.push(`em ${iteration} lotes`);
        Utils.toast(parts.join(' · '));
      }

      await Actions.loadPendingCounts();

      // V34.7.h.4 — Force refresh do Buscador se ativo
      if (totalEnriched > 0) {
        try {
          const sr = App.state.visitorSearchResults;
          if (sr?.loadedAt) {
            await Actions._runVisitorSearch(sr.bankIds);
          }
        } catch (refreshErr) {
          console.warn('[triggerEnrichNames] refresh falhou:', refreshErr.message);
        }
      }
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    } finally {
      App.state._enrichRunning = false;
      App.state.enrichProgress = { running: false, total: 0, done: 0, currentBatch: 0 };
      App.render();
    }
  },

  // V34.9.1 — Motor de conciliação em loop até zerar pendências.
  // Cada iteração: 1 POST pro /api/reconciliation-trigger (pull + push +
  // deals + orphans). Continua até remaining.deals + remaining.orphans = 0
  // OU rodada não fez nada (defesa) OU max iterations atingido.
  async triggerReconciliation() {
    if (App.state._reconciliationRunning) return Utils.toast('Conciliação já está rodando.');
    App.state._reconciliationRunning = true;
    App.state.reconciliationRunProgress = { running: true, phase: 'Conectando ao RD CRM…', total: 0, done: 0, currentBatch: 0 };
    App.render();

    const MAX_ITERATIONS = 30; // 30 * 100 = até 3000 deals/órfãos
    const token = localStorage.getItem('lj_jwt');
    let iteration = 0;
    let totalInitial = 0;
    let agg = {
      pulled: 0, applied: 0, alerts: 0,
      pushSynced: 0, pushFailed: 0,
      dealsLinked: 0, dealsRenamed: 0, dealsFailed: 0,
      orphansCreated: 0, orphansFailed: 0,
      elapsedMs: 0
    };

    try {
      while (iteration < MAX_ITERATIONS) {
        iteration++;
        App.state.reconciliationRunProgress.currentBatch = iteration;
        App.state.reconciliationRunProgress.phase = `Lote ${iteration} — pull RD + push + deals + órfãos…`;
        App.render();

        // Primeira iteração força pull total (force_full); seguintes incremental
        const body = iteration === 1 ? { force_full: true } : {};
        const res = await fetch('/api/reconciliation-trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!data.ok) {
          Utils.toast(`Erro no lote ${iteration}: ${data.message}`);
          break;
        }

        // Agrega
        const p = data.pull || {}, push = data.push || {}, deals = data.deals || {}, o = data.orphans || {};
        agg.pulled += p.pulled || 0;
        agg.applied += p.applied || 0;
        agg.alerts += p.alerts || 0;
        agg.pushSynced += push.synced || 0;
        agg.pushFailed += push.failed || 0;
        agg.dealsLinked += deals.linked || 0;
        agg.dealsRenamed += deals.renamed || 0;
        agg.dealsFailed += deals.failed || 0;
        agg.orphansCreated += o.created || 0;
        agg.orphansFailed += o.failed || 0;
        agg.elapsedMs += data.elapsedMs || 0;

        const remaining = data.remaining || { deals: 0, orphans: 0, pending: 0 };
        // V34.9.3.2 — inclui pending (visitors com pending-contact-update) no
        // total restante. Sem isso o loop podia parar com push em fila.
        const remainingTotal = (remaining.deals || 0) + (remaining.orphans || 0) + (remaining.pending || 0);

        // Primeira iteração descobre o total inicial (já incluindo o que esse batch fez)
        if (iteration === 1) {
          // V34.9.3.2 — inclui push.synced no processedThis
          const processedThis = (push.synced || 0) + (deals.linked || 0) + (deals.renamed || 0) + (o.created || 0);
          totalInitial = remainingTotal + processedThis;
          App.state.reconciliationRunProgress.total = totalInitial;
        }
        App.state.reconciliationRunProgress.done = Math.max(0, totalInitial - remainingTotal);
        App.render();

        // Stop conditions
        if (remainingTotal === 0) break;
        // V34.9.3.2 — inclui push.synced em didNothing. Sem isso, rodada que só
        // empurrou pending pro RD era considerada "vazia" e quebrava o loop.
        const didNothingThisBatch =
          (push.synced || 0) + (deals.linked || 0) + (deals.renamed || 0) + (o.created || 0) === 0;
        if (didNothingThisBatch) break;
      }

      // Toast final agregado
      const parts = [];
      if (agg.pulled) parts.push(`${agg.pulled} contatos checados no RD`);
      if (agg.applied) parts.push(`${agg.applied} atualizados no LJ`);
      if (agg.pushSynced) parts.push(`${agg.pushSynced} contatos atualizados no RD`);
      if (agg.dealsLinked) parts.push(`${agg.dealsLinked} deal(s) linkado(s)`);
      if (agg.dealsRenamed) parts.push(`${agg.dealsRenamed} deal(s) renomeado(s)`);
      if (agg.dealsFailed) parts.push(`${agg.dealsFailed} deal(s) falharam`);
      if (agg.orphansCreated) parts.push(`${agg.orphansCreated} órfão(s) criado(s) no RD`);
      if (agg.alerts) parts.push(`${agg.alerts} conflito(s) no sininho`);
      const sec = (agg.elapsedMs / 1000).toFixed(1);
      const lotes = iteration > 1 ? ` · ${iteration} lotes` : '';
      Utils.toast(parts.length ? `✓ ${parts.join(' · ')}${lotes} (${sec}s)` : `Nada novo a conciliar (${sec}s)`);

      await Actions.loadReconciliationAlerts();
      const sr = App.state.visitorSearchResults;
      if (sr?.loadedAt) {
        try { await Actions._runVisitorSearch(sr.bankIds); } catch (_) {}
      }
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    } finally {
      App.state._reconciliationRunning = false;
      App.state.reconciliationRunProgress = { running: false, phase: '', total: 0, done: 0, currentBatch: 0 };
      App.render();
    }
  },

  // V34.7.h.6 — [DEPRECATED] Sync RD em loop com barra de progresso.
  // Mantido por compat — não tem botão chamando mais. Substituído pelo motor
  // de conciliação bidirecional (triggerReconciliation). Remover em onda futura.
  // Cada batch processa max 50 visitors pendentes; loop até pendingRemaining=0.
  async triggerRdContactSync() {
    if (App.state._rdContactSyncRunning) return Utils.toast('Já está rodando.');
    App.state._rdContactSyncRunning = true;
    App.state.rdSyncProgress = { running: true, total: 0, done: 0, currentBatch: 0 };
    App.render();

    let totalSynced = 0;
    let totalFailed = 0;
    let totalRateLimit = 0;
    let totalInitial = 0;
    let iteration = 0;
    const MAX_ITERATIONS = 50; // 50 * 50 = 2500 contatos
    const BATCH_SIZE = 50;

    try {
      while (iteration < MAX_ITERATIONS) {
        iteration++;
        App.state.rdSyncProgress.currentBatch = iteration;
        App.render();

        const data = await this._trackerFetch('/api/rd-contact-sync-run', {
          method: 'POST',
          body: JSON.stringify({ max_visitors: BATCH_SIZE })
        });

        if (!data.ok) {
          Utils.toast(`Erro no batch ${iteration}: ${data.message}`);
          break;
        }

        if (iteration === 1) {
          totalInitial = (data.processed || 0) + (data.pendingRemaining || 0);
          App.state.rdSyncProgress.total = totalInitial;
        }

        totalSynced += data.synced || 0;
        totalFailed += data.failed || 0;
        totalRateLimit += data.rateLimit || 0;

        App.state.rdSyncProgress.done = totalInitial - (data.pendingRemaining || 0);
        App.render();

        if ((data.pendingRemaining || 0) === 0) break;
        if ((data.processed || 0) === 0) break;
        // Se ficou rate-limited muito, para e avisa
        if (totalRateLimit > 10) {
          Utils.toast(`Pausando: ${totalRateLimit} rate-limit do RD CRM. Tente de novo em 1-2min.`);
          break;
        }
      }

      if (totalInitial === 0) {
        Utils.toast('Nenhum contato pendente de sync com RD CRM.');
      } else {
        const parts = [`✓ ${totalSynced} de ${totalInitial} sincronizado(s)`];
        if (totalFailed) parts.push(`${totalFailed} falharam`);
        if (totalRateLimit) parts.push(`${totalRateLimit} rate-limit`);
        if (iteration > 1) parts.push(`em ${iteration} lotes`);
        Utils.toast(parts.join(' · '));
      }

      await Actions.loadPendingCounts();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    } finally {
      App.state._rdContactSyncRunning = false;
      App.state.rdSyncProgress = { running: false, total: 0, done: 0, currentBatch: 0 };
      App.render();
    }
  },

  closeDuplicatesModal() {
    App.state.duplicatesModal = { open: false, loading: false, emailGroups: [], phoneGroups: [], loadedAt: null, mergingKey: null, error: null };
    App.render();
  },

  async mergeDuplicateGroup(matchSignal, groupKey, survivorId) {
    const m = App.state.duplicatesModal;
    if (!m?.open || m.mergingKey) return;
    const groups = matchSignal === 'email-exact' ? m.emailGroups : m.phoneGroups;
    const group = (groups || []).find(g => g.key === groupKey);
    if (!group) return Utils.toast('Grupo não encontrado.');
    const visitorIds = group.visitors.map(v => v.lj_visitor_id);
    if (visitorIds.length < 2) return Utils.toast('Precisa de pelo menos 2 visitors.');

    App.state.duplicatesModal = { ...m, mergingKey: groupKey };
    App.render();
    try {
      const data = await this._trackerFetch('/api/visitors-merge', {
        method: 'POST',
        body: JSON.stringify({
          survivor_id: survivorId || null,
          visitor_ids: visitorIds,
          match_signal: matchSignal,
          source_reason: 'find-duplicates'
        })
      });
      if (!data.ok) {
        Utils.toast(`Erro: ${data.message}`);
        App.state.duplicatesModal = { ...App.state.duplicatesModal, mergingKey: null };
        App.render();
        return;
      }
      Utils.toast(`✓ ${data.mergedCount} merge(s) → survivor ${data.survivorId}`);
      // Re-fetch pra remover o grupo concluído
      await Actions.openDuplicatesModal();
      // Se Buscador estava aberto, refetch dele também (visitors mudaram)
      if (App.state.visitorSearchResults?.loadedAt) {
        const bankIds = App.state.visitorSearchResults.bankIds;
        await Actions._runVisitorSearch(bankIds);
      }
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
      App.state.duplicatesModal = { ...App.state.duplicatesModal, mergingKey: null };
      App.render();
    }
  },

  // V33.0.0-alpha18 — Caminho C: breakdown por LP de uma campanha.
  // Backend agrupa visitors por landing_url normalizado (sem ?utm=). UI
  // mostra as N LPs da campanha automaticamente quando há >1 distinta.
  async loadCampaignLpBreakdown(campaignId) {
    if (!campaignId) return;
    try {
      const data = await this._trackerFetch(`/api/campaign-lp-breakdown?campaign_id=${campaignId}`);
      if (data.ok) {
        App.state.campaignLpBreakdown = {
          ...App.state.campaignLpBreakdown,
          [campaignId]: { ...data, loadedAt: Date.now() }
        };
        App.render();
      }
    } catch (err) {
      console.error('[loadCampaignLpBreakdown]', err);
    }
  },

  // V33.0.0 Onda 3 — Carrega atribuições agregadas por action.
  async loadActionAttributions(sinceDays = 30) {
    const cache = App.state.actionAttributionsCache || {};
    if (cache.loading) return;
    App.state.actionAttributionsCache = { ...cache, loading: true };
    try {
      const data = await this._trackerFetch(`/api/action-attributions?since_days=${sinceDays}`);
      if (!data.ok) {
        App.state.actionAttributionsCache = { byActionId: {}, sinceDays, loadedAt: Date.now(), loading: false, error: data.message };
      } else {
        const byActionId = {};
        for (const a of (data.attributions || [])) byActionId[a.actionId] = a;
        App.state.actionAttributionsCache = { byActionId, sinceDays, loadedAt: Date.now(), loading: false };
      }
    } catch (err) {
      App.state.actionAttributionsCache = { ...App.state.actionAttributionsCache, loading: false, error: err.message };
    }
    App.render();
  },

  copyHotmartWebhookUrl() {
    // URL pra cliente colar no Hotmart. Inclui tenant_id pra roteamento.
    const tenantId = (() => {
      try {
        const jwt = localStorage.getItem('lj_jwt');
        if (!jwt) return null;
        const payload = JSON.parse(atob(jwt.split('.')[1]));
        return payload?.tenantId || null;
      } catch (_) { return null; }
    })();
    if (!tenantId) return Utils.toast('Você precisa estar associado a um tenant pra gerar a URL.');
    const url = `${window.location.origin}/api/hotmart-webhook?tenant_id=${tenantId}`;
    try {
      navigator.clipboard.writeText(url);
      Utils.toast('✓ URL do webhook copiada.');
    } catch (_) {
      Utils.toast('Não consegui copiar — copie manualmente: ' + url);
    }
  }
});

window.Actions = Actions;
