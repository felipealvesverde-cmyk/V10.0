# V12.1 — Contrast Fix Audit

## Objetivo
Corrigir textos brancos em quadros brancos/claros.

## O que foi aplicado

1. Adicionado arquivo:
`styles/contrast-fixes.css`

2. Linkado no `index.html` após os estilos principais.

3. Varredura automática em arquivos `.js` e `.html` para substituir classes óbvias:
- `bg-white` + `text-white` → texto escuro
- `bg-white` + `text-white/80` → `text-slate-600`
- fundos `slate-50/100` ou `gray-50/100` com textos claros → texto escuro

4. Mantidos cards glass escuros com texto claro:
- `bg-white/5`
- `bg-white/10`
- `.glass`
- `.lj-card`
- `.lj-modal-shell`

## Arquivos alterados por varredura direta

- src/main.js
- src/modules/actions.js
- src/modules/journeyPipeline.js
- src/modules/leads.js
- src/modules/actionFlowModal.js
- src/modules/products.js
- src/modules/settingsModal.js

## Regra para próximos patches
Qualquer componente com fundo claro deve usar:
- `text-slate-950`
- `text-slate-700`
- `text-slate-500`

Nunca usar `text-white` em card branco.
