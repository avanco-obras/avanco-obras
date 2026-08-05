# Design — Cronograma: barra de botões padronizada, inserção de atividade e Report com restauração

**Data:** 2026-07-30
**Status:** Aprovado pelo usuário (seções 1–4)
**Escopo:** Três tarefas independentes sobre a tela Cronograma, com reflexo visual em Medição, Linha de Balanço e Programação Semanal.

## Objetivo

1. Unificar o padrão visual das barras de botões das quatro telas, reordenando e reiconizando a barra do Cronograma.
2. Fazer a criação de atividade respeitar a linha selecionada (posição e nível), recalculando o rollup de avanço.
3. Dar ao Report a capacidade de **restaurar** o sistema para uma versão salva, compartilhando histórico entre Cronograma, Medição e Linha de Balanço, e mantendo a Programação Semanal isolada.

## Decisões validadas com o usuário

| Tema | Decisão |
|---|---|
| Escopo do restore | Cronograma + medições + dependências. Exige ampliar o snapshot do Report. |
| Reports já gravados | Restauração **parcial com aviso**: restauram só o cronograma; medições e dependências ficam intactas. O histórico existente continua utilizável. |
| Rede de segurança | Antes de sobrescrever, grava automaticamente um Report do estado atual. Restaurar é reversível. |
| % Avanço em criar/excluir | Recalcula **apenas o rollup dos pais**. O indicador "% Avanço Físico" do topo continua preso ao último Report gravado (regra atual preservada). |
| Report na Linha de Balanço | **Unificar**: a reprogramação passa a gravar também um `ProjectReport`; o histórico da tela mostra reports. A `ScheduleRevision` continua sendo gravada por baixo para preservar rastreabilidade. |
| Programação Semanal | Report exclusivo e isolado (`weekly_snapshots`), **somente visualização** — sem restaurar. |
| Expandir / Recolher | Permanecem **dois botões** separados. |
| Exportar | Gera `.xlsx` em um clique. **A exportação CSV é removida.** |
| Mockup visual | Aprovado (artifact "Mockup — Barra de botões padronizada"). |
| Mecanismo do restore | Reconciliação por diff preservando IDs para `schedule_items`; apagar-e-recriar para `schedule_dependencies` e `measurements`. Tudo em transação. |

## Contexto técnico levantado

Restrições reais do schema que determinam o desenho da restauração:

- `weekly_activities.schedule_item_id` → `ScheduleItem` com **`onDelete: SetNull`**. Apagar e recriar `schedule_items` destrói os vínculos da Programação Semanal de forma permanente, mesmo recriando com os mesmos IDs — o `SetNull` já disparou. Isso violaria o requisito de isolamento da Prog. Semanal.
- `schedule_dependencies` e `measurements` **não são referenciados por nenhuma outra tabela**. Podem ser apagados e recriados sem efeito colateral.
- `Measurement` liga-se a `Unit` + `ActivityType`, **sem vínculo com `ScheduleItem`**. Por isso as medições não estão no snapshot atual e precisam de campo próprio.
- `ScheduleItem.parentId` é auto-relação: a ordem de inserção importa (pais antes dos filhos).
- `lucide-react` e `xlsx` já constam em `frontend/package.json` — nenhuma dependência nova.
- O design system já existe em `frontend/src/index.css`: `.ao-btn`, `.ao-btn-sm`, `.ao-btn-primary`, e `.ao-btn svg { width: 13px; height: 13px }`.

---

## 1. Barra de botões

### 1.1 Módulo de toolbar

Hoje cada tela monta a barra à mão com estilos inline divergentes — a causa raiz da inconsistência. Novo módulo `frontend/src/components/ui/Toolbar.tsx`:

| Componente | Responsabilidade |
|---|---|
| `Toolbar` | Contêiner flex, `gap: 6px`, `flex-wrap`, alinhamento central. |
| `ToolbarButton` | Envolve `.ao-btn.ao-btn-sm`; props `icon`, `label`, `variant` (`default` \| `primary`), `disabled`, `title`. Sem `label` renderiza como ícone puro, com `aria-label` obrigatório. |
| `ToolbarSelect` | Select padronizado (mesma altura e fonte dos botões). Um `<select>` nativo não aceita SVG interno: o ícone é posicionado sobre o campo por um wrapper `position: relative` + ícone `absolute` + `padding-left` no select, o mesmo padrão do `ToolbarSearch`. |
| `ToolbarSearch` | Input com ícone `Search` sobreposto pelo mesmo padrão de wrapper. |
| `ToolbarMenu` | Botão com dropdown, para Baseline, Report e menus futuros. Fecha em clique externo e em `Esc`. |
| `ToolbarSeparator` | Divisória vertical de 1px. |

Tamanho, fonte e espaçamento passam a viver em um lugar só: um botão presente em duas telas fica idêntico por construção.

### 1.2 Cronograma — mudanças

- Título `EAP — Cronograma completo` → **`Cronograma`**.
- **Remover** a legenda de status (Planejado / No prazo / Leve atraso / Crítico / Hoje) e a dica "Duplo clique ou F2 para editar · Passe o mouse para ver ações".
  - *Consequência aceita:* a legenda era a única chave para as cores das barras do Gantt. Compensação: o status passa a compor o `title` de cada barra, já exibido no hover. A legenda **não** volta.
- Todo emoji vira ícone `lucide-react` (`⚙ 🔍 📊 📈 ↑ +` saem).
- Baseline e Report perdem as cores roxa e rosa e viram botões neutros com menu. **Apenas `Nova atividade` permanece azul**, como ação primária da tela.

### 1.3 Ordem final (esquerda → direita)

| # | Controle | Ícone lucide | Observação |
|---|---|---|---|
| 1 | Buscar atividades | `Search` | Ganha ícone embutido |
| 2 | Desfazer · Refazer | `Undo2` · `Redo2` | Movidos do fim da barra |
| 3 | Expandir · Recolher | `ChevronsUpDown` · `ChevronsDownUp` | Dois botões separados |
| 4 | Todos os níveis | `Layers` | Select |
| 5 | Meses | `CalendarRange` | Select de escala temporal |
| 6 | Filtros avançados | `SlidersHorizontal` | Mantém realce quando há filtro ativo |
| 7 | Nova atividade | `Plus` | Variante `primary` |
| 8 | Remover · Adicionar recuo | `ArrowLeft` · `ArrowRight` | Ícone puro, com `aria-label` |
| 9 | Colunas | `Columns` | Menu (`Columns3` não existe no lucide-react 0.294) |
| 10 | Exportar | `Download` | **Gera `.xlsx`; CSV removido** |
| 11 | Importar | `Upload` | Inalterado |
| 12 | Baseline | `Flag` | Menu; perde o roxo |
| 13 | Report | `FileText` | Menu; ganha *Restaurar* |

### 1.4 Exportação Excel

Substitui `handleExport` (CSV). Usa `xlsx`, já instalado.

- Respeita as **colunas visíveis** (`visibleCols`) e a ordem de `COL_DEFS`.
- Preserva a hierarquia da EAP: coluna de código WBS e indentação do nome por `level`.
- Cabeçalho congelado; larguras de coluna calculadas pelo conteúdo.
- Nome do arquivo: `cronograma-<projeto>-<YYYY-MM-DD>.xlsx`.
- A função de exportação CSV é **removida**, não mantida como opção.

### 1.5 Demais telas

Medição, Linha de Balanço e Programação Semanal passam a usar os mesmos componentes. **Botões e ordem preservados** — muda apenas o visual. A Programação Semanal já usava `lucide` + `.ao-btn.ao-btn-sm` de forma consistente e serve de referência do padrão alvo.

---

## 2. Inserção de nova atividade

### 2.1 Comportamento

Atual: `openNew()` em `frontend/src/pages/Cronograma.tsx` sempre cria a atividade como filha direta da raiz.

Novo: a atividade é inserida **imediatamente abaixo da linha selecionada, como irmã dela** — herdando `parentId` e `level`, com `order = selecionada.order + 1`. As atividades seguintes do mesmo pai têm o `order` deslocado em +1, dentro de uma transação.

### 2.2 Casos de borda

| Situação | Comportamento |
|---|---|
| Nenhuma linha selecionada | Filha da raiz, no fim da lista (comportamento atual preservado). |
| Linha selecionada é a **raiz** | Filha da raiz. A raiz não admite irmãos — regra já existente no código. |
| Linha selecionada tem filhos | A nova atividade é irmã da selecionada, inserida **após toda a subárvore** dela, para não quebrar a contiguidade da hierarquia. |

### 2.3 Recálculo de avanço

Criar e excluir passam a acionar `recalculateParentTasks(projectId)`, propagando o rollup ponderado (`calculateParentProgress`) para cima até a raiz.

O indicador "% Avanço Físico" do topo da tela **não muda** — permanece vinculado ao último Report gravado, conforme a regra já documentada no código. Nenhum aviso visual de divergência é adicionado.

### 2.4 API

`POST /projects/:projectId/schedule` ganha o campo opcional `afterId`. Quando presente, o backend resolve `parentId`, `level` e `order` a partir do item indicado e desloca os irmãos posteriores, tudo em transação. Quando ausente, mantém o comportamento atual.

---

## 3. Report com restauração

### 3.1 Modelo de dados

`ProjectReport` ganha três campos:

| Campo | Tipo | Uso |
|---|---|---|
| `dependencySnapshot` | `Json?` | Cópia de `schedule_dependencies` no momento da gravação. |
| `measurementSnapshot` | `Json?` | Cópia de `measurements` das unidades do projeto. |
| `snapshotVersion` | `Int @default(1)` | `1` = reports antigos (só cronograma); `2` = snapshot completo. |

Migração Prisma: campos nulos, sem backfill. Reports existentes permanecem `v1`.

### 3.2 Endpoint

`POST /projects/:projectId/physical-progress/reports/:reportId/restore`

Executa em `prisma.$transaction`:

1. **Report de segurança** — grava um `ProjectReport` (`v2`) do estado atual, com descrição automática `Antes da restauração do Report #<n>`.
2. **Reconciliação de `schedule_items` por diff, preservando IDs:**
   - presente no snapshot e no banco → `update` dos campos;
   - presente só no snapshot → `create` com o ID original;
   - presente só no banco → `delete`.
   - Inserções ordenadas por `level` crescente (pais antes dos filhos); remoções em ordem inversa.
   - Preservar IDs é o que mantém intactos os vínculos de `weekly_activities`. Para atividades que realmente deixam de existir na versão restaurada, o `SetNull` é o comportamento correto — a linha semanal sobrevive legível porque `activityName` é desnormalizado.
3. **Dependências** — apagar todas do projeto e recriar do `dependencySnapshot`. Pulado se `snapshotVersion = 1`.
4. **Medições** — apagar as das unidades do projeto e recriar do `measurementSnapshot`. Pulado se `snapshotVersion = 1`.
5. **Recalcular** os pais via `recalculateParentTasks`.
6. **Emitir** o evento de realtime de mudança estrutural, consumido por `useScheduleChanges` em todas as telas.

Qualquer falha desfaz a transação inteira — não há estado meio-restaurado.

**Limitação conhecida — vínculos semanais já perdidos não voltam.** A reconciliação preserva todo vínculo de `weekly_activities` que exista **no momento da restauração**. Ela não consegue ressuscitar um vínculo destruído *antes* dela: se uma atividade foi excluída (o `SET NULL` já apagou o ponteiro) e depois se restaura um report anterior à exclusão, a atividade volta com o mesmo ID, mas a linha semanal continua com `schedule_item_id` nulo — não há registro de para onde ela apontava. Verificado em teste real: 13 vínculos antes da restauração, 13 depois; o 14º havia sido destruído pela exclusão anterior. A alternativa de apagar-e-recriar seria estritamente pior, zerando os 14. Resolver isso exigiria gravar o mapa de vínculos no snapshot e reescrever `weekly_activities` na restauração — o que contraria o isolamento da Programação Semanal e fica fora do escopo até decisão em contrário.

### 3.3 Modal de confirmação

Obrigatório antes de executar. Exibe número da versão, data, autor, descrição e o que será sobrescrito. Ação destrutiva em variante de perigo; confirmação explícita.

Para reports `v1`, o modal acrescenta o aviso de que a versão é anterior à ampliação do snapshot e que **apenas o cronograma** será restaurado, com medições e dependências preservadas.

### 3.4 Escopo por tela

| Tela | Histórico | Gravar | Restaurar |
|---|---|---|---|
| Cronograma | `project_reports` (compartilhado) | Sim | Sim |
| Medição | `project_reports` (compartilhado) | Sim | Sim |
| Linha de Balanço | `project_reports` (compartilhado) | Sim — a reprogramação passa a gravar também um `ProjectReport` | Sim |
| Programação Semanal | `weekly_snapshots` (**isolado**) | Sim | **Não** |

Na Linha de Balanço, `scheduleApi.batchUpdate` passa a gravar um `ProjectReport` além da `ScheduleRevision`. A revisão continua sendo gravada para não perder a rastreabilidade de reprogramações que já existe; o histórico exibido na tela passa a ser o de reports.

---

## 4. Testes

**Backend**
- Diff da reconciliação: criar, atualizar e remover itens; ordenação por `level`.
- Preservação dos vínculos de `weekly_activities` após restauração.
- `SetNull` aplicado apenas às atividades genuinamente removidas.
- Rollback completo quando um passo da transação falha.
- Restauração `v1` (parcial) vs `v2` (completa).
- Geração do report de segurança antes da sobrescrita.
- `afterId` na criação: `parentId`, `level` e `order` resolvidos; irmãos deslocados.
- Rollup de pais após criar e após excluir.

**Frontend**
- Ordem de inserção e herança de nível, incluindo os três casos de borda de §2.2.
- Indicador do topo **não** se altera ao criar/excluir.
- Geração do `.xlsx` respeitando colunas visíveis e hierarquia.
- Modal de confirmação bloqueia a restauração até a confirmação explícita.
- Aviso de restauração parcial aparece apenas em reports `v1`.

## Fora de escopo

- Restauração na Programação Semanal.
- Aviso visual de divergência entre o cronograma e o último Report gravado.
- Retorno da legenda de status do Gantt.
- Manutenção da exportação CSV.
- Refatoração das telas além da barra de botões.
