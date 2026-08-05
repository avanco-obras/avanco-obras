# Plano de implementação — Cronograma: barra padronizada, inserção de atividade e Report com restauração

**Data:** 2026-07-30
**Spec:** [2026-07-30-cronograma-toolbar-report-restore-design.md](../specs/2026-07-30-cronograma-toolbar-report-restore-design.md)
**Branch sugerida:** `feature/cronograma-toolbar-report`

## Ordem das fases

As sete fases são sequenciais só onde há dependência real. Fases 1→2→3 tocam apenas o frontend visual; 4 é independente; 5→6→7 formam o bloco do Report. Cada fase termina em estado verificável e commitável.

| Fase | Entrega | Depende de |
|---|---|---|
| 1 | Módulo de toolbar + barra do Cronograma | — |
| 2 | Padrão aplicado às outras três telas | 1 |
| 3 | Exportar `.xlsx` (remove CSV) | 1 |
| 4 | Inserção de atividade + rollup | — |
| 5 | Snapshot ampliado + endpoint de restore | — |
| 6 | UI de restauração (modal + menu) | 5 |
| 7 | Report unificado na Linha de Balanço | 5, 6 |

---

## Fase 1 — Módulo de toolbar e barra do Cronograma

**Arquivo novo:** `frontend/src/components/ui/Toolbar.tsx`

Exporta `Toolbar`, `ToolbarButton`, `ToolbarSelect`, `ToolbarSearch`, `ToolbarMenu`, `ToolbarSeparator` conforme §1.1 da spec.

- `ToolbarButton` envolve `.ao-btn.ao-btn-sm`. Props: `icon`, `label`, `variant` (`default` | `primary`), `disabled`, `title`, `onClick`. Sem `label`, exige `aria-label` (tipagem discriminada, para o TypeScript barrar ícone puro sem rótulo acessível).
- `ToolbarSelect` e `ToolbarSearch` usam wrapper `position: relative` com ícone `absolute` e `padding-left` no campo — `<select>` nativo não aceita SVG interno.
- `ToolbarMenu` controla abertura por estado, fecha em clique externo e em `Esc`, e posiciona o painel com `position: absolute`.

**Arquivo alterado:** `frontend/src/pages/Cronograma.tsx` (~linhas 3358–3516)

1. Título → `Cronograma`.
2. Remover o bloco da legenda inteiro (`{/* Legend */}`), incluindo a dica de duplo clique.
3. Reconstruir a barra na ordem 1–13 da §1.3, trocando cada emoji pelo ícone lucide correspondente.
4. Baseline e Report passam a `ToolbarMenu` neutro; só `Nova atividade` mantém `variant="primary"`.
5. Levar o status da barra do Gantt para o `title` de cada barra, compensando a legenda removida.

**Verificação:** abrir o Cronograma, conferir a ordem contra o mockup, testar undo/redo, expandir/recolher, os selects, os menus e a navegação por teclado (Tab + Esc nos menus).

---

## Fase 2 — Padrão nas outras três telas

Substituir os botões inline pelos componentes da Fase 1, **preservando botões e ordem**:

- `frontend/src/pages/Medicao.tsx` (~linha 190): 3D, 2D, Mapa de calor, Report.
- `frontend/src/pages/LinhaBalanco.tsx` (~linhas 360–440): escala, Exibição, zoom, ajustar, undo/redo, Histórico, Gravar Report.
- `frontend/src/pages/ProgramacaoSemanal.tsx` (~linhas 375–520): navegação de semana, Atualizar, Nova Atividade, Report, Publicar.

A Programação Semanal já está próxima do alvo — serve de referência e deve exigir a menor mudança.

**Atenção:** `LinhaBalanco.tsx` e `ProgramacaoSemanal.tsx` têm alterações não commitadas na árvore de trabalho. Rebasear ou commitar antes de mexer, para não misturar mudanças.

**Verificação:** percorrer as quatro telas e confirmar que um mesmo botão (ex.: Report, undo/redo) tem altura, fonte e ícone idênticos em todas.

---

## Fase 3 — Exportar `.xlsx`

**Arquivo novo:** `frontend/src/lib/schedule-export.ts` — isola a geração da planilha para poder testar sem montar a página.

- `buildScheduleWorkbook(tasks, visibleCols, projectName)` devolve o workbook `xlsx`.
- Respeita `visibleCols` e a ordem de `COL_DEFS`; indenta o nome por `level`; inclui o código WBS.
- Cabeçalho congelado (`!freeze`), larguras por conteúdo (`!cols`).

**Arquivo alterado:** `Cronograma.tsx` — `handleExport` passa a chamar o novo módulo e baixar `cronograma-<projeto>-<YYYY-MM-DD>.xlsx`. **Remover** a função de exportação CSV.

**Testes:** `frontend/src/lib/schedule-export.test.ts` — colunas visíveis respeitadas, hierarquia preservada, nome de arquivo.

---

## Fase 4 — Inserção de atividade e rollup

**Backend** — `backend/src/schedule/schedule.controller.ts` (`@Post('projects/:id/schedule')`, linha 48) e `schedule.service.ts`:

- DTO ganha `afterId?: string`.
- Com `afterId`: resolver `parentId` e `level` do item indicado; calcular `order` como o último da subárvore dele + 1; deslocar os irmãos posteriores em +1. Tudo em `$transaction`.
- Sem `afterId`: comportamento atual.
- Criar e excluir passam a chamar `recalculateParentTasks(projectId)`.

**Frontend** — `Cronograma.tsx`:

- `openNew()` passa a enviar `afterId: selectedTaskId`.
- Casos de borda da §2.2: sem seleção → sem `afterId`; raiz selecionada → filha da raiz.
- Confirmar que o indicador "% Avanço Físico" do topo **não** é recalculado.

**Testes:** `schedule.service.spec.ts` — `parentId`/`level`/`order` resolvidos, irmãos deslocados, subárvore respeitada, rollup após criar e após excluir.

---

## Fase 5 — Snapshot ampliado e endpoint de restore

**Migração Prisma** — `ProjectReport` ganha `dependencySnapshot Json?`, `measurementSnapshot Json?`, `snapshotVersion Int @default(1)`. Sem backfill: reports existentes ficam `v1`.

> Rodar via `docker compose exec backend npx prisma migrate dev --name report_full_snapshot`.

**`physical-progress.service.ts`:**

- `createReport` passa a gravar os três campos novos, com `snapshotVersion: 2`.
- Novo `restoreReport(projectId, reportId, userId)`, em `$transaction`, na ordem da §3.2:
  1. Report de segurança do estado atual (`Antes da restauração do Report #<n>`).
  2. Diff de `schedule_items` preservando IDs — `update` / `create` / `delete`. Inserções por `level` crescente, remoções em ordem inversa.
  3. Dependências: apagar e recriar (pulado se `v1`).
  4. Medições: apagar e recriar (pulado se `v1`).
  5. `recalculateParentTasks`.
  6. Emitir o evento de mudança estrutural do módulo `realtime`.

**`physical-progress.controller.ts`:** `@Post('reports/:reportId/restore')`.

**Testes:** `physical-progress.service.spec.ts` — diff nos três casos; vínculos de `weekly_activities` preservados para itens mantidos; `SetNull` só nos removidos; rollback em falha; `v1` parcial vs `v2` completo; report de segurança criado antes da sobrescrita.

O teste de preservação dos vínculos semanais é o mais importante da fase: é ele que prova o isolamento da Programação Semanal.

---

## Fase 6 — UI de restauração

**`frontend/src/services/api.ts`** (`progressApi`, linha 288): adicionar `restoreReport(projectId, reportId)`.

**Componente novo:** `frontend/src/components/RestoreReportModal.tsx` — número da versão, data, autor, descrição e o que será sobrescrito; ação em variante de perigo; confirmação explícita. Para `v1`, exibe o aviso de restauração parcial.

**Telas:** o `ToolbarMenu` do Report ganha *Restaurar versão…* no Cronograma e na Medição (reaproveitando `ReportDialogs` em `components/medicao/`). Após restaurar, o evento de realtime já dispara o refresh via `useScheduleChanges`.

**Verificação manual:** gravar um Report, alterar atividades e medições, restaurar, e confirmar em todas as telas — inclusive que a Programação Semanal manteve os vínculos.

---

## Fase 7 — Report unificado na Linha de Balanço

**Backend** — `@Patch('projects/:id/schedule/batch')` (linha 107) passa a gravar um `ProjectReport` além da `ScheduleRevision`, na mesma transação. A revisão continua sendo gravada para preservar a rastreabilidade existente.

**Frontend** — `LinhaBalanco.tsx`: `openHistory` passa a listar reports (`progressApi`) em vez de revisões, e o menu ganha *Restaurar versão…* como nas demais.

**Verificação:** reprogramar na LdB e confirmar que o report aparece no histórico das três telas.

---

## Riscos

| Risco | Mitigação |
|---|---|
| Diff da reconciliação com bug corrompe o cronograma | Report de segurança automático + transação; cobertura de teste antes de expor a UI (Fase 5 antes da 6). |
| Fase 7 gera reports em excesso, um por reprogramação | Consequência aceita da decisão de unificar. Reavaliar após uso real; a `ScheduleRevision` preservada permite separar de novo se incomodar. |
| Conflito com as alterações não commitadas em LdB e Prog. Semanal | Commitar ou rebasear antes da Fase 2. |
| Migração Prisma em base com dados | Campos nulos, sem backfill — não há perda. Conferir que o seed idempotente não é afetado. |

## Definição de pronto

- Barra idêntica nas quatro telas, sem emoji, na ordem aprovada.
- Exportar gera `.xlsx`; CSV não existe mais em lugar nenhum.
- Nova atividade nasce abaixo da selecionada, no mesmo nível; rollup dos pais atualizado em criar e excluir; indicador do topo inalterado.
- Restaurar sobrescreve cronograma, dependências e medições após confirmação, com report de segurança gravado.
- Programação Semanal com vínculos e histórico intactos.
- Testes das fases 3, 4 e 5 passando.
