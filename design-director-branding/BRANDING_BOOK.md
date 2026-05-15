# LeadJourney — Design Director & Branding Book

## 1. Direção de Marca

LeadJourney é um **Revenue Operating System**. A interface deve parecer um cockpit de gestão de receita, não um CRM comum.

A experiência visual deve transmitir:

- inteligência operacional;
- controle;
- profundidade analítica;
- clareza executiva;
- segurança;
- tecnologia premium;
- sofisticação sem excesso visual.

## 2. Princípios de Design

### 2.1 Clareza antes de decoração
Todo elemento precisa ajudar o usuário a entender receita, jornada, produto, campanha, ação, fluxo ou gargalo.

### 2.2 Visual premium, mas funcional
Glassmorphism, gradientes e sombras devem reforçar profundidade e hierarquia, nunca atrapalhar leitura.

### 2.3 Setores sempre identificáveis por cor
Marketing, Vendas, CS e CX possuem cores próprias e não devem ser misturadas arbitrariamente.

### 2.4 Fluxo sempre visível
Fluxos precisam ser legíveis, com passagem clara entre estágios, sem sobreposição de cards, títulos ou indicadores.

### 2.5 Nada fora do sistema
Toda nova tela, card, botão, modal ou componente precisa seguir estes tokens, classes e padrões.

---

# 3. Paleta Oficial

## 3.1 Base

| Uso | Cor |
|---|---|
| Background principal | `#071326` |
| Background secundário | `#0F172A` |
| Card glass | `rgba(255,255,255,.055)` |
| Card glass hover | `rgba(255,255,255,.085)` |
| Borda glass | `rgba(255,255,255,.10)` |
| Texto principal | `#FFFFFF` |
| Texto secundário | `#CBD5E1` |
| Texto terciário | `#94A3B8` |

## 3.2 Cores por área

| Área | Primária | Secundária | Uso |
|---|---|---|---|
| Marketing | `#8B5CF6` | `#A78BFA` | TOF/MOF/BOF de Marketing, aquisição, intenção |
| Vendas | `#0EA5E9` | `#38BDF8` | pipeline comercial, handoff para vendas |
| CS | `#10B981` | `#34D399` | retenção, expansão, onboarding |
| CX | `#F59E0B` | `#FBBF24` | melhoria contínua, fricção, gestão de mudança |
| RevOps | `#6366F1` | `#818CF8` | inteligência operacional e auditoria de receita |

## 3.3 Estados

| Estado | Cor |
|---|---|
| Sucesso | `#10B981` |
| Atenção | `#F59E0B` |
| Erro/Drop | `#EF4444` |
| Informação | `#3B82F6` |
| Neutro | `#64748B` |

---

# 4. Tipografia

Fonte oficial:

```css
Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
```

## 4.1 Hierarquia

| Elemento | Tamanho | Peso | Uso |
|---|---:|---:|---|
| H1 | 36px–48px | 900 | Títulos de tela |
| H2 | 28px–32px | 800 | Seções principais |
| H3 | 20px–24px | 800 | Cards importantes |
| Body | 14px–16px | 400–600 | Conteúdo geral |
| Label | 11px–12px | 800–900 | Campos, status, chips |
| KPI | 28px–48px | 900 | Indicadores numéricos |

---

# 5. Espaçamento

Usar apenas a escala:

```txt
4 / 8 / 12 / 16 / 24 / 32 / 48 / 64
```

Não criar espaçamentos aleatórios.

---

# 6. Bordas e Cantos

| Componente | Radius |
|---|---:|
| Chips pequenos | 999px |
| Inputs | 14px–16px |
| Botões | 16px–20px |
| Cards | 24px |
| Modais | 32px |
| Containers hero | 40px |

---

# 7. Sombras

Sombra padrão:

```css
0 18px 36px rgba(0,0,0,.22)
```

Sombra premium:

```css
0 24px 60px rgba(0,0,0,.32)
```

Glow setorial apenas em estados ativos/hover.

---

# 8. Botões

## 8.1 Botão primário
Usado para ações principais: criar, salvar, aplicar, abrir fluxo.

- fundo contextual;
- texto claro;
- radius de 16px a 20px;
- hover com leve elevação;
- transição de 0.22s.

## 8.2 Botão secundário
Usado para ações auxiliares.

- fundo glass;
- borda glass;
- texto claro;
- hover com `background: rgba(255,255,255,.085)`.

## 8.3 Botão destrutivo
Usado para deletar/remover.

- vermelho com baixa opacidade;
- borda vermelha;
- texto vermelho claro;
- nunca usar vermelho sólido agressivo, exceto em confirmação crítica.

---

# 9. Cards

Todo card deve usar:

- fundo glass;
- border glass;
- radius de 24px;
- padding mínimo de 16px;
- sombra leve;
- hover suave quando clicável.

Nunca usar:
- cards brancos chapados dentro do tema dark;
- borda preta;
- sombra pesada sem blur;
- radius diferente do padrão.

---

# 10. Inputs e Selects

Inputs devem ter:

- fundo escuro;
- texto branco;
- placeholder slate;
- borda glass;
- focus contextual;
- label sempre visível quando o campo for crítico.

Selects precisam ter contraste forte. Nunca deixar texto branco sobre fundo branco.

---

# 11. Modais

Modais operacionais, como fluxo da ação e fluxo da campanha, devem:

- ser fullscreen ou quase fullscreen;
- manter header claro;
- ter botão fechar;
- ter conteúdo scrollável;
- preservar contexto;
- nunca criar nova aba principal.

---

# 12. Fluxos

## 12.1 Regras gerais

- fluxos podem ter scroll horizontal;
- cards não podem se sobrepor;
- drops não podem invadir cards;
- nomes de canal/local ficam acima do nome do estágio;
- cor do canal/local segue a cor do estágio;
- handoff deve ser visualmente marcado.

## 12.2 Cores de fluxo

| Tipo | Cor |
|---|---|
| Origem | Cor do setor |
| Passagem | Cor do setor |
| Handoff | Amber |
| Destino | Emerald |
| Drop | Red |

---

# 13. Ícones

Biblioteca oficial:

```txt
Lucide Icons
```

Regras:

- não misturar bibliotecas;
- ícones com stroke limpo;
- tamanho padrão entre 16px e 24px;
- ícones grandes apenas em cards de KPI ou estado vazio.

---

# 14. Aplicabilidade obrigatória

Toda nova implementação deve verificar:

- A cor pertence à paleta?
- O botão segue padrão?
- O card segue radius e glass?
- O modal respeita a estrutura?
- A tipografia está na escala?
- O fluxo está legível?
- A navegação principal foi preservada?
- O design não conflita com o Journey Pipeline?

---

# 15. Regra final

A partir da V12, qualquer criação visual deve seguir esta pasta como fonte de verdade.
