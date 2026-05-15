# V12.1 — Master Navigation Refactor

## Objetivo
Padronizar a navegação master e os containers principais do LeadJourney para evitar abas desalinhadas, paddings diferentes, wrappers quebrados e cards fora da grid.

## Regra
Toda aba master deve respeitar:

- mesmo shell visual;
- mesmo container principal;
- mesmo espaçamento lateral;
- mesma altura de navegação;
- mesmo padrão de botão;
- mesmo padrão de active state;
- mesmo comportamento responsivo.

## Estrutura visual oficial

### Master Shell
Usar a classe:

```html
<div class="lj-master-shell">
```

### Sidebar / Navegação
Usar:

```html
<nav class="lj-master-nav">
```

### Item de navegação
Usar:

```html
<button class="lj-master-nav-item">
```

Estado ativo:

```html
<button class="lj-master-nav-item active">
```

### Conteúdo
Usar:

```html
<main class="lj-master-content">
```

### Container da página
Usar:

```html
<section class="lj-page-container">
```

### Header de página
Usar:

```html
<header class="lj-page-header">
```

## Abas master oficiais

Ordem recomendada:

1. Dashboard
2. Produtos
3. Campanhas
4. Leads
5. Journey Pipeline
6. RevOps AI
7. Configurações

## Regras críticas

- Não criar padding próprio fora do `lj-page-container`.
- Não criar sidebar isolada dentro de cada módulo.
- Não usar largura arbitrária para abas master.
- Não duplicar menu.
- Não usar botão com altura diferente no menu principal.
- Novas abas precisam entrar no mesmo array de navegação.

## Resultado esperado
Todas as abas devem parecer parte do mesmo sistema, sem desalinhamento visual entre Produtos, Campanhas, Leads e Journey Pipeline.
