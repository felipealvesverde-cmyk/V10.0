# Permission System — 3 roles + overrides granulares

> KB ativa pro Djow. Cravado em V37.3.1.

## 3 Roles

| Role | Atalho no UI | Escopo |
|---|---|---|
| **Master** (LJ Global) | "Admin Master LJ" | TODOS os tenants. `users.is_master=true`. |
| **Owner** (do tenant) | "Admin Master" | Controla integrações, membros, governance do seu tenant. |
| **Gerente** | "Gerente" | Acesso operacional amplo, sem mexer em credenciais/membros. |
| **Usuário** | "Usuário" | Acesso básico. Customizável via overrides. |

## Overrides granulares

Coluna `tenant_members.permissions_overrides` JSONB. Estrutura:

```json
{
  "view_dashboard": true,
  "edit_campaigns": false,
  "edit_leads": true,
  "view_revops": false,
  ...
}
```

Sobrescreve o default do role. Owner customiza por user em **Configurações → Membros → Editar Membro → Customizar permissões granulares**.

## Engine

`lib/permission-engine.js` expõe `LJCan.can(userPerms, capability)`:
- Calcula permissão efetiva combinando role default + overrides
- Default permissivo (true) enquanto não carrega — evita flash de UI bloqueada
- Frontend chama `App.state.userPermissions` que vem hidratado por `Actions.loadMyPermissions()`

## Frontend role-gating (V37.3.4)

Menu de Configurações esconde abas que o user não pode tocar. Botões destrutivos viram cinza/disabled.

## Endpoints

- `GET /api/auth-me` — retorna user info inclusive `tenantId`, `role`
- `GET /api/tenant-members-list` — lista membros do tenant (com role e overrides)
- `POST /api/tenant-member-update-role` — owner muda role de outro member
- `POST /api/tenant-member-update-permissions` — owner ajusta overrides JSONB
- `POST /api/tenant-member-reset-password` (V37.4.31) — owner marca user pra resetar senha no próximo login
- `POST /api/tenant-member-send-password-reset` (V37.4.28) — owner manda email com magic link
- `POST /api/tenant-member-send-email-change` (V37.4.28) — owner manda email pra membro trocar próprio email
- `POST /api/tenant-invite-create` — owner convida novo membro
- `POST /api/tenant-invite-cancel` — owner cancela convite pendente
- `GET /api/auth-debug-perms` (V37.4.22) — diagnostic do que o backend vê (JWT, user row, memberships, verdict)

## Reset de senha SEM email (V37.4.31)

Default atual enquanto SMTP Resend está em sandbox (domínio próprio pendente).

Fluxo:
1. Owner clica "Resetar senha" no Editar Membro
2. Backend marca `users.password_reset_pending=true`, `password_reset_expires_at=NOW()+24h`
3. Membro abre login, digita username
4. `auth-login.js` detecta flag → retorna `{ ok: true, passwordResetPending: true, username }` SEM cobrar senha
5. Frontend troca pra tab `reset` com tela "Defina nova senha"
6. Membro define + confirma
7. `auth-complete-password-reset.js` (PÚBLICO): hasheia, zera flag, devolve JWT já logado

Lei reforçada em V37.4.33: login não fica refém de migration (try/catch defensivo se coluna nova não existir).

## Magic link (V37.4.28)

Quando SMTP funcionar com domínio próprio, voltam a fazer sentido:
- **Reset de senha por email**: link `/?action=password-reset&token=X` → user define nova sem precisar da atual
- **Troca de email**: email vai pro endereço ATUAL, user confirma trocar pra novo (precisa confirmar senha atual)

Tokens vivem em `user_action_tokens` (action_type, expires_at, used_at). TTL 7 dias.

Endpoint público `/user-action.html?token=X` processa os 2 fluxos. Backlog V38.x pra reabrir esse caminho com domínio Resend.

## Minha Conta (V37.4.24)

`src/modules/settingsModal.js` → tab `myAccount`:
- Trocar email (exige senha atual)
- Trocar senha (exige senha atual)
- Ver permissões efetivas (read-only modal)
- Display name editável
