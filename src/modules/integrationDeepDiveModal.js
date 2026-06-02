// V35.6.0-alpha5 — Modal nested "X + LeadJourney" (aprofundamento).
//
// Aberto quando o user clica no ícone (?) dentro do ConnectionStatusCard.
// Mostra o fluxo de dados real de cada integração com o LJ — o que entra,
// o que sai, frequência, como o ciclo funciona em loop e o que precisa
// estar configurado.
//
// Z-index acima dos modais de conexão (z-[95]) — fica por cima.
// Accent color = cor brand da integração (não da aba).

window.IntegrationDeepDiveModal = {
  // Conteúdo declarativo por integração. Adicionar nova entrada aqui pra
  // suportar nova integração no (?). Categoria IPI fixa pra escolher
  // o tom do header.
  CONTENT: {
    'rd': {
      title: 'RD Station + LeadJourney',
      subtitle: 'CRM e Marketing dialogam em loop com o Journey. Vida própria nos dois lados, sincronização contínua.',
      category: 'iterar',
      accentColor: 'pink',
      icon: 'zap',
      dataFlow: {
        incoming: [
          'Deals criados, atualizados, ganhos ou perdidos (CRM)',
          'Contatos novos e atualizações de campos',
          'Segmentações e tags do RD Marketing',
          'Leads capturados em Landing Pages do RD'
        ],
        outgoing: [
          'Tags aplicadas em contatos sincronizados',
          'Atualizações de campos custom (Score, Stage LJ)',
          'V34.8: criação/update de deals quando o LJ dispara'
        ],
        frequency: 'Tempo real (webhook) + reconciliação 15min (V34.8)'
      },
      howItWorks: [
        'Você cadastra Token CRM + Tempo Real CRM + RD Marketing no modal de conexão.',
        'O LJ escuta o webhook do RD em `/integrations/webhooks` e processa `crm_deal_*` em segundos.',
        'A cada 15 min, o Reconciliation Engine compara contatos LJ vs RD e resolve divergências.',
        'Quando o LJ promove um Lead → Customer, sincroniza tag/deal correspondente no RD.'
      ],
      requirements: [
        'Token do CRM (PAT) com escopo de leitura+escrita em deals/contatos',
        'OAuth do CRM ativo (pra receber webhooks em tempo real)',
        'OAuth do RD Marketing (pra capturar leads de LP automaticamente)'
      ]
    },
    'clickup': {
      title: 'ClickUp + LeadJourney',
      subtitle: 'O LJ orquestra; o ClickUp executa. O time entra no ClickUp, fecha tasks, e o status volta pro Journey.',
      category: 'iterar',
      accentColor: 'violet',
      icon: 'check-square',
      dataFlow: {
        incoming: [
          'Status de tasks (mudança de stage no ClickUp)',
          'Conclusão de subtasks',
          'Comentários e mudanças de assignee (futuro)'
        ],
        outgoing: [
          'Criação de hierarchy: Produto > Campanha > Ação > Tarefa',
          'Renomeação de Produto/Campanha/Ação propaga pro ClickUp',
          'Delete cuidadoso com 4 regras (não pode regredir)'
        ],
        frequency: 'Tempo real ao criar Ação no LJ + polling de status periódico'
      },
      howItWorks: [
        'Você escolhe a Raiz LJ no ClickUp (Space, Folder ou List) no Setup Wizard.',
        'Cada Produto LJ vira Folder; Campanha vira List; Ação vira Task; Tarefa vira Subtask.',
        'Quando você cria Ação no LJ, a Task aparece no ClickUp em segundos.',
        'Quando o time fecha a Task no ClickUp, o LJ atualiza o status da Ação.',
        'Renomear no ClickUp é OK (LJ acha pelo ID). Deletar a Raiz é catastrófico.'
      ],
      requirements: [
        'Workspace ClickUp escolhido',
        'Token: OAuth (recomendado, cliente cria próprio OAuth App) ou Personal API Token',
        'Raiz LJ definida (Space / Folder / List) via Setup Wizard'
      ]
    },
    'google-ads': {
      title: 'Google Ads + LeadJourney',
      subtitle: 'Investimento, ROAS e conversões alimentam o LJ. Read-only — o LJ não escreve no Google Ads.',
      category: 'injetar',
      accentColor: 'amber',
      icon: 'search',
      dataFlow: {
        incoming: [
          'Gasto diário por campanha (Search, Display, YouTube)',
          'Conversões e custo por conversão',
          'Impressões, cliques, CTR, CPL',
          'Conta selecionada (Customer ID) via OAuth'
        ],
        outgoing: [
          'Nenhum. Integração somente-leitura por enquanto.'
        ],
        frequency: 'Import diário em background (próxima sincronização ~24h após conexão)'
      },
      howItWorks: [
        'Você cadastra Client ID + Client Secret + Developer Token no wizard.',
        'Autoriza o LJ na sua conta Google via OAuth (popup).',
        'O LJ chama `customers:listAccessibleCustomers` pra você escolher qual conta sincronizar.',
        'Refresh token salvo criptografado (AES-256-GCM) por tenant.',
        'Access token renovado automaticamente quando expira (5min antes).'
      ],
      requirements: [
        'OAuth Client criado no Google Cloud Console',
        'Developer Token aprovado pelo Google (1-7 dias)',
        'Conta Google Ads ativa (ou Manager Account com MCC)'
      ]
    },
    'hotmart': {
      title: 'Hotmart + LeadJourney',
      subtitle: 'Cada compra confirmada no Hotmart promove o lead a customer no LJ automaticamente.',
      category: 'injetar',
      accentColor: 'orange',
      icon: 'dollar-sign',
      dataFlow: {
        incoming: [
          'PURCHASE_APPROVED / PURCHASE_COMPLETE (compra aprovada)',
          'PURCHASE_REFUNDED / PURCHASE_CHARGEBACK (estorno)',
          'PURCHASE_CANCELED / PURCHASE_OUT_OF_SHOPPING_CART (abandono)',
          'SUBSCRIPTION_CANCELLATION / SWITCH_PLAN (recorrência)'
        ],
        outgoing: [
          'Nenhum. Webhook é receive-only.'
        ],
        frequency: 'Tempo real via webhook (segundos após a compra)'
      },
      howItWorks: [
        'Você cadastra o HOTTOK do produto no LJ (criptografado AES-256-GCM por tenant).',
        'O LJ gera uma URL de webhook única por tenant.',
        'Você cola essa URL no Hotmart → Ferramentas → Webhook.',
        'Cada compra dispara o webhook; o LJ valida o HOTTOK e marca o lead como customer.',
        'Recompras e cancelamentos são registrados no audit log do visitor.'
      ],
      requirements: [
        'HOTTOK do produto Hotmart (obrigatório)',
        'URL de webhook colada no Hotmart com 10 eventos selecionados',
        'OAuth opcional (Sales API) pra puxar histórico de até 365 dias'
      ]
    },
    'meta-ads': {
      title: 'Meta Ads + LeadJourney',
      subtitle: 'Em breve. Vai alimentar investimento, conversões e CAC por campanha (Facebook + Instagram).',
      category: 'injetar',
      accentColor: 'sky',
      icon: 'megaphone',
      dataFlow: {
        incoming: ['Em breve — gasto, conversões, CAC, impressões.'],
        outgoing: ['Nenhum — read-only.'],
        frequency: 'Em breve.'
      },
      howItWorks: ['Integração ainda em desenvolvimento.'],
      requirements: ['Aguardando habilitação.']
    },
    'stripe': {
      title: 'Stripe + LeadJourney',
      subtitle: 'Em breve. Vai alimentar vendas reais, reembolsos e MRR por produto/oferta.',
      category: 'injetar',
      accentColor: 'violet',
      icon: 'credit-card',
      dataFlow: {
        incoming: ['Em breve — payment_intent.succeeded, charges, refunds, subscriptions.'],
        outgoing: ['Nenhum — read-only.'],
        frequency: 'Em breve.'
      },
      howItWorks: ['Integração ainda em desenvolvimento.'],
      requirements: ['Aguardando habilitação.']
    }
  },

  CATEGORY_TONE: {
    injetar:  { tone: '#0A1F44', label: 'Injetar' },
    propagar: { tone: '#0E3A6E', label: 'Propagar' },
    iterar:   { tone: '#1565C0', label: 'Iterar' }
  },

  ACCENT_HEX: {
    pink:   { bg: 'rgba(244,114,182,0.18)', text: '#fbcfe8' },
    violet: { bg: 'rgba(167,139,250,0.18)', text: '#ddd6fe' },
    amber:  { bg: 'rgba(245,158,11,0.18)',  text: '#fde68a' },
    orange: { bg: 'rgba(249,115,22,0.18)',  text: '#fed7aa' },
    sky:    { bg: 'rgba(56,189,248,0.18)',  text: '#bae6fd' }
  },

  render() {
    const id = App.state.integrationDeepDiveOpen;
    if (!id) return '';

    const c = this.CONTENT[id];
    if (!c) return '';

    const catTone = this.CATEGORY_TONE[c.category] || this.CATEGORY_TONE.injetar;
    const accent = this.ACCENT_HEX[c.accentColor] || this.ACCENT_HEX.violet;

    return `<div class="fixed inset-0 z-[95] grid place-items-center p-4"
      style="background: rgba(2,10,25,0.88); backdrop-filter: blur(8px);"
      onclick="if(event.target===this) Actions.closeIntegrationDeepDive()">
      <div class="w-full max-w-3xl rounded-3xl border-2 shadow-2xl overflow-hidden"
        style="border-color: ${accent.text}33; background: linear-gradient(135deg, ${catTone.tone} 0%, #000814 100%);">

        <!-- HEADER -->
        <div class="border-b border-white/10 px-6 py-5 flex items-start justify-between gap-3"
          style="background: linear-gradient(90deg, ${accent.bg} 0%, rgba(0,0,0,0) 100%);">
          <div class="min-w-0 flex items-start gap-3">
            <span class="w-11 h-11 rounded-2xl grid place-items-center shrink-0"
              style="background: ${accent.bg}; color: ${accent.text};">
              <i data-lucide="${c.icon}" class="w-5 h-5"></i>
            </span>
            <div class="min-w-0">
              <p class="text-[10px] font-black uppercase tracking-widest" style="color: ${accent.text};">
                Aprofundamento · ${catTone.label}
              </p>
              <h2 class="text-xl font-black text-white mt-0.5 leading-tight">${Utils.escape(c.title)}</h2>
              <p class="text-[12px] text-slate-300 mt-1">${Utils.escape(c.subtitle)}</p>
            </div>
          </div>
          <button onclick="Actions.closeIntegrationDeepDive()" class="shrink-0 w-9 h-9 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-white grid place-items-center">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <!-- BODY -->
        <div class="p-6 space-y-5 max-h-[72vh] overflow-y-auto">

          <!-- DATA FLOW DIAGRAM -->
          <div class="grid md:grid-cols-3 gap-3">
            ${this._flowCard({
              kicker: 'Entra no LJ',
              icon: 'arrow-down-circle',
              items: c.dataFlow.incoming,
              accent
            })}
            ${this._flowCard({
              kicker: 'Sai do LJ',
              icon: 'arrow-up-circle',
              items: c.dataFlow.outgoing,
              accent
            })}
            ${this._flowCard({
              kicker: 'Frequência',
              icon: 'clock',
              items: [c.dataFlow.frequency],
              accent
            })}
          </div>

          <!-- HOW IT WORKS -->
          <div class="rounded-2xl border border-white/10 p-5"
            style="background: rgba(0,8,20,0.55);">
            <p class="text-[11px] font-black uppercase tracking-widest mb-3 inline-flex items-center gap-1.5"
              style="color: ${accent.text};">
              <i data-lucide="repeat" class="w-3.5 h-3.5"></i> Como funciona o loop
            </p>
            <ol class="space-y-2 text-[12px] text-slate-200 list-decimal pl-5">
              ${c.howItWorks.map(step => `<li class="leading-relaxed">${Utils.escape(step)}</li>`).join('')}
            </ol>
          </div>

          <!-- REQUIREMENTS -->
          <div class="rounded-2xl border border-white/10 p-5"
            style="background: rgba(0,8,20,0.55);">
            <p class="text-[11px] font-black uppercase tracking-widest mb-3 inline-flex items-center gap-1.5"
              style="color: ${accent.text};">
              <i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i> Pré-requisitos pra funcionar
            </p>
            <ul class="space-y-1.5 text-[12px] text-slate-200">
              ${c.requirements.map(req => `<li class="flex items-start gap-2">
                <i data-lucide="dot" class="w-4 h-4 shrink-0" style="color: ${accent.text};"></i>
                <span class="leading-relaxed">${Utils.escape(req)}</span>
              </li>`).join('')}
            </ul>
          </div>

          <!-- FOOTER -->
          <div class="flex justify-end pt-2 border-t border-white/10">
            <button onclick="Actions.closeIntegrationDeepDive()" class="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-black inline-flex items-center gap-2">
              <i data-lucide="check" class="w-4 h-4"></i> Entendi
            </button>
          </div>
        </div>
      </div>
    </div>`;
  },

  _flowCard({ kicker, icon, items, accent }) {
    return `<div class="rounded-2xl border border-white/10 p-4 flex flex-col gap-2"
      style="background: rgba(0,8,20,0.55);">
      <div class="flex items-center gap-2">
        <span class="w-7 h-7 rounded-lg grid place-items-center"
          style="background: ${accent.bg}; color: ${accent.text};">
          <i data-lucide="${icon}" class="w-3.5 h-3.5"></i>
        </span>
        <p class="text-[10px] font-black uppercase tracking-widest"
          style="color: ${accent.text};">${Utils.escape(kicker)}</p>
      </div>
      <ul class="space-y-1 text-[11px] text-slate-300">
        ${items.map(it => `<li class="leading-snug flex items-start gap-1.5">
          <span style="color: ${accent.text};">·</span>
          <span>${Utils.escape(it)}</span>
        </li>`).join('')}
      </ul>
    </div>`;
  }
};
