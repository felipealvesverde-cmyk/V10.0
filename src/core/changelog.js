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
