# Linha de Balanço — Plano de Implementação

**Spec:** [`docs/superpowers/specs/2026-07-14-linha-de-balanco-design.md`](../specs/2026-07-14-linha-de-balanco-design.md)
**Branch:** `feature/linhadebalanco`

Cada etapa termina com verificação. Backend roda no Docker (`docker compose up -d`); hot-reload ativo nos dois lados.

---

## Fase 0 — Backend: dados e persistência

### 0.1 Incluir grupo de atividade no `gantt-data`
- `backend/src/schedule/schedule.service.ts` → `getGanttData`: adicionar `activityTypeId` e `activityType: { select: { id, name } }` ao `select`; mapear para a resposta (`activityTypeId`, `activityTypeName`).
- `frontend/src/types/index.ts` → `GanttTask`: adicionar `activityTypeId?: string; activityTypeName?: string`.
- **Verificar:** `curl http://localhost:3001/api/projects/<id>/schedule/gantt-data` (com token) retorna os novos campos nas folhas do seed.

### 0.2 Modelo `ScheduleRevision`
- `backend/prisma/schema.prisma`: novo model conforme spec (relations Project/User, index `[projectId, createdAt]`, `@@map("schedule_revisions")`).
- `npx prisma db push` dentro do container (`docker compose exec backend npx prisma db push`).
- **Verificar:** `db push` sem erro; tabela criada.

### 0.3 Endpoint batch + histórico
- `backend/src/schedule/dto/batch-update.dto.ts`: `BatchUpdateDto { description?: string; changes: BatchChangeDto[] }` com class-validator (`@IsUUID`, `@IsDateString`, `@IsInt @Min(1)`, `@ArrayMinSize(1)`).
- `schedule.service.ts` → `batchUpdate(projectId, userId, dto)`:
  1. Carrega itens; valida que todos pertencem ao projeto e são **folhas** (404/400 caso contrário).
  2. Valida `startDate ≤ endDate`, `durationDays ≥ 1`.
  3. `prisma.$transaction`: atualiza cada item; recalcula datas dos ancestrais (min início / max término dos filhos, em cascata até a raiz); grava `ScheduleRevision` com `changes` (before/after: startDate, endDate, durationDays).
  4. Emite `realtimeGateway.emitScheduleChanged({ projectId, action: 'batch-update' })` (gateway já existe).
- `schedule.service.ts` → `listRevisions(projectId)`.
- `schedule.controller.ts`: `PATCH projects/:id/schedule/batch` (userId do JWT) e `GET projects/:id/schedule/revisions`.
- **Verificar:** testes 0.4 + chamada manual via Swagger (`/api/docs`).

### 0.4 Testes backend (jest)
- `backend/src/schedule/schedule.service.spec.ts` (ampliar): batch feliz (atualiza + revision + rollup de pais), rejeita item de outro projeto, rejeita item-pai, rejeita duração < 1, transação reverte tudo em erro parcial.
- **Verificar:** `docker compose exec backend npm test -- --testPathPattern=schedule`.

---

## Fase 1 — Frontend: lógica pura (`frontend/src/lib/lob/`)

> Sem UI ainda — módulos puros com testes. Adicionar script `"test": "vitest run"` em `frontend/package.json` (vitest já está nas devDeps; não há testes hoje).

### 1.1 `flowline-model.ts`
- Entrada: `tasks: GanttTask[]`, `draft: Map<string, DraftChange>`, `expanded: Set<string>`.
- Usa `buildForest`/`FLOOR_PATTERN` de `wbs-tree.ts`. Saída: `FlowlineRow[]` (tipo: grupo-bloco | pavimento | canteiro) com `bars: FlowlineBar[]` (task + datas efetivas draft-aware + subLane calculada por interval-partitioning quando barras se sobrepõem).
- Cores: `groupColor(name)` — mapa fixo da spec + hash determinístico p/ grupos não mapeados; tom claro derivado (mix com branco).
- **Testes** (`flowline-model.test.ts`): agrupamento por pavimento, canteiro, sub-faixas em sobreposição, draft sobrepõe datas originais.

### 1.2 `cascade-scheduler.ts`
- `applyMove(tasks, draft, taskId, newStart, newEnd): ChangeSet` — forward-pass: para cada sucessora (via `successorDeps` do `GanttTask`), calcula data mínima permitida conforme tipo (FS/SS/FF/SF) + lag; se violada, empurra (preservando duração) e recursa. Guard anti-ciclo (visited set). Retorna todas as mudanças do arraste (inclui a original).
- **Testes**: FS empurra, FS+lag, SS, FF, cadeia A→B→C, ciclo não trava, mover para trás não puxa sucessoras.

### 1.3 `equivalence.ts`
- `findEquivalents(task, tasks): GanttTask[]` — folhas com mesmo nome normalizado (reusar `normKey` — extrair de `Medicao.tsx` para `wbs-tree.ts` e importar nos dois lugares) + mesmo `activityTypeId`, em locais diferentes.
- **Testes**: acha equivalentes entre pavimentos/blocos, ignora a própria, ignora nomes diferentes.

- **Verificar fase:** `cd frontend && npm test` — tudo verde.

---

## Fase 2 — Canvas engine (`frontend/src/lib/lob/lob-canvas.ts`)

### 2.1 Renderer base
- Classe `LobCanvas(canvas, opts)`: DPR-aware; viewport `{ scrollY, pxPerDay, originDate }`; camada de fundo (grade + colunas sáb/dom + linha hoje) cacheada em offscreen canvas, invalidada só em zoom/resize; virtualização vertical (desenha só linhas visíveis); rAF + dirty-flag.
- Desenho das barras: dois tons, cantos arredondados, nome com ellipsis (medido via `ctx.measureText`, omitido se largura < ~24px), barra fina de baseline, borda azul + dot de pendência.
- Cabeçalho de tempo (canvas separado fixo no topo): 4 níveis (mês / semana ISO / letra do dia / nº do dia) conforme config de exibição e densidade de zoom (usar `date-fns` — já é dependência).
- Setas de dependência (quando toggle ativo): curvas bezier entre barras, só para pares visíveis.

### 2.2 Interação
- Hit-testing (busca binária por Y, varredura por X); cursores (`grab`/`ew-resize` nas bordas); drag move/resize com snap ao dia e preview ao vivo; zoom Ctrl+scroll ancorado no cursor; pan por scroll/arraste do fundo.
- Callbacks: `onBarHover`, `onBarClick`, `onBarDrag(Change)`, `onViewportChange`.
- **Verificar:** harness temporário (página dev com dados sintéticos de 10k barras) — pan/zoom fluidos, sem jank perceptível.

---

## Fase 3 — Página `LinhaBalanco.tsx`

### 3.1 Rota + esqueleto
- `frontend/src/routes/index.tsx`: rota `linha-de-balanco`; item de menu (layout/sidebar) entre Cronograma e Medição.
- `frontend/src/pages/LinhaBalanco.tsx`: carrega `scheduleApi.ganttData` + baseline ativa (verificar se `GET /projects/:id/baselines/:id` retorna `scheduleSnapshot`; se não, expor no backend — ajuste pequeno no service de baselines) + `useRealtime`.
- Layout: toolbar (spec §Barra superior) · árvore de locais (DOM, virtual-sync com canvas) · canvas · legenda de grupos.
- **Verificar:** tela abre com dados do seed, expand/collapse funciona, escala e toggles mudam o render.

### 3.2 Draft + undo/redo + edição
- Estado local: `draft` (Map), `pendingCount`; integração com `useHistoryStore` existente (entradas com `undo`/`redo` síncronos sobre o draft; um arraste + cascata = 1 entrada).
- Popover de edição (clique na barra): Início/Término/Duração/Produtividade (dias/pav ↔ duração); Aplicar roda a cascata.
- Dialog de alteração em massa quando `findEquivalents` > 0 e duração mudou.
- Tooltip overlay no hover (dados do spec §Tooltip).
- **Verificar:** arrastar empurra sucessoras; Ctrl+Z/Ctrl+Y desfazem/refazem o conjunto; badge de pendências conta certo; equivalentes em massa aplicam.

### 3.3 Gravar Report + histórico + conflitos
- Modal de confirmação (padrão `SaveReportModal` da Medição) → `scheduleApi.batchUpdate` (novo em `api.ts`) → sucesso: toast, limpa draft/histórico, recarrega.
- Modal de histórico de reprogramações (`GET revisions`).
- Banner de conflito: `useScheduleChanges` com draft não-vazio → aviso + botão recarregar (não sobrescrever draft silenciosamente).
- **Verificar:** gravar → conferir datas novas na tela Cronograma e evento realtime na Medição aberta em outra aba; erro de rede preserva o draft.

---

## Fase 4 — Verificação final

1. `frontend`: `npm test` + `npm run build` (tsc) limpos.
2. `backend`: `npm test` limpo.
3. Fluxo manual completo contra o seed (docker): abrir LDB → zoom/escala/exibição → arrastar com cascata → undo/redo → alteração em massa → gravar report → histórico → conferir Cronograma/Medição.
4. Performance: dataset sintético 10k atividades — pan/zoom fluido, primeira renderização < 150ms.

## Riscos & decisões em aberto (resolver na etapa indicada)

- **Snapshot da baseline no endpoint** (3.1): pode exigir ajuste pequeno no backend de baselines.
- **Rollup de datas dos pais** (0.3): hoje o Cronograma pode não recalcular datas de pais em updates individuais — conferir comportamento existente e espelhar.
- **Nome normalizado** (1.3): `normKey` duplicado em `Medicao.tsx` — extrair para `wbs-tree.ts` (refactor pequeno e seguro).
