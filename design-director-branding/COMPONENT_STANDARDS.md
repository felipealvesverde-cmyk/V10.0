# LeadJourney — Component Standards

## Classes-base recomendadas

### Card
```html
<div class="lj-card">...</div>
```

### Card clicável
```html
<button class="lj-card lj-card-clickable">...</button>
```

### Botão primário
```html
<button class="lj-btn lj-btn-primary">Salvar</button>
```

### Botão secundário
```html
<button class="lj-btn lj-btn-secondary">Cancelar</button>
```

### Input
```html
<input class="lj-input" />
```

### Select
```html
<select class="lj-input"></select>
```

### Badge
```html
<span class="lj-badge lj-badge-marketing">Marketing</span>
```

## Regras

1. Componentes novos devem reutilizar estas classes.
2. Tailwind pode ser usado, mas não deve contrariar os tokens globais.
3. Evitar estilos inline, exceto posicionamentos específicos de fluxos.
4. Modais devem usar `lj-modal-shell`.
