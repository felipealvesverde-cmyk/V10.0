# Termos de Uso da Inteligência Artificial — LeadJourney

**Versão 1.0 — vigência a partir de 04/06/2026**

Este documento explica como o LeadJourney (LJ) usa Inteligência Artificial (IA) através do Djow, copiloto integrado ao produto.

## 1. O que é o Djow

Djow é o nome da IA do LJ. Por baixo, ele usa o modelo Claude da Anthropic (provedor terceiro). Você pode plugar sua própria chave Anthropic ou usar o saldo liberado pelo administrador do LJ — em ambos os casos, o conteúdo do que você envia transita pela infraestrutura da Anthropic.

## 2. O que VOCÊ envia ao Djow

Quando você usa o Djow (chat, sugestão de KR, configuração RevOps, etc), o LJ envia ao modelo Claude:

- A mensagem que você escreveu
- O contexto necessário pra resposta (KR ativo, produto selecionado, configurações relevantes do seu workspace)
- **NÃO enviamos:** senhas, tokens de integração, chaves de API, dados de outros tenants

Você é responsável pelo conteúdo que escreve. Não inclua dados pessoais sensíveis de terceiros sem consentimento (CPF, dados de saúde, informações bancárias completas, etc).

## 3. O que a Anthropic faz com o dado

A Anthropic, segundo a política dela vigente em 04/06/2026:

- Não usa seu input pra treinar modelos (sem consentimento explícito)
- Retém o conteúdo por até 30 dias pra fins de segurança e debug
- Pode acessar conteúdo em caso de suspeita de violação dos termos dela

Política completa: [anthropic.com/legal/privacy](https://www.anthropic.com/legal/privacy)

## 4. LGPD e responsabilidade

- Você é o **controlador** dos dados que envia
- LJ e Anthropic são **processadores**
- Você responde pelo cumprimento da LGPD em relação aos dados pessoais de terceiros que decidir compartilhar com o Djow

## 5. Limites de garantia

A IA pode errar. O LJ não garante:

- Que respostas do Djow estarão corretas
- Que sugestões de KR/RevOps são adequadas ao seu negócio
- Disponibilidade 24/7 (a Anthropic pode ter indisponibilidade)
- Que duas perguntas iguais terão respostas idênticas

Use o Djow como **assistente**, não como decisor final.

## 6. Como o LJ protege seus dados

- Sua chave Anthropic é criptografada (AES-256-GCM) no nosso servidor
- Logs do Djow têm retenção curta (30 dias) e dados sensíveis são mascarados
- Multi-tenant: outros tenants do LJ nunca veem seu conteúdo
- O Djow do sistema não tem acesso a memórias, configurações ou decisões de outros clientes

## 7. Revogação

Você pode revogar o aceite a qualquer momento em **Configurações → IA**. Ao revogar:

- O Djow para de funcionar pra você (chave própria)
- Logs existentes mantêm a retenção de 30 dias e então são purgados
- Você pode reativar depois, lendo a versão atual dos termos

## 8. Atualização dos termos

Quando atualizarmos esta versão, você será notificado na próxima interação com a IA e precisará reaceitar. O uso anterior fica registrado com a versão da época.

---

Ao marcar "Li e aceito", você confirma que entendeu e concorda com estes termos.
