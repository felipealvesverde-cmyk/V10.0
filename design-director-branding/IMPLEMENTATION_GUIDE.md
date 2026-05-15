# Guia de Aplicabilidade — LeadJourney V12

## Antes de criar qualquer tela nova

1. Conferir `BRANDING_BOOK.md`.
2. Usar tokens de `designTokens.js`.
3. Usar classes de `leadjourney-design.css`.
4. Não criar estilo visual fora do padrão.
5. Não misturar bibliotecas de ícones.

## Checklist por componente

### Botão
- usa `lj-btn`?
- é primário, secundário ou danger?
- tem hover suave?
- respeita radius?

### Card
- usa `lj-card`?
- tem padding adequado?
- não tem fundo branco chapado?
- respeita glass?

### Modal
- usa `lj-modal-shell`?
- mantém contexto?
- tem botão fechar?
- não cria nova aba?

### Fluxo
- tem scroll horizontal quando necessário?
- não tem sobreposição?
- drops estão alinhados?
- cores por setor estão corretas?

### Tela
- H1 claro?
- KPIs legíveis?
- espaçamentos na escala?
- paleta oficial?

## Regra para IA/dev

Ao implementar qualquer patch futuro:
- primeiro leia esta pasta;
- depois implemente;
- ao final, valide contra este checklist.
