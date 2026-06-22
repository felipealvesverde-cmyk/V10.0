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
    version: 'V40.11.22',
    date: '2026-06-21',
    title: 'Demo · Lê de Hotmart real (não mock) — auto-bootstrap das 3 tabelas + fallback no pipeline-velocity-summary',
    bullets: [
      'Descoberta: as 1.920 vendas do Pilsen vinham de mock estático hardcoded em lib/demo-checkout-mock.js (branch demo no pipeline-velocity-summary). A tabela lj_hotmart_purchases nem existia no tenant DB do demo (achado #2 migrations silent failure).',
      'Caminho B do Djow entregue: agora o demo lê de Hotmart de verdade.',
      'admin-populate-demo-hotmart cria as 3 tabelas (lj_visitors, lj_visitor_touchpoints, lj_hotmart_purchases) com CREATE TABLE IF NOT EXISTS antes do INSERT — idempotente, espelha tenant-db-schema.sql. Auto-bootstrap pro tenant demo.',
      'pipeline-velocity-summary branch demo agora tem fallback: SE lj_hotmart_purchases existe E tem dados approved → cai na query real (mesmo path dos outros tenants). SENÃO → mock. Demo migrado vira leitura real; demo não-migrado ainda funciona.',
      'Outros tenants (Sansone, qualquer cliente real) nunca tocam essa branch — comportamento idêntico ao anterior. Risco zero pra eles.',
      'Demo agora vira teste de integração real do LJ (lei [[feedback_demo_exposes_core_bugs]]). Qualquer bug do pipeline Hotmart aparece no demo antes do cliente real ver.'
    ]
  },
  {
    version: 'V40.11.21',
    date: '2026-06-21',
    title: 'Fix: admin-populate-demo-hotmart usava current_tenant_id (não existe) — troca pra default_tenant_id',
    bullets: [
      'Endpoint da V40.11.20 chutou o nome da coluna users.current_tenant_id sem verificar. A coluna correta é default_tenant_id — mesmo padrão usado em cron-daily-tick, debug-tenant-state, clickup-oauth-callback e outros endpoints. 500 com error "column current_tenant_id does not exist".',
      'Bug de copilot. Aprendizado: antes de query em coluna nova, grep noutros endpoints pra confirmar nomenclatura.'
    ]
  },
  {
    version: 'V40.11.20',
    date: '2026-06-21',
    title: 'CAC fmt 2 casas decimais quando < R$ 10 + endpoint admin pra popular lj_hotmart_purchases',
    bullets: [
      'Fix arredondamento no Card CAC: valores menores que R$ 10 ganham 2 casas decimais (R$ 0,19 em vez de R$ 0). Pra valores acima de R$ 10, mantém arredondamento limpo. Receita continua com 0 casas (não importa centavo em R$ 2,57 mi).',
      'Novo endpoint /api/admin-populate-demo-hotmart que popula lj_hotmart_purchases (mesma tabela que o webhook do Hotmart escreve) com N transações aprovadas espalhadas no janela. Permite popular 122k vendas pra Pilsen sem precisar de 122k webhooks HTTP — mas mantém schema 1:1 com o que o webhook geraria.',
      'Body do endpoint: { productId, count, avgValueCents, windowDays }. Retorna { ok, inserted, deleted } — sem newState destrutivo (achado #15 evitado). Caller dispara Actions.loadPipelineVelocitySummary({force:true}) pra refetch do cache.'
    ]
  },
  {
    version: 'V40.11.19',
    date: '2026-06-21',
    title: 'Demo · Endpoint admin de funil retorna delta (actions) em vez de newState — fim do replace destrutivo',
    bullets: [
      'A V40.11.18 retornava newState inteiro do endpoint /api/admin-populate-demo-funnel. Caller fazia App.state = State.normalize(data.newState) — padrão V40.7.10 contra race com auto-save. Mas State.normalize zera campos voláteis (pipelineVelocityCache, governanceClosings, etc) que NÃO estão no schema persistido mas são populados em runtime via load.',
      'Resultado quando rodou no Pilsen: Realizado Vendas, Receita inteira, CAC Projetado zeraram na tela. O dado certo estava no DB, só o state em memória descalibrou.',
      'Endpoint agora retorna APENAS o delta (actions array), não newState inteiro. Caller faz patch cirúrgico (App.state.actions = data.actions) preservando todos os caches voláteis.',
      'Achado #15 cravado no inventário (mesma família do #3 race auto-save). Outros endpoints admin com o mesmo bug pendente: admin-add-demo-conversions, admin-add-demo-products, admin-add-demo-revops, admin-restore-demo-state. Refator pra padrão "delta-only" entra na onda quando population fechar.'
    ]
  },
  {
    version: 'V40.11.18',
    date: '2026-06-21',
    title: 'Demo · Endpoint admin pra popular funil 9 etapas com taxas decrescentes por stage',
    bullets: [
      'Novo endpoint /api/admin-populate-demo-funnel que aceita um funnelShape com 9 valores específicos (um por stage) e popula as actions do produto demo proporcionalmente ao peso natural (sector × funnel).',
      'Diferente do admin-add-demo-conversions (V40.7.13) que usava o MESMO manualConverted em todas as stages (workaround V40.7.14), agora cada stage tem seu próprio número — modela funis reais com taxas decrescentes (Cenário A: 875k topo → 117k fundo).',
      'Suporta os 3 cenários discutidos com Djow (Massa, Inbound, Outbound B2B) e qualquer outro shape customizado.',
      'Distribui cross-actions: se o produto tem N actions, cada uma recebe sua fatia do shape. Soma cross = funnelShape total. Última action absorve resto pra fechar exato.',
      'Retorna newState pra caller atualizar App.state direto (padrão V40.7.10 contra race com auto-save).'
    ]
  },
  {
    version: 'V40.11.17',
    date: '2026-06-21',
    title: 'RevOps · Resultado: régua reescrita do zero — legenda em row embaixo, fim das colisões',
    bullets: [
      'Cinco versões tentaram resolver colisão de labels com absolute positioning (V40.11.12 anti-colisão, V40.11.13 fio, V40.11.15 chevron, V40.11.16 mb-20). Cada conserto trazia outro problema. Estratégia errada.',
      'Régua reescrita do zero. Marcadores ficam SÓ na barra (bolinhas + tick verde). Labels saem do absolute positioning e viram uma LEGENDA em row embaixo da régua: [● Realizado 2%] [● Projetado 8%] [● Meta 100%].',
      'Sem absolute, sem colisão, sem mb gigante, sem chevron, sem fio. Régua mostra POSIÇÃO, legenda mostra IDENTIDADE — separação limpa de responsabilidades.',
      'Linha "hoje" mantida na régua (referência temporal). Aplicado nos 3 cards (Receita, CAC, Vendas). Card encolhe ~40px vs versão anterior.'
    ]
  },
  {
    version: 'V40.11.16',
    date: '2026-06-21',
    title: 'RevOps · Resultado: mb da régua sobe pra mb-20 com colisão (label descido não invade mais o rastreio)',
    bullets: [
      'A seta chevron-up resolveu o cruzamento da régua na V40.11.15, mas trouxe um efeito colateral: o label PROJETADO descido + chevron + 2 linhas de texto totaliza ~32-36px de altura, e o mb-12 (48px) abaixo da régua era insuficiente. O label invadia o link "Como esse número foi calculado?" embaixo.',
      'Margin-bottom da régua sobe de mb-12 pra mb-20 (80px) quando há colisão. Folga de ~4-6px embaixo do label descido. Sem colisão fica mb-8 (32px) — não desperdiça altura.',
      'Aplicado nos 3 cards (Receita, CAC, Vendas).'
    ]
  },
  {
    version: 'V40.11.15',
    date: '2026-06-21',
    title: 'RevOps · Resultado: fio conector vira seta chevron-up no label descido (régua deixa de ser invadida)',
    bullets: [
      'O fio pontilhado vertical violet que ligava o marcador descido ao label cruzava a barra horizontal cinza da régua — visualmente parecia que a régua "invadia" o conector. Geometricamente inevitável: linha vertical × barra horizontal = ponto de cruzamento.',
      'Estratégia trocada: fio sumiu, seta chevron-up minúscula violet apareceu ACIMA do label descido. Aponta visualmente pro marcador acima sem cruzar nada.',
      'Aplicado nos 3 cards (Receita, CAC, Vendas) — toda vez que Realizado e Projetado caem perto na régua (< 12% de distância) e o label de Projetado desce pra second-row.',
      'Mais leve e mais elegante. Conector deixa de competir visualmente com a régua.'
    ]
  },
  {
    version: 'V40.11.14',
    date: '2026-06-21',
    title: 'RevOps · Resultado: edit-in-place da Meta de CAC — botão Meta abre modal de edição',
    bullets: [
      'A Meta de CAC tinha ficado órfã desde a V40.11.3 — o dado vivia no state mas não havia UI pra editar. Demo Pilsen tinha Meta R$ 1 cravada lá atrás e ninguém conseguia ajustar.',
      'Agora o header do Card CAC tem um botão "✎ Meta" violet ao lado do badge de saúde. Click abre modal pequeno (320px) com input numérico de valor + botões Salvar/Cancelar. Enter salva, Escape cancela, click no overlay fecha.',
      'Modal segue a paleta do CAC (side accent roxo RevOps + título violet). Não polui outras tabs — vive no mesmo lugar onde a meta é lida.',
      'Padrão "edit-in-place" — onde vê é onde edita. Lei "Resultado é leitura" não quebra (continua válida pra modelagem ampla); edit-in-place é micro-edição pontual de 1 campo, exceção bem delimitada.',
      'Quando outras metas autônomas aparecerem no futuro (EBITDA target, Margem target, etc.), cada uma vira botão "Meta" no seu próprio card. Padrão escalável sem criar tab nova.'
    ]
  },
  {
    version: 'V40.11.13',
    date: '2026-06-21',
    title: 'RevOps · Resultado: polidura² Leonardo — fio conector, "—" elegante, banner enxuto, header reforçado',
    bullets: [
      'Onda 7 do Leonardo (polidura sobre a polidura). Foram 7 ajustes cirúrgicos sobre a tríade que já estava boa mas tinha micro-defeitos.',
      'Fio conector pontilhado violet entre marcador e label quando o label desce pra second-row (anti-colisão). Antes parecia label perdido no espaço; agora linka visualmente "essa bolinha pertence a esse texto".',
      'Pílula "Aguardando Ads" no CAC virou um simples "—" em text-3xl text-stone-300 — mesmo tamanho dos outros números, mantém a grid balanceada. Tooltip explica origem.',
      'Banner "Meta provavelmente incorreta" no CAC encolheu de full-width 55px pra inline-flex 28px: "⚠ Meta 2.3× pequena · revise em Modelagem". Compacto, não empurra a régua.',
      'Label "hoje" da régua subiu de text-[8px] pra text-[9px] font-black uppercase + slate-600 + linha h-4. Antes invisível, agora se lê.',
      'mb da régua virou condicional: mb-12 quando há colisão (precisa de espaço pro label descido), mb-8 quando não há. Cards sem colisão não desperdiçam altura.',
      'Bloco "METAS · JUN DE 2026" virou header de verdade: ícone target + text-sm font-black slate-700 + linha divisória embaixo. Antes era text-[10px] quase invisível.',
      'Os 3 cards (Receita, CAC, Vendas) agora vivem no MESMO bloco "Metas" com space-y-5. Antes Vendas estava num bloco separado, sem agrupamento visual.'
    ]
  },
  {
    version: 'V40.11.12',
    date: '2026-06-21',
    title: 'RevOps · Resultado: polidura final — anti-colisão, placeholder Ads, threshold meta CAC, "hoje" visível',
    bullets: [
      'Onda 6 (polidura final) do Leonardo. Cinco ajustes pontuais sobre a tríade que já estava madura.',
      'Anti-colisão de labels REALIZADO/PROJETADO: quando os marcadores caem a menos de 12% de distância na régua (caso do Pilsen, 2% e 8%), o label de Projetado desce pra second-row em vez de empilhar com Realizado. Aplicado nos 3 cards (Receita, CAC, Vendas).',
      'Realizado vazio no CAC saiu do traço grosso esquisito. Agora é uma pílula cinza honesta "Aguardando Ads" com ícone clock. Coluna mantém presença visual sem inventar dado.',
      'Detector de meta absurda no CAC: threshold 5× → 2×. CAC raramente dobra dentro de operação calibrada — quando Projetado é 2× a Meta, já é sinal de input incorreto (caso típico: Meta R$ 1 vs Projetado R$ 2 no Pilsen). Mensagem mostra a multiplicador exato com 1 decimal.',
      'Linha fantasma "hoje" na régua ganhou label minúsculo "hoje" acima e ficou mais grossa (w-0.5, opacity-90, stroke slate-500). Antes era invisível.',
      'Subtítulo do tab Resultado atualizado de "Meta vs realizado de Vendas e CAC, indicadores principais e leitura do funil" pra "A vida da operação em três cards: Receita, CAC e Vendas. Realizado · Projetado · Meta." — falando da tríade real, não do mundo antigo.'
    ]
  },
  {
    version: 'V40.11.11',
    date: '2026-06-21',
    title: 'RevOps · Resultado: linha "hoje" na régua + detector de meta absurda no CAC',
    bullets: [
      'Onda 5 do Leonardo entregue. As réguas dos cards Receita e Vendas afundavam no canto esquerdo (Realizado em 2%, Projetado em 8%, Meta no extremo) — visualmente "muito longe", sem contexto temporal.',
      'Agora cada régua ganha uma linha fantasma cinza posicionada em (dia atual ÷ dias totais do mês) × Meta. Mostra onde o Realizado deveria estar HOJE pra ficar on-track com o calendário. Hover na linha mostra "Hoje: dia X de Y".',
      'Card CAC ganha detector de meta absurda. Quando Projetado > 5× Meta (situação típica de erro de digitação, ex: Meta R$ 1 em vez de R$ 1.000), aparece banner amber: "Meta provavelmente incorreta. Projetado é Nx maior que a meta — revise em Modelagem."',
      'Régua do CAC não ganha linha "hoje" — CAC não acumula no mês como Receita/Vendas, é taxa contínua. Linha fantasma só faz sentido em métricas acumulativas.'
    ]
  },
  {
    version: 'V40.11.10',
    date: '2026-06-21',
    title: 'RevOps · Resultado: cards encolhem ~30% — subtítulo vira tooltip, rastreio colapsa',
    bullets: [
      'Onda 4 do Leonardo entregue. Cada card carregava ~5 zonas verticais: header, subtítulo poético, 3 números, régua, rastreio (4 linhas cinza). × 3 cards = 15 zonas. Página pesava.',
      'Subtítulo poético ("A vida da operação...", "O preço de cada cliente...", "Quantas vendas tivemos...") saiu da view padrão. Virou tooltip no ícone "info" ao lado do título — passa o mouse, lê. Libera 24px por card.',
      'Rastreio cinza (4 linhas explicando origem de cada número) virou bloco colapsado "▸ Como esse número foi calculado?". Click pra abrir, click pra fechar (HTML details nativo, sem JS). Libera 60-80px por card quando colapsado.',
      'Cards encolhem ~30% de altura. Página vira tríade enxuta: 3 cards triangulares respiráveis no topo, com badge de saúde e número protagonista. Subtítulo e rastreio acessíveis em 1 clique.'
    ]
  },
  {
    version: 'V40.11.9',
    date: '2026-06-21',
    title: 'RevOps · Resultado: pulse semafórico de saúde + cor inversa no CAC quando estoura',
    bullets: [
      'Onda 3 do Leonardo entregue. Os 3 cards triangulares mostravam distância pra meta na régua, mas não opinavam sobre saúde. Cliente via 8% atingido no dia 21/30 do mês e não sabia se é catástrofe ou tranquilo.',
      'Cada card ganha um badge de saúde no canto direito do cabeçalho, pulsando suave: "No ritmo" (verde) se progresso ≥ proporção do mês corrido, "Atenção" (amber) entre 70-99% on-track, "Crítico" (rose) abaixo de 70%. Cálculo: (Realizado ÷ Meta) ÷ (dia atual ÷ dias totais do mês).',
      'No Card CAC a lógica inverte (menor é melhor): badge verde quando Realizado ≤ Meta, amber até 30% acima, rose quando estoura 30%. E os números (Realizado e Projetado) ficam rose-700 visualmente quando passam da Meta — coloração condicional avisa antes do badge.',
      'Quando faltar Meta ou Realizado, badge fica neutro cinza com label honesto ("Sem meta", "Aguardando dado"). Não inventa saúde sem base.',
      'Pra Pilsen no dia 21 com Realizado em 2% da Meta: badge rosa "Crítico" em Receita e Vendas. CAC com Projetado R$ 2 contra Meta R$ 1: badge "Crítico" + Projetado em rose-700. Cliente esbarra com o número E com o sentimento.'
    ]
  },
  {
    version: 'V40.11.8',
    date: '2026-06-21',
    title: 'RevOps · Resultado: hierarquia tipográfica — Realizado vira protagonista nos 3 cards',
    bullets: [
      'Onda 2 do Leonardo entregue. Os 3 números (Realizado, Projetado, Meta) tinham o mesmo tamanho — text-2xl pra todos. Mas não têm o mesmo peso narrativo na decisão: Realizado é verdade do mês, Projetado é previsão, Meta é referência de longo prazo.',
      'Agora a tipografia escala em Fibonacci: Realizado em text-3xl peso black slate-900 (protagonista), Projetado em text-2xl peso black slate-700 (secundário), Meta em text-xl peso black slate-600 (referência).',
      'Aplicado nos 3 cards triangulares (Receita, CAC, Vendas) com items-end no grid pra alinhar os números pela base — o olho pousa primeiro no Realizado, depois esquadrinha o resto.',
      'leading-tight nos números pra eliminar respiro vertical excessivo quando o número quebra (R$ 2.640.000 no card Receita).'
    ]
  },
  {
    version: 'V40.11.7',
    date: '2026-06-21',
    title: 'RevOps · Resultado: paleta semântica nos 3 cards — Receita amarelo, CAC roxo, Vendas ciano',
    bullets: [
      'Onda 1 do Leonardo entregue. Os 3 cards triangulares estavam todos pintados de ciano (#00CBCC) — cor que na paleta cravada é só de Vendas. Receita, CAC e Vendas usando a mesma cor apagavam a leitura por significado.',
      'Cada card agora veste a cor da sua semântica: Receita ganha amarelo Receita (#F6DB5C) na faixa lateral, CAC ganha roxo RevOps (#AB3ED8), Vendas mantém ciano Vendas (#00CBCC). Cliente bate o olho na faixa lateral e sabe o que é antes de ler o título.',
      'Título dos cards saiu do slate-500 minúsculo (text-[10px]) pra peso black, text-xs, cor escura da família (amber-800 pra Receita, violet-700 pra CAC, cyan-700 pra Vendas). Dot colorido antes do título reforça a identidade visual.',
      'Próximas ondas do Leonardo conhecidas: hierarquia tipográfica (Realizado vira protagonista), sinal de saúde (pulse semafórico), rastreio vira tooltip, régua adaptativa.'
    ]
  },
  {
    version: 'V40.11.6',
    date: '2026-06-21',
    title: 'RevOps · Resultado: bloco CTC + Fat. Bruto removido — página vira tríade pura',
    bullets: [
      'O bloco "Indicadores principais (cascata RevOps)" com Custo Total Comercial (R$ 22.000) e Faturamento Bruto Realizado (R$ 42.240) saiu da página. Quebrava o vocabulário visual: dois números soltos no meio de três cards de triangulação Real/Proj/Meta + régua + rastreio.',
      'Página agora é tríade pura — Card Receita (R$), Card CAC (R$ por venda), Card Vendas (quantidade) — todos com o mesmo padrão visual. Leitura única: olhou um, sabe ler os outros dois.',
      'CTC continua vivo no Card CAC (linha "Projetado: R$ X CTC da composição ÷ Y vendas") como parte da fórmula. Não some do produto — só não aparece como número solto na home da tab Resultado.',
      'Próximo passo conhecido: análise do Leonardo sobre o equilíbrio visual da tríade — sobreposição de marcadores quando valores estão próximos, hierarquia entre os 3 cards, paleta semântica de cor (hoje os 3 cards estão em ciano de Vendas — RevOps é roxo).'
    ]
  },
  {
    version: 'V40.11.5',
    date: '2026-06-21',
    title: 'RevOps · Resultado: Card Vendas (qtd) — Realizado · Projetado · Meta — fecha a tríade',
    bullets: [
      'O bloco "Realizado (lido do funil)" tinha 2 BigCells (9.600 vendas + R$ 46.080 faturamento) lendo do funil das actions. Mesmo período, mesmo produto, mas mostrava 9.600 vendas enquanto o Card Receita acima dizia 1.920 (Checkout). Duas fontes de "real" disputando a página, sem hierarquia clara.',
      'Bloco virou Card Vendas triangular: Realizado · Projetado · Meta na mesma linguagem visual do Receita e CAC — três números no topo, régua única, rastreio cinza de procedência. Espelho perfeito da tríade que já estava em cima.',
      'Realizado = vendas Checkout (1.920 Hotmart approved). Projetado = vendas cadenciadas no funil do CRM (9.600 das actions). Meta = soma de vendas configuradas nas Ofertas (120.000 Pilsen). O que era contradição virou triangulação.',
      'O "Faturamento real R$ 46.080" sai da página — já tinha "Faturamento Bruto Realizado R$ 42.240" na cascata acima, fonte mais confiável (Checkout × ticket real). Sem dois faturamentos na mesma tela.',
      'A tab Resultado agora é: 3 cards triangulares no topo (Receita, CAC, Vendas) + cascata enxuta (CTC + Fat. Bruto) embaixo. Tríade Real/Proj/Meta vira o vocabulário único de leitura da página.'
    ]
  },
  {
    version: 'V40.11.4',
    date: '2026-06-21',
    title: 'RevOps · Receita do mês: Projetado deixa de empatar com Realizado (fim da tautologia)',
    bullets: [
      'O Card Receita mostrava Realizado e Projetado idênticos (R$ 42.240 = R$ 42.240). Não era coincidência — era erro de fórmula. O Projetado fazia visitas × taxa × ticket, mas a taxa era calculada como vendas ÷ visitas na mesma janela. Algebricamente, isso colapsa em vendas × ticket — o mesmo Realizado, vestido de Projetado.',
      'O Projetado agora reflete o que você cravou desde o início: CRM. Lê a soma de vendas projetadas pelo funil das actions (FlowResolutionEngine.buildActionFlow.converted) × ticket médio do CRM. Realizado segue Checkout (Hotmart approved). Fontes diferentes, números diferentes, leitura honesta.',
      'O rastreio do card mudou de "X visitas únicas × Y% conversão × R$ Z ticket" pra "X vendas projetadas no funil do CRM × R$ Z ticket CRM". Linguagem alinhada com o que o número significa de verdade.',
      'O Card CAC ganhou a mesma correção: o "Projetado" do CAC era CTC ÷ (visitas × taxa) tautológica; agora é CTC ÷ vendas projetadas pelo funil do CRM.',
      'Quando RD CRM granular for plugado, a fonte do "vendas no funil" troca de actions do LJ pra deals em estágio CRM avançado, sem mexer em UI nem em fórmula da régua. Achado #13 do inventário segue de pé.'
    ]
  },
  {
    version: 'V40.11.3',
    date: '2026-06-21',
    title: 'RevOps · Resultado: cascata enxuta + CAC vira espelho do Receita (triangulação dupla no topo)',
    bullets: [
      'O bloco "Indicadores principais" tinha 4 cards de modelo (Vendas, CTC, CAC, Faturamento Bruto). Felipe revisou: o card de Vendas era redundante (a quantidade já aparece no rastreio do Card Receita logo acima), e o CAC merecia o mesmo tratamento de triangulação que o Receita ganhou — Realizado · Projetado · Meta numa régua.',
      'O bloco de Metas do período agora tem dois cards lado a lado: Receita do mês (já existia) e CAC do mês (novo, espelho visual). Ambos com Realizado em sky, Projetado em violet, Meta em emerald, régua única e rastreio cinza de procedência.',
      'CAC Realizado puxa do gasto real de mídia ÷ vendas Checkout aprovadas. Projetado puxa do CTC da composição ÷ vendas projetadas (visitas × taxa). Meta vem do valor cravado pra esse período. Microcopy do card explica direção: menor é melhor — meta é o teto que a operação não quer cruzar.',
      'A cascata RevOps abaixo enxugou pra 2 cards: CTC (mantido, soma da composição) e Faturamento Bruto Realizado (Hotmart approved × ticket real). O Faturamento Bruto deixou de mostrar modelo (Vendas × TM inflado pelo input antigo) — agora é só o número real. Microcopy curto embaixo explica a origem.',
      'O card "Meta de CAC" separado, que ainda existia abaixo do Card Receita, sumiu — a triangulação do novo Card CAC absorve tudo (Meta, Projetado, Realizado) num lugar só. Sem duplicidade.'
    ]
  },
  {
    version: 'V40.11.2',
    date: '2026-06-19',
    title: 'RevOps · Receita do mês: fix da taxa de conversão impossível (964,8% → leitura sã)',
    bullets: [
      'O card Receita do mês mostrava taxa de conversão de 964,8% pra Cerveja Pilsen no demo. Matematicamente impossível. Causa: o denominador "leads vivos" puxava de uma fonte (actions LJ), e o numerador "vendas confirmadas" puxava de outra (Hotmart approved). Os dois mundos não se conheciam.',
      'O denominador agora vem da mesma fonte que o numerador: visitors únicos do tracker (mesmo cache que o Pipeline Velocity usa). Como ambos descendem do mesmo plano observacional (visitor → customer no funil Hotmart), a taxa nunca passa de 100%.',
      'Rastreio do card atualizado: "X visitas únicas × Y% conversão × R$ Z ticket CRM". Vocabulário mudou de "leads vivos" pra "visitas únicas" — coerente com a fonte real.',
      'Fix de fórmula puro. Zero mudança visual além do micro-texto do rastreio. Card, régua, header, blocos vizinhos seguem exatamente iguais.'
    ]
  },
  {
    version: 'V40.11.1',
    date: '2026-06-19',
    title: 'RevOps · Resultado: rollback cirúrgico — devolve tudo, mantém só a troca do card de Vendas',
    bullets: [
      'Felipe pediu pra mexer SÓ no card "Meta de Vendas" da aba Resultado. Eu estiquei e mexi na tela inteira — sumiram a cascata RevOps, o Realizado do funil, o Meta de CAC. Mesmo erro de over-engineering da V40.8.0. Reconhecido e corrigido.',
      'Voltam pra tela: Card Meta de CAC, bloco "Indicadores principais (cascata RevOps)" com 4 BigCells (Total Vendas, CTC, CAC, Faturamento Bruto), bloco "Realizado (lido do funil)" com 2 BigCells, microcopy de calibração da projeção.',
      'O que fica do refator: Card Receita do mês continua substituindo só o antigo card "Meta de Vendas". Engine novo no RevopsFinanceEngine dorme pronto. Header dual + subtítulo dinâmico + input "Vendas Previstas" removido + gating atualizado continuam vivos (Felipe confirmou que o header fica como está).',
      'Tab Resultado volta ao subtítulo original "Resultado Consolidado · Meta vs realizado de Vendas e CAC".'
    ]
  },
  {
    version: 'V40.11.0',
    date: '2026-06-19',
    title: 'RevOps · Header do produto: Realizado · Projetado dual + subtítulo dinâmico + input Vendas Previstas removido',
    bullets: [
      'O header roxo do produto deixa de mentir. Antes, em qualquer tab, mostrava só Projetado (Ticket × Vendas Previstas) inflado pelo input manual no rodapé — então o cliente via EBITDA -R$ 98.700 em "Resultado" mesmo a operação rodando. Era projeção vestida de realidade.',
      'Em tabs de leitura (Resultado, RevOps KPIs, DRE, Fechamento), cada KPI (Ticket Médio, Faturamento Bruto, Faturamento Líquido, EBITDA, Margem) virou dual: Realizado em letra grande, Projetado em letra menor embaixo ("Proj. R$ X"). O Realizado vem do engine novo (vendas Checkout aprovadas + ticket CRM).',
      'Em tabs de modelagem (Custos, Ofertas), continua mostrando só Projetado — porque lá você está modelando, não lendo. Sem ruído de Real.',
      'Subtítulo do header passa a falar a linguagem da tab ativa: Custos → "Estrutura de custos", Ofertas → "Modele sua operação como ela é", Resultado → "Vida da operação", RevOps KPIs → "Saúde dos indicadores", DRE → "Demonstrativo financeiro", Fechamento → "Mês fechado". Mata a dissonância antiga onde subtítulo dizia "modele" em telas de leitura pura.',
      'O input "Vendas previstas no período" saiu do header. Era o cordão umbilical da fórmula antiga (Vendas × Ticket = Faturamento). Agora a projeção vem do engine — leads vivos × taxa de conversão × ticket CRM — sem cliente precisar digitar nada.',
      'Gating de tabs migrou de "vendas previstas > 0" pra "1 oferta com meta de vendas". Quem cadastrou ofertas com meta em Ofertas já desbloqueia tudo. Cliente legado com salesProjection > 0 continua passando (sem migration forçada).',
      'Título do produto enxugou: "Operação de Receita · Cerveja Pilsen" virou só "Cerveja Pilsen" — o tab/subtítulo já contextualiza, redundância caiu.'
    ]
  },
  {
    version: 'V40.10.0',
    date: '2026-06-19',
    title: 'RevOps · Resultado: tela limpa com card único de Receita — Realizado · Projetado · Meta numa régua',
    bullets: [
      'A aba Resultado deixa de ser uma colcha de retalhos (2 cards de meta + cascata RevOps + realizado do funil + microcopy órfã) e vira UM card só: Receita do mês.',
      'O card mostra 3 números (Realizado, Projetado, Meta) em hierarquia visual única + uma régua horizontal com 3 marcadores proporcionais à Meta. Em meio segundo você lê onde está, onde vai chegar, e onde queria chegar.',
      'Realizado em ciano (Checkout aprovado), Projetado em violeta (CRM/operação), Meta em verde (alvo). Cada um carrega % relativo à Meta embaixo do marcador.',
      'Rastreio cinza embaixo de cada número expõe a origem: "312 vendas aprovadas no Checkout", "1.500 leads vivos × 12% conversão × R$ 528 ticket CRM", "soma de 3 ofertas configuradas em Ofertas". Sem caixa-preta.',
      'Drill saiu: cascata RevOps, indicadores principais, leitura do funil — tudo isso é trabalho de discussão, não de leitura. Migra pra Velocidade nas próximas ondas. Aqui você esbarra com a verdade, não argumenta com ela.',
      'CTA "Ajustar nas Ofertas" saiu também — Resultado é leitura, não configuração. Quem quer mexer em meta volta na aba Ofertas.',
      'Side accent ciano cravado no card (lei [[side-accent-law]]) — sinaliza que esse é o cockpit de Receita, não mais "metas + funil".'
    ]
  },
  {
    version: 'V40.9.0',
    date: '2026-06-19',
    title: 'RevOps · Resultado: engine novo de Receita do mês (Realizado · Projetado · Meta)',
    bullets: [
      'A tela Resultado Consolidado vai ganhar nas próximas ondas um quadro de Receita com 3 marcadores: Realizado, Projetado, Meta. Esta versão entrega o motor que alimenta esses 3 — UI vem em V40.10.',
      'Conceito cravado: CRM dita timing/operação (quando uma venda é uma venda) e Checkout dita o dinheiro confirmado. Realizado = vendas Checkout aprovadas últimos 30 dias. Projetado = Leads vivos no LJ × Taxa de conversão × Ticket médio. Meta = soma das ofertas configuradas.',
      'Taxa de conversão é dinâmica: dados dos últimos 30 dias. Janela curta aceita oscilação inicial pra reagir rápido a mudança boa ou ruim na operação — Felipe cravou que prefere reatividade a estabilidade engessada.',
      'Funções novas no engine: productLeadsAlive, productConvertedCount, productConversionRate, productCrmTicket, productRealRevenue, productProjectedRevenue, productRevenueSummary. Zero mudança visual nesta versão.',
      'Limitação consciente: hoje LJ não tem timestamp granular de avanço Vendas BOF → CS TOF. Pra Onda 1, Realizado e numerador da taxa usam Checkout (Hotmart approved) como proxy. Quando CRM granular for plugado, troca-se a fonte sem mexer na UI — engine já está modular pra isso.'
    ]
  },
  {
    version: 'V40.8.1',
    date: '2026-06-19',
    title: 'RevOps · Ofertas: rollback do over-engineering — campo agora se chama "Projetado"',
    bullets: [
      'A V40.8.0 transformou uma distinção simples (Projetado vs Real) em toggle + 2 colunas + 3 badges + 2 banners. Felipe avaliou direto: "construiu algo difícil de entender" + "o espaço da Meta ficou ruim". Erro reconhecido.',
      'Volta a UMA coluna só, agora renomeada conceitualmente: "Projetado" (no lugar de "Participação"). O nome carrega a intenção: é a premissa que alimenta as projeções e os KRs.',
      'Sai o toggle Plano/Real do topo. Saem badges "EM USO", divergência, fallback. Sai o banner amarelo e o laranja. Card volta a respirar.',
      'Meta ganha mais espaço (w-20 → w-24) pra caber 120.000 sem aperto. Projetado mantém w-24.',
      'Sub-linha de auditoria do Ticket Médio Projetado volta ao simples: "média ponderada de N ofertas · 100% de projeção total".',
      'Engine mantém capacidade source-aware no código (participationBreakdown, _realParticipationByOffer, cfg.participationSource) — sem UI por enquanto. Quando vier a hora de mostrar Projetado vs Real no Resultado Consolidado (lugar conceitualmente correto pra isso), a infraestrutura já está pronta. Zero dívida técnica.'
    ]
  },
  {
    version: 'V40.8.0',
    date: '2026-06-19',
    title: 'RevOps · Ofertas: Participação Plano vs Real — ticket deixa de mentir quando real divergir',
    bullets: [
      'A "Participação" de cada oferta era input manual puro. Você podia digitar 70% pra Pilsen achando que ia ser carro-chefe e vender 30% no mês — o Ticket Médio continuava calculado pela premissa errada e a cascata inteira (CAC, EBITDA, projeção) saía distorcida. Lane Adint chama isso de "algoritmo de correção de forecast": diretor declara R$1M, taxa histórica corrige pra R$315k.',
      'Agora cada oferta tem 2 colunas: PLANO (sua premissa) e REAL (derivado das vendas do mês). Toggle no topo escolhe qual fonte calcula o Ticket — pode usar Plano pra planejamento/projeção e Real pra leitura de operação rodando.',
      'Quando Plano e Real divergem mais de 10% em alguma oferta, a UI mostra badge "divergência X%" em laranja na coluna Real + banner topo. Não força ação — só revela. Decisão fica com você: ajustar premissa, investigar o canal, ou aceitar a divergência.',
      'Quando você seleciona "Real" e ainda não há dado granular (caso típico de cliente com mais de 1 oferta no mesmo produto), banner amarelo explica honestamente: "Sem dado real granular ainda. LJ rastreia vendas no nível do produto, não por oferta. Real usa Plano como fallback enquanto roadmap não trata." Sem mentir o número.',
      'Caso trivial (1 oferta com vendas) — Real preenche automaticamente em 100%. Caso N ofertas — Real mostra "—" até roadmap de rastreabilidade venda → oferta sair.',
      'Sub-linha de auditoria do Ticket Calculado mostra qual fonte foi usada: "média ponderada de 3 ofertas · usando participação PLANO" OU "...usando participação REAL". Quando cai em fallback, marca "(fallback)" em âmbar pra você saber.',
      'Engine: novo helper `_realParticipationByOffer(cfg)` deriva % real por oferta; `_computeTicket(cfg)` é source-aware (plan/real); `participationBreakdown(cfg)` expõe metadados pra UI. Tudo backwards-compatible — configs antigas seguem como "plan" por default sem migration.'
    ]
  },
  {
    version: 'V40.7.21',
    date: '2026-06-19',
    title: 'RevOps · Ofertas: campo "Mix no TM" virou "Participação"',
    bullets: [
      'O label "Mix no TM" exigia 3 saltos cognitivos pra entender: o que é Mix? o que é TM? como um relaciona ao outro? Felipe pegou exatamente esse atrito.',
      'Renomeado pra "Participação" — operacional, business-language, lê como o usuário pensa: "essa oferta participa 100% no ticket".',
      'Tooltip refinado: "Fatia desta oferta no ticket médio do produto. Pondera a média." Quando participação é 0%, tooltip muda pra explicar exclusão.',
      'Sub-linha de auditoria do ticket calculado também renomeada: "100% do mix" → "100% de participação total". Subdescrição inline da oferta excluída diz "(participação 0%)" em vez de "(mix 0)".'
    ]
  },
  {
    version: 'V40.7.20',
    date: '2026-06-19',
    title: 'RevOps · Ofertas: card redesenhado pra fim de fricção e confusão',
    bullets: [
      'A aba Ofertas tinha 3 decisões empilhadas no mesmo plano visual (modo do ticket, peso de cada oferta, exclusão por checkbox) — usuário cansava sem entender por quê. Agora as 3 camadas têm hierarquia clara: decisão estrutural acima, ofertas no meio, ticket calculado embaixo como resposta.',
      'Modo de Cálculo do Ticket Médio virou bloco próprio com 2 cards (Ponderado vs Manual) e microcopy explicando QUANDO usar cada um. Antes era só radio button perdido em label.',
      'Checkbox "TM" da linha eliminada. Agora MIX % é a única alavanca: MIX > 0 entra no cálculo, MIX = 0 fica fora. Quando você zera o mix, o card da oferta vai pra 55% opacidade e mostra "fora do cálculo do TM" — você VÊ a exclusão sem precisar interpretar checkbox.',
      'Bug do arredondamento corrigido: ticket de R$ 4,80 agora aparece R$ 4,80, não R$ 5. Centavos importam — sumir com eles é dizer "não confio no número o suficiente pra mostrar inteiro".',
      'Tipo de oferta (Principal/Cross-sell/Up-sell/Down-sell) ganhou subdescrição inline embaixo do select: "Principal — o produto que define o ticket". Sem precisar adivinhar o que cada tipo significa.',
      'Bloco "Ticket Médio Calculado" embaixo do card mostra o número grande em roxo + sub-linha de auditoria: "média ponderada de 3 ofertas · 100% do mix". CEO vê de onde o número saiu sem abrir outra tela.',
      'Botão "+ Nova oferta" voltou pra paleta do RevOps (outline roxo). Não rompe mais a temperatura visual do card.'
    ]
  },
  {
    version: 'V40.7.19',
    date: '2026-06-19',
    title: 'Demo: 9 endpoints de sistema mockados — console limpo + Health 9/9',
    bullets: [
      'O console do demo tava cheio de 500 Internal Server Error em endpoints que dependem de tabelas inexistentes no tenant demo: notifications-list, notifications-daily-summary, notification-preferences, pins-list, reconciliation-alerts, efficiency-summary, governance-closings, visitors-pending-counts, google-ads-config.',
      'Adicionado branch demo em cada um. Sininho zerado (estado válido vazio), Pins vazio, Alertas RD zerados, Eficiência rica (LTV/customers/refunds coerentes com Velocity), Governance Closings vazio, Identity Resolution sem pendências, Google Ads não conectado.',
      'Mocks centralizados em lib/demo-system-mocks.js pra evitar drift. Refator quando provider abstraction acontecer (backlog).',
      'Health card do menu deve voltar pra 9/9 (estava 6/9). Console fica limpo pra demo de CEO técnico que abre DevTools.'
    ]
  },
  {
    version: 'V40.7.18',
    date: '2026-06-19',
    title: 'Demo: Chopp em rota errada — LJ vira diagnóstico, não dashboard verde',
    bullets: [
      'Antes o demo tinha 3 produtos rodando a 80% da meta — visual bonito mas plano, não mostrava pra que o LJ serve. Agora 2 produtos rodam saudáveis (Pilsen e Weiss em ~80% da meta) e 1 está em rota errada (Chopp de Vinho em ~37%).',
      'Chopp Checkout: 960 → 440 vendas/mês. Receita realizada de R$ 69k cai pra R$ 31,7k contra meta de R$ 86k. Cancelamento + chargeback levemente piores (sinal de problema no ciclo).',
      'Chopp Velocity: 190 → 88 PDVs ativos. Conversão de 15.8% → 7.3% (abaixo do benchmark B2B de 10%). Velocidade R$ 304/dia → R$ 141/dia. Máquina rodando devagar.',
      'Chopp Mapa da Receita vermelho: "Receita trimestral" current R$ 207k → R$ 95k (vs target R$ 259k); "Top 50 ativos" 12 → 6; "Embaixadores ativos" 9 → 4; "NPS embaixador" 71 → 52; "Leads sommelier/mês" 32 → 18.',
      'Pilsen e Weiss inalterados — eles seguem rodando saudáveis. Demo conta agora: "Pilsen carro-chefe e Weiss em crescimento. Chopp ainda buscando lugar no Top 50/Michelin — o LJ aponta onde mexer."'
    ]
  },
  {
    version: 'V40.7.17',
    date: '2026-06-19',
    title: 'Demo: ajustes de coerência B2B nos números (Mapa × RevOps × Checkout × Velocity)',
    bullets: [
      'Mapa da Receita alinhado com Receita realizada: Pilsen "Receita trimestral" atual sobe R$ 480k → R$ 633k (3× R$ 211k/mês do Checkout); Chopp sobe R$ 95k → R$ 207k (3× R$ 69k/mês). Antes Mapa ficava abaixo do realizado e dava sensação de KR desatualizado.',
      'Weiss "Ticket médio por bar" desce R$ 2.400 → R$ 610 (target R$ 3.500 → R$ 750). Conta agora fecha: 165 bares × R$ 610 ≈ R$ 100k/mês do Checkout. Antes a multiplicação dava 4× a receita real.',
      'Velocity reinterpretado como B2B: Customers = PDV ÚNICO ATIVO no mês (não transação). Pilsen 1.920 PDVs × ~5 pedidos = 9.600 vendas. Benchmarks atualizados (conv 10% B2B, ciclo médio 21d).',
      'Ciclo Chopp Vinho sobe 18 → 45 dias — coerente com vender pra Top 50 / restaurantes Michelin (validação de produto leva mais tempo).',
      'Leads dobrados: Pilsen 70 → 250, Weiss 50 → 150, Chopp 30 → 60. Tela "Leads" do produto deixa de parecer vazia vs KRs em milhares.',
      'Checkout com nomes B2B: transações agora aparecem como "Bar do Toninho — Antonio Silva", "Adega Centro SP — Marcos Oliveira", "Restaurante Mani SP — Vitória Araujo". Não tem mais "Marina Silva pagou R$ 22 via PIX" — toda a narrativa do tenant (PA/ICP/KRs em "bares parceiros") agora bate com quem aparece no checkout.'
    ]
  },
  {
    version: 'V40.7.16',
    date: '2026-06-19',
    title: 'Demo: RevOps & Velocidade decomposto por produto (V × C × T / Ciclo)',
    bullets: [
      'A tela RevOps & Velocidade ficava em loading infinito porque dependia de tabelas tracker (lj_visitor_touchpoints) + Hotmart (lj_hotmart_purchases) que não existem no demo.',
      'Branch demo no /api/pipeline-velocity-summary: retorna Visitas / Customers / Ticket / Ciclo coerentes pros 3 produtos — Pilsen 12k visitas → 950 customers (8% conv) → R$ 22 ticket / 5d ciclo; Weiss 4.5k → 380 (8,5%) → R$ 28 / 9d; Chopp 1.2k → 95 (7,9%) → R$ 72 / 18d.',
      'Visitas/customers também distribuídos por campanha pra agregação por produto bater.'
    ]
  },
  {
    version: 'V40.7.15',
    date: '2026-06-19',
    title: 'Demo: Mapa da Receita + Audiência + 150 leads pros 3 produtos',
    bullets: [
      'Mapa da Receita populado pros 3 produtos: visão de longo prazo, 9 donos das frentes (Marina/Rafael/Beatriz no Pilsen, Júlia/Thiago/Camila no Weiss, Eduardo/Fernanda/André no Chopp Vinho), 6 KRs por produto (2 por área Marketing/Vendas/CS) com meta vs atual realistas mostrando operação rodando abaixo da meta.',
      'Audiência composicional preenchida: cada produto tem PA (Persona Aspiracional) com 3 perfis, ICP com 3 tiers e BP com 2 personas — coerentes com o perfil (Pilsen popular B2B2C, Weiss premium gastronômico, Chopp Vinho alta gastronomia).',
      '150 leads fictícios distribuídos nas ações dos 3 produtos (Pilsen 70 / Weiss 50 / Chopp 30), com lifecycle (subscriber→customer), score, cohort, eventHistory básico. ~30% conversão pros lifecycle=customer.',
      'Endpoint admin /api/admin-add-demo-mapa-audiencia-leads aplica tudo numa chamada. Aceita master ou próprio demo. Retorna newState pra evitar race com auto-save.'
    ]
  },
  {
    version: 'V40.7.14',
    date: '2026-06-19',
    title: 'Demo: fix da distribuição de conversões nas ações',
    bullets: [
      'O FlowResolutionEngine usa a primeira stage do flow pra definir o volume inicial (current). Setando manualConverted só na última, o Math.min(current=0, X) zerava o reportado.',
      'Agora o endpoint /api/admin-add-demo-conversions seta manualConverted em TODAS as stages, garantindo que cada cascata propague o valor e a última stage (que o engine reporta como `converted`) bata com o target distribuído.'
    ]
  },
  {
    version: 'V40.7.13',
    date: '2026-06-19',
    title: 'Demo: vendas realizadas distribuídas nas ações dos 3 produtos',
    bullets: [
      'O card "Vendas Reais (convertidas)" do Resultado Consolidado lê do funil das ações (flowConfig[última_etapa].manualConverted), não do Hotmart. Por isso ficava em zero mesmo com checkout populado.',
      'Endpoint admin /api/admin-add-demo-conversions distribui as vendas realizadas (Pilsen 9.600 / Weiss 3.600 / Chopp 960) nas ações de cada produto, com peso maior pra Vendas-BOF, médio pra CS-MOF e menor pra Marketing-TOF — distribuição realista de onde a conversão acontece.',
      'Resultado Consolidado, RevOps e Mapa da Receita passam a refletir essas conversões automaticamente porque ambos leem do mesmo engine.'
    ]
  },
  {
    version: 'V40.7.12',
    date: '2026-06-19',
    title: 'Demo: vendas chegam no Resultado Consolidado (Faturamento Real + Vendas Reais)',
    bullets: [
      'O endpoint /api/forecast-realized-summary agora retorna mock pro demo, espelhando o que o Dashboard de Checkout mostra. Faturamento Real e Vendas Reais (convertidas) dos 3 produtos aparecem populados em Resultados.',
      'Volume calibrado em 80% das metas RevOps (Pilsen 9.600 / Weiss 3.600 / Chopp 960) — operação visível como "rodando bem", próximo da meta mas ainda com gap pro fechamento do mês.',
      'Checkout dashboard reajustado pra ficar coerente: mesmas projeções nas duas telas, mesmos números, sem disparidade entre o que cliente vê em Dashboard > Checkout e Resultados.'
    ]
  },
  {
    version: 'V40.7.11',
    date: '2026-06-19',
    title: 'Demo: dashboard de Checkout populado com vendas fictícias dos 3 produtos',
    bullets: [
      'Tab Checkout do Dashboard agora mostra vendas simuladas dos últimos 30 dias: ~4.230 vendas aprovadas, R$ 125k em receita, ticket médio coerente por produto (Pilsen R$ 22 · Weiss R$ 28 · Chopp R$ 72).',
      'KPIs completos: aprovadas, recusadas, reembolsadas, chargeback, boletos pendentes + breakdown dos 7 principais motivos de recusa.',
      '50 transações fictícias na lista + série temporal de 30 dias pro gráfico. Realista pra cervejaria operando online em paralelo com vendas offline (bares/eventos).',
      'Aviso técnico: implementado como atalho enquanto o refator de "checkout provider abstrato" não rola (ver backlog). Hoje o LJ acopla nome "Hotmart" no endpoint — cliente novo com Stripe/Pagar.me/etc. precisaria de mock próprio também.'
    ]
  },
  {
    version: 'V40.7.10',
    date: '2026-06-19',
    title: 'Endpoint admin-add-demo-revops: retorna o newState pra evitar race com auto-save',
    bullets: [
      'Quando o endpoint gravava o RevOps no banco, o frontend tinha state em memória sem esses dados e em ~2s o auto-save debouncado mandava state vazio por cima — race.',
      'Agora o endpoint retorna `newState` completo no JSON. O caller atualiza App.state com isso imediatamente, e o próximo auto-save persiste o state correto em vez do vazio.'
    ]
  },
  {
    version: 'V40.7.9',
    date: '2026-06-19',
    title: 'Endpoints de seed do demo: aceitam o próprio user demo (não só master global)',
    bullets: [
      'Os 3 endpoints de populate do demo (produtos, restore-state, revops) estavam exigindo master global do LJ (felipealvesverde@gmail.com). Errado conceitualmente: o user demo@leadjourney.app é o owner do tenant Engenho Norte e deve poder popular o próprio tenant dele.',
      'Agora aceitam: master global OU o próprio demo@leadjourney.app. Da próxima vez que precisar imputar dados, basta logar como demo (sem precisar trocar de aba pra master).'
    ]
  },
  {
    version: 'V40.7.8',
    date: '2026-06-19',
    title: 'Demo: RevOps & Governança populado nos 3 produtos da cervejaria',
    bullets: [
      'Cerveja Pilsen, Cerveja Weiss e Chopp de Vinho agora têm RevOps configurado com projeção mensal, oferta principal, ticket weighted e estrutura de custos completa (S&M / CMV / G&A).',
      'Cada produto traz 3 grupos de custos com items realistas + 4 KPIs customizados (CAC, margem, recompra, NPS adaptados ao contexto) + 2 linhas extras de DRE (deduções/comissões).',
      'Faturamento bruto agregado simulado: ~R$ 476k/mês entre os 3 produtos. Demonstrável agora no card de RevOps & Governança como cervejaria operando.',
      'Endpoint admin /api/admin-add-demo-revops aplica tudo via uma chamada (master only). Idempotente.'
    ]
  },
  {
    version: 'V40.7.7',
    date: '2026-06-19',
    title: 'Impersonation: tenant alvo agora aparece populado direto (sem hack de localStorage)',
    bullets: [
      'Antes: clicar "Entrar como" no cockpit /admin abria nova aba mas o frontend usava o localStorage do master (vazio ou de outro tenant), descartando o state remoto. Tenant aparecia em branco e era preciso abrir DevTools pra limpar localStorage manualmente.',
      'Agora: quando a aba é uma sessão de impersonation (flag sessionStorage.lj_impersonation_session === 1), o state remoto é SEMPRE usado, igual ao mode demo. Local é ignorado por princípio.',
      'Próxima vez que você clicar "Entrar como" em qualquer tenant, ele vai carregar populado direto.'
    ]
  },
  {
    version: 'V40.7.6',
    date: '2026-06-19',
    title: 'Ferramenta admin: página de upload pra imputar snapshot no demo',
    bullets: [
      'Nova página /admin-restore-demo.html (só usável por master) recebe um arquivo JSON de snapshot local e grava direto no journey_state do tenant demo. Útil quando o restore via UI normal falha por causa de schema antigo ou outro motivo.',
      'Checkbox no fluxo aplica em paralelo o addon de 2 produtos (Cerveja Weiss + Chopp de Vinho) preparado em V40.7.5 — uma operação só imputa Pilsen + Weiss + Chopp ao mesmo tempo.',
      'Endpoint /api/admin-restore-demo-state valida master via JWT; nada além disso pode tocar o state.'
    ]
  },
  {
    version: 'V40.7.5',
    date: '2026-06-19',
    title: 'Demo Engenho Norte: Cerveja Weiss + Chopp de Vinho disponíveis pra ativar',
    bullets: [
      'A demo agora tem 2 novos produtos preparados (Cerveja Weiss e Chopp de Vinho), com 3 campanhas cada (Marketing/Vendas/CS) e 16 ações por produto distribuídas com origem/destino travados — TOF→MOF→BOF dentro do setor e handoffs entre MKT→Vendas→CS.',
      'Cada ação ganha 2 execuções: uma do ciclo atual (já rodando ou concluída) e uma do próximo (pendente no calendário). Total: 64 execuções fictícias com assignee (Marina/Rafael/Beatriz) e datas plausíveis.',
      'Os produtos NÃO entram automaticamente — endpoint admin /api/admin-add-demo-products precisa ser chamado pelo master pra injetar tudo no state do demo, sem mexer na Cerveja Pilsen existente.',
      'Idempotente: chamar de novo retorna "já aplicado". Pra reaplicar (sobrescrever), passar { "force": true } no body.'
    ]
  },
  {
    version: 'V40.7.4',
    date: '2026-06-19',
    title: 'Flow Builder: conectar agora é 1 click (em vez de 2)',
    bullets: [
      'Antes: clicar em "Conexão" só armava o card. Pra puxar o cabinho era preciso ainda clicar na bolinha verde do output. Eram dois cliques pra começar e mais um pra fechar — três no total.',
      'Agora: clicar em "Conexão" já puxa o cabinho da bolinha automaticamente, seguindo o cursor. Um click em outro card fecha a conexão. Dois cliques no total.',
      'Esc cancela a operação a qualquer momento (cabinho some, botão volta pro estado normal). Clicar em "Conexão" de outro card durante o modo ativo troca a origem do cabinho.',
      'O fluxo antigo (clicar na bolinha pra puxar) continua funcionando — quem aprendeu daquele jeito não perde nada.'
    ]
  },
  {
    version: 'V40.7.3',
    date: '2026-06-19',
    title: 'Aba Ações: select do "Criar ação" não filtra mais a tela inteira',
    bullets: [
      'Antes: escolher uma campanha no card "Criar ação" filtrava também o header (KPIs) e a lista "Ações plugadas" — os dois mundos estavam acoplados na mesma variável (selectedCampaignId).',
      'Agora desacoplados: o select do form "Criar ação" controla só o destino da nova ação (actionDraft.campaignId). KPIs e lista continuam respondendo à campanha "vista".',
      'Filtro de campanha novo, logo ao lado do título "Ações plugadas": dropdown discreto pra alternar a campanha-visão sem mexer no form do lado.',
      'Sem perder familiaridade: o filtro continua a mesma seleção global do FlowBreadcrumb e da aba Campanhas — só o select do form Criar ação que ficou independente.'
    ]
  },
  {
    version: 'V40.7.2',
    date: '2026-06-19',
    title: 'Pílula fantasma: faixa superior vira drag handle (segurar e arrastar)',
    bullets: [
      'O header da pílula fantasma (faixa "Atalho rápido · Space pra fechar") agora é uma área de arrasto: segure e arraste pra reposicionar a pílula sem fechar e abrir de novo em outro lugar.',
      'Cursor vira "mãozinha" no hover do header e "grabbing" enquanto arrasta. Clicar no botão x continua fechando normal (não inicia arrasto).',
      'Movimento é instantâneo (style direto, sem re-render); posição é gravada no estado só ao soltar o mouse pra não pesar.',
      'Ícone do header trocou pra grip-horizontal pra deixar visual da affordance.'
    ]
  },
  {
    version: 'V40.7.1',
    date: '2026-06-19',
    title: 'Sidebar: scrollbar escondida visualmente (mantém scroll funcional)',
    bullets: [
      'Em browser zoom ≥ 110% aparecia uma barra de scroll cinza vertical entre a sidebar e o conteúdo — eram logo + 11 tabs + Configurações/Sair + bloco Health (9 linhas) não cabendo nos 100vh da viewport.',
      'A barra agora é invisível em Firefox e Chromium, mas o scroll continua funcionando pela roda do mouse e pelas setas do teclado.',
      'A barra continuava aparecendo só quando o conteúdo realmente estourava — não era um bug, era a indicação visual do overflow. Esconder o indicador mantém o comportamento limpo enquanto preserva a acessibilidade do scroll.'
    ]
  },
  {
    version: 'V40.7.0',
    date: '2026-06-18',
    title: 'Flow Builder: 4 atalhos de teclado/mouse — Esc, Setas, Alt+scroll, Space',
    bullets: [
      'Esc agora cancela em cascata: se a pílula fantasma está aberta fecha ela; senão se há card armado pra conectar (botão "Conectando…") desarma; senão se há cards selecionados limpa a seleção; senão fecha a paleta inferior. Cada Esc dá um passo pra trás.',
      'Setas do teclado navegam o canvas: ← → ↑ ↓ panam 40px por toque. Shift+Setas pana 120px pra deslocamento rápido. Não interfere quando você está digitando num input.',
      'Alt + scroll do mouse aumenta/diminui o zoom direto no ponto onde o cursor está. O que estava sob o cursor continua sob o cursor após o zoom — sem perder o foco do que você estava olhando.',
      'Space abre a "pílula fantasma" na posição exata do mouse: mesmas 3 abas (Esteira / Segmentação / Mapa), totalmente navegáveis e funcionais, sem precisar levar o mouse até a base do canvas. Space de novo fecha. Esc também fecha.'
    ]
  },
  {
    version: 'V40.6.10',
    date: '2026-06-18',
    title: 'Flow Builder: dedup do card fantasma (cursor virava pointer + botão acendia)',
    bullets: [
      'Felipe achou o vetor cirúrgico: ao passar mouse no contorno do "fantasma rosa", o cursor virava pointer e o botão Conectada do card real acendia. Significa que existia um CARD INTEIRO duplicado em outra posição com todos os listeners ativos, não só um glow extra.',
      'Causa raiz suspeita: race condition entre setTimeouts que chamam ActionFlowBuilder.attach() → _drawCanvas. _drawCanvas removia o SVG antigo com querySelector (só o primeiro). Se houvesse 2 SVGs no root (por exemplo, duas chamadas a attach() em sequência muito rápida), sobrava um SVG órfão com todos os cards duplicados.',
      'Fix em camadas: (1) _drawCanvas agora usa querySelectorAll pra remover TODOS os SVGs antigos, não só o primeiro. (2) Fast-path do mouseDown verifica se algum data-node-id tem mais de um <g> e remove duplicatas mantendo o primeiro. (3) Adicionado console.warn quando dedup roda — Felipe pode abrir DevTools e ver se está sendo disparado.'
    ]
  },
  {
    version: 'V40.6.9',
    date: '2026-06-18',
    title: 'Flow Builder: fix da "sombra rosa deslocada" no card selecionado',
    bullets: [
      'Bug encontrado pelo Felipe via observação cirúrgica: o halo só aparecia em Produto/Campanha/Ação (não em Execução) e "sumia depois de um tempo sozinha". Isso era a pista crítica — não era halo CSS, era um SEGUNDO rect glow duplicado.',
      'Causa raiz: o glow externo criado pelo _renderNode (full re-render do canvas) NÃO tinha o atributo data-selection-glow="1", apenas o fast-path tinha. Quando user clicava pra selecionar, o fast-path tentava remover "rect[data-selection-glow]" — mas o glow do _renderNode não tinha esse atributo, então NÃO era removido. O fast-path então adicionava um NOVO glow, resultando em DOIS glows sobrepostos (mas em posições z-order diferentes: um na frente, outro atrás), criando a "sombra rosa deslocada". "Sumia sozinha" quando qualquer outra ação disparava _drawCanvas (full re-render), que destruía tudo e re-criava do zero.',
      'Fix: glow do _renderNode agora também ganha data-selection-glow="1". E o fast-path usa querySelectorAll (todos) em vez de querySelector (só o primeiro) pra remover glows residuais de qualquer origem.',
      'Por que só Produto/Campanha/Ação eram afetados e não Execução: Execução não tem botão "Conexão" nem output port, então o card termina mais "à esquerda" — o glow duplicado em posição z-order ficava menos visível por sobreposição com outros elementos. Em Produto/Campanha/Ação o efeito era óbvio porque havia mais espaço à direita pra a sombra deslocada aparecer.'
    ]
  },
  {
    version: 'V40.6.8',
    date: '2026-06-18',
    title: 'CRÍTICO: fix syntax error no changelog.js que bloqueava JS desde V39.9.3',
    bullets: [
      'BUG CRÍTICO encontrado por Felipe (debug via DevTools): linha 346 do src/core/changelog.js tinha "pan´ando" com apóstrofe não escapado dentro de string com aspas simples. JavaScript interpretava como fim de string em "pan´" e depois lia "ando" como identificador inválido — Uncaught SyntaxError. Esse erro existia desde V39.9.3 (2026-06-17) e bloqueava o carregamento de TODO o changelog.js, possivelmente cascateando pra outros scripts que dependiam de window.LJChangelog estar definido.',
      'Implicação: provavelmente os fixes que apliquei do V40.6.4 ao V40.6.7 (todos focados no halo do card selecionado do Flow Builder) NÃO chegavam a rodar por causa desse erro. Por isso o halo persistia mesmo após várias releases — não era o código que estava errado, era o syntax error impedindo o JS atualizado de carregar.',
      'Fix: trocar "pan´ando" por "dando pan" na linha 346. Verificação adicional rodada: nenhuma outra linha do changelog tem apóstrofe ímpar não escapado.',
      'Agora os fixes anteriores devem finalmente refletir: drop-shadow do tipo desligada no selecionado (V40.6.4), drop-shadow das badges contida (V40.6.5/6), filter off em camada dupla style+attribute (V40.6.7), glow externo sutil 1.5px.'
    ]
  },
  {
    version: 'V40.6.7',
    date: '2026-06-18',
    title: 'Flow Builder: nuke total do filter no card selecionado',
    bullets: [
      'Tentativa final pra eliminar o halo no card selecionado que persistiu apesar das V40.6.4/5/6. Aplicado em camadas:',
      '1) Dupla camada de "filter off" — antes só style.filter=none, agora style + attribute SVG. Algum caminho de CSS estava sobrescrevendo só a propriedade style. setAttribute("filter", "none") força nível mais alto.',
      '2) Glow externo ainda mais sutil: 1.5px stroke + raio +3px + opacity 50% (eram 2px / +4px / 55%). Presença mínima.',
      '3) CSS injetado pra desligar outline browser nativo no SVG do canvas. Algum browser pode estar mostrando focus-ring azul-ciano em SVG g element clicado.',
      'Se persistir após Ctrl+Shift+R, é cache do browser — tem que forçar reload sem cache.'
    ]
  },
  {
    version: 'V40.6.6',
    date: '2026-06-18',
    title: 'Flow Builder: fix-pra-valer halo das badges no card selecionado',
    bullets: [
      'Última camada do bug do halo. V40.6.5 desligou o drop-shadow grande das badges quando o card é selecionado, MAS só no _renderNode. O fast-path do mouseDown (que atualiza visual via DOM sem re-render) NÃO tocava nas badges — então clicar pra selecionar deixava as badges com o drop-shadow forte (14px) da renderização anterior. O halo colorido continuava vazando.',
      'Agora o fast-path também busca os g.flow-badge-static dentro do group e ajusta o filter conforme a seleção: contido (3px blur) quando selecionado, vibrante (14px blur) quando não. Os dois caminhos (render natural + fast-path) ficam coerentes.'
    ]
  },
  {
    version: 'V40.6.5',
    date: '2026-06-18',
    title: 'Flow Builder: fix halo colorido das badges vazando no card selecionado',
    bullets: [
      'Fix: halo colorido (rosa/azul/laranja) das badges de segmentação dentro do card vazava pra fora quando o card era selecionado. Causa: cada badge de seg tem drop-shadow colorido (blur 14px da cor da seg) pra criar nuance localizada — mas o blur de 14px sai do limite do card. Quando os outros cards estavam dimmed (V40.6.3 spotlight), o halo dele ficava mais aparente ainda.',
      'Quando o card está selecionado, drop-shadow das badges fica MAIS contida — só 3px de blur com opacidade reduzida. Suficiente pra manter a nuance da cor da seg sem o halo "explodir" pra fora. Quando desseleciona, drop-shadow forte volta normal pra mostrar a vivacidade das segmentações.'
    ]
  },
  {
    version: 'V40.6.4',
    date: '2026-06-18',
    title: 'Flow Builder: fix sombra borrando glow no card selecionado',
    bullets: [
      'Fix: ao clicar num card, a sombra escalonada (drop-shadow do tipo) borrava o glow externo da seleção e criava uma nuvem visual gigante ao redor do card. Causa: drop-shadow CSS é aplicada no group SVG inteiro, então o glow externo (renderizado como rect dentro do mesmo group) também ganhava a sombra blur de 12-20px, multiplicando o efeito. Agora a drop-shadow é desligada quando o card está selecionado — o glow externo já marca presença sozinho.',
      'Glow externo de seleção mais sutil: stroke 2px (era 3px), raio +4px (era +5px), opacity 55% (era 45%). Presença sem inchar. Quando o card é desselecionado, a drop-shadow escalonada volta normalmente.',
      'Mesmo fix aplicado no fast-path do mouseDown — antes só o _renderNode tinha a regra V40.6.4. Agora os dois caminhos são coerentes.'
    ]
  },
  {
    version: 'V40.6.3',
    date: '2026-06-18',
    title: 'Flow Builder: fix borda branca na seleção + Spotlight com árvore',
    bullets: [
      'Fix do bug que Felipe encontrou: ao clicar pra selecionar um card, ele virava com borda BRANCA grossa (4.5px) e os outros cards ganhavam um traço terra mais marcado. Causa: existia um "fast-path" no mouseDown (linha 1706) que atualizava o visual via DOM direto SEM passar pela regra atual do _renderNode. Esse fast-path estava com código pré-V40.6.0 (era da V39.12.1, quando a regra ainda era borda branca). Agora o fast-path reflete a regra atual: cor terra resolvida via nodeColor() + borda 1px + glow externo na cor do tipo no selecionado.',
      'Spotlight com árvore: quando você seleciona um card, agora os ANCESTRAIS dele (toda a cadeia até o Produto) ficam meio acesos (opacity 0.9) e os DEMAIS cards ficam apagados (opacity 0.35). Identifica visualmente a árvore que o card pertence — você bate o olho no card selecionado e a esteira inteira mostra o caminho até a raiz Produto. Transição suave 0.2s. Quando desseleciona, tudo volta a 100%.',
      'Helper interno _ancestorsOf(nodeId) sobe a cadeia via edges.toId === currentId até esgotar. Salvaguarda contra loop (max 64 iterações + Set de visitados). Funciona tanto no _renderNode normal quanto no fast-path do mouseDown.'
    ]
  },
  {
    version: 'V40.6.2',
    date: '2026-06-18',
    title: 'Flow Builder: paleta correta — terra/horizonte na hierarquia, setor só na Ação',
    bullets: [
      'Corrigindo V40.6.1: as cores Produto/Campanha/Execução estavam erradas. A regra cravada pelo Felipe em 2026-05-22 (Design Director, comentário V32.3.3) é clara: a hierarquia Produto→Campanha→Ação→Execução tem paleta PRÓPRIA — escala TERRA/HORIZONTE (bege amplo → marrom granular). Dessaturada. Respira como mapa de fundo. As cores semânticas (Marketing rosa, Vendas turquesa, CS azul) são vozes VIBRANTES reservadas pras áreas operacionais.',
      'Aplicação correta: Produto = bege claro #FCD9B6 (amplo). Campanha = bege médio #D4A574 (caminho). Execução = marrom claro #7A5A47 (chão). Campanha não é vinculada a Marketing — campanha é campanha, território próprio da hierarquia.',
      'Ação continua sendo a ÚNICA dinâmica: pega a cor do setor (Marketing rosa / Vendas turquesa / CS azul) porque Ação é o ato — merece a voz vibrante do setor que age. Trocar setor no modal repinta o card automaticamente. Default visual #A77B5B (marrom escuro original da escala) caso setor seja desconhecido.',
      'Resultado: a hierarquia inteira respira em terra dessaturada, e SÓ a Ação salta com a cor vibrante do setor — o ato vira o foco visual, exatamente como a lei Leonardo prescreve.'
    ]
  },
  {
    version: 'V40.6.1',
    date: '2026-06-18',
    title: 'Flow Builder: paleta semântica oficial + Ação por setor + Modo Protótipo global',
    bullets: [
      'Cores dos blocos do Flow Builder agora seguem a paleta semântica oficial do LJ — a mesma do Pulso da Receita na Home. Produto = roxo RevOps. Campanha = rosa Marketing. Ação = cor do setor (Marketing rosa / Vendas turquesa / CS azul). Execução = herda a cor do setor da ação parent (cascata cromática: a execução é o braço operacional da ação).',
      'Trocar o setor de uma Ação no modal de edição (Marketing → Vendas → CS) repinta o card automaticamente e propaga pra todas as Execuções vinculadas. A esteira agora conta uma história visual coerente do setor responsável.',
      'Borda dos blocos baixou de 2px pra 1px. Quem desenha o contorno agora é a sombra escalonada — onde a luz já trabalhou, a tinta vira excesso.',
      'Badge "PROTÓTIPO" individual saiu de todos os cards. No lugar, um aviso global "● MODO PROTÓTIPO" aparece no canto superior esquerdo do canvas quando há pelo menos 1 bloco não-salvo. A maioria dos blocos é protótipo — repetir em cada um virava ruído. Aviso único comunica o modo de trabalho com peso visual leve.',
      'Badges individuais permanecem só pra estados acionáveis: SALVO (verde — distingue o que já entrou no LJ) e INCOMPLETO (vermelho — sinaliza problema). Ambos refinados desde V40.6.0 com dot 3px + texto fino sem moldura.'
    ]
  },
  {
    version: 'V40.6.0',
    date: '2026-06-18',
    title: 'Flow Builder: passada visual (Leonardo) — paleta, profundidade, hierarquia',
    bullets: [
      'Linhas de conexão entre blocos saíram do magenta saturado pra azul-cobalto translúcido — agora a linha conecta sem competir cromaticamente com os blocos.',
      'Botão "Conectada (N)" no rodapé dos blocos saiu do verde brilhante (que colidia com a cor da Execução) pra cobalto neutro — confirmação não compete mais com a identidade de cor do bloco.',
      'Vinheta azul-marinho do canvas removida. Fundo agora é uniforme e silencioso, não chama atenção pra si.',
      'Header de métricas reorganizado: "X pendentes de salvar" virou pill âmbar separada (estado de risco precisa de destaque), métricas estruturais (blocos/conexões/esteira) ficam em cluster cinza neutro, "X selecionados" vira tag cobalto à direita.',
      'Botões do header redesenhados em hierarquia única: Salvar esteira é o único primário (verde + glow). Rascunhos, Carregar campanha e Ajuda viraram ghost neutro. Limpar perdeu o vermelho permanente — fica inerte com hover vermelho (destruição pede fricção, não convite). Fechar isolado por gap de 24px.',
      'Blocos: largura passou de 200px pra 240px e altura de 130px pra 150px. Nome ganha quebra automática em 2 linhas quando for longo — fim do "Criar Perfil da Empres" cortado. Limite por linha 24 caracteres com ellipsis só na linha 2 se exceder.',
      'Seleção de bloco trocou borda branca grossa por glow externo na cor do tipo (raio +5px, opacidade 45%) — o bloco selecionado realça respeitando sua identidade cromática em vez de virar destaque genérico.',
      'Profundidade escalonada Produto→Execução: Produto ganha sombra densa (enraíza), Campanha sombra média, Ação leve, Execução flutua quase sem sombra (folha no fim do galho). A cascata semântica vira topografia visual.',
      'Badge de estado (SALVO/PROTÓTIPO/INCOMPLETO) refinado: era moldura colorida grande, virou dot 3px + texto 7.5px sem fundo — comunica sem poluir.',
      'Pílula central (Esteira/Segmentação/Mapa) e cluster de zoom agora respiram 24px do canto (escala Fibonacci) e dividem a mesma linguagem visual: full pill + backdrop-blur + borda branca-15%. Zoom desceu pro canto inferior direito, irmão da pílula central. Lixeira de drag pra bottom-left.',
      'Nenhuma função operacional foi alterada: tudo que você sabia fazer no Flow Builder continua igual. É polish puro de percepção visual baseado no framework Visual Systems (Leonardo).'
    ]
  },
  {
    version: 'V40.5.1',
    date: '2026-06-18',
    title: 'Fix: alerta falso "ClickUp desconectado" no F5 quando a rede demora',
    bullets: [
      'Alerta de "ClickUp desconectado" no sininho parou de disparar erroneamente em F5 com rede lenta. Race condition: o NotificationSync rodava em 5s após boot e lia o valor inicial { connected: false } do estado antes do /api/clickup-config ter respondido. Resultado: cliente recebia alerta crítico mesmo com ClickUp conectado e funcionando, e Configurações mostrava conectado normalmente (porque a resposta chegou depois). Sintoma reportado pelo Sansone após V40.5.0.',
      'Fix: o NotificationSync agora espera o loadClickupStatus ter respondido pelo menos uma vez antes de checar conexão. Flag _clickupStatusLoaded marca a tentativa (sucesso ou erro de rede).',
      'Cooldown de 24h do LJEmitDedup garante que o alerta antigo (já emitido erroneamente) não rebombeia. Quem recebeu, basta marcar como lida no sininho.'
    ]
  },
  {
    version: 'V40.5.0',
    date: '2026-06-18',
    title: 'Polish de F5: sininho/badges/status de integração + state fields normalizados',
    bullets: [
      'Sininho de notificações agora hidrata no F5. Antes o badge ficava em 0 até você clicar no modal — agora aparece a contagem real no boot. Aplica também pras preferências de notificação.',
      'Contadores de pendências (badges de menu) carregam no boot. Antes ficavam vazios e enchiam só depois de você clicar em uma aba específica que disparava o reload.',
      'Alertas de Reconciliação RD↔LJ (V34.8) entram no F5. Antes só apareciam quando o cron de 15 min rodava — agora aparecem na hora.',
      'Status de Ga4, Google Ads e Hotmart agora carregam no boot (igual ClickUp já fazia desde V31.2.35). O Health Check (botão verde do header) deixa de mostrar "Não conectado" no F5 pra contas que TINHAM tokens salvos.',
      '3 state fields legados agora persistem corretamente entre F5: log de conversões RD (auditoria), timestamp do último sync RD Marketing (lógica de cooldown), área ativa do Mapa (cliente volta onde estava). 5 ids de modal/edição (editProductId, editCampaignId, coverageChipSelected, selectedResultCampaignId, strategicActionDetailModalId) classificados como UI volátil — não restauram modal aberto inesperado em F5.',
      'Sem mudança visual ou de fluxo. É polish de estabilidade — você só nota porque o F5 deixa de "resetar" pequenas coisas.'
    ]
  },
  {
    version: 'V40.4.1',
    date: '2026-06-18',
    title: 'Fix grave: botões de Configurações/Sair, menu Plugins e status de integrações voltam a funcionar',
    bullets: [
      'Bug crítico latente desde V40.1.0: duas funções de carregamento (gating de plugins e integrações) foram acidentalmente inseridas DENTRO de outra função (audienceWizardFinish) em appActions.js. Isso é syntax error em JS — o parser quebrava ali e tudo definido daquele ponto em diante (várias actions, modais, status, sair, etc) ficava indefinido. Sintoma aparecia conforme o cliente clicava em botões que dependiam de Actions inacessíveis. Funções movidas pro lugar correto entre audienceWizardFinish e openNewProductWithMapaPopup. Botão Sair, Configurações, status de conexões e menu de Plugins voltam a responder normalmente.'
    ]
  },
  {
    version: 'V40.4.0',
    date: '2026-06-18',
    title: 'Cockpit: gestão completa de usuários consolidada no card do Tenant + custo de IA visível',
    bullets: [
      'Card de cada Tenant agora tem 3 stats: Membros / Owner / IA gasta (somatório dos cost_usd Djow de todos os membros). Você vê o consumo Anthropic de Sansone, Mariano e qualquer cliente sem entrar em nada — basta bater o olho no card.',
      'Botão "Novo user" virou "Usuários" e abre um modal grande de gestão completa do tenant. Dentro: lista com avatar, role, pills de IA liberada/chave própria/reset pendente, custo de IA individual, último login. E pra cada usuário você consegue: liberar/cortar IA, trocar senha direto, forçar reset de senha no próximo login, tornar owner (rebaixa o atual pra gerente), remover do tenant (sem deletar o user).',
      '"Novo usuário" virou aba dentro desse mesmo modal — você cria sem sair do contexto do tenant. Senha inicial aparece no toast pra você repassar fora-de-banda.',
      'A aba "Usuários" lateral do cockpit foi removida (redundante agora). Tudo de gestão de usuário acontece dentro do card do tenant.',
      'Por trás: 3 endpoints novos (admin-tenants-ai-cost-summary, admin-tenant-set-owner, admin-tenant-remove-user). admin-tenant-users agora retorna custo de IA por user + total do tenant + flag de reset pendente. Gates de admin-set-user-password e tenant-member-reset-password ampliados pra aceitar operador LJ (não só master).'
    ]
  },
  {
    version: 'V40.3.1',
    date: '2026-06-18',
    title: 'Cockpit: Tenants em grid de cards',
    bullets: [
      'A tela "Tenants" do /admin saiu da lista vertical esticada e virou grid de cards (1 coluna no mobile, 2 no tablet, 3 no desktop). Cada card tem avatar com iniciais, faixa lateral colorida pelo status (ATIVO verde, DEMO âmbar), pills de status/DB, blocos de Membros e Owner com tipografia hierarquizada, e os 3 botões de ação (Entrar como em destaque full-width + Novo user e Plugar/Desplugar DB lado a lado). Bem mais leve de bater o olho e achar o cliente certo.'
    ]
  },
  {
    version: 'V40.3.0',
    date: '2026-06-18',
    title: 'Onda 5 do cockpit: usuários por tenant + liberação de uso da IA',
    bullets: [
      'Tela nova "Usuários" no cockpit /admin. Você seleciona um tenant e vê a lista completa dos usuários cadastrados nele — quem é owner, quem é gerente, quem é usuário comum, último login de cada um. Sansone, Mariano e qualquer cliente com vários acessos aparece aqui sem precisar mexer em SQL.',
      'Toggle de "IA liberada" por usuário. Quando você liga, o usuário passa a usar o saldo Anthropic do LJ pra Djow, enriquecimento, etc. Quando você desliga, o usuário precisa plugar a própria chave em Configurações → IA ou recebe mensagem clara de que precisa de liberação. Decisão sua, cliente por cliente, conta por conta.',
      'Card resumo mostra "Cadastrados" e "Com IA disponível" (soma quem tem saldo LJ liberado + quem já plugou chave própria). Você vê de bate-pronto a saúde de IA do tenant.',
      'Botão "Novo usuário" também presente nessa tela — não precisa mais voltar pra aba Tenants pra criar acesso pro time do cliente.',
      'Por trás: endpoint novo /api/admin-tenant-users (JOIN tenant_members + users + user_ai_credentials), gate do /api/users-toggle-master-ai ampliado pra aceitar operador LJ além do master. Sidebar do cockpit agora tem 6 abas: Tenants, Usuários, Plugins, Integrações, Cobrança, Snapshots.'
    ]
  },
  {
    version: 'V40.2.0',
    date: '2026-06-18',
    title: 'Ondas 3 + 4 do cockpit: cobrança manual por hora + gating de integrações por tenant',
    bullets: [
      'Cobrança manual por tenant. Tela "Cobrança" no /admin com cards de resumo (total pendente / total pago / horas totais), botão "Nova cobrança" pra registrar horas × valor/hora com data e descrição, lista de entries por data com botão "Marcar pago" reversível e apagar. Você controla a régua — sem Stripe, sem integração externa.',
      'Gating de integrações e APIs por tenant. Tela "Integrações" no /admin com seletor de tenant + lista do catálogo com toggle por integração. Pills mostrando tipo (EXTERNA ou API PÚBLICA) e status (GA / READY / DRAFT). Integrações DRAFT ficam ocultas pra tenants comuns mesmo se ativadas — útil pra você construir nova API no Claude/VSCode, marcar como ready quando tiver pronta, e só então liberar pra cliente X ou pra base toda.',
      'No LJ-cliente, o menu Configurações → Integrações respeita a liberação: cliente que tem o gating fechado pra ClickUp não vê o card do ClickUp, por exemplo. Cards legacy (sem entry no catálogo) continuam passando — backwards-compatible.',
      'Catálogo de integrações em lib/integrations-catalog.js + espelho frontend (mesma estrutura do gating de plugins). Pra adicionar nova: edita os 2 arquivos, marca como DRAFT enquanto constrói, vira READY/GA quando pronta.',
      'Por trás: 2 tabelas novas (tenant_billing_entries com total computado e tenant_integrations com upsert). 7 endpoints novos: 4 de billing (list, add, mark-paid, delete), 3 de integrações (admin-list, admin-toggle, my-list). Tudo idempotente e fail-open.'
    ]
  },
  {
    version: 'V40.1.0',
    date: '2026-06-18',
    title: 'Onda 2 do cockpit: plugins liberados por tenant',
    bullets: [
      'Tela nova "Plugins" no cockpit /admin. Você seleciona um tenant e vê a lista do catálogo com toggle por plugin (hoje só Flow Builder, mas a estrutura comporta os próximos). Ligar ou desligar é instantâneo — aplica na próxima vez que o cliente abrir o app.',
      'No LJ-cliente, o menu Plugins agora respeita a liberação. Cliente que não tem o plugin liberado vê uma mensagem clara "Nenhum plugin liberado pra este tenant — entre em contato com o LJ pra liberar acesso". Sem botão fantasma que dá erro.',
      'Operador LJ continua vendo tudo (override). Tenant que ainda não foi gerenciado vê o default do catálogo (hoje: Flow Builder ligado por compat retroativa — Sansone segue tendo acesso sem você precisar tocar).',
      'Por trás: tabela tenant_plugins gating com upsert. 3 endpoints novos: GET /api/admin-tenant-plugins (listar status por tenant), POST /api/admin-tenant-plugin-toggle (liga/desliga), GET /api/my-tenant-plugins (cliente consulta o próprio acesso no boot). Catálogo canônico em lib/plugins-catalog.js + espelho frontend.'
    ]
  },
  {
    version: 'V40.0.0',
    date: '2026-06-18',
    title: 'V40 — Separação dos dois mundos: LJ-cliente vira tenant comum, cockpit operacional ganha porta própria em /admin',
    bullets: [
      '**Arquitetura: dois apps, um repositório.** A V40 separa o LJ em duas portas distintas. A porta principal (`leadjourney.app/`) é experiência de cliente pura — todo mundo, inclusive o operador, entra como tenant comum. A porta nova (`leadjourney.app/admin`) é o **Cockpit Operacional**: ferramenta interna do LJ-business pra gerenciar os clientes que compraram. Antes os dois personas viviam no mesmo modal Configurações; agora cada um tem seu próprio HTML, scripts e UI.',
      '**Cockpit /admin — onda 1 entregue.** Sidebar com 2 telas (Tenants e Snapshots). Em Tenants você vê todos os clientes do LJ com status (Ativo/Demo) e DB (Control Plane / DB próprio), cria tenants novos com master inicial, cria usuários avulsos pra tenants existentes, e pluga/desplugar Postgres próprio. Em Snapshots você seleciona um tenant, tira backup do estado atual e restaura snapshots anteriores. Sem mais curl ou Postman pra essas operações.',
      '**Impersonation ("Entrar como Mariano").** Botão indigo em cada tenant. Click emite um JWT temporário de 2h e abre o LJ-cliente em nova aba já logado como tenant alvo. Sua sessão de operador continua intacta na aba do `/admin` — pode operar como Mariano, Joaquin e Sansone em 3 abas simultâneas. Banner amarelo fixo no topo de cada aba impersonada: "Você está operando como X em nome de Y — feche esta aba pra sair". Cada início de impersonation grava em `lj_impersonation_audit` (operador, tenant alvo, user alvo, timestamp).',
      '**Tenant do `felipealvesverde@gmail.com` vira comum.** As abas "Administrar Lead Journey" e "Tenants (Global Mode)" saíram do menu Configurações. Não tem mais botão de master vazando na UI de produto. Quem precisa fazer trabalho de operador entra em `/admin` — direto, sem passar por Configurações.',
      '**Renomeação semântica: `is_master` ganha companhia `is_lj_operator`.** A flag `is_master` continua existindo por compat (não dá pra mover schema do DB sem migração de dados em todos os tenants ao mesmo tempo). A nova `is_lj_operator` é semanticamente mais clara — operador do produto LJ, distinto de "dono do tenant cliente". Hoje as duas são sincronizadas via UPDATE idempotente no boot. JWT e `/api/auth-me` retornam as duas. Eventualmente `is_master` será descontinuada do lado cliente.',
      '**Boot dual: SPA cliente vs portal admin.** Servidor Express ganhou handler `/admin*` que serve um `index-admin.html` minimalista (Tailwind CDN + Lucide + 2 scripts do portal) antes do fallback do SPA cliente. Boot do `/admin` valida JWT, exige `isLjOperator`, e renderiza tela de login dedicada se faltar. Boot do `/` ganhou sentinel de impersonation: se URL tem `?impersonateToken=`, troca o JWT da aba antes de qualquer init e marca a sessão como impersonation pra acender o banner amarelo.',
      '**Endpoints novos do admin.** `POST /api/admin-impersonate-token` emite JWT temporário com `impersonatedBy` + `impersonate_target`. `POST /api/admin-create-tenant-user` cria usuário avulso pra tenant existente (com senha gerada que o operador repassa fora-de-banda). Os endpoints antigos (`tenants-list`, `tenant-create`, `tenants-plug-db`, `tenants-unplug-db`, `admin-deploy-snapshot`, `admin-restore-tenant-snapshot`, `admin-tenant-snapshots`) ganharam UI dedicada no cockpit em vez de viver só no Postman.',
      '**Banco: tabela `lj_impersonation_audit` cravada.** Toda impersonation deixa rastro pra auditoria futura: quem entrou como quem, em qual tenant, quando.',
      '**Próximo capítulo.** Onda 2 (sistema de Plugins liberados por tenant), Onda 3 (sistema de Cobrança manual por hora), Onda 4 (Liberação de APIs/Integrações por tenant) — todos backloggados pra construir conforme você for fechando novos clientes. A Onda 1 já roda hoje.'
    ]
  },
  {
    version: 'V39.13.0',
    date: '2026-06-18',
    title: 'Flow Builder ganha o selo do Mapa da Receita — funciona em rascunho e em produto salvo, sem duplicar engine',
    bullets: [
      'Slot Mapa da Receita da pílula off-canvas deixou de ser placeholder. Agora mostra o selo do produto da esteira atual (Inativo / Incompleto / Em Construção) calculado em tempo real pela mesma engine que alimenta o Mapa da Receita do LJ. Zero duplicação de lógica: o Builder consome `StrategicMapEngine.getMapSeal()`, ponto.',
      '5 mínimos cravados pra passar no selo: (1) Objetivo definido, (2) Owner em pelo menos 1 frente, (3) ≥3 KRs em CADA área (Marketing/Vendas/CS), (4) cada KR-mãe com pelo menos uma ação conectada, (5) cada ação conectada com pelo menos uma execução vinculada. Campanha é mínimo implícito (sem ela não dá pra conectar ação a KR). Acima disso, fortalecimentos contam: KRs além de 3, KRs-filhos confirmados, branches plugadas. O selo verde mostra "X de 5 mínimos · Y fortalecimentos" — passou no básico, mais é melhor.',
      'O selo respeita o rascunho. Se a esteira ainda não foi salva (Produto sem `linkedRealId`), o popup do Mapa mostra badge RASCUNHO e roda contra uma chave proto_<nodeId> dentro de `strategicMaps`. Você prototipa quantos rascunhos quiser e nunca precisa publicar pra ver os 3 primeiros mínimos (Objetivo, Owner, KRs). Os 2 últimos mínimos (ações conectadas + execuções) ficam travados em rascunho — só desbloqueiam ao Salvar esteira, com aviso "Salve a esteira pra liberar".',
      'Botão "Resolver" em cada ✗ do breakdown leva você ao lugar certo. Em rascunho: abre form INLINE no próprio popup (textarea pro Objetivo, 3 inputs de Owner, lista com "+ Adicionar KR" por área). Em produto salvo: pula direto pro Mapa da Receita real na etapa específica (vision / objectives / okrs / campaign / execution) via `openStrategicMapAtStep`.',
      'Migração automática ao Salvar esteira: o que você preencheu no rascunho (`strategicMaps[proto_<nodeId>]`) é transferido pra `strategicMaps[productIdReal]` no momento do INSERT do Produto. Nada se perde. Você pode prototipar TODO o Mapa de cabo a rabo no rascunho e, na hora de publicar, ele aparece pronto na aba do Mapa da Receita do LJ.'
    ]
  },
  {
    version: 'V39.12.2',
    date: '2026-06-18',
    title: 'Flow Builder polimento: drag não pega texto, dblclick volta, CTRL+SHIFT duplica, Delete apaga',
    bullets: [
      'Arrastar no canvas agora NÃO seleciona mais o texto do header/fora dele (irritante quando o cursor passava em cima de palavras durante o drag). CSS user-select:none global no modal, com override pra inputs/textareas/selects continuarem funcionando como esperado.',
      'Clique fora da pílula expandida fecha consistentemente — antes às vezes fechava, às vezes não. Bug: o handler de close estava só no "área vazia" do canvas; click em card não fechava. Agora qualquer click dentro do canvas fecha a pílula como primeira ação do mousedown.',
      'Duplo clique no card pra editar voltou a funcionar. Bug introduzido junto com a seleção: o click simples re-renderizava o SVG inteiro e destruía o group antes do 2º click chegar, então o navegador nunca completava o duplo-clique. Agora o click simples só atualiza o stroke via DOM (sem destruir o group), preservando o listener do duplo-clique.',
      'Tecla Delete (ou Backspace) apaga os cards selecionados. Regra: cards criados há menos de 10 segundos somem direto sem confirm (corrige drag/duplicação acidental). Cards mais antigos pedem confirmação antes de apagar. Se a seleção tem mistura (jovens + antigos), os jovens somem direto e os antigos pedem confirm geral. Não dispara dentro de inputs/textarea (Delete nesses campos só apaga texto).',
      'CTRL+SHIFT+arrastar duplica o card (mesmo tipo, mesmos dados, sem linkedRealId) e arranca drag do duplicado. Útil pra clonar uma Ação inteira (incluindo segmentações) sem refazer setor/canal/tipo. Produto NÃO pode ser duplicado — mostra aviso "Produto não pode ser duplicado, cada esteira tem 1 só".'
    ]
  },
  {
    version: 'V39.12.1',
    date: '2026-06-18',
    title: 'Flow Builder ganha atalhos de produtividade: CTRL+drag pra criar filho, click pra selecionar, ALT pra box-select, conexão em massa',
    bullets: [
      'Cada esteira agora aceita 1 Produto por canvas. Tentar criar um segundo Produto mostra aviso "Já existe um Produto no canvas — apague o atual ou abra um rascunho novo pra fazer outro produto". Alinha com o paradigma "1 esteira = 1 jornada de produto" e evita ambiguidade no Salvar.',
      'CTRL+arrastar num card cria automaticamente o filho da hierarquia já conectado: CTRL+drag no Produto cria Campanha conectada, no Campanha cria Ação conectada, no Ação cria Execução conectada. Você desenha a esteira inteira em fluência sem precisar voltar na pílula. CTRL+drag em Execução só mostra aviso (não tem próximo).',
      'Click simples no card agora seleciona ele — o contorno fica branco grosso pra mostrar que está selecionado. Click em outro card troca a seleção. Shift+click adiciona/remove da seleção. Click em área vazia do canvas limpa a seleção. Contador "N selecionados" aparece no header.',
      'Com pelo menos 1 card selecionado, ALT+arrastar no canvas desenha um retângulo de seleção. Ao soltar, ele pega TODOS os cards do mesmo tipo do já selecionado que estão dentro do retângulo. Exemplo: 1 Ação selecionada → ALT+arrastar por uma área com 3 Ações + 1 Execução → fica com as 3 Ações selecionadas (a Execução é ignorada). Útil pra selecionar múltiplos do mesmo nível.',
      'Conexão em massa: com múltiplos cards selecionados, clicar em "Conexão" em qualquer um deles arma TODOS de uma vez (botão mostra "Conectando N..."). Ao arrastar o conector pra um destino, cria as N conexões de uma vez. Hierarquia ainda é validada por conexão — se alguma falhar, mostra contagem de OK vs problemas.',
      'Arrastar um card que faz parte da seleção move TODOS os selecionados juntos (preservando offset relativo). Útil pra reorganizar grupos de cards de uma vez.',
      'ESC com a pílula expandida fecha ela (volta ao estado fechado). Listener global registrado uma vez quando o builder abre.',
      'Tudo isso documentado na seção Ajuda do builder.'
    ]
  },
  {
    version: 'V39.12.0',
    date: '2026-06-18',
    title: 'Flow Builder vira maquete completa: ICP, form de Ação, gate de ClickUp e Salvar all-or-nothing',
    bullets: [
      'Paradigma protótipo-vs-salvo cravado: cada bloco da esteira agora tem badge de estado visível (verde SALVO se já entrou no LJ, amarelo PROTÓTIPO se está pronto pra subir, vermelho INCOMPLETO se falta nome ou conexão). Hover na badge mostra o motivo. Substitui o × que ficava no canto e atropelava ao mover o card.',
      'Botão "Salvar esteira" agora é all-or-nothing: valida TUDO antes (todos os blocos da esteira, conexões hierárquicas, nomes preenchidos) e SE falta qualquer coisa, mostra a lista de problemas num alerta e NÃO toca em nada do LJ. Se passar, faz tudo de uma vez em ordem topológica (Produto → Campanha → Ação → Execução). Se qualquer parte explodir no meio, rollback completo via snapshot — estado do LJ volta exatamente como estava.',
      'Re-salvar bloco já salvo = UPDATE silencioso. Mudou o nome de uma Campanha no canvas que já entrou no LJ? Salvar de novo propaga a mudança sem duplicar nem perder vínculo. Vale pra Produto, Campanha, Ação e Execução.',
      'Modal de edição do Produto (duplo clique) ganhou seletor de Audiência (ICP) embutido. Click no pill abre o AudienceWizard de 4 passos do LJ — mas a configuração escolhida fica como RASCUNHO no bloco (não sobe pro produto real). Só vira product.audience quando você clicar "Salvar esteira".',
      'Modal de edição da Ação agora tem o form COMPLETO da tela "Criar ação" do LJ: Setor + Funil de origem, Canal (com "+ Adicionar Canal"), Tipo (com "+ Adicionar Tipo"), Destino setor + Destino funil, e o "Fluxo obrigatório resolvido automaticamente" calculado em tempo real via FlowResolutionEngine. As segmentações continuam na lista de remoção dentro do modal.',
      'Modal de edição da Execução tem GATE de ClickUp: se a execução já está salva no LJ (entrou via "Salvar esteira"), aparece botão azul "Criar/Atualizar tarefa no ClickUp" que abre o editor padrão de tarefa (datas, responsáveis, descrição). Se ainda é protótipo, mostra aviso amarelo: salve a esteira primeiro pra criar a tarefa no ClickUp.',
      'Pílula off-canvas ficou 80% mais larga horizontalmente (mais respiro entre botões) e o botão ativo cresceu pra 92px — "Segmentação" agora cabe sem cortar.',
      'Pílula expandida fecha automaticamente ao clicar fora dela: no header, num bloco do canvas ou em área vazia. Antes só fechava clicando no botão ativo.',
      'O × pra remover bloco saiu do canto superior direito (era atropelado por acidente ao mover o card). Agora a remoção fica num botão vermelho "Excluir bloco" DENTRO do modal de edição (duplo clique no card). Apagar bloco já salvo limpa só o desenho — não desfaz o que já entrou no LJ.'
    ]
  },
  {
    version: 'V39.11.1',
    date: '2026-06-18',
    title: 'Flow Builder: rascunhos salvos + badges fixas no card + pílula 20% maior com contraste',
    bullets: [
      'Rascunhos: novo botão âmbar "Rascunhos" no header do builder. Permite salvar um snapshot do canvas atual com nome (ex: "Lançamento Black Friday — esboço") pra continuar depois. Lista todos os rascunhos salvos com data e contagem. Abrir um rascunho substitui o canvas atual; apagar é confirmado. Rascunhos ficam persistidos no tenant.',
      'Badges no card de Ação agora são SÓ layout — não dá mais pra arrastar elas pra fora acidentalmente quando você está movendo o card. Pra remover uma badge, duplo clique no card de Ação abre o modal de edição: lá apareceu uma seção "Segmentações (máx 2)" com a lista de badges atuais e botão × pra remover cada uma.',
      'Pílula da navegação inferior 20% maior: botão ativo passou de 56px pra 68px (com ícone w-5 em vez de w-4), inativo de 48px pra 58px. Mais fácil de mirar e ler. Texto e ícone do botão ativo agora ficam pretos (antes ficavam brancos sobre fundo branco — viravam invisíveis).'
    ]
  },
  {
    version: 'V39.11.0',
    date: '2026-06-18',
    title: 'Flow Builder: navegação inferior virou pílula off-canvas + Mapa da Receita entra como 3º slot',
    bullets: [
      'O painel inferior que reduzia a área do canvas (Esteira + Segmentação) virou uma pílula flutuante off-canvas. Agora o canvas ocupa 78vh inteiros (era 58vh) e a navegação passa POR CIMA dele, não come espaço. O canvas vira protagonista sempre.',
      'Visual da pílula: barra escura compacta com 3 botões circulares. O botão ativo "salta" pra cima da pílula com background branco — sinaliza claramente onde você está. Inativos ficam discretos dentro da pílula.',
      'Click no botão ativo fecha o painel expandido (só pílula visível). Click em outro botão troca direto. Click no já fechado abre. Padrão de barra de navegação mobile aplicado pro builder.',
      'Mapa da Receita entra como 3º slot da pílula, ainda sem conteúdo dentro — placeholder "Em breve" quando você clica. O lugar fica reservado pra próximas ondas de funcionalidade.'
    ]
  },
  {
    version: 'V39.10.4',
    date: '2026-06-18',
    title: 'Flow Builder: animação fantasma→badge volta + nuance de cor agora é por badge (não pelo card todo)',
    bullets: [
      'Animação de volta: quando você solta o fantasma na Ação, uma cópia visual dele "voa" da posição original até o canto onde a badge vai ficar, encolhendo e fadendo. Implementação robusta: a animação acontece num overlay HTML position:fixed fora do SVG do canvas — assim ela sobrevive aos re-renders do canvas (que tinham quebrado a animação na V39.10.1).',
      'Nuance de cor mudou: antes era um tint geral no card inteiro com a cor da 1ª segmentação (sumia a 2ª se você tivesse duas). Agora cada badge irradia sua própria cor via drop-shadow CSS — a nuance fica localizada no canto onde a badge está. Com 1 badge, 1 halo colorido naquele canto. Com 2 badges, 2 halos de cores distintas nos cantos opostos do card.'
    ]
  },
  {
    version: 'V39.10.3',
    date: '2026-06-18',
    title: 'Fix: badges de segmentação agora aparecem DENTRO do card da Ação',
    bullets: [
      'Bug grave da V39.10.0: as badges de segmentação estavam sendo adicionadas no `parent` (o layer geral dos blocos do canvas) em vez do `group` (o card específico da Ação). Resultado: ao aplicar uma segmentação, a badge era criada em world coord (16, 80) — flutuando solta em algum lugar do canvas, longe da Ação, possivelmente atrás de outros blocos. Parecia que "nada acontecia" porque você não via a badge no card.',
      'Fix de uma palavra: trocado `parent.appendChild(badgeG)` por `group.appendChild(badgeG)`. Agora a badge fica anexada ao grupo do card e segue o card quando você arrasta. Posição (16, 80) é relativa ao top-left do card, não do mundo.',
      'Se você tinha aplicado segmentações antes (que viraram badges órfãs no canvas), elas continuam no state — agora vão renderizar no lugar certo: dentro do card.'
    ]
  },
  {
    version: 'V39.10.2',
    date: '2026-06-18',
    title: 'Fix: lixeira agora apaga + fantasma vira badge na Ação (animação tirada por enquanto)',
    bullets: [
      'Bug clássico: na V39.10.0/V39.10.1 a lixeira estava escondendo a si mesma antes da checagem de "soltar em cima". A função `_hideTrash` setava display:none, e logo em seguida `_isOverTrash` lia esse display:none e respondia "não está em cima". Resultado: por mais que você soltasse o fantasma em cima da lixeira, ela ignorava. Fix: a checagem de "está sobre a lixeira?" agora vem ANTES de esconder ela.',
      'Bug correlato: jogar fantasma na Ação não virava badge. Causa provável: o callback assíncrono da animação (V39.10.1) entrava em race com o re-render do canvas — quando o callback rodava 280ms depois, o SVG já tinha sido recriado e a referência do fantasma virava órfã. Fix: aplicação síncrona direto (sem esperar animação). Soltou na Ação → badge aparece no card + fantasma some na mesma renderização.',
      'A animação fantasma→card foi removida por enquanto. Se ainda quiser, eu volto separado num próximo bump usando uma abordagem mais robusta (CSS transition em vez de RAF).'
    ]
  },
  {
    version: 'V39.10.1',
    date: '2026-06-18',
    title: 'Flow Builder: lixeira agora aparece, animação no fantasma e nuances de cor na Ação',
    bullets: [
      'Bug: a lixeira vermelha não aparecia durante drag de fantasma. Causa: estava DENTRO do canvas div, que era destruído cada vez que o SVG era redesenhado. Fix: o canvas agora preserva a lixeira durante o redesenho (remove só o SVG anterior, mantém os overlays). Lixeira também ficou maior (96x96px) e ganhou o label "APAGAR" embaixo do ícone — bem visível no canto inferior direito do canvas.',
      'Animação cravada no fantasma quando ele encontra uma Ação: ele encolhe + desliza pro local exato onde a badge vai aparecer, com fade-out suave (280ms, ease-out). Antes o fantasma sumia "do nada"; agora você vê ele virando badge.',
      'O card da Ação agora ganha uma nuance sutil da cor da primeira segmentação aplicada. Se você marcou Instagram, o card fica com um tom rosa sutilíssimo (opacity 7%); se marcou Meta Ads, fica com tom azul. Só nuance — não é cor cheia, é só pra dar o sinal visual de que aquela Ação tem identidade de canal.'
    ]
  },
  {
    version: 'V39.10.0',
    date: '2026-06-18',
    title: 'Flow Builder com guardrails de hierarquia + painel inferior + segmentação por canal',
    bullets: [
      'Guardrails de conexão cravados: Produto não tem porta de entrada (é começo de fluxo), Execução não tem porta de saída (fecha o ciclo), e a hierarquia Produto → Campanha → Ação → Execução é validada com toast claro quando você tenta conectar fora dela. Acabou o risco de salvar uma esteira inválida que daria pau nas abas do LJ.',
      'A paleta lateral à direita foi removida — agora tem um painel inferior full-width abaixo do canvas com duas tabs: ESTEIRA (Produto, Campanha, Ação, Execução em 4 botões grandes) e SEGMENTAÇÃO (3 subtabs: Canais Org, Canais Pag, Custom). Os blocos auxiliares antigos (Email, SDR, WhatsApp, etc) deixaram de existir como opção nova.',
      'Segmentação por canal: arraste uma seg da paleta (Instagram, Meta Ads, etc) pro canvas e ela vira um fantasma — um cartão colorido pontilhado que vive solto até você arrastar pra cima de uma Ação, aí vira badge no card da Ação. Máximo 2 badges por Ação. Drag direto da paleta pra uma Ação pula o fantasma e aplica direto.',
      'Pra remover uma badge: segura ela dentro do card da Ação e arrasta pra fora — vira fantasma de volta. Ou arrasta pra lixeira vermelha que aparece automaticamente no canto do canvas quando você está com um fantasma na mão.',
      'Custom: clique em "Nova segmentação" na tab Custom da Segmentação. Abre modal com nome + paleta de cores HTML5 nativa (milhões de cores via clique no quadrado). Salva permanente no tenant — fica disponível em todos os fluxos que você criar. Hover na seg custom mostra ícone × pra apagar do tenant.'
    ]
  },
  {
    version: 'V39.9.3',
    date: '2026-06-17',
    title: 'Flow Builder com canvas infinito + pan com mouse + render só da viewport',
    bullets: [
      'O canvas do Flow Builder agora é infinito. Antes era um retângulo fixo de 1400×720 com scroll; agora você pode espalhar os blocos em qualquer direção e em qualquer quantidade — coordenadas dos blocos podem ser livres em qualquer lado (incluindo negativo).',
      'Segure o mouse num espaço vazio do canvas e arraste pra mover a tela (estilo Figma/Miro). O cursor mostra grab/grabbing quando você está dando pan. Clicar e arrastar em cima de um bloco continua movendo o bloco (não a tela). Clicar e arrastar em cima de uma porta continua armando conexão.',
      'O canvas agora renderiza só os blocos que estão dentro da sua janela visível (com uma margem de segurança de 200px). Blocos que estão fora não são desenhados — performance fica leve mesmo com dezenas/centenas de blocos espalhados.',
      'Zoom expandido pra 25%–300% (antes era 50%–200%). O botão central da régua de zoom agora reseta zoom (100%) E posição da tela (volta pra origem 0,0) — se você se perdeu no canvas, clica nele pra voltar.'
    ]
  },
  {
    version: 'V39.9.2',
    date: '2026-06-17',
    title: 'Flow Builder: modal de Campanha simplificado — só nome',
    bullets: [
      'O modal de criação de Campanha no Flow Builder pedia setor (Marketing/Vendas/CS) e objetivo, mas no fluxo normal do LJ a aba Campanhas pede só Produto + Nome. Modal do Builder agora segue o mesmo padrão: só nome. O produto vem da conexão no canvas, setor entra com default Marketing, e o resto (owner, objetivo, status) você ajusta depois na aba Campanhas normalmente.'
    ]
  },
  {
    version: 'V39.9.1',
    date: '2026-06-17',
    title: 'Fix: blocos do Flow Builder não somem mais do canvas com o tempo',
    bullets: [
      'Bug do V39.9.0: ao criar um bloco da esteira (Produto/Campanha/etc), ele aparecia normal, mas depois de uns segundos sumia do canvas — e quando o cliente adicionava outro, o anterior reaparecia "duplicado". Causa: o SVG do canvas é desenhado via JavaScript depois do HTML montar, e qualquer atualização interna do app (auto-save, polling de notificações, qualquer outra ação clicada noutro lugar) redesenhava o container do canvas vazio sem repintar o SVG.',
      'Fix cravado no hook central de render: toda vez que o app re-renderiza, se o Flow Builder está aberto, o desenho do canvas é repintado automaticamente. Os blocos ficam visíveis o tempo todo, independente do que esteja acontecendo no app em background.'
    ]
  },
  {
    version: 'V39.9.0',
    date: '2026-06-17',
    title: 'Flow Builder ganhou a Esteira do LJ — desenha Produto → Campanha → Ação → Execução e salva',
    bullets: [
      'O Flow Builder do menu Plugins virou uma forma alternativa de criar a esteira normal do LJ. Você abre, desenha visualmente Produto → Campanha → Ação → Execução, salva, e essas entidades aparecem direto nas abas Produtos, Campanhas, Ações e Execuções — como se tivessem sido criadas pelos formulários normais.',
      'A paleta lateral agora tem 2 seções: ESTEIRA (Produto, Campanha, Ação, Execução — os 4 blocos que viram entidade real ao salvar) e AUXILIARES (os 10 tipos antigos: Email, SDR, WhatsApp, Webinar, LP, Checkout, CRM, CS, Canal, Custom — servem só como rascunho visual). Cada bloco da esteira tem um pequeno selo "SALVO" no topo direito quando já foi sincronizado com o LJ.',
      'Quando você clica num bloco da esteira na paleta, o modal de edição abre automaticamente pedindo os campos do tipo: Produto pede nome + recorrência; Campanha pede nome + setor + objetivo; Ação pede nome + setor + funil + objetivo; Execução pede só o título. Resto fica em defaults e você completa nas abas normais depois (audiência do Produto, OKRs da Ação, etc).',
      'Botão verde "Salvar esteira" no header do Builder. Faz topological sort: cria os Produtos primeiro, depois as Campanhas vinculadas via aresta a cada Produto, depois as Ações vinculadas via aresta a cada Campanha, e por fim as Execuções vinculadas via aresta a cada Ação. Validação em tempo real: se uma Campanha não está conectada a Produto (ou Ação a Campanha, ou Execução a Ação), o salvar é bloqueado com toast claro indicando exatamente qual bloco está solto. Re-saves não duplicam — blocos que já têm vínculo real só atualizam nome se foi mudado.',
      'Botão azul "Carregar campanha" no header. Modal lista todas as campanhas existentes agrupadas por Produto, com contador de ações de cada uma. Você seleciona uma → o Builder importa Produto + Campanha + todas as Ações + todas as Execuções como blocos pré-vinculados em layout horizontal, e você pode continuar a edição (adicionar mais ações, salvar de novo).',
      'O fluxo desenhado fica salvo no canvas entre sessões (próxima vez que abrir, blocos e conexões estão lá). Limpar canvas zera o desenho mas não desfaz o que já foi salvo nas abas do LJ. Produtos criados pelo Builder aparecem normalmente em RevOps & Velocidade — só precisam ter os KRs do Mapa da Receita plugados depois pra ficarem completos dentro do Mapa.'
    ]
  },
  {
    version: 'V39.8.0',
    date: '2026-06-17',
    title: 'Flow Builder virou plugin whitelabel — limpo e desvinculado de produto/campanha/ação',
    bullets: [
      'O plugin "Construir Fluxo de Ações" do menu Plugins virou "Flow Builder" — uma ferramenta de modelagem de fluxo genérica. Não puxa mais ações da campanha, não pede produto, não exige nada. Você abre, vê um canvas em branco e desenha do zero. O dropdown de "escolher campanha" antes de abrir o Builder foi removido.',
      'Painel lateral direito agora é uma paleta de tipos: clique em Email, SDR, WhatsApp, Webinar, LP, Checkout, CRM, CS, Canal, ou Custom — um bloco novo aparece no canvas com o tipo escolhido. Duplo clique no bloco abre modal pra renomear. Botão × no canto do bloco remove ele (e qualquer conexão que tinha).',
      'Botão "Limpar" no header zera tudo de uma vez (com modal de confirmação mostrando quantos blocos e conexões vão sumir). Permite recomeçar fluxo limpo sem ter que apagar um por um.',
      '15 bugs do builder antigo corrigidos: porta de destino agora cresce visualmente quando você arma a conexão (era pra crescer e não crescia); arrastar conexão e soltar fora de uma porta agora limpa o estado armado em vez de deixar pendurado; sair do canvas durante drag não deixa mais linha amarela fantasma; fechar o builder com algo pendente limpa tudo no caminho; botão Conexão ganhou hover; durante drag de bloco as linhas entre blocos não trocam mais de cor; microcopy da ajuda alinhada com o que existe na tela.',
      'O fluxo desenhado fica salvo no tenant (próxima vez que abrir, está lá igual). Independente de qualquer mudança feita em ações ou campanhas — o Flow Builder vive solo agora.'
    ]
  },
  {
    version: 'V39.7.2',
    date: '2026-06-17',
    title: 'Djow agora é persona viva sempre presente no card de Velocidade',
    bullets: [
      'O Djow voltou a aparecer em todos os cards de produto, mesmo quando o produto está no começo da jornada. Antes ele só costurava quando havia ≥ 2 capítulos cravados (Situação + Estrutura/Eficiência), e em produto recém-cadastrado simplesmente sumia. Agora ele é presença fixa do card — adapta a narrativa ao estado em vez de desaparecer.',
      '4 modos de narrativa cravados por número de capítulos com conteúdo: 0 = silêncio honesto ("Ainda em silêncio — o produto começa a falar quando o primeiro dado cair"), 1 = espera ativa identificando qual capítulo já está lendo e o que falta ("Por enquanto, só leio a meta declarada — sem tráfego rastreado nem venda confirmada"), 2+ = síntese algorítmica completa cruzando Forecast × Velocity × Capital (lógica antiga).',
      'Razão da volta: o Djow é o rosto da marca dentro do card. Sumir ele em estado parcial deixava o cliente sem narrador no momento mais importante (primeiro acesso). Aparecer com narrativa honesta sobre o que ainda não dá pra dizer é melhor que ausência.'
    ]
  },
  {
    version: 'V39.7.1',
    date: '2026-06-17',
    title: 'Card de RevOps & Velocidade ficou consciente do estado (Leonardo round 2)',
    bullets: [
      'A faixa "Como ativar" agora filtra passos já cumpridos. Antes mostrava sempre 4 passos rígidos — inclusive "Defina a meta de vendas" mesmo pra produto que já tinha meta declarada (conflito narrativo: a faixa pedia pra destravar Situação do mês enquanto Situação já estava renderizada logo abaixo). Agora os passos somem 1 a 1 conforme cada gatilho é cumprido (meta · canal de venda · tracking UTM · primeira venda).',
      'O header da faixa virou dinâmico: "Produto em ativação · 4 passos pra ligar a máquina" / "3 passos" / "2 passos" / "1 passo pra ligar a máquina". Quando 0 passos sobram, a faixa some inteira. Microcopy menos clínica que "produto sem dados ainda".',
      'O Djow só costura quando há ≥ 2 capítulos cravados (Situação + Estrutura, ou Situação + Eficiência, etc). Quando só 1 capítulo está cravado, Djow virava eco do bloco acima ("estoura -100% vs meta" repetindo o badge da Situação). Agora ele aparece quando tem narrativa de verdade pra costurar.',
      'O aviso âmbar "⚠ Defina CAC nas ofertas" dentro da Situação do mês some quando a faixa "Como ativar" está visível no topo (evita double-CTA competindo por atenção na mesma altura visual). Quando o produto está ativado e ainda falta só CAC, o aviso volta como CTA cirúrgico isolado.'
    ]
  },
  {
    version: 'V39.7.0',
    date: '2026-06-17',
    title: 'Card de RevOps & Velocidade refinado — 7 ajustes visuais (Leonardo)',
    bullets: [
      'Header do card não mente mais quando R$/dia = 0. Antes "R$ 0" aparecia em verde brilhante (mesma cor de "saúde") enquanto o miolo dizia "estoura -100%" em vermelho. Agora, produto zerado mostra header em cinza neutro — verde fica reservado pra quando há dinheiro real entrando.',
      'Hierarquia das 4 letras V × C × L / T invertida. Antes o rótulo grande no topo gritava mais que o valor pequeno embaixo. Agora o número é herói (font grande no centro), e "V · VISITAS" vira legenda discreta — o olho vai pro dado, não pro título.',
      'Os 4 "Saber mais" empilhados viraram só ícone "ⓘ" discreto. Antes 4 botões idênticos competiam por atenção em alturas paralelas, roubando peso do conteúdo. Agora ícone pequeno cinza no canto de cada bloco; tooltip ao hover, mesma função.',
      'Estado vazio parou de chorar 4 vezes. Quando o produto está 100% zerado (sem meta + sem tráfego + sem venda), o card mostra só a faixa "Como ativar" com 3 passos — sem 4 blocos repetindo "não tem dado" do seu jeito. Quando há parcial (ex: tem meta mas zero venda), só os blocos que têm o que dizer aparecem.',
      'Side accents internos suavizados. Antes cada bloco tinha border-l-4 saturado de cor diferente — virava mosaico em vez de composição. Agora border-l-2 com cor mais clara nos blocos secundários (Estrutura, Simulador, Eficiência ok, Djow); só Situação do mês mantém border-l-4 forte porque o semáforo é informação essencial.',
      'Plural inteligente substituiu "venda(s)" e "customer(s)" entre parênteses. Agora "nenhuma venda processada" / "1 venda processada" / "N vendas processadas", e "1 customer novo" / "N customers novos". Tique de planilha removido.',
      'Botão "▲ Recolher / ▼ Ver diagnóstico" centralizado embaixo virou chevron pequeno no canto superior direito do header — convenção UI esperada, onde o olho procura sem precisar pensar.',
      '"meses" no Payback (era "mês(es)") — outro plural-parens que sobrou.'
    ]
  },
  {
    version: 'V39.6.1',
    date: '2026-06-17',
    title: 'Fix: "Definir meta →" e "Defina CAC" agora abrem direto a aba Ofertas do produto certo',
    bullets: [
      'Os botões "Definir meta →" e "Defina CAC" no card de RevOps & Velocidade abriam só a aba RevOps na sub-tab Custos (padrão) e exigiam que você selecionasse o produto e clicasse em Ofertas manualmente. Agora levam direto pra aba Ofertas do produto certo — 3 cliques viraram 1.',
      'Mesma correção no card de Forecast × Realizado em Resultados — o botão "Ir pra RevOps" virou "Definir meta nas ofertas →" e leva direto pro lugar onde a meta vive.',
      'Engine: nova action openProductOffers(productId) que seta os 3 estados em sequência (activeTab=revops, revopsSelectedProductId=X, revopsWhitelabelActiveTab=offers).'
    ]
  },
  {
    version: 'V39.6.0',
    date: '2026-06-17',
    title: 'Onda A polida — transparência total de fonte + faixa "Como ativar" + 1 botão de refresh',
    bullets: [
      'Cada bloco do card de produto em RevOps & Velocidade ganhou "ⓘ Saber mais" no header. Clicar expande uma caixa com 4 seções padronizadas: 🔍 O que é, 🎯 O que move, 📡 De onde vem, 🛠️ Pra que serve. Transparência total — cliente sabe exatamente o que está olhando, qual decisão a métrica drives e qual a fonte de dado real.',
      'Quando o produto está 100% zerado (sem visitas, sem customers, sem meta declarada), aparece no topo do card uma faixa escura "Pra ativar este diagnóstico" com 4 passos numerados: 1) Defina meta, 2) Confirme canal de venda, 3) Ative tracking UTM, 4) Aguarde primeira venda. Em vez de 3 blocos falando coisas separadas, 1 lista única e clara.',
      'A engine de gargalo parou de destacar uma letra como crítica quando o produto está 100% zerado. Antes V=0 virava gargalo âmbar (V), o que confundia — agora produto zerado mostra todas as letras neutras e a faixa "Como ativar" assume a comunicação.',
      'Os 3 botões de refresh (A1/A2, A3, A4) viraram 1 botão único "🔄 Recarregar diagnóstico" no rodapé do card. Dispara as 3 leituras em paralelo + toast confirmando. Menos ruído visual, mesma função.'
    ]
  },
  {
    version: 'V39.5.1',
    date: '2026-06-17',
    title: 'Fix: botão "Definir meta →" agora abre a aba RevOps',
    bullets: [
      'O botão "Definir meta →" no bloco Situação do mês (RevOps & Velocidade) e o botão "Ir pra RevOps" no card de Resultados não respondiam ao clique. Causa: o método setTab é do App e não do Actions — chamada estava errada. Agora abrem a aba RevOps & Governança como esperado.'
    ]
  },
  {
    version: 'V39.5.0',
    date: '2026-06-17',
    title: 'Onda A tecida — Forecast, Velocidade e Eficiência conversam no mesmo card + Djow costurando',
    bullets: [
      'O card de produto em RevOps & Velocidade ficou um raio-x completo. Quando você expande, agora vê a história inteira em ordem narrativa: Situação do mês → Estrutura da máquina → Eficiência de Capital → Djow costurando os 3.',
      'No topo do card expandido entrou o bloco "Situação do mês": Meta declarada × Realizado × Projeção × Variância com semáforo (mesmo que vive em Resultados, mas agora sentado dentro do card de Velocidade pra conectar com o estrutural sem você precisar trocar de tela).',
      'Dentro do bloco da Situação do mês entrou a Calculadora de meta: "Pra bater os R$ X restantes, você precisa de Y customers novos (LTV R$ Z) × CAC R$ W = R$ K de mídia necessária". Conecta A1 (meta) com A4 (LTV/CAC) num cálculo único que CEO precisa.',
      'No fim do card entrou o bloco "Djow · A Costura": narrativa em prosa que combina os 3 diagnósticos. Se o mês vai estourar, ela aponta a raiz estrutural ("a raiz é conversão — tráfego pago não resolve esse mês, exige otimização de página"). Se a eficiência de capital é crítica, ela avisa antes de você decidir escalar tráfego. Se a base encolhe (NRR baixo), ela aponta o balde furado.',
      'Os 3 botões de refresh (A1/A2, A3, A4) ficam no rodapé do card pra você forçar reload de qualquer leitura quando precisar.',
      'A aba Resultados continua mostrando Forecast × Realizado (decisão de manter duplicação visual com a mesma fonte de dado). Cliente escolhe onde olhar: Resultados pra leitura operacional do funil + financeiro; RevOps & Velocidade pra modo estratégico completo.',
      'Fecha a costura da Onda A: as 4 leituras (A1/A2/A3/A4) agora viram 1 narrativa no card do produto, em vez de 4 instrumentos isolados.'
    ]
  },
  {
    version: 'V39.4.0',
    date: '2026-06-17',
    title: 'Eficiência de Capital — LTV, LTV:CAC, Payback e NRR num card só (fecha a Onda A do roadmap RevOps)',
    bullets: [
      'Quando você expande um produto em RevOps & Velocidade, agora aparece o bloco "Eficiência de Capital" abaixo do diagnóstico V × C × L / T. Mostra a Tríade de Eficiência do mercado (LTV / LTV:CAC / Payback / NRR) em régua compacta de 4 KPIs, cada um com semáforo próprio.',
      'LTV = valor médio de cada cliente ao longo da vida com você (soma de todas as vendas Hotmart aprovadas por customer, agregada). LTV:CAC compara com o CAC declarado nas ofertas — saudável ≥ 3:1 (cada R$ 1 investido pra adquirir devolve R$ 3+). Payback mostra em quantos meses o cliente paga o CAC investido nele (instantâneo pra produto one-time, mensalidade pra subscription).',
      'NRR (Net Revenue Retention) só aparece pra produto com recorrência detectada — mede se sua base atual está crescendo sozinha ou furando (cancelamentos + refunds nos últimos 30 dias dividido por customers ativos). Pra produto one-time, mostra "N/A — sem recorrência" honestamente, sem inventar número.',
      'Diagnóstico em prosa abaixo da régua adapta ao que tá frágil: "LTV:CAC em 1.8:1, abaixo do saudável — modelo destruindo caixa", "Payback de 18 meses, longo demais — exige capital de giro alto pra crescer", "NRR 92% — base encolhe 8% ao mês sem novos clientes, balde furado", etc.',
      'Quando o CAC não está declarado nas ofertas, LTV:CAC fica em branco com botão "Defina CAC" levando direto pra aba RevOps. Sem fonte falsa: o engine prefere não calcular do que mostrar número chutado.',
      'Pra modo CRM/híbrido, o bloco mostra "Em breve" — depende do Fechamento mensal declarado + cruzamento com RD pra fechar o caminho. Mesmo padrão dos outros A1/A2/A3 da onda.',
      'Fecha a Onda A do roadmap LJ 2.0 RevOps: A1 (Forecast × Realizado), A2 (Projeção fim do mês), A3 (Pipeline Velocity), A4 (Eficiência de Capital). Próximos capítulos: Onda B (Governança Comercial Blindada — Matriz de Alçada, Data Gates, Compelling Event, Account Mapping, Clawback).'
    ]
  },
  {
    version: 'V39.3.0',
    date: '2026-06-17',
    title: 'RevOps & Velocidade — raio-x da máquina por produto (Visitas × Conversão × Ticket / Ciclo)',
    bullets: [
      'Aba nova no menu lateral, logo abaixo de RevOps & Governança: "RevOps & Velocidade". Mostra a velocidade da operação (R$/dia que a máquina gera estruturalmente) decomposta nas 4 letras universais — V (Visitas únicas/mês) × C (Conversão visitor→customer) × L (Ticket médio) / T (Ciclo médio em dias).',
      'A lista mostra cards mini por produto: velocidade total + as 4 letras lado a lado. A letra que está mais fraca é destacada como gargalo (borda âmbar + ring). Clicar no card expande pra diagnóstico em prosa do Djow + simulador "e se eu dobrar X?".',
      'Diagnóstico em prosa adapta ao gargalo: se conversão está fraca, fala em otimização de página e prova social; se ciclo está longo, sugere nutrição automatizada e remarketing; se ticket baixo, propõe cross-sell e combo; se volume baixo, indica tráfego pago e SEO.',
      'O simulador mostra 4 cenários lado a lado: dobrar visitas, dobrar conversão, dobrar ticket, cortar ciclo pela metade — cada um com o impacto direto em R$/dia. Ajuda o CEO a escolher qual frente atacar antes de gastar dinheiro.',
      'Pra modo "Comercial via CRM" ou "Híbrido", o card mostra placeholder "Em breve" — Velocity em modo CRM depende do pipeline RD persistido + Fechamento mensal declarado (próximas ondas).',
      'Fontes 100% existentes: V vem do tracker (lj_visitor_touchpoints com campaign_id mapeado pra produto via campaign.productId), C vem do mesmo tracker (lj_visitors com entity_type=customer), L vem do Hotmart pull (últimos 90 dias), T é mediana de occurred_at − first_touch_at. Cache de 5 min.'
    ]
  },
  {
    version: 'V39.2.0',
    date: '2026-06-17',
    title: 'Forecast × Realizado nasceu — meta declarada, realizado lido e projeção fim do mês',
    bullets: [
      'Na aba Resultados, cada produto com canal de venda "Checkout" agora ganha o card Forecast × Realizado: Meta declarada × Realizado lido das vendas Hotmart processadas × Projeção pro fim do mês × Variância vs meta, com semáforo (verde se vai bater, amarelo se aperta, vermelho se não bate no ritmo).',
      'O diagnóstico aparece em prosa simples: "no ritmo atual de R$ X/dia, fecha em R$ Y", "falta R$ Z pra meta nos N dias restantes — precisa fechar R$ W/dia, X% acima do ritmo atual". Sem fórmula, sem aviso técnico — só o que o CEO precisa saber.',
      'Versão compacta aparece no card de cada produto na lista geral (faixa colorida com Meta · Realizado · Projeção lado a lado). Versão expandida com diagnóstico aparece ao abrir o produto.',
      'Pra produtos com canal "Comercial via CRM" ou "Híbrido", o card mostra placeholder "Em breve V39.3" — a próxima onda entrega leitura do Fechamento mensal declarado + cruzamento com RD pra fechar esses dois caminhos.',
      'Fontes 100% existentes: a meta vem das ofertas (RevOps → Ofertas), o realizado vem do webhook Hotmart que já roda, e a projeção é a conta simples R$ entrou × dias_do_mês / dias_passados. Cache de 5 minutos pra não martelar o banco.'
    ]
  },
  {
    version: 'V39.1.0',
    date: '2026-06-17',
    title: 'Definir Audiência ganha "Como esse produto vende?" — fundação pro Forecast × Realizado',
    bullets: [
      'No wizard de Definir Audiência (passo 2 — Modelo Operacional), entra uma pergunta nova: "Como esse produto vende?" com 3 opções — Checkout (página de venda tipo Hotmart/Eduzz/Stripe), Comercial via CRM (vendedor + contrato), ou Os dois caminhos (híbrido). A escolha define a fonte do Realizado em Forecast × Realizado e o ponto crítico que o tenant monitora automaticamente.',
      'Produtos criados antes da V39.1 não tinham esse campo. No próximo login, abre um modal bloqueante listando cada produto pendente — você responde um por vez (com barra de progresso) até todos estarem definidos. Não dá pra fechar sem responder; uma vez resolvido, o modal nunca mais aparece.',
      'A aba Resultados ganhou aviso âmbar nos cards e na visão do produto quando o canal de venda não está definido: "Forecast × Realizado bloqueado · Defina como esse produto vende". Clicar no aviso abre o wizard direto no passo 2.',
      'Próximo capítulo (V39.2): com canal de venda cravado em todos os produtos, o LJ vai mostrar Forecast × Realizado por produto na aba Resultados — Meta declarada × Vendas Hotmart processadas (pra checkout) ou × Faturamento declarado no Fechamento (pra CRM) × Variância × Projeção fim do mês.'
    ]
  },
  {
    version: 'V39.0.0',
    date: '2026-06-17',
    title: 'Master V39 — Estabilidade comprovada e telas finalmente respiráveis',
    bullets: [
      '🎯 O QUE FECHA O CICLO: a master V38 abriu o tenant compartilhado de verdade (state, integrações e operação colaborativa). O ciclo inteiro rodou em produção real sem incidente de APIs, sem perda de informação, sem login forçado e sem quebra de dado — a fundação ficou de pé. Em paralelo, a master entregou uma faxina completa nas telas operacionais: Produto, Campanha, Ação, Execução e Resultados ganharam identidade visual unificada e respiram. V39 nasce nesse marco: estabilidade comprovada + interface enxuta.',
      '',
      '═══ AUDIÊNCIA — peça central nova ═══',
      'Definir Audiência virou requisito no nascimento do produto. Wizard de ICP/PA/BP obrigatório, plugado no popup "Criar com Mapa" e no form "Criar sem Mapa". Audiência deixou de ser anexo e virou substrato.',
      'Motor de Fusão de Audiência ativado: Djow monta o quadro PA/ICP/BP em runtime, lendo os dados de quem efetivamente entrou na base. ICP, PA e BP deixam de ser pré-formulários estáticos — viram leitura viva da operação.',
      'Transmutador chegou nos Leads: cada pessoa é carimbada automaticamente como Suspect / PA / ICP / BP. Filtro disponível na tela de Leads, badge na pessoa, drill-down explicando o porquê do carimbo.',
      'ICP agora distingue B2B de B2C por sinais comportamentais (não só por padrão de email). Quadro de Audiência ficou enxuto, fundiu Step 4 e liberou campos custom pra clientes que precisam de eixos próprios.',
      'Roadmap da Campanha passou a ler audiência de verdade: tile de ICP virou composição real da campanha; insights do Roadmap viraram leitura ativa, com Djow opinando frase por frase.',
      '',
      '═══ EXECUÇÕES — viraram cidadão de 1ª classe ═══',
      'Execuções saíram do modal escondido dentro da ação e ganharam tela própria no menu lateral. Lista cross-action da campanha, criação direta no painel esquerdo, filtros próprios de Campanha + Ação no painel direito.',
      'Criar execução abre o mesmo modal completo de criação de tarefa do Mapa da Receita — responsáveis, prioridade, datas, tags, custom fields ClickUp e chat com Djow. Caminho único pra criar execução em qualquer ponto do produto.',
      'Card de Execução completo: badge real do status (custom statuses do ClickUp preservam label e cor que o cliente definiu lá), 3 mini-cards de progresso (Dias em aberto / Fechamento / Responsável), atalho "Ver no Mapa →", botão concluir reversível e engrenagem que abre edição completa com excluir embutido no rodapé.',
      'Menu de Fluxo Produto → Campanha → Ação → Execução → Resultados nasceu cravado em todas as 5 telas operacionais, em chevron 3D alinhado à estética da Home (sem cromado, com glow sutil).',
      '',
      '═══ FAXINA DE TELAS — Produto, Campanha, Ação, Resultados ═══',
      'Página Produtos repensada: Hero agregado com KPIs do portfólio, card foca no produto, form de criação enxuto. Saúde do Produto ganhou score 0-100, modal explicador com decomposição por área e giro de faca do Djow.',
      'Card da Campanha passou por faxina total: trilha de status com 4 badges clicáveis (sem ordem forçada), "Ações por área" agrupadas e centralizadas de verdade, formulários "Criar" e "Editar Campanha" reduzidos a 2-3 campos essenciais (Produto + Nome + Status).',
      'Card de Ação alinhado pixel-perfect aos cards de Produto e Campanha: mesma régua tipográfica, engrenagem padronizada no canto superior direito, Roadmap como atalho discreto no rodapé. Botões de Execução compactados e movidos pra coluna direita.',
      'Aba "Ações da campanha" passou por 3 rodadas de corte (grupos A, B e C): redundâncias removidas, KPIs reformulados, nova aba "Plugins", vocabulário "Execuções" cravado em todas as superfícies.',
      'Aba Resultados ganhou header dark unificado em todas as 4 views (productList, productOverview, campaignList, campaignOverview) — selo "Result Layer", descrição da camada, KPIs agregados (Produtos, Campanhas, Impactados, Conversão). Coerência visual do começo ao fim do menu.',
      '',
      '═══ MAPA DA RECEITA + SAÚDE ═══',
      'Cards de área (Marketing/Vendas/CS) viraram atalho direto pro Mapa Etapa 3. Score "X conectados" e "X KRs" sem cruzar — número limpo, sem ambiguidade.',
      'FIX CRÍTICO de Saúde: engine lia productKrs (KR-mãe) em vez de childKrs das branches V29 — score voltou a refletir a realidade do Mapa. "Pendente" no card de área agora só quando NÃO TEM KR, não quando falta ação.',
      '"Sair da edição" no Mapa passou a respeitar o setor (Marketing/Vendas/CS) e não a campanha — não joga o cliente fora do contexto que ele estava editando.',
      '',
      '═══ DJOW + FRAMEWORKS ═══',
      'KB do Djow saltou de V26 pra V38 — cérebro novo com a estrutura atual de tags, fluxos, audiência, RevOps e ICP. Status do Djow agora conta a KB inteira (não só a raiz).',
      'Djow cita CVO, CRO e RevOps com referência viva dentro do produto. Análise do quadro de audiência, leitura ativa do Roadmap e Assistente de Coleta de Audiência: o copiloto deixou de ser conselho genérico e passou a ler o estado real.',
      '',
      '═══ ESTABILIDADE COMPROVADA — o que NÃO quebrou ═══',
      'Zero incidente de perda de dado durante o ciclo (a tripla camada anti-perda V36.7-V36.8.3 segurou). Zero quebra de integração com ClickUp, RD, Hotmart, Google Ads ou GA4. Zero logout forçado por bug de auth. Zero migration que rodou em DB errado depois dos hotfixes V37.4.x.',
      'Dual-write de tenant_state legado ainda ligado por segurança — pronto pra ser desligado em V39.x assim que mais alguns dias de operação confirmarem a estabilidade.',
      '',
      '🔮 PRÓXIMO CAPÍTULO (V39.x): com a fundação estável e as telas enxutas, abre o salto pra LJ 2.0 RevOps — 4 ondas (Forecast & Governança Financeira → Governança Comercial → Loop & Coorte → CVO/ESG). Em paralelo: Score Motion Engine vivo substituindo a fórmula linear, motor composicional de Audiência (4 átomos × 5 operacional) e RD Fase 3 fechando a jornada bidirecional de tags. A V39 começa onde a faxina parou — agora a camada por cima.'
    ]
  },
  {
    version: 'V38.1.74',
    date: '2026-06-17',
    title: 'Mini-cards da Execução centralizados no card',
    bullets: [
      'O bloco dos três indicadores (Dias em aberto / Fechamento / Responsável) agora aparece centralizado horizontalmente no card de Execução, em vez de encostado à esquerda. Mantém a largura de 50% — só ganha respiro igual nos dois lados.'
    ]
  },
  {
    version: 'V38.1.73',
    date: '2026-06-17',
    title: 'Mini-cards da Execução voltam ao tamanho original e encolhem 50% só na horizontal',
    bullets: [
      'Os mini-cards Dias em aberto / Fechamento / Responsável voltaram ao formato empilhado original (label em cima, valor grande embaixo) com altura completa — não estão mais em formato tira.',
      'O conjunto dos três agora ocupa só metade da largura do card de Execução (lg:w-1/2), encostado à esquerda. Mantém respiro à direita e diminui o peso visual horizontal dos indicadores.'
    ]
  },
  {
    version: 'V38.1.72',
    date: '2026-06-17',
    title: 'Mini-cards da Execução em formato tira (label e valor lado a lado)',
    bullets: [
      'Os mini-cards Dias em aberto / Fechamento / Responsável agora ficam no formato tira: label e valor lado a lado em vez de empilhados, com altura reduzida a cerca de 24px. Card externo de Execução mantém o tamanho — só os indicadores ficaram bem mais compactos.',
      'Tipografia ajustada: label 8px, valor 10-13px, leading-none pra colar texto na linha. Bordas laterais 3px (era 4px) acompanhando o novo gabarito.'
    ]
  },
  {
    version: 'V38.1.71',
    date: '2026-06-17',
    title: 'Card de Execução: mini-cards 50% mais baixos, engrenagem própria e excluir dentro da configuração',
    bullets: [
      'Os três mini-cards (Dias em aberto / Fechamento / Responsável) ficaram 50% mais baixos verticalmente — número mais discreto, label preservada. O card como um todo respira melhor sem mudar a estrutura.',
      'O canto superior direito do card de Execução agora segue o padrão dos cards de Produto, Campanha e Ação: a badge do status (custom ClickUp ou padrão LJ) aparece ao lado esquerdo do botão de engrenagem.',
      'A engrenagem abre o modal completo de criação/edição de tarefa do Mapa da Receita já em modo edição — você ajusta nome, responsáveis, datas, descrição, prioridade, tags e custom fields ClickUp da execução existente.',
      'O botão de excluir saiu do card (não tem mais a lixeira inline) e foi pra dentro do modal de edição. Agora aparece no rodapé esquerdo do modal como "Excluir execução" — desce um nível de exposição pra evitar exclusão acidental.'
    ]
  },
  {
    version: 'V38.1.70',
    date: '2026-06-17',
    title: 'Card de Execução completo: badge de status, mini-cards de progresso, atalho pro Mapa e concluir reversível',
    bullets: [
      'O card de cada execução na aba Execuções agora exibe a badge real do status — quando a tarefa veio do ClickUp, o nome e a cor do status custom (parado, em revisão, aprovado, etc.) aparecem no card; quando é manual, vem do padrão do LeadJourney (Pendente / Em curso / Concluída / Bloqueada). Acabou a redundância: removemos a pílula genérica "EXECUÇÃO · PENDENTE/CONCLUÍDA" e a linha repetida com responsável/data — tudo passou pra blocos próprios.',
      'Três mini-cards apareceram no padrão dos cards de Produto, Campanha e Ação: Dias em aberto (conta desde a criação até hoje, ou até o fechamento se já concluída), Fechamento (mostra a data prevista enquanto pendente e a data real quando concluída) e Responsável (quem está tocando a execução).',
      'Botão "Ver no Mapa →" foi adicionado a cada execução, ao lado dos controles. Leva direto pra etapa Ações da campanha da execução no Mapa da Receita — mesmo atalho que existe nos cards de Ação.',
      'O botão de concluir virou reversível: depois de marcar como concluída, aparece o botão de reabrir (ícone ↺) — clicar volta o status pra pendente e zera a data de fechamento. Útil quando algo foi marcado por engano ou precisa voltar à fila.'
    ]
  },
  {
    version: 'V38.1.69',
    date: '2026-06-17',
    title: 'Adicionar execução abre o mesmo modal de tarefa do Mapa da Receita',
    bullets: [
      'O botão "Adicionar execução" da aba Execuções agora abre o modal completo de criação de tarefa do Mapa da Receita (com responsáveis, prioridade, datas, tags, custom fields ClickUp e botão Djow). Antes salvava só localmente; agora segue o mesmo fluxo das tarefas criadas a partir das ações no Mapa.',
      'O título digitado no painel de criação já vai pré-preenchido como nome da tarefa no modal — você só completa o que falta (descrição, responsável, data) e envia.',
      'Validação: o título da execução é obrigatório antes de abrir o modal. Sem título, o sistema avisa pra preencher primeiro.'
    ]
  },
  {
    version: 'V38.1.68',
    date: '2026-06-17',
    title: 'Criar ação / execução agora pede a campanha explicitamente + filtros na lista',
    bullets: [
      'No formulário de Criar ação, agora aparece um dropdown "Campanha" como primeiro campo — você escolhe explicitamente a campanha que vai receber a ação, em vez de depender da campanha que estava selecionada no contexto. Reduz risco de criar ação na campanha errada.',
      'No formulário de Criar execução, o dropdown "Campanha" foi adicionado acima do dropdown "Ação". Trocar a campanha re-filtra a lista de ações — só mostram as ações daquela campanha. Mesma intenção: evitar pluga execução em ação de outra campanha sem perceber.',
      'O bloco direito "Execuções" ganhou filtros próprios: dropdown Campanha + dropdown Ação (cascateados). Independentes do form de criação — você pode estar criando em uma campanha e visualizando execuções de outra ao mesmo tempo.'
    ]
  },
  {
    version: 'V38.1.67',
    date: '2026-06-17',
    title: 'Pente fino V2: 4 telas com header unificado + card de Ação enxuto',
    bullets: [
      'A aba Resultados ganhou o header escuro no mesmo padrão de Produtos, Campanhas, Ações e Execuções — com selo, descrição da camada e KPIs agregados (produtos, campanhas, impactados, conversão). Antes começava direto na lista, sem identidade visual de cabeçalho.',
      'Os headers de Campanhas, Ações e Execuções foram simplificados pra seguir exatamente o estilo do header de Produtos: selo + descrição geral da camada, sem título grande redundante (o título da página já vem do menu lateral). Vocabulário coerente em todos os menus.',
      'No card de Ação, os três mini-cards Leads / Score / Etapas diminuíram 20% — mais respiráveis e proporcionais ao restante do card.',
      'A aba "Ações via IA" do bloco de criação foi removida — geração via IA agora vive só pelo Djow (botão na coluna direita). Bloco "Base de leads · Abrir Importador" também saiu do form de criação: a importação de leads já acontece na Campanha, era redundância.'
    ]
  },
  {
    version: 'V38.1.66',
    date: '2026-06-17',
    title: 'Menu de Fluxo: full-width + estilo Home (sem cromado)',
    bullets: [
      'O Menu de Fluxo agora ocupa a largura inteira abaixo do header (na mesma proporção do header), em vez de ficar centralizado e compacto. Cada chevron usa flex:1, então as 5 setas dividem o espaço horizontal igualmente — quando o header é largo, as setas crescem horizontalmente, mas a altura fica fixa.',
      'O tom metalizado cromado da V38.1.65 saiu. Agora segue o estilo da Home (Pulso da Receita): cada chevron tem fundo translúcido suave na cor temática, texto na cor clara da paleta, e drop-shadow colorido externo dando glow. A seta ativa fica com fundo mais saturado, texto branco e glow mais forte. Inativas vibram suavemente nas suas cores e clareiam no hover.'
    ]
  },
  {
    version: 'V38.1.65',
    date: '2026-06-17',
    title: 'Menu de Fluxo vira chevron 3D industrial com 5 etapas (Produtos → Resultados)',
    bullets: [
      'O Menu de Fluxo foi refeito do zero como uma esteira de chevrons 3D industriais (estilo "process arrow" de dashboard SCADA/RevOps). Cada etapa é uma seta com ponta triangular à direita, entrada chevron à esquerda, gradiente vertical pra dar relevo (highlight no topo, base mais escura, reflexo inferior) e encaixe horizontal com a vizinha. Inativas em cinza-prateado cromado; ativa na cor temática da etapa.',
      'Subiu pra 5 etapas: Produtos (violet) · Campanhas (sky) · Ações (amber) · Execuções (emerald) · Resultados (rose). Cada etapa fecha um capítulo do ciclo do Revenue OS — Resultados entra como leitura final.',
      'O fluxo agora aparece em 5 telas (não 2): Produtos, Campanhas, Ações, Execuções e Resultados. Funciona como navegação alternativa ao menu lateral — clica numa seta e vai pra tela correspondente.'
    ]
  },
  {
    version: 'V38.1.64',
    date: '2026-06-17',
    title: 'Menu de Fluxo refeito — sem container, sutileza absoluta',
    bullets: [
      'O Menu de Fluxo introduzido na V38.1.63 tinha um container cinza translúcido com border e sombra que ficou pesado sobre o header escuro. Refeito: sem fundo, sem border, sem sombra no container. O fluxo respira no espaço entre header e blocos.',
      'Só a pílula do degrau ATIVO carrega cor cheia agora (ancora visual única). Estágios anteriores aparecem como texto+ícone discreto na cor temática, sem pill. Estágios futuros aparecem em cinza claro. Separador entre eles virou um ponto sutil (·) ao invés de chevron.'
    ]
  },
  {
    version: 'V38.1.63',
    date: '2026-06-17',
    title: 'Execuções viram tela própria + Menu de Fluxo Produto→Campanha→Ação→Execução',
    bullets: [
      'Nova tela "Execuções" no menu lateral, abaixo de "Ações". Antes execuções viviam escondidas dentro do modal "Ver Execuções" de cada card de ação — agora são cidadão de primeira classe com tela própria: KPIs no header (Total / Por status / Pendentes / Concluídas), criação direta (escolhe ação, dá título, adiciona), lista cross-action da campanha selecionada, ações rápidas (concluir / remover) e atalho pro Djow.',
      'Aba "Ações da campanha" foi renomeada pra simplesmente "Ações" — agora cada degrau do menu lateral é uma palavra curta.',
      'Estreia do "Menu de Fluxo" (Leonardo): faixa horizontal entre o header escuro e os blocos de conteúdo nas telas Ações e Execuções, mostrando Produtos → Campanhas → Ações → Execuções como pílulas conectadas por chevrons. Cada estágio tem cor própria: violet (estratégia), sky (orquestração), amber (operação), emerald (execução). O estágio atual fica em destaque com pill cheia colorida, os anteriores ficam em modo "contexto" (clicáveis pra voltar), os futuros ficam neutros mas também clicáveis. Funciona como navegação alternativa ao menu lateral.',
      'Card de Ação fica mais clean: os botões "Criar c/ Djow" e "Ver Execuções" saíram do card (mudaram pra tela própria de Execuções). Os 3 mini-cards Leads/Score/Etapas cresceram +35% pra ocupar o espaço com elegância — agora respiram melhor, com valor numérico em text-3xl e label maior.',
      'Bug fix carregado: o atalho "Roadmap" no card de ação agora abre o Roadmap na hora, sem precisar trocar de aba (causa era ponto de montagem faltando).'
    ]
  },
  {
    version: 'V38.1.62',
    date: '2026-06-17',
    title: 'Fix: botão Roadmap do card de Ação não abria modal na aba "Ações da campanha"',
    bullets: [
      'Quando o cliente clicava no atalho "Roadmap" dentro do card de ação, o estado interno mudava certo mas o modal não aparecia. Só abria quando o cliente saía pra outra tela (Campanhas/Produtos) — porque a aba "Ações da campanha" não estava montando o componente do Roadmap.',
      'Adicionado o ponto de montagem do CampaignFlowModal na tela de Ações (tanto no estado normal quanto no vazio). Agora abre na hora, sem precisar trocar de aba.'
    ]
  },
  {
    version: 'V38.1.61',
    date: '2026-06-17',
    title: 'Bloco da coluna direita do card de Ação cresce 20% padronizado',
    bullets: [
      'Os 3 mini-cards (Leads/Score/Etapas) e os 2 botões (Criar c/ Djow + Ver Execuções) viraram um bloco visual único na coluna direita do card de ação. Agora esse bloco inteiro foi escalado em 20% de forma proporcional: largura 300px → 360px, padding 12px/8px → 14px/10px, label 9px → 11px, valor numérico do mini-card subiu pra text-xl, botões saltaram de text-[9px] pra text-[11px] com ícones 12px.',
      'O crescimento mantém a hierarquia visual e o ritmo de tipografia coerente — sem nenhum elemento ficar deslocado em relação aos outros.'
    ]
  },
  {
    version: 'V38.1.60',
    date: '2026-06-17',
    title: 'Botões de Execução compactados e movidos pra dentro da coluna direita',
    bullets: [
      'Os botões "Criar Execuções via Djow" e "Ver Execuções" encolheram pra ~30% do tamanho anterior (text-[9px] uppercase, padding compacto, border 1px) e saíram da linha full-width. Agora vivem dentro da coluna direita do card, logo abaixo dos mini-cards Leads/Score/Etapas, alinhados em grid de 2.',
      'Texto do primeiro botão abreviou pra "Criar c/ Djow" (era "Criar Execuções via Djow"). O segundo continua "Ver Execuções".',
      'O card fica mais respirado verticalmente — sem aquela faixa grande de botões cortando o meio.'
    ]
  },
  {
    version: 'V38.1.59',
    date: '2026-06-17',
    title: 'Card de ação alinhado pixel-perfect aos cards de Produto e Campanha',
    bullets: [
      'A engrenagem de "Editar Ação" volta pro canto superior direito do card (botão circular branco com sombra), idêntica à engrenagem dos cards de Produto e Campanha. Padrão consistente em todas as telas.',
      'Pra liberar o canto superior direito sem sobrepor nada, os botões "Criar Execuções via Djow" e "Ver Execuções" desceram pra uma linha própria full-width logo abaixo dos mini-cards Leads/Score/Etapas. Mesma lógica do card de Produto, que tem "Criar Campanha" + "Mapa da Receita" no rodapé separado.',
      'O atalho "Roadmap" vira link discreto no canto inferior esquerdo, alinhado com o jeito que aparece no card de Campanha. Visual unificado.'
    ]
  },
  {
    version: 'V38.1.58',
    date: '2026-06-16',
    title: 'Engrenagem do card de ação sai do canto absoluto — vira atalho discreto no rodapé',
    bullets: [
      'A engrenagem absolute no canto superior direito do card sempre sobrepunha algum botão da linha do topo (Roadmap, Ver Execuções, Criar Execuções via Djow). Resolvida pela raiz: o botão sai do position absolute por completo.',
      'Agora vira "Editar" como atalho discreto (estilo cinza pequeno com ícone de engrenagem) no rodapé do card, ao lado do "Roadmap". Os dois ocupam espaço próprio no fluxo do layout — nunca mais vão atropelar nada.'
    ]
  },
  {
    version: 'V38.1.57',
    date: '2026-06-16',
    title: 'Roadmap do card de Ação agora é atalho discreto, igual ao card de Campanha',
    bullets: [
      'O botão Roadmap no card de ação estava como botão grande slate-900 no topo da coluna direita. Agora virou atalho discreto (link cinza pequeno com ícone de mapa, igual ao botão "Roadmap" que existe no card de Campanha).',
      'Posicionado no rodapé do card, alinhado à direita, na mesma linha das pílulas de etapas do fluxo. Acima do bloco estratégico colorido, conforme o pedido.'
    ]
  },
  {
    version: 'V38.1.56',
    date: '2026-06-16',
    title: 'Engrenagem do card de ação volta pro canto superior direito',
    bullets: [
      'A engrenagem de editar a ação volta pro canto superior direito do card (posição absolute), como estava antes. Na V38.1.55 ela tinha ido pra dentro do header da coluna 1, ao lado do label "Ação · Marketing", mas a leitura visual ficou pior — Felipe sinalizou.',
      'Pra evitar o problema original de sobreposição: em mobile (viewport < 1280px), a primeira coluna do card recebe padding-right de 56px pra não ter texto colidindo com a engrenagem. Em desktop, a engrenagem fica sobre a área dos botões da terceira coluna, que ficam alinhados ao bottom (justify-end) — sem overlap visual.'
    ]
  },
  {
    version: 'V38.1.55',
    date: '2026-06-16',
    title: 'Aba "Ações da campanha": Roadmap no card + KPIs reformulados + vocabulário Execuções',
    bullets: [
      'O botão "Ver Fluxo da Ação" virou "Roadmap" e abre o Roadmap da campanha (mesmo modal usado no card de Campanha). O antigo ActionFlowModal foi eliminado por completo — junto com 9 actions órfãs (open/close/toggle/save/edit/update/add/remove) e 3 campos de state. Sem código morto.',
      'A engrenagem de editar a ação saiu do canto absoluto (estava atropelando o botão Roadmap em viewports menores). Agora vive inline no header do card, ao lado do label "Ação · Marketing/Vendas/CS".',
      'O textarea "Descrição da Ação" saiu do form de criar ação. Tinha virado só dump genérico que ninguém preenchia direito.',
      'Os 4 KPIs do header escuro foram reformulados: (1) Ações total, (2) Por setor — mini-tile com Marketing/Vendas/CS lado a lado contando ações conectadas a cada área, (3) Execuções pendentes — somando todas as tarefas pendentes via ExecutionStatusEngine, (4) Conversão marcado como "Em breve" (dimmed).',
      'Vocabulário de "tarefas" virou "execuções" nos botões: "Criar Tarefas" → "Criar Execuções via Djow"; "Ver Tarefas" → "Ver Execuções". O seedPrompt enviado pro Djow também muda pra "Crie execuções para esta ação".',
      'Pendente: trazer a mecânica de criação de execuções inline (igual ao quadro do Mapa) pro modal de "Ver Execuções". Hoje o modal só lista; a mecânica de "Executar Ação" do print vai chegar numa próxima onda.'
    ]
  },
  {
    version: 'V38.1.54',
    date: '2026-06-16',
    title: 'Aba "Ações da campanha": 7 cortes do grupo C + validação de nome',
    bullets: [
      'O filtro "Filtrar por etapa inicial" agora só aparece quando a campanha tem 5+ ações. Com 1-4 ações o filtro era só ruído (não tinha o que filtrar de verdade).',
      'A linha pequena "Execução: X para executar - Y executadas" que aparecia abaixo do botão Ver Tarefas saiu. O modal de Tarefas já mostra o estado completo.',
      'A tag "⏱ sem cadência" só aparece agora quando a ação tem cadência setada. Sem cadência configurada, a tag fica oculta.',
      'A pílula colorida "✓ CONFIRMADA" / "⚠ PENDENTE" virou uma bolinha pequena (verde ou âmbar) ao lado do status. Mesmo sinal, sem ocupar uma pílula inteira.',
      'O warning "⚠️ Nenhum número confirmado é movido por essa ação ainda" foi removido. Quando a ação tem KR vinculado, mostra "🔗 Move: nome do KR" normalmente. Quando não tem, o card fica limpo (o atalho "Ver no Mapa →" já permite plugar).',
      'O subtítulo educativo "Cada ação possui canal, KPIs, fluxo transversal, leads, score, conexão e resultado próprio" foi removido da seção "Ações plugadas". Tutorial passivo que cumpriu seu papel.',
      'O botão "Abrir no Mapa →" foi renomeado pra "Ver no Mapa →" — só pra distinguir do botão "Conectar ao Mapa" que aparece quando a ação ainda não está vinculada a uma área estratégica.',
      'Validação reforçada: ao criar ou editar uma ação, o LJ bloqueia nomes com menos de 3 caracteres e placeholders genéricos ("Ação sem nome", "Sem nome", "Untitled", "Nova ação"). Também adicionado guard equivalente no tool create_action do Djow pra evitar que ações geradas via IA caiam como "Ação sem nome".'
    ]
  },
  {
    version: 'V38.1.53',
    date: '2026-06-16',
    title: 'Aba "Ações da campanha": limpeza do grupo B + nova aba "Plugins"',
    bullets: [
      'Três fragmentos de código morto saíram do módulo de Ações: a barra de navegação 4-step que ninguém renderizava, os 2 painéis V13 de "Configuração RD Email" e "Mapeamento de KPIs RD Email" (chips Fase 2/Fase 3 que eram stub pré-integração OAuth real) e a badge fantasma "Sincronizar RD". O backend de sync RD continua intacto pras ações já configuradas.',
      'O botão "Construir Fluxo" saiu do topo da seção "Ações plugadas". Não sumiu — virou um plugin de catálogo no novo menu Plugins.',
      'Estreou a aba "Plugins" no menu principal, depois de RevOps & Governança. Ela hospeda ferramentas avançadas fora do fluxo padrão Produto→Campanha→Ação. O primeiro plugin é "Construir Fluxo de Ações" — você escolhe a campanha no card e abre o Builder V15.1 (canvas drag-and-drop pra ligar ações entre si).',
      'O Builder em si está intocado: mesmo canvas SVG, mesmas conexões, mesma persistência. Só mudou a porta de entrada.'
    ]
  },
  {
    version: 'V38.1.52',
    date: '2026-06-16',
    title: 'Aba "Ações da campanha" enxuta — 7 cortes de redundância',
    bullets: [
      'O chip "ACTION OPERATIONAL LAYER" e a descrição educativa "Camada de execução: ações vinculadas..." saíram do header escuro. Sobrou só o título "Ações da campanha" + linha com campanha e produto + 4 KPIs.',
      'O bloco branco "Campanha selecionada" (que mostrava nome da campanha, produto e descrição genérica) saiu. Tudo isso já estava no header escuro acima. Pra trocar de campanha, use a aba Campanhas.',
      'No card de ação, o setor era marcado em 3 lugares (faixa lateral colorida, label "AÇÃO · MARKETING" e tag "📊 Marketing" no rodapé). A tag colorida foi removida — sobraram a faixa lateral e o label, que bastam.',
      'A linha cinza pequena "X leads · score médio Y · sem score · N etapas" saiu do header do card. Os mini-cards LEADS/SCORE/ETAPAS do lado já entregam esses números.',
      'O texto pequeno "Marketing MOF → Marketing MOF" saiu do header do card. As pílulas de etapas do fluxo abaixo do card mostram o caminho completo.',
      'O warning "Nenhum número vinculado — abra o Mapa pra plugar" saiu do header do card. O bloco estratégico abaixo já avisa quando uma ação não move nenhum KR.',
      'O badge "Sem vínculo de KR" / "Vinculada: X" do rodapé do card saiu. O próprio dropdown "KR da Campanha" já mostra o vínculo atual.'
    ]
  },
  {
    version: 'V38.1.51',
    date: '2026-06-16',
    title: 'Insights do Roadmap viram leitura real da campanha + Djow opinando',
    bullets: [
      'Os 4 cards abaixo do Mapa Geral da campanha (Handoff mais crítico, Melhor ação, Maior volume, Insight do Djow) eram fixos com números chumbados. Agora cada um lê o estado real das ações da campanha.',
      '"Handoff mais crítico" mostra o par origem→destino entre setores que tem a pior taxa de conversão somando todas as ações. Você vê o par (ex: Marketing BOF → Vendas TOF), a taxa e quantos leads cruzaram vs quantos chegaram.',
      '"Melhor ação" mostra a ação com maior conversão fim-a-fim (do impacto inicial até o destino) — nome da ação, canal e os números absolutos.',
      '"Maior volume" mostra o par origem→destino com maior volume absoluto de leads cruzando — o caminho mais alimentado da campanha.',
      '"Insight do Djow" virou interativo: clique em "Pedir análise ao Djow" e ele lê todas as ações da campanha, aponta gargalos e padrões entre elas, e sugere um próximo passo concreto. A resposta fica cacheada por campanha; você pode renovar quando quiser.'
    ]
  },
  {
    version: 'V38.1.50',
    date: '2026-06-16',
    title: 'Tile de ICP do Roadmap vira composição real da campanha',
    bullets: [
      'O tile de ICP no topo do Roadmap da Campanha mostrava só os rótulos C/B/A empilhados com travessão "—" — placeholder. Agora ele entrega a composição de verdade: 4 colunas lado a lado (Em rastreamento, Público-alvo, ICP, Buyer Persona) com a % e a contagem de leads da campanha em cada camada.',
      'A classificação roda em runtime pelo Transmutador de Audiência, lendo o schema fundido do produto e aplicando as ~40 regras de inferência sobre cada lead da campanha. O tile reflete o estado do funil de qualificação naquele exato momento — sem cache, sem manual.',
      'Quando a campanha está num produto sem audiência definida, o tile mostra um aviso "Defina a audiência do produto" com link direto pro wizard, ao invés de ficar com números falsos.',
      'O tile ganhou o dobro de largura (ocupou o espaço do antigo tile "Score Gerado", que estava marcado como "Em breve") pra caber as 4 colunas confortavelmente. O tile "Ações Ativas" continua marcado como "Em breve" do lado.'
    ]
  },
  {
    version: 'V38.1.47',
    date: '2026-06-16',
    title: 'Roadmap enxuto + fix do "ICP não definido" que não trocava',
    bullets: [
      'Bug grande resolvido no card de Produto: quando você editava a audiência de um produto já existente e salvava o wizard, a badge "ICP NÃO DEFINIDO" continuava amarela mesmo com o ICP gravado. Causa: a mutação no produto era feita por referência e em alguns cenários de reatividade não disparava o redraw direito. Agora o array de produtos é recriado com o produto atualizado já normalizado — badge vira verde na hora.',
      'No Roadmap da Campanha (antigo Fluxo Total da Campanha), o painel lateral "Fluxos por ação" saiu. Tomava 270px do canto esquerdo com cartões que repetiam o que o Mapa Geral já mostrava. Agora o Mapa Geral ocupa a largura toda — respira melhor e o foco volta pro fluxo de verdade.',
      'No mesmo Roadmap, os tiles "Score Gerado" e "Ações Ativas" foram desativados visualmente: ficam dimmed com selo "Em breve". Mostravam números fixos (+21) ou triviais (contagem de ações) que não traziam insight novo. Vão voltar quando tiver dado de verdade pra contar.'
    ]
  },
  {
    version: 'V38.1.46',
    date: '2026-06-16',
    title: 'Assistente de Coleta de Audiência — diagnóstico vira ação concreta',
    bullets: [
      'O drill-down do ICP "Por que esse lead virou X?" ganhou uma seção "Assistente de coleta" embaixo. Os campos que faltam não aparecem mais soltos — agrupam por ESTRATÉGIA de coleta: pergunta no formulário RD, tag manual do time, qualificação no RD, webhook do produto, ou enrichment externo (que avisa quando não está ativo).',
      'Cada grupo dá um artefato pronto pra copiar: as perguntas exatas pra colar no formulário, o script pro SDR aplicar tags, o trecho de webhook em Node.js, etc. Cliente não precisa pensar — só executar.',
      'Botão "Pedir ao Djow refinar pro meu setup" em cada grupo chama o agente, que adapta a sugestão lendo a Carta de domínio e a KB composicional + o contexto do produto (modelo de negócio e operacional).',
      'No card do produto, abaixo do sumário da audiência, apareceu uma barra "Saúde da coleta": % de campos cobertos no tenant e top 3 campos mais bloqueados (com % de leads sem o dado). Verde se >70%, âmbar se 40-70%, rosa se abaixo.',
      'Filosofia da implementação: ausência de sinal quase nunca significa "público ruim" — significa "ainda não coletamos esse dado". O Assistente transforma cada lacuna numa oportunidade de operação.'
    ]
  },
  {
    version: 'V38.1.45',
    date: '2026-06-16',
    title: 'ICP distingue B2B de B2C por sinais comportamentais (não só por email)',
    bullets: [
      'Antes o ICP separava B2B de B2C basicamente por uma régua: o domínio do email. Funcionava pra contas corporativas óbvias, mas falhava com empreendedores B2B usando Gmail e com funcionários acessando do celular pessoal.',
      'Agora o ICP de B2B olha 2 sinais novos no ICP: horário comercial (≥60% dos acessos do lead em dias úteis 8h-19h) e consumo técnico (tags com termos tipo whitepaper, ROI, integração, SLA). São pistas de uso profissional que aparecem mesmo sem cargo identificado.',
      'O ICP de B2C ganhou os 2 espelhos: horário pessoal (≥60% em noite ou fim de semana) e consumo emocional (tags com promoção, oferta, desejo, desconto). Discrimina perfil de consumo individual mesmo quando o email é corporativo.',
      'Os 4 sinais novos lêem do que o LJ já captura: eventHistory[] do tracker (timestamps) e tags do RD. Sem integração externa, sem enrichment pago. A discriminação fica mais fina sem custar dado novo.'
    ]
  },
  {
    version: 'V38.1.44',
    date: '2026-06-16',
    title: 'Quadro de Audiência: enxuga, funde Step 4 e libera campos custom',
    bullets: [
      'Wizard de Audiência agora tem 4 passos em vez de 5: o passo "Finalizar" foi fundido com o "Quadro de Audiência" — a contagem de obrigatórios já estava visível nos chips de cada camada, então a tela de revisão extra virou clique perdido.',
      'No card do BP, o campo "Comportamento de compra" foi encurtado pra "Comportamento" — antes truncava (...). Agora cabe na coluna em todas as resoluções.',
      'As notas semânticas do quadro (regras de Negócio e Operacional) viraram um acordeão "Ver regras desta combinação" que abre embaixo do chip de combinação. Só a nota AMBER de incompatibilidade fica visível por padrão — ela exige ação do cliente.',
      'Cada camada do quadro (PA / ICP / BP) ganhou botão "+ Campo custom" no rodapé. Cliente pode adicionar campos próprios pro Djow considerar — pergunta se é FIT (precisa bater critério) ou DADO (basta existir), e se é obrigatório ou opcional. Custom fields são salvos no produto e mesclam no schema final.',
      'Campos custom aparecem com borda violet sutil pra distinguir do padrão e podem ser removidos com ×.'
    ]
  },
  {
    version: 'V38.1.43',
    date: '2026-06-16',
    title: 'ICP integra com entityType + drill-down "por que esse lead virou X"',
    bullets: [
      'Atalho via entityType do LJ: se o lead já é "customer" no scoring V34, o ICP carimba direto como BP — não precisa bater 80% em todo o quadro. Se é "lead" identificado, sobe pra PA no mínimo. O ICP passa a respeitar a classificação que o LJ já fez por signals mais ricos do que só o quadro.',
      'Quando o atalho é aplicado, a badge mostra um raio ⚡ e o tooltip explica de onde veio.',
      'Clique na badge de camada no card do lead abre um modal de drill-down: cada campo obrigatório de PA/ICP/BP listado com ✓ (bateu) ou ✗ (não bateu), badge FIT/DADO, e percentual atingido por camada vs threshold.',
      'No rodapé do modal, uma leitura humana: se está em Suspect, sinaliza que "ausência de sinal costuma significar falta de coleta, não público ruim" — aponta onde investir em formulário/enrichment. Se atingiu BP, dá os parabéns.'
    ]
  },
  {
    version: 'V38.1.42',
    date: '2026-06-16',
    title: 'Transmutador chega na tela de Leads — badge na pessoa + filtro PA/ICP/BP',
    bullets: [
      'Cada card de lead na lista agora carrega uma badge da camada de audiência: SUSPECT cinza, PA violeta, ICP rosa, BP amber. Hover na badge mostra os percentuais por camada (ex: "PA 100% · ICP 75% · BP 50%").',
      'Apareceu uma chip-bar acima da lista: Todos · Suspect · PA · ICP · BP, cada um com sua contagem. Clica e a lista filtra. O contexto é "audiência vs o produto selecionado" — se nenhum produto selecionado, usa o primeiro com audiência configurada.',
      'O filtro respeita o Buscador de Perfil: você pode buscar "Carlos, agência, alta intenção" e depois clicar PA/ICP/BP pra cortar mais fino.',
      'Se nenhum produto tem audiência configurada ainda, a chip-bar e as badges não aparecem — fica invisível até o cliente fechar o primeiro wizard.'
    ]
  },
  {
    version: 'V38.1.41',
    date: '2026-06-16',
    title: 'Transmutador de Audiência — leads carimbam Suspect / PA / ICP / BP automaticamente (Onda 3)',
    bullets: [
      'Cada lead vinculado às campanhas de um produto agora passa por uma transmutação automática contra o quadro de audiência configurado: o LJ confere quanto da camada PA, ICP e BP o lead preenche e carimba a tag certa (lj-suspect / lj-pa / lj-icp / lj-bp).',
      'A régra do acúmulo é respeitada: ICP só atinge se PA também atingiu o limiar de 80%. BP só se ICP também. Não dá pra pular camada.',
      'Distinção fit vs dado: campo "fit" só conta se o dado existe E bate o critério (ex: cargo "Estagiário" não satisfaz "cargo decisor"); campo "dado" basta existir.',
      'O card do produto agora mostra uma barra empilhada com a distribuição da audiência: ex: "Audiência (24 leads): Suspect 10 · PA 8 · ICP 4 · BP 2". Cliente vê em tempo real onde a base está concentrada.',
      'Inferência vem 100% do que o RD Station já traz (cargo, segmento, score, tags, oportunidades, qualificação) + dados acumulados no LJ. Sem enrichment externo. Próximo passo: rerender automático no webhook do RD pra carimbo nunca ficar velho.'
    ]
  },
  {
    version: 'V38.1.40',
    date: '2026-06-16',
    title: 'Djow analisando o quadro de audiência (Onda 2)',
    bullets: [
      'No Step 3 do wizard "Definir Audiência", apareceu um botão "Pedir análise do Djow". Clica e o Djow comenta a combinação escolhida lendo a base de conhecimento de audiência (carta de domínio + KB composicional) e uma amostra agregada dos seus leads do RD.',
      'A análise é uma fala de consultor RevOps em 3-5 frases: aponta qual é o campo mais decisivo da combinação, comenta tensão/risco/erro clássico daquela fusão, e sugere um próximo passo concreto.',
      'Combinação rara (B2C+SaaS, C2C sem Marketplace etc.) o Djow avisa antes — humildade vale mais que esperteza.',
      'Sem leads importados? O Djow fala mesmo assim, baseado só na combinação. Quando você importar leads do RD, peça análise de novo e a fala fica mais aterrada.'
    ]
  },
  {
    version: 'V38.1.39',
    date: '2026-06-16',
    title: 'Motor de Fusão de Audiência — Djow monta o quadro PA/ICP/BP em runtime',
    bullets: [
      'O Step 3 do wizard "Definir Audiência" deixou de ser placeholder. Agora o LJ funde modelo de negócio + modelo operacional em runtime e mostra os 3 quadros (Público-Alvo / ICP / Buyer Persona) com os campos esperados em cada camada.',
      'Cada campo tem badge de tipo (FIT = exige bater critério; DADO = só precisa existir) e tooltip explicando origem do dado, critério e por que aquele campo importa naquela combinação.',
      'O motor já cobre as 20 combinações dos 4 modelos de Negócio (B2B/B2C/B2B2C/C2C) com os 5 Operacionais (SaaS/E-commerce/Agência/Marketplace/Freemium) — inclusive as raras tipo B2C+SaaS, que o motor ajusta sozinho (remove "cargo decisor" porque o consumidor é o próprio decisor).',
      'Combinações esquisitas como B2C+Agência ou C2C sem Marketplace recebem aviso amber no topo do quadro: "essa combinação é incomum, confirma?". Marketplace recebe aviso azul lembrando que ele impõe 2 lados sobre o negócio.',
      'Ao salvar, o produto guarda o schema completo (snapshot) com a contagem de obrigatórios por camada. Threshold default 80%. Próximo passo (onda 2): Djow vai ler seus leads do RD e propor refinamentos personalizados em cima desse quadro.'
    ]
  },
  {
    version: 'V38.1.38',
    date: '2026-06-16',
    title: 'Popup "Criar Produto com Mapa": botão "Definir audiência" no lugar do Tipo de produto',
    bullets: [
      'Mesmo padrão da V38.1.37 agora no popup estratégico-primeiro ("Criar Produto com Mapa da Receita"). O campo opcional "Tipo de produto" dá lugar a um botão "Definir audiência (ICP)" — obrigatório, no padrão amber/emerald.',
      'Fluxo: nomeia o produto, define o ICP pelo botão (wizard de 5 passos), aí o botão "Criar e ir pra Visão" cria o produto e abre direto na etapa Visão do Mapa.',
      'Se clicar em "Criar e ir pra Visão" sem ter definido a audiência, o wizard abre como fallback antes da criação (regra hard bloqueante da V38.1.36 mantida).',
      'Os 3 caminhos de criação de produto agora têm o mesmo tratamento de ICP: form sem Mapa, popup com Mapa, e edição de produto legacy pelo card.'
    ]
  },
  {
    version: 'V38.1.37',
    date: '2026-06-16',
    title: 'Form "Criar Produto sem Mapa": botão "Definir audiência" no lugar do campo Tipo',
    bullets: [
      'O campo "Tipo" no form "Criar Produto sem Mapa" deu lugar a um botão "Definir audiência (ICP)" — Tipo era redundante com o que o wizard já captura (Modelo de Negócio + Operacional).',
      'Fluxo agora é pré-submit: cliente define o ICP pelo botão (badge amber "Obrigatório" até preencher), aí o botão preto "Criar Produto sem Mapa" cria o produto direto com a audiência já gravada no draft.',
      'Quando o ICP estiver definido, o botão fica verde com a combinação escolhida (ex: "ICP B2B · SAAS") e atalho "Editar" pra ajustar antes de criar.',
      'Quem clicar em "Criar Produto sem Mapa" sem ter definido a audiência ainda vê o wizard abrir automaticamente — fallback de segurança da V38.1.36.'
    ]
  },
  {
    version: 'V38.1.36',
    date: '2026-06-16',
    title: 'Definir Audiência — wizard de ICP obrigatório no nascimento do produto',
    bullets: [
      'Produto agora nasce com audiência (ICP) definida. Tentou criar um produto pelo form ou pelo "Criar com Mapa"? O LJ abre um wizard de 5 passos antes — sem ele, o produto não é criado.',
      'Passo 1: mini aula sobre as 3 camadas (Público-Alvo / ICP / Buyer Persona). Passo 2: escolha do Modelo de Negócio (B2B, B2C, B2B2C, C2C). Passo 3: Modelo Operacional (SaaS, E-commerce, Agência, Marketplace, Freemium). Passo 4: o Djow vai sugerir um quadro de PA/ICP/BP pré-preenchido (em breve — KB sendo construída). Passo 5: revisão e salvar.',
      'Produto com audiência definida ganha badge verde "ICP · B2B · SAAS" no header do card e um atalho "Editar audiência" abaixo da saúde. Produto sem audiência (legacy) recebe badge âmbar "ICP não definido" e CTA bloqueante pra configurar.',
      'O wizard é o mesmo nos 2 caminhos de criação (form direto e popup do Mapa da Receita) — fonte única.',
      'Próximo passo (não está vivo ainda): Djow cruzando modelo + descrição do produto + leads importados do RD pra sugerir o quadro completo de PA/ICP/BP automaticamente.'
    ]
  },
  {
    version: 'V38.1.35',
    date: '2026-06-16',
    title: 'Roadmap da Campanha — header novo + KPIs do topo realinhados',
    bullets: [
      'Modal "Fluxo Total da Campanha" virou "Roadmap" — nome que reflete melhor o que ele é: o trajeto operacional da campanha do impacto à conversão final.',
      'KPI "Leads Impactados" agora é "Leads Totais da Campanha" — alimentado pela importação do RD.',
      'KPI "Leads Convertidos" virou "Marketing → Vendas" com a paleta semântica do LJ (Marketing rosa, Vendas teal). Conta só os leads que cruzaram o handoff entre os dois setores no funil da campanha.',
      'KPI "Oportunidades" virou "Vendas → CS" com Vendas teal e CS azul. Conta os leads que cruzaram esse handoff.',
      'KPI "Conversão Total" virou "ICP" com esqueleto layered Indicador C/B/A (Público-alvo / ICP / Buyer Persona). Valores ainda vazios — Djow vai preencher quando o quadro for definido.'
    ]
  },
  {
    version: 'V38.1.34',
    date: '2026-06-15',
    title: 'Modal de Editar Campanha enxuto: Produto + Nome + Status',
    bullets: [
      'Modal de edição da campanha foi cortado pra mostrar só o que importa: Produto vinculado, Nome e Status. Saíram os campos "Objetivo", "Responsável" e "Investimento em mídia" — campanha é container, não carrega meta nem dono nem orçamento próprio.',
      'Pra pausar ou finalizar uma campanha, abra a engrenagem do card e mude o dropdown "Status" pra Pausada ou Finalizada. Os KPIs do topo da página atualizam na hora.'
    ]
  },
  {
    version: 'V38.1.33',
    date: '2026-06-15',
    title: 'Criar campanha vira só 2 campos: produto + nome',
    bullets: [
      'Form de "Criar campanha" foi enxugado: saíram os campos "Objetivo", "Responsável" e o bloco amarelo de aviso "Regra RevOps". Sobram só os dois campos que importam pra abrir uma campanha: produto vinculado + nome da campanha.',
      'Decisão segue a própria regra RevOps: campanha é container — não tem meta nem dono próprio. Quem carrega objetivo e responsável é a ação dentro dela.',
      'Placeholder do nome agora ensina o cliente a nomear pelo que a campanha ataca: "Ex: Aquisição Q2 / Reativação Inverno / Black Friday 2026". Antes era "Campanha Maio" (que é mês, não campanha).'
    ]
  },
  {
    version: 'V38.1.32',
    date: '2026-06-15',
    title: 'Card da Campanha: "Ações por área" centralizado de verdade + Roadmap volta pro canto',
    bullets: [
      '"Ações por área" agora fica centralizado horizontalmente na metade direita do card — antes encostava na esquerda da coluna deixando a sensação de que estava deslocado.',
      'Botão "Roadmap" voltou pro lugar dele: encostado na lateral esquerda do card, logo em cima da linha "Performance Externa". Não fica mais perdido no meio da coluna esquerda.'
    ]
  },
  {
    version: 'V38.1.31',
    date: '2026-06-15',
    title: 'Bug fix: sync de status do ClickUp + Ações por área centralizado de verdade',
    bullets: [
      'Bug grande resolvido: tasks marcadas como "CONCLUÍDO" no ClickUp continuavam aparecendo como "pendente" no LJ mesmo depois de sincronizar. Causa: o mapper só convertia pra "completed" quando o ClickUp enviava statusType="closed" — mas status custom de list (CONCLUÍDO, FINALIZADO, etc.) vêm como "custom". Agora o mapper também detecta por label (concluído, closed, done, finalizado, completo, feito, entregue, pronto), com acento ou sem.',
      'Depois desse fix, basta rodar "Sincronizar X tasks do ClickUp" na Etapa 4 do Mapa e os status corretos passam pro state do LJ. Card de Produto vai mostrar a contagem real (ex: 3/2) e a Saúde do Produto sobe.',
      'Card da Campanha reestruturado em 2 colunas: tudo o que é conteúdo do dia a dia (header, aviso, badges, Roadmap) na esquerda; "Ações por área" sozinho na direita, centralizado verticalmente de verdade — sem mais espaço vazio embaixo.'
    ]
  },
  {
    version: 'V38.1.30',
    date: '2026-06-15',
    title: '"Sair da edição" agora é do setor (Marketing/Vendas/CS), não da campanha',
    bullets: [
      'O botão "Sair da edição" mudou de lugar: estava no card violeta da campanha (saía da campanha inteira) e foi pro card do setor ativo (Marketing, Vendas ou CS) — onde realmente faz sentido.',
      'Quando você abre o setor de Marketing pra trabalhar a esteira, agora aparece um botão "Sair da edição" claro no topo direito do bloco do setor. Clicou — colapsa o setor e libera os outros 2 pra você escolher.',
      'A tecla ESC continua funcionando, mas agora sai do setor ativo (não da campanha). Pra trocar de campanha use o seletor "Campanhas do produto" no topo.',
      'Card "EDITANDO A CAMPANHA" voltou a ser puro indicador de contexto — sem o CTA que confundia.'
    ]
  },
  {
    version: 'V38.1.29',
    date: '2026-06-15',
    title: 'Bug fix: card de Produto agora conta Execuções de verdade + Ações por área centralizado',
    bullets: [
      'Bug do dia: o card do Produto mostrava sempre "EXECUÇÕES 0/0" mesmo com tasks vinculadas no ClickUp. Causa: o engine de agregação chamava ExecutionTaskStore.byActionId() — método que nunca existiu (o certo é byAction). Função falhava silenciosa e retornava 0.',
      'Agora a contagem real aparece. Importante: o status só atualiza depois de sincronizar com o ClickUp pelo botão "Sincronizar X tasks do ClickUp" na Etapa 4 do Mapa — sem isso, o LJ assume "pending" como default.',
      'No card da Campanha, o bloco "Ações por área" agora fica centralizado verticalmente do lado direito, no meio do card. Antes ficava grudado no topo deixando espaço sobrando embaixo.'
    ]
  },
  {
    version: 'V38.1.28',
    date: '2026-06-15',
    title: 'Card da Campanha respira mais + Sair da edição do Mapa',
    bullets: [
      'O bloco "Ações por área" foi pro espaço vazio do lado direito superior do card da Campanha — aproveita um respiro que estava sobrando ali.',
      'No editor do Mapa (Etapa 4), quando você está editando uma campanha específica, aparece agora um botão "Sair da edição" claro no canto do card violeta — não precisa mais procurar como sair.',
      'A tecla ESC também sai da edição da campanha quando o foco não está num input. Atalho discreto com selo "ESC" no botão pra deixar isso óbvio.'
    ]
  },
  {
    version: 'V38.1.27',
    date: '2026-06-15',
    title: 'Card da Campanha: faxina de redundâncias + agrupamento "Ações por área"',
    bullets: [
      'O aviso amarelo dos KRs-mãe pendentes agora ocupa só o tamanho do conteúdo — não estica mais a largura cheia do card. Texto enxuto: "X números-mãe pendentes — plugue no Mapa".',
      'A linha "X ações · X leads · X% conversão" saiu do header — as contagens já vivem nas badges e nos cards por área, era informação repetida 3 vezes no mesmo card.',
      'Os cards Marketing/Vendas/CS ganharam um header "AÇÕES POR ÁREA" com linha fina cinza agrupando-os — fica claro do que estão falando sem precisar adivinhar.',
      'Os cards de área respiram um pouco mais (mais padding, número maior) — não ficaram mais "achatados".',
      'O atalho "Fluxo da Campanha" passou a se chamar "Roadmap" — antecipa a próxima onda de reformulação dessa seção.'
    ]
  },
  {
    version: 'V38.1.26',
    date: '2026-06-15',
    title: 'Card da Campanha: trilha vira 4 badges clicáveis (sem ordem forçada)',
    bullets: [
      'A trilha sequencial de Pipeline → Mapa → Ações → Leads virou 4 badges independentes. Cada uma representa uma capacidade da campanha e não força mais uma ordem de execução.',
      'Cada badge é clicável: quando está cinza (capacidade inativa), o clique leva pra ativar (gerar pipeline, plugar no Mapa, criar ação, mandar leads). Quando está verde (ativa), o clique leva pra ver/gerir aquela capacidade.',
      'Mapa volta a ser tratado como camada estratégica paralela à operacional — você pode rodar uma campanha completa sem ele e plugar quando quiser, sem que o card sugira que é etapa obrigatória.',
      'Bloco "Próximo passo" saiu — cada badge cinza já é o CTA da sua própria capacidade.',
      'Mapa da Receita saiu dos atalhos discretos (virou badge). Fluxo da Campanha continua atalho.'
    ]
  },
  {
    version: 'V38.1.25',
    date: '2026-06-15',
    title: 'Aviso de números-mãe pendentes no card da Campanha mais magro',
    bullets: [
      'O aviso amarelo dos KRs-mãe pendentes ficou menor: padding mais apertado, ícone menor, texto mais compacto.',
      'Texto enxugado de "ainda não plugado(s) nesta campanha — abra o Mapa..." para "ainda não plugado(s) — abra o Mapa..." (cabe na linha sem perder o sentido).'
    ]
  },
  {
    version: 'V38.1.24',
    date: '2026-06-15',
    title: 'Botão "Próximo passo" mais discreto no card da Campanha',
    bullets: [
      'O bloco do "Próximo passo" perdeu o envelope cinza ao redor e o botão ficou mais magro — ocupa o tamanho do conteúdo, não a largura toda da coluna.',
      'Label "PRÓXIMO PASSO" virou anotação fina cinza acima do botão, sem competir com o CTA pela atenção.',
      'CTA continua claro e dominante, mas agora respira em vez de tomar conta da metade direita do card.'
    ]
  },
  {
    version: 'V38.1.23',
    date: '2026-06-15',
    title: 'Card da Campanha: layout calibrado (trilha horizontal, CTA respira, sem redundâncias)',
    bullets: [
      'Trilha de status agora desenha numa linha horizontal contínua (era empilhada em 4 linhas verticais) — bolinhas conectadas por traços de status, sem quebrar.',
      'Botão "Próximo passo" ganhou largura própria — não quebra mais "Gerar / Pipeline / RD" em 3 linhas. Cada CTA cabe inteiro numa linha.',
      'Selos antigos "Pipeline criado" e "Mapa em configuração" saíram do canto inferior do card — a trilha já mostra essas informações, ter em 2 lugares confundia.',
      'Aviso de KRs-mãe pendentes agora ocupa largura cheia do card (era espremido numa coluna estreita, texto quebrava em 5 linhas).',
      'Cards Marketing/Vendas/CS ficaram mais compactos — não competem mais pela atenção do "Próximo passo".',
      'Trilha agora respeita a ordem: marco posterior só acende se o anterior está concluído. Antes podia mostrar "Ações ✓" mesmo sem Pipeline gerado, o que dava sensação de estado quebrado.',
      'Estrutura saiu do grid antigo de 3 colunas rígidas (lj-entity-card-grid) — layout agora se adapta melhor ao conteúdo de cada estado.'
    ]
  },
  {
    version: 'V38.1.22',
    date: '2026-06-15',
    title: 'Card da Campanha: trilha de status + Próximo passo guiado',
    bullets: [
      'O card da Campanha agora abre com uma trilha visual de 4 marcos — Pipeline, Mapa, Ações, Leads — que mostra onde a campanha está no ciclo de vida sem você precisar interpretar 5 botões soltos.',
      'No lugar do amontoado de botões, um bloco "Próximo passo" mostra a próxima ação lógica grande e clara. Conforme você avança (gera pipeline → ativa mapa → cria ação → manda leads pro RD), o CTA muda sozinho.',
      'Mapa da Receita e Fluxo da Campanha viraram atalhos discretos no canto — continuam a 1 clique mas não competem mais pela atenção do que importa.',
      'O aviso de KRs-mãe pendentes agora fala como sistema (era "CEO criou X..." — virou "X números-mãe ainda não plugados nesta campanha").',
      'Os cards Ações/Leads/Conversão deram lugar a 3 cards por setor — Marketing, Vendas e CS — mostrando quantas ações você tem em cada área. Mesma estética e cores do card de Produto.',
      'O aviso "X ações sem objetivo vinculado" saiu do card — informação migra pro menu Ações onde realmente é resolvida.',
      'Engrenagem de Editar Campanha continua no canto superior direito, intocada.'
    ]
  },
  {
    version: 'V38.1.21',
    date: '2026-06-15',
    title: 'Card do Produto: "Criar Campanha para este produto" + sai o "Editar Campanha"',
    bullets: [
      'O botão "Criar Campanha" do card do produto agora diz "Criar Campanha para este produto" — fica explícito que a campanha já nasce vinculada. Caminho continua o mesmo.',
      'Botão "Editar Campanha" do card foi removido. Era atalho redundante — editar campanha continua disponível pela aba Campanhas direto.',
      'Card passou de 3 para 2 botões — sobra mais respiro visual.'
    ]
  },
  {
    version: 'V38.1.20',
    date: '2026-06-15',
    title: 'Djow agora cita 3 frameworks novos: CVO, CRO e RevOps',
    bullets: [
      'A base de conhecimento do Djow ganhou 3 livros destilados: Chief Value Officer (Megido & Zanusso), Chief Revenue Officer / B2B Success Model (Carl Moe) e Revenue Operations (Lane & Adint).',
      'O Djow passa a citar pelo nome frameworks como SCO de qualificação B2B, Forensic Forecast com Commit/Best Case/Pipeline, Pipeline Velocity (V×C×L/T), Triple Bottom Line, Matriz de Alçada de desconto, Clawback de comissão e NRR como norte de crescimento.',
      'Você pode pedir provocações tipo "diagnostica meu funil pelos critérios do Moe", "qual minha Pipeline Velocity?" ou "como o framework de CVO leria minha estrutura de remuneração?" — Djow responde com a linguagem dos autores.',
      'Conteúdo é universal (não específico de cliente) — todo tenant ganha o mesmo arsenal de citações.'
    ]
  },
  {
    version: 'V38.1.19',
    date: '2026-06-15',
    title: 'Status do Djow conta a KB inteira (não só a raiz)',
    bullets: [
      'O painel Configurações → Agentes Externos → Djow mostrava ~62 KB de base de conhecimento. Era subestimativa: o Djow no chat carrega ~118 KB de verdade (15 arquivos contra 9 contados).',
      'Causa: o endpoint de status lia só os .md da raiz, ignorando as subpastas revops/* e methodologies/* (Doerr, Geraldo, Leonardo, marketing-ops, sales-ops, cs-ops, financial-ops).',
      'Agora o status faz o mesmo walk recursivo do chat. Os números batem com a realidade.'
    ]
  },
  {
    version: 'V38.1.18',
    date: '2026-06-15',
    title: 'Card de área: "X KRs" — sem cruzar com nada, apenas o número de KR-mãe da área',
    bullets: [
      'Felipe disse simples e eu complicou: tinha cruzado productKr × childKr × connectedActionIds. Foi mal.',
      'Volta ao essencial: card mostra "X KR" / "X KRs" — o número de KR-mãe (productKrs) da área criados no Mapa. Sem cruzar com action, sem cruzar com children. Apenas a contagem direta.',
      'Atira.Pro: Marketing 1 KR · Vendas 3 KRs · CS 3 KRs (todos cor da área). "pendente" só quando 0 KR.'
    ]
  },
  {
    version: 'V38.1.17',
    date: '2026-06-15',
    title: 'Card de área: só "X conectados" — sem "nº · ações" mais',
    bullets: [
      'Felipe simplificou: "Só traz o tanto de Krs conectados, só isso". Tira a notação "1 nº · 1 ação" que confundia.',
      'Card agora mostra só "X conectados" onde X é o número de KR-mãe da área cujo child em alguma branch tem action vinculada (connectedActionIds > 0).',
      'Estados: ≥1 conectado → "X conectados" com cor da área | 0 conectados mas tem KR → "sem ação vinculada" cinza | sem KR-mãe → "pendente" cinza.'
    ]
  },
  {
    version: 'V38.1.16',
    date: '2026-06-15',
    title: 'Card de área: números do status com peso visual',
    bullets: [
      'O label ("MARKETING", "VENDAS", "CS") tinha font-black uppercase tracking-wider — bem destacado. O status logo abaixo ("1 nº · 1 ação") era só text-[10px] sem peso, parecia apagado em comparação.',
      'Fix: status ganha font-bold e sobe pra text-[11px]. Equilibra o peso visual com o label e os números viram parte central da leitura do card.'
    ]
  },
  {
    version: 'V38.1.15',
    date: '2026-06-15',
    title: 'Card de área: "pendente" só quando NÃO TEM KR (antes era se faltasse ação)',
    bullets: [
      'CS no Atira.Pro tinha 3 KRs criados mas 0 ações vinculadas → V38.1.14 mostrava "pendente", confundindo (KRs existiam!).',
      'Novo critério: "pendente" só quando nenhum KR foi criado naquela área. Com KR + sem ação mostra "3 nº · 0 ações" — evidencia que existe a estratégia mas falta conectar à receita via ações.',
      'Cor da área (rosa/teal/sky) aparece sempre que tem KR, mesmo com 0 ações.'
    ]
  },
  {
    version: 'V38.1.14',
    date: '2026-06-15',
    title: 'FIX CRÍTICO: card e Saúde leem productKrs (mãe), não childKrs das branches',
    bullets: [
      'Bug que vinha aparecendo desde V38.1.6: o card mostrava "5/1/0" enquanto o Mapa mostrava "1/3/3" (= 7 KRs).',
      'Causa: o engine de Saúde e o card de produto estavam lendo strategicCampaignMaps[branch].objectives[].okrs (childKrs nas branches). Esses são KRs DAS CAMPANHAS — incluem KRs órfãos (sem KR-mãe correspondente) que o Mapa esconde com aviso amarelo.',
      'Atira.Pro tinha 5 childKrs em Marketing (4 órfãos + 1 com mãe), 1 child em Sales (com mãe) e 0 em CS. Total: 6 — bate com o "5/1/0" do card.',
      'O Mapa, por sua vez, mostra os productKrs (KR-mãe) — vivem em strategicMaps[productId].productKrs. Atira.Pro tem 1 mkt + 3 sales + 3 cs = 7 productKrs. Eles é que aparecem como "configurados" e que o cliente acompanha.',
      'Fix: card e Saúde agora leem productKrs (KR-mãe), alinhado com o Mapa. Helper _getProductKrs(productId) no engine; productKrs.filter(k => k.area === id) no card.',
      'Atira.Pro deve mostrar agora: Marketing 1 nº (com action ou pendente), Sales 3 nº, CS 3 nº.'
    ]
  },
  {
    version: 'V38.1.13',
    date: '2026-06-15',
    title: 'Subtítulo do Hero da aba Produtos cravado pelo Felipe',
    bullets: [
      'O subtítulo "Camada financeira do Revenue OS" não refletia o conceito real de produto no LJ. Felipe cravou a versão definitiva: "O produto é onde o Revenue Operation (operação de receita) começa: ancora Mapa da Receita, ofertas, campanhas, custos e leitura de saúde."',
      'Posiciona o produto como ponto de partida da operação inteira, não só como camada financeira. Lista o que ele realmente ancora (Mapa, ofertas, campanhas, custos, saúde).'
    ]
  },
  {
    version: 'V38.1.12',
    date: '2026-06-15',
    title: 'Cards de área (Marketing/Vendas/CS) viram atalho pro Mapa Etapa 3',
    bullets: [
      'Os 3 cards Marketing/Vendas/CS no card de produto agora são clicáveis. Click leva direto pra Etapa 3 (Os Números) do Mapa da Receita daquele produto.',
      'Se o produto ainda não tem Mapa configurado (sem objetivo + sem KR em nenhuma branch), aparece um toast de aviso e a navegação vai pra Etapa 1 (Visão) pra começar do início.',
      'Critério de "configurado": tem objetivo (vision) preenchido E pelo menos 1 KR criado em qualquer área. Sem isso, considera que o cliente precisa fazer o primeiro setup.',
      'Hover dos cards ganhou um shade mais escuro pra deixar evidente que é clicável.'
    ]
  },
  {
    version: 'V38.1.11',
    date: '2026-06-15',
    title: 'FIX: engine de Saúde usava AREA "vendas" mas a real é "sales"',
    bullets: [
      'StrategicMapEngine.COMERCIAL_AREAS usa IDs em inglês: marketing / sales / cs. O healthScoreEngine usava AREAS: ["marketing", "vendas", "cs"] (mistura PT/EN).',
      'Sintoma: a Cobertura nunca contava KRs de Vendas porque o filtro o.area === "vendas" nunca casava com o real o.area === "sales". Mesmo com 3 KRs de Vendas configurados no Mapa, a área "vendas" aparecia como faltante.',
      'Fix: trocar "vendas" → "sales" no array AREAS. Cobertura conta corretamente.'
    ]
  },
  {
    version: 'V38.1.10',
    date: '2026-06-15',
    title: 'Hero da aba Produtos: tira título redundante (e o typo "açoões")',
    bullets: [
      'O título grande do Hero ("1 produto ativo · 1 campanha · 2 ações") repetia os números que já estão nos 4 cards KPI à direita. Saiu inteiro — Hero fica com selo + subtítulo descritivo + cards.',
      'Bônus: typo "açoões" (concordância errada de plural com "ção") foi embora junto.'
    ]
  },
  {
    version: 'V38.1.9',
    date: '2026-06-15',
    title: 'Card de produto e Saúde têm leituras diferentes (e era isso mesmo)',
    bullets: [
      'Esclarecimento conceitual: o card de produto e o engine de Saúde NÃO usam o mesmo critério de "KR válido". São duas perguntas diferentes.',
      'Card do produto = "quantos KRs foram CRIADOS e CONECTADOS À RECEITA?". Critério: KR existe no Mapa (qualquer status, mesmo rascunho) E a área tem pelo menos uma ação vinculada que vai puxar o funil. Se algum dos dois faltar, a área fica "pendente".',
      'Saúde / engine K = "os KRs estão CONFIGURADOS E ANDANDO?". Critério mais rigoroso: precisa estar isComplete (Meta Segura + Avançada + Prazo todos preenchidos) E ter current > 0 (alguém está perseguindo). Sem essas duas coisas, peso 0.',
      'Antes (V38.1.8): tinha unificado os 2 critérios usando isComplete pros dois. Agora cada um volta pra sua leitura própria. Mais coerente com o que cada um deve comunicar.',
      'Sansone: card de Vendas deve voltar a mostrar "3 nº · 1 ação" (3 KRs criados, 1 ação) em vez de "1 nº · 1 ação".'
    ]
  },
  {
    version: 'V38.1.8',
    date: '2026-06-15',
    title: 'Saúde alinha com o que o Mapa mostra como "PRONTO"',
    bullets: [
      'A UI do Mapa da Receita marca KR como "✓ PRONTO" usando isComplete(kr) — que retorna true quando o KR tem Meta Segura + Meta Avançada + Prazo preenchidos. Mas a Saúde estava olhando pro flag confirmed (que exige ação adicional do cliente, raramente clicada).',
      'Conflito visual: Felipe abria o Mapa e via 3 KRs marcados como "PRONTO", mas a Saúde retornava K=0 dizendo "sem KR confirmado". O Mapa estava certo, a Saúde estava medindo errado.',
      'Fix: novo helper _isKrValid no healthScoreEngine retorna true se kr.confirmed === true OU StrategicOkrEngine.isComplete(kr). Os 3 lugares (cobertura, krHealth no engine de Saúde + _strategicMapSummary no card de produto) usam esse helper.',
      'Sansone deve ver agora: cobertura com áreas marcadas (Marketing/Vendas/CS conforme onde tem isComplete), K com média dos status dos KRs, Saúde subindo do 0.'
    ]
  },
  {
    version: 'V38.1.7',
    date: '2026-06-15',
    title: 'Fix typo: healthScoreEngine usava strategicOkrEngine (minúsculo) em vez de StrategicOkrEngine',
    bullets: [
      'Bug residual da V38.1.0: o engine de Saúde tinha duas referências ao engine de OKR com nome em camelCase errado (strategicOkrEngine) — global real é StrategicOkrEngine (capital S).',
      'Sintoma: na verificação inicial, retornava silenciosamente o estado "sem KR" (porque o `if` que checava `window.strategicOkrEngine` dava falsy). E mesmo se passasse, a chamada strategicOkrEngine.scoreStatus(kr) explodia em ReferenceError.',
      'Felipe pegou rodando query no console — ficou claro que algo na cadeia tava furado.'
    ]
  },
  {
    version: 'V38.1.6',
    date: '2026-06-15',
    title: 'FIX CRÍTICO: Saúde e card de produto não enxergavam KRs em branches (V29)',
    bullets: [
      'Bug que Felipe pegou pelo print: o Mapa da Receita do Atira.Pro tem 7 KRs confirmados (1 Marketing + 3 Vendas + 3 CS), mas a Saúde do Produto retornava K=0 e o card mostrava todas as áreas como "pendente".',
      'Causa raiz: a V29.0.0 (não tão antiga) reorganizou o storage dos KRs. Antes ficavam em strategicMaps[productId].objectives. Agora ficam dentro das BRANCHES de cada campanha — strategicCampaignMaps[campaignId].objectives[].okrs[]. O healthScoreEngine e o _strategicMapSummary do card lia só o caminho V28 legacy (vazio em produto pós-V29).',
      'Fix: novo helper _collectAllObjectives no engine de Saúde + lógica equivalente no card de produto. Agregam objectives do legado V28 + de TODAS as branches V29 do produto. Cobertura, K, contagem de KRs por área e status "pronto/pendente" voltam a refletir o que tá no Mapa.',
      'Sansone (e qualquer cliente com KRs cravados em branches) vê a Saúde subir imediatamente conforme cobertura/K calculam certo agora.'
    ]
  },
  {
    version: 'V38.1.5',
    date: '2026-06-15',
    title: 'Página Produtos: coluna Criar dobra pra 600px e cards alinham na base',
    bullets: [
      'Coluna de Criar Produto dobrou de 300px pra 600px — campos respiram mais sem perder espaço pro card de Produtos Criados (Nome/Tipo em 2 colunas + Recorrência cheia). Ainda assim Produtos Criados continua sendo o lado maior.',
      'Botão grande violeta "Criar Produto com Mapa da Receita" voltou ao tamanho original (px-5 py-4 com ícone + texto + recomendado).',
      'Cards alinham na base: items-stretch no grid + flex-1 com spacer no card "Criar sem Mapa" empurra o botão Criar pra colar com a base do card Produtos Criados.',
      'Coluna direita (Produtos Criados) também ganhou h-full + flex pra acompanhar a altura.'
    ]
  },
  {
    version: 'V38.1.4',
    date: '2026-06-15',
    title: 'Polimento: 8 fixes acumulados (header, badges, grid Produtos, ordem tabs, botão clássico, Saúde em construção)',
    bullets: [
      'Header da view de produto em RevOps mostra o nome do produto no título principal ("Operação de Receita · Atira.Pro") — antes era genérico só "Operação de Receita".',
      'Card "Meta de Vendas" do Resultado: badge "Sem meta" trocou ícone de lápis (que sugeria editar inline) por seta externa apontando pra aba Ofertas — coerente com o read-only de V38.1.2.',
      'Grid da página Produtos: coluna de criar (Botão violeta + form sem Mapa) virou fina de 300px à esquerda, campos empilhados verticalmente. Card de Produtos Criados ganha ~70% da largura. Antes era 50/50 com o form em 1 linha horizontal — invertido do que tinha sido pedido.',
      'Aba "Fechamento" movida da 1ª pra última posição em RevOps & Governança (depois de DRE). A jornada do CFO é Custos → Ofertas → Resultado → KPIs → DRE → no fim do mês, Fechamento. Fechamento na 1ª posição estava fora dessa narrativa.',
      'Botão "← Clássico" (que ativava painel V14 deprecated) trocou pra "← RevOps & Governança" e volta pro Overview consolidado. No Overview ele sumiu (já é a área inicial).',
      'Modal Saúde do Produto: balão do fator KRs agora explica 3 estados — "Nenhum KR cadastrado ainda" (produto vazio) / "X em rascunho, 0 confirmados, preencha Meta Segura + Avançada + Prazo" / "X confirmados, multiplica por 0.Y".',
      'Modal Saúde: cores das porcentagens dos fatores ficam cinza quando o valor é 0 (antes verde/azul/violeta em "0%" passava sinal contraditório). Volta pra cor temática só quando tem valor real.',
      'Estado "Em construção" 🚧 pra produto recém-criado (sem KR + sem task + sem meta + sem checkout): tier violet amigável em vez de "CRÍTICO" rose. Mensagem muda pra "Vamos construir a operação?" com guia. Antes desencorajava produto novo gritando vermelho.'
    ]
  },
  {
    version: 'V38.1.3',
    date: '2026-06-15',
    title: 'Linha de oferta alinha bonito: labels uniformes em cima + base alinhada',
    bullets: [
      'Bug visual: o input "Nome da oferta" ficava sem label, então alinhava no meio do flex enquanto os outros campos (Tipo, Preço, Meta, Mix) tinham label uppercase em cima. Tudo desalinhado.',
      'Fix: padronizei. Todo campo agora tem label uppercase em cima (incluindo Nome). Flex passou de items-center pra items-end — todos os inputs descem na mesma linha base. Ícone tag e checkbox TM ajustam altura pra ficar no nível.',
      'Bônus: checkbox "TM" virou um chip com borda discreta (em vez de só um checkbox solto colado nos campos) — melhor leitura visual.'
    ]
  },
  {
    version: 'V38.1.2',
    date: '2026-06-15',
    title: 'Ofertas ganha layout das outras tabs + Meta de Vendas no Resultado vira read-only',
    bullets: [
      'Aba Ofertas estava com layout sem padrão: stack simples sem Djow lateral, sem fundo offwhite. Agora segue a régua das outras tabs (Custos, Resultado, DRE, RevOps KPIs): grid 2-col com Djow Ajudante de Fórmulas na lateral + section offwhite #f5f3f0 + cards dentro do white com sombra chapada. Coerência visual completa.',
      'Coluna META VENDAS na linha de oferta ficou apertada (w-24 com label "Meta vendas" quebrando em 2 linhas). Ajustada pra w-20 com label compacta "META" + tooltip "Meta de vendas no período".',
      'Meta de Vendas no Resultado Consolidado virou READ-ONLY: mostra a soma das metaVendas das ofertas do produto + atalho "Ajustar nas Ofertas" que pula direto pra aba. Antes era um input editável duplicado com o que vive na oferta (V38.0.3 já moveu) — agora 1 lugar só pra mexer.',
      'Meta de CAC continua editável no Resultado (CAC é meta financeira do produto, não tá na oferta).'
    ]
  },
  {
    version: 'V38.1.1',
    date: '2026-06-15',
    title: 'RevOps & Governança ganha Overview consolidado de todos os produtos',
    bullets: [
      'Antes você abria RevOps e caía direto na governança de UM produto (Atira.Pro). Agora cai num Overview: 4 KPIs consolidados no topo (Receita Bruta Total, EBITDA Consolidado, Margem Média, Saúde Média) + grid de cards (1 por produto) com Receita / EBITDA / Margem / Saúde / CAC / Conversão.',
      'Click no card entra na governança específica do produto (6 tabs como sempre). Breadcrumb "← Overview / Atira.Pro" no header do produto pra voltar.',
      'Sempre cai no Overview ao entrar em RevOps (não persiste seleção entre F5 / fechar app) — cada visita é uma respirada conceitual sobre a operação inteira antes de mergulhar no produto.',
      'Saúde no card vem do engine V38.1.0; CAC e Conversão aparecem como "—" até a integração checkout (V38.2.0) — modal Saúde explica.',
      'Quando você cadastra produto novo, ele já nasce com 1 oferta default (V38.0.3) e card vazio no Overview esperando você cadastrar custos e meta.'
    ]
  },
  {
    version: 'V38.1.0',
    date: '2026-06-15',
    title: 'Saúde do Produto — score 0-100 + modal explicador + Djow giro de faca',
    bullets: [
      'O card de cada produto agora mostra uma linha de Saúde com score, barra colorida e label do gargalo principal ("Em risco: KRs", "Saudável: gargalo Conversão", etc). Tom muda conforme o estado: emerald (saudável ≥80), amber (alerta ≥50), orange (risco ≥20), rose (crítico <20).',
      'Botão "?" abre modal explicador completo: score grande no topo, depois 4 fatores (Eficácia / Cobertura / KRs / Conversão de Vendas) cada um com barra, valor, contribuição em pts e leitura objetiva ("4 de 5 tasks completas", "1 de 3 áreas — Marketing only", etc).',
      'Botão "Pedir análise pro Djow" no rodapé do modal: lazy 1 chamada que retorna 4 balões específicos (um por fator) + veredito final tom GIRO DE FACA — direto, sem rodeio, com lista numerada de ações pros próximos 7 dias. Mentor exigente, não diplomático.',
      'Fórmula: Saúde = K × (0.4 × E + 0.4 × C + 0.2 × R) × 100. K é multiplicador (sem KR confirmado, Saúde = 0). Detalhes completos em knowledge-base/health-score.md — Djow já entende isso.',
      'Backend: novo endpoint /api/djow-health-analysis (não usa o loop do djow-chat — Claude direto com prompt focado pedindo JSON estruturado). Resolve API key via lib/ai-resolver.',
      '⚠ Limitação atual: Resultado (R) ainda sai 0 porque a integração com checkout (Hotmart) pra puxar vendas reais entra na próxima onda. Por enquanto produto sem checkout vê o card "Conversão de Vendas" zerado com instrução pra conectar — Djow explica isso no balão dele.'
    ]
  },
  {
    version: 'V38.0.4',
    date: '2026-06-15',
    title: 'Djow ganhou cérebro novo — KB atualizada de V26 pra V38',
    bullets: [
      'A base de conhecimento do Djow estava em V26.2.0 (~12 versões defasada). Ele não sabia que multi-tenant tinha virado colaboração real, que existia Permission System, Notifications V2, Pin-Up, ou que credenciais resolvem pelo owner do tenant. Quando questionado sobre essas coisas, respondia errado com convicção.',
      'KB reescrita por completo: architecture.md cobre tudo até V38.0.3; data-model.md lista tabelas reais (control plane + tenant DB); novos arquivos multi-tenant.md, permission-system.md, notifications.md, pin-up.md, health-score.md.',
      'Pré-requisito pra Saúde do Produto: o modal explicador (V38.1.0) vai chamar o Djow pra dar análise giro-de-faca. Djow precisa entender O QUE é Saúde, como cada dimensão é calculada, e o conceito de "dinheiro na mesa". Tudo cravado em health-score.md.',
      'Cache em memória do KB renova a cada deploy do server — nada manual, só o redeploy do Railway.'
    ]
  },
  {
    version: 'V38.0.3',
    date: '2026-06-15',
    title: 'Ofertas ganham Tipo (main/cross/up/down) + Meta de Vendas',
    bullets: [
      'Cada oferta agora declara seu Tipo (Principal / Cross-sell / Up-sell / Down-sell). Antes era só nome livre — agora vira dimensão real do RevOps pra análise por categoria.',
      'Campo Meta de Vendas entrou ao lado de Preço e Mix. É unidade de venda (quantas vendas espero?), não R$. Cada oferta tem sua meta, e a meta consolidada do produto vira a soma das ofertas — vai alimentar a Saúde do Produto na próxima onda.',
      'Produto novo já nasce com 1 oferta padrão "Produto Principal" (kind: main, mix: 100%, meta: 0). Antes nascia vazio e cliente caía em tela com aviso âmbar. Cliente que já existe NÃO perde nada — migration silenciosa cria a oferta default na hora de carregar e copia a meta de vendas do mês mais recente (metasResultado V37.0.0) pra metaVendas da oferta.',
      'A meta agora vive UM lugar só (na oferta). Antes era em metasResultado por produto+mês. O dado legado fica preservado em metasResultado pra rollback, mas a UI passa a editar pela aba Ofertas.'
    ]
  },
  {
    version: 'V38.0.2',
    date: '2026-06-15',
    title: 'Página Produtos repensada — Hero agregado, card foca no produto, form enxuto',
    bullets: [
      'Hero virou OVERVIEW da camada inteira: deixou de mostrar "Atira.Pro" individual e passou a consolidar todos os produtos ativos. KPIs novos: Produtos / Campanhas / Ações / Execuções (total/concluídas) — Leads e Conversão estimada saíram (não eram o lugar certo deles).',
      'No card de cada produto, o quadrante HEALTH (que era um número 20 chutado pelo piso da fórmula antiga) deu lugar a EXECUÇÕES no formato Total/Concluídas. Conta as tasks vinculadas a ações do produto via ExecutionTaskStore. Mais útil + verdadeiro.',
      'Form "Criar Produto sem Mapa" encolheu pra 1 linha (Nome / Tipo / Recorrência + botão Criar). Antes ocupava 4 linhas com aviso âmbar grande. Agora ganhou metade do espaço pro card de Produtos Criados crescer.',
      'Fix: campo "Tipo de Produto" parou de mostrar lixo (email que ficava salvo no productDraft de alguns clientes). Normalize do state higieniza automaticamente — se algum campo string parecer email, zera só ele.'
    ]
  },
  {
    version: 'V38.0.1',
    date: '2026-06-12',
    title: 'Fix Pin-Up: pin não vaza mais entre abas do LJ',
    bullets: [
      'Bug: pin cravado na Home aparecia em Ações da campanha (e em qualquer outra aba) no mesmo X/Y. Causa: o LJ é SPA, window.location.pathname é sempre "/" — o targetUrl ficava igual em todas as abas.',
      'Fix: scope do pin agora inclui a aba ativa via #tab=<activeTab>. Cada aba ganha seu próprio namespace. Pin cravado na Home só aparece na Home; pin nas Ações da campanha só lá.',
      'Click em notificação de pin agora switch a aba in-place (sem recarregar a página) quando o pathname é o mesmo. Antes, qualquer clique em notif forçava reload.',
      'Bonus: overlay detecta mudança de aba em runtime e re-fetcha os pins do scope novo — sem precisar de F5.'
    ]
  },
  {
    version: 'V38.0.0',
    date: '2026-06-12',
    title: 'Master V38 — Tenant compartilhado de verdade: state, integrações e operação colaborativa',
    bullets: [
      '🎯 O QUE MUDA DE NATUREZA: até a V37, multi-tenant era arquitetura mas não comportamento. Quando você convidava alguém pro tenant, ele entrava num LeadJourney VAZIO — produtos, campanhas, integrações e configs eram amarradas ao user_id de quem fez. V38 abre acolhendo a próxima fase: tenant é uma operação compartilhada, não um login replicado.',
      '',
      '═══ ARQUITETURA — colaboração real ═══',
      'State per-tenant: nova tabela tenant_state (PK = tenant_id) substitui journey_state per-user. Owner edita produtos/campanhas/ações → todo membro do tenant vê em tempo real (próximo F5 ou sync 60s). Dual-write transitório com journey_state legado pra rollback fácil.',
      'Integrações per-tenant: 60+ endpoints (ClickUp, RD, Hotmart, Google Ads, GA4, score, governance, triggers) refatorados pra resolver credenciais pelo OWNER do tenant em runtime. Manager/user lê e usa, owner controla. Sem migration de schema — resolução é runtime via tenant_members.',
      'Helper centralizado lib/credentials-owner.js (resolveCredentialOwnerId + assertCanWriteCredentials) — pattern simples pra próximas integrações.',
      '',
      '═══ PERMISSÕES — sistema completo de roles ═══',
      'Permission System: 3 roles (Master / Gerente / Usuário) + overrides granulares persistidos em tenant_members.permissions_overrides JSONB. Frontend role-gating esconde abas que o user não pode tocar.',
      'Configurações → Membros: lista, edita role, ajusta permissões custom, convida via link mágico (email automático quando SMTP ativo, fallback "Copiar link"), cancela convite pendente.',
      'Self-healing pra logins legados pré-V37.3 (auth-backfill-membership) — JWT velho sem tenantId resolve via users.default_tenant_id.',
      'Permissions carregam no boot — abas role-gated aparecem direto, sem precisar abrir/fechar Configurações pra hidratar.',
      '',
      '═══ MINHA CONTA — autoatendimento ═══',
      'Trocar email + trocar senha (com confirmação da senha atual) + ver permissões efetivas (modal read-only).',
      'Modal Editar Membro refeito em 3 blocos (Role & permissões / Ações de conta / Zona de perigo). Owner manda reset de senha e troca de email via link mágico.',
      'Reset de senha SEM email (V37.4.31 cravou alternativa pro sandbox SMTP): owner clica "Resetar senha" → flag pending 24h → no próximo login do membro, LJ reconhece o username e abre direto tela "Defina nova senha". Sem trafegar senha por WhatsApp.',
      '',
      '═══ DASHBOARD POR PESSOA — capacidade real ═══',
      'Sub-tab nova "Por Pessoa" no Dashboard → Tarefas: distribuição real por start/due, aderência calculada, slots livres, próxima entrega, carga LJ vs outros projetos, agenda da semana.',
      'Capacity planning sequencial + status custom + média robusta (cap 8h + mediana). Modal de detalhe com dedicação por produto/campanha LJ.',
      'Barras coloridas por contexto LJ + % na barra + linha guia 8h + cards de pessoa com side accent (cor do avatar) e hover-lift.',
      'Visão Geral consolidada: cruzamento Tarefas ClickUp + Checkout + Google Ads por campanha do Mapa.',
      '',
      '═══ SININHO V2 — notification system maduro ═══',
      'Infra completa: tabela notifications + engine + endpoints + drawer estilo Linear com 3 abas (inbox/saved/archive), filtros, triagem rápida.',
      'Emit helper + 3 disparos automáticos (produto/campanha/ação criados). Absorve alertas legados (ClickUp/RD/Reconciliation) com dedup automático — sininho vira fonte única.',
      'Releases viram notification individual (cada bump aparece como item separado). Cluster de notificações ganha label humano por tipo ("4 atualizações desde ontem") e botão "Recolher" fácil.',
      'Bom Dia card na Home → virou chip discreto → finalmente consolidado dentro do card "Alertas Importantes" (V37.4.32). Uma fileira a menos no topo.',
      'Notification preferences por categoria + opt-in digest semanal por email.',
      'TopBar refeita: sticky no flow (não cobre conteúdo), drawer por cima quando aberto, ícones flutuam sem faixa de fundo, root próprio fora do #app.',
      '',
      '═══ PIN-UP — Figma-style ═══',
      'V37.5.0 MVP: comentários cravados no contexto (coords XY na tela). Alt+P ativa modo cravar, click em qualquer ponto abre modal com multiselect de membros + textarea 400 chars. Notification handoff dispara pra audience. Pin some em 7 dias.',
      'Cluster automático quando >5 pins na tela. Click na notification do pin navega pra URL certa e abre o pin direto.',
      'V37.4.36-39 sucessão de fixes: JOIN users no tenantDb quebrava em tenant com DB próprio (split em 2 queries), BIGSERIAL retornava como string (cast pra Number), pins sumiam após F5 (load no boot), criador ganha botões Editar (texto + audience) e Remover (apaga pra todos).',
      '',
      '═══ DRE / REVOPS / CUSTOS / FECHAMENTO — finance maduro ═══',
      'V37.0.x abriu a master: Resultado ganha layout régua + metas mensais de Vendas e CAC. Aba Fechamento nasce (1ª posição) com switcher de escopo.',
      'Backend de Fechamento: tabela governance_closings + endpoints CRUD + cron mensal. Mensal Consolidado funcional → sininho avisa pendências. Custom Consolidado funcional (agrupamentos arbitrários por mês). Download PDF dos snapshots.',
      'DRE repaginada tema light + Djow lateral pra ajudar com fórmulas. Deduções viram grid de cards verticais. "+ inserir linha" cria linha-banner laranja com cards filhos. Validação visual da fórmula. Lucro Bruto suprimido por default.',
      'RevOps KPIs ganham mesma régua da DRE. Custos viram grid 3-col de cards verticais. Cores seguem regra design diretor (redução=rose / adição=emerald).',
      'Djow ganha autonomia: cria linhas DRE e itens RevOps via comando natural.',
      'Header CFO: KPI cards uniformes com número 1.5x maior.',
      '',
      '═══ MAPA DA RECEITA — 5 etapas estratégia↔ação ═══',
      'Etapa 1 (Objetivo) repensada: modo dual + tema offwhite + hierarquia de badges + Djow filtro de etapa + sugestões adaptativas + avaliador da frase.',
      'Etapa 2 (Comercial) ganhou mesma régua da Etapa 1.',
      'Etapa 3 (Os Números) reescrita: 3 blocos por frente em paralelo. KRs em grid 4-col + slots placeholder + engrenagem + sugestões só ao clicar "Adicionar". Empty state forte (estados 0→N).',
      'Etapas 4 (Selecionar Campanha) e 5 (As Ações) FUNDIDAS na nova Campanha — agora 5 etapas no total, navegação mais limpa.',
      'Acompanhamento (Etapa 5 antiga) adaptada pra tema light.',
      '',
      '═══ FIXES & ESTABILIDADE ═══',
      'V36.8.3 já tinha resolvido a causa raiz da perda de dados Sansone — Health Check enviava ping vazio que sobrescrevia o banco. V37 manteve tripla camada anti-perda (V36.7.1/2 + V36.8.3) e estabilizou.',
      'Master pode criar clientes novos + onboarding guiado com banco de dados próprio.',
      'Wizard Google Ads reformado pra usuário novo. Health Check RD reflete status real.',
      'Token RD Marketing renova sozinho. Dashboard Google Ads não mostra dados-mock quando conta conectada sem campanhas.',
      'Sentinel de logout forçado impossível de bypassar + espião de JWT.',
      'Hotfix V37.4.33: login não fica refém de migration de schema (graceful fallback se coluna nova ainda não existe).',
      'V37.4.35: remoteSnapshotsCache agora mapeado em normalize() — warning de "campos não mapeados" some.',
      '',
      '═══ LIMPEZA — débito técnico saindo ═══',
      'V37.0.7: Setor da Campanha + modo RD mock saem.',
      'V37.0.8: fluxo LP modal vestigial inteiro removido (8 arquivos, ~600 linhas).',
      'V37.0.9: form de criação de ação fica enxuto — bloco Mailing redundante sai.',
      '',
      '🔮 PRÓXIMO CAPÍTULO (V38.x): remover dual-write transitório de tenant_state depois de 1-2 dias sem incidente. Domínio Resend pra liberar magic links reais. Investigar instabilidade ocasional do req.tenantDb (uma migration rodou em DB errado durante o ciclo). Score Engine RFV vivo (substituir fórmula linear). Continuação V35.11.3 cron workflows. RD Fase 3 (5 funcionalidades pra fechar jornada tags bidirecional).'
    ]
  },
  {
    version: 'V37.4.39',
    date: '2026-06-12',
    title: 'Fix Pin-Up: pins agora carregam no F5 (não precisa criar outro pra ver os antigos)',
    bullets: [
      'Bug: depois de F5 os pins sumiam da tela. Quando você cravava um pin novo, os antigos voltavam — porque o submitPin chamava loadPinsForCurrentUrl no fim e re-fetchava tudo.',
      'Causa: a chamada de loadPinsForCurrentUrl no boot só existia dentro de _refreshCurrentUserInfo (que roda em plug DB / save name), nunca no init normal do app. F5 = state zerado, sem load = tela vazia.',
      'Fix: main.js init() agora chama loadPinsForCurrentUrl 100ms após render (mesmo padrão de loadMyPermissions V37.4.23).'
    ]
  },
  {
    version: 'V37.4.38',
    date: '2026-06-12',
    title: 'Pin-Up: criador pode Editar e Remover o próprio pin',
    bullets: [
      'Antes: o modal do pin só tinha botão "Arquivar" — mesmo pro criador. Editar texto/audience era impossível sem apagar e criar de novo.',
      'Agora: quando você abre um pin que VOCÊ cravou, aparecem 2 botões violeta — "Editar" (abre modal pra mudar texto e quem é marcado, posição fica fixa) e "Remover" (apaga pra todo mundo).',
      'Quem NÃO é o criador continua vendo só "Arquivar" — alias do mesmo POST mas com label menos destrutivo.',
      'Backend: novo POST /api/pin-edit (só o creator passa pelo gate). Reaproveita o action existente de archive pra delete.'
    ]
  },
  {
    version: 'V37.4.37',
    date: '2026-06-12',
    title: 'Fix Pin-Up: clicar no pin não abria o modal (BIGSERIAL retornava como string)',
    bullets: [
      'Bug: pin.id era BIGSERIAL no DB, o pg driver retornava como string ("1"). Frontend chamava Actions.openPinView(${p.id}) e o template interpolava como number (1). O find(p => p.id === id) virava "1" === 1 = false. Modal nunca abria → sem como marcar visto, arquivar ou remover.',
      'Fix: backend cast id pra Number antes de retornar. Frontend e backend agora falam o mesmo tipo.',
      'Nota: editar texto de pin não existe ainda como feature. Por hora dá pra arquivar (que some pra todo mundo) — equivalente a remover.'
    ]
  },
  {
    version: 'V37.4.36',
    date: '2026-06-12',
    title: 'Fix Pin-Up: pins não apareciam pra ninguém em tenant com DB próprio',
    bullets: [
      'Bug: /api/pins-list fazia LEFT JOIN com tabela users dentro do tenantDb, mas users vive no control plane. Em tenants com DB próprio plugado (Sansone V36.8.0+), a query explodia com "relation users does not exist" — e o sininho/overlay ficava vazio mesmo pro creator do pin.',
      'Fix: 2 queries separadas. Pins lidos do tenantDb (sem JOIN). Display names dos creators buscados no control plane numa única query agregada.',
      'Único endpoint afetado — outros LEFT JOIN users já estavam corretamente no req.db.'
    ]
  },
  {
    version: 'V37.4.35',
    date: '2026-06-12',
    title: 'Fix warning: remoteSnapshotsCache agora mapeado em normalize()',
    bullets: [
      'O cache de snapshots remotos (Configurações → Backup → "Snapshots no DB") era criado in-flight pela action loadRemoteSnapshots, mas nunca foi registrado em State.initial() nem State.normalize(). Resultado: aparecia warning "Campos persistidos NÃO mapeados em normalize() — risco de perda de dados" toda vez que F5 acontecia depois de abrir essa tela.',
      'Agora: campo declarado em ambos, sempre null no boot (cache se re-hidrata sob demanda quando o user abre a aba). Aviso some.'
    ]
  },
  {
    version: 'V37.4.34',
    date: '2026-06-12',
    title: 'Integrações agora seguem o owner do tenant (não o user logado)',
    bullets: [
      'Antes: ClickUp, RD Station, Hotmart, Google Ads, GA4 e todas as configs de tenant (score, ICP, tags, governance, triggers) eram amarradas ao user_id de quem conectou. Quando você convidava um membro novo pro tenant, ele logava e via TUDO desconectado — porque a query filtrava pelo user_id dele (que nunca conectou nada).',
      'Agora: ~60 endpoints resolvem o user_id "dono das credenciais" pra ser o owner do tenant. Owner do Sansone conectou ClickUp → todo manager/user do tenant Sansone vê e usa o mesmo ClickUp. Mesmo pra RD, Hotmart, Google Ads, GA4, score-rules, governance-closings, triggers etc.',
      'Permissões: manager/user pode LER e USAR (criar tasks, sincronizar leads, ver dashboards), mas NÃO pode trocar token, desconectar nem ver PAT em texto cru. Só owner (ou master LJ) tem acesso de escrita.',
      'Helper centralizado lib/credentials-owner.js: resolveCredentialOwnerId(req) + assertCanWriteCredentials(req). Pattern fica simples pra próximas integrações.',
      'Sem migration de schema — o owner é resolvido em runtime via tenant_members. Histórico Djow continua pessoal por user (não compartilhado no tenant).'
    ]
  },
  {
    version: 'V37.4.33',
    date: '2026-06-12',
    title: 'Hotfix: login não fica refém da migration de password_reset_flag',
    bullets: [
      'V37.4.31 quebrou o login em qualquer ambiente onde a migration /api/admin-migrate-password-reset-flag ainda não tinha rodado (column "password_reset_pending" does not exist). Como pra rodar a migration precisa estar logado, ficou catch-22.',
      'Hotfix: auth-login pega exceção da coluna ausente e refaz o SELECT antigo (sem as colunas novas). Login passa a funcionar mesmo antes da migration.',
      '⚠ Master: ainda precisa rodar /api/admin-migrate-password-reset-flag pra o fluxo de reset de senha funcionar. Sem a migration, o botão "Resetar senha" no Editar Membro vai dar 500 — mas o login normal volta a funcionar.'
    ]
  },
  {
    version: 'V37.4.32',
    date: '2026-06-12',
    title: 'Banner "X atualizações desde ontem" foi pra dentro de Alertas Importantes',
    bullets: [
      'Antes: chip flutuante roxo "X atualizações desde ontem" no topo da Home (acima do Pulso da Receita) E o card "Alertas importantes" no canto inferior direito viviam separados — Felipe pediu pra fundir num lugar só.',
      'Agora: o resumo de atualizações entra como primeiro item dentro do card "Alertas importantes" (bola roxa). Clique segue indo pro sininho. O chip do topo sumiu — uma fileira a menos.',
      'Quando não houver atualização nova (total = 0), a linha simplesmente não aparece — o card mostra só os alertas estratégicos.'
    ]
  },
  {
    version: 'V37.4.31',
    date: '2026-06-12',
    title: 'Resetar senha do membro sem depender de email',
    bullets: [
      'Antes: "Enviar reset de senha" dependia de SMTP com domínio verificado (Resend sandbox só entrega pro próprio email do dono da conta). Sem domínio, o link nunca chegava no membro.',
      'Agora: novo botão "Resetar senha" no Editar Membro. Master/owner clica, sistema marca o membro com flag de reset pendente (válido por 24h). Nada de email, nada de senha temporária trafegando por WhatsApp.',
      'No próximo login do membro: ele digita só o username e o LJ já reconhece — pula a senha e abre direto a tela "Defina uma nova senha". Troca e entra logado.',
      'Botão antigo "Enviar reset por email" continua disponível (vai voltar a fazer sentido quando você tiver domínio Resend), mas o caminho default agora é o sem-email.',
      '⚠ Master: rode /api/admin-migrate-password-reset-flag em prod pra criar as colunas password_reset_pending/expires_at/requested_by_user_id em users.'
    ]
  },
  {
    version: 'V37.4.29',
    date: '2026-06-12',
    title: 'State agora é per-tenant — colaboração real entre membros',
    bullets: [
      'Antes: cada user tinha seu próprio "LeadJourney" isolado (journey_state.PK = user_id). User convidado pelo owner entrava num workspace vazio — multi-tenant V32 ficou meio truncado.',
      'Agora: nova tabela tenant_state (PK = tenant_id) — owner edita produtos/campanhas/ações e todos os membros do mesmo tenant veem em tempo real (depois do próximo F5 ou sync de 60s).',
      'Dual-write transitório: salva em tenant_state (source of truth) e em journey_state legado (backup). Rollback é trivial caso algo dê ruim. Quando Felipe validar 1-2 dias, removo o write em journey_state.',
      'Last-write-wins entre membros — coluna last_writer_user_id audita quem escreveu por último.',
      '⚠ Master: rode /api/admin-migrate-tenant-state em prod logado como cada tenant. Importa o state do owner pra tenant_state. Sem isso, o tenant continua lendo journey_state legado (compat backward total).'
    ]
  },
  {
    version: 'V37.4.28',
    date: '2026-06-12',
    title: 'Modal Editar Membro refeito + reset de senha / troca de email por link',
    bullets: [
      'Modal "Editar membro" reorganizado em 3 blocos: Role & permissões (com botão "Customizar permissões granulares" que abre sub-modal sobreposto), Ações de conta (2 botões novos), Zona de perigo (Remover).',
      'Botão "Enviar reset de senha por email" — owner clica, membro recebe email com link mágico pra criar nova senha sem precisar saber a atual. Link válido por 7 dias.',
      'Botão "Solicitar troca de email" — membro recebe email no endereço ATUAL, abre o link, informa o novo email + confirma com senha atual. Owner não vê nem troca direto — quem confirma é quem ainda controla o email.',
      'Página pública /user-action.html processa os 2 fluxos. Tokens vivem em nova tabela user_action_tokens (action_type, expires_at, used_at). Mesmo feedback honesto do Resend (verde / vermelho com motivo / amarelo) aparece dentro do modal pai.',
      '⚠ Master: rode /api/admin-migrate-user-action-tokens em prod no primeiro deploy pra criar a tabela.'
    ]
  },
  {
    version: 'V37.4.27',
    date: '2026-06-12',
    title: 'Cancelar convite pendente',
    bullets: [
      'Lista de "Convites pendentes" ganhou botão "Cancelar" vermelho ao lado de "Copiar link". Confirma antes de deletar.',
      'Cancelar invalida o link de aceite imediatamente — útil pra limpar tentativas de teste, emails errados ou convites que não vão mais ser aceitos.',
      'Endpoint POST /api/tenant-invite-cancel: Master ou owner do tenant. Rejeita se convite já foi aceito (manda usar painel de Membros pra remover).'
    ]
  },
  {
    version: 'V37.4.26',
    date: '2026-06-12',
    title: 'Fix crítico: aceite de convite estava bloqueado por auth',
    bullets: [
      'Endpoints /api/tenant-invite-info e /api/tenant-invite-accept tinham comentário "público" mas o middleware do servidor exigia JWT. Resultado: convidado clicava no link do email e via "Não autenticado" — fluxo de aceite quebrado desde V37.3.3.',
      'Fix: ambos entram em PUBLIC_API_ROUTES no server.js. Token do convite vira a credencial (validado no body/query).'
    ]
  },
  {
    version: 'V37.4.25',
    date: '2026-06-12',
    title: 'Convite: feedback honesto quando Resend recusa o envio',
    bullets: [
      'Antes: SMTP configurado mas Resend recusava → UI dizia "SMTP não configurado" (mentira). Comum no sandbox @resend.dev que só entrega pro email dono da conta.',
      'Agora: 3 estados explícitos no resultado do convite. Verde = enviado. Vermelho = Resend recusou (mostra motivo + status HTTP + dica do sandbox). Amarelo = SMTP não configurado.',
      'Backend devolve emailError + emailErrorStatus separadamente pra UI rotular certo.'
    ]
  },
  {
    version: 'V37.4.24',
    date: '2026-06-12',
    title: 'Minha Conta: trocar email + trocar senha + ver permissões',
    bullets: [
      'Trocar email de login agora é self-service. Configurações → Minha Conta → botão "Trocar" no campo E-mail. Modal sobreposto pede novo email + senha atual pra confirmar. Antes era "peça pro admin global".',
      'Trocar senha igual: botão "Trocar" no campo Senha → modal pede senha atual + nova (8+ chars) + confirmação.',
      'Bloco "Minhas permissões" mostra seu role e permissões customizadas. Botão "Ver detalhes" abre modal read-only com checklist categorizado (Visualização / Edição / Operações / Administração) marcando ✓ liberado ou ✗ bloqueado. Linha amarela = customização do Admin Master.',
      'Tudo passa por confirmação de senha atual antes de salvar. Rate limit de 5 tentativas por 15min em troca de senha.'
    ]
  },
  {
    version: 'V37.4.23',
    date: '2026-06-12',
    title: 'Permissions agora carregam no boot — abas role-gated aparecem direto',
    bullets: [
      'Bug: loadMyPermissions() só era chamado quando user plugava DB ou salvava nome. No boot normal nunca rodava, e App.state.userPermissions ficava null. Resultado: aba "Membros do Tenant" sumia de Configurações no F5 mesmo pra owner.',
      'Fix: main.js init() agora chama Actions.loadMyPermissions() 100ms depois do render inicial, em background. Também sincroniza App.state.user com App.currentUser.',
      'Resultado: F5 → permissões carregam sozinhas → abas role-gated aparecem sem precisar rodar comando manual no console.'
    ]
  },
  {
    version: 'V37.4.21',
    date: '2026-06-12',
    title: 'Permission resolver lê default_tenant_id quando JWT é pré-V37',
    bullets: [
      'Helper resolveUserPermissions/checkPermission caía em "Sem tenant ativo" quando o JWT do user foi emitido antes do tenantId virar parte do payload. Apenas Sansone batia nisso porque o login dele é antigo.',
      'Fix: fallback pra users.default_tenant_id quando req.user.tenantId vem vazio. Continua o fluxo normal e enxerga membership.',
      'Resultado: aba "Membros do Tenant" volta a aparecer pro Sansone sem precisar deslogar/relogar pra gerar JWT novo.'
    ]
  },
  {
    version: 'V37.4.20',
    date: '2026-06-12',
    title: 'Self-healing de membership pra logins legados (pré-V37.3)',
    bullets: [
      'Users criados antes do V37.3 não tinham row em tenant_members — só apareciam em users com default_tenant_id. Resultado: nenhuma permissão efetiva, aba "Membros do Tenant" sumia do menu de Configurações mesmo pro dono.',
      'Boot detecta esse estado (role=null sem isMaster) e roda backfill self-service: cria a row faltante. Se ninguém mais é owner do tenant, promove pra owner; senão, vira user (owner promove depois).',
      'Resultado: dono do tenant logado pela primeira vez pós-V37.3 já cai com role=owner e enxerga gestão de membros sem precisar de SQL manual.'
    ]
  },
  {
    version: 'V37.4.19',
    date: '2026-06-12',
    title: 'Clusters de notificação ganham label humano por tipo + recolher fácil',
    bullets: [
      'Cluster genérico "4 eventos da mesma fonte" virou texto específico por tipo: "4 atualizações do LeadJourney", "3 campanhas criadas", "5 pins pra você". Cada kind tem seu próprio label.',
      'Agrupamento mudou de (source + categoria) pra (source + KIND). Antes 1 product_created + 1 campaign_created juntos viravam "2 eventos" — agora ficam separados porque são tipos diferentes.',
      'Cluster expandido mostra rodapé com "Mostrando X de Y" + botão "Recolher" explícito. Antes precisava re-clicar no header pra fechar.',
      'Chip "Expandido" violet aparece no header quando o cluster está aberto pra deixar visível o estado atual.'
    ]
  },
  {
    version: 'V37.4.17',
    date: '2026-06-12',
    title: 'NotificationSync.forceRun() ignora cooldown — pra populate manual',
    bullets: [
      'run() padrão respeita cooldown de 5min entre execuções pra não bombardear a API. Mas travava o reset manual quando o user queria popular histórico pelo console.',
      'forceRun() pula o shouldRun check e roda os 8 _check imediatamente.',
      'Uso: window.NotificationSync.forceRun() em vez de .run()'
    ]
  },
  {
    version: 'V37.4.16',
    date: '2026-06-12',
    title: 'Releases viram notification individual + badge não soma releases duas vezes',
    bullets: [
      'Badge mostrava 22 e drawer 1 porque _checkReleases criava só 1 notification (a mais recente) e o bellButton somava releases_unseen (22) no total. Discrepância gritante.',
      '_checkReleases agora itera as 5 releases mais recentes não vistas e cria 1 notification pra cada (entityId=versão, dedup garante que não duplica em runs subsequentes). Depois marca lastSeenVersion como a mais recente pra não acumular release ancestrais.',
      'bellButton removeu releaseCount do somatório legacy — cada release agora está em counts.inbox via notification real, não precisa contar 2 vezes.'
    ]
  },
  {
    version: 'V37.4.15',
    date: '2026-06-12',
    title: 'Card "Bom Dia" big-bang vira chip discreto',
    bullets: [
      'Versão V37.4.4 entregou o resumo da home como banner grande com fundo branco, saudação, badges, highlights — destoava do tema dark e ocupava altura demais pra avisar "1 novidade".',
      'Substituído por chip pequeno arredondado violet no topo do Home — exemplo: "5 atualizações desde ontem →". Click abre o sininho com a lista completa. Atende o pedido original (resumo na home) sem interrupção visual.',
      'Versão antiga preservada como renderFull_DEPRECATED_V37_4_15() pra histórico, mas não é mais chamada.'
    ]
  },
  {
    version: 'V37.4.14',
    date: '2026-06-12',
    title: 'admin-migrate-permissions também aceita Owner (era Master only)',
    bullets: [
      'tenant-members-list retornava 500 porque tentava SELECT permissions_overrides em tenant_members — coluna criada pela migration admin-migrate-permissions, que ainda exigia Master Global.',
      'Afrouxado pra aceitar Owner do tenant ativo (igual fizemos com as 3 migrations tenant-scoped em V37.4.11). Migration é idempotente (IF NOT EXISTS) e só ADD coluna + cria tabela tenant_invites — sem modificar dados.',
      'Encerra a sequência de erros 500 ao listar membros / abrir sininho com pipeline V2.'
    ]
  },
  {
    version: 'V37.4.13',
    date: '2026-06-12',
    title: 'Audience { role } no notification-engine fica case-insensitive',
    bullets: [
      'expandAudience() do notification-engine fazia match estrito role = $2. Se o tenant_members tinha "Owner" ou "OWNER" salvo (legado pré-V37.3.1), a notification não chegava a ninguém — payload era criado mas audience expandia pra array vazio.',
      'Agora usa LOWER(role) = LOWER($2). Compatível com qualquer capitalização salva.'
    ]
  },
  {
    version: 'V37.4.12',
    date: '2026-06-12',
    title: 'Drawer do sininho passa por cima da TopBar quando aberto',
    bullets: [
      'TopBar estava em z-50 e drawer do sininho em z-40 — quando o drawer abria, os botões da TopBar ficavam aparecendo sobrepostos.',
      'Drawer agora vai pra z-[60]. Cobre limpo a TopBar inteira.'
    ]
  },
  {
    version: 'V37.4.11',
    date: '2026-06-12',
    title: 'Migrations tenant-scoped aceitam Owner do tenant (não só Master LJ)',
    bullets: [
      'admin-migrate-notifications, admin-migrate-pins e admin-migrate-notification-prefs deixam de exigir Master LJ global e aceitam Owner do tenant ativo. Faz sentido: as 3 migrations criam schema no DB do PRÓPRIO tenant que o user opera.',
      'admin-migrate-permissions continua Master only porque mexe em control plane (users + tenants).',
      'Bloqueio que travava o Felipe (logado como Sansone, owner do tenant Sansone) — agora ele consegue rodar as 3 migrations e o sininho V2 funciona end-to-end.'
    ]
  },
  {
    version: 'V37.4.10',
    date: '2026-06-12',
    title: 'TopBar enfim na direita — movida pra root próprio fora do #app',
    bullets: [
      'A TopBar com search/sininho/pin/data estava aparecendo no canto superior esquerdo (em cima do logo) em vez do direito. Causa: parent #app tem transform de card-enter animation, e position:fixed dentro de elemento com transform passa a ser relativo ao elemento, não ao viewport.',
      'Mesma armadilha que o Djow caiu em V26.0.4. Solução igual: novo div #topBarRoot fora do #app pra renderizar a TopBar separadamente.',
      'main.js agora renderiza a TopBar em #topBarRoot ao invés de prepend no #app.innerHTML. Position fixed volta a funcionar relativo ao viewport.'
    ]
  },
  {
    version: 'V37.4.9',
    date: '2026-06-12',
    title: 'Sininho V2: migração completa dos 5 alertas legados + click roteia pra ação certa',
    bullets: [
      'Migração que faltava da V37.4.5: NotificationSync agora cobre TODOS os alertas que viviam no sininho legado. Cada um vira notification de verdade no drawer V2, com payload de action no data.',
      'Lead Import Reports → operational/info. Releases LJ (changelog) → event/info. Ads órfãs → operational/warning. GA4 alertas → integration/warning. Fechamento mensal pendente → operational/warning.',
      'Actions.handleNotificationClick ganha switch por data.action: open_recon abre modal de conciliação, open_import_reports abre wizard de import, open_releases abre changelog, open_ads_orphans navega pro Dashboard de Ads, open_ga4 abre wizard GA4, open_monthly_closing leva pro RevOps.',
      'Como NotificationSync roda a cada 1min e usa dedup de 24h, esses alertas vão sendo criados sem duplicar. Cliente clica e cai exatamente onde deveria — não fica mais sem destino.',
      'Posição da TopBar: travada com inline style (position:fixed;top:12px;right:16px;z-index:50) pra garantir o canto direito mesmo se algum CSS de ancestor tentar mudar containing block.'
    ]
  },
  {
    version: 'V37.4.8',
    date: '2026-06-12',
    title: 'TopBar sem faixa de fundo — ícones flutuam livres no canto',
    bullets: [
      'A faixa de fundo slate-950 + border-bottom da TopBar destoava do visual. Agora os 4 botões (search, sininho, pin, data) flutuam livres no canto superior direito (fixed top-3 right-4 z-50) sem container.',
      'Cada botão e a pill de data têm fundo próprio slate-900/80 com backdrop-blur — fica legível sobre qualquer cor de fundo do painel atrás (dark, gradient, claro).',
      'Shadow sutil em cada elemento individual pra criar profundidade sem precisar de faixa.'
    ]
  },
  {
    version: 'V37.4.7',
    date: '2026-06-12',
    title: 'TopBar: trocada de fixed flutuante pra sticky no flow (não cobre mais o conteúdo)',
    bullets: [
      'Versão anterior da TopBar usava fixed top-3 right-4 e flutuava sobre o conteúdo — estava cobrindo títulos das páginas.',
      'Agora a TopBar é sticky top-0 ocupando full width do container, com flex-justify-end pra manter os botões alinhados à direita. Empurra todo o conteúdo pra baixo naturalmente.',
      'Fundo passa de slate-900/90 com bordas pra slate-950/85 com border-bottom slate-800 — visual mais integrado com header dark do LJ.',
      'Conteúdo das páginas volta a aparecer inteiro a partir do topo sem precisar de padding extra.'
    ]
  },
  {
    version: 'V37.4.6',
    date: '2026-06-12',
    title: 'Notificações: preferences por categoria + opt-in digest semanal por email',
    bullets: [
      'Nova section "Notificações" em Configurações. Tabela com 6 categorias (handoff, eventos, estado, operacional, integração, saúde) × 2 colunas (Sininho / Email) com checkboxes pra cada combinação.',
      'Defaults sensatos: tudo no sininho, email só pra handoff e integração (crítico) e saúde (Master). Cliente customiza conforme preferir.',
      'Card "Digest semanal" abaixo: toggle pra optar receber email toda segunda 9h com resumo dos últimos 7 dias (total + breakdown por severidade + top categorias + até 3 highlights críticos).',
      'Save otimista — toggle no checkbox aplica na UI imediato e persiste em background. Se falhar, reverte com toast de erro.',
      'Endpoints novos: GET/POST /api/notification-preferences. Migration em /api/admin-migrate-notification-prefs (cria tabelas notification_preferences + notification_digest_optins).',
      'Endpoint manual /api/admin-send-weekly-digest (POST, Master only) — Felipe roda quando quiser OU pluga GitHub Actions cron pra rodar toda segunda automaticamente. Detalhes na seção pendências.'
    ]
  },
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
