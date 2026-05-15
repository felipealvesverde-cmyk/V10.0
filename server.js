// V21.7 — Servidor Node p/ Railway / qualquer host Node.
// Serve o front-end estático (index.html + src/styles/public) e monta os
// handlers serverless de ./api como rotas Express, mantendo a mesma
// assinatura (req, res) usada localmente pelo `vercel dev`.
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Monta cada arquivo de ./api/*.js em /api/<nome-do-arquivo>.
const apiDir = path.join(__dirname, 'api');
if (fs.existsSync(apiDir)) {
  for (const file of fs.readdirSync(apiDir)) {
    if (!file.endsWith('.js')) continue;
    const route = '/api/' + file.replace(/\.js$/, '');
    try {
      const handler = require(path.join(apiDir, file));
      const fn = typeof handler === 'function' ? handler : (handler && handler.default);
      if (typeof fn !== 'function') {
        console.warn(`[server] ${file} não exporta uma função — ignorado.`);
        continue;
      }
      app.all(route, (req, res) => {
        Promise.resolve(fn(req, res)).catch(err => {
          console.error(`[api ${route}]`, err);
          if (!res.headersSent) res.status(500).json({ ok: false, message: err?.message || 'Erro interno.' });
        });
      });
      console.log(`[server] mounted ${route}`);
    } catch (err) {
      console.error(`[server] falha ao carregar ${file}:`, err);
    }
  }
}

// Estáticos (apenas diretórios públicos — não expõe api/, electron/, .git, etc).
['src', 'styles', 'public', 'design-director-branding'].forEach(dir => {
  const p = path.join(__dirname, dir);
  if (fs.existsSync(p)) app.use('/' + dir, express.static(p));
});

// Raiz e SPA fallback → index.html (sem capturar /api/*).
const indexPath = path.join(__dirname, 'index.html');
app.get('/', (_req, res) => res.sendFile(indexPath));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ ok: false, message: 'Endpoint não encontrado.' });
  res.sendFile(indexPath);
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`LeadJourney rodando na porta ${PORT}`);
});
