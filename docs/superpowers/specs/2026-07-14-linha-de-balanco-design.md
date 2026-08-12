# Linha de Balanço — Design

**Data:** 2026-07-14 · **Status:** aprovado pelo usuário (brainstorming com mockups visuais)

## Objetivo

Nova tela **Linha de Balanço** (`/linha-de-balanco`) para planejamento e reprogramação de obras verticais, com qualidade de software comercial (referências: Prevision, Primavera P6, MS Project) e suporte a milhares de atividades.

A tela **não possui base de dados própria**. Funciona como a Medição: consulta o Cronograma, permite alterações temporárias em memória e só atualiza o Cronograma Principal quando o usuário clica em **Gravar Report**. O Cronograma permanece a única fonte da verdade.

## Decisões-chave (validadas com o usuário)

| # | Decisão | Escolha |
|---|---------|---------|
| 1 | Produtividade | **Derivada da duração** ("X dias/pavimento"). Editar produtividade recalcula a duração. Nenhum campo novo no banco. |
| 2 | Mover/redimensionar com dependências | **Empurrar sucessoras em cascata** (FS/SS/FF/SF + lag), tudo em memória, marcado como pendente. |
| 3 | Layout do eixo Y | **Flowline compacta**: 1 linha por pavimento, atividades lado a lado no tempo. Sobreposições empilham em sub-faixas automáticas dentro da linha (atividades nunca se fundem). |
| 4 | Gravar Report | **Batch transacional + histórico**: aplica alterações numa transação e registra uma revisão de reprogramação (quem, quando, antes/depois). |
| 5 | Renderização | **Canvas 2D próprio** com virtualização, repaint parcial e overlay DOM para tooltip/edição. |

## Arquitetura e fluxo de dados

```
Cronograma (fonte da verdade)
  ├─ GET /projects/:id/schedule/gantt-data ──► tasks[] (imutável na tela)
  ├─ GET baseline ativa (ProjectBaseline,  ──► baselineSnapshot[]
  │        última versão do projeto)
  │
  │   draft: Map<taskId, { startDate, endDate, durationDays }>
  │   (TODAS as edições vivem só aqui, em memória)
  │
  └─ Gravar Report ──► PATCH /projects/:id/schedule/batch (transacional)
                        └─ cria ScheduleRevision (histórico)
```

- A visão flowline é **derivada** de `tasks[] + draft`, com memoização.
- Hierarquia de locais (Bloco → Pavimento) vem da própria árvore EAP via `buildForest`/`FLOOR_PATTERN` de `frontend/src/lib/wbs-tree.ts` — **mesma lib da Medição, zero estrutura duplicada**. Folhas sem ancestral de pavimento vão para a faixa **Canteiro** (como na Medição).
- Grupo de atividade = `ActivityType` existente (Estrutura, Alvenaria, …).
- Nunca criar nomes de locais manualmente; sempre usar os cadastrados na EAP.

## Mudanças no backend (3, pequenas)

1. **`gantt-data` inclui grupo**: adicionar `activityTypeId` e `activityType { id, name }` na resposta de `ScheduleService.getGanttData` (hoje não vem — necessário para as cores).
2. **Novo endpoint `PATCH /projects/:id/schedule/batch`**:
   - Body: `{ description?: string, changes: [{ id, startDate, endDate, durationDays }] }`
   - Aplica tudo numa **transação única** (tudo ou nada).
   - Valida: itens pertencem ao projeto; apenas atividades-folha; datas coerentes (start ≤ end, duração ≥ 1 dia).
   - Recalcula datas dos pais por rollup (min início / max término dos filhos).
   - Emite evento realtime (`useScheduleChanges` — as outras telas já escutam).
   - Cria o registro `ScheduleRevision`.
3. **Novo modelo `ScheduleRevision`** (histórico de reprogramação):
   ```prisma
   model ScheduleRevision {
     id          String   @id @default(uuid())
     projectId   String
     userId      String
     createdAt   DateTime @default(now())
     description String?
     changes     Json     // [{ itemId, code, name, before:{startDate,endDate,durationDays}, after:{...} }]
   }
   ```
   - `GET /projects/:id/schedule/revisions` — listagem para o modal de histórico.

## Frontend

- **Rota** `/linha-de-balanco` → `frontend/src/pages/LinhaBalanco.tsx`, item de menu entre Cronograma e Medição.
- **Engine de canvas** (`frontend/src/lib/lob/` — módulos isolados e testáveis):
  - `flowline-model.ts` — deriva linhas (blocos/pavimentos/canteiro), barras e sub-faixas de sobreposição a partir de `tasks + draft`.
  - `cascade-scheduler.ts` — forward-pass em memória: empurra sucessoras respeitando tipo (FS/SS/FF/SF) e lag; guarda anti-ciclo; retorna change-set completo do arraste.
  - `lob-canvas.ts` — renderização em camadas, virtualização, hit-testing, zoom/pan.
  - `equivalence.ts` — detecção de atividades equivalentes (mesmo nome normalizado + mesmo grupo, em outros pavimentos) para alteração em massa.
- **Estado**: `tasks` (original), `draft` (Map de alterações), pilhas de undo/redo por change-set (um arraste + sua cascata = 1 entrada, desfeita de uma vez).

## Especificação da UI (mockup v3 aprovado)

### Barra superior
Nome da obra · Escala (Dias/Semana/Quinzena/Mês) · menu **⚙ Exibição** · toggles **Baseline** e **Dependências** · Zoom − / + · Ajustar à tela · Desfazer / Refazer · badge "● N alterações pendentes" · **💾 Gravar Report**.

### Menu Exibição (configurações do cabeçalho de tempo)
- ☑ Semana do ano (S36, S37…)
- ☑ Dia da semana (S T Q Q S S D)
- ☑ Número do dia (1, 2, 3…)
- ☑ Destacar sáb/dom
Preferências persistidas em `localStorage`.

### Eixo X (tempo)
Cabeçalho em até 4 níveis: **mês** → **semana do ano** → **dia da semana abreviado** → **número do dia**. Na escala diária, sábado e domingo com cor diferenciada (cabeçalho e corpo). Níveis somem conforme o zoom (semana/quinzena/mês). Zoom contínuo (Ctrl+scroll e botões) ancorado no cursor. Linha vermelha "hoje".

### Eixo Y (locais)
Árvore da hierarquia do Cronograma: Bloco → Pavimentos (+ Canteiro para atividades sem pavimento), expansível/recolhível. Uma única Linha de Balanço para toda a obra (todas as torres na mesma visualização) — permite ver continuidade de equipes, migração entre torres, buffers e conflitos.

### Barras (atividades)
- Cada atividade-folha = retângulo horizontal na linha do seu pavimento; sobreposições empilham em sub-faixas; atividades nunca se fundem.
- **Cor = grupo da atividade** (paleta fixa moderna): Estrutura `#64748b` cinza · Alvenaria `#ea580c` laranja · Elétrica `#2563eb` azul · Hidráulica `#059669` verde · Impermeabilização `#9333ea` roxo · Acabamento `#b08968` bege · Pintura `#ca8a04` amarelo · Esquadrias `#8b5a2b` marrom. O tom claro de cada grupo é derivado programaticamente do tom escuro (mistura com branco), garantindo consistência dos dois tons. Grupos não mapeados recebem cor determinística de uma paleta estendida (hash do nome).
- **Progresso em dois tons da mesma cor**: parte escura = executado, parte clara = restante. A cor nunca muda com o progresso.
- **Nome da atividade sempre dentro da barra**, compactado com reticências quando não couber; em barras muito estreitas (zoom out) o nome some. Texto usa branco sobre o tom escuro ou o tom escuro do grupo sobre a parte clara (contraste).
- **% executado NÃO aparece na barra** — apenas no tooltip e no popover de edição.
- **Baseline** (toggle): barra fina translúcida abaixo da barra atual, nunca a substitui. Fonte: snapshot da baseline ativa.
- **Dependências** (toggle): setas predecessora → sucessora.
- **Alteração pendente**: borda azul + ponto azul no canto da barra.

### Tooltip (hover)
Nome completo · Grupo/disciplina · Local · Início → Término · Duração · **% executado** · Produtividade (dias/pavimento) · Predecessoras (tipo+lag) · Sucessoras (tipo+lag).

### Edição
- **Arrastar** barra = mover horizontalmente (snap ao dia, animação suave estilo Outlook Calendar).
- **Puxar bordas** = alterar início/término (redimensionar duração).
- **Clique** = popover com campos: Início, Término, Duração (dias), Produtividade (dias/pav — editar recalcula a duração).
- Ao soltar/aplicar: cascata empurra sucessoras automaticamente; tudo vira pendente no draft.
- **Alteração em massa**: se a atividade tem equivalentes e a duração mudou, dialog "Aplicar apenas nesta atividade?" / "Aplicar em todas as equivalentes?" (a segunda atualiza todas + suas cascatas).
- **Não permitido**: criar/excluir atividades, alterar predecessoras/sucessoras, editar % executado (papel da Medição).

### Gravar Report
Modal de confirmação (com descrição opcional, como na Medição) → envia **somente as atividades alteradas** (novas datas/durações) ao endpoint batch → sucesso: toast, draft limpo, dados recarregados. Modal de **histórico de reprogramações** (lista de `ScheduleRevision` com antes/depois).

## Performance (meta: 10.000+ atividades, 60fps)

- Um único `<canvas>` (DPR-aware) com camadas: fundo/grade (cache offscreen, redesenha só em zoom/resize), barras, dependências, interação. Repaint parcial via rAF + dirty-flags.
- Virtualização vertical: só linhas visíveis são desenhadas; árvore de locais (DOM) usa a mesma janela virtual com scroll sincronizado.
- Hit-testing: busca binária por Y + varredura ordenada por X.
- Tooltip/popover/menus = DOM overlay posicionado (nunca desenhados no canvas).
- Nunca renderizar milhares de elementos HTML.

## Tratamento de erros

- Batch transacional: erro → toast + **draft preservado** (nenhuma edição se perde).
- Conflito multi-usuário: evento realtime externo com draft pendente → banner "cronograma alterado por outro usuário" com opção de recarregar; nunca sobrescreve silenciosamente.
- Cliente: duração mínima 1 dia; resize impede datas invertidas por construção; scheduler com guarda anti-ciclo.
- Backend: validação de projeto/folha/datas (ver seção backend).

## Testes

- **Frontend (vitest)**: `cascade-scheduler` (FS/SS/FF/SF, lag, ciclos), `flowline-model` (agrupamento por pavimento, sub-faixas), `equivalence`, undo/redo.
- **Backend (jest)**: endpoint batch (transação, validações, rollup de pais, criação de `ScheduleRevision`), `gantt-data` com grupo.
- **Manual**: fluxo completo contra o seed — arrastar → cascata → undo → gravar → conferir no Cronograma e na Medição.

## Reuso de código existente

- `frontend/src/lib/wbs-tree.ts` — `buildForest`, `FLOOR_PATTERN`, `indexNodes` (hierarquia de locais).
- `frontend/src/hooks/useRealtime.ts` — `useRealtime`, `useScheduleChanges` (sync entre telas).
- Padrões de modal/toast/toolbar das telas Medição e Cronograma.
- `GanttTask` já traz `predecessorDeps`/`successorDeps` com tipo e lag.

## Mockups de referência

Mockups do brainstorming em `.superpowers/brainstorm/2016-1784076794/content/` (layout aprovado: flowline compacta; visual aprovado: `tela-completa-v3.html`).
