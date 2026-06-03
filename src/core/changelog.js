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
