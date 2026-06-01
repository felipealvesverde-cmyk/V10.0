# Hardening Runbook — V35.4.0

Lista de operações **manuais no painel Railway** que complementam o hardening de código.
Cada cliente tem seu próprio projeto Railway (ou banco separado dentro do mesmo).

---

## 1. Remover proxy público dos bancos dos clientes

Aplicar **uma vez por banco cliente** (Sansone, Atira, futuros).

### Pré-checks (30s por banco)
- [ ] Cliente tem backup automático ativado? (Tab `Backups` do Postgres no Railway)
- [ ] Nenhuma ferramenta EXTERNA conecta nesse banco?
  - DBeaver/pgAdmin local
  - Metabase/BI hospedado fora do Railway
  - Scripts Python/Node rodando em outro lugar
  
  Se algum SIM, **não delete** sem alternativa (usar Railway CLI `railway connect` quando precisar conectar local).

### Passos
1. Confirma que `DATABASE_URL` (ou env equivalente do cliente) no serviço da app está em `*.railway.internal` (Variable Reference `${{Postgres.DATABASE_URL}}` automático já resolve isso).
2. Vai no Postgres → tab **Settings** → seção **Networking** → **Public Networking**.
3. Click no ícone 🗑️ ao lado de `<algo>.proxy.rlwy.net:<porta>` → confirma.
4. Banco desaparece da internet. Pra qualquer um lá fora, é "Host not found".
5. Teste: loga no LJ como esse cliente, faz uma operação que dependa do banco. Funcionou = OK.

### Reverter (se necessário)
- Mesma tela, botão roxo **"Generate Domain"** recria o proxy em 5 segundos.

---

## 2. Configurar JWT_SECRET_PREVIOUS (rotação JWT)

V35.4.0 implementou suporte a rotação. **Você nunca precisa fazer isso na 1ª vez** — só na próxima rotação (sugiro a cada 90 dias).

### Como rotacionar JWT_SECRET
1. Gera novo secret (terminal local):
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```
2. No serviço V10.0 (app), tab **Variables**:
   - Move o valor atual de `JWT_SECRET` para uma nova variável `JWT_SECRET_PREVIOUS`
   - Cola o novo secret em `JWT_SECRET`
3. Salva. Railway redeploy automático.
4. **Tokens em circulação continuam válidos** (verificados contra `PREVIOUS`).
5. **Tokens novos** assinam com o `JWT_SECRET` atual.
6. Aguarda **TTL do token + 1 dia** (default: 8 dias).
7. Volta nas Variables e **DELETA** `JWT_SECRET_PREVIOUS`. Pronto.

### Sintoma de problema
- Se logs mostrarem `JWT verification falhou` em massa → algo deu errado.
- Reverte: volta o valor antigo em `JWT_SECRET`, deleta `JWT_SECRET_PREVIOUS`.

---

## 3. Verificar Audit Log funcionando

Após deploy do V35.4.0:

1. Faz qualquer ação no LJ (login, abrir Dashboard, etc).
2. Como master, chama `GET /api/admin-audit-log` (via curl, Postman ou colando URL no browser depois de logar):
   ```
   GET /api/admin-audit-log?limit=10
   Authorization: Bearer <seu JWT de master>
   ```
3. Resposta deve trazer `{ ok: true, rows: [...] }` com seu request mais recente registrado.

### Limpeza automática
- Job interno roda 1×/hora, deleta logs > 90 dias.
- Sem ação manual necessária.

---

## 4. Verificar Rate Limit funcionando

Após deploy:

1. Logado, dispara 1001 requests rápidas pra qualquer endpoint (script ou JMeter).
2. A partir do request 1001 deve receber `429 Too Many Requests` com header `Retry-After: 60`.

### Ajustes
- Limite default: **1000 req/min por user_id** (`max: 1000` em server.js).
- Master sem limite.
- Pra mudar limite por endpoint específico, criar middleware dedicado.

### Fail-open
- Se Redis cair, rate limit usa fallback em memória (mais frouxo, mas funciona).
- Não bloqueia user por bug interno.

---

## 5. Chave de cripto por tenant — migração de dados existentes

A lib `tenant-crypto.js` está pronta com **fallback automático**: dados criptografados com chave master (legacy) continuam funcionando.

### O que ainda PRECISA ser feito (quando der tempo)
- Migrar endpoints que chamam `clickup-crypto.encrypt()` pra usar `tenant-crypto.tenantEncrypt(tenantId, ...)`.
- Re-criptografar tokens existentes na primeira leitura (lazy migration):
  ```js
  // No endpoint que lê o token:
  const plain = tenantDecrypt(tenantId, row.token_enc);  // funciona pra legacy e novo
  if (!String(row.token_enc).startsWith('1:')) {
    // Legacy — re-criptografa pra chave do tenant
    const newEnc = tenantEncrypt(tenantId, plain);
    await db.query('UPDATE ... SET token_enc = $1', [newEnc]);
  }
  ```

Sugiro fazer essa migração endpoint por endpoint, sem rush.

---

## 6. Logs com redaction (safe-logger)

A lib `safe-logger.js` exporta `slog.info/warn/error/log` com redaction automática.

### Adoção gradual
- Não substituí `console.log` global — quem importar `slog` ganha proteção.
- Pra novos handlers, sempre usar:
  ```js
  const { slog } = require('../lib/safe-logger');
  slog.error('falhou:', err);  // emails/phones/tokens mascarados
  ```
- Pra handlers existentes, substituir conforme tocar.

---

## Status final V35.4.0

| Item | Status |
|---|---|
| Master DB fora da internet | ✅ Feito manualmente |
| Bancos clientes fora da internet | 🟡 Runbook documentado (executar por cliente) |
| Chave cripto por tenant | ✅ Infraestrutura pronta · 🟡 Migração de dados pendente |
| Audit log | ✅ Implementado + endpoint admin |
| Rate limit | ✅ Implementado (Redis + fallback memória) |
| JWT rotation | ✅ Suporte código pronto · 🟡 Rotação manual no Railway |
| Log redaction | ✅ Lib pronta · 🟡 Adoção gradual nos handlers |
