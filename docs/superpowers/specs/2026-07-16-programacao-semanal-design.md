# Design — Módulo Programação Semanal (v2)

**Data:** 2026-07-16
**Status:** Aprovado pelo usuário (seções 1–4)
**Escopo:** Reescrita completa da aba Prog. Semanal (backend + frontend + configurações), substituindo o módulo atual.

## Objetivo

Transformar o cronograma executivo em um plano operacional semanal: importar atividades da semana, ajustar, publicar, acompanhar execução, registrar restrições, realizar a reunião semanal, fechar a semana gerando indicadores (PPC) e criar automaticamente a próxima programação. O módulo é independente: **não altera o Cronograma Geral nem a Medição** — o cronograma é apenas origem de dados.

## Decisões validadas com o usuário

| Tema | Decisão |
|---|---|
| Empresa/Empreiteira | Nova entidade cadastrável (`Contractor`) com CRUD em Configurações; dropdown na tabela com criação rápida. Agrupamento confiável para PPC por empreiteira. |
| Dados existentes | Modelos antigos (`WeeklyPlan`, `WeeklyTask`, `Restriction`) removidos; dados atuais descartados; seed atualizado no novo formato. |
| Local/Torre/Pavimento | Pré-preenchidos automaticamente pelo caminho da EAP (ancestrais do item do cronograma), sempre editáveis manualmente na tabela. |
| Fórmula PPC | Binário padrão Last Planner: `PPC = Concluídas ÷ (Total − Canceladas)`. Parcial não pontua. |
| Abordagem | Reescrita completa do que for necessário na aba Prog. Semanal. |

## 1. Modelo de dados (Prisma)

Modelos **removidos**: `WeeklyPlan`, `WeeklyTask`, `Restriction` (e enums `TaskStatus`, `RestrictionStatus` antigos).

### Novos modelos

**`Contractor`** — empreiteira do projeto
- `id`, `projectId`, `name` (único por projeto), `isActive`, timestamps.

**`RestrictionType`** — tipo de restrição parametrizável
- `id`, `projectId`, `name`, `order`, `isActive`.
- Seed inicial: Material, Projeto, Mão de Obra, Equipamento, Clima, Dependência de outra atividade, Cliente, Financeiro.

**`Project.weekStartDay Int @default(1)`** — dia de início da semana (0=Domingo … 6=Sábado; default 1=Segunda).
- A semana tem sempre 7 dias: `endDate = startDate + 6`.
- Reunião semanal: primeiro dia após o término (`startDate + 7`).
- Exemplo: início Quarta → programação Quarta a Terça, reunião na Quarta seguinte.

**`WeeklyProgram`** — a programação de uma semana
- `id`, `projectId`, `weekNumber`, `year`, `startDate`, `endDate`, `meetingDate`.
- `status`: `RASCUNHO | PUBLICADA | FECHADA`.
- `publishedAt?`, `closedAt?`, `indicators Json?` (gravado no fechamento), timestamps.
- Única por `(projectId, year, weekNumber)`.

**`WeeklyActivity`** — linha da tabela
- `id`, `programId`, `scheduleItemId?` (FK opcional ao cronograma; `SetNull` on delete).
- `origin`: `CRONOGRAMA | MANUAL | REPROGRAMADA`.
- `local`, `torre`, `pavimento` (strings editáveis; pré-preenchidas pela EAP), `activityName`.
- `contractorId?` (FK Empreiteira), `responsible?` (string, vinda do cronograma, editável).
- `status`: `PROGRAMADA | NAO_INICIADA | EM_ANDAMENTO | CONCLUIDA | BLOQUEADA | CANCELADA | REPROGRAMADA`.
- `percentExecuted Int @default(0)` (0–100).
- `carryoverFromId?` — auto-relação para a atividade da semana anterior que originou a reprogramação.
- `order`, timestamps.

**`WeeklyRestriction`** — restrição
- `id`, `programId`, `typeId` (FK RestrictionType), `description`, `responsible`, `dueDate`, `resolvedAt?`.
- `status`: `PENDENTE | RESOLVIDA`.
- `impactsProgram Boolean`.

**`WeeklyRestrictionActivity`** — junção N:N restrição ↔ atividade
- `restrictionId`, `activityId`, única por par. Uma restrição vincula-se a várias atividades; resolver a restrição reflete em todas.

**`WeeklySnapshot`** — histórico imutável
- `id`, `programId`, `kind`: `PUBLICACAO | REPORT | FECHAMENTO`.
- `payload Json` — foto completa: programa + atividades + restrições + indicadores calculados.
- `createdById`, `createdAt`. Sem update/delete na API — somente criação e leitura.

## 2. Ciclo de vida e regras de negócio

```
RASCUNHO ──(Publicar Programação)──► PUBLICADA ──(Publicar Fechamento)──► FECHADA
```

1. **Atualizar Programação** (botão principal, disponível em RASCUNHO e PUBLICADA):
   - Importa todas as **folhas** do cronograma cujo período `[startDate, endDate]` intersecta a semana.
   - Traz as reprogramadas da semana anterior FECHADA (se ainda não trazidas).
   - **Dedupe**: não duplica atividade já importada (`scheduleItemId`) nem reprogramada já copiada (`carryoverFromId`).
   - **Preserva** atividades manuais e todas as edições feitas (a importação só adiciona, nunca sobrescreve linha existente).
   - Local/Torre/Pavimento derivados dos ancestrais da EAP: pai → Pavimento, avô → Torre, bisavô (ou raiz do ramo) → Local; campos ficam editáveis.
2. **Publicar Programação**: `RASCUNHO → PUBLICADA` + snapshot `PUBLICACAO`. O conjunto publicado (incluindo extras adicionadas depois) é a base do PPC.
3. **Durante a semana / reunião**: editar qualquer célula, atualizar `%` (botões 0/25/50/75/100 + campo numérico), status, restrições, incluir atividades extras (origem MANUAL — contam no PPC e no histórico, não alteram o cronograma), ajustar o realizado (ex.: programado apto 501, executado 503).
   - Sugestão automática de status ao mudar `%`: `100 → CONCLUIDA`; `1–99 → EM_ANDAMENTO`; `0 → mantém`. Sempre ajustável manualmente (a sugestão nunca sobrepõe CANCELADA/BLOQUEADA definidos à mão).
4. **Report**: "Gravar Report" cria snapshot `REPORT` (foto do momento). "Histórico Report" lista snapshots para consulta read-only.
5. **Publicar Fechamento** (só em PUBLICADA; transação Prisma):
   - Calcula e grava `indicators` no programa.
   - Cria snapshot `FECHAMENTO`.
   - `status → FECHADA` (semana vira read-only na UI).
   - **Cria automaticamente a próxima semana** em RASCUNHO: importa atividades do cronograma da nova semana + copia as não concluídas (`NAO_INICIADA`, `EM_ANDAMENTO`, `BLOQUEADA`) como origem `REPROGRAMADA`, status `PROGRAMADA`, `carryoverFromId` apontando para a original. As originais na semana fechada **permanecem com o status real de campo** (o status `REPROGRAMADA` é usado quando o usuário marca explicitamente).
6. **Indicadores** (calculados no fechamento, gravados em `indicators` e lidos pelo Dashboard):
   - **Obra**: PPC geral = `CONCLUIDA ÷ (total − CANCELADA)`; % reprogramadas = `não concluídas ÷ (total − CANCELADA)`; quantidade de restrições; principais causas (contagem por tipo de restrição vinculada a atividades não concluídas).
   - **Empreiteira**: PPC e % reprogramadas por `contractorId`.
   - **Responsável**: PPC, quantidade programada, quantidade entregue por `responsible`.

## 3. Backend (NestJS)

Módulo `weekly-planning` reescrito (mesma pasta, código novo):

| Endpoint | Ação |
|---|---|
| `GET /projects/:projectId/weekly-programs` | Lista programações (resumo) |
| `POST /projects/:projectId/weekly-programs` | Cria programação para a semana corrente/indicada (respeitando `weekStartDay`) |
| `GET /weekly-programs/:id` | Detalhe com atividades + restrições + vínculos |
| `POST /weekly-programs/:id/refresh` | Atualizar Programação (import + carryover + dedupe) |
| `POST /weekly-programs/:id/publish` | Publicar Programação |
| `POST /weekly-programs/:id/close` | Publicar Fechamento (transacional) |
| `POST /weekly-programs/:id/report` | Gravar Report |
| `GET /weekly-programs/:id/snapshots` / `GET /weekly-snapshots/:id` | Histórico |
| `GET /weekly-programs/:id/indicators` | Indicadores live (pré-fechamento) |
| `POST /weekly-programs/:id/activities`, `PATCH/DELETE /weekly-activities/:id` | CRUD atividades |
| `POST /weekly-programs/:id/restrictions`, `PATCH/DELETE /weekly-restrictions/:id` | CRUD restrições (aceita `activityIds[]`) |
| `GET/POST/PATCH/DELETE /projects/:projectId/contractors` | CRUD empreiteiras |
| `GET/POST/PATCH/DELETE /projects/:projectId/restriction-types` | CRUD tipos de restrição |

- Semana FECHADA: mutações de atividades/restrições retornam 409.
- `close` roda em `prisma.$transaction` (indicadores + snapshot + próxima semana).
- **Dashboard** adaptado: `ppcCurrent` lê `WeeklyProgram` mais recente fechada; restrições pendentes lêem `WeeklyRestriction`.
- **Seed**: empreiteiras de exemplo, tipos de restrição padrão, 2 semanas (1 fechada com indicadores + 1 publicada em andamento).
- **Testes (jest)**: cálculo de semana por `weekStartDay` (incl. exemplo Quarta→Terça), dedupe do refresh, fórmula PPC/indicadores, transação de fechamento (snapshot + próxima semana), imutabilidade de snapshot, bloqueio de edição em FECHADA.

## 4. Frontend

`ProgramacaoSemanal.tsx` reescrito (com componentes extraídos em `frontend/src/components/weekly/` para manter arquivos focados):

- **Cabeçalho**: `Semana N` · período (dd/mm–dd/mm) · badge de status (Rascunho/Publicada/Fechada) · última atualização · navegação ← → entre semanas · data da reunião.
- **Toolbar**: `Atualizar Programação` (primário) · `Nova Atividade` · `Report ▾` (Gravar Report / Histórico Report) · `Exportar ▾` (Excel / PDF) · botão de transição de estado (`Publicar Programação` em rascunho; `Publicar Fechamento` em publicada, com confirmação).
- **Tabela editável estilo Excel** — colunas: Local, Torre, Pavimento, Atividade, Empresa (dropdown de empreiteiras + "criar nova"), Responsável, Status (dropdown com badges coloridos), % Executado (botões 0/25/50/75/100 + input numérico 0–100), Restrições (contador; clique abre modal). Todas as células editáveis via edição inline; persistência por PATCH no blur/seleção; semana FECHADA renderiza tudo read-only.
- **Painel de Restrições** abaixo da tabela: CRUD com tipo (dos parametrizados), descrição, responsável pela remoção, data prevista, data resolvida, status, impacta programação (S/N) e checkboxes das atividades vinculadas.
- **Card de PPC live** no cabeçalho (fórmula binária), atualizado a cada edição.
- **Histórico**: modal listando snapshots (tipo, data, autor) com visualização read-only da semana como ficou.
- **Exportação**: Excel via `xlsx` (dep existente); PDF via `jspdf` + `jspdf-autotable` (novas deps) — tabela formatada para distribuição às empreiteiras.
- **Configurações** (`Configuracoes.tsx`): no card Parâmetros do projeto, dropdown "Dia de início da semana" (Segunda…Domingo); novos cards de CRUD para **Empreiteiras** e **Tipos de Restrição**.
- **Tipos/API**: `frontend/src/types/index.ts` e `services/api.ts` atualizados; rotas e menu inalterados (mesma aba).

## 5. Fora de escopo

- Alterações no Cronograma Geral ou na Medição.
- Notificações/e-mail da reunião semanal.
- Undo/redo global (o histórico imutável por snapshot substitui a necessidade no fluxo novo).
- Permissões além do padrão atual do sistema (ADMIN edita; VIEWER consulta).
