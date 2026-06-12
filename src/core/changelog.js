// V35.3.8 — Changelog do LJ.
//
// Lista das releases recentes (mais nova no topo). Toda nova versão deve
// ganhar uma entry aqui — o sininho da Home compara `window.LJVersion` com
// `App.state.lastSeenVersion` e mostra as releases não vistas como
// notificações no modal de Notificações.
//
// Formato:
//   { version, date, title, bullets[] }
//   - version: 'V35.3.7' (string)
//   - date: 'YYYY-MM-DD'
//   - title: 1 linha (até ~80 chars)
//   - bullets: 2-5 frases curtas, foco no que muda pro usuário
//
// IMPORTANTE: bullets escritos pro usuário final, não pra dev.
//   Bom:  "Importação de CSV agora tem wizard com 4 steps"
//   Ruim: "Refatorada função executeLeadWizardImport pra chunking"

window.LJChangelog = [
  {
    version: 'V37.5.2',
    date: '2026-06-12',
    title: 'Pin-Up — click na notificação navega pro pin + cluster quando >5 na tela',
    bullets: [
      'Click na notificação "Pin cravado pra você" agora navega pra URL do pin. Se já está na mesma página, só abre o modal direto. Se está em outra, persiste o pinId no sessionStorage e abre o modal após a página carregar.',
      'Cluster de pins: quando há mais de 5 pins na mesma tela, em vez de poluir com marcadores espalhados aparece um único badge violet no topo-direito: "X pins nesta tela" + count de não-vistos. Click expande dropdown com lista de todos os pins (creator + preview do texto + dot violet se não-visto).',
      '"Mostrar todos no mapa" no header do dropdown volta pra visualização dos marcadores individuais — útil quando o cliente quer ver a posição geográfica de cada pin na tela.',
      'Pin lido vs não-lido: dot violet pequeno indica quem ainda não foi marcado como visto. Click no item do dropdown abre o modal completo e auto-marca como visto.',
      'Action nova Actions.handleNotificationClick(id) é o entry point universal pra click em notification — special-case pra pin, default mark as read pro resto. Vai escalar pra mais kinds futuros (mention em comentário, KR transferido, etc).'
    ]
  },
  {
    version: 'V37.5.1',
    date: '2026-06-12',
    title: 'Sininho único (V2 absorve contadores legados) + TopBar global em todas as páginas',
    bullets: [
      'Os 2 sininhos do header viraram 1 só. O sininho V2 agora soma no badge: notifications novas (V37.4) + contadores legados (conciliação RD + import + releases LJ + Ads órfãs + GA4 + fechamento mensal). Click abre o drawer V2 estilo Linear — modal antigo de notificações some.',
      'Severity color do badge prioriza V2 critical, depois warning (V2 ou legado), info do V2 e cinza quando vazio.',
      'Menu de search + sininho + pin + data movido pra TopBar.js global — agora aparece em TODAS as páginas (Home, Produtos, Campanhas, Ações, Resultados, Leads, Dashboard, RevOps). Antes só existia na Home.',
      'TopBar fixo no topo-direito (fixed, top:3, right:4, z-30) com fundo slate-900/90 backdrop blur. Hidratação dos counters (reconciliation, RD webhook, KR snapshots, GA4, governance) também migrou pro TopBar — atualizado em qualquer página, não só na Home.',
      'Botões compactados pra caber bem na barra: sininho 32px, pin 32px, search 32px, data pill. Cores escuras pra contrastar com fundo dark.'
    ]
  },
  {
    version: 'V37.5.0',
    date: '2026-06-12',
    title: 'Pin-Up MVP — comentários cravados no contexto, estilo Figma',
    bullets: [
      'Atalho Alt+P (ou click no botão de pin ao lado do sininho) ativa o modo "colocar pin". Cursor vira crosshair, overlay violet com instrução aparece no topo. Click em qualquer ponto da tela captura coordenadas relativas (x,y%).',
      'Modal de criar abre: multiselect dos membros do tenant + textarea 400 chars + botões Cancelar / Cravar pin. Submit salva no banco e dispara notification handoff/warning pros marcados.',
      'Quem é marcado recebe alerta no sininho V2 ("Pin cravado pra você"). Por enquanto, quem entra na página vê o pin como marcador violet com iniciais do criador.',
      'Click no pin abre modal de visualização: nome de quem cravou, data, texto completo, botão "Marcar como visto" + "Arquivar". Auto-marca como visto quando abre.',
      'Visível só pros marcados + criador. Auto-expira em 7 dias (server-side expires_at). Arquivar manualmente esconde pra todos.',
      'ESC cancela o modo de colocar pin. Pin já aplicado é renderizado em overlay fixed acima do conteúdo, com pointer-events controlados pra não atrapalhar interação com a UI por baixo.',
      'Endpoints novos: POST /api/pin-create (com notification emit automática), GET /api/pins-list?targetUrl=, POST /api/pin-action (mark_seen | archive). Migration em /api/admin-migrate-pins (Master roda uma vez).'
    ]
  },
  {
    version: 'V37.4.5',
    date: '2026-06-12',
    title: 'Sininho V2 absorve alertas legados (ClickUp/RD/Reconciliation) com dedup automático',
    bullets: [
      'NotificationSync.run() roda a cada 1min em background e checa estado de App.state pra emitir notifications dedupadas: ClickUp desconectado (crítico), RD webhook com falhas (warning ou crítico se ≥10), Reconciliation RD↔LJ pendente (warning).',
      'LJEmitDedup() — variante do emit que evita criar duplicada se já existe notification igual nas últimas 24h (mesma kind + entity_kind + entity_id, não-done). Garante que sininho V2 não vira spam.',
      'Audience inteligente: alertas críticos vão pra tenant_wide (todos veem), alertas de integração e operacionais vão só pro role:owner (só Admin Master vê).',
      'Quando Felipe reconectar ClickUp ou resolver os webhooks RD, a notification existente NÃO se auto-resolve — Admin Master arquiva manualmente quando confirmar OK. Auto-resolve fica pra V37.4.7.',
      'Endpoint /api/notification-emit ganha flag dedup=true que checa antes de inserir. Mantém comportamento default sem dedup pros disparos normais (criação de entidade etc).'
    ]
  },
  {
    version: 'V37.4.4',
    date: '2026-06-12',
    title: 'Bom Dia card na Home + notification clusters (sininho ganha cara de SaaS premium)',
    bullets: [
      'Card "Bom Dia" aparece na Home na primeira visita do dia. Mostra resumo desde ontem 18h: total de novidades + breakdown por severidade (crítico/atenção/info) + top categorias + até 3 highlights pra olhar primeiro. Saudação muda conforme a hora (Bom dia / Boa tarde / Boa noite) com emoji.',
      'Cliente abre o LJ, lê o card em 5 segundos e já sabe se "tá tudo bem" ou se tem incêndio. Click em "Ver tudo no sininho" abre o drawer de notificações direto.',
      '"Vou ver depois" ou X dispensa o card pelo dia inteiro (localStorage lj_bomdia_last_seen). Volta amanhã.',
      'Notification clusters: quando 3+ notifications da mesma fonte (mesma pessoa ou sistema) + mesma categoria chegam em até 4h, viram um cluster colapsável no sininho. Exemplo: "8 eventos da mesma fonte nas últimas 4h" — click expande pra ver cada um.',
      'Reduz drasticamente o ruído visual em dias movimentados. Pedro fechando 8 tasks vira 1 linha, não 8.',
      'Endpoint /api/notifications-daily-summary calcula a agregação por user no tenant ativo. Aceita ?since=ISO_DATE pra customizar a janela.'
    ]
  },
  {
    version: 'V37.4.3',
    date: '2026-06-12',
    title: 'Sininho V2 ganha vida: emit helper + 3 disparos automáticos de criação',
    bullets: [
      'window.LJEmit() — helper client-side pra disparar notification. Chamado em Actions.createProduct, Actions.createCampaign e Actions.createAction. Toda criação de entidade já populariza o sininho V2 do tenant inteiro.',
      'POST /api/notification-emit — endpoint server-side. Auth necessário. Audience "tenant_wide" ou {role:"owner"} restritos a Master ou Owner; user comum só consegue emitir pra si próprio ou pra user específico.',
      'lib/emit-notification.js — wrapper sobre createNotification que silencia erros e padroniza payload, pra usar em outros endpoints API quando integração desconectar, webhook falhar, etc.',
      'Refresh automático do sininho 500ms após emitir — cliente vê o badge contar sem precisar reabrir o drawer.',
      'Próximos disparos (V37.4.3.x conforme demanda): assignment de task, KR drift, integração desconectada, próxima entrega, capacity alta, etc.'
    ]
  },
  {
    version: 'V37.4.2',
    date: '2026-06-12',
    title: 'Sininho refatorado — drawer estilo Linear com 3 abas, filtros, triagem rápida',
    bullets: [
      'Sininho V2 aparece ao lado do sininho atual no header — coexistem por enquanto. Quando os alertas existentes forem migrados pro modelo novo (V37.4.1), o antigo sai.',
      'Cor do badge muda conforme severidade do que tem dentro: cinza vazio, azul info, âmbar warning, rosé pulsante quando há crítico não lido. Cliente olha de longe e já sabe se "tem incêndio".',
      'Click no sininho abre drawer lateral à direita com 3 abas: Caixa de entrada / Salvos / Arquivo. Filtros por categoria (handoff/eventos/estado/operacional/integração/saúde) + severidade.',
      'Triagem rápida estilo Linear: hover na notificação mostra 3 ações (salvar, adiar, marcar como feito). Click marca como lido. Snooze pergunta entre 1h / amanhã 9h / segunda 9h / 1 semana.',
      'Botão "Marcar tudo como lido" no rodapé. Contador "X ativas · Y arquivadas". Empty states amigáveis por aba (caixa vazia, sem salvos, sem arquivo).',
      'Mais nada está GERANDO notification ainda — a infra está pronta mas precisa V37.4.3 disparar events nos 40+ pontos do app. Mesmo assim, hoje cliente já pode VER o sininho V2 funcionando (vazio).'
    ]
  },
  {
    version: 'V37.4.0',
    date: '2026-06-12',
    title: 'Sininho expandido — infra de notifications (tabela + engine + endpoints)',
    bullets: [
      'Fundação do sininho novo cravada. Tabela `notifications` no tenant DB com estado independente por user: read_at, done_at, saved_at, snoozed_until. Cada linha representa 1 notification pra 1 user específico (audience expandido na criação).',
      'lib/notification-engine.js expõe createNotification, listNotifications, countByStatus, updateNotificationState, markAllAsRead. Audience pode ser user_id direto, array, "tenant_wide" (todos members) ou {role: "owner"} (filtrado por role).',
      '6 categorias (handoff/event/state/operational/integration/health) e 3 severidades (info/warning/critical). kind segue convenção "categoria.evento" (ex: "handoff.task_assigned").',
      'Migration cravada em /api/admin-migrate-notifications (só Master roda): cria tabela + 3 índices estratégicos (inbox por user, entity ref, severity unread).',
      'Endpoints novos: GET /api/notifications-list (com filtros status/category/severity) + POST /api/notification-update (read/unread/done/save/snooze/unsnooze + bulk mark_all_read).',
      'Frontend state + actions prontos (loadNotifications, toggleNotificationsPanel, updateNotification, etc) — UI do sininho refatorada vem na V37.4.2.'
    ]
  },
  {
    version: 'V37.3.4',
    date: '2026-06-12',
    title: 'Frontend role-gating — menu de configurações esconde por permissão',
    bullets: [
      'src/core/permissionsClient.js expõe window.LJCan(key), window.LJRole(), window.LJIsMaster() — helpers globais pra qualquer template checar permissão antes de renderizar botão/seção.',
      'GET /api/my-permissions retorna role + overrides + effective do user logado. Backend usa resolveUserPermissions() do lib/permission-check.js.',
      'Action loadMyPermissions() chamada automaticamente em _refreshCurrentUserInfo (boot pós-auth-me). Popula App.state.userPermissions sem bloquear render — fallback permissivo (LJCan retorna true) enquanto não carrega pra evitar flash de UI bloqueada.',
      'Menu lateral de Configurações começa a esconder seções por permissão: "Membros do Tenant" só pra Master ou Owner; "Integrações" e "Agentes Externos" só pra quem tem ops.integracoes; "IA" (Score Engine config) só pra quem tem edit.score; "Meu Banco" só pra quem tem admin.editar_db_tenant.',
      'Próximos pontos do role-gating ficam pra V37.3.5+ conforme demanda: botões de editar no Mapa, seção DRE no Dashboard, etc. Infra está pronta — basta usar LJCan() onde precisar.'
    ]
  },
  {
    version: 'V37.3.3',
    date: '2026-06-12',
    title: 'Convite de membros via link mágico — email automático quando SMTP ativo, fallback "Copiar link"',
    bullets: [
      'Admin Master clica em "Convidar membro", preenche email + role, e o sistema gera link mágico com 7 dias de validade. Se SMTP estiver configurado, vai email automático com identidade visual LJ. Senão, mostra o link pra cliente copiar e enviar pelo canal preferido (WhatsApp, Slack, etc).',
      'Página /accept-invite.html é standalone — convidado abre, escolhe username + senha (mínimo 8 chars) e nome de exibição. Ao confirmar, conta é criada + adicionada como membro do tenant com role e permissões custom do convite. Login automático após aceitar.',
      'Re-emitir convite pendente: card de convite tem botão "Copiar link" que gera novo token + retorna URL. Token antigo é substituído (não duplica linha na tabela).',
      'Proteções: email já membro do tenant retorna 409. Username já em uso retorna 409. Email tem conta existente com senha → bloqueia o accept e pede login normal (não dá pra resetar senha via convite). Convite expirado → 410.',
      '3 endpoints novos: POST /api/tenant-invite-create (auth Master/Owner), GET /api/tenant-invite-info?token=xxx (público), POST /api/tenant-invite-accept (público).',
      'Sem dependência do Resend ativo — convite funciona 100% mesmo com SMTP off. Quando Felipe plugar a RESEND_API_KEY no Railway, o email automático destrava sozinho.'
    ]
  },
  {
    version: 'V37.3.2',
    date: '2026-06-12',
    title: 'Configurações → Membros do Tenant: listar, editar role, ajustar permissões custom',
    bullets: [
      'Nova seção "Membros do Tenant" no menu Configurações. Lista todos os membros ativos com avatar, email, role (Admin Master / Gerente / Usuário) e quantas permissões custom estão configuradas.',
      'Click em "Editar" abre modal com seleção de role base + checkboxes de cada permissão. Linhas amarelas indicam quando uma permissão foi sobrescrita do template do role — clica "resetar" pra voltar ao default.',
      'Botão "Remover" libera tirar membro do tenant (usuário fica cadastrado mas perde acesso). Protegido: Admin Master do tenant não pode ser removido nem rebaixado por aqui.',
      'Convites pendentes (V37.3.3) aparecem em card amber separado com prazo de expiração e botão "Copiar link" (V37.3.3 traz o link funcional).',
      'Endpoints novos: GET /api/tenant-members-list, POST /api/tenant-member-update, POST /api/tenant-member-remove. Todos checam permissão Master OU owner do tenant.'
    ]
  },
  {
    version: 'V37.3.1',
    date: '2026-06-12',
    title: 'Permission system: 3 roles (Master/Gerente/Usuário) + overrides granulares + DB',
    bullets: [
      'Backend ganha lib/permission-engine.js com 3 templates de role: owner (tudo), manager (sem integrações/Score Engine + edita Mapa) e user (só leitura no Mapa + tasks próprias).',
      'Overrides granulares por user — Master pode pegar um Usuário e dar acesso de leitura ao DRE, ou pegar um Gerente e tirar acesso ao Mapa. Armazenado em tenant_members.permissions_overrides JSONB.',
      'lib/permission-check.js expõe checkPermission(req, res, key) pra usar em endpoints API. Master LJ (felipealvesverde@) bypassa TUDO. Tenant Member tem role checado contra a chave pedida.',
      'Migration cravada em /api/admin-migrate-permissions (só Master roda): adiciona coluna permissions_overrides em tenant_members + cria tabela tenant_invites pra próximo passo do convite.',
      '26 permission keys cobrindo visualização, edição, operações, administração e Djow. Ver lib/permission-engine.js → PERMISSION_KEYS.'
    ]
  },
  {
    version: 'V37.3.0',
    date: '2026-06-12',
    title: 'SMTP infra (Resend) — stub plug-and-play + templates de convite e recovery',
    bullets: [
      'Esqueleto do envio de email cravado. `lib/email-client.js` expõe sendEmail({ to, subject, html, text }) que chama Resend quando RESEND_API_KEY está setada, ou simula envio no console quando não está. Zero refactor pra ativar — só preencher 2 env vars.',
      'Templates HTML iniciais em `lib/email-templates.js`: convite de membro + recovery de senha. Design simples, inline-CSS pra compatibilidade Gmail/Outlook, com identidade visual LJ.',
      'Pendência operacional: criar conta em resend.com, gerar API key e setar RESEND_API_KEY + EMAIL_FROM no Railway. Enquanto não setado, todo envio loga "[email-client] ⚠ RESEND_API_KEY não configurada — email SIMULADO".'
    ]
  },
  {
    version: 'V37.2.5',
    date: '2026-06-12',
    title: 'Cards de pessoa ganham side accent (cor do avatar) + hover com movimento',
    bullets: [
      'Cada card de pessoa no grid Tarefas › Por Pessoa ganha faixa lateral esquerda de 4px com a cor do avatar do ClickUp. Identidade visual da pessoa aparece tanto no avatar quanto na borda — cliente identifica de relance.',
      'Hover sutil: card sobe 2px e ganha sombra mais densa em 200ms. Comunica que é clicável sem agressividade.',
      'Lei do design diretor cravada na memória: TODO card novo no LJ a partir de agora recebe side accent seguindo a paleta semântica (Marketing rosa, Vendas ciano, CS azul, Receita amarelo, RevOps roxo). Cards neutros usam violet default. Cards antigos podem ser migrados aos poucos.'
    ]
  },
  {
    version: 'V37.2.4',
    date: '2026-06-12',
    title: 'Tarefas Por Pessoa: contador de cobertura agora bate com Total Ativo',
    bullets: [
      'O contador "X de Y tarefas abertas têm início + entrega preenchidos" no header da Capacidade somava só tasks_scheduled + tasks_without_dates. Esquecia as atrasadas (tasks_late) e as fora do horizonte (tasks_outside_horizon), que também têm datas. Resultado: Pedro mostrava 79 Pendentes mas o contador dizia "0 de 78" — 1 task de diferença.',
      'Fix: o "Y" do contador agora soma os 4 buckets de cobertura (scheduled + late + outsideHorizon + withoutDates) e bate exato com o número de Pendentes do KPI do topo. O "X" soma os 3 com datas (scheduled + late + outsideHorizon).',
      'Placeholder "Nenhuma tarefa com agenda" também tinha o mesmo bug: só aparecia quando tasks_scheduled === 0, ignorando que tasks atrasadas com datas pintam a barra de HOJE (transbordo de atraso). Agora só aparece quando o total com datas (scheduled + late + outsideHorizon) é zero — visualização do dia sobrecarregado por atraso volta a aparecer.'
    ]
  },
  {
    version: 'V37.2.3',
    date: '2026-06-12',
    title: 'Tarefas Por Pessoa: dias passados apagados + placeholder sem agenda + livres tracejado verde',
    bullets: [
      'Esta semana mostra sempre os 5 dias úteis (Seg-Sex) — antes só renderizava o que sobrava do horizonte. Em sexta-feira só tinha 1 barra solitária, agora aparece Seg-Sex inteiro com os dias passados em opacity 0.4 e label cinza. Sábado já passou pra ti? O calendário mostra a semana real.',
      'Quando a pessoa tem zero tarefas com início + entrega preenchidos, a seção de barras some e abre placeholder: ícone calendar-x + "Nenhuma tarefa com agenda — pra ver capacidade visualizada por dia, preencha data de início e data de entrega nas tarefas do ClickUp". Cliente entende que é falta de dado, não pessoa livre.',
      'Dias com 0% (e não passados) ganham visual distinto: fundo emerald 6% + borda tracejada emerald + texto "Livre" em verde escuro no centro. Comunica "slot pronto pra agendamento" em vez de "barra cinza vazia" que parecia bug.',
      'Resumo textual abaixo das semanas considera apenas dias ativos (não passados) — antes incluía Seg-Qui como "livres" quando na real eles já tinham acontecido.'
    ]
  },
  {
    version: 'V37.2.2',
    date: '2026-06-12',
    title: 'Tarefas Por Pessoa: grafia "Aderência" + borda HOJE cortada no topo',
    bullets: [
      'A palavra "Adherência" estava escrita com H errado — correção pra "Aderência" no header da seção e no comentário do código.',
      'A borda violet do dia HOJE estava sendo cortada no topo da barra porque o viewBox do SVG começava em y=0 e a borda começa em y=-1.5. Aumentei o padding do viewBox pra -4 no topo e +6 na lateral. Agora a borda do HOJE aparece completa em volta da barra.'
    ]
  },
  {
    version: 'V37.2.1',
    date: '2026-06-11',
    title: 'Tarefas Por Pessoa: refinos visuais (hoje + cobertura + sem LJ ativas)',
    bullets: [
      '"Próximo slot livre" agora diferencia "Ainda hoje", "Amanhã" e dias específicos. Antes mostrava "qui., 11 de jun." mesmo quando era o próprio dia que tu tava — confuso. Agora fica claro que tem janela aproveitável já no dia em curso.',
      'Header da Capacidade ganha contador "X de Y tarefas abertas têm início + entrega preenchidos". Quando menos de 60% das tarefas têm datas, aparece com tom âmbar e marca "empilhamento parcial (Z%)" — cliente entende que o gráfico só reflete uma fatia dos dados.',
      'Quando a pessoa tem 0 tarefas LJ ativas (toda carga em outros projetos), a coluna Dedicação LJ mostra card sutil com ícone lua: "Esta pessoa não tem tarefas LJ ativas — toda a carga está em outros projetos do workspace ClickUp". Substitui a barra cinza solitária que parecia bug.',
      'Etiqueta mudou de "Próximo dia livre" pra "Próximo slot livre" — reflete melhor a granularidade (pode ser horas no meio do dia, não necessariamente um dia inteiro).'
    ]
  },
  {
    version: 'V37.2.0',
    date: '2026-06-11',
    title: 'Tarefas Por Pessoa: distribuição real por start/due + adherência + slots livres + próxima entrega',
    bullets: [
      'O empilhamento de carga deixa de assumir "tudo começa hoje" e passa a usar as datas reais de cada tarefa. Cada task aloca avg_hours uniformemente entre start_date e due_date — dia 16/jun mostra a soma das tarefas que ocupam esse dia, não a fila acumulada.',
      'Tarefas atrasadas (due_date < hoje) continuam jogando todas as horas no dia de hoje — transbordo de atraso.',
      'Tarefas SEM start_date ou SEM due_date não entram no empilhamento. Card mostra badge âmbar "X tarefas sem data" pra cliente decidir preencher ou ignorar.',
      'Escala dinâmica das barras: quando algum dia estoura 100% por concentração futura (ex: 12h alocadas), a linha guia 8h desce na visualização e a parte excedente vira sobreposição rose. Não mente sobre sobrecarga.',
      'Card recolhido ganha linha "Próxima entrega 16/jun (em 3d)" com cor âmbar quando vencendo em até 3 dias, sky quando mais distante.',
      'Modal ganha 3 novos sinais: badge "Y horas livres" (soma de capacidade livre nas 2 semanas úteis), linha "Próximo dia livre: Qua 17/jun (8h)" e bloco "Adherência ao prazo" com % no prazo + deriva média em dias.',
      'Backend retorna agora: daily_load distribuído (não mais sequencial), tasks_scheduled/tasks_late/tasks_without_dates/tasks_outside_horizon, free_hours_total, next_free_day, next_delivery, adherence_pct, deriva_avg_days, on_time_count, late_done_count, adherence_evaluated_count.',
      'Logs Railway expandidos: open=80 done=50 late=73 sched=46 no_dates=2 workload=200h overflow=120h free=34h adherence=68% deriva=1.2d next=2026-06-15(3).'
    ]
  },
  {
    version: 'V37.1.10',
    date: '2026-06-11',
    title: 'Capacidade: barras coloridas por contexto LJ + % na barra + HOJE + linha guia 8h',
    bullets: [
      'Cada barra de dia ganha empilhamento por composição: Marketing rosa, Vendas ciano, Externos cinza, etc. Mesma proporção em todos os dias (até V37.2 trazer datas por task), mas cliente vê visualmente onde a carga vai.',
      'Cores derivadas do nome do produto (folder ClickUp) via hash determinístico. Paleta com 10 cores distintas — mesmos produtos sempre ganham a mesma cor. Externos sempre zinc-400.',
      '% de ocupação sutil dentro da barra: número branco semi-transparente quando barra alta, stone quando barra baixa. Cliente não precisa hover pra ler.',
      'Linha tracejada violet horizontal marca a jornada de 8h — referência visual fixa.',
      'Marca "HOJE" violet abaixo da barra do dia atual + borda violet 1.5px destacando o card. Cliente identifica imediatamente onde está no tempo.',
      'Bug fix do split: "Próxima semana" estava mostrando 8 barras (5 da próxima + 3 da semana seguinte). Agora limita a 5 dias úteis (Seg-Sex) — excedente vira backlog visível no badge overflow.',
      'Dedicação LJ por contexto: bolinha de cor antes do nome + barra de progresso da mesma cor. Consistência visual com as barras de capacidade — cliente liga cor da barra com produto na hora.',
      'Legenda compacta abaixo das barras lista todas as cores ativas + % cada uma representa no total ativo da pessoa.'
    ]
  },
  {
    version: 'V37.1.9',
    date: '2026-06-11',
    title: 'Tarefas Por Pessoa: modal de detalhe + dedicação por produto/campanha LJ',
    bullets: [
      'Card recolhido vira clique único — toda a área do card abre um modal central com detalhamento completo. Sem mais chevron de expandir inline.',
      'Modal central com 2 colunas: Capacidade (esta + próxima semana + backlog) e Dedicação LJ por contexto (produto e campanha agrupados).',
      'Header do modal traz 4 KPIs em destaque (Pendentes, Concluídas 30d, Atrasadas, Média por tarefa) com a fórmula explícita "176h ÷ 50" no subtexto da Média.',
      'Dedicação LJ por contexto: agrupado por produto (folder ClickUp), cada produto expande as campanhas (lists). Barra de progresso violet visualiza a proporção. Ex: "Marketing > Black Friday: 32 tarefas" + barra cheia, "Vendas > Inbound: 5" + barra menor.',
      'Tarefas externas (fora do Space LJ) entram como linha "Outros projetos (fora do LJ)" no fim — visibilidade da dedicação sem expor títulos.',
      'Backend agrega by_lj_folder (produtos) e by_lj_list (campanhas) com nomes vindo do ClickUp. Folders escondidos ("folderless lists") agrupam como "Sem produto".'
    ]
  },
  {
    version: 'V37.1.8',
    date: '2026-06-11',
    title: 'Tarefas Por Pessoa: média de tarefa derivada da capacidade real',
    bullets: [
      'Felipe sacou: se o mês tem ~22 dias úteis × 8h = 176h disponíveis, e a pessoa fechou 69 tarefas, então a média REAL é 176/69 ≈ 2,5h por tarefa. Bem diferente das "8h" que mostrávamos.',
      'Substituí o cálculo antigo (date_done − date_created) por capacity_derived: horas úteis disponíveis no período ÷ tarefas concluídas. Não mede mais idade calendário, mede cadência real.',
      'Pra quem fechou pouco (< 5 no mês) a média continua "—" — amostra pequena dá número não confiável.',
      'Sumiram do código o cap por task (8h), a mediana e o pool de timestamps. Não precisa mais — a fórmula é direta e auto-corrigida.',
      'Efeito colateral: fila do empilhamento fica MUITO mais realista. Pedro com 80 abertas × 2,5h média = 200h fila ≈ 25 dias úteis. Não os 1000h+ absurdos de antes.',
      'Logs Railway agora mostram a fórmula explícita: "avg=2.5h (176h/69)" — fica auditável.'
    ]
  },
  {
    version: 'V37.1.7',
    date: '2026-06-11',
    title: 'Tarefas Por Pessoa: Total Ativo agora é só pendente + linha de concluídas',
    bullets: [
      'Bug visual: o "Total ativo" do card somava abertas + concluídas, mas a fila do empilhamento usava só abertas. Causava confusão (Pedro 130 total vs 640h fila = 80 tasks × 8h).',
      'Total Ativo passa a contar SÓ tarefas pendentes (open). O número agora bate com a fila: Total × média = horas de fila.',
      'Linha nova "X concluídas nos últimos 30 dias" entra abaixo do Total — mostra produtividade do mês sem misturar com carga atual. Ícone check verde pra diferenciar.',
      'Donut LJ% vs Outros% também passa a usar só open (consistência com Total Ativo). Reflete divisão da carga PENDENTE, não do histórico misturado.'
    ]
  },
  {
    version: 'V37.1.6',
    date: '2026-06-11',
    title: 'Tarefas Por Pessoa: janela móvel de 30 dias (tasks zumbi ficam fora)',
    bullets: [
      'Todos os números do card agora consideram apenas tarefas mexidas ou concluídas nos últimos 30 dias. Tarefas criadas há meses e nunca mais tocadas saem do escopo — não inflam os totais.',
      'Pedro Henrique vai cair de 664 abertas pra ~80-100 (o que realmente tá vivo no operacional dele). Stephano/Thiago idem.',
      'Filtros aplicados no ClickUp via date_updated_gt (open + late) e date_done_gt (closed). 3 endpoints novos rodam com o filtro server-side.',
      'Card ganha micro-badge no header da sub-aba explicando: "Considera apenas tarefas mexidas ou concluídas nos últimos 30 dias (tasks zumbi ficam fora)" — sem cliente confundir com "tudo no ClickUp".',
      'A capacity (fila + backlog overflow) reflete operacional REAL — quem tem 80 tarefas ativas vai ter ~320h de fila, não milhares.'
    ]
  },
  {
    version: 'V37.1.5',
    date: '2026-06-11',
    title: 'Tarefas Por Pessoa: média robusta — cap 8h por tarefa + mediana',
    bullets: [
      'V37.1.4 expôs problema enorme: tasks da Sansone ficam abertas semanas no ClickUp ("aguardando aprovação", parqueadas em backlog). Meu cálculo (date_done − date_created) mediu idade calendário, não tempo de trabalho. Resultado absurdo: Pedro com 669h por tarefa, Thiago 868h.',
      'Fix: cada task individual ganha cap de 8h (uma jornada inteira). Task que ficou 30 dias em status custom ainda conta como 8h máximo. Outliers extremos não dominam mais.',
      'Substituí média aritmética por mediana das 20 últimas concluídas. Mediana é estável quando metade da amostra fechou no mesmo dia e a outra metade ficou no cap — o valor central vira o representativo.',
      'Efeito esperado: médias caem pra faixa realista (1-8h). Pedro 664 tasks × 4h = ~2.600h de fila (~325 dias úteis) em vez de 444 mil horas absurdas.',
      'Limitação: ClickUp não distingue "horas trabalhadas" de "tempo em aberto" sem time tracking manual. Esse cap+mediana é o melhor heurístico possível sem dado extra. Custom por cliente fica em backlog.'
    ]
  },
  {
    version: 'V37.1.4',
    date: '2026-06-11',
    title: 'Tarefas Por Pessoa: capacity planning sequencial + status custom + caps maiores',
    bullets: [
      'Modelo de carga semanal mudou de "alocar por due_date" pra capacity planning: pega total = open × média de fechamento e empilha 8h/dia sequencialmente. Pulamos sábado e domingo — horizonte vira 10 dias úteis (Seg-Sex × 2).',
      'Exemplo: Pedro com 10 tarefas × 1h média começando hoje quinta → quinta cheia, sexta com 2h preenchidas, restante livre. Era o que tu pediu.',
      'Quando a fila não cabe nas 2 semanas úteis, um badge novo aparece no expand: "+Xh em backlog além das 2 semanas (~N dias úteis extras)". Pedro com 200h de fila vai mostrar quanto sobra.',
      'Tooltip ao passar mouse na barra do dia: "Sex 13/06 · 6h ocupadas · 2h disponíveis". Antes era "6h, 75%".',
      'Fix do "Pedro com 0 concluídas": filtro de closed deixou de exigir status.type==="closed" e passa a aceitar QUALQUER task com date_done preenchido. Workspace que usa status custom ("Concluído", "Entregue", "Aprovado") agora entra na amostra.',
      'Caps subiram pra evitar bater teto: open 300→600, late 200→500. Quando bate cap mesmo assim, número ganha "+" no card (ex: "200+ atrasadas") + tooltip explicando.',
      'Labels Seg/Sex passam a usar 2 letras (Se, Te, Qa, Qi, Sx) pra não confundir as iniciais idênticas.'
    ]
  },
  {
    version: 'V37.1.3',
    date: '2026-06-11',
    title: 'Tarefas Por Pessoa: contagens alinham com ClickUp + logs no Railway',
    bullets: [
      'Discrepância: ClickUp UI mostrava "Felipe Alves: 8 atrasadas", LJ mostrava 32. Causa: meu fetch usava subtasks=true — cada subtask de execução virava +1 na conta. Pedro/Stephano/Thiago batiam exatos 300 do cap por isso.',
      'Strategy C aplicada: 3 fetches por pessoa rodando em paralelo, todos com subtasks=false. (1) open pra counts e agenda, (2) closed pra média, (3) late dedicado via filtro server-side due_date_lt. Counts agora batem com o que cliente vê na "Hoje e atrasadas" do próprio ClickUp.',
      'Logs no backend Railway por pessoa (ex: "Pedro Henrique: open=47 closed=23(ts=18) late=8 sample=18 avg=4.2h") — abre View Logs no Railway pra acompanhar o pull em tempo real.',
      'Fallback transparente da média: se ClickUp não preencheu timestamps em algumas closed, cliente vê "— X/Y concluídas têm data válida" no lugar de "amostra insuficiente". Diferencia falta de histórico de problema de dado.',
      'Bonus: com subtasks fora, ninguém mais deve bater o cap de 300 — o número total volta a refletir a realidade.'
    ]
  },
  {
    version: 'V37.1.2',
    date: '2026-06-11',
    title: 'Tarefas Por Pessoa: média de conclusão agora calcula (fix amostra insuficiente)',
    bullets: [
      'Cards mostravam "— amostra insuficiente (0/5)" pra praticamente todo mundo. Causa: o endpoint fazia 1 fetch só pra cada pessoa com cap de 300 tasks, e o ClickUp ordena por date_updated DESC. Tasks abertas movimentam muito mais — dominavam as 300 primeiras e quase nenhuma closed entrava.',
      'Fix: agora são 2 fetches independentes por pessoa rodando em paralelo. Um traz só as abertas (counts + agenda + atrasadas), outro usa filtro server-side date_done_gt e traz só as concluídas no último ano (até 200 — sobra de monte pros 20 que viram a amostra da média).',
      'Resultado prático: pessoas que tinham 0/5 ou 1/5 amostra agora aparecem com "X,Yh por tarefa" assim que tiverem >= 5 closed em 365 dias.',
      'Custo: 2x chamadas ClickUp por pessoa, mas dentro do rate limit (100 req/min) com folga mesmo pra team grande.'
    ]
  },
  {
    version: 'V37.1.1',
    date: '2026-06-11',
    title: 'Tarefas Por Pessoa: cor violet do LJ, badge de atrasadas e legenda fora',
    bullets: [
      'Donut do card agora usa violet (#7c3aed) pra fatia LJ — alinhado com a cor temática do Dashboard. Externos seguem em cinza (#d4d4d8) pra contraste.',
      'Badge "X atrasadas" entra no card ao lado do "Total ativo" — soma LJ + externos abertas com due_date vencido. Visível tanto recolhido quanto expandido. Só aparece quando há atraso.',
      'Legenda colorida embaixo das barras (>100% / 60–100% / <60%) saiu — a própria barra já comunica a faixa pela cor, legenda virou ruído visual.'
    ]
  },
  {
    version: 'V37.1.0',
    date: '2026-06-11',
    title: 'Dashboard → Tarefas → Por Pessoa: carga LJ vs outros projetos + agenda da semana',
    bullets: [
      'Aba Tarefas do Dashboard ganha duas sub-abas: Geral (visão existente) e Por Pessoa (nova).',
      'Por Pessoa lista cada membro do ClickUp que tem tarefas LJ — recolhido por padrão mostra avatar, nome, donut LJ% vs Outros% e média de conclusão por tarefa.',
      'Expandido revela duas barras de capacidade: esta semana (do dia atual até domingo) e próxima semana (Seg–Dom). Cada barra é colorida por faixa: rosé >100%, âmbar 60–100%, verde <60%.',
      'Resumo textual abaixo das barras agrupa dias consecutivos no mesmo nível — ex: "Seg–Ter sem espaço · Qua 80% (cabe ~1 tarefa) · Qui–Dom livres".',
      'Cálculo da média: pega as últimas 20 tasks concluídas da pessoa em TODOS os projetos do workspace (LJ + externos), faz média de (date_done − date_created) em horas. Se amostra < 5, mostra "—" com tooltip.',
      'Cálculo da capacidade: pra cada task aberta com due_date nos próximos 14 dias, usa time_estimate da task se preenchido, senão a média da pessoa. Tasks atrasadas viram sobrecarga no dia de hoje. Jornada fixa de 8h/dia.',
      'Privacy preservada: títulos de tarefas externas nunca aparecem na UI — só counts e horas agregadas. Cliente vê quanto Pedro trabalha fora do LJ, não em quê.',
      'Cache de 5 minutos no frontend. Botão Atualizar no header da sub-aba força refresh. Endpoint /api/clickup-user-tasks-count pagina até 300 tasks por pessoa.',
      'Pré-requisito: ClickUp conectado E Space LJ definido (Setup Wizard). Sem ClickUp, sub-aba mostra CTA pra configurar.'
    ]
  },
  {
    version: 'V37.0.13',
    date: '2026-06-11',
    title: 'Header CFO: nome do indicador um tico maior (9px → 11px)',
    bullets: [
      'Label dos 5 cards de KPI subiu de text-[9px] pra text-[11px] (~22% maior). Ainda compacto, mas legível sem precisar aproximar o olho.',
      'Opacidade ajustada de 70 pra 75 pra compensar a tipografia maior sem virar protagonista — o valor segue dominante em text-xl.'
    ]
  },
  {
    version: 'V37.0.12',
    date: '2026-06-11',
    title: 'Header CFO: cards de KPI uniformes e número 1.5x maior',
    bullets: [
      'Os 5 cards do header do RevOps & Governança (Ticket Médio / Faturamento Bruto / Faturamento Líquido / EBITDA / Margem EBITDA) viviam com alinhamento vertical inconsistente: quando o label quebrava em 2 linhas (ex: "Faturamento Bruto (Mensal)"), o número descia. Quando era curto ("Ticket Médio"), o número colava no topo. Cada card parecia ter disposição diferente.',
      'Fix: card vira flex column com justify-between + min-h 72px fixo. Label SEMPRE no topo, valor SEMPRE no fundo — todos os 5 cards alinham vertical idêntico independente do tamanho do label.',
      'Número subiu de text-sm (14px) pra text-xl (~20px) — dominante visualmente, como executivo espera de KPI no topo. Label segue compacto pra não competir.',
      'Padding ajustado px-3.5 py-2.5 + gap-1.5 pra dar respiro ao número maior. leading-tight no label evita que quebra de linha estique demais.'
    ]
  },
  {
    version: 'V37.0.11',
    date: '2026-06-11',
    title: 'Djow ganha autonomia — cria linhas DRE e itens RevOps via comando natural',
    bullets: [
      'Antes: Djow lateral só editava fórmula de linha já existente (cliente tinha que clicar engrenagem → Djow ajuda). Agora também CRIA do zero.',
      'Exemplos que funcionam: "cria dedução de Parceria Fulano = 15% do faturamento" / "adiciona item Hotmart em variáveis = 5,9% do ticket" / "novo componente MCU Comissão Lara = 5 por venda" / "põe linha em S&M chamada Black Friday = 8000".',
      '4 destinos cobertos: Deduções/S&M/G&A do DRE (linhas extras), Custos Variáveis/Aquisição/Fixos (itens dentro de grupos), Componentes do MCU/MSU (composição).',
      'Motor reconhece 3 partes da frase: intent CREATE (cria/insere/adiciona/põe), destino (categoria), nome (entre verbo e fórmula) e fórmula (reusa parsers existentes de % e por venda).',
      'UX: cliente escreve, Djow propõe preview "Vou criar X em Y com fórmula Z. Confirma?" + 2 botões (Confirmar criação emerald / Cancelar). Sem auto-execução — sempre passa pela confirmação.',
      'Reply do Djow agora renderiza markdown leve no chat: **negrito** e `código inline` ficam estilizados.',
      'Bucket de Custos: se não existe grupo no bucket alvo, cria automaticamente com label padrão. Item nasce em modo "fixed" (se fórmula é número puro) ou "custom_formula" (se tem handle).',
      'Componente MCU/MSU criado automaticamente vira modo "composed" no override.',
      'Frase mal-formada cai no fallback de fórmula sugerida ou no "Não captei". Cliente pode tentar reformular ou usar caminho manual (engrenagem da linha).'
    ]
  },
  {
    version: 'V37.0.10',
    date: '2026-06-11',
    title: 'DRE e RevOps — chevron de recolher nas linhas-banner e cards MCU/MSU',
    bullets: [
      'Linhas-banner do DRE com conteúdo abaixo (Faturamento Bruto, Deduções, S&M, G&A e linhas extras laranja personalizadas) ganham chevron no canto direito pra recolher/expandir o que vem embaixo. EBITDA não tem chevron (nada abaixo).',
      'Cards MCU e MSU do RevOps KPIs ganham chevron de tamanho médio no canto direito, recolhem o painel de edição inteiro (Auto / Valor único / Composição + grid de cards). Header com nome/valor/badge fica visível.',
      'Estado persiste por (productId, key) em App.state.revopsCollapsed — F5 mantém o que tava recolhido. Default open pra não esconder nada de surpresa.',
      'Group banners laranja (linhas customizadas no DRE) também ganham chevron quando tem nome — recolhe os cards de fórmula. Sem nome, chevron não aparece (cliente ainda tá configurando).',
      'Cores tonais: chevron casa com a cor da linha (emerald em Faturamento/MCU/MSU, rose em Deduções/S&M/G&A, amber em group banners). Hover sutil no bg.',
      'TM, CAC, Custo Fixo e Breakeven não recebem chevron — só têm hint inline curto, não vale esconder.'
    ]
  },
  {
    version: 'V37.0.9',
    date: '2026-06-11',
    title: 'Form de criação de ação fica enxuto — bloco "Mailing definido?" inteiro sai',
    bullets: [
      'Bloco "Mailing definido?" REMOVIDO do form de criação de ação. Toggle Sim/Não + Manual/CSV + textarea + Preview de score — tudo saiu. Form agora vai direto: contexto operacional → travessia → descrição → criar.',
      'No lugar, card discreto azul "Base de leads" com microcopy "Cria a ação primeiro. Depois anexa base pelo Importador (4 steps · dedup · validação · RD real)" + botão "Abrir Importador" violet. Caminho canônico desde V35.3.7.',
      'Funções helpers internas removidas do módulo: leadInput, leadTextArea, scorePreview. 5 Actions órfãs também: setMailingDefined, setLeadInputMode, loadLeadExample, handleActionCSV, downloadCsvTemplate.',
      'createAction simplificado: ação nasce sempre com leads:[] + mailingDefined:false + scoreId padrão (scores[0]). Sem mais LeadParser.parse de textarea inline.',
      'actionDraft limpo: mailingDefined, leadInputMode, leadsText, rdListName, scoreId saíram do initial. Cliente que vinha do fluxo "Profile → Criar ação" também ganhou form simplificado.',
      'BACKWARD COMPAT preservada: ações antigas com action.leads[] continuam sendo lidas em todos os cards e dashboards. LeadParser engine + ScoreEngine intactos (usados em leads manuais, profile CSV, etc).',
      'Engines tiveram default param ajustado pra não referenciar mais actionDraft.scoreId (campo removido): LeadParser.parse e ScoreEngine.calculateLeadScore agora caem direto pra scores[0] ou Config.defaultScore.'
    ]
  },
  {
    version: 'V37.0.8',
    date: '2026-06-10',
    title: 'Limpeza grande — fluxo LP modal vestigial inteiro removido (8 arquivos, ~600 linhas)',
    bullets: [
      'Botão "Criar ação LP especializada" REMOVIDO do form de criação de ação. Era vestígio da V15 que abria modal de LP com tracking + checkpoints + score delta — mas nenhum consumidor moderno lia o output (action.lp / lpRegistry). Cliente preenchia e nada acontecia.',
      'Modal actionLpModal.js deletado (197 linhas) + 10 Actions LP removidas do appActions.js (openLpModal / saveLpAction / addLpCheckpoint / reorderLpCheckpoint / copyLpTrackingScript / validateLpInstallation / pollLpEvents etc).',
      'Blob de tracking zumbi que dependia do LP modal também saiu: lpRegistry.js / lpAnalyticsEngine.js / flowCheckpointEngine.js / tracking/checkpointEngine.js / eventCollector.js / attributionEngine.js / leadIdentityResolver.js — 8 arquivos deletados no total.',
      'State limpa: showLpModal, lpDraft, lpEvents, lpRegistry, lpLastPolledAt removidos do initial + normalize. Lista de keys voláteis ajustada.',
      'EventCollector.poll() removido do refreshAllRdData (era pra puxar /api/lp-events-fetch — endpoint legacy). Toast "RD atualizado" agora não menciona mais "LP".',
      'PRESERVADO: campaignLpBreakdown + loadCampaignLpBreakdown + /api/campaign-lp-breakdown — esse é parte do Tracking V33 vivo (lê touchpoints reais do snippet embarcável). NÃO conversa com o LP modal morto.',
      'Pra LP com tracking REAL hoje, fluxo é Tracking V33 (snippet em /api/tracker-snippet → eventos em /api/tracker-event → tabelas lj_visitor_*).'
    ]
  },
  {
    version: 'V37.0.7',
    date: '2026-06-10',
    title: 'Limpeza de código morto — Setor da Campanha + modo RD do mailing (mock) saem',
    bullets: [
      'Campo "Setor onde nasce" REMOVIDO da criação e edição de Campanha (menu lateral). Era vestigial — a campanha hoje é cross-frente (Marketing+Vendas+CS simultâneos no Mapa Etapa 4). O setor que importa é da AÇÃO, não da campanha. State antigo preserva backward compat.',
      'Card de listagem de campanha (na tela de Produto) trocou a coluna "Setor: Marketing" por "Mídia: R$ X" (investmentMedia) — info útil pra leitura executiva.',
      'Modo "RD" do mailing da Ação REMOVIDO. Era stub (`importFromRDMock`) que carregava 2 leads fictícios "Lead RD 1" e "Lead RD 2" sem conectar com a integração RD real. Confundia cliente.',
      'No lugar, atalho novo "→ Abrir Importador completo (base grande · dedup · validação · RD real)" no topo do bloco Mailing, que abre o Lead Import Wizard 4 steps (V35.3.7) — caminho moderno com dedup e validação.',
      'Botões de modo agora são 2 (Manual / CSV) em vez de 3 — mais simétrico, sem armadilha.',
      'Defensivo: setLeadInputMode rejeita "rd" e cai pra "manual" pra cobrir state legacy.'
    ]
  },
  {
    version: 'V37.0.6',
    date: '2026-06-10',
    title: 'Download PDF dos snapshots — fecha a master V37 (Fechamento end-to-end)',
    bullets: [
      'Botão "Baixar PDF" na vista detalhada de qualquer snapshot agora gera download local (frontend, html2pdf.js via CDN). Zero infra nova.',
      'Layout executivo: header violet com período + nome opcional + tipo + criado em + fonte. Bloco principal com grid 2-col dos inputs (pra product) ou lista de produtos (pra consolidated). Log de reabertura amber se houver. Rodapé com versão do LJ.',
      'PDF é A4 portrait, inline styles (sem dependência Tailwind no print), nome do arquivo: fechamento-YYYY-MM-{kind}-{id}.pdf.',
      'Snapshot resta SEMPRE imutável — PDF é só renderização do JSON congelado. Pode baixar 100 vezes que sai igual.',
      'Master V37 fecha o ciclo: Fechamento mensal end-to-end de produto → consolidado → custom → PDF. Cron mensal pendente de setup externo (V37.0.2 documenta).',
      'Próximas masters voltam pro ritmo normal de evolução. V37.0.x foi 7 ondas em 1 dia — Resultado layout régua + Fechamento completo (backend + UI + sininho + PDF).'
    ]
  },
  {
    version: 'V37.0.5',
    date: '2026-06-10',
    title: 'Custom Consolidado funcional — agrupamentos arbitrários por mês',
    bullets: [
      'Escopo "Custom" da aba Fechamento ganha botão verde "Novo Custom Consolidado" no header (estava desabilitado).',
      'Clique no botão abre wizard inline (substitui a lista) com: nome do consolidado, dropdown de mês (12 últimos), grid de checkboxes dos produtos.',
      'Cliente cria quantos customs quiser por mês — agrupa A+B, A sozinho, B+C, sem limite. Cada custom tem data de geração imutável e nome próprio.',
      'POST kind=consolidated_custom no backend (já existia desde V37.0.2) — só faltava UI.',
      'Microcopy explica: custom puxa o estado ATUAL da governança de cada produto no momento de criação. Pra foto retroativa, refeche os produtos individuais antes.',
      'Wizard tem 2 botões: Cancelar (volta pra lista) e Criar Custom (desabilitado até ter 1+ produto marcado).',
      'Input do nome usa update sem render pra preservar foco enquanto digita. Selector de mês re-renderiza pra refletir mudança.',
      'Fluxo: Fechamento → Custom → Novo Custom → preenche → cria. Cards verticais aparecem na lista normal depois.'
    ]
  },
  {
    version: 'V37.0.4',
    date: '2026-06-10',
    title: 'Mensal Consolidado funcional + sininho avisa pendências de fechamento',
    bullets: [
      'Sininho da Home agora soma "fechamentos mensais aguardando consolidação" — bolinha vermelha não some até cliente resolver cada mês parcial.',
      'Alerta no modal de Notificações com microcopy claro: lista até 3 períodos parciais + atalho "Abrir Fechamento" que joga direto pra aba.',
      'Card de Mensal Consolidado partial tem botão amber "Associar produtos" no topo (cor de aviso, não viola design diretor — partial é exceção pendente).',
      'Vista detalhada do partial mostra grid de checkboxes dos produtos do tenant + 2 botões: "Confirmar associação" (com 1+ marcados) e "Não consolidar este mês" (vira complete com intentionally_empty=true pra auditoria).',
      'Cache de snapshots agora é GLOBAL por user (não mais por produto) — reduz round-trips, alimenta sininho cross-produto de uma chamada só. Filtragem do escopo "Este produto" feita no front.',
      'Greeting bar carrega snapshots em background (TTL 60s) pra alimentar pendências sem cliente abrir a aba.',
      'Action openGovernanceClosingFromAlert pula direto pro snapshot certo a partir do alerta — escolhe primeiro produto do tenant + escopo Mensal + abre vista detalhada já em modo associação.',
      'PATCH action=associate no backend já estava pronto (V37.0.2) — só faltava UI. Cron mensal continua o mesmo: cria partial, cliente fecha o ciclo.'
    ]
  },
  {
    version: 'V37.0.3',
    date: '2026-06-10',
    title: 'Aba Fechamento conecta no backend — lista, refechar manual, vista detalhada',
    bullets: [
      'Aba Fechamento deixa de ser placeholder e vira UI viva: auto-fetch GET /api/governance-closings ao abrir (cache 60s).',
      'Botão "Refechar este produto" funcional pro escopo "Este produto" — cria snapshot kind=product_custom com nome opcional. Use pra ajustar venda retroativa antes do mês fechar de vez.',
      'Cards verticais por snapshot com badge tonal (AUTO violet · Custom emerald · Parcial amber · Completo sky). Mostra mês, criação, contagem de produtos, log de reabertura.',
      'Vista detalhada (clica em Abrir): grid 4-col mostra produto, vendas previstas, meta vendas, meta CAC, TM, # grupos custos, # items, # ofertas. Log de reabertura listado.',
      'Botão "Reabrir" pra snapshot custom/consolidado registra ato no log de auditoria (snapshot continua imutável). product_auto não dá pra reabrir (é foto pura do cron).',
      'Trata erro de tabela ainda não migrada: mostra aviso amber "Rode Migrar Schema em Administrar" ao invés de erro técnico.',
      'Escopos "Mensal Consolidado" e "Custom" listam mas com botão de criar desabilitado (V37.0.4 / V37.0.5).'
    ]
  },
  {
    version: 'V37.0.2',
    date: '2026-06-10',
    title: 'Backend de Fechamento — tabela + endpoints CRUD + cron mensal',
    bullets: [
      'Nasce a tabela lj_governance_closings (Postgres) — 4 tipos de snapshot coexistem na mesma tabela: product_auto, product_custom, consolidated_monthly, consolidated_custom.',
      'Schema bumpa pra v37.0.2-governance-closings. Master ou tenant próprio precisam rodar /api/admin-migrate-schema (botão "Migrar Schema" em Administrar) pra criar a tabela em produção.',
      'Unique index garante 1 product_auto por (user, produto, mês) e 1 consolidated_monthly por (user, mês). Cron pode rodar 2x no mesmo dia sem duplicar.',
      'Endpoint /api/governance-closings (GET list / POST cria custom / PATCH reabre ou associa) com filtros por período, tipo e produto.',
      'Endpoint /api/cron-monthly-closing — auth X-Cron-Token, itera users aprovados, congela snapshot por produto + cria consolidated_monthly partial pra o cliente associar depois.',
      'Cron externo (cron-job.org ou Railway) precisa ser configurado: schedule "0 3 1 * *" UTC = 00:00 BRT do dia 1 de cada mês. Body vazio, header X-Cron-Token.',
      'Snapshot congela INPUTS (revopsConfig + metas + salesProjection do produto). Engine roda no front quando renderiza — snapshot resiliente a refator do engine.',
      'Reabertura registra log auditável: { at, by_user_id, reason } no campo reopens_log do snapshot.',
      'Frontend ainda não consome — UI de listagem e refechamento manual vem na V37.0.3. Até lá a aba Fechamento segue mostrando placeholder.'
    ]
  },
  {
    version: 'V37.0.1',
    date: '2026-06-10',
    title: 'Nasce a aba Fechamento (1ª posição) — estrutura visual + switcher de escopo',
    bullets: [
      'Nova aba "Fechamento" entra como 1ª tab do painel RevOps Whitelabel (antes de Custos). Mesma régua: offwhite, cards bg-white com sombra chapada, IDs únicos.',
      'Card "Mês corrente · Junho 2026" no topo com countdown ("Fecha em X dias") e nota de que o snapshot auto vai rolar 00:00 BRT do dia 1.',
      'Switcher de escopo no header: Este produto / Mensal Consolidado / Custom. Cada escopo tem microcopy explicando o que é. State persiste por produto.',
      'Seção educativa "Como o fechamento funciona" com 3 cards (AUTO / AUTO+ASSOC / MANUAL) explicando os 3 tipos de snapshot que vão existir.',
      'Lista de snapshots fica vazia por enquanto (placeholder honesto) — backend cron + tabela governance_closings entram na V37.0.2.',
      'Botão "Fechar manualmente" desabilitado de propósito até backend nascer (evita gerar foto incompleta).',
      'Roadmap da master V37 listado dentro da aba (V37.0.2 → V37.0.6) pra cliente entender o que vem.'
    ]
  },
  {
    version: 'V37.0.0',
    date: '2026-06-10',
    title: 'Master V37 abre — Resultado ganha layout régua + metas mensais de Vendas e CAC',
    bullets: [
      'Aba Resultado entra na mesma régua de DRE / RevOps / Custos: wrapper offwhite, grid 2-col com Djow lateral sticky, sombra chapada nos cards, IDs únicos nos inputs (sem mais bug de "clica e sai foco" durante digitação).',
      'Selector de período no topo (3 meses atrás → mês corrente → 3 à frente). Cliente vê e edita meta de qualquer mês sem precisar viajar no tempo. Default = mês atual.',
      'Bloco novo "Metas · [Mês]" com 2 cards editáveis: Meta de Vendas (quantidade) e Meta de CAC (R$). Cada um mostra Realizado lido do funil + badge de variância.',
      'Cores design diretor: Vendas atingida (realizado ≥ meta) = emerald; abaixo = rose. CAC dentro (realizado ≤ meta) = emerald (gastou menos); estourou = rose.',
      'Djow lateral aprende contexto "result": exemplos viram perguntas sobre meta, CAC saudável, diferença previsto×realizado. Reconhece conceitos meta / vendas / realizado / previsto.',
      'Indicadores principais (Vendas, CTC, CAC, Fat. Bruto), Realizado do funil, Simulator e Comparador de cenários: tudo preservado, só recolocado dentro da nova régua.',
      'Estado novo persiste por (produto, período YYYY-MM): metasResultado e resultadoPeriod. Snapshot de fechamento (próximas ondas V37.0.x) vai congelar essas metas naturalmente.'
    ]
  },
  {
    version: 'V36.14.5',
    date: '2026-06-09',
    title: 'Custos: cards ganham ritmo visual (sombra + hover-lift + ordenação + letra watermark)',
    bullets: [
      'Grupos com muitos items (Software com 14, por ex.) ganharam diferenciação discreta sem usar cor estridente:',
      'Sombra sólida chapada stone-200 (3px 3px 0 0) em cada card pra dar ritmo no grid sem competir pela atenção.',
      'Hover-lift sutil: ao passar mouse o card sobe 2px e a sombra cresce pra stone-300 (5px 5px 0 0). Transição 150ms. Sinaliza foco rápido em qual card está ativo.',
      'Ordenação por VALOR decrescente dentro de cada grupo. Google Cloud R$ 1.372 vai pro topo, Eleven Labs R$ 81 pro rodapé. Cliente lê de cima pra baixo já em ordem de prioridade.',
      'Letra inicial em WATERMARK no canto inferior direito (text-stone-300/40, font-black, 56px). Quase invisível mas dá pista periférica pro cérebro decodificar mais rápido qual card é qual. Zero cor — só tom neutro do tema light.',
      'Item travado (Auto LJ) preserva mesma régua mas com sombra amber-200.'
    ]
  },
  {
    version: 'V36.14.4',
    date: '2026-06-09',
    title: 'Custos: items viram GRID 3-col de cards verticais (entrega que faltou)',
    bullets: [
      'Faltou esse pedaço na V36.14.1: os items continuavam em linha horizontal empilhada quando o pedido era grid de cards verticais (mesmo padrão do DRE Deduções e RevOps Composição). Corrigido.',
      'Cada item agora é um card vertical compacto: nome + engrenagem no topo, seletor de tipo de cálculo, input do valor, e valor calculado embaixo destacado em rose (regra design diretor).',
      'Engrenagem abre menu com "Remover" — padrão dos outros cards.',
      'Slot dashed "+ Adicionar item" como último card do grid, com microcopy progressivo.',
      'Items travados (Auto LJ das campanhas Ads) preservados com card próprio em amber.',
      'Modo Excel mantido como linha horizontal — ele é otimizado pra ver muitas fórmulas em sequência, faz sentido continuar tabular.'
    ]
  },
  {
    version: 'V36.14.3',
    date: '2026-06-09',
    title: 'Custos: cores dos valores seguem a régua design diretor (redução=rose)',
    bullets: [
      'Todo item em Custos é uma redução (é custo). Pela regra: valor = ROSE com prefixo "−".',
      'Cards de item (Builder e Excel): valor "Calculado" passa de slate-900 (neutro) → rose-700 com prefixo "−". Item travado/Auto LJ também.',
      'Header de grupo: "Total" passa de slate-900 → rose-700.',
      'Modo Builder com fórmula avançada: valor calculado sempre rose (status da fórmula continua na borda + badge: verde quando ok, amber quando alerta, rose quando erro).',
      'Resultado: numa olhada o cliente vê que toda a aba Custos é vermelho/redução. Status de saúde da fórmula independente.'
    ]
  },
  {
    version: 'V36.14.2',
    date: '2026-06-09',
    title: 'RevOps KPIs: correção de cores segundo regra do design diretor (redução=rose / adição=emerald)',
    bullets: [
      'TM (Ticket Médio) era sky → agora EMERALD. É o "Faturamento" da cascata, ponto de partida positivo (entrada que SOMA — análogo ao Faturamento Bruto do DRE).',
      'CAC (Custo de Aquisição) era amber → agora ROSE. É SUBTRAÇÃO clara na cascata, regra do design diretor manda vermelho.',
      'Valor calculado nos cards de Composição (MCU/MSU) era emerald quando válido → agora ROSE. Razão: o valor representa uma redução (prefixo −). A SAÚDE DA FÓRMULA continua sinalizada na borda + badge (verde quando ok, amber quando alerta, rose quando erro).',
      'Resultado: cliente vê numa olhada quais valores são redução (vermelho) vs adição/resultado (verde). Status da fórmula fica independente do tipo de operação.'
    ]
  },
  {
    version: 'V36.14.1',
    date: '2026-06-09',
    title: 'Custos ganhou a mesma régua do DRE e RevOps KPIs (tema light + IDs + validação + Djow)',
    bullets: [
      'Tema light igual DRE/RevOps: wrapper offwhite #f5f3f0 substituindo o branco-puro, cards de grupo bg-white/70 stone-200, cards de item bg-white/70 também. Empty state em dashed border-stone.',
      'Layout em grid 2-col com Djow lateral sticky à direita (igual DRE/RevOps).',
      'TODOS os inputs da aba ganharam ID único — bug clássico de "clica e perde foco" / "digita primeira letra e sai" eliminado também aqui. Aplica em: nome do grupo, nome do item, modo de cálculo (select), valor fixo, valor base, % aplicado, base de referência, grupo de referência, fórmula avançada.',
      'Validação visual da fórmula avançada agora usa a mesma régua RevOps: ✓ emerald + valor verde quando ok; ? amber + "R$ 0" quando computa zero (handle errado?); × rose + "erro" quando sintaxe inválida; — stone neutro quando vazio.',
      'Validação visual também no Modo Excel — borda emerald/amber/rose dependendo do status, sem badge expandido pra preservar layout horizontal.',
      'Djow lateral reconhece a aba "Custos" e mostra exemplos próprios na intro: "6000 fixos por mês", "15% do faturamento", "diferença entre fixos e variáveis", "qual bucket pra Google Ads?".',
      'Botões revisados: alternador Builder/Excel em white com shadow, ativo em violet sólido. Botão "Novo grupo" em violet sólido.'
    ]
  },
  {
    version: 'V36.14.0',
    date: '2026-06-09',
    title: 'RevOps KPIs ganhou a mesma régua da DRE — tema light, cards grid, Djow lateral',
    bullets: [
      'Tema light igual DRE: wrapper offwhite #f5f3f0 com cartões internos bg-white/70 e bordas stone. Cards da cascata (TM, MCU, MSU, CAC, Custo Fixo, Breakeven) preservaram a identidade visual mas saíram do branco-puro.',
      'Composição (modo do MCU/MSU) virou GRID 3-col de cards verticais — antes era tabela horizontal apertada. Cada card: nome em cima, fórmula no meio, valor calculado embaixo, engrenagem com menu "Djow ajuda + Remover" (mesmo padrão dos cards de Deduções).',
      'Slot dashed "+ Adicionar dedução" como último card do grid, com microcopy progressivo.',
      'Botões de modo (Auto / Valor único / Composição) revisados: padrão executivo, estado ativo violet sólido, hover discreto.',
      'IDs únicos em todos os inputs da tab pra eliminar o bug clássico de "clica e perde foco" / "digita uma letra e sai" (mesma lei cravada na DRE V36.13.2). Removidos onclick que disparavam render prematuro.',
      'Validação visual igual DRE: borda emerald + badge ✓ quando fórmula computa valor válido; amber + badge ? quando computa zero (handle errado?); rose + ✕ quando erro de sintaxe; stone + "—" quando vazio.',
      'Djow lateral sticky igual o da DRE, mas com motor expandido pra RevOps: reconhece "X% do MCU" → =mcu*0,X, "X% do MSU" → =msu*0,X, "X% do CAC" → =cac*0,X. Intro com exemplos contextuais (muda a régua quando estiver editando composição RevOps).',
      'Djow agora explica conceitos RevOps quando perguntado: "o que é MCU?", "explica breakeven", "o que é CAC?", "MSU explica" — cobre MCU, MSU, CAC, Breakeven, CTC, TM/Ticket além dos termos da DRE.'
    ]
  },
  {
    version: 'V36.13.5',
    date: '2026-06-09',
    title: 'DRE: fix CRÍTICO no cálculo das deduções + renomeado pra EBITDA',
    bullets: [
      '🚨 Fix crítico de matemática: deduções estavam sendo NEGADAS DUAS VEZES no engine. Bug aparecia desde V36.12.0 (deduções flat), mas só ficou visível agora porque o seletor de sinal sumiu do card. Resultado: Lucro Líquido inflava (chegava a aparecer maior que o Faturamento, margem 132%). Causa: signal default "−" pra deducoes_inside era interpretado como "crédito que REDUZ a categoria" pelo engine legacy.',
      'Fix em 2 camadas: addDreExtraLine agora usa signal "+" como default pra deducoes_inside (entrada SOMA à categoria, como esperado); normalize do whitelabel migra silenciosamente linhas legacy com signal "−" → "+" pra deducoes_inside.',
      'Lucro Líquido renomeado pra EBITDA (tecnicamente correto: o card final representa receita após Deduções, S&M e G&A, mas SEM depreciação, IR/CSLL ou juros). Pra infoproduto digital sem essas linhas, equivale ao resultado operacional do período.',
      'Tooltip educativo no card EBITDA e no rodapé (Margem EBITDA): passe o mouse pra ler "EBITDA = Resultado antes de juros, impostos sobre lucro, depreciação e amortização." Termina com nota de que pra negócio digital equivale ao operacional do período.',
      'Indicador ⓘ discreto ao lado do label "EBITDA" pro cliente saber que tem mais contexto pelo hover.'
    ]
  },
  {
    version: 'V36.13.4',
    date: '2026-06-09',
    title: 'DRE: Venda Líquida suprimida por default (subtotal intermediário desnecessário)',
    bullets: [
      'Venda Líquida deixa de aparecer como card no meio da DRE por default. Pra leitura executiva, o fluxo agora é direto: Faturamento → Deduções → S&M → G&A → Lucro Líquido.',
      'Volta a aparecer automaticamente quando cliente inserir grupo/extra customizado ancorado em afterStep="venda_liquida" — porque aí o subtotal faz diferença pra leitura.',
      'Mesma régua já cravada na V36.13.3 pro Lucro Bruto. Filosofia: subtotal intermediário só aparece quando carrega informação.'
    ]
  },
  {
    version: 'V36.13.3',
    date: '2026-06-09',
    title: 'DRE: validação visual da fórmula + Lucro Bruto duplicado suprimido',
    bullets: [
      'Cards de fórmula agora têm 3 estados visuais: VAZIO mostra "—" neutro em vez de "−R$ 0"; PREENCHIDO E VÁLIDO fica como antes (rose); PREENCHIDO MAS COMPUTA ZERO mostra borda amber + badge "?" + tooltip explicando que o handle ou número pode estar errado.',
      'Tooltip do input ajuda também: passa o mouse e mostra "Digite um número fixo (ex: 6000) ou uma fórmula (ex: =vendas*5)" no estado vazio, ou explica o problema no estado amber.',
      'Lucro Bruto SUPRIMIDO quando idêntico a Venda Líquida — pra negócio digital típico (Sansone) sem CGV/COGS estruturado, Venda Líquida = Lucro Bruto e o card duplicado confundia. Quando cliente inserir grupo/extra entre VL e LB, eles divergem e Lucro Bruto reaparece automaticamente.',
      'Aplicado a deduções avulsas (deducoes_inside) e a items de grupo (extras com pais laranja). Cards read-only de custos variáveis seguem com mesma régua de cor.'
    ]
  },
  {
    version: 'V36.13.2',
    date: '2026-06-09',
    title: 'DRE: fix do bug de foco — inputs perdiam foco ao clicar / digitar',
    bullets: [
      'Bug clássico de foco: o input de fórmula dos cards tinha um onclick que disparava Actions.selectDjowRevopsLine — isso fazia App.render() rolar no momento exato do clique, matando o input e tirando o cliente fora. Resultado: "clica e sai".',
      'Fix: removi o onclick de seleção dos inputs de fórmula. Seleção da linha pro Djow agora é só via menu engrenagem → "Djow ajuda" (caminho intencional, sem ambiguidade).',
      'Todos os inputs dos cards do DRE (linha-banner, cards de dedução, cards de extras, cards de grupo) ganharam id único. O motor de captura de foco do LJ (_captureFocus / _restoreFocus) consegue agora restaurar foco e cursor após qualquer re-render colateral.',
      'Memória cravada V36.8.1 reforçada: todo input em UI com re-render precisa de id pra sobreviver ao ciclo render → reparse.'
    ]
  },
  {
    version: 'V36.13.1',
    date: '2026-06-09',
    title: 'DRE: Deduções ganha linha-banner vermelha (simetria com S&M e G&A)',
    bullets: [
      'Deduções agora tem linha-banner ROSE simétrica com S&M (Aquisição) e G&A (Fixos). Antes era só um label "Deduções" pequeno acima do grid de cards — quebrava a régua visual das outras subtotais.',
      'A linha-banner de Deduções é FIXA: cliente não pode renomear, não tem signal (sempre subtrai), não tem engrenagem de remover. Ela é estrutural da DRE.',
      'Deduções não tem fórmula própria — o valor da linha é a soma dos cards filhos (custos variáveis read-only + deduções avulsas). Cliente continua adicionando deduções via "+ Adicionar dedução" no slot dashed.'
    ]
  },
  {
    version: 'V36.13.0',
    date: '2026-06-09',
    title: 'DRE: "+ inserir linha" cria linha-banner laranja com cards filhos',
    bullets: [
      'Nova mecânica de inserção: o botão "+ inserir linha" entre marcos base (Faturamento, Venda Líquida, Lucro Bruto, S&M, G&A) agora cria uma LINHA-BANNER laranja personalizada com nome editável, badge "personalizada", engrenagem com opção de remover, e seu próprio valor agregado.',
      'Simetria com os marcos base: a linha-banner laranja tem a mesma altura/forma das linhas verdes (Faturamento) / sky (Venda Líquida, Lucro Bruto) / amber (Lucro Líquido) que já existiam. Fica visualmente claro que é uma fase customizada na DRE.',
      'Depois que o cliente dá nome à linha, libera GRID 3-col de cards filhos abaixo. Cada card é um item com nome e fórmula (mesma régua dos cards de Deduções).',
      'Valor da linha-banner = soma dos cards filhos. Engrenagem do card abre menu "Djow ajuda + Remover" (mesma régua), engrenagem da linha tem "Remover linha" (apaga a categoria inteira com os cards filhos).',
      'Compat: linhas extras legacy (criadas pré-V36.13.0) continuam funcionando como cards individuais. Novas inserções viram grupos.',
      'Sinal +/− na linha-banner controla se o total entra somando ou subtraindo no fluxo da DRE (ex: "+ Receitas Financeiras" soma após Lucro Bruto; "− Bônus pagos extras" subtrai).',
      'Djow lateral reconhece quando cliente clica num card filho de grupo e aplica fórmula direto no item (não na linha-pai).'
    ]
  },
  {
    version: 'V36.12.1',
    date: '2026-06-09',
    title: 'DRE: deduções viram GRID de cards verticais (padrão Etapa 3 do Mapa)',
    bullets: [
      'Cards de dedução agora são verticais em GRID 3-col (Mapa Etapa 3 style), não mais linhas horizontais. Nome em cima, fórmula no meio, valor calculado embaixo.',
      'Engrenagem no canto superior direito de cada card abre menu compacto com "Djow ajuda" + "Remover". Mesmo padrão dos KR-mãe cards do Mapa.',
      'Slot dashed "+ Adicionar dedução" como último card do grid, com microcopy progressiva ("Comece aqui" / "Cobre melhor o funil" / "Adiciona granularidade" / "Outra dedução?").',
      'Custos variáveis (cadastrados em Custos) viram cards read-only com badge "read-only" no canto, pra cliente entender que pra editar tem que ir na aba Custos.',
      'Extras de outros steps (S&M, G&A) também viram cards verticais compactos com mesma engrenagem.'
    ]
  },
  {
    version: 'V36.12.0',
    date: '2026-06-09',
    title: 'DRE repaginada — tema light + deduções flat + Djow lateral pra ajudar com fórmulas',
    bullets: [
      'Tema light igual o Mapa da Receita: wrapper offwhite #f5f3f0 com cartões internos bg-white/70 e bordas stone. Branco-puro saiu — fundo morno mais confortável pra leitura prolongada.',
      'Deduções FLAT: tirei o header colapsável "(−) Deduções" com subtotal agregador. Agora cada dedução é uma linha standalone entre Faturamento Bruto e Venda Líquida, marcada com bordinha rose à esquerda. Subtotal continua existindo internamente pro motor calcular, mas não aparece como caixa coletiva.',
      'Cada linha virou card no padrão Etapa 3 do Mapa (bg-white/70 stone-200, padding enxuto). Inputs menores (py-1 em vez de py-2.5), gaps reduzidos. Visual mais clean.',
      'Djow lateral sticky à direita da DRE — caixinha sempre aberta com mensagem pré-setada "Como posso te ajudar?". Cliente escreve em PT ("Lara ganha 5 por venda", "15% do faturamento") e o Djow devolve a fórmula no formato certo.',
      'Apply automático: clique numa linha (input ou ícone violet de sparkles) pra "selecionar" — borda violet aparece. Aí faz a pergunta, Djow propõe fórmula, botão "Aplicar" preenche o input da linha selecionada direto.',
      'Motor local de sugestão cobre padrões comuns: "X por venda" → =vendas*X, "X% do faturamento" → =fat_bruto*0,X, "X% sobre venda líquida" → =fat_liquido*0,X, "X% do lucro bruto", composto ("5 por venda + 3% do faturamento"), e perguntas conceituais ("o que entra em deduções?").',
      'S&M, G&A e Custos mantêm a estrutura agrupada atual — refator só atingiu Deduções (a única que Felipe queria flat) e o tema visual do DRE.'
    ]
  },
  {
    version: 'V36.11.1',
    date: '2026-06-09',
    title: 'Visão Geral: tasks ClickUp agora entram no cruzamento por campanha',
    bullets: [
      'Bug do dia: tasks criadas direto pelo ClickUp (via modal de criação) só setavam linked_action_id, sem linked_campaign_id. Resultado: o cruzamento da Visão Geral perdia essas tasks e mostrava "0 tarefas" mesmo quando havia 20 no ClickUp da campanha.',
      'Fix: fallback automático task → action → campanha. Se task tem linked_action_id, agora resolvemos a campanha pela ação vinculada (App.state.actions[].campaignId).',
      'Card de atalho "Tarefas" agora mostra breakdown por provider (ex: "12 ClickUp · 3 manual · 2 atrasada(s)") em vez de só pendente/atrasada. Fica explícito que ClickUp está contando.'
    ]
  },
  {
    version: 'V36.11.0',
    date: '2026-06-09',
    title: 'Visão Geral consolidada — cruzamento Tarefas + Checkout + Google por campanha do Mapa',
    bullets: [
      'Sub-tab "Visão Geral" do Dashboard repensada: agora é o ÚNICO lugar onde as 3 fontes (Tarefas, Checkout/Hotmart, Google Ads + GA4) se cruzam. As outras abas continuam puras, mostrando o que cada ferramenta entrega isolada.',
      'Agrupamento ESTRITO por campanha do Mapa: cada cruzamento amarra ads + tarefas + sessões GA4 + receita Hotmart à branch correspondente. Cliente sem campanha no Mapa cai em empty state com CTA pra abrir o Mapa.',
      'Filtros no topo: janela temporal (7d default / 30d / 90d) + dropdown de campanha (Todas ou uma específica).',
      'Djow narra 1 frase consolidada no topo + lista de até 5 alertas ranqueados por severidade: gasto sem execução, ROAS abaixo de 1, tarefas atrasadas concentradas, clicks sem sessões (tracking quebrado), investimento sem venda, etc.',
      'KPIs cruzados que nenhuma aba isolada calcula: ROAS efetivo (receita Hotmart ÷ gasto Ads), CAC consolidado, Sessões→Venda %, Clicks→Sessões %, Receita total, Esforço operacional.',
      'Tabela por campanha do Mapa: gasto Ads, clicks, sessões GA4, ROAS, tarefas (concluídas/total) — ROAS<1 destacado em vermelho, tarefas atrasadas em âmbar.',
      'Cards de atalho pras 4 fontes (Tarefas / Checkout / Google Ads / GA4) com sumário do período e botão "Abrir aba" pra mergulhar no raio-x.',
      'Header mostra badges ON/OFF das 3 integrações pra leitura rápida do que está conectado.'
    ]
  },
  {
    version: 'V36.10.3',
    date: '2026-06-09',
    title: 'Dashboard ganhou sub-tab "Tarefas" — visão executiva agnóstica de provider e campanha',
    bullets: [
      'Nova sub-tab "Tarefas" no Dashboard (cor violet RevOps #AB3ED8, ícone list-checks). Aparece depois de GA4 com separador. Visão MACRO da execução, agnóstica de provider (ClickUp/Trello/Manual/...) e agnóstica de campanha.',
      'Conteúdo da dash: 5 stat cards (Total / Em dia / Atrasadas / Concluídas / Sem resp.), distribuição por provider (com badge "ON" no conectado), top 10 responsáveis com carga e breakdown, painéis "Próximas 7 dias" e "Top 5 mais atrasadas".',
      'Filtros: range temporal (Todas / Próximos 7 dias / Próximos 30 dias / Vencidas) + provider específico.',
      'Empty state quando não há tasks: CTA pra Configurar provider (Integrações) ou abrir Mapa da Receita pra criar tasks via Etapa 4.',
      'Reusa o mesmo dataset do Acompanhamento da Etapa 5 (ExecutionTaskStore.all()) — mas aqui é macro, sem filtro de campanha. Útil pra ver gargalos de pessoa, distribuição entre providers e tasks vencidas que precisam de ação imediata.'
    ]
  },
  {
    version: 'V36.10.2',
    date: '2026-06-09',
    title: 'Etapa 5 (Acompanhamento): dashboard adaptado pra tema light — mesma régua das outras etapas',
    bullets: [
      'Wrapper offwhite #f5f3f0 + _stepIntroLight com novo help balloon explicando o ciclo do acompanhamento (KRs com saúde, ações por status, carga por responsável, Gantt).',
      'Empty state ("Nenhum número conectado a ação") em bg-amber-50 com botão amber-600 sólido. CTA agora aponta pra Etapa 4 (era "operations" antigo).',
      'Stat cards (Total / Em dia / Atrasadas / Concluídas / Sem resp.) em -100 saturado com texto -800 e ícone -700. Antes eram -500/10 com texto -200 — lavados sobre offwhite.',
      'Section headers (Números / Ações / Carga / Gantt) recolhíveis com chevron em bg-white border stone-300.',
      'KR rows e Action rows em bg-white com bordas stone-200 + status pills -100/300/800 saturadas (concluídas verde, em dia azul, atrasadas rose).',
      'Barras de carga por usuário em bg-white com avatares -100/300/800. Barras de progresso continuam gradient saturado.',
      'Gantt timeline em bg-white com ticks stone-500 e linha "hoje" violet-500 sólida. Barras de tasks mantém gradient saturado (-500 → -400).',
      'Scope selector (Campanha vs Produto inteiro) com select bg-white border stone-300.'
    ]
  },
  {
    version: 'V36.10.1',
    date: '2026-06-09',
    title: 'Etapa 4 (Campanha): body de trabalho adaptado pra tema light vibrante',
    bullets: [
      'Header "Editando a campanha" passou de violet escuro lavado pra violet-100 vibrante com texto slate-900.',
      'Master cards das 3 frentes (Marketing/Vendas/CS) ganharam fundos brancos com bordas e hover saturados. Estado ativo destaca em bg-${tone}-100 com ${tone}-400 sólido — antes era opacidade 10% sobre fundo dark, ficava cinza esmaecido sobre offwhite.',
      'Botão "Add Ação" virou bg-${tone}-500 saturado com texto branco — CTA agora chama olho de verdade.',
      'Action cards do mind-map: bg-white com border ${color}-400 sólido + shadow. Status pills em -100/300/800 (saturadas pra ler). Antes era bg-slate-900/60 — invisível no offwhite.',
      'Botão "Executar Ação" amber sólido bg-amber-500 hover:amber-600 com texto branco. Eliminado o gradient transparente→amber que ficava lavado.',
      'Tasks ClickUp/Manual no execution branch: bg-white com borders saturadas + texto slate-900.',
      'Card de ação órfã: stone-100 com border stone-300 + overlay "Resolver" em bg-amber-500 sólido.',
      'CTA hint "Clique numa frente abaixo": branco com borda violet-500 esquerda + texto stone-700.'
    ]
  },
  {
    version: 'V36.10.0',
    date: '2026-06-09',
    title: 'Mapa da Receita: Etapas 4 (Selecionar Campanha) e 5 (As Ações) FUNDIDAS na nova Campanha — 5 etapas no total',
    bullets: [
      'O Mapa passa de 6 pra 5 etapas. A antiga Etapa 4 (hub de seleção) era um passo morto — cliente clicava em "Seguir" só pra mudar contexto, sem trabalho real. Agora ela funde com a antiga Etapa 5 (As Ações): seleção e trabalho viram um gesto só na mesma tela.',
      'Nova Etapa 4 "Campanha": seletor compacto de campanhas no topo (cards horizontais com plugadas + desplugadas + "Nova campanha"). Clicar em uma campanha troca o contexto sem mudar de etapa. Abaixo: trabalho da campanha ativa (plugar números + ligar ações por frente).',
      'Antiga "Acompanhamento" virou a Etapa 5. Badge "X passos até a receita" da Etapa 1 baixa de 4 → 3 passos.',
      'Textos das Etapas 1-3 que mencionavam "Etapa 5" (liga ações) ou "Etapa 6" (Acompanhamento) atualizados pra "Etapa 4" e "Etapa 5".',
      'Hand-off Djow "Campanha selecionada → trabalhar" removido (não há mais transição entre essas duas — viraram a mesma etapa). Hints de "operations" fundidos em "campaign".',
      'Compatibilidade: código legado que seta zoom=\'operations\' continua funcionando via alias (\'operations\' → \'campaign\').'
    ]
  },
  {
    version: 'V36.9.9',
    date: '2026-06-09',
    title: 'Etapa 3: grid 4-col + slots placeholder + engrenagem + sugestões só ao clicar "Adicionar mais um"',
    bullets: [
      'Grid de KRs subiu pra 4 colunas em desktop (1/2/3/4 conforme breakpoint). Cards ficam menores e ocupam menos espaço vertical.',
      'Slots vazios placeholder (dashed cinza claro) aparecem completando a linha quando há menos de 4 itens — visual estável "esperando criação". Quando passa de 4, sobra natural do grid.',
      'Botões Editar/Remover do KR confirmed viraram ÍCONE DE ENGRENAGEM com popover. Click na engrenagem abre menu com as 2 opções; click em qualquer opção fecha o menu. Limpa muito o topo do card.',
      'Catálogo de sugestões + "Não achou? Crie um personalizado" agora só aparecem QUANDO o cliente clica em "+ Adicionar mais um". Antes ficavam visíveis sempre embaixo do grid (mesmo colapsado, o botão "+ Sugestões" estava ali). Agora o card "Adicionar mais um" é o ÚNICO gatilho.',
      'Catálogo simplificado: sem botão de toggle interno (não precisa mais — o trigger é externo). Mostra direto chips agrupados em "Sugeridos pelo LJ" e "Da sua experiência".'
    ]
  },
  {
    version: 'V36.9.8',
    date: '2026-06-09',
    title: 'Etapa 3: KRs em grid lado a lado + card "Adicionar mais um" + empty state forte (estados 0→N)',
    bullets: [
      'KRs adicionados agora viram cards LADO A LADO em grid (1 col mobile, 2 cols desktop) em vez de empilhados full-width. Aproveita melhor o espaço horizontal e dá visual de "deck de números".',
      'No fim do grid: card especial dashed "+ Adicionar mais um" que sempre convida — com microcopy progressiva pela contagem: 1 KR → "Cobertura melhor do funil"; 2 → "Quer adicionar outro?"; 3 → "Mais granular sua leitura"; 4+ → "Sempre dá pra adicionar mais". Click abre o catálogo de sugestões.',
      'Empty state da frente sem KRs ganha bloco grande "Vamos começar! Crie o primeiro número pra Marketing." com botão CTA "Ver sugestões pra começar". Substitui o "Adicione abaixo" discreto que cliente nem via.',
      'Linha "Dono herdado da Etapa 2 — editar na Etapa 2" REMOVIDA do bloco aberto (repetia o dono que já aparece no header e poluía o card).',
      'Animação suave (fade-in + slide-down 200ms) quando bloco da frente ou catálogo de sugestões abrem — em vez do "salto" abrupto de antes.'
    ]
  },
  {
    version: 'V36.9.7',
    date: '2026-06-09',
    title: 'Etapa 3 reescrita pra deixar claro o que é "número" e o ciclo estratégia → ação → impacto',
    bullets: [
      'Hint da etapa agora explica que o número é o ELO entre estratégia e execução: você define aqui, na Etapa 5 liga ações que prometem mover ele, e quando rodam o número se preenche — o produto sabe se cresceu. Antes só dizia "1+ por frente" sem contar o porquê.',
      '"Entenda mais" virou um briefing do ciclo completo (4 passos: define → liga ações → rollup mede contribuição → vê saldo na Etapa 6). Inclui explicação do termo "rollup" que aparecia sem definição em outros lugares.',
      'Catálogo virou "+ Sugestões pra Marketing" (jargão "Catálogo" trocado por linguagem clara). Microcopy explica o fluxo: "Ative um → defina a meta → na Etapa 5 você liga ações pra mover ele". Agrupado em "Sugeridos pelo LJ" + "Da sua experiência" (✨ aprendidos).',
      'Botão "Criar número customizado" virou texto sutil "Não achou? Crie um número personalizado" — caminho B, não principal.',
      'Banner Pulso da Receita reescrito: explica que esses números aparecem na Home pulsando em tempo real conforme as ações rodam. Antes só dizia "ACOMPANHANDO PULSO DA RECEITA" sem contexto.'
    ]
  },
  {
    version: 'V36.9.6',
    date: '2026-06-09',
    title: 'Etapa 2 (Comercial): contador de números removido pra eliminar confusão entre KR-mãe vs KR-filho',
    bullets: [
      'Os cards de cada frente (Marketing/Vendas/CS) na Etapa 2 mostravam "X números definidos" + botão "Ver números →". Esse X contava KR-FILHOS plugados na CAMPANHA atual; já a Etapa 3 mostra KR-MÃE do produto. Quando os números divergiam (cliente tem 5 KR-mãe mas só 2 plugados na campanha), parecia bug.',
      'A Etapa 2 agora só cuida de UMA pergunta: "quem responde por cada frente?" — dono + prazo, mais nada. Pra saber quantos números cada frente tem, cliente navega pra Etapa 3 pelo stepper.',
      'O contador real (com paralelismo entre mãe e filho) entra no roadmap como evolução futura — quando precisar mostrar plugagem por campanha, vai aparecer com label explícito ("2 plugados / 5 disponíveis").'
    ]
  },
  {
    version: 'V36.9.5',
    date: '2026-06-09',
    title: 'Etapa 3 (Os Números): cards colapsáveis + inputs compactos, sem desperdício de espaço',
    bullets: [
      'Cada frente (Marketing/Vendas/CS) agora vem FECHADA por default. Header mostra ícone + nome + dono + resumo numérico ("3 números · 2 confirmados") + selo "Pronto". Cliente vê a cobertura num scan rápido; abre só onde quer mexer.',
      'Catálogo de sugestões também colapsado por default: "+ Catálogo (N disponíveis) ▾". Reduz ruído visual quando há muitas opções (Marketing tem 8+).',
      'Inputs de Meta (Atual / Segura / Avançada) compactados pra ~80px de largura — antes ocupavam grid-cols-3 com w-full, desperdício gigante pra valores de 1-4 dígitos. Layout virou flex horizontal com chip "📅 90 dias" inline + tooltip "Por que 90 dias?".',
      'Confirmed card também ficou mais compacto: 1 linha de info + rollup inline + botões Editar/Remover no topo direito.',
      'Auto-expand: quando cliente adiciona/ativa um KR numa frente, ela abre automaticamente pra não esconder o novo card.'
    ]
  },
  {
    version: 'V36.9.4',
    date: '2026-06-09',
    title: 'Mapa da Receita — Etapa 3 (Os Números) repensada: 3 blocos por frente em paralelo à Etapa 2',
    bullets: [
      'Tabs (Marketing | Vendas | CS) deram lugar a 3 blocos verticais empilhados — um bloco por frente. Cliente VÊ a cobertura completa de uma vez (3 selos verdes "Pronto" = funil fechado; bloco sem selo = lacuna óbvia).',
      'Cabeçalho de cada bloco mostra ícone + nome da frente + dono herdado da Etapa 2 (read-only com link "editar na Etapa 2"). Removida a edição direta do dono aqui — a Etapa 2 é a fonte da verdade.',
      'Tema offwhite #f5f3f0 + cartões bg-white/70 + tipografia stone. Mesma régua das Etapas 1 e 2.',
      'KR card light em 2 estados: editing (form com Atual + Meta Segura + Meta Avançada + Período + botão Confirmar) e confirmed (verde, com Hoje/Segura/Avançada + rollup + Editar/Remover).',
      'Hint da etapa ficou mais direta: "Cada frente do Comercial precisa de 1+ número pra perseguir. Sem cobrir as 3, o funil fica manco."',
      'Djow Etapa 3 com hints adaptativos por cobertura: 0 frentes → "Por onde começo?", "Bons números pra Marketing?", "Quantos por frente?"; cobertura parcial → "Falta cobrir X e Y", "Avalia meus números", "Quanto botar de meta?"; 3/3 → "Avalia", "Posso avançar?", "Metas estão coerentes?".',
      'Avaliador real do Djow pra Etapa 3: olha cobertura por frente + qualidade das metas (Avançada > Segura) + KRs em rascunho + desbalanceamento (5 KRs numa frente, 1 em outra). Devolve checklist + alertas + veredito.'
    ]
  },
  {
    version: 'V36.9.3',
    date: '2026-06-09',
    title: 'Mapa da Receita — Etapa 2 (Comercial) repensada: mesma régua da Etapa 1',
    bullets: [
      'Tema offwhite #f5f3f0 + cartões internos bg-white/70. Header com chip slate da Etapa, indicador de "X passos até a receita" como texto sem borda e botão "Entenda mais" com cara de botão.',
      'Modo dual POR FRENTE (Marketing/Vendas/CS): vazio mostra form pra preencher dono; preenchido mostra dono em destaque + selo verde "Pronto" no canto + botão Editar. Edit reabre o form inline com botão "Pronto" pra voltar pro display.',
      'Banner explicativo "Área Comercial é onde a empresa toca o cliente..." só aparece se NENHUMA frente está preenchida. Some quando o cliente já entendeu — não polui revisão.',
      'Djow Etapa 2 com sugestões adaptativas por contagem de frentes: 0/3 → "Por onde começo?"; 1-2/3 → "Falta N frente(s)" + "Avalia minhas frentes"; 3/3 → "Posso avançar?" + "Como medir cada frente?".',
      'Avaliador real do Djow pra Comercial: olha as 3 frentes, devolve checklist por frente (✓/⚠), alertas estruturais (mesma pessoa nas 3 = "1 herói cobrindo tudo"; frente sem dono mas com KRs = "número órfão") e veredito de avanço.'
    ]
  },
  {
    version: 'V36.9.2',
    date: '2026-06-09',
    title: 'Djow da Etapa 1: filtro de etapa, sugestões adaptativas e avaliador real da frase do objetivo',
    bullets: [
      'Transitions de outras etapas não poluem mais a sidebar. Quando você abre a Etapa 1, só mensagens da Etapa 1 aparecem (transition da Etapa 4 fica oculta lá no espaço dela).',
      'Sugestões do Djow adaptam ao estado: se você ainda NÃO escreveu o objetivo, ele oferece "Por onde começo?" / "Me dá um exemplo do meu nicho" / "O que NÃO escrever". Se VOCÊ JÁ escreveu, ele oferece "Avalia minha frase" / "Como deixar mais ambiciosa?" / "Posso avançar?".',
      'Djow virou crítico real: clicar "Avalia minha frase" faz check estrutural em 3 dimensões — POSIÇÃO (referência/preferido/líder), PÚBLICO (pra quem) e HORIZONTE (prazo) — devolve checklist + veredito + sugestão concreta. Funciona mesmo sem ligar Anthropic externa (tem fallback local que olha pra estrutura da sua frase).',
      'Quando o chat tem mensagens, sugestões ficam recolhidas em "Sugestões ▾" pra não competir visualmente com a conversa.'
    ]
  },
  {
    version: 'V36.9.1',
    date: '2026-06-09',
    title: 'Mapa da Receita — Etapa 1: tema offwhite (cinza claro morno) + hierarquia de badges',
    bullets: [
      'Tema da Etapa 1 desceu de branco quase puro pra offwhite morno (#f5f3f0). Cartões internos com bg-white/70 — continua ilha clara mas com peso e textura.',
      'Header da etapa: 4 elementos que pareciam "tudo badge" ganharam formas distintas por função: "Etapa N" virou chip slate sólido com número grande (identificador de POSIÇÃO); "X passos até a receita" virou texto-com-ícone sem borda (INDICADOR de jornada); "Entenda mais" virou botão com cara de botão e chevron (AÇÃO interativa); "Revisão" saiu do header e virou selo no canto do cartão de display (ESTADO da etapa).',
      'Hierarquia visual: agora o olho lê POSIÇÃO primeiro → INDICADOR depois → encontra a AÇÃO no canto direito.'
    ]
  },
  {
    version: 'V36.9.0',
    date: '2026-06-09',
    title: 'Mapa da Receita — Etapa 1 (Objetivo) repensada: modo dual + tema claro + fixes de bug',
    bullets: [
      'Etapa 1 agora tem 2 modos: vazio mostra TUTORIAL completo (template + 5 exemplos práticos), preenchido mostra REVISÃO (sua frase em destaque + botão Editar). Quem já passou pela etapa não vê mais a pedagogia de novo.',
      'Tema da etapa virou "ilha clara dentro do escuro": cartão branco com tipografia escura pra puxar foco pro trabalho. O resto do Mapa segue dark (header, stepper, Djow).',
      'Exemplo de produto destacado deixou de ser "chocolate em barra" (que destoava de qualquer nicho diferente). Virou TEMPLATE genérico ("Ser o(a) [posição] preferido(a) de [público] até [horizonte]") + 5 exemplos práticos como referência.',
      'Removido o label hostil "OUTROS EXEMPLOS PRA LEITURA (NÃO CLICÁVEIS)" — virou só "Exemplos práticos:".',
      'Removida a dica duplicada do Djow na sidebar pra etapa 1 (estava ecoando a instrução do próprio título).',
      'Bug fix: sidebar do Djow não repete mais o mesmo card de hand-off N vezes quando cliente volta e re-avança no wizard. Histórico antigo também é colapsado na leitura.',
      'Bug fix: badge "X passos até a receita" agora trata Acompanhamento como PÓS-receita (etapa 6 era contada como passo, sumia a receita real que acontece na etapa 5 "Ações"). Acompanhamento ganha selo "Pós-execução".'
    ]
  },
  {
    version: 'V36.8.6',
    date: '2026-06-09',
    title: 'Dashboard Google Ads não mostra mais dados de exemplo quando conta está conectada sem campanhas',
    bullets: [
      'Antes: cliente conectava Google Ads, sync rodava, conta não tinha campanhas reais → Dashboard caía pro mock genérico ("Dados de exemplo"). Confundia muito (Sansone relatou: "tá integrado mas mostra fictícios").',
      'Agora: 3 estados em vez de 2. Se sync rodou e a conta tem 0 campanhas, mostra empty state explícito: "Conta conectada, sem campanhas ativas" + última sincronização + botão "Sincronizar agora" + atalho pra abrir Google Ads.',
      'Mock só aparece quando o sync nunca rodou (cliente novo de verdade).',
      'Fix bônus: ícone "facebook" do sub-tab Meta Ads foi removido do Lucide — trocado por "megaphone" pra parar de poluir o console com warnings.'
    ]
  },
  {
    version: 'V36.8.5',
    date: '2026-06-09',
    title: 'Warning de escala MCU/MSU agora é acionável — botões "Aplicar correção" e "Corrigir todas"',
    bullets: [
      'O aviso amber em fórmulas com fat_bruto em métricas POR VENDA estava confuso: dizia "tá errado pra MCU" mas não mostrava qual era a fórmula certa.',
      'Cada linha amber agora mostra explicitamente a forma correta (ex: =tm*0,059) num bloco compacto + botão "Aplicar" que substitui automaticamente.',
      'No topo da Composição (MCU e MSU), banner amber resumido mostra quantas fórmulas estão sendo auto-corrigidas + botão "Corrigir todas" que substitui as N fórmulas de uma vez.',
      'Após aplicar, borda vira verde, banner some, fórmula fica idiomática (=tm*X em vez de =fat_bruto*X) e o resultado fica matematicamente idêntico.'
    ]
  },
  {
    version: 'V36.8.4',
    date: '2026-06-09',
    title: 'Fix crítico: MCU (Margem de Contribuição Unitária) misturava escala mensal com unitária',
    bullets: [
      'Bug grave no RevOps: ao usar modo "Composição" da MCU, fórmulas como =fat_bruto*0,059 eram avaliadas literalmente — o engine multiplicava o faturamento do mês inteiro (R$ 347.000) pelo percentual, gerando dedução de R$ 20.473 PER VENDA. Resultado: MCU virava negativa em R$ 176k quando deveria ser positiva em R$ 165.',
      'Causa: o engine "Auto" tratava automaticamente fat_bruto como ticket × factor (correto pra contexto unitário), mas o modo "Composição" avaliava a fórmula crua sem essa correção.',
      'Fix em 5 partes (Estratégia C híbrida): (1) symbol table agora tem `tm` como alias de ticket pra usar em métricas POR VENDA; (2) resolveOverride aceita opts.unitContext e divide resultado por sales quando fórmula usa fat_bruto/fat_liquido em métrica unitária; (3) deriveFormula remapeia base fat_bruto→tm em contexto unitário; (4) callers MCU e MSU passam unitContext:true; (5) validateFormula emite warning amber quando cliente escreve fat_bruto em métrica unitária ("LJ corrigindo automaticamente — use tm pra fórmula idiomática").',
      'Tags `tm` adicionada ao autocomplete dos handles disponíveis no Modo Excel.',
      'Sansone (Atira.Pro): MCU agora calcula correto. Se quiser ajustar a projeção de 1.000 vendas pra 850 reais, edita no input "Vendas previstas" do produto — não é bug, é setting.'
    ]
  },
  {
    version: 'V36.8.3',
    date: '2026-06-09',
    title: 'CAUSA RAIZ da perda de dados — Health Check enviava ping vazio que sobrescrevia o banco',
    bullets: [
      'Caçada com diagnóstico cirúrgico via spy de fetch identificou o culpado: o painel Health Check (V36.5.0) fazia POST /api/state-sync a cada 30s com body { state: { hc_ping: true } } pra "testar conectividade".',
      'O endpoint não distinguia ping de state real — salvava { hc_ping: true } literal como state do tenant, sobrescrevendo produtos, campanhas e ações a cada execução.',
      'Os guards V36.7.1 e V36.7.2 não pegaram porque esse fetch direto não passa pelo _doPush do RemoteSyncAdapter onde os guards moram.',
      'Fix camada 1 (frontend): runHealthCheck agora usa GET /api/state-sync (só leitura). Bonus: o check agora compara contagem local vs remoto e marca como ERRO se houver drift.',
      'Fix camada 2 (backend): /api/state-sync POST rejeita body { hc_ping: true } e qualquer state sem campos mínimos (products/campaigns/actions/integrations) com HTTP 422. Também loga warning quando alguém tenta zerar state que tinha dados.',
      'Erro meu da V36.5.0 quando criei o Health Check Panel — não pensei nas consequências do POST. Pedi desculpas pelo Felipe ter perdido dados 3 vezes hoje.'
    ]
  },
  {
    version: 'V36.8.2',
    date: '2026-06-08',
    title: 'Fix do "digitando ao contrário" — input type=email não funciona com re-render',
    bullets: [
      'Os campos de email no modal de criar cliente estavam invertendo a ordem dos caracteres digitados (digitava "c6b" e aparecia "b6c").',
      'Causa: inputs com type="email" não suportam selectionStart em todos os browsers (inclusive Chrome). O sistema que preserva o cursor depois de cada re-render não conseguia salvar a posição, e o cursor caía sempre no início.',
      'Fix: trocados type="email" por type="text" nos campos de email do modal. A validação de formato continua sendo feita por regex JS — formato visualmente igual, mas comportamento correto.'
    ]
  },
  {
    version: 'V36.8.1',
    date: '2026-06-08',
    title: 'Fix do bug clássico — input perdia foco depois da 1ª letra nos modais novos',
    bullets: [
      'Os inputs do modal de criar cliente e do wizard de banco de dados perdiam foco a cada letra digitada (o App.render dispara em cada keystroke e o DOM era reconstruído).',
      'O LJ já tem solução pra isso (_captureFocus + _restoreFocus em src/main.js) mas cada input precisa ter id único pra ser localizado e restaurado.',
      'Adicionados IDs em todos os inputs novos. Agora você digita normalmente sem precisar clicar de novo a cada letra.'
    ]
  },
  {
    version: 'V36.8.0',
    date: '2026-06-08',
    title: 'Master pode criar clientes novos + onboarding guiado com banco de dados',
    bullets: [
      'Painel "Tenants" no master ganhou botão "+ Criar novo cliente". Modal pede slug, nome, email do master do cliente e emails da equipe (opcionais).',
      'Ao criar, o LJ gera senha aleatória forte pra cada usuário e mostra num modal pra você copiar e mandar pro cliente por canal seguro (não persiste em lugar nenhum depois).',
      'Cliente novo nasce sem banco de dados. No primeiro login, o sininho mostra mensagem de boas-vindas explicando o que o LJ faz e um alerta crítico pedindo pra conectar um Postgres.',
      'Wizard de conexão de banco em 4 passos: escolha entre Railway (recomendado), Neon, Supabase ou Postgres próprio. Pra Railway, tutorial passo a passo dentro do LJ (5 etapas curtas).',
      'Pra Postgres próprio, formulário com campos separados (host, porta, user, senha, database) — LJ monta a connection string automaticamente.',
      'Enquanto banco não está conectado, todas as integrações (RD, Hotmart, ClickUp, Google Ads, GA4, Meta Ads) ficam BLOQUEADAS com tela de cadeado explicando o porquê. Master sempre passa sem bloqueio.'
    ]
  },
  {
    version: 'V36.7.2',
    date: '2026-06-08',
    title: 'Tripla camada de proteção contra perda silenciosa de dados',
    bullets: [
      'Identificadas 2 vulnerabilidades adicionais que podiam causar a perda do Sansone:',
      '(1) Se o normalize() do state remoto crashasse silenciosamente, o app caía pra usar o state local vazio e zerava tudo. Fix: try/catch ao redor do normalize remote — se crashar, usa o state remoto raw (sem normalize) que ainda tem dados, melhor que vazio.',
      '(2) O App.save() persistia em localStorage mesmo com state vazio. Fix: guard adicional bloqueia o save INTEIRO (local + push) quando state em memória aparenta vazio mas o servidor tinha dados no boot.',
      'Agora há 3 camadas de proteção: bloqueio no save, bloqueio no push (V36.7.1), e fallback robusto no load.',
      'Toast amarelo aparece quando qualquer um dos guards dispara — instrução clara: "Recarregue a página."'
    ]
  },
  {
    version: 'V36.7.1',
    date: '2026-06-08',
    title: 'URGENTE: novo guard que impede push de estado vazio sobrescrever dados',
    bullets: [
      'Felipe perdeu o Sansone 2x hoje (recuperou via backup). A análise mostrou que algum push automático nos primeiros segundos após o boot enviava state vazio sobre o servidor que tinha dados.',
      'O guard antigo (V32.10.4) só comparava push atual com push anterior na MESMA sessão. Na primeira sessão após boot, ainda não havia push anterior pra comparar → guard inativo.',
      'Novo guard V36.7.1 marca o state remoto carregado no boot (loadRemoteState) e impede QUALQUER push que tente enviar state vazio quando o remoto tinha dados.',
      'Mensagem visível ao bloquear: "Push bloqueado — state local vazio mas servidor tem dados. Recarregue a página."',
      'Não conserta a causa raiz (algo zera o state em memória logo após o boot), mas garante que o banco do servidor não é mais sobrescrito por isso.'
    ]
  },
  {
    version: 'V36.7.0',
    date: '2026-06-08',
    title: 'Wizard Google Ads reformado pra usuário novo + conexão pela metade',
    bullets: [
      'NOVO Step 1: checklist de pré-requisitos no topo com links pro Cloud Console e MCC, explicando que API Center só existe dentro de MCC. Botão "Já tenho tudo" dispensa pra usuários experientes.',
      'NOVO Step 1: validação inline de cada campo (Client ID precisa terminar em .apps.googleusercontent.com, Secret começa com GOCSPX-, Token tem 20-30 chars, MCC ID 10 dígitos). Botão "Salvar e avançar" só ativa quando todos válidos. Traços do MCC ID são auto-removidos ao colar.',
      'NOVO Step 3: quando lista de contas vem vazia, diagnóstico claro com 4 causas prováveis em ordem de probabilidade (Test Access, conta não é user do MCC, MCC ID errado, token revogado) + link pro API Center + botão de tentar de novo. Antes era mensagem genérica.',
      'NOVO Step 3: nomes das contas exibidos (descriptiveName) em vez de só Customer ID. Formatação XXX-XXX-XXXX nos IDs.',
      'NOVO Step 4: quando a conta tem 0 campanhas, aviso claro de "conta sem campanhas ativas" pra você saber que o Dashboard com exemplos é esperado.',
      'NOVO card Gerenciar com 2 sub-estados: (a) Conexão pela metade — quando OAuth ok mas Customer não escolhido, mostra "Conexão pela metade · Falta escolher qual conta" com badges do que está OK e botão "Selecionar conta agora" em destaque (b) Conectado completo — botão primário "Sincronizar agora" emerald + secundários compactos.',
      'Botão "Atualizar credenciais" no card Gerenciar agora se chama "Refazer credenciais" / "Trocar credenciais" dependendo do contexto. Hierarquia visual reorganizada.'
    ]
  },
  {
    version: 'V36.6.4',
    date: '2026-06-08',
    title: 'Botão "Selecionar conta" no card Gerenciar Google Ads',
    bullets: [
      'Quando o OAuth do Google Ads já está feito mas você precisa só escolher (ou trocar) qual Customer conectar, antes precisava clicar "Atualizar credenciais" e redigitar Client ID, Secret e Developer Token de novo — chato.',
      'Agora tem um botão novo "Selecionar conta" que pula direto pro Step 3 (lista de Customers acessíveis), sem refazer Step 1 e Step 2.',
      'Botão "Atualizar credenciais" continua existindo pra quando você REALMENTE precisar trocar Client ID/Secret/Token.'
    ]
  },
  {
    version: 'V36.6.3',
    date: '2026-06-08',
    title: 'Snapshot automático agora salva mesmo com banner âmbar (era o oposto)',
    bullets: [
      'Bug operacional descoberto após Felipe perder dados do Sansone hoje: durante o debug do sliding session, o banner âmbar ficou ativo por horas. Nesse tempo, o snapshot automático de 3 em 3 minutos estava PAUSADO (guard V36.1.1 que copiei do _doPush sem pensar). Quando o localStorage foi limpo, dados se perderam.',
      'Fix: guard removido do _doSnapshot. Snapshot tenta sempre — afinal, banner âmbar é EXATAMENTE quando você mais precisa preservar seu trabalho.',
      'Se o snapshot der 401 por JWT inválido, é silencioso (não dispara loop). Push continua com o guard de sessionExpired (esse faz sentido — push espera o relogin).',
      'Felipe recuperou hoje via backup manual, mas era pra ter recuperado via snapshot automático sem perder nada.'
    ]
  },
  {
    version: 'V36.6.2',
    date: '2026-06-08',
    title: 'Limpeza de console: removidos warnings de debug e ícone Facebook quebrado',
    bullets: [
      'O espião [jwt-spy] foi REMOVIDO. Ele foi essencial pra encontrar o bug raiz do sliding session (V36.5.4), mas agora só poluía o console com warnings em comportamento normal.',
      'Ícone "facebook" no header do Dashboard Meta Ads trocado por "megaphone" (o Lucide depreciou esse ícone em versões recentes). Visual fica igual.',
      'Console agora está limpo no boot.'
    ]
  },
  {
    version: 'V36.6.1',
    date: '2026-06-08',
    title: 'Health Check RD agora reflete o status real (estava sempre cinza)',
    bullets: [
      'O item "RD Station" do Health Check mostrava "não config" mesmo quando você tinha as 3 conexões verdes no modal do RD.',
      'Causa: o check estava lendo App.state.rdCredentials que não existe nessa estrutura. As credenciais reais ficam em App.state.integrations.rd.',
      'Agora o Health Check prioriza App.state.rdConnectionStatus (status testado contra a API quando você clica "Testar conexão") e usa as credenciais como fallback.',
      'Aparece tipo "PAT+CRM+Mkt" quando as 3 estão ativas.'
    ]
  },
  {
    version: 'V36.6.0',
    date: '2026-06-08',
    title: 'Token do RD Marketing renova sozinho — sem reconectar OAuth toda hora',
    bullets: [
      'O LJ já salvava o refresh_token do RD Marketing no banco mas nunca usava ele. A cada 24h o token expirava e você precisava refazer todo o fluxo OAuth.',
      'Agora: a cada chamada do proxy RD, se o token estiver a menos de 10 min de expirar, o LJ renova sozinho usando o refresh_token. Você nunca mais precisa intervir.',
      'BÔNUS: botão "Renovar agora" no card "Marketing conectado" pra emergências. Mostra status: ainda válido por X min, ou recém-renovado, ou erro.',
      'Se o refresh_token for revogado pelo RD (acontece se você desconectar manualmente lá), o erro é claro: "Reconecte o OAuth Marketing".'
    ]
  },
  {
    version: 'V36.5.5',
    date: '2026-06-08',
    title: 'Removido botão "Sair forçado" do banner (causa raiz já corrigida)',
    bullets: [
      'O botão "Sair forçado" vermelho que estava no banner âmbar foi removido. Era uma emergência pra contornar o bug de renovação invisível corrigido na V36.5.4.',
      'O banner volta ao layout original: só botão "Reentrar" azul.',
      'A função Actions.forceFullLogout continua existindo no código pra emergências futuras (pode chamar pelo console se precisar).'
    ]
  },
  {
    version: 'V36.5.4',
    date: '2026-06-08',
    title: 'Renovação invisível de passe DESATIVADA (estava causando bugs)',
    bullets: [
      'Antes: o LJ renovava seu passe automaticamente quando o servidor enviava um cabeçalho especial. Útil pra você não precisar relogar a cada 7 dias.',
      'Problema descoberto: em cenários de rotação da chave do servidor com configuração intermediária (como o caso vivido pelo Felipe hoje), essa renovação criava tokens que pareciam válidos pra alguns endpoints mas eram rejeitados por outros. Resultado: banner âmbar "Sessão Expirada" preso, 401 em loop.',
      'Decisão: desativar a renovação invisível. Seu passe agora vale pelo tempo natural (7 dias). Após isso, login normal — sem surpresas.',
      'Trade-off aceito: cliente inativo por 7+ dias precisa relogar. Em troca, eliminamos a classe de bugs que estava causando dor de cabeça.',
      'Se precisarmos voltar com renovação no futuro, o código está comentado em slidingSession.js pronto pra reativação.'
    ]
  },
  {
    version: 'V36.5.3',
    date: '2026-06-08',
    title: 'Fix loop infinito de login após "Sair forçado"',
    bullets: [
      'Bug introduzido na V36.5.2: o parâmetro ?force_logout=... ficava preso na URL. Quando você logava com sucesso, o reload pós-login disparava o sentinel de novo, limpava o JWT recém-salvo e voltava pra tela de login. Loop infinito.',
      'Agora o sentinel REMOVE o parâmetro da URL (via history.replaceState) imediatamente após processá-lo. Reloads subsequentes não acionam mais o sentinel.',
      'Login funciona normalmente. JWT novo é preservado.'
    ]
  },
  {
    version: 'V36.5.2',
    date: '2026-06-08',
    title: 'Sentinel de logout forçado IMPOSSÍVEL de bypassar + espião de JWT',
    bullets: [
      'Mesmo após clicar em "Sair forçado", o app continuava logado em alguns casos (cenário do Felipe). Causa não identificada — JWT velho reaparecia no localStorage após o reload.',
      'Defesa nova: se URL tem ?force_logout= ou ?orphan_logout=, o app limpa localStorage/sessionStorage NO PARSE do JS (antes de qualquer fetch ou init) e marca flag global pra mostrar tela de login direto. Ignora qualquer JWT que estiver lá.',
      'BONUS: espião permanente de localStorage.setItem("lj_jwt") loga stack trace no console toda vez que alguém salva o passe. Próxima vez que isso acontecer, vamos saber exatamente quem foi.',
      'Diferente dos anteriores: esse sentinel não pode ser bypassado por race condition, código antigo em cache ou outras abas. Roda como IIFE no topo do main.js.'
    ]
  },
  {
    version: 'V36.5.1',
    date: '2026-06-08',
    title: 'Logout-força-bruta + botão "Sair forçado" no banner âmbar',
    bullets: [
      'Quando o LJ detecta passe órfão no boot, agora limpa TUDO (localStorage, sessionStorage, intervals, state em memória) e força reload sem cache — não só limpa o token isolado.',
      'Novo botão "Sair forçado" no banner âmbar de Sessão Expirada. Vermelho, ao lado de "Reentrar". Limpa tudo sem pedir confirmação e te leva direto pra tela de login.',
      'Health Check Panel agora pausa quando sessionExpired=true. Reduz ruído de 401 no console quando você precisa reentrar.'
    ]
  },
  {
    version: 'V36.5.0',
    date: '2026-06-08',
    title: 'Detecção automática de "passe órfão" + Health Check Panel no menu',
    bullets: [
      'Quando o servidor rejeita seu passe (JWT) por motivo de assinatura inválida (ex: quando alguém troca a chave secreta do servidor sem manter a anterior), o LJ agora detecta automaticamente, limpa o passe quebrado e te leva direto pra tela de login.',
      'Antes ficava preso na Home com banner âmbar e 401 em loop. Acabou.',
      'A detecção roda no boot do app E quando 401s acumulam durante uso.',
      'NOVO Health Check Panel no menu lateral (abaixo do badge da versão): mostra status agregado tipo "● 6/9" no modo compacto. Clica pra expandir e ver detalhe de cada item — servidor, sessão, banco, Google Ads, GA4, Hotmart, ClickUp, RD Station, state sync.',
      'Atualiza automaticamente a cada 30 segundos. Botão de refresh manual também.'
    ]
  },
  {
    version: 'V36.4.1',
    date: '2026-06-08',
    title: 'Endpoint de diagnose pra entender quando o servidor rejeita o passe (JWT)',
    bullets: [
      'Adicionado /api/auth-debug que retorna se JWT_SECRET e JWT_SECRET_PREVIOUS estão configuradas no servidor.',
      'Se você mandar um passe (JWT) junto, o endpoint testa se ele valida com a chave atual ou com a anterior.',
      'Não expõe o valor de nenhuma chave — só metadados (tamanho, hash dos primeiros 12 chars).',
      'Usado pra diagnosticar quando um passe deveria estar válido mas o servidor rejeita.'
    ]
  },
  {
    version: 'V36.4.0',
    date: '2026-06-08',
    title: 'Tela vermelha de "Sessão Expirada" ELIMINADA — só banner discreto',
    bullets: [
      'A tela vermelha que cobria a tela inteira quando o LJ achava que sua sessão tinha expirado: ACABOU. Não aparece mais em nenhum cenário automático.',
      'No lugar: banner discreto no topo (âmbar) com aviso "Sua sessão expirou. Você pode continuar navegando, mas pra salvar alterações precisa reentrar" + botão "Reentrar".',
      'Quando você clica em "Reentrar" no banner, abre o modal violeta (não dramático) com campo de senha. Continua preservando todas as suas alterações em memória.',
      'Debounce de 401 transient (V36.3.5 incorporado aqui): banner só aparece se houver 3 erros 401 em 10 segundos. 401 isolado fica silencioso. Qualquer resposta 2xx reseta o contador (auth confirmada viva).',
      'Bug raiz no servidor (401 ocasional em POSTs com JWT válido) segue não identificado — mas o cliente agora é resiliente.'
    ]
  },
  {
    version: 'V36.3.4',
    date: '2026-06-05',
    title: 'Fix Google Ads API: bump v18 → v24 (versão atual)',
    bullets: [
      'Após autorizar Google Ads no LJ, o passo de listar suas contas batia em "Nenhuma conta encontrada" mesmo quando você tinha acesso a várias.',
      'Causa: o LJ chamava a Google Ads API v18, que o Google descontinuou. A API retornava 404 HTML e o LJ interpretava como "sem contas".',
      'Agora chamamos a v24 (versão atual em 2026). Listagem de contas e sincronização de campanhas voltam a funcionar.'
    ]
  },
  {
    version: 'V36.3.3',
    date: '2026-06-05',
    title: 'Fix OAuth callback Google Ads e GA4 batendo em banco errado',
    bullets: [
      'O callback do OAuth Google (quando você autoriza no popup) é endpoint público — Google redireciona seu navegador direto pra ele, sem token de autenticação do LJ. Por isso o sistema multi-tenant do LJ não sabia qual banco usar e caía no banco compartilhado.',
      'Pra clientes com banco próprio (Sansone) isso quebrava a conexão com erro "relation lj_google_ads_config does not exist" mesmo depois do migrate ter rodado com sucesso no banco deles.',
      'Fix: o state de segurança (CSRF) agora carrega o ID do tenant no prefixo. O callback decodifica e abre conexão no banco certo.',
      'Mesma correção aplicada ao GA4 (que tinha o mesmo bug).'
    ]
  },
  {
    version: 'V36.3.2',
    date: '2026-06-05',
    title: 'Fix migrate de schema falhando com erro IMMUTABLE',
    bullets: [
      'O botão "Rodar migrate" em Configurações → Meu Banco quebrava com erro "functions in index predicate must be marked IMMUTABLE" — ninguém conseguia aplicar as tabelas novas no banco do tenant próprio.',
      'Causa: um índice usava NOW() na cláusula WHERE — o Postgres não permite porque NOW() retorna valor diferente a cada chamada.',
      'Fix: índice agora cobre a coluna inteira (sem WHERE). Pequeno overhead, mas a tabela é pequena (sessões expiram em 30min).',
      'Quem tinha schema desatualizado (e por isso nem conseguia configurar Google Ads, GA4, etc) agora consegue rodar o migrate sem erro.'
    ]
  },
  {
    version: 'V36.3.1',
    date: '2026-06-05',
    title: 'Fix wizard Google Ads perdendo foco ao digitar credenciais',
    bullets: [
      'Os 4 campos (Client ID, Client Secret, Developer Token, MCC ID) do step 1 do wizard Google Ads perdiam foco do cursor quando algum loader em background fazia re-render da página.',
      'Causa: inputs sem id ou data-focus-key — o sistema de preservação de foco do LJ não conseguia reidentificar o campo após o re-render.',
      'Fix: cada input ganhou id próprio. Foco e posição do cursor são preservados em qualquer re-render.'
    ]
  },
  {
    version: 'V36.3.0',
    date: '2026-06-05',
    title: 'KRs com fonte Hotmart agora puxam valor real do servidor',
    bullets: [
      'KRs-mãe atômicos com fonte Hotmart (ex: "Vendas Aprovadas", "Receita", "Reembolsos") agora calculam o current ao vivo, igual já fazia com Google Ads e GA4.',
      'Fontes Hotmart suportadas: vendas aprovadas, receita aprovada, reembolsos, cancelamentos, chargebacks, boletos impressos, ticket médio, comissão.',
      'Cache fica fresh por 5 minutos. Falhas têm cooldown de 30s antes de tentar de novo (evita loop quando Hotmart está fora do ar).',
      'Reutiliza o endpoint /api/hotmart-dashboard-metrics — sem nova carga no banco.',
      'RD Station e ClickUp ainda não automatizam KRs — fonte voltará a aparecer só quando tiverem endpoint de agregação dedicado.'
    ]
  },
  {
    version: 'V36.2.0',
    date: '2026-06-05',
    title: 'Djow Conciliador IA: sugere regra de conciliação multi-source com 1 clique',
    bullets: [
      'No modal de criação de KR-mãe, quando você seleciona 2+ fontes, aparece o botão "Djow IA" no cabeçalho do bloco de Conciliação.',
      'Djow analisa as fontes e propõe a melhor regra (Verdade+Contexto, Somar, Primeira disponível, etc) com explicação humana.',
      'Heurística primeiro (instantânea, sem custo): 1 fonte = primária; 2 fontes do mesmo conceito = verdade+fallback; 2 fontes complementares = somar.',
      'Quando ambíguo (3+ fontes ou caso novo), Djow puxa a IA pra refinar com contexto de RevOps.',
      'A explicação aparece dentro do bloco com aspas — você confere se faz sentido antes de confirmar.'
    ]
  },
  {
    version: 'V36.1.3',
    date: '2026-06-04',
    title: 'Reentrar na conta agora salva imediato (era no-op silencioso)',
    bullets: [
      'Depois do "REENTRAR E SALVAR", o LJ tentava enviar suas alterações pro servidor mas o salvamento estava sendo bloqueado pela própria proteção contra loop de erro 401 introduzida na V36.1.1.',
      'Resultado: o trabalho ficava em memória por até 2 segundos a mais até o próximo salvamento normal. Se algo desse errado nesse intervalo, perdia.',
      'Agora o LJ limpa o estado de "sessão expirada" ANTES de tentar salvar, garantindo que o push imediato realmente vá pro servidor.',
      'Defesa extra: o flushNow agora passa "force" pro _doPush, então mesmo se algum código futuro chamar fora de ordem, o salvamento ainda funciona.'
    ]
  },
  {
    version: 'V36.1.2',
    date: '2026-06-04',
    title: 'Rotação da Home não vai mais bater no servidor a cada 7 segundos',
    bullets: [
      'A Home rotaciona o produto que está pulsando a cada 7 segundos e a página de KRs a cada 10 segundos. Mas a cada rotação o LJ disparava um salvamento completo no servidor, gerando 8-10 chamadas por minuto sem necessidade.',
      'Quando o servidor degradava transient (qualquer instabilidade momentânea), uma dessas chamadas falhava e abria o modal "Sessão Expirada" mesmo com sua sessão válida.',
      'Agora a rotação salva apenas localmente (localStorage). F5 mantém o produto que estava pulsando, mas o servidor não é incomodado.',
      'Mudanças reais de dado (criar campanha, salvar KR, etc) continuam sincronizando normalmente.'
    ]
  },
  {
    version: 'V36.1.1',
    date: '2026-06-04',
    title: 'Modal de sessão expirada não acumula mais 30+ erros 401 no console',
    bullets: [
      'Quando o modal "Sessão Expirada" aparecia, o LJ continuava tentando salvar/sincronizar/atualizar contadores em loop — 30+ erros 401 entupiam o console em segundos.',
      'Agora todos os loaders e timers (sync remoto, snapshot 3min, conciliação RD, webhooks RD, status das integrações) pausam automaticamente enquanto o modal está aberto.',
      'Quando você reentra, tudo volta a funcionar normalmente. Sem retrabalho, sem perda de dados.'
    ]
  },
  {
    version: 'V36.1.0',
    date: '2026-06-04',
    title: 'Termos de Uso da IA — plugar chave própria exige aceite',
    bullets: [
      'Quem usa Djow via saldo liberado pelo admin (caso do Sansone hoje) NÃO precisa fazer nada — está coberto pelos termos que o admin já aceitou.',
      'Quem plugar a própria chave Anthropic no LJ agora precisa ler e aceitar os Termos de Uso da IA antes de salvar a chave.',
      'Os termos cobrem: o que o LJ envia ao modelo, retenção da Anthropic, responsabilidades LGPD, limites de garantia e como revogar.',
      'Quem já tinha chave plugada antes desta versão continua usando normalmente (compatibilidade retroativa). O aceite só é exigido pra nova chave ou troca.'
    ]
  },
  {
    version: 'V36.0',
    date: '2026-06-04',
    title: 'Djow Conciliador — KRs ao vivo com múltiplas fontes',
    bullets: [
      'KRs agora aceitam múltiplas fontes ao mesmo tempo (Hotmart + Google Ads + GA4, etc) — antes era 1 só por KR.',
      'Quando você seleciona mais de uma fonte, o Djow propõe automaticamente uma regra de conciliação: qual é a verdade, qual é fallback, qual é só contexto.',
      'Heurísticas iniciais: se há Hotmart em métrica de venda, ele vira a verdade automaticamente. Se há Google Ads + GA4, Google Ads vira a verdade (mesma regra do RevOps).',
      '6 modos disponíveis: "Verdade + contexto" (recomendado), Somar, Primeira disponível, Média, Maior, Menor. Você pode trocar o modo e ajustar papéis a qualquer momento.',
      'KRs antigos continuam funcionando exatamente como antes (backward compat: sem regra = soma tudo, igual sempre foi).'
    ]
  },
  {
    version: 'V35.14.7',
    date: '2026-06-04',
    title: 'Botão "Rodar migrate" em Meu Banco — aplica schema novo sem psql',
    bullets: [
      'Configurações → Meu Banco ganhou um card "Atualizar schema do banco" com botão que aplica o schema mais recente do LJ no seu banco.',
      'É idempotente: roda quantas vezes quiser sem destruir dados. Cria tabelas e índices novos (ex: GA4 da V35.14) se ainda não existirem.',
      'Toda vez que o LJ ganha tabelas novas em uma atualização, basta rodar o migrate em vez de pedir pra alguém mexer no psql.',
      'Se algo der errado, o botão mostra exatamente onde quebrou no SQL (com ~80 caracteres de contexto).'
    ]
  },
  {
    version: 'V35.14.6',
    date: '2026-06-03',
    title: 'GA4 — Auto-item RevOps + KR ao vivo + Djow (Onda 3e)',
    bullets: [
      'GA4 entra como auto-item "[LJ]GA4 Tráfego pago" em RevOps Aquisição S&M — mas só se Google Ads NÃO estiver conectado direto. Sem duplicação.',
      'KRs ao vivo agora reconhecem GA4 como fonte: criar KR "Sessões em junho" puxa direto de GA4 sem você precisar atualizar manualmente.',
      'Djow ganhou 3 famílias novas de fontes via GA4: tráfego (sessions/users/newUsers), conversões e receita (purchaseRevenue/totalRevenue). Quando você cria um KR pelo Djow e ele reconhece o tema, propõe automaticamente.',
      'ROAS pode vir do Google Ads OU do GA4 (returnOnAdSpend direto ou via insumos purchaseRevenue + googleAdsCost).',
      'Quando GA4 sincroniza, RevOps Aquisição recalcula automaticamente — incluindo a regra "Google Ads prevalece".'
    ]
  },
  {
    version: 'V35.14.5',
    date: '2026-06-03',
    title: 'GA4 — Sininho + modal de conciliação Google Ads (Onda 3d)',
    bullets: [
      'O sininho agora soma alertas próprios do GA4: sync falhou (token expirado / cota da API), customs novos detectados, ou sync atrasado mais de 48h.',
      'Se você criar uma métrica/dimensão custom no GA4 depois de já ter conectado, o LJ avisa pra você configurar — não precisa lembrar de checar.',
      'Quando você conclui a configuração do GA4 com Google Ads já conectado, abre automaticamente um modal explicando como os dois convivem sem duplicar custo no RevOps.',
      'O modal oferece 3 caminhos: manter ambos (regra automática), desconectar Google Ads (GA4 vira fonte única) ou desconectar GA4 (volta ao estado anterior).'
    ]
  },
  {
    version: 'V35.14.4',
    date: '2026-06-03',
    title: 'GA4 — Dashboard com 3 abas (Onda 3c)',
    bullets: [
      'Tab "GA4" entrou no Dashboard ao lado de Google Ads, com 3 sub-abas: Visão Geral, Detalhes e Customs.',
      'Visão Geral mostra KPIs do período (sessions, users, conversions, pageviews, receita) e tráfego por canal.',
      'Detalhes traz a tabela completa quebrada por todas as dimensões sincronizadas — fácil de exportar via copiar/colar.',
      'Customs lista as métricas/dimensões customizadas com o nome amigável que você deu no wizard.',
      'Botão "Sincronizar agora" no header dispara sync manual e recarrega o painel.'
    ]
  },
  {
    version: 'V35.14.3',
    date: '2026-06-03',
    title: 'GA4 — Sub-wizard de customs (Onda 3b)',
    bullets: [
      'Depois que você termina o wizard de GA4, se o LJ detectar métricas/dimensões customizadas que você criou no GA4 dele, abre um sub-wizard pra configurar cada uma.',
      'Pra cada custom: você dá um nome amigável (que aparece nos dashboards no lugar do nome técnico), categoria opcional, e decide se entra no sync.',
      'Métricas customizadas podem ser marcadas como "disponível como KR ao vivo" — assim o Djow sugere elas quando você criar um KR novo.',
      'Se a propriedade não tem nenhum custom, o sub-wizard é pulado automaticamente.'
    ]
  },
  {
    version: 'V35.14.2',
    date: '2026-06-03',
    title: 'GA4 — Card ativo + Wizard (Onda 3a)',
    bullets: [
      'O card "Google Analytics 4" em Integrações → Injetar saiu de "Em breve" e está ativo.',
      'Wizard de 4 passos: você escolhe o perfil de negócio, cola credenciais do Cloud Console, autoriza no Google e seleciona a property.',
      'Defaults inteligentes: cada perfil (lead gen, e-commerce, conteúdo, institucional, custom) ativa automaticamente os packs de métricas que fazem sentido.',
      'Frequência de sync (1×/dia, 2×/dia ou manual) escolhida no wizard, com botão "Atualizar agora" sempre disponível em "Gerenciar".',
      'Sub-wizard de customs, dashboard 3 abas, sininho próprio e conciliação Google Ads ↔ GA4 vêm nas próximas sub-ondas.'
    ]
  },
  {
    version: 'V35.14.1',
    date: '2026-06-03',
    title: 'GA4 — sync, descoberta de customs e leitura (Onda 2)',
    bullets: [
      'Backend GA4 está completo: dá pra listar propriedades da conta, descobrir métricas/dimensões customizadas, puxar dados pra dentro do LJ e ler depois.',
      'Os 9 packs estão definidos como contrato declarativo — o LJ sabe quais métricas pedir pra cada perfil de negócio (e-commerce, lead gen, conteúdo, etc).',
      'Sync respeita o limite de 9 dimensões + 10 métricas por chamada da API: quando o cliente ativa muitos packs, o LJ quebra em várias chamadas e junta no banco.',
      'Backend pronto pra wizard, dashboard e dashboards (V35.14.2).'
    ]
  },
  {
    version: 'V35.14.0',
    date: '2026-06-03',
    title: 'Google Analytics 4 — fundação OAuth + schema (Onda 1)',
    bullets: [
      'Começou a integração com GA4: agora o LJ tem a base técnica pra conectar a propriedade GA4 do cliente via OAuth Google.',
      'Esta onda entrega só a fundação invisível (banco de dados e endpoints OAuth). O wizard, dashboard e dashboards GA4 vêm nas próximas ondas (V35.14.1+).',
      'Schema flexível: o LJ aceita qualquer combinação de métricas e dimensões que o cliente escolher (incluindo customs que ele criou no GA4), sem mexer no banco depois.',
      'Modelo: cliente cadastra próprio Cloud Project + OAuth Client ID/Secret (paridade com Google Ads). LJ guarda refresh_token criptografado.'
    ]
  },
  {
    version: 'V35.13.6',
    date: '2026-06-03',
    title: 'Auto-clear de "Sessão Expirada" quando auth volta a funcionar',
    bullets: [
      'Em races transientes do boot (pool tenant ainda inicializando), um 401 isolado disparava o modal "Sessão Expirada" mesmo com o JWT válido.',
      'Antes o modal só sumia se você reentrasse manualmente — mesmo que a próxima request já voltasse 200.',
      'Agora qualquer response 2xx com Auth Bearer confirma "sessão viva" e limpa a flag silenciosamente. Modal/banner some sozinho.'
    ]
  },
  {
    version: 'V35.13.5',
    date: '2026-06-03',
    title: 'Silenciado warning falso-positivo de campos lost no boot',
    bullets: [
      'Warning [State.load] Campos NÃO mapeados em normalize() vinha aparecendo no console em todo boot, listando campos de cache interno (_rdWebhookSummaryLoadedAt, _krSnapshotsProcessedAt).',
      'Esses campos começam com prefix "_" — convenção que indica runtime/cache que não precisa persistir. Eram falso-positivo do audit.',
      'Agora o audit ignora prefix "_" automaticamente. Nenhum impacto funcional — só limpa o console.'
    ]
  },
  {
    version: 'V35.13.4',
    date: '2026-06-03',
    title: 'Fix card EXECUÇÕES da Home sempre mostrando 0',
    bullets: [
      'Bug pré-existente: o card EXECUÇÕES do Pulso da Receita e o card Execuções na Home contavam 0 mesmo quando existiam tasks no gestor de projeto.',
      'Causa: a Home chamava ExecutionTaskStore.list() (método que não existe) e filtrava por t.actionId (campo errado).',
      'Fix: agora usa .all() e filtra por linked_action_id, igual ao resto do app.'
    ]
  },
  {
    version: 'V35.13.3.1',
    date: '2026-06-03',
    title: 'Fix detecção de ação órfã (V35.13.3 não acionava o resolver)',
    bullets: [
      'V35.13.3 não estava marcando a ação como órfã porque o KR-filho na branch ainda existia (segurando o connectedActionIds) mesmo depois do KR-mãe ser deletado.',
      'Agora a detecção checa o KR-mãe resolvido em productKrs — se ele não existe mais, a ação vira cinza apagado com o botão Resolver.',
      'Reconectar a ação também limpa o vínculo com o KR-filho órfão antigo, evitando que ela continue parecendo órfã depois de reconectada.'
    ]
  },
  {
    version: 'V35.13.3',
    date: '2026-06-03',
    title: 'Ações órfãs no editor de campanha agora pedem decisão',
    bullets: [
      'Quando você deleta um número da campanha, as ações que dependiam dele ficavam fantasma no editor. Agora elas viram cinza apagado com um botão "Resolver".',
      'Clicar em Resolver abre 2 caminhos: deletar a ação inteira (incluindo as tasks no ClickUp) ou conectar a ação a outro número ativo da mesma frente.',
      'A opção de conectar lista os números ativos do produto na frente daquela ação (Marketing, Vendas ou CS), pra você não ter que recriar a ação do zero.',
      'Deletar dispara o cascade real: ação some, tasks somem, mapping ClickUp some. Sem fantasma.'
    ]
  },
  {
    version: 'V35.13.2',
    date: '2026-06-03',
    title: 'Card Breakeven em valores flat — Precisa × Tem (sem porcentagem)',
    bullets: [
      'O card de Breakeven trocou porcentagem por número absoluto de vendas: "Precisa 171 × Tem 0".',
      'Verde quando "Tem" alcança ou ultrapassa "Precisa". Vermelho quando ainda falta.',
      'Subtitle continua mostrando "equilíbrio em N vendas" pra contexto.'
    ]
  },
  {
    version: 'V35.13.1',
    date: '2026-06-03',
    title: 'Cards RevOps da Home agora mostram Previsto × Atual lado a lado',
    bullets: [
      'Os 4 cards (CAC, Vendas, TM, % Breakeven) ganham par Previsto × Atual igual ao "Previsto × Realizado" antigo.',
      'CAC usa a mesma fórmula da cascata "Equilíbrio da Operação" do painel (CTC ÷ Total de Vendas) — previsto divide por vendas projetadas, atual divide por vendas reais.',
      'Quando ainda não tem vendas reais cadastradas, o "Atual" mostra "—" (não inventa valor).',
      'Breakeven mostra % previsto e % atual lado a lado em cores (verde ≥100%, vermelho <100%).'
    ]
  },
  {
    version: 'V35.13.0',
    date: '2026-06-03',
    title: 'Cards de CAC / Previsto×Realizado / TM / Breakeven puxam da governança',
    bullets: [
      'Os 4 painéis da Home (CAC, Previsto×Realizado, Ticket Médio, % para Breakeven) agora leem direto do painel novo da Governança (RevOps Whitelabel V2), onde você de fato configura os grupos de custos e ofertas.',
      'CAC sai do total dos grupos com bucket=Aquisição (incluindo o "[LJ]Google ads" automático) dividido pelas vendas reais do produto.',
      'Ticket médio respeita o modo escolhido (manual ou ponderado por mix de ofertas).',
      'Breakeven recalcula com fixos / margem de contribuição unitária do V2.',
      'Se o V2 ainda não está configurado, continua caindo na versão antiga (V1) — nenhum cliente atual quebra.'
    ]
  },
  {
    version: 'V35.12.0',
    date: '2026-06-03',
    title: 'KRs ganham barra de status vs meta e seta de tendência',
    bullets: [
      'Cada KR-mãe agora mostra uma barra de progresso linear indo de 0% até 120% da meta segura, com marcador da linha 100%.',
      'Cores: vermelho abaixo de 70%, âmbar em curso (70-99%), verde meta segura batida (100-119%), dourado quando ultrapassa a meta avançada (120%+).',
      'Seta de tendência ▲▼ ao lado do valor "Hoje" mostra delta vs último dia que você abriu o app — verde se está crescendo, vermelho se está caindo.',
      'Para KRs onde menos é melhor (CAC, churn, custo), as cores e setas se invertem automaticamente respeitando a direção que o Djow inferiu.',
      'Snapshot diário acontece sozinho na primeira leitura do dia — sem cron, sem configuração.',
      'Vale tanto pros cards do Mapa da Receita quanto pros KPIs da Home.'
    ]
  },
  {
    version: 'V35.11.4',
    date: '2026-06-03',
    title: 'Hotfix KR ao vivo + workflows prontos pra ativar quando você quiser',
    bullets: [
      'KR criado quando o backend do Djow estava fora agora puxa do Google Ads sozinho — antes ficava zerado porque faltava integration_id no payload.',
      'Engine de KR ao vivo virou self-healing: deriva a fonte (Google Ads / RD / Hotmart) pelo id do source quando os campos vêm em branco.',
      'KRs existentes com esse problema (ex: "Alcanse" que você criou hoje) voltam a funcionar sem precisar deletar e refazer.',
      'Endpoints de webhook RD e Djow KR agora avisam direito quando a tabela ainda não existe no tenant — antes davam 500 silencioso.',
      'Workflows de cron diário do GitHub Actions plantados no repo (cron-daily-tick + cron-time-triggers). Schedule comentado até você configurar 2 secrets (CRON_BASE_URL + CRON_RECONCILE_TOKEN) e descomentar — assim não dispara emails de falha enquanto não tá pronto.'
    ]
  },
  {
    version: 'V35.11.2',
    date: '2026-06-03',
    title: 'Cron RD pull desativado — webhook é o único caminho',
    bullets: [
      'Os crons antigos de pull bidirecional RD (cron-rd-pull e cron-rd-sync) foram desativados. Agora 100% das atualizações do RD chegam ao LJ via webhook.',
      'Os endpoints continuam vivos respondendo "200 OK · desativado" — se você tem cron-job.org ou Railway cron apontando pra eles, continuam batendo sem custo (nem API RD, nem banco). Desligue por lá quando puder.',
      'O cron diário de manutenção (decay de score + purge do log de webhooks) continua rodando normalmente.',
      'Trade-off consciente: se o RD não conseguir entregar o webhook (incidente lá), aquele update se perde — sem rede de segurança automática.'
    ]
  },
  {
    version: 'V35.11.1',
    date: '2026-06-03',
    title: 'Hotfix V35.11 — classificação correta de erros + purge automático do log',
    bullets: [
      'Erros como "Payload sem contact_id" agora aparecem como "validação" no breakdown do sininho (antes caíam em "desconhecido").',
      'Cron diário agora purga registros do log de webhooks RD com mais de 7 dias — tabela não cresce mais indefinidamente.',
      'Limpeza interna: removido handler de erro morto (sem mudança de comportamento).'
    ]
  },
  {
    version: 'V35.11.0',
    date: '2026-06-03',
    title: 'Webhook RD ao vivo — atualizações de contato chegam direto, log de tudo',
    bullets: [
      'O RD agora atualiza o LJ em tempo real: quando você cria, edita ou apaga um contato no CRM, o LJ recebe na hora (não precisa esperar o sync diário).',
      'Sininho aprende a contar: 1 a 9 falhas → alerta amarelo (atenção), 10+ → vermelho (crítico). Quantas falhas vier, é UMA notificação só, com o número agregado.',
      'A notificação acumula até você clicar "Marcar como visto". Depois disso, próxima falha cria notificação nova imediatamente.',
      'Click no alerta abre o log completo já marcando as falhas como vistas.',
      'Novo card "Log de Erros" em Configurações > Meu Banco: tabela com filtros (período, status, tipo, busca livre), paginação e download CSV.',
      'Histórico mantido por 7 dias. Cada linha mostra quando chegou, status (OK/Erro), tipo do evento, contato e detalhe/erro.'
    ]
  },
  {
    version: 'V35.10.0',
    date: '2026-06-03',
    title: 'KRs ao vivo — o "Hoje" puxa direto da fonte que o Djow escolheu',
    bullets: [
      'KRs criados com o Djow agora mostram o valor real "Hoje X" puxando da fonte (Google Ads, RD, Hotmart) — não fica mais zerado.',
      'Pill verde "● ao vivo" ao lado do nome quando o número está vindo de fonte real.',
      'Pill violet "fórmula" pra KRs derivados (LTV, CAC, ROAS) calculados em tempo real a partir dos insumos.',
      'Escopo de agregação cravado: KR de Marketing soma só de Campanhas LJ marcadas como Marketing daquele produto. Idem Vendas e CS.',
      'KR manual (sem Djow) continua mostrando o valor que você digitou — sem alteração.',
      'Visível tanto na Home (cards de KPI) quanto no Mapa da Receita (cards de KR).'
    ]
  },
  {
    version: 'V35.9.3',
    date: '2026-06-03',
    title: 'Sininho com 2 abas (Atualizações + Alertas) e Djow responde no Enter',
    bullets: [
      'Click no sininho agora abre o modal de Notificações com 2 abas — não vai mais direto pra reconciliação ou Ads.',
      'Aba "Atualizações" mostra releases novas e relatórios de importação de leads.',
      'Aba "Alertas" lista pontos de atenção (Ads sem vínculo, conciliação RD pendente, etc) com botão pra resolver cada um.',
      'Se há alerta no ar, o modal abre direto na aba Alertas pra você ver primeiro.',
      'No modal de criar KR-mãe, agora basta apertar Enter pra o Djow analisar o nome (antes precisava clicar fora do input).'
    ]
  },
  {
    version: 'V35.9.2',
    date: '2026-06-03',
    title: 'Cards de KPI da Home agora mostram os KRs reais do produto',
    bullets: [
      'Os 4 cards de KPI da Home (que ficavam zerados desde V25.0.0) agora seguem o produto pulsando no Pulso da Receita.',
      'Cada card corresponde a uma área: Marketing, Vendas, CS e Receita.',
      'Card mostra até 3 KRs daquela área, com nome, valor atual e meta segura.',
      'Quando a área tem mais de 3 KRs, a página inteira gira (1-3 → 4-6 → 1-3) a cada 10s.',
      'Quando o Pulso troca de produto, as páginas resetam pra o início.',
      'Card de Receita ainda em definição — placeholder por enquanto.'
    ]
  },
  {
    version: 'V35.9.1',
    date: '2026-06-03',
    title: 'Hotfix V35.9.0 — roll-up Google Ads aparece no painel novo do RevOps',
    bullets: [
      'V35.9.0 mexia no painel antigo de Aquisição (modal R$ direto). O painel novo (whitelabel V2 com grupos, fórmulas e dre extras) não recebia o roll-up.',
      'Engine de recalc portado pro RevopsWhitelabelEngine — agora o "[LJ]Google ads" aparece dentro do grupo Aquisição S&M do produto.',
      'Item travado com fundo amber, cadeado, pill "Auto · LJ" e nota explicativa "Pra alterar, vá em Dashboard → Google Ads".',
      'Mexer no item (renomear, deletar, mudar modo de cálculo) bloqueado com toast.',
      'Quando você desvincula todas as ads do produto, o item some sozinho.'
    ]
  },
  {
    version: 'V35.9.0',
    date: '2026-06-03',
    title: 'Custo de Google Ads vai direto pro RevOps Aquisição S&M (automático)',
    bullets: [
      'Quando você vincula campanhas Google Ads a uma Campanha LJ, o LJ cria automaticamente o item "[LJ]Google ads" no RevOps > Aquisição S&M do produto correspondente.',
      'O valor é a soma do gasto 30d de todas as campanhas Ads vinculadas a Campanhas LJ daquele produto.',
      'Item travado: vem com ícone de cadeado, sem edição manual de nome ou valor. Pra ajustar, você desvincula ou vincula mais ads no Dashboard.',
      'Quando você desvincula todas as ads de um produto, o item some sozinho.',
      'Convenção universal: todo item auto-gerado pelo LJ no RevOps começa com prefixo "[LJ]" pra distinguir dos manuais.'
    ]
  },
  {
    version: 'V35.8.0-alpha5',
    date: '2026-06-03',
    title: 'Quadro de KRs do Mapa mostra qual produto está pulsando',
    bullets: [
      'Banner novo no topo da etapa "Quais são os números deste produto?" deixa explícito qual produto você está editando.',
      'Mostra o vínculo com o Pulso da Receita da Home — quando rolar a rotação automática, o quadro vai acompanhar.',
      'Contagem de produtos pulsando aparece quando há mais de um cadastrado.',
      'Valor atual de cada KR já vem da fonte salva (vinha como "0" antes só porque o atual não tinha sido preenchido).',
      'Onda V35.8.0 completa — criação de KR com Djow inferindo está pronta de ponta a ponta.'
    ]
  },
  {
    version: 'V35.8.0-alpha4',
    date: '2026-06-03',
    title: 'Djow agora reconhece qualquer nome de KR (não só os 5 do mock)',
    bullets: [
      'Modal de criar KR-mãe agora conversa de verdade com o backend do Djow.',
      'Heurística do servidor cobre 28 naturezas + 8 fórmulas — bate primeiro sem chamar IA.',
      'Quando o nome é criativo demais (ex: "Magnetismo da marca"), o Djow consulta a IA pra desambiguar.',
      'Spinner "analisando..." aparece enquanto o Djow pensa (2-5 segundos).',
      'Se o backend cair, modal continua funcionando com o mock local — sem travar a criação.',
      'Próxima alpha: mostrar o "Hoje X" real no quadro de KRs do Mapa.'
    ]
  },
  {
    version: 'V35.8.0-alpha3',
    date: '2026-06-03',
    title: 'Modal de criar KR-mãe ganha cara nova com Djow no comando',
    bullets: [
      'Modal redesenhado em 3 zonas claras: nome, fala do Djow, opções de fonte.',
      'Djow comenta cada decisão no monólogo cumulativo — após 5 mensagens aparece "ver histórico" pra desbravar.',
      'Layer de opções fica embaixo da fala do Djow: ele lista as fontes reais e você marca uma ou várias.',
      'Campos atual / meta segura / meta avançada ficam bloqueados até você confirmar a fonte — sem mais comprometer meta sem saber de onde vem o número.',
      'Testes rápidos pra ver a UX: digite "MQL", "ROAS", "LTV" ou "NPS" e veja o Djow responder diferente pra cada um.',
      'Próxima alpha: substituir o mock pelo backend de verdade.'
    ]
  },
  {
    version: 'V35.8.0-alpha2',
    date: '2026-06-03',
    title: 'Djow já consegue classificar e propor fontes pra novo KR (backend pronto)',
    bullets: [
      'Endpoint pronto pra receber um nome de KR e devolver classificação automática (atômico, derivado ou manual).',
      'Heurística determinística primeiro: 28 naturezas + 8 fórmulas no catálogo respondem direto sem chamar IA.',
      'Quando o nome é criativo e a heurística não bate, o Djow consulta a IA pra desambiguar — barato e rápido.',
      'Cada sessão tem 5 etapas (start → nome → fonte → números → confirmar) e o estado fica salvo no banco por 30 minutos.',
      'Validações de coerência (meta segura no nível do atual, meta avançada menor que segura, etc) são código puro — sem alucinação.',
      'Próxima alpha: refactor visual do modal pra mostrar tudo isso ao vivo.'
    ]
  },
  {
    version: 'V35.8.0-alpha1',
    date: '2026-06-03',
    title: 'Base do Djow pra entender o que cada KR é (sem mudança visível ainda)',
    bullets: [
      'Foundation invisível pro usuário: o LJ ganhou catálogos internos que vão alimentar a próxima geração da criação de KR.',
      'Catálogo de naturezas atômicas: 20+ "coisas que se medem" reconhecidas (Alcance, MQL, Conversões, Receita, NPS, CSAT, Win Rate, etc) com mapeamento pra fontes integradas.',
      'Catálogo de fórmulas derivadas: 8 fórmulas clássicas (LTV, CAC blended, ROAS, MRR, ARR, Payback, LTV/CAC, Margem de Contribuição) com seus insumos.',
      'Detector de integrações ativas por tenant: o Djow vai saber exatamente o que cada cliente tem conectado antes de propor qualquer KR.',
      'Próxima alpha: endpoint de inferência do Djow usando essa base.'
    ]
  },
  {
    version: 'V35.7.2',
    date: '2026-06-02',
    title: 'Visão Geral Google Ads: filtros por Produto/Campanha LJ + KPIs explicáveis',
    bullets: [
      'Filtro multi-select de Produto no topo da Visão Geral — escolha quais produtos entram no consolidado.',
      'Filtro multi-select de Campanha LJ — selecione 1 ou várias campanhas pra analisar em conjunto.',
      'Combinação livre: ver consolidado das ads do Produto X + Y, filtrando por Campanha Z.',
      'Botão "Limpar" volta ao consolidado total. Toggle "Incluir não associadas" continua, fica desabilitado quando há filtro ativo (não faz sentido somar órfãs num recorte restritivo).',
      'Botão "?" no canto superior direito de cada card de KPI abre modal explicando o que é, qual a fórmula e como interpretar.',
      'Dicionário cobre os 12 indicadores do Visão Geral + 8 do Grupo 3 avançado.'
    ]
  },
  {
    version: 'V35.7.1',
    date: '2026-06-02',
    title: 'Dashboard Google Ads ganha "Visão Geral" + cards expansíveis + Avançados',
    bullets: [
      'Nova sub-aba "Visão Geral" no Dashboard > Google Ads — consolidado dos 25 indicadores das ads vinculadas.',
      'Chave seletora "Incluir não associadas" pra ver o panorama completo do tenant quando quiser.',
      'Sub-aba "Visão geral" antiga renomeada pra "Associadas" — mantém o consolidado por Campanha LJ.',
      'Cada ads vinculada agora vira card expansível: clica e mostra impressões, cliques, CPC médio, CPM, receita atribuída.',
      'Botão "Avançados (25 indicadores)" abre modal com a query completa GAQL — id, name, budget, custo, volume, conversão, ROAS, search impression share, view-through, etc.',
      'Bloco "Indicadores avançados" expansível na Visão Geral pro Grupo 3 (all_conversions, impression share, view-through).',
      'Hero do card agora tem texto branco sobre fundo pink saturado — corrige contraste ilegível no app dark.'
    ]
  },
  {
    version: 'V35.7.0-alpha4',
    date: '2026-06-02',
    title: 'Sync real Google Ads — dados de exemplo são substituídos pelos reais',
    bullets: [
      'Quem conectou Google Ads vê um botão "Sincronizar agora" no Dashboard — roda a query oficial GAQL e traz dados reais dos últimos 30 dias.',
      'Os dados ficam salvos no seu banco (criptografados, isolados por tenant) e agregados por campanha automaticamente.',
      'Quando há dados reais, o badge "Dados de exemplo" some — você passa a ver gasto, ROAS, CPL e conversões da sua conta de verdade.',
      'Conta nova ainda sem sync ou sem campanhas no período: você continua vendo dados de exemplo até a primeira sincronização rolar.',
      'Próxima evolução: cron diário automático (em vez de precisar clicar em "Sincronizar agora").'
    ]
  },
  {
    version: 'V35.7.0-alpha3',
    date: '2026-06-02',
    title: 'Sininho avisa quando tem campanha Ads sem vínculo (com cooldown inteligente)',
    bullets: [
      'O sininho da Home agora sinaliza campanhas Google Ads ainda não vinculadas a nenhuma Campanha LJ.',
      'Click no sininho leva direto pra sub-aba "Não associadas" do Dashboard Google Ads.',
      'Cooldown de 10 minutos: clicou e dispensou, bolinha some por 10min mesmo se ainda tem pendência.',
      'Bypass automático: se chegar uma campanha Ads nova durante o cooldown, bolinha volta imediatamente.',
      'Quando a campanha é associada de verdade, notificação some permanentemente.'
    ]
  },
  {
    version: 'V35.7.0-alpha2',
    date: '2026-06-02',
    title: 'Wizard guiado de associação Ads → Campanha LJ',
    bullets: [
      'Clique em "Associar" agora abre wizard guiado em 4 passos (estilo importação de CSV).',
      'Step 1: marque as campanhas Google Ads pra vincular juntas (multi-seleção).',
      'Step 2: escolha uma Campanha LJ existente OU crie uma nova ali mesmo (atalho inline).',
      'Step 3: preview consolidado — gasto, ROAS, CPL e conversões agregados antes de confirmar.',
      'Step 4: sucesso. Métricas passam a aparecer agregadas na sub-aba "Visão geral".'
    ]
  },
  {
    version: 'V35.7.0-alpha1',
    date: '2026-06-02',
    title: 'Dashboard Google Ads ganha dados (de exemplo) + sub-aba "Não associadas"',
    bullets: [
      'Dashboard > Google Ads agora mostra 4 campanhas Ads de exemplo (Black Friday Search, YouTube, Display e Performance Max) com gasto, ROAS, CPL e conversões.',
      'Nova sub-aba "Não associadas" lista campanhas Ads ainda sem vínculo com Campanha LJ — cada uma com botão "Associar".',
      'Vinculação N:1 — uma Campanha LJ pode receber várias campanhas Ads (ex: 3 BF Ads → 1 BF LJ consolidada).',
      'Métricas se consolidam automaticamente por Campanha LJ na sub-aba "Visão geral" — gasto + ROAS + CPL + CTR agregados.',
      'Dados de exemplo: ficam até o sync real (em release futura) trazer dados verdadeiros — aí são sobrescritos automaticamente.',
      'Wizard guiado de associação (4 steps espelho do CSV) chega na próxima alpha — por agora, atalho simples via prompt.'
    ]
  },
  {
    version: 'V35.6.6',
    date: '2026-06-02',
    title: 'Google Analytics 4 entra como card "Em breve" em Integrações > Injetar',
    bullets: [
      'Novo card Google Analytics 4 ao lado de Meta Ads e Stripe em Integrações > Injetar.',
      'Clica no (?) e abre o deep-dive com a lista oficial de dimensões e métricas que vão ser puxadas (sessions, users, conversões, totalRevenue, canal, source, campanha).',
      'Cruzamento previsto com Google Ads pelo campaign name — fecha o funil aquisição → sessão → conversão.',
      'Ainda em planejamento — integração técnica vem em release futura.'
    ]
  },
  {
    version: 'V35.6.5',
    date: '2026-06-02',
    title: 'Sessão dura 7 dias agora — fica logado mesmo deixando a aba parada por dias',
    bullets: [
      'TTL da sessão subiu de 24h para 7 dias. Você fica até uma semana sem mexer e volta sem precisar reentrar.',
      'Enquanto você usa o app, a sessão se renova sozinha em background — sem interrupções.',
      'Padrão usado por HubSpot, Linear, Asana. Segurança preservada pela rotação automática de JWT secret (V35.4.0).'
    ]
  },
  {
    version: 'V35.6.4',
    date: '2026-06-02',
    title: 'Modal de relogin pelo banner agora é tranquilo, não mais vermelho dramático',
    bullets: [
      'Quando você clica no banner âmbar pra reentrar, abre modal violet/neutro — não mais o vermelho de "alerta urgente".',
      'O modal vermelho continua aparecendo só quando você tenta salvar algo com sessão expirada (cenário de perda de trabalho).',
      'Texto e botões adaptam ao contexto: "Entrar" (tranquilo) vs "Reentrar e Salvar" (urgente).'
    ]
  },
  {
    version: 'V35.6.3',
    date: '2026-06-02',
    title: 'Modal vermelho de sessão expirada não aparece mais sem o usuário ter clicado em nada',
    bullets: [
      'Sincronização automática em background não interrompe mais com modal bloqueante — agora mostra apenas o banner âmbar discreto.',
      'O modal completo de relogin continua aparecendo quando você tenta criar, editar ou salvar algo com a sessão expirada (pra não perder seu trabalho).',
      'Promessa V35.4.3 cumprida — moderno como HubSpot, Linear, Asana.'
    ]
  },
  {
    version: 'V35.6.2',
    date: '2026-06-02',
    title: 'Hotfix Integrações IPI — sem duplicação de header e toast acima dos modais',
    bullets: [
      'Card de status RD e ClickUp não aparece mais duplicado dentro do modal.',
      'Botão "Testar conexão" no modal RD agora funciona (chamava ação errada antes).',
      'Toasts (incluindo retorno do teste de conexão) aparecem na frente dos modais — não mais escondidos atrás.',
      'Botão "Desconectar" do ClickUp continua acessível como ação secundária no status card.'
    ]
  },
  {
    version: 'V35.6.1',
    date: '2026-06-02',
    title: 'Integrações IPI completa — config completa de RD e ClickUp dentro dos modais',
    bullets: [
      'Toda a configuração de RD Station (Token, Tempo Real, Marketing) e ClickUp (OAuth/PAT, raiz, mirror, advanced) agora vive dentro dos modais próprios.',
      'Ao clicar em RD ou ClickUp em Iterar, você vê o status card no topo + painel completo de configuração abaixo — sem precisar pular pra Settings.',
      'Bloco antigo de RD e ClickUp em Configurações deixou de ter rota direta.',
      'Backend continua exatamente igual — Sansone e demais clientes mantêm conexões ativas intactas.'
    ]
  },
  {
    version: 'V35.6.0',
    date: '2026-06-02',
    title: 'Integrações IPI — área inteira repaginada com Injetar, Propagar e Iterar',
    bullets: [
      'A aba "Integrações" em Configurações foi inteira redesenhada com a mecânica do Journey: Injetar (softwares que alimentam dados), Propagar (executam comandos), Iterar (dialogam em loop).',
      'Cada aba tem descritivo educativo explicando seu papel + cores próprias (gradiente azul de profundidade).',
      'Cards de integração no padrão Google Ads V35.5.0 — Google Ads, Hotmart, Meta Ads, Stripe em Injetar; RD Station, ClickUp em Iterar.',
      'Modal de cada integração herda a cor de fundo da aba a que pertence; as cores próprias (amber, orange, pink, violet) viram accents que vibram na cor principal.',
      'Modais próprios pra RD e ClickUp substituem o deep-link pro Settings antigo — RD mostra 3 sub-conexões (Token / Tempo Real / Marketing), ClickUp mostra Workspace e Sincronização.',
      'Componente Connection Status Card unificado (estilo print 3 do RD) aplicado em todas as 4 integrações ativas — identificação, badges, última validação, botões e ícone de ajuda.',
      'Modal nested "X + LeadJourney" no ícone (?) explica o fluxo de dados real de cada integração: o que entra, o que sai, frequência, como o loop funciona e pré-requisitos.',
      'Bancos de Leads migrados pra Configurações → Minha Conta → aba "Bancos de Leads" (não é integração externa).',
      'Seção "Conexão RD Station" removida do sidebar de Configurações (agora é card em Iterar).',
      'Backend não mudou nada — sua conexão RD, ClickUp ou Google Ads continua intacta.'
    ]
  },
  {
    version: 'V35.5.0',
    date: '2026-06-02',
    title: 'Integração Google Ads — conecte sua conta em 4 passos',
    bullets: [
      'Novo card Google Ads em Configurações → Integrações → Performance (era "Em breve").',
      'Wizard de 4 passos: credenciais (Client ID/Secret/Developer Token) → autorizar → escolher conta → pronto.',
      'Cada cliente conecta sua própria conta Google Ads — multi-tenant nativo.',
      'Refresh token salvo criptografado por tenant (AES-256-GCM); access token renovado automaticamente.',
      'Botão "Desconectar" zera tudo e remove credenciais do banco.'
    ]
  },
  {
    version: 'V35.4.3',
    date: '2026-06-01',
    title: 'Sessão expirada agora aparece como banner discreto — sem bloquear',
    bullets: [
      'Quando a sessão expira, banner âmbar aparece no topo em vez do modal vermelho bloqueante.',
      'Você pode continuar navegando, vendo seus dados e dashboards.',
      'Pra salvar algo (criar campanha, editar lead, etc), o modal pede pra reentrar.',
      'Modelo seguido por HubSpot, Linear, Asana — moderno e menos invasivo.'
    ]
  },
  {
    version: 'V35.4.2',
    date: '2026-06-01',
    title: 'Fix: campos runtime do state silenciam warning do console',
    bullets: [
      'Campos internos (_reconciliationLastLoadedAt, _knownTagsCache, etc) marcados como runtime — não tentam mais persistir.',
      'Warning "Campos persistidos NÃO mapeados" some.'
    ]
  },
  {
    version: 'V35.4.1',
    date: '2026-06-01',
    title: 'Fix: 5 campos do state agora carregam corretamente no F5',
    bullets: [
      'Campos do Lead Import Wizard, notificações e versão vista no sininho não estavam sendo recuperados após reload.',
      'Assertion antiga do JourneyPipelineModule corrigida — testava método inexistente.'
    ]
  },
  {
    version: 'V35.4.0',
    date: '2026-06-01',
    title: 'Onda de Hardening — segurança fortalecida em 5 frentes',
    bullets: [
      'Audit log: cada acesso registrado por 90 dias (consultável pelo master).',
      'Rate limit por usuário: 1000 req/min (master sem limite).',
      'Chave de criptografia derivada por cliente (HKDF) — vazar uma não compromete as outras.',
      'Logs mascaram automaticamente emails, telefones, CPF e tokens.',
      'JWT secret pode rotacionar sem invalidar tokens em circulação.'
    ]
  },
  {
    version: 'V35.3.10',
    date: '2026-06-01',
    title: 'Fix sininho: modal abre em qualquer tela + badge correto',
    bullets: [
      'Antes: clicar no sininho na Home não abria o modal de notificações (só funcionava na tela de Leads).',
      'Antes: primeiro acesso mostrava badge "14" porque contava releases antigas.',
      'Agora: badge mostra só atualizações que entraram desde sua última visita.'
    ]
  },
  {
    version: 'V35.3.9',
    date: '2026-06-01',
    title: 'Fix import: várias colunas pro mesmo campo agora acumulam',
    bullets: [
      'Se 2 colunas mapeiam pra Telefone (ex: "Telefone" + "Celular"), o LJ usa o primeiro valor preenchido em vez de sobrescrever.',
      'Se várias colunas mapeiam pra Tags (ex: "Tags" + "Habitualidades" + "Profissão"), tudo vira tag — sem perder dado.',
      'Tags duplicadas no mesmo lead são removidas automaticamente.'
    ]
  },
  {
    version: 'V35.3.8',
    date: '2026-06-01',
    title: 'Notificações de atualização no sininho',
    bullets: [
      'Toda nova versão do LJ vira notificação no sininho da Home.',
      'Click no sininho mostra o que mudou em cada release.',
      'Histórico das últimas 20 versões guardado.'
    ]
  },
  {
    version: 'V35.3.7',
    date: '2026-06-01',
    title: 'Lead Import Wizard — 4 steps guiados',
    bullets: [
      'Importação de CSV agora tem wizard: Upload → Mapear → Revisar → Importar.',
      'Auto-detecta separador (vírgula, ponto-vírgula, tab) e auto-mapeia colunas.',
      'Preview de duplicados antes de confirmar (até 50k leads).',
      'Cafezinho loader animado nas esperas.'
    ]
  },
  {
    version: 'V35.3.6',
    date: '2026-06-01',
    title: 'Copy do popup "Criar campanha" agora reflete o estado',
    bullets: [
      'Quando produto já tem campanha, popup diz "vamos plugar mais uma" em vez de "primeira".'
    ]
  },
  {
    version: 'V35.3.5',
    date: '2026-06-01',
    title: 'Fix botão "+ Criar nova campanha" no Mapa da Receita',
    bullets: [
      'Botão agora sempre abre o form de criação, mesmo quando produto já tem 1 campanha.'
    ]
  },
  {
    version: 'V35.3.4',
    date: '2026-06-01',
    title: 'Alunos / Meta Ads / Google Ads agora são tabs paralelas no Dashboard',
    bullets: [
      '5 tabs no Dashboard: Visão Geral, Checkout, Meus Alunos, Meta Ads, Google Ads.',
      'Antes estavam embutidas dentro do Checkout — agora navegam no mesmo nível.'
    ]
  },
  {
    version: 'V35.3.3',
    date: '2026-06-01',
    title: 'Meta Ads + Google Ads como placeholders no Dashboard',
    bullets: [
      'Duas novas abas com preview do que vai chegar: gasto, ROAS, conversões.',
      'APIs reais entram em fases futuras.'
    ]
  },
  {
    version: 'V35.3.2',
    date: '2026-05-31',
    title: '"Área de Alunos" migrou pra Dashboard > Checkout > Meus Alunos',
    bullets: [
      'Tudo Hotmart agora vive sob a tab Checkout — menu lateral mais limpo.'
    ]
  },
  {
    version: 'V35.3.1',
    date: '2026-05-31',
    title: 'Motivos de recusa de cartão (Hotmart)',
    bullets: [
      'Card "Motivos de recusa" no Dashboard Checkout: top 4 motivos + barra "Outros".',
      'Tags granulares (lj-recusa-cartao-vencido, lj-recusa-sem-saldo, etc) aplicadas automaticamente.',
      'Sugestões de sub-stage em Vendas BOF quando volume passa de 5 ocorrências.'
    ]
  },
  {
    version: 'V35.3.0',
    date: '2026-05-30',
    title: 'Aba "Área de Alunos" (placeholder Club API)',
    bullets: [
      'Nova aba no menu principal com preview do que vai vir: progresso por módulo, alunos em risco.'
    ]
  },
  {
    version: 'V35.2.0',
    date: '2026-05-30',
    title: 'Hotmart agora cobre 11 eventos (era 5)',
    bullets: [
      'Novos: cart abandonment, boleto gerado, pagamento atrasado, cancelamento de assinatura, switch de plano.',
      'Tags automáticas + sugestões no sub-funil pra cada evento.'
    ]
  },
  {
    version: 'V35.1.1',
    date: '2026-05-29',
    title: 'Painel Djow lateral no Dashboard Checkout',
    bullets: [
      'Resumo IA da operação + perguntas pré-formadas + chat livre.',
      'Renova quando muda sub-tab ou período.'
    ]
  },
  {
    version: 'V35.1.0',
    date: '2026-05-29',
    title: 'Dashboard Checkout: Hotmart com sub-tabs por produto',
    bullets: [
      'KPIs (receita, ticket médio, comissão), gráfico de evolução, tabela de transações.',
      'Sync de histórico via OAuth opcional (Sales API).'
    ]
  },
  {
    version: 'V35.0.0',
    date: '2026-05-28',
    title: 'Sub-funil completo no Revenue Flow Map',
    bullets: [
      'Cada bolinha do mapa abre modal com mini-funil editável (drag&drop pra reordenar).',
      'Tag move lead entre sub-stages automaticamente. Visual com paleta semântica.',
      'Painel "ver leads" expansível + sugestões Hotmart por bolinha.'
    ]
  }
];
