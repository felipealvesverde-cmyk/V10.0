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

### 2.7 Snapshot pré-update — Lei (V22.1.1)

Antes de aplicar **qualquer atualização de código** que toque comportamento, estado ou integração externa, o estado atual do banco DEVE ser exportado e arquivado. Sem snapshot, sem deploy.

**Procedimento**:

1. No console do navegador (com `allow pasting` se necessário):
   ```js
   Actions.downloadStateSnapshot()
   ```
   Isto baixa um arquivo `leadjourney-snapshot-pre-V<x>.<y>.<z>-<timestamp>.json` automaticamente, contendo cópia integral de `App.state`.

2. Arquive o arquivo na pasta de snapshots local (sugestão: `./snapshots/<data>/`).

3. Só **depois** disso, aplique a atualização (Edit/Write/git push).

4. Em caso de regressão, restaure importando o snapshot via:
   - Configurações → Backup (UI), OU
   - Console: substituir state e dar reload — procedimento dependente do tipo de corrupção.

**Por que**: durante V21–V22 tivemos 2 incidentes de reset silencioso do localStorage. A salvaguarda implementada em V22.1.1 ([backup rotativo + recovery em load](../src/core/storage.js)) reduz o risco, mas snapshot exportado é a **última linha de defesa** quando localStorage falha ou é substituído pelo navegador.

**Quem aplica**: tanto humanos quanto agentes. Agentes devem **pedir confirmação explícita do snapshot** antes do primeiro Edit/Write de uma sessão que altera código de produção.

---

### 2.6 Versionamento — Lei (V21.2)
O badge `LeadJourney V<x>.<y>.<z>` no topo de toda página é **fonte de verdade** sobre a versão atual do produto e nunca pode ficar desatualizado. Regras vinculantes para qualquer atualização aplicada por humanos ou agentes:

| Tipo de atualização | Quem decide | Onde muda no número |
|---|---|---|
| **Grande** | Usuário sinaliza antes; se não sinalizar, o agente PERGUNTA antes de aplicar | Primeiro número (`V21` → `V22`) |
| **Média** | Usuário sinaliza antes; se não sinalizar, o agente PERGUNTA antes de aplicar | Número após o primeiro ponto (`V21.2` → `V21.3`) |
| **Pequena** (bugfix simples, copy, lint) | Usuário sinaliza antes; se não sinalizar, o agente PERGUNTA antes de aplicar | Número após o segundo ponto (`V21.2.0` → `V21.2.1`) |

Operacional:

- A versão vive em **uma única constante**: `window.LJVersion` em [src/core/version.js](../src/core/version.js).
- Atualizar essa constante é o único lugar onde se troca a versão — o badge em [src/main.js](../src/main.js) interpola dela.
- Toda mudança de versão deve estar no commit que aplica a atualização correspondente.
- Se o agente aplicar uma mudança sem saber o porte e o usuário não houver sinalizado, ele DEVE perguntar "essa é uma atualização grande, média ou pequena?" antes de qualquer Write/Edit.

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
