# Backups do LeadJourney

Pasta onde ficam snapshots da **base de dados do master (Felipe)** salvos manualmente antes de updates que mexem em normalize, migrations ou schema do state.

## Por que existe

3 bugs históricos (V31.0.1, V31.0.4, V31.0.7) mostraram que mudanças em
`State.normalize()` ou migrations podem **silenciosamente apagar campos
persistidos** quando o frontend recarrega. Mesmo com o warning preventivo
em [src/core/state.js:643](../src/core/state.js#L643), bugs assim podem
escapar do review.

Esses backups são a **rede de segurança final**: arquivo JSON com o
state inteiro, antes de cada update potencialmente destrutivo. Se algo
quebrar em produção, dá pra restaurar.

## Protocolo (Claude segue)

Antes de qualquer commit que **toque** os seguintes pontos, Claude DEVE
pedir ao master pra rodar o snapshot e commitar nesta pasta ANTES de
pushar o código:

- `src/core/state.js` — qualquer `normalize*`, `applyMigrations`, ou shape de `App.state`
- `src/services/databaseService.js` — `applyMigrations`
- `src/engines/leadIdentityEngine.js` — `normalizeLead`, `merge`
- `src/engines/leadParser.js` — `normalizeLead`
- `src/engines/scoreEngine.js` — funções que leem `App.state.*`
- `src/strategic-map/strategicMapEngine.js` — `ensure`, `addProductKr`, `save`, etc.
- `server.js` — `runMigrations` (afeta tabela `journey_state`)
- Qualquer endpoint em `api/` que faça mutation de state ou shape mudou

## Como fazer o backup (master)

1. Loga como master no LJ
2. Abre DevTools Console (F12 → Console)
3. Roda:
   ```js
   copy(JSON.stringify(App.state, null, 2))
   ```
4. Vai em `backups/`, cria arquivo `Vxx.x.x-pre-update.json` e cola
5. Commita esse arquivo ANTES do push do código novo
6. Se algo quebrar pós-deploy, abre o arquivo, copia o JSON e cola via:
   ```js
   App.state = JSON.parse(`...colado aqui...`); App.save(); App.render();
   ```

## Naming convention

```
backups/
  V31.2.8-pre-V31.2.9-normalize-spread.json  ← state antes do refactor
  V31.3.0-pre-V31.4.0-schema-migration.json  ← antes de mudança grande
```

Formato: `<versão_atual>-pre-<versão_alvo>-<motivo-curto>.json`

## Quem precisa fazer backup

Só o **master** (Felipe). Demo state vem do seed (re-aplica automaticamente
a cada bump de `DEMO_SEED_VERSION`). Production users futuros vão precisar
do mesmo protocolo via Settings > Snapshots (tabela `journey_snapshots`
no DB já guarda isso server-side).

## Versão do server-side

O DB também guarda snapshots em `journey_snapshots` (V31.0.4+, scoped por
`owner_user_id`). Esses backups em arquivo são complementares — mais
seguros se a tabela do DB for corrompida ou o user perder acesso.
