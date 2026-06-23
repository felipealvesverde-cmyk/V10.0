// V39.3.0 — RevOps & Velocidade
//
// Tela própria no menu lateral logo abaixo de RevOps & Governança.
// Diagnóstico estrutural da máquina por produto: Pipeline Velocity decomposto
// em V (Visitas) × C (Conversão) × L (Ticket) / T (Ciclo) = R$/dia.
//
// Padrão de tela:
//   Header dark "Velocity Layer · Diagnóstico estrutural"
//   Grid de cards de produto (cada um mostra R$/dia + 4 letras compactas)
//   Click no card expande pra diagnóstico completo + simulador (e se dobrar V/C/L/T?)
//
// Sem FlowBreadcrumb — não pertence ao fluxo Produto→Campanha→Ação.

var RevopsVelocityModule = {
  render() {
    const products = (App.state.products || []).filter(p => p.archived !== true);
    // V40.12.3 — Limpa cache do AudienceConsumerEngine antes de renderizar.
    // Senão mudanças na Audiência só refletem após F5.
    if (window.AudienceConsumerEngine) AudienceConsumerEngine.clearCache();
    return `<div class="space-y-4">
      ${this.velocityLayer(products)}
      ${this._audienceStaleBanner(products)}
      <div class="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
        <h2 class="text-xl font-black mb-1">Diagnóstico por produto</h2>
        <p class="text-sm text-slate-500 mb-5">Cada card mostra a velocidade da máquina (R$/dia) decomposta em V × C × L / T. Quando o produto tem Audiência definida, os 4 nomes adaptam (Sessões/MQLs/Estabelecimentos/etc).</p>
        ${products.length === 0
          ? Components.empty('Cadastre um produto antes de ver diagnóstico.')
          : `<div class="grid md:grid-cols-2 xl:grid-cols-3 gap-4">${products.map(p => this.productCard(p)).join('')}</div>`}
      </div>
    </div>`;
  },

  // V40.12.3 — Sprint 4: banner não-bloqueante quando há produtos com Audiência
  // legada ou desatualizada. Lista produtos afetados + botão pra abrir o wizard.
  // Sem audiência configurada já é alertado em cada card individualmente (status
  // 'blocked'), aqui é só pra V40.12.0/V40.12.1 sem archetypeKey.
  _audienceStaleBanner(products) {
    if (!window.AudienceConsumerEngine) return '';
    const stale = products
      .map(p => ({ product: p, diag: AudienceConsumerEngine.diagnoseStaleness(p.id) }))
      .filter(x => x.diag && x.diag.status !== 'no_audience');
    if (!stale.length) return '';
    const total = stale.length;
    return `<div class="rounded-2xl bg-violet-50 border border-violet-200 border-l-4 border-l-violet-600 p-4">
      <div class="flex items-start gap-3">
        <div class="w-8 h-8 rounded-xl bg-violet-100 grid place-items-center shrink-0">
          <i data-lucide="sparkles" class="w-4 h-4 text-violet-700"></i>
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-[11px] font-black text-violet-700 uppercase tracking-widest">Atualize a Audiência</p>
          <p class="text-sm text-slate-700 mt-0.5 leading-relaxed">
            ${total === 1
              ? `Tem <b>1 produto</b> com Audiência num formato antigo. Refunde pra destravar labels adaptativos no Card de Velocidade (V·C·L·T falando a língua do seu negócio).`
              : `Tem <b>${total} produtos</b> com Audiência num formato antigo. Refunde cada um pra destravar labels adaptativos.`}
          </p>
          <div class="mt-2 flex flex-wrap gap-2">
            ${stale.slice(0, 6).map(({ product }) => `
              <button onclick="Actions.openAudienceWizardForExisting(${product.id})" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-violet-300 text-[11px] font-black text-violet-700 hover:bg-violet-100">
                <i data-lucide="edit-3" class="w-3 h-3"></i>${Utils.escape(product.name)}
              </button>
            `).join('')}
            ${stale.length > 6 ? `<span class="text-[11px] text-slate-500 self-center">+${stale.length - 6} outros</span>` : ''}
          </div>
        </div>
      </div>
    </div>`;
  },

  velocityLayer(products) {
    const cache = App.state.pipelineVelocityCache;
    const status = cache?.loading ? 'loading' : cache?.error ? 'error' : cache?.loaded ? 'ok' : 'idle';
    // Velocidade agregada do tenant
    let totalVelocity = 0;
    let countOk = 0;
    if (status === 'ok' && window.PipelineVelocityEngine) {
      for (const p of products) {
        const s = PipelineVelocityEngine.forProduct(p.id);
        if (s && s.status === 'ok' && s.velocity > 0) {
          totalVelocity += s.velocity;
          countOk++;
        }
      }
    }
    const totalMes = totalVelocity * (cache?.period?.daysInMonth || 30);
    return `<div class="bg-slate-950 text-white rounded-[2rem] p-5 shadow-sm overflow-hidden relative">
      <div class="absolute inset-0 opacity-60" style="background: radial-gradient(circle at 20% 10%, rgba(139,92,246,.18), transparent 30%), radial-gradient(circle at 80% 20%, rgba(236,72,153,.14), transparent 32%);"></div>
      <div class="relative z-10 grid lg:grid-cols-[1.2fr_1fr] gap-4 items-center">
        <div>
          <div class="flex items-center gap-2 mb-3"><i data-lucide="gauge" class="w-4 h-4"></i><p class="text-xs font-black text-violet-300 uppercase tracking-wider">Velocity Layer · Diagnóstico estrutural</p></div>
          <p class="text-base text-slate-300 max-w-3xl leading-relaxed">A velocidade da máquina é o R$/dia que a operação gera estruturalmente, decomposta em quatro letras: Visitas × Conversão × Ticket / Ciclo. O diagnóstico aponta qual letra está mais fraca e onde mexer pra dobrar — sem ter que dobrar tudo.</p>
        </div>
        <div class="grid grid-cols-2 gap-3">
          ${this._darkMetric('Velocidade total', status === 'ok' ? `${PipelineVelocityEngine.fmtMoney(totalVelocity)}/dia` : '—', 'gauge')}
          ${this._darkMetric('Projeção fim do mês', status === 'ok' ? PipelineVelocityEngine.fmtMoney(totalMes) : '—', 'calendar')}
          ${this._darkMetric('Produtos com leitura', `${countOk}`, 'package')}
          ${this._darkMetric('Status', status === 'ok' ? '✓ Ativo' : status === 'loading' ? 'Carregando…' : status === 'error' ? 'Erro' : '—', 'activity')}
        </div>
      </div>
    </div>`;
  },

  _darkMetric(label, value, icon) {
    return `<div class="bg-white/10 border border-white/10 rounded-2xl p-4"><div class="flex items-center justify-between"><p class="text-xs font-black text-slate-300">${label}</p><i data-lucide="${icon}" class="w-4 h-4 text-slate-300"></i></div><div class="text-2xl font-black mt-2 leading-tight">${value}</div></div>`;
  },

  productCard(product) {
    if (!window.PipelineVelocityEngine) return '';
    const s = PipelineVelocityEngine.forProduct(product.id);
    if (!s) return '';
    const expanded = Number(App.state.revopsVelocityExpandedProductId) === Number(product.id);

    if (s.status === 'blocked') {
      return `<div class="rounded-3xl bg-amber-50 border border-amber-200 border-l-4 border-l-amber-500 p-4">
        <p class="text-[10px] font-black text-amber-700 uppercase tracking-wider mb-1">Velocity bloqueada</p>
        <h3 class="font-black text-base text-amber-900">${Utils.escape(product.name)}</h3>
        <p class="text-xs text-amber-800 leading-relaxed mt-1">Defina como esse produto vende pra destravar Velocity.</p>
        <button onclick="Actions.openAudienceWizardForExisting(${product.id})" class="mt-2 px-3 py-1.5 rounded-xl bg-amber-700 text-white text-xs font-black hover:bg-amber-800" style="color:#fff!important;">Definir agora →</button>
      </div>`;
    }

    if (s.status === 'loading') {
      return `<div class="rounded-3xl bg-slate-50 border border-slate-200 p-4 flex items-center gap-3">
        <div class="w-4 h-4 rounded-full border-2 border-slate-300 border-t-slate-700 animate-spin shrink-0"></div>
        <p class="text-sm text-slate-600">Carregando Velocity de ${Utils.escape(product.name)}…</p>
      </div>`;
    }

    if (s.status === 'pending') {
      const label = s.salesChannel === 'crm' ? 'CRM' : 'Híbrido';
      return `<div class="rounded-3xl bg-violet-50 border border-violet-200 border-l-4 border-l-violet-500 p-4">
        <p class="text-[10px] font-black text-violet-700 uppercase tracking-wider mb-1">Velocity · ${label}</p>
        <h3 class="font-black text-base text-violet-900">${Utils.escape(product.name)}</h3>
        <p class="text-xs text-violet-800 leading-relaxed mt-1">Modo ${label}: Velocity depende do pipeline RD persistido + Fechamento mensal declarado. Próximas ondas.</p>
      </div>`;
    }

    if (s.status === 'error') {
      return `<div class="rounded-3xl bg-rose-50 border border-rose-200 border-l-4 border-l-rose-500 p-4">
        <p class="text-[10px] font-black text-rose-700 uppercase tracking-wider mb-1">Erro</p>
        <h3 class="font-black text-base text-rose-900">${Utils.escape(product.name)}</h3>
        <p class="text-xs text-rose-800 mt-1">${Utils.escape(App.state.pipelineVelocityCache?.error || 'desconhecido')}</p>
        <button onclick="Actions.loadPipelineVelocitySummary({force:true})" class="mt-2 px-3 py-1.5 rounded-xl bg-rose-700 text-white text-xs font-black hover:bg-rose-800" style="color:#fff!important;">Tentar de novo</button>
      </div>`;
    }

    // ok — desenha card padrão com 4 letras
    // V39.7.0 — header neutro (slate) quando R$/dia = 0 evita "verde mentindo"
    // V40.12.3 — Sprint 4 da Onda V2 de Audiência: card adaptativo. Labels
    // V·C·L·T leem do arquétipo da Audiência do produto. Sem audiência ou
    // arquétipo, cai em labels genéricos (compat retrátil).
    const isZero = (s.velocity || 0) <= 0;
    const semColor = isZero
      ? 'slate'
      : s.gargalo
        ? (s.gargalo === 'C' || s.gargalo === 'T' ? 'amber' : 'violet')
        : 'emerald';
    const heroColor = isZero ? 'text-slate-400' : `text-${semColor}-700`;

    // V40.12.3 — Lê labels adaptativos. Quando produto NÃO tem audiência
    // configurada ou tem audiência sem archetypeKey, retorna labels genéricos.
    const labels = window.AudienceConsumerEngine
      ? AudienceConsumerEngine.getVelocityLabels(product.id)
      : { V: 'Visitas', C: 'Conversão', L: 'Ticket', T: 'Ciclo' };
    const archKey = window.AudienceConsumerEngine
      ? AudienceConsumerEngine.getArchetypeKey(product.id)
      : null;
    const arch = window.AudienceConsumerEngine
      ? AudienceConsumerEngine.getArchetype(product.id)
      : null;

    const customersTxt = this._pluralize(s.customersCount, 'customer', 'customers', 'nenhum customer');
    // V40.12.3 — pluralização do "visita" também adapta. Pega 1ª palavra do label V.
    const vNoun = (labels.V || 'Visitas').split(/[\s/]/)[0].toLowerCase();
    const visitasTxt = this._pluralize(s.V, vNoun, vNoun + (vNoun.endsWith('s') ? '' : 's'), `nenhum${vNoun.endsWith('a') ? 'a' : ''} ${vNoun}`);
    const vendasTxt = this._pluralize(s.approvedCount, 'venda processada', 'vendas processadas', 'nenhuma venda processada');

    // V40.12.3 — Badge do arquétipo (etiqueta sutil no header do card).
    const archBadge = arch && archKey
      ? `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-${semColor}-100 border border-${semColor}-200 text-[9px] font-black text-${semColor}-700 uppercase tracking-widest" title="${Utils.escape(arch.tagline || '')}"><i data-lucide="target" class="w-2.5 h-2.5"></i>${Utils.escape(arch.label || '')}</span>`
      : '';

    return `<div class="rounded-3xl bg-${semColor}-50 border border-${semColor}-200 border-l-4 border-l-${semColor}-500 overflow-hidden">
      <button onclick="Actions.toggleRevopsVelocityProduct(${product.id})" class="w-full text-left p-4 hover:bg-${semColor}-100/40 transition">
        <div class="flex items-start justify-between gap-3 mb-3">
          <div class="min-w-0 flex-1">
            <p class="text-[10px] font-black text-${semColor}-700 uppercase tracking-wider mb-0.5">Velocity · ${s.yyyymm || ''}</p>
            <div class="flex items-center gap-2 flex-wrap">
              <h3 class="font-black text-base truncate">${Utils.escape(product.name)}</h3>
              ${archBadge}
            </div>
            <p class="text-xs text-slate-600 mt-1">${customersTxt} em ${visitasTxt} · ${vendasTxt}</p>
          </div>
          <div class="shrink-0 flex items-start gap-2">
            <div class="text-right">
              <p class="text-[10px] font-black text-slate-500 uppercase">R$/dia</p>
              <p class="font-black text-xl ${heroColor}">${PipelineVelocityEngine.fmtMoney(s.velocity)}</p>
            </div>
            <span class="text-slate-400 mt-0.5" aria-label="${expanded ? 'Recolher' : 'Expandir'}" title="${expanded ? 'Recolher' : 'Expandir'}">
              <i data-lucide="chevron-${expanded ? 'up' : 'down'}" class="w-4 h-4"></i>
            </span>
          </div>
        </div>
        <div class="grid grid-cols-4 gap-1.5">
          ${this._letterMini('V', labels.V, String(s.V), s.gargalo === 'V')}
          ${this._letterMini('C', labels.C, PipelineVelocityEngine.fmtPct(s.C), s.gargalo === 'C')}
          ${this._letterMini('L', labels.L, PipelineVelocityEngine.fmtMoney(s.L), s.gargalo === 'L')}
          ${this._letterMini('T', labels.T, `${s.T.toFixed(1)}d`, s.gargalo === 'T')}
        </div>
      </button>
      ${expanded ? this._expandedBlock(s, product) : ''}
    </div>`;
  },

  // V39.7.0 — pluralização inteligente (sem "(s)" entre parênteses).
  _pluralize(n, singular, plural, zeroLabel) {
    const num = Number(n) || 0;
    if (num === 0) return zeroLabel || `0 ${plural}`;
    if (num === 1) return `1 ${singular}`;
    return `${num} ${plural}`;
  },

  // V39.7.0 — hierarquia invertida: valor vira herói no centro, rótulo vira legenda embaixo.
  _letterMini(letter, name, value, isGargalo) {
    const tone = isGargalo ? 'amber' : 'slate';
    return `<div class="bg-white rounded-xl border ${isGargalo ? 'border-amber-300' : 'border-slate-200'} px-2 py-2 text-center ${isGargalo ? 'ring-1 ring-amber-300' : ''}">
      <p class="font-black text-base text-slate-900 leading-none">${value}</p>
      <p class="text-[9px] font-black text-${tone}-600 uppercase tracking-widest mt-1.5">${letter} · ${name}</p>
    </div>`;
  },

  // V39.5.0 — Onda A tecida: ordem agora → estrutural → eficiência → costura.
  // V39.6.0 — Faixa "Como ativar" pra produto zerado + descrições "Saber mais".
  // V39.7.0 — Estado vazio condicional: blocos só aparecem quando têm o que dizer
  //           (suprime 4 lamentos paralelos). Side accents internos reduzidos
  //           pra border-l-2 e saturados pouco — viram "papel de fundo", não grito.
  _expandedBlock(s, product) {
    const diag = PipelineVelocityEngine.diagnose(s);
    const sim = PipelineVelocityEngine.simulate(s);
    const forecast = (window.ForecastRealizadoEngine && ForecastRealizadoEngine.forProduct)
      ? ForecastRealizadoEngine.forProduct(product.id)
      : null;
    const efficiency = (window.EfficiencyEngine && EfficiencyEngine.forProduct)
      ? EfficiencyEngine.forProduct(product.id)
      : null;

    const semVenda = (s.approvedCount || 0) === 0 && (s.customersCount || 0) === 0;
    const semTrafego = s.V === 0;
    const semMeta = !forecast || forecast.status !== 'ok' || forecast.meta <= 0;
    const semCanal = !product.salesChannel;
    const sinais = {
      temMeta: !semMeta,
      temCanal: !semCanal,
      temTrafego: !semTrafego,
      temVenda: !semVenda
    };
    const passosFaltantes = (semMeta ? 1 : 0) + (semCanal ? 1 : 0) + (semTrafego ? 1 : 0) + (semVenda ? 1 : 0);
    const faixaVisivel = passosFaltantes > 0;
    // V39.7.2 — Djow sempre presente como persona viva do card. Narrativa adapta ao estado.
    const cravados = (!semMeta ? 1 : 0) + (!semTrafego ? 1 : 0) + (!semVenda ? 1 : 0);
    const isVazioTotal = semVenda && semTrafego && semMeta && semCanal;

    // Estado vazio total: só faixa "Como ativar" + Djow em silêncio + refresh
    if (isVazioTotal) {
      return `<div class="border-t border-slate-200 bg-white p-4 space-y-3">
        ${this._comoAtivarFaixa(product, sinais)}
        ${this._djowCostura(product, s, forecast, efficiency, cravados)}
        <div class="flex items-center justify-end">
          <button onclick="Actions.refreshOndaA()" class="px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-black hover:bg-slate-50 flex items-center gap-1.5">
            <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Recarregar diagnóstico
          </button>
        </div>
      </div>`;
    }

    return `<div class="border-t border-slate-200 bg-white p-4 space-y-3">
      ${faixaVisivel ? this._comoAtivarFaixa(product, sinais) : ''}

      ${!semMeta ? this._situacaoMesBlock(product, forecast, efficiency, faixaVisivel) : ''}

      ${!semTrafego ? `<div class="rounded-2xl bg-violet-50/60 border border-violet-200 border-l-2 border-l-violet-400 p-3">
        <div class="flex items-center justify-between mb-2">
          <p class="text-[10px] font-black text-violet-700 uppercase tracking-widest flex items-center gap-1.5">
            <i data-lucide="gauge" class="w-3.5 h-3.5"></i> Estrutura da máquina · V × C × L / T
          </p>
          ${this._saberMaisBtn(product.id, 'a3')}
        </div>
        ${this._descBox(product.id, 'a3', this.DESCRIPTIONS.a3)}
        <p class="text-xs text-slate-800 leading-relaxed">${Utils.escape(diag)}</p>
      </div>` : ''}

      ${!semTrafego && sim ? `<div class="rounded-2xl bg-slate-50 border border-slate-200 border-l-2 border-l-slate-300 p-3">
        <div class="flex items-center justify-between mb-2">
          <p class="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1.5">
            <i data-lucide="flask-conical" class="w-3.5 h-3.5"></i> Simulador — e se você dobrar uma letra?
          </p>
          ${this._saberMaisBtn(product.id, 'sim')}
        </div>
        ${this._descBox(product.id, 'sim', this.DESCRIPTIONS.sim)}
        <div class="grid grid-cols-2 gap-2">
          ${this._simRow('Dobrar V (visitas)', sim.base, sim.double_V)}
          ${this._simRow('Dobrar C (conversão)', sim.base, sim.double_C)}
          ${this._simRow('Dobrar L (ticket)', sim.base, sim.double_L)}
          ${this._simRow('Cortar T pela metade', sim.base, sim.half_T)}
        </div>
      </div>` : ''}

      ${!semVenda ? this._efficiencyBlock(product) : ''}

      ${this._djowCostura(product, s, forecast, efficiency, cravados)}

      <div class="flex items-center justify-end">
        <button onclick="Actions.refreshOndaA()" class="px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-black hover:bg-slate-50 flex items-center gap-1.5">
          <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Recarregar diagnóstico
        </button>
      </div>
    </div>`;
  },

  // V39.6.0 — Faixa "Como ativar" quando produto está 100% zerado.
  // V39.7.1 — Faixa inteligente: filtra passos já cumpridos e renumera dinamicamente.
  //           Header conta passos restantes. Some inteira quando 0 passos sobram.
  _comoAtivarFaixa(product, sinais) {
    const s = sinais || { temMeta: false, temCanal: false, temTrafego: false, temVenda: false };
    const passos = [];
    if (!s.temMeta) passos.push('<b>Defina a meta de vendas</b> nas ofertas (RevOps → Ofertas) — destrava Situação do mês.');
    if (!s.temCanal) passos.push('<b>Confirme o canal de venda</b> (checkout/CRM/híbrido) na aba Audiência do produto.');
    if (!s.temTrafego) passos.push('<b>Ative tracking UTM</b> em ao menos 1 campanha apontando pra este produto — destrava Estrutura da máquina.');
    if (!s.temVenda) passos.push('<b>Aguarde a primeira venda</b> via Hotmart (webhook auto-mapeia) — destrava Eficiência de Capital.');
    if (passos.length === 0) return '';
    const n = passos.length;
    const label = n === 1 ? '1 passo pra ligar a máquina' : `${n} passos pra ligar a máquina`;
    return `<div class="rounded-2xl bg-slate-900 text-white p-4 border-l-4 border-l-violet-500">
      <p class="text-[10px] font-black text-violet-300 uppercase tracking-widest mb-2 flex items-center gap-1.5">
        <i data-lucide="info" class="w-3.5 h-3.5"></i> Produto em ativação · ${label}
      </p>
      <ol class="space-y-1.5 text-xs leading-relaxed">
        ${passos.map((txt, i) => `<li class="flex items-start gap-2"><span class="font-black text-violet-300 shrink-0">${i + 1}.</span><span>${txt}</span></li>`).join('')}
      </ol>
    </div>`;
  },

  // V39.7.0 — só ícone "ⓘ" (sem texto) pra reduzir ruído visual.
  // 4 botões empilhados em cada bloco viravam eixo paralelo que roubava atenção
  // do conteúdo. Agora ícone discreto no canto; tooltip ao hover.
  _saberMaisBtn(productId, blockKey) {
    const key = `${productId}-${blockKey}`;
    const open = !!(App.state.revopsVelocityDescOpen || {})[key];
    return `<button onclick="event.stopPropagation(); Actions.toggleRevopsVelocityDesc(${productId}, '${blockKey}')" class="${open ? 'text-slate-700' : 'text-slate-400'} hover:text-slate-700 transition shrink-0" title="${open ? 'Recolher info' : 'Saber mais sobre este bloco'}" aria-label="${open ? 'Recolher info' : 'Saber mais sobre este bloco'}">
      <i data-lucide="info" class="w-3.5 h-3.5"></i>
    </button>`;
  },

  // V39.6.0 — Caixa cinza expansível com as 4 seções (O que é / Move / De onde vem / Pra que serve).
  _descBox(productId, blockKey, desc) {
    const key = `${productId}-${blockKey}`;
    const open = !!(App.state.revopsVelocityDescOpen || {})[key];
    if (!open || !desc) return '';
    return `<div class="rounded-xl bg-slate-100 border border-slate-200 p-3 mb-3 space-y-2">
      <div>
        <p class="text-[10px] font-black text-slate-700 uppercase tracking-widest mb-0.5">🔍 O que é</p>
        <p class="text-[11px] text-slate-700 leading-relaxed">${Utils.escape(desc.oQueE)}</p>
      </div>
      <div>
        <p class="text-[10px] font-black text-slate-700 uppercase tracking-widest mb-0.5">🎯 O que move</p>
        <p class="text-[11px] text-slate-700 leading-relaxed">${Utils.escape(desc.oQueMove)}</p>
      </div>
      <div>
        <p class="text-[10px] font-black text-slate-700 uppercase tracking-widest mb-0.5">📡 De onde vem</p>
        <p class="text-[11px] text-slate-700 leading-relaxed">${Utils.escape(desc.deOndeVem)}</p>
      </div>
      <div>
        <p class="text-[10px] font-black text-slate-700 uppercase tracking-widest mb-0.5">🛠️ Pra que serve</p>
        <p class="text-[11px] text-slate-700 leading-relaxed">${Utils.escape(desc.praQueServe)}</p>
      </div>
    </div>`;
  },

  // V39.6.0 — 5 descrições padronizadas pra cada bloco do card.
  DESCRIPTIONS: {
    a1: {
      oQueE: 'Comparação entre a meta declarada do mês e o realizado até hoje, com projeção do fim do mês baseada no ritmo atual.',
      oQueMove: 'Decisão tática semanal: "vamos bater a meta este mês ou precisa apertar?". Define se o time vai relaxar ou correr.',
      deOndeVem: 'Meta vem das ofertas (RevOps → Ofertas → metaVendas). Realizado vem das vendas Hotmart aprovadas do mês (webhook salva em lj_hotmart_purchases). Projeção é cálculo simples: realizado × (dias do mês ÷ dias passados).',
      praQueServe: 'Saber em tempo real se o mês está dentro da meta — sem esperar fechar pra descobrir que estourou.'
    },
    a3: {
      oQueE: 'Decomposição da velocidade da máquina em 4 letras universais (V × C × L / T = R$/dia) que mostram a saúde estrutural da operação além do mês corrente.',
      oQueMove: 'Decisão estratégica de "onde mexer pra crescer": mais mídia (V), melhorar página/conversão (C), subir ticket (L), acelerar nutrição (T). Cada letra é uma frente diferente.',
      deOndeVem: 'V = visitors únicos com touchpoint em campanha do produto no mês (tracker LJ). C = visitors que viraram customer / visitors totais. L = ticket médio das vendas Hotmart aprovadas dos últimos 90 dias. T = mediana de (data da compra − primeiro touchpoint) dos customers.',
      praQueServe: 'Identificar qual letra está mais fraca vs mercado e atacar a alavanca mais barata. Evita gastar dinheiro à toa em V quando o problema real é C.'
    },
    sim: {
      oQueE: 'Cenário "e se" pra cada uma das 4 letras: o que acontece com R$/dia se você dobrar V, dobrar C, dobrar L ou cortar T pela metade.',
      oQueMove: 'Escolha de onde investir o próximo R$ disponível: não chuta — simula impacto de cada caminho antes de gastar.',
      deOndeVem: 'Mesma fórmula V × C × L / T. Cada simulação muda só 1 letra mantendo as outras 3 constantes, mostrando o impacto isolado em R$/dia.',
      praQueServe: 'Comparar 4 caminhos de crescimento de uma vez. Útil quando o CEO precisa decidir entre investir em mídia (V), consultoria de conversão (C), upsell (L) ou automação de nutrição (T).'
    },
    a4: {
      oQueE: 'Tríade de saúde do modelo de negócio. LTV = quanto cada cliente vale ao longo da vida. LTV:CAC = vale a pena adquirir? Payback = quanto tempo até recuperar o CAC? NRR = base atual está crescendo ou furando?',
      oQueMove: 'Decisão de "vale a pena escalar?". CFO consulta antes de captar capital, apertar custo ou abrir canal novo. É o que fundo de investimento olha pra decidir se compra a empresa.',
      deOndeVem: 'LTV = soma de vendas Hotmart aprovadas por customer / nº de customers (lj_hotmart_purchases agregado por lj_visitor_id). CAC = vem das ofertas declaradas em RevOps. Payback = CAC ÷ ticket médio. NRR proxy = 1 − (cancelamentos + refunds 30d ÷ customers ativos 30d), só pra produto com recorrência detectada.',
      praQueServe: 'Saber se o negócio "se paga" no longo prazo. Se LTV:CAC < 3:1 ou NRR < 100%, a operação está destruindo caixa silenciosamente — escalar piora.'
    },
    djow: {
      oQueE: 'Síntese narrativa que combina os 3 blocos anteriores (Situação do mês + Estrutura + Eficiência) numa história única, conectando sintoma (mês ruim) com raiz (gargalo estrutural) e saúde de longo prazo (capital).',
      oQueMove: 'Decisão informada: evita o CEO tratar sintoma (mês ruim) sem olhar a raiz (estrutura) ou ignorar custo (eficiência de capital). Conecta o operacional com o estratégico.',
      deOndeVem: 'Algoritmo local que cruza variância do mês (A1), gargalo da estrutura (A3) e ratios de eficiência (A4) pra gerar prosa coerente. Não chama IA externa — narrativa determinística baseada nos números cravados.',
      praQueServe: 'Falar a verdade ao CEO em uma frase: "esse mês estoura −36%, mas a raiz é conversão, não tráfego. No estrutural a operação é sólida." Em vez de 3 leituras desconectadas, 1 narrativa única.'
    }
  },

  // V39.5.0 — Bloco "Situação do mês" (A1/A2 dentro do card de Velocidade).
  // Meta declarada + realizado + projeção + calculadora de meta
  // (customers necessários × CAC = mídia necessária).
  _situacaoMesBlock(product, forecast, efficiency, faixaVisivel) {
    if (!forecast) {
      return `<div class="rounded-2xl bg-slate-50 border border-slate-200 border-l-4 border-l-slate-300 p-3">
        <p class="text-[10px] font-black text-slate-600 uppercase tracking-widest">Situação do mês</p>
        <p class="text-xs text-slate-600 mt-1">Carregando…</p>
      </div>`;
    }
    if (forecast.status === 'pending') {
      const label = forecast.salesChannel === 'crm' ? 'CRM' : 'Híbrido';
      return `<div class="rounded-2xl bg-violet-50 border border-violet-200 border-l-4 border-l-violet-500 p-3">
        <p class="text-[10px] font-black text-violet-700 uppercase tracking-widest">Situação do mês · ${label}</p>
        <p class="text-xs text-violet-900 mt-1">Em breve: depende do Fechamento mensal declarado.</p>
      </div>`;
    }
    if (forecast.status !== 'ok' || forecast.meta <= 0) {
      return `<div class="rounded-2xl bg-amber-50 border border-amber-200 border-l-4 border-l-amber-500 p-3">
        <p class="text-[10px] font-black text-amber-700 uppercase tracking-widest">Situação do mês</p>
        <p class="text-xs text-amber-900 mt-1">${forecast.meta <= 0 ? 'Defina a meta nas ofertas do produto pra ver Forecast × Realizado.' : 'Sem dados suficientes.'}</p>
        ${forecast.meta <= 0 ? `<button onclick="event.stopPropagation(); Actions.openProductOffers(${product.id})" class="mt-2 px-3 py-1.5 rounded-xl bg-amber-700 text-white text-xs font-black hover:bg-amber-800" style="color:#fff!important;">Definir meta →</button>` : ''}
      </div>`;
    }
    const semColor = { green: 'emerald', amber: 'amber', red: 'rose', gray: 'slate' }[forecast.semaforo] || 'slate';
    const semLabel = { green: 'Vai bater', amber: 'Risco', red: 'Não bate no ritmo atual', gray: '—' }[forecast.semaforo] || '';
    const restante = Math.max(0, forecast.meta - forecast.realized);

    // Calculadora de meta: customers necessários × CAC = mídia necessária
    const ltv = efficiency && efficiency.status === 'ok' ? efficiency.ltv : 0;
    const cac = efficiency && efficiency.status === 'ok' ? efficiency.cac : 0;
    const customersNecessarios = ltv > 0 && restante > 0 ? Math.ceil(restante / ltv) : 0;
    const midiaNecessaria = customersNecessarios > 0 && cac > 0 ? customersNecessarios * cac : 0;
    const calcDisponivel = ltv > 0 && cac > 0 && restante > 0;

    return `<div class="rounded-2xl bg-${semColor}-50 border border-${semColor}-200 border-l-4 border-l-${semColor}-500 p-3">
      <div class="flex items-center justify-between mb-2 gap-2">
        <p class="text-[10px] font-black text-${semColor}-700 uppercase tracking-widest flex items-center gap-1.5">
          <i data-lucide="calendar-clock" class="w-3.5 h-3.5"></i> Situação do mês · ${forecast.yyyymm || ''}
        </p>
        <div class="flex items-center gap-2">
          <p class="text-[10px] font-black text-${semColor}-700">${semLabel}</p>
          ${this._saberMaisBtn(product.id, 'a1')}
        </div>
      </div>
      ${this._descBox(product.id, 'a1', this.DESCRIPTIONS.a1)}
      <div class="grid grid-cols-3 gap-2 mb-2">
        <div class="bg-white rounded-xl border border-${semColor}-200 p-2 text-center">
          <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest">Meta</p>
          <p class="font-black text-sm text-slate-900 mt-0.5">${ForecastRealizadoEngine.formatMoney(forecast.meta)}</p>
        </div>
        <div class="bg-white rounded-xl border border-${semColor}-200 p-2 text-center">
          <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest">Realizado</p>
          <p class="font-black text-sm text-slate-900 mt-0.5">${ForecastRealizadoEngine.formatMoney(forecast.realized)}</p>
          <p class="text-[9px] text-slate-500">${forecast.progressPct}%</p>
        </div>
        <div class="bg-white rounded-xl border border-${semColor}-200 p-2 text-center">
          <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest">Projeção</p>
          <p class="font-black text-sm text-${semColor}-700 mt-0.5">${ForecastRealizadoEngine.formatMoney(forecast.projected)}</p>
          <p class="text-[9px] font-black text-${semColor}-700">${ForecastRealizadoEngine.formatPct(forecast.variance)}</p>
        </div>
      </div>
      <div class="h-1.5 rounded-full bg-white/80 overflow-hidden">
        <div class="h-full bg-${semColor}-500" style="width:${forecast.progressPct}%"></div>
      </div>
      ${calcDisponivel ? `<div class="mt-2 rounded-xl bg-white/70 border border-${semColor}-200 p-2.5">
        <p class="text-[10px] font-black text-${semColor}-700 uppercase tracking-widest mb-1 flex items-center gap-1.5">
          <i data-lucide="calculator" class="w-3 h-3"></i> Calculadora de meta
        </p>
        <p class="text-xs text-slate-800 leading-relaxed">
          Pra bater os ${ForecastRealizadoEngine.formatMoney(forecast.meta)} restantes, você precisa de <b>${customersNecessarios === 1 ? '1 customer novo' : `${customersNecessarios} customers novos`}</b> (LTV ${ForecastRealizadoEngine.formatMoney(ltv)}). Com CAC ${ForecastRealizadoEngine.formatMoney(cac)} = <b>${ForecastRealizadoEngine.formatMoney(midiaNecessaria)} de mídia necessária</b>.
        </p>
      </div>` : (restante > 0 && cac <= 0 && !faixaVisivel) ? `<div class="mt-2 rounded-xl bg-amber-50 border border-amber-200 p-2.5">
        <p class="text-[10px] text-amber-900">⚠ Defina CAC nas ofertas pra ver quanto de mídia precisa pra bater a meta.</p>
      </div>` : ''}
    </div>`;
  },

  // V39.5.0 — Costura do Djow: síntese das 3 leituras (mês + estrutura + capital).
  // V39.7.2 — Djow virou persona viva sempre presente. Narrativa adapta ao
  //           estado: 0 capítulos = silêncio honesto; 1 capítulo = espera ativa;
  //           2+ capítulos = síntese algorítmica completa (lógica antiga).
  _djowCostura(product, velocity, forecast, efficiency, cravadosParam) {
    if (!velocity || velocity.status !== 'ok') return '';

    const semVenda = (velocity.approvedCount || 0) === 0 && (velocity.customersCount || 0) === 0;
    const semTrafego = velocity.V === 0;
    const semMeta = !forecast || forecast.status !== 'ok' || forecast.meta <= 0;
    const cravados = typeof cravadosParam === 'number'
      ? cravadosParam
      : ((!semMeta ? 1 : 0) + (!semTrafego ? 1 : 0) + (!semVenda ? 1 : 0));

    let texto = '';

    if (cravados === 0) {
      texto = 'Ainda em silêncio — o produto começa a falar quando o primeiro dado cair (meta declarada, tráfego entrando ou venda confirmada). Volto a costurar quando tiver narrativa pra contar.';
    } else if (cravados === 1) {
      if (!semMeta) {
        texto = 'Por enquanto, só leio a meta declarada — sem tráfego rastreado nem venda confirmada, não dá pra cruzar com estrutura nem eficiência. Quando o primeiro touchpoint UTM cair e a primeira venda entrar, costuro a história completa.';
      } else if (!semTrafego) {
        texto = 'Por enquanto, só leio o tráfego que está entrando. Quando você declarar a meta do mês e a primeira venda cair, costuro com a Situação e a Eficiência de Capital.';
      } else if (!semVenda) {
        texto = 'Por enquanto, só leio as vendas confirmadas. Quando você declarar a meta do mês e o tráfego entrar rastreado, conecto os 3 capítulos numa síntese completa.';
      }
    } else {
      // 2+ capítulos cravados → síntese algorítmica
      const parts = [];

      if (forecast && forecast.status === 'ok' && forecast.meta > 0) {
        const semVerb = forecast.semaforo === 'green' ? 'bate' : forecast.semaforo === 'amber' ? 'aperta na meta' : 'estoura a meta';
        const variancePct = (forecast.variance * 100).toFixed(0);
        parts.push(`Esse mês ${semVerb} ${variancePct >= 0 ? '+' : ''}${variancePct}% vs meta.`);
        if (forecast.semaforo !== 'green' && velocity.gargalo) {
          const gargaloMap = {
            V: 'a raiz é volume — você tem pouco tráfego entrando',
            C: 'a raiz é estrutural — sua conversão está abaixo do mercado, então tráfego pago não resolve esse mês (exige otimização de página, prova social, atendimento)',
            L: 'a raiz é ticket — seu valor médio por venda é baixo, considere combo/upsell',
            T: 'a raiz é ciclo — o cliente demora demais pra decidir, considere nutrição automatizada'
          };
          parts.push(gargaloMap[velocity.gargalo] || '');
        }
      } else if (forecast && forecast.status === 'pending') {
        parts.push('Situação do mês depende do Fechamento mensal declarado (modo CRM/híbrido).');
      }

      if (efficiency && efficiency.status === 'ok' && efficiency.ltvCacRatio != null) {
        if (efficiency.ltvCacRatio >= 3) {
          parts.push(`No estrutural, a operação é sólida (LTV:CAC ${efficiency.ltvCacRatio.toFixed(1)}:1, Payback ${efficiency.paybackMonths != null && efficiency.paybackMonths < 0.1 ? 'instantâneo' : (efficiency.paybackMonths || 0).toFixed(1) + ' meses'}).`);
        } else if (efficiency.ltvCacRatio >= 2) {
          parts.push(`A eficiência de capital está apertada (LTV:CAC ${efficiency.ltvCacRatio.toFixed(1)}:1, abaixo do saudável 3:1) — modelo cobre o custo mas sem margem pra reinvestir.`);
        } else {
          parts.push(`⚠ A eficiência de capital é crítica (LTV:CAC ${efficiency.ltvCacRatio.toFixed(1)}:1, abaixo do saudável 3:1) — cada cliente novo subtrai valor. Antes de escalar tráfego, suba ticket ou corte CAC.`);
        }
      } else if (efficiency && efficiency.status === 'ok' && efficiency.cacSource === 'missing') {
        parts.push('Pra fechar o diagnóstico, defina o CAC esperado nas ofertas do produto — destrava LTV:CAC e Payback.');
      }

      if (efficiency && efficiency.status === 'ok' && efficiency.nrrStatus === 'ok' && efficiency.nrr != null) {
        if (efficiency.nrr < 1) {
          parts.push(`A base atual encolhe ${((1 - efficiency.nrr) * 100).toFixed(0)}% ao mês (NRR ${(efficiency.nrr * 100).toFixed(0)}%) — você está enchendo balde furado, trabalhe upsell e retenção.`);
        }
      }

      texto = parts.filter(Boolean).join(' ');
    }

    if (!texto) return '';

    return `<div class="rounded-2xl bg-gradient-to-br from-violet-50 to-pink-50 border border-violet-200 border-l-2 border-l-violet-500 p-4">
      <div class="flex items-center gap-2 mb-2">
        <span class="w-7 h-7 rounded-full bg-violet-700 grid place-items-center"><i data-lucide="sparkles" class="w-3.5 h-3.5 text-white"></i></span>
        <p class="text-[10px] font-black text-violet-800 uppercase tracking-widest">Djow · A Costura</p>
        <p class="text-[9px] text-violet-600 ml-auto">Síntese da Onda A</p>
        ${this._saberMaisBtn(product.id, 'djow')}
      </div>
      ${this._descBox(product.id, 'djow', this.DESCRIPTIONS.djow)}
      <p class="text-xs text-slate-800 leading-relaxed">${Utils.escape(texto)}</p>
    </div>`;
  },

  // V39.4.0 — Bloco "Eficiência de Capital" (A4): régua de 4 KPIs
  // (LTV / LTV:CAC / Payback / NRR) com semáforo + diagnóstico em prosa.
  _efficiencyBlock(product) {
    if (!window.EfficiencyEngine) return '';
    const e = EfficiencyEngine.forProduct(product.id);
    if (!e) return '';

    if (e.status === 'blocked') return '';
    if (e.status === 'loading') {
      return `<div class="rounded-2xl bg-slate-50 border border-slate-200 p-3 flex items-center gap-2">
        <div class="w-4 h-4 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin shrink-0"></div>
        <p class="text-xs text-slate-600">Carregando Eficiência de Capital…</p>
      </div>`;
    }
    if (e.status === 'pending') {
      const label = e.salesChannel === 'crm' ? 'CRM' : 'Híbrido';
      return `<div class="rounded-2xl bg-violet-50 border border-violet-200 border-l-4 border-l-violet-500 p-3">
        <p class="text-[10px] font-black text-violet-700 uppercase tracking-widest mb-0.5">Eficiência de Capital · ${label}</p>
        <p class="text-xs text-violet-900 leading-relaxed">Em breve: depende do Fechamento mensal declarado + cruzamento com RD.</p>
      </div>`;
    }
    if (e.status === 'error') {
      return `<div class="rounded-2xl bg-rose-50 border border-rose-200 border-l-4 border-l-rose-500 p-3">
        <p class="text-[10px] font-black text-rose-700 uppercase tracking-widest mb-0.5">Eficiência de Capital · Erro</p>
        <p class="text-xs text-rose-900">${Utils.escape(e.error || 'desconhecido')}</p>
      </div>`;
    }
    if (e.status === 'empty') {
      return `<div class="rounded-2xl bg-slate-50 border border-slate-200 border-l-4 border-l-slate-400 p-3">
        <p class="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-0.5">Eficiência de Capital</p>
        <p class="text-xs text-slate-700 leading-relaxed">Sem customers registrados ainda. Espere a primeira venda Hotmart cair pra ver LTV/CAC/Payback/NRR.</p>
      </div>`;
    }

    // ok — régua de 4 KPIs (Proposta B)
    const diag = EfficiencyEngine.diagnose(e);
    const ltvCacSem = EfficiencyEngine.ltvCacSemaforo(e.ltvCacRatio, e.benchmarks);
    const paybackSem = EfficiencyEngine.paybackSemaforo(e.paybackMonths, e.benchmarks);
    const nrrSem = EfficiencyEngine.nrrSemaforo(e.nrr, e.nrrStatus, e.benchmarks);
    const semColorMap = { green: 'emerald', emerald: 'emerald', amber: 'amber', red: 'rose', gray: 'slate' };
    const semLabelMap = { green: '✓ Saudável', emerald: '✓ Saudável', amber: '⚠ Atenção', red: '✕ Crítico', gray: '—' };

    const ltvCacColor = semColorMap[ltvCacSem];
    const paybackColor = semColorMap[paybackSem];
    const nrrColor = semColorMap[nrrSem];

    const cacLabel = e.cacSource === 'declared'
      ? `CAC ${EfficiencyEngine.fmtMoney(e.cac)}`
      : `<button onclick="event.stopPropagation(); Actions.openProductOffers(${product.id})" class="underline text-amber-700 font-black">Defina CAC</button>`;

    const paybackLabel = e.paybackMonths == null
      ? '—'
      : e.paybackMonths < 0.1 ? 'Instantâneo'
      : `${e.paybackMonths.toFixed(1)} meses`;

    const nrrLabel = e.nrrStatus === 'na'
      ? 'N/A'
      : e.nrrStatus === 'insufficient'
      ? '— calibrando'
      : e.nrr != null ? `${(e.nrr * 100).toFixed(0)}%` : '—';

    return `<div class="rounded-2xl bg-gradient-to-br from-violet-50/70 to-pink-50/70 border border-violet-200 border-l-2 border-l-violet-400 p-3">
      <div class="flex items-center justify-between mb-3 gap-2">
        <p class="text-[10px] font-black text-violet-700 uppercase tracking-widest flex items-center gap-1.5">
          <i data-lucide="gem" class="w-3.5 h-3.5"></i> Eficiência de Capital
        </p>
        <div class="flex items-center gap-2">
          <p class="text-[10px] text-slate-500">${e.customersCount} customers · últimos 12 meses</p>
          ${this._saberMaisBtn(product.id, 'a4')}
        </div>
      </div>
      ${this._descBox(product.id, 'a4', this.DESCRIPTIONS.a4)}
      <div class="grid grid-cols-4 gap-2 mb-3">
        <div class="bg-white rounded-xl border border-violet-200 p-2.5 text-center">
          <p class="text-[10px] font-black text-violet-700 uppercase tracking-widest">💎 LTV</p>
          <p class="font-black text-lg text-slate-900 mt-0.5 leading-tight">${EfficiencyEngine.fmtMoney(e.ltv)}</p>
          <p class="text-[9px] text-slate-500 mt-0.5">por cliente</p>
        </div>
        <div class="bg-white rounded-xl border border-${ltvCacColor}-200 p-2.5 text-center">
          <p class="text-[10px] font-black text-${ltvCacColor}-700 uppercase tracking-widest">⚖️ LTV:CAC</p>
          <p class="font-black text-lg text-slate-900 mt-0.5 leading-tight">${e.ltvCacRatio != null ? e.ltvCacRatio.toFixed(2) + ':1' : '—'}</p>
          <p class="text-[9px] text-${ltvCacColor}-700 mt-0.5 font-black">${e.ltvCacRatio != null ? semLabelMap[ltvCacSem] : cacLabel}</p>
        </div>
        <div class="bg-white rounded-xl border border-${paybackColor}-200 p-2.5 text-center">
          <p class="text-[10px] font-black text-${paybackColor}-700 uppercase tracking-widest">⏱️ Payback</p>
          <p class="font-black text-lg text-slate-900 mt-0.5 leading-tight">${paybackLabel}</p>
          <p class="text-[9px] text-${paybackColor}-700 mt-0.5 font-black">${e.paybackMonths != null ? semLabelMap[paybackSem] : '—'}</p>
        </div>
        <div class="bg-white rounded-xl border border-${nrrColor}-200 p-2.5 text-center">
          <p class="text-[10px] font-black text-${nrrColor}-700 uppercase tracking-widest">🌱 NRR</p>
          <p class="font-black text-lg text-slate-900 mt-0.5 leading-tight">${nrrLabel}</p>
          <p class="text-[9px] text-${nrrColor}-700 mt-0.5 font-black">${e.hasSubscriptions && e.nrrStatus === 'ok' ? semLabelMap[nrrSem] : e.hasSubscriptions ? 'calibrando' : 'sem recorrência'}</p>
        </div>
      </div>
      <div class="rounded-xl bg-white/70 border border-violet-200 p-2.5">
        <p class="text-[10px] font-black text-violet-700 uppercase tracking-widest mb-1">Diagnóstico A4</p>
        <p class="text-xs text-slate-800 leading-relaxed">${Utils.escape(diag)}</p>
      </div>
    </div>`;
  },

  _simRow(label, base, novo) {
    const delta = base > 0 ? ((novo - base) / base) : 0;
    const tone = delta > 0 ? 'emerald' : 'slate';
    return `<div class="bg-${tone}-50 border border-${tone}-200 rounded-xl px-3 py-2">
      <p class="text-[10px] font-black text-${tone}-700 uppercase tracking-widest">${label}</p>
      <div class="flex items-center justify-between gap-2 mt-1">
        <p class="text-sm font-black text-slate-900">${PipelineVelocityEngine.fmtMoney(novo)}/dia</p>
        <p class="text-[11px] font-black text-${tone}-700">${delta > 0 ? '+' : ''}${(delta * 100).toFixed(0)}%</p>
      </div>
    </div>`;
  }
};

window.RevopsVelocityModule = RevopsVelocityModule;
