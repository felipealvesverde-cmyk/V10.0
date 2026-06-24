// V40.14.10 — Popula lj_rd_deals do tenant demo com deals emulados em pipeline
// CRM. Espelho do admin-populate-demo-hotmart.js, mas pro modo CRM. Insere
// direto na tabela (pula webhooks do RD) e mantém schema 1:1 com o que o
// webhook do RD geraria.
//
// "Uma emulação" (Felipe 2026-06-24): Pilsen no demo despluga Hotmart como
// fonte de venda e plugar CRM, como se o RD estivesse mandando dados do funil.
// Permite testar a Onda CRM da Velocity ANTES de implementar a infra real de
// sincronização do RD (lj_rd_deals persistido por webhook).
//
// Distribuição realista pra Pilsen Atacado (cervejaria → bar/restaurante/etc):
//   - 50 deals won (10%)      — clientes que fecharam contrato no período
//   - 150 deals pipeline (30%) — em algum estágio aberto (qualified/proposal/negotiation)
//   - 300 deals lost (60%)    — disseram não ou abandonaram
//   Total: 500 deals nos últimos 6 meses
//
// Volume mantido próximo do que tinha em Hotmart (~122k cervejas) distribuído
// entre 50 clientes won por perfil:
//   - 6 distribuidoras: 1200 cervejas/mês × 6 meses = 7200/contrato = R$ 158k cada
//   - 8 hotéis/pousadas: 700 × 6 = 4200/contrato = R$ 92k cada
//   - 10 restaurantes: 400 × 6 = 2400/contrato = R$ 53k cada
//   - 10 bares: 200 × 6 = 1200/contrato = R$ 26k cada
//   - 12 barzinhos: 90 × 6 = 540/contrato = R$ 12k cada
//   - 2 mercados: 150 × 6 = 900/contrato = R$ 20k cada
//   - 2 eventos: 600 (compra única) = R$ 13k cada
//   Total: ~122k cervejas × R$22 = ~R$2.7M em contratos fechados em 6 meses
//
// Também LIMPA vendas Hotmart do produto (despluga checkout) — Pilsen vira
// CRM-puro no demo.
//
// Body:
//   { productId: 1781869701831 }
//
// Retorna: { ok, insertedDeals, deletedHotmart, byCategoria, totalCervejas }

const BATCH_SIZE = 100;

const PERFIS_WON = [
  {
    categoria: 'distribuidora',
    nomes: ['Distribuidora Sul Bebidas', 'Atacadão Bevida do Norte', 'Distribuidora Pampa', 'BPS Distribuidora Sudeste', 'Comercial Bevita SP', 'Maxi Distribuidora Bebidas'],
    cervejasPorMes: 1200
  },
  {
    categoria: 'hotel',
    nomes: ['Hotel Beira Mar', 'Pousada do Vale', 'Resort Águas Cristalinas', 'Hotel Continental', 'Pousada Recanto Verde', 'Hotel Praia Norte', 'Pousada Mata Verde', 'Hotel Centro Histórico'],
    cervejasPorMes: 700
  },
  {
    categoria: 'restaurante',
    nomes: ['Restaurante Boi Brabo', 'Cantina da Nonna', 'Tasca do Português', 'Restaurante Manga Rosa', 'Bistrô da Esquina', 'Restaurante do Tinho', 'Maria Bonita Steakhouse', 'Forno de Pedra Pizzaria', 'Empório Gastronômico', 'Casa do Sabor'],
    cervejasPorMes: 400
  },
  {
    categoria: 'bar',
    nomes: ['Bar do Tião', 'Pub Galway', 'Caverna do Drink', 'Boteco do Zé', 'Bar da Esquina', 'The Old Wolf Pub', 'Bar Sentidos', 'Tap House Beer', 'Bar Fica Aqui', 'Boteco do Mineiro'],
    cervejasPorMes: 200
  },
  {
    categoria: 'barzinho',
    nomes: ['Boteco do Seu João', 'Bar do Carlinhos', 'Lanchonete Comércio', 'Bar da Vó', 'Boteco Saideira', 'Lanchonete 24h', 'Bar Cantinho', 'Boteco do Beto', 'Lanche do Cabral', 'Bar Pequeno Grande', 'Bar dos Amigos', 'Boteco Esperança'],
    cervejasPorMes: 90
  },
  {
    categoria: 'mercado',
    nomes: ['Mercado Central Sul', 'Supermercado Família'],
    cervejasPorMes: 150
  },
  {
    categoria: 'evento',
    nomes: ['Festa Junina Centro', 'Evento Corporativo TechSP'],
    cervejasPorMes: 600,
    compraUnica: true
  }
];

// Pool de nomes pra deals NÃO ganhos (lost + pipeline). Vão ser sorteados.
const NOMES_PROSPECT = [
  'Bar do João', 'Restaurante Lua Cheia', 'Pousada Sol Posto', 'Boteco Cantinho',
  'Distribuidora Rio Grande', 'Hotel Vista Linda', 'Restaurante Tempero',
  'Bar Saideira', 'Lanchonete Esperança', 'Mercado do Bairro',
  'Pub Old Times', 'Tasca Lusitana', 'Bar Encontros', 'Restaurante Forno a Lenha',
  'Boteco Tradicional', 'Hotel Pé na Areia', 'Pousada das Flores',
  'Bar do Carlinhos Jr', 'Lanche Express', 'Distribuidora Bebida Boa',
  'Restaurante Cantinho da Roça', 'Hotel Boutique Centro', 'Bar do Pedro',
  'Pub Whisky & Cervejas', 'Mercado Bom Preço', 'Boteco Esquina Feliz',
  'Restaurante Maçã Verde', 'Hotel Brisa Tropical', 'Bar Aconchego',
  'Distribuidora 24 Horas', 'Lanche Bom Apetite', 'Pousada Recanto',
  'Bar Rua Augusta', 'Restaurante Paladar', 'Boteco do Centro',
  'Hotel Continental Norte', 'Bar Tropical', 'Pousada Verde Vale',
  'Restaurante Sabor Caseiro', 'Lanchonete da Praça', 'Mercado União',
  'Pub Cervejaria Local', 'Bar Boêmio', 'Hotel Vista Mar Plus',
  'Restaurante Família Italiana', 'Bar Black Stout', 'Pousada Cantinho',
  'Boteco do Senhor', 'Lanche da Hora', 'Distribuidora Express',
  'Bar Beer House', 'Restaurante Sushi Bar', 'Hotel Praia Sul',
  'Pousada Verde Mata', 'Bar Pulsing', 'Lanchonete Bom Sabor',
  'Mercado Central Norte', 'Pub Drink Up', 'Boteco da Rua',
  'Hotel Centro Histórico Sul', 'Bar Reggae House', 'Restaurante Casa Velha',
  'Bar do Lula', 'Pousada Linda Vista', 'Lanche Forno e Fogão',
  'Distribuidora Atlas', 'Restaurante Carnes Nobres', 'Bar Rock Bar',
  'Mercado Bom de Preço', 'Hotel Brisa Suave', 'Pousada Quero Quero',
  'Bar do Centro', 'Lanchonete Sucos & Cia', 'Boteco da Vila',
  'Restaurante Casa do Pedreiro', 'Hotel Mirante Sul', 'Bar Casa Cheia',
  'Pousada Janela do Mar', 'Lanche Pratos Feitos', 'Mercado Mãe Terra',
  'Pub Beer & Friends', 'Bar do Tarso', 'Restaurante Gastronomia Brasil',
  'Hotel Praia Reserva', 'Distribuidora Reservada', 'Boteco Bom Bocado',
  'Bar de Bairro', 'Pousada da Serra', 'Lanche da Tia',
  'Mercado de Bairro Plus', 'Hotel Tropical Suites', 'Bar do Antonio',
  'Restaurante Sabor de Casa', 'Pousada Praia Limpa', 'Boteco Vila Nova',
  'Bar Pequena Pausa', 'Lanche Ambiental', 'Distribuidora Cidade Alta',
  'Hotel Convencional', 'Pousada Beira Rio', 'Bar Conexão'
];

const PIPELINE_STAGES_OPEN = ['qualified', 'proposal', 'negotiation'];

const VALOR_POR_CERVEJA_CENTS = 2200;  // R$ 22 — mantém paridade com Hotmart

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  const isAllowed = req.user.isMaster || req.user.username === 'demo@leadjourney.app';
  if (!isAllowed) return res.status(403).json({ ok: false, message: 'Permissão negada.' });

  const { productId } = req.body || {};
  if (!productId) return res.status(400).json({ ok: false, message: 'productId obrigatório.' });

  try {
    const DEMO_USERNAME = 'demo@leadjourney.app';
    const userRow = await req.db.query('SELECT id FROM users WHERE username = $1', [DEMO_USERNAME]);
    const demoUserId = userRow.rows[0]?.id;
    if (!demoUserId) return res.status(404).json({ ok: false, message: 'User demo não existe.' });

    const tenantPoolHelper = require('../lib/tenant-pool');
    const tenantInfo = await req.db.query('SELECT default_tenant_id FROM users WHERE id = $1', [demoUserId]);
    const tenantId = tenantInfo.rows[0]?.default_tenant_id;
    let tenantDb = req.db;
    if (tenantId) {
      try { tenantDb = await tenantPoolHelper.getTenantPool(req.db, tenantId); } catch (_) { tenantDb = req.db; }
    }
    if (!tenantDb) tenantDb = req.db;

    // Auto-bootstrap da tabela lj_rd_deals — schema espelhando o que o webhook
    // do RD persistido em onda futura geraria. Idempotente.
    await tenantDb.query(`
      CREATE TABLE IF NOT EXISTS lj_rd_deals (
        id BIGSERIAL PRIMARY KEY,
        user_id INT NOT NULL,
        product_id_lj BIGINT,
        rd_deal_id VARCHAR(64),
        contact_email VARCHAR(255),
        contact_company VARCHAR(255),
        pipeline_stage VARCHAR(32) NOT NULL DEFAULT 'prospecting',
        deal_value_cents BIGINT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        closed_at TIMESTAMPTZ,
        won BOOLEAN DEFAULT FALSE,
        lost BOOLEAN DEFAULT FALSE,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS lj_rd_deals_user_product_idx
        ON lj_rd_deals(user_id, product_id_lj);
      CREATE INDEX IF NOT EXISTS lj_rd_deals_created_at_idx
        ON lj_rd_deals(created_at);
    `);

    // Limpa estado anterior: deals existentes + vendas Hotmart do produto.
    // "Despluga Hotmart e pluga CRM" — Pilsen vira CRM puro no demo.
    const delDealsR = await tenantDb.query(
      `DELETE FROM lj_rd_deals WHERE user_id = $1 AND product_id_lj = $2`,
      [demoUserId, productId]
    );
    const delHotmartR = await tenantDb.query(
      `DELETE FROM lj_hotmart_purchases WHERE user_id = $1 AND product_id_lj = $2`,
      [demoUserId, productId]
    );

    // Gera deals em 3 baldes — won, pipeline aberto, lost.
    const now = Date.now();
    const sixMonthsMs = 180 * 86400 * 1000;
    const rand = (min, max) => Math.random() * (max - min) + min;
    const randInt = (min, max) => Math.floor(rand(min, max + 1));
    const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];

    const deals = [];
    const byCategoria = {};
    let totalCervejas = 0;
    let dealCounter = 0;

    // 1) Deals WON — 50 clientes em perfis estratificados.
    PERFIS_WON.forEach(perfil => {
      perfil.nomes.forEach(nomeEmpresa => {
        const cervejas = perfil.compraUnica
          ? perfil.cervejasPorMes
          : perfil.cervejasPorMes * 6;
        const dealValueCents = cervejas * VALOR_POR_CERVEJA_CENTS;
        const createdMsAgo = randInt(60 * 86400 * 1000, sixMonthsMs);  // 2 a 6 meses atrás
        const cycleDays = randInt(30, 90);  // ciclo 30-90 dias
        const createdAt = new Date(now - createdMsAgo);
        const closedAt = new Date(now - createdMsAgo + cycleDays * 86400 * 1000);
        // Safety: se closed_at ficou no futuro, ajusta pra hoje-1
        const safeClosedAt = closedAt.getTime() > now ? new Date(now - 86400 * 1000) : closedAt;
        dealCounter++;
        deals.push({
          rd_deal_id: `demo-rd-${productId}-${String(dealCounter).padStart(4, '0')}`,
          contact_company: nomeEmpresa,
          contact_email: nomeEmpresa.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '') + '@email.demo',
          pipeline_stage: 'won',
          deal_value_cents: dealValueCents,
          created_at: createdAt.toISOString(),
          closed_at: safeClosedAt.toISOString(),
          won: true,
          lost: false
        });
        byCategoria[perfil.categoria] = (byCategoria[perfil.categoria] || 0) + 1;
        totalCervejas += cervejas;
      });
    });

    // 2) Deals PIPELINE ABERTO — 150 deals em qualified/proposal/negotiation.
    for (let i = 0; i < 150; i++) {
      const perfil = pickOne(PERFIS_WON);
      const cervejasEstimadas = perfil.compraUnica
        ? perfil.cervejasPorMes
        : perfil.cervejasPorMes * 6;
      const dealValueCents = cervejasEstimadas * VALOR_POR_CERVEJA_CENTS;
      const createdMsAgo = randInt(86400 * 1000, 90 * 86400 * 1000);  // 1 a 90 dias atrás
      const createdAt = new Date(now - createdMsAgo);
      dealCounter++;
      deals.push({
        rd_deal_id: `demo-rd-${productId}-${String(dealCounter).padStart(4, '0')}`,
        contact_company: pickOne(NOMES_PROSPECT) + ` ${i + 1}`,
        contact_email: `prospect.${dealCounter}@email.demo`,
        pipeline_stage: pickOne(PIPELINE_STAGES_OPEN),
        deal_value_cents: dealValueCents,
        created_at: createdAt.toISOString(),
        closed_at: null,
        won: false,
        lost: false
      });
    }

    // 3) Deals LOST — 300 deals perdidos ao longo de 6 meses.
    for (let i = 0; i < 300; i++) {
      const perfil = pickOne(PERFIS_WON);
      const cervejasEstimadas = perfil.compraUnica
        ? perfil.cervejasPorMes
        : perfil.cervejasPorMes * 6;
      const dealValueCents = cervejasEstimadas * VALOR_POR_CERVEJA_CENTS;
      const createdMsAgo = randInt(7 * 86400 * 1000, sixMonthsMs);
      const cycleDays = randInt(10, 60);
      const createdAt = new Date(now - createdMsAgo);
      const closedAt = new Date(now - createdMsAgo + cycleDays * 86400 * 1000);
      const safeClosedAt = closedAt.getTime() > now ? new Date(now - 86400 * 1000) : closedAt;
      dealCounter++;
      deals.push({
        rd_deal_id: `demo-rd-${productId}-${String(dealCounter).padStart(4, '0')}`,
        contact_company: pickOne(NOMES_PROSPECT) + ` ${300 + i + 1}`,
        contact_email: `prospect.${dealCounter}@email.demo`,
        pipeline_stage: 'lost',
        deal_value_cents: dealValueCents,
        created_at: createdAt.toISOString(),
        closed_at: safeClosedAt.toISOString(),
        won: false,
        lost: true
      });
    }

    // Bulk insert em batches.
    let inserted = 0;
    for (let i = 0; i < deals.length; i += BATCH_SIZE) {
      const batch = deals.slice(i, i + BATCH_SIZE);
      const values = [];
      const placeholders = [];
      batch.forEach((d, idx) => {
        const base = idx * 11;
        placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11})`);
        values.push(
          demoUserId,
          productId,
          d.rd_deal_id,
          d.contact_email,
          d.contact_company,
          d.pipeline_stage,
          d.deal_value_cents,
          d.created_at,
          d.closed_at,
          d.won,
          d.lost
        );
      });
      await tenantDb.query(
        `INSERT INTO lj_rd_deals
          (user_id, product_id_lj, rd_deal_id, contact_email, contact_company,
           pipeline_stage, deal_value_cents, created_at, closed_at, won, lost)
         VALUES ${placeholders.join(', ')}`,
        values
      );
      inserted += batch.length;
    }

    res.json({
      ok: true,
      insertedDeals: inserted,
      deletedHotmart: delHotmartR.rowCount || 0,
      deletedPreviousDeals: delDealsR.rowCount || 0,
      summary: {
        won: 50,
        pipelineOpen: 150,
        lost: 300,
        total: inserted
      },
      byCategoriaWon: byCategoria,
      totalCervejasContratadas: totalCervejas,
      totalReceitaContratadaCents: totalCervejas * VALOR_POR_CERVEJA_CENTS
    });
  } catch (err) {
    console.error('[admin-populate-demo-rd-deals] erro:', err);
    res.status(500).json({ ok: false, message: err.message || 'Erro interno' });
  }
};
