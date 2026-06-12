## Documentação no Obsidian

A pasta de documentação deste projeto é:
C:\Felipeb\01 Projetos\LeadJourney

### Quando atualizar (REGRA CRAVADA — Felipe, 2026-06-04)

**Devlogs e notas só são atualizados em mudança de VERSÃO MASTER.**

A versão master é o primeiro número (`window.LJVersion = 'VXX.y.z'`).
Felipe segue semver custom (memória `feedback_versioning_law`):
- Grande (master): V35 → V36
- Média:           V35.13 → V35.14
- Pequena:         V35.14.0 → V35.14.1

**Quando atualizar Obsidian:**
- ✅ V35.x.x → V36.0   (master mudou) → SIM
- ❌ V35.13.5 → V35.14.0 (só média)    → NÃO
- ❌ V35.14.5 → V35.14.6 (só pequena)  → NÃO
- ❌ V35.14.x → V35.14.x+alpha          → NÃO

Razão: evita ruído. Devlog vira marco de master, cumulativo de TUDO
que rolou na master anterior (incluindo todas as médias/pequenas/alphas).

### O que fazer na mudança de master

Ao detectar bump de master (ex: subiu V35.x.x → V36.0):

1. **Criar devlog** com nome `YYYY-MM-DD - V<old>→V<new>.md`.
   - Resumo executivo do que a master anterior entregou (todas as
     médias e pequenas dela, lendo o changelog).
   - Decisões marcantes tomadas no ciclo.
   - Estado em que a nova master começou (o que ela traz de novo).
   - Próximos passos abertos.

2. **Atualizar `Arquitetura.md`** se a estrutura técnica mudou no
   ciclo (pastas novas, libs novas, padrões de comunicação alterados).

3. **Atualizar `Funcionalidades.md`** com features que ganharam vida
   na master anterior, com caminho exato no código.

4. **Atualizar `Integrações.md`** se novas integrações entraram ou
   regras de conciliação mudaram.

5. **Atualizar `Decisões.md`** com toda decisão técnica relevante do
   ciclo (uma seção por decisão, com contexto/escolha/por quê).

6. **Atualizar `Roadmap.md`**:
   - Mover items entregues pra [[Funcionalidades]]
   - Adicionar items novos descobertos no ciclo
   - Reordenar prioridades se mudaram

7. **Atualizar `LeadJourney.md`** se o produto mudou de natureza
   (raro — só em viradas grandes tipo V32 multi-tenant, V33
   orchestração, V36 multi-source).

8. **Entry de master no `src/core/changelog.js` = RELATÓRIO COMPLETO,
   não bullets curtos** (REGRA CRAVADA — Felipe, 2026-06-12).

   Toda release média/pequena ganha entry com 3-5 bullets focados no
   que mudou. A entry de **fechamento de master** (ex: V37.4.39 → V38.0.0)
   é diferente: ela aparece no sininho como o "marco do ciclo" e o
   cliente lê pra entender TUDO que rolou na master anterior.

   Formato exigido:
   - **Title** — uma linha cinematográfica resumindo a master inteira
   - **Bullets agrupados por tema** — não cronológicos. Organizar por
     área (Arquitetura / Features / Fixes / Permissões / etc).
   - **Sem brevity** — pode ter 10-15 bullets. O cliente quer ver TUDO
     pra entender o salto.
   - **Cada bullet escrito pro usuário final** (não dev). Linguagem de
     produto, não de código.
   - **Encerrar com 1 bullet "Próximo capítulo"** se houver direção
     conhecida da próxima master.

   Razão: master é raridade. Quando rola, o cliente quer sentir o
   peso do ciclo. Bullets curtos como nas pequenas escondem a entrega.

### Médias e pequenas: silêncio

Durante o ciclo da master atual (ex: dentro de V35.x), Claude NÃO
cria devlogs nem mexe nas notas Obsidian. Tudo fica registrado no
`src/core/changelog.js` (fonte da verdade pro sininho) e o resumo
cumulativo vira devlog só no fechamento da master.

Exceção: se durante uma média/pequena rolar uma decisão técnica
ENORME que afete a arquitetura inteira (ex: troca de DB, virada de
auth), pode atualizar [[Decisões]] sem esperar o fechamento da master.
Mas é exceção — default é silêncio.