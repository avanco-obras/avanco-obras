# Melhorias de UX — `feature/melhorias-ux`

Lote de melhorias derivadas de uma auditoria de UX das 8 telas do sistema,
implementadas **uma a uma**, cada uma com **build verde** antes do commit.

- **Branch:** `feature/melhorias-ux` (criada a partir da `origin/feature/progsemanal` atualizada — base `1cd30ff3`)
- **Total:** 16 commits · 26 arquivos · **+1.035 / −389** linhas · 6 arquivos novos
- **Status:** branch **local** (push pendente); 2 migrations **a aplicar** no banco real

---

## Índice de commits

| Commit | Tipo | Descrição |
|--------|------|-----------|
| `00697605` | fix(dashboard) | Respeitar modo escuro (tokens de tema em vez de hex fixo) |
| `5860d5af` | feat(topbar) | Exportar a tela atual em PDF; remover sino sem ação |
| `451e9c0c` | fix(atalhos) | ⌘/Ctrl+1..5 seguem a ordem do menu e cobrem todos os itens |
| `8cf44f3e` | refactor(nav) | Registry único de rotas; rótulos consistentes |
| `623b5df8` | fix(rotas) | Entrada padrão no Dashboard, não no Cadastro |
| `d2d2d70b` | refactor(ui) | Componente único `NoProjectState` para o estado "sem projeto" |
| `bc7efbde` | feat(ui) | Modal de confirmação padrão (`useConfirm`) no lugar de `window.confirm` |
| `a0096df7` | feat(cadastro) | Persistir Engenheiro e Contato de ponta a ponta |
| `08ca2c5f` | fix(config) | Microcópia nos campos E-mail e Perfil desabilitados |
| `e8c27416` | fix(config) | Exigir senha atual ao trocar a senha |
| `df498f13` | feat(notificações) | Central de notificações in-app + preferências salvas |
| `1a7f3fac` | chore | Remover `console.log` de depuração residuais |
| `8732ee9f` | feat(cadastro) | Estado "alterações não salvas" no formulário do empreendimento |
| `477a2e62` | feat(dashboard) | Indicador "atualizado às HH:MM" + botão Atualizar |
| `2aab7e23` | feat(dashboard) | Linhas de atrasos/restrições clicáveis (drill-down) |
| `97336785` | feat(ui) | Componente `DataTable` (busca + ordenação) e migração de 2 tabelas |

---

## 1. Navegação & shell

### `00697605` — Dashboard respeita o modo escuro
- **Problema:** paleta fixa em hex claro (`#ffffff`, `#0D1829`…) ignorava o toggle de tema — Dashboard ficava branco no dark mode.
- **Feito:** hook `useThemeColors()` que lê as variáveis CSS do tema e as resolve em cores concretas, re-lendo quando a classe de tema muda no `<html>`. Cores concretas são necessárias porque o **Recharts** renderiza cor como atributo SVG, onde `var()` não resolve.
- **Arquivos:** `frontend/src/pages/Dashboard.tsx`

### `5860d5af` — Exportar tela (PDF) + remover sino morto
- **Problema:** ícones de Notificações e Exportar no topbar não tinham ação (eram `<div>` sem handler).
- **Feito:** Exportar captura `.ao-content` com `html2canvas` e gera PDF de página única via `jsPDF` (fundo do tema, nome derivado da tela+projeto, estado de carregando/desabilitado). Sino sem ação removido (reintroduzido como sino real no item 3.2). `html2canvas` fixado como dependência explícita.
- **Arquivos:** `frontend/src/layouts/AppLayout.tsx`, `frontend/package.json`

### `451e9c0c` — Atalhos ⌘/Ctrl+1..5 corretos
- **Problema:** atalhos fora de ordem (⌘3 → Medição, não Linha de Balanço) e sem cobrir Linha de Balanço.
- **Feito:** atalhos derivados de `NAV_MAIN`, acompanhando a ordem visível do menu e cobrindo os 5 itens.
- **Arquivos:** `frontend/src/layouts/AppLayout.tsx`

### `8cf44f3e` — Registry único de rotas
- **Problema:** menu, breadcrumb e command palette duplicavam o mapa rota→rótulo/ícone e divergiam ("Medição" vs "Medição Física").
- **Feito:** um único `ROUTES` alimenta menu principal, menu de config, breadcrumb e command palette. Rótulo canônico "Medição Física" em todos os lugares.
- **Arquivos:** `frontend/src/layouts/AppLayout.tsx`

### `623b5df8` — Entrada padrão no Dashboard
- **Problema:** ao logar, caía no formulário de Cadastro mesmo quem já tinha obra.
- **Feito:** rota índice vai para `/dashboard`; sem projeto, o `NoProjectState` mostra o CTA de Cadastro.
- **Arquivos:** `frontend/src/routes/index.tsx`

---

## 2. Consistência

### `d2d2d70b` — Componente único `NoProjectState`
- **Problema:** 4 estados vazios "sem projeto" diferentes (ícones/textos distintos) em AppLayout, Dashboard, Medição e Prog. Semanal.
- **Feito:** `<NoProjectState>` (temado, correto no dark) reutilizado nas 4 telas, com mensagem/CTA opcionais.
- **Arquivos:** `frontend/src/components/NoProjectState.tsx` (novo), `AppLayout.tsx`, `Dashboard.tsx`, `Medicao.tsx`, `ProgramacaoSemanal.tsx`

### `bc7efbde` — Modal de confirmação padrão (`useConfirm`)
- **Problema:** `window.confirm()` nativo em várias ações (publicar/fechar semana, remover atividade/restrição/IFC/planta/empreiteira/tipo).
- **Feito:** `<ConfirmProvider>` na raiz + hook `useConfirm()` (Promise), com modal temado (Esc/Enter/clique-fora, tom "danger" em ações destrutivas). Substituiu **8** `window.confirm`.
- **Arquivos:** `frontend/src/components/ConfirmDialog.tsx` (novo), `App.tsx`, `ProgramacaoSemanal.tsx`, `Cadastro.tsx`, `components/weekly/ConfigCards.tsx`, `components/viewer/FloorPlanViewer2D.tsx`
- **Pendente relacionado:** 2 `window.prompt` (URL Sketchfab e nome de empreiteira) — entrada de texto, ficaram para um item próprio.

---

## 3. Formulários

### `a0096df7` — Persistir Engenheiro e Contato (full-stack) ⭐
- **Problema:** campos digitados mas descartados (sem coluna no banco) — perda silenciosa de dados.
- **Feito (ponta a ponta):** colunas `engineer/contact` no Prisma + migration; DTO e `ProjectsService` (create/update); no frontend, tipo `Project`, carregamento no form e envio ao salvar. Torres/pavimentos/unidades ganharam nota de que só pré-preenchem a importação por IA.
- **Arquivos:** `backend/prisma/schema.prisma`, migration, `create-project.dto.ts`, `projects.service.ts`, `frontend/src/types/index.ts`, `Cadastro.tsx`

### `08ca2c5f` — Microcópia em campos travados
- **Feito:** E-mail e Perfil desabilitados agora explicam o porquê ("não pode ser alterado" / "definido pelo administrador").
- **Arquivos:** `frontend/src/pages/Configuracoes.tsx`

### `e8c27416` — Exigir senha atual na troca de senha
- **Problema:** o frontend enviava `currentPassword` vazio → o backend (que já valida) rejeitava, então a troca **nunca funcionava**.
- **Feito:** campo "Senha atual", validação de presença/comprimento, e a mensagem específica do backend ("Senha atual incorreta") exibida. Correção só no frontend — backend já estava correto.
- **Arquivos:** `frontend/src/pages/Configuracoes.tsx`

### `8732ee9f` — Estado "alterações não salvas" no Cadastro
- **Feito:** botão Salvar só ativo quando há mudança vs. o último estado salvo; aviso "Alterações não salvas" e alerta do navegador ao recarregar/fechar.
- **Ressalva:** navegação interna do React Router não é bloqueada (o app usa `BrowserRouter` sem data router → `useBlocker` indisponível); o guard cobre saída no nível do navegador.
- **Arquivos:** `frontend/src/pages/Cadastro.tsx`

### `df498f13` — Central de notificações in-app + preferências salvas (full-stack) ⭐
- **Problema:** card de Notificações decorativo (toggles não salvavam nada).
- **Feito:**
  - **Backend:** `User.notificationPreferences` (JSON) + migration; DTO/service e os selects de auth (`login`/`getMe`/`register`) retornam o campo.
  - **Frontend:** hook `useNotifications` deriva alertas ao vivo (atividades atrasadas + restrições vencidas) do projeto atual, respeitando as preferências; estado "lido" no `localStorage`. Configurações: 2 toggles reais (salvos por usuário, com revert em erro) e 2 de e-mail marcados "em breve". Sino real no topbar com badge de não-lidas, painel com deep-link por alerta e "marcar todas como lidas".
- **Arquivos:** `backend/prisma/schema.prisma`, migration, `update-user.dto.ts`, `users.service.ts`, `auth.service.ts`, `frontend/src/types/index.ts`, `hooks/useNotifications.ts` (novo), `Configuracoes.tsx`, `AppLayout.tsx`

---

## 4. Tabelas

### `97336785` — Componente `DataTable` (busca + ordenação) ⭐
- **Feito:** `<DataTable>` genérico reaproveitando o estilo `.ao-table`: ordenação por coluna (asc→desc→limpar), busca opcional, estado vazio, row-click. Migradas **Equipe** (Cadastro, com busca por nome/e-mail) e **Restrições** (Prog. Semanal, com ordenação, preservando clique-para-editar, remover e células compostas).
- **Escopo:** Tipos de Atividade ficou de fora (edição inline por linha); o "table" do Cronograma é uma grade de Gantt especializada, fora do escopo.
- **Arquivos:** `frontend/src/components/DataTable.tsx` (novo), `Cadastro.tsx`, `ProgramacaoSemanal.tsx`

---

## 5. Dashboard

### `477a2e62` — "Atualizado às HH:MM" + botão Atualizar
- **Feito:** cabeçalho com horário da última carga e refresh manual reusando o loader existente (spinner/desabilitado durante a carga).
- **Arquivos:** `frontend/src/pages/Dashboard.tsx`

### `2aab7e23` — Linhas de atrasos/restrições clicáveis
- **Feito:** as listas "Atividades em Atraso" e "Restrições Pendentes" levam à tela correspondente (Cronograma / Prog. Semanal) ao clicar, com hover temado e tooltip. Navegação em nível de página (não há rota por item), consistente com os deep-links das notificações.
- **Arquivos:** `frontend/src/pages/Dashboard.tsx`

---

## 6. Limpeza

### `1a7f3fac` — Remoção de `console.log` de depuração
- **Feito:** removidos prints residuais do fluxo de exclusão de empreendimento e das colunas/importação do Cronograma. Mantidos os `console.error` defensivos em blocos catch.
- **Arquivos:** `frontend/src/pages/Configuracoes.tsx`, `Cronograma.tsx`

---

## Mudanças no banco (2 migrations)

| Migration | Muda |
|-----------|------|
| `20260804000000_add_project_engineer_contact` | `projects.engineer`, `projects.contact` (nullable TEXT) |
| `20260805000000_add_user_notification_preferences` | `users.notification_preferences` (JSONB) |

> Verificadas no Postgres local. **Aplicar no banco real** com `prisma migrate deploy` no deploy.

## Arquivos novos

- `frontend/src/components/ConfirmDialog.tsx`
- `frontend/src/components/DataTable.tsx`
- `frontend/src/components/NoProjectState.tsx`
- `frontend/src/hooks/useNotifications.ts`
- `backend/prisma/migrations/20260804000000_add_project_engineer_contact/migration.sql`
- `backend/prisma/migrations/20260805000000_add_user_notification_preferences/migration.sql`

## Operação de branch

A `origin/feature/progsemanal` estava 10 commits à frente. A branch `feature/melhorias-ux`
foi criada a partir dela e os 16 commits foram reaplicados por cima (rebase limpo, sem
conflitos — o merge combinou as mudanças com o refactor de Toolbar do remote). A
`feature/progsemanal` local ficou intacta como backup.

## Verificação no Docker

- Stack completa no ar (postgres/redis/minio/backend/frontend/nginx); `db push` sincronizou
  o schema atual (com as colunas novas) e `seed` populou dados de demonstração.
- **Backend testado via API:** 3.1 (engineer/contact persistem), 3.2 (`notificationPreferences`
  persiste e reflete no `/me`), 3.3 (senha errada → HTTP 401). Endpoints do sino retornam
  10 atrasos / 2 restrições.
- **Frontend** serve em `http://localhost:5173` e via nginx em `http://localhost`.
- Login de teste: `carlos@horizonte.com.br` / `admin123`.

## Pendências & ressalvas

1. Aplicar as 2 migrations no banco real (`prisma migrate deploy`).
2. Push da branch ainda não feito.
3. Itens restantes da auditoria:
   - **Pequeno:** 2 `window.prompt` → campo inline.
   - **Médio/backend:** 6.1 (importação de EAP transacional).
   - **Decisão de produto:** 4.2 (undo vs. confirmação), 6.2 (terminologia do ciclo semanal), 6.3 (renomear os dois "Report").
   - **Confirmação:** apagar arquivos legados na raiz (`avanco_obras_v2.html`, `redesign_v3.html`, CSVs de teste).
4. **Quirk do dev-container (não é do código):** `nest start --watch` não sobe sozinho — o cache
   incremental do `tsbuildinfo` sobre o volume `dist` faz o build emitir só `.d.ts`. Contornado
   subindo a API com `node dist/main` após `tsc` limpo.
5. **Dado do seed:** alguns itens de `/dashboard/delays` vêm com `delayDays: null` → sino/Dashboard
   mostrariam "null dia(s)"; pré-existente, tratável com um fallback.
