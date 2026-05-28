# AvançoObras Pro — Frontend Design System
## Decisões de design, arquitetura visual e registro de modificações

---

## 1. CONTEXTO DO PRODUTO

O AvançoObras é um sistema de controle de cronograma de obras utilizado diariamente por:

- **Auditores de obra** — precisam de rastreabilidade, status claro, evidências
- **Engenheiros civis** — foco em dados técnicos, densidade, velocidade operacional
- **Coordenadores** — acompanhamento de equipes, tarefas, restrições
- **Diretoria / Senior Management** — visão macro, KPIs, risco, prazo, custo

A hierarquia operacional do sistema é:

```
Empreendimento → Torre → Pavimento → Unidade → Ambiente → Tarefa
```

O sistema também suporta visualizações horizontais (tarefa em múltiplas unidades, equipe em múltiplas tarefas, auditor em múltiplas obras).

---

## 2. FILOSOFIA DE DESIGN

### Nome da linguagem visual: **Structural**

Inspiração: plantas técnicas de engenharia, dashboards de controle industrial, Bloomberg Terminal, Procore, SAP Fiori, Autodesk Construction Cloud.

### Os três princípios fundamentais

**1. Precision over Decoration**
Cada pixel serve a um propósito operacional. Cor não é estética — é sinal. Espaçamento não é respiração — é hierarquia. Nenhum elemento decorativo que não carregue informação.

**2. Data as Primary Interface**
A interface é o dado. O chrome (sidebar, topbar, cards) serve aos dados, não o contrário. Menos container, mais conteúdo. Tabelas são o coração do sistema.

**3. Context Always Visible**
O usuário nunca deve se perguntar "onde estou?" ou "de qual obra são esses dados?". Localização hierárquica e contexto operacional são sempre visíveis.

### O que este sistema NÃO é

- Não é um SaaS de consumo (sem gradientes, sem animações de entrada, sem cards gigantes)
- Não é um app de startup (sem cores vibrantes como decoração, sem UI infantil)
- Não é um dashboard de marketing (sem KPIs como decoração, sem números sem contexto)

### Referências corretas

| Produto | O que aprendemos |
|---|---|
| Procore | Hierarquia de navegação, tabelas densas, drill-down contextual |
| Linear | Sidebar colapsável, Command Palette, views salvas |
| Stripe Dashboard | Tipografia de dados, KPIs instrumentais, densidade inteligente |
| SAP Fiori | Enterprise tokens, consistência de formulários |
| Bloomberg Terminal | Monospace para dados numéricos, cor como sinal exclusivo |
| Autodesk Construction Cloud | Dark sidebar, acento âmbar, identidade de construção |

---

## 3. DESIGN SYSTEM

### 3.1 Paleta de Cores

Princípio fundamental: **cor é sinal, não decoração**. Cores semânticas aparecem exclusivamente em badges de status, indicadores de estado e alertas. Nunca como cor de fundo de cards, nunca em botões decorativos.

```
FUNDAÇÃO (superfícies)
--page:  #F1F4F9   Fundo da página (cool gray, menos neutro que cinza puro)
--s0:    #FFFFFF   Cards, modais, inputs
--s1:    #F8FAFC   Hover background, headers de tabela, wells
--s2:    #F1F4F9   Recuo de seção, legenda heatmap
--s3:    #E2E8F0   Barras de progresso, separadores
--s4:    #CBD5E1   Borders mais fortes

TEXTO
--t1:    #0D1829   Primário (quase preto com tom navy)
--t2:    #2D3D52   Secundário
--t3:    #5A6A7E   Muted (labels, metadados)
--t4:    #8898AA   Extra muted (placeholders, datas)

BORDAS
--bd:    #E2E8F0   Padrão
--bd2:   #CBD5E1   Mais forte
--bd3:   #94A3B8   Separadores primários

INTERATIVO (azul institucional — não SaaS blue genérico)
--blue:  #1D4ED8   Primary brand
--blue-d:#1E3A8A   Hover

STATUS (apenas para dados operacionais)
--green: #16A34A / --grn-bg: #F0FDF4   Concluído, no prazo, aprovado
--amber: #D97706 / --amb-bg: #FFFBEB   Em andamento, atenção, risco médio
--red:   #DC2626 / --red-bg: #FEF2F2   Atrasado, crítico, reprovado
--violet:#7C3AED / --vio-bg: #F5F3FF   Pendente revisão, auditoria

SIDEBAR (dark navy — tokens independentes)
--ctx-bg:    #0D1526   Background principal
rail-icon:   #3E5470   Ícone inativo
rail-act-t:  #7EB6F5   Ícone/texto ativo
rail-act-bar:#2563EB   Barra de acento ativo
```

### 3.2 Tipografia

Duas famílias com papéis distintos:

```
Inter (sans-serif)     → Interface, labels, texto, botões
IBM Plex Mono          → TODOS os dados numéricos, percentuais, datas, códigos WBS, tamanhos de arquivo
```

**Regra crítica:** Números financeiros, percentuais e datas **sempre** em `var(--mono)`. Misturar sans-serif com valores numéricos cria inconsistência óptica em tabelas — o olho perde o alinhamento vertical em uso prolongado.

Escala tipográfica:

```
KPI valores grandes   32–26px  700  mono  letra-spacing: -1.5px
Subtítulos de seção   13–15px  700  sans  
Corpo principal       12–13px  400  sans  
Labels de tabela      9px      800  sans  UPPERCASE, letter-spacing: 0.7px
Dados em tabela       11–12px  400  mono  
Metadados             10–11px  400  mono  
```

### 3.3 Espaçamento (base 4px)

```
2px   Separadores internos mínimos
4px   Gaps de badge/ícone
8px   Padding vertical de célula de tabela
12px  Padding horizontal de célula, gap de elementos
14–16px  Padding de card body
24px  Gap entre cards
```

### 3.4 Border Radius

```
--r-sm: 2px   Badges de status (retangulares, não pills)
--r-md: 4px   Inputs, botões, chips, tooltips
--r-lg: 6px   Cards, modais
--r-xl: 8px   Painéis de destaque
```

**Regra:** Tabelas e elementos de dados têm **radius zero**. Arredondamento excessivo sinaliza consumer app. Badges são retangulares (2px), nunca pills.

### 3.5 Sombras

Filosofia: **separação por cor, não por sombra**. Sombra existe apenas em elementos sobrepostos.

```
--shadow-xs:  0 1px 2px rgba(0,0,0,.04)              Cards normais
--shadow-sm:  0 1px 3px rgba(0,0,0,.06)              Cards com ação
--shadow-md:  0 4px 8px rgba(0,0,0,.06)              Dropdowns
--shadow-lg:  0 8px 24px rgba(0,0,0,.08)             Modais, Command Palette
```

---

## 4. ARQUITETURA DE NAVEGAÇÃO

### Sidebar unificada colapsável

Um único componente de sidebar com dois estados:

**Expandido (220px):**
- Logo + texto "AvançoObras PRO"
- Seletor de projeto (nome + empresa + chevron)
- Labels de seção ("Principal", "Configuração")
- Items: ícone (14px) + label
- Footer: avatar + nome + cargo + menu de usuário

**Recolhido (52px):**
- Só logo mark
- Dot indicador de projeto ativo
- Só ícones (18px, centralizados)
- Tooltips ao hover para todos os items
- Botão de expandir + avatar no footer

**Razão:** O design anterior com "App Rail + Context Sidebar" separados era redundante e adicionava complexidade sem benefício real. Um único sidebar colapsável é o padrão consolidado em ferramentas enterprise (Linear, Notion, Figma).

### Topbar

```
[Breadcrumb: Obra > Módulo > Contexto]    [Prazo]  [⌘K Buscar]  [🌙]  [🔔]  [↓]
```

- Breadcrumb é informação de contexto, não decoração
- Sem título de página separado (já está no breadcrumb)
- Command Palette via `⌘K` para navegação sem mouse
- Toggle de tema dark/light

### Command Palette `⌘K`

Acesso universal por teclado. Essencial para power users que trabalham o dia todo no sistema.

```
⌘1  Dashboard
⌘2  Cronograma
⌘3  Medição
⌘4  Prog. Semanal
⌘K  Abrir/fechar palette
```

---

## 5. COMPONENTES CORE

### 5.1 Tabelas — o componente mais crítico

Tabelas são ~70% da interface. Precisam ter:

- **Header**: 9px uppercase bold, fundo `--s1`, border-bottom 2px `--bd2`, sem border-radius
- **Linhas**: 36px de altura (padrão), hover em `#EFF6FF` (blue tint)
- **Seleção**: background azul + `box-shadow: inset 2px 0 0 var(--blue)` (borda lateral)
- **Números**: sempre `font-family: var(--mono)`, right-aligned
- **Zebra striping**: NÃO usar — aumenta carga visual sem benefício em dados densos
- **Column borders**: `1px solid var(--bd)` em cada td

### 5.2 Status Badges

Sistema de 6 estados semânticos — nunca pills, sempre retangulares:

```
● Concluído    verde     ao-s-done
● Em andamento azul      ao-s-going
● Atenção      âmbar     ao-s-warn
● Crítico      vermelho  ao-s-crit
● Não iniciado cinza     ao-s-idle
● Auditoria    violeta   ao-s-review
```

Anatomia:
- `border-radius: 2px` (quasi-retangular)
- `font-size: 9px, font-weight: 800, text-transform: uppercase, letter-spacing: 0.6px`
- Dot prefix (5×5px) na cor do status
- Background em 10% da cor + border 1px

### 5.3 KPI Instruments

KPIs não são decoração — são instrumentos de decisão.

Cada KPI deve ter:
1. **Label**: 9px uppercase bold
2. **Valor**: 26–34px mono, cor semântica
3. **Delta**: vs. período anterior OU vs. meta (com ícone ↑↓ e cor)
4. **Barra de contexto**: 2px de altura, cor semântica
5. **Drill hint**: "→ ver detalhes" clicável

**O que NÃO fazer:**
- Anéis SVG decorativos (parecem consumer app, não instrumentos)
- KPI sem delta temporal (número sem contexto não decide nada)
- Mais de 5 KPIs primários na mesma tela

### 5.4 Cards

Estrutura padrão:

```jsx
<div className="ao-card">
  <div className="ao-card-hdr">
    <span className="ao-card-title">TÍTULO UPPERCASE</span>
    <badge | button />
  </div>
  <div className="ao-card-body">
    conteúdo
  </div>
</div>
```

Card header: background `--s0`, label 11px uppercase bold 0.5px letter-spacing, altura mínima 40px.

Variantes com acento superior (só quando o card tem hierarquia semântica):
- `.ao-card-accent-blue` — azul (ativo/principal)
- `.ao-card-accent-green` — verde (positivo)
- `.ao-card-accent-amber` — âmbar (atenção)
- `.ao-card-accent-red` — vermelho (crítico)

### 5.5 Formulários

Labels: 9px uppercase 800 letter-spacing 0.7px.

Seções de formulário agrupadas por categoria com `.ao-sec-title` (linha divisória com `::after`):

```
IDENTIFICAÇÃO ─────────────────────
[Nome *]       [Status]
[Empresa]      [Endereço]

ESTRUTURA CONSTRUTIVA ──────────────
[Torres]  [Pavimentos]  [Unidades]  [Área]

PRAZO E CUSTO ──────────────────────
[Início]  [Término]  [Custo]  [Moeda]
```

Inputs: `border: 1px solid var(--bd)`, focus: `border-color: var(--blue) + box-shadow: 0 0 0 3px rgba(29,78,216,.10)`.

### 5.6 Alertas

Border-left de 4px como acento principal, borders finos nos outros lados, sem sombra:

```
.ao-alert-warn   → border-left: 4px solid var(--amber)
.ao-alert-danger → border-left: 4px solid var(--red)
.ao-alert-info   → border-left: 4px solid var(--blue)
.ao-alert-success→ border-left: 4px solid var(--green)
```

### 5.7 Botões

Hierarquia de 4 níveis:
1. **Primary** — `ao-btn-primary`: azul sólido, ação principal da tela
2. **Default** — `ao-btn`: border + bg branco, ação secundária
3. **Ghost** — `ao-btn-ghost`: sem border, ação terciária
4. **Danger** — `ao-btn-danger`: red-bg + red-t, destruição

**Proibido:** emojis em botões (💾, 🗑️, ⚠️). Usar ícones Lucide ou texto puro.

---

## 6. PADRÕES DE UX ENTERPRISE

### Densidade inteligente

Projetado para power users em monitores de 1440p+:

- Linhas de tabela: 36px (padrão), 28px (compacto)
- Font size base: 13px (não 14px de SaaS consumer)
- Padding de card body: 14px (não 24px de landing page)
- Topbar: 44px

### Feedback visual de status

Hierarquia de feedback:
1. **Toast de sucesso**: 3s auto-dismiss
2. **Toast de aviso**: 8s auto-dismiss
3. **Toast de erro**: dismiss manual (dado crítico não some sozinho)
4. **Inline**: alerts e mensagens dentro do formulário/card

### Loading states

- Skeleton: opacity estática (sem pulse pulsante — irrita em uso prolongado)
- Progressive loading: header + primeiras linhas aparecem imediatamente
- Loader2 com `ao-spin` apenas para ações pontuais

### Vazio e ausência de dados

Empty states são textuais e funcionais — sem ilustrações decorativas:

```
Nenhuma atividade encontrada

Os filtros ativos não retornam resultados.

[Limpar filtros]  [Ajustar filtros]
```

---

## 7. REGRAS ABSOLUTAS

Estas regras NÃO devem ser violadas:

1. **Sem emojis em botões, headers ou labels** — use ícones Lucide
2. **Sem `border: 0.5px`** — mínimo `1px`
3. **Sem `background: linear-gradient(...)` em elementos de dados** — fundo sólido ou transparente
4. **Sem border-radius > 6px em cards** — exceto modais (8px)
5. **Sem zebra striping em tabelas** — hover é suficiente
6. **Sem pills (border-radius: 99px) em badges** — use 2px
7. **Sem cores como decoração** — cor = estado/sinal
8. **Números sempre em `font-family: var(--mono)`**
9. **Sem `var(--bg1)`, `var(--bg2)`, etc.** — use `var(--s0)`, `var(--s1)`, etc.
10. **Sem `box-shadow` em cards normais** — use `var(--shadow-xs)` apenas

---

## 8. REGISTRO DE MODIFICAÇÕES

### Sprint 1 — Tema base e navegação

#### `frontend/src/index.css` — Design system completo

**Antes:** Tema genérico SaaS azul (`#1B6FE8`), border-radius 6/8px, sidebar branca, badges em pills, variáveis legadas (`--bg1..4`).

**Depois:**
- Fonte: IBM Plex Sans → **Inter** (melhor legibilidade em densidades altas) + IBM Plex Mono para dados
- Primary: `#1B6FE8` → `#1D4ED8` (azul institucional mais profundo)
- Border-radius: 6/8px → **2/4/6px** (precisão técnica)
- Background: `#F2F3F5` → `#F1F4F9` (cool blue-gray)
- Tokens sidebar separados: `--ctx-bg`, `--ctx-t1/t2/t3`, `--rail-*`
- Novos componentes: `.ao-status-*` (6 estados), `.ao-metric` (KPI enterprise), `.ao-table-wrap`, `.ao-kpi-strip`
- Badges: pills → retangulares 2px com dot prefix
- Command Palette: `.ao-cmd-overlay`, `.ao-cmd-palette`
- Alert: border-left 4px acento
- Tabelas: header 2px border-bottom, hover `#EFF6FF`, column borders

#### `frontend/tailwind.config.ts`

- Primary HSL atualizado: `217 83% 51%` → `217 72% 40%`
- Border radius mapeado para `--r-*` tokens
- Fontes: IBM Plex Sans → Inter

#### `frontend/src/layouts/AppLayout.tsx` — Navegação unificada

**Antes:** Sidebar branca com logo, nav items simples, topbar com pills de data/projeto.

**Modificação 1 — App Rail + Context Sidebar (bifurcação temporária):**
- Rail (48px) sempre visível com ícones
- Context Sidebar (220px) colapsável
- Topbar com breadcrumb

**Modificação 2 — Sidebar unificada (decisão final):**
- Um único componente com dois estados: **expandido (220px)** e **recolhido (52px)**
- Expandido: logo text + seletor de projeto + labels de seção + ícone + texto + user footer completo
- Recolhido: logo mark + dot de projeto + apenas ícones (18px) + tooltips + botão de expand
- Transição: `width: .2s ease`
- `PanelLeftClose` no header para recolher, `PanelLeftOpen` no footer para expandir
- Command Palette `⌘K` com atalhos `⌘1–4` por módulo
- Keyboard shortcuts globais registrados via `useEffect`

**Razão da unificação:** Rail + Context Sidebar separados era redundante — dois cliques para o que deveria ser um. O padrão industry-standard (Linear, Notion, Figma) é sidebar única colapsável.

---

### Sprint 2 — Páginas principais

#### `frontend/src/pages/Dashboard.tsx`

**KPI Rings → AoMetric blocks:**
- Removidos: anéis SVG decorativos (SVG `<circle>` com strokeDasharray)
- Adicionados: blocos métricos enterprise com número mono 34px + label uppercase + delta + barra 2px
- Delta contextual: `+1,8pp esta semana` vs. `meta 80%` vs. `−5.8pp`
- Acento de card por severidade: `accent-blue` (avanço), `accent-red` (atrasos), `accent-amber` (restrições)
- Card headers: `ao-card-hdr` com `ao-card-title` uppercase
- Etapas: barra dupla (planejado ghost + realizado sólido), valor em mono bold

#### `frontend/src/pages/Cadastro.tsx` — Formulário enterprise

**Antes:** Grid 2 colunas sem agrupamento, padding ausente no card body, upload zone genérica, membros em lista de divs.

**Depois:**
- Formulário dividido em 4 seções com `--sec-title` e linha divisória: **Identificação**, **Estrutura construtiva**, **Prazo e custo**, **Parâmetros operacionais**
- Campo Status adicionado (PLANNING/IN_PROGRESS/ON_HOLD/COMPLETED)
- Estrutura construtiva: grid 4 colunas (torres/pavimentos/unidades/área)
- Upload zone: container com ícone, texto descritivo, estado de loading, lista de arquivos com border+fundo
- Modelo 3D: estado vazio vs. iframe quando vinculado
- Equipe: `ao-table` com header de colunas (Nome, E-mail, Função), avatar circular com iniciais
- Modal IA: backdrop blur, borda `bd2`, shadow-lg, dados em cards com label 9px + número mono 18px, atividades sugeridas em badges verdes

#### `frontend/src/pages/ProgramacaoSemanal.tsx`

**Antes:** Header solto em div, PPC só como texto, card de restrições sem `ao-card-hdr`, emojis.

**Depois:**
- Header como card enterprise: navegação ← Semana → com seta, título bold 13px, ano em mono
- Mini-ring SVG (44px) mostrando PPC com cor semântica (verde/âmbar/vermelho)
- Tarefas: tabela com checkbox `accentColor: var(--blue)`, colunas reordenadas
- Restrições: card com header + badge de contagem de pendentes
- Empty states textuais
- Causa de não cumprimento: input inline styled

#### `frontend/src/pages/Configuracoes.tsx`

**Antes:** Cards sem `ao-card-hdr`/`ao-card-body`, avatar amber, `💾 Salvar conta`, `🗑️ Deletar`, `⚠️ Zona de perigo`, checkboxes raw.

**Depois:**
- Todos os cards com estrutura `ao-card-hdr` + `ao-card-body`
- Avatar: amber → `var(--blu-bg)` (azul — correto para conta de usuário)
- Botões: sem emoji, texto direto ("Salvar alterações", "Confirmar exclusão")
- Notificações: cada item com label + sublabel descritivo + `accentColor: var(--blue)`
- Critério de avanço: cada opção com label + sublabel explicativo
- Fórmula: card `s1 + border` com label 9px + código mono
- "Zona de perigo": card com `border-top: 3px solid var(--red)`, confirmação via `ao-alert-danger`
- ActivityTypeRow: bordas `1px` normalizadas

#### `frontend/src/pages/Medicao.tsx`

**Antes:** KpiBar com `linear-gradient`, labels genéricos, filter buttons inline-styled, `var(--bg*)` aliases, `var(--bg3)` na legenda.

**Depois:**
- KpiBar: fundo branco `var(--s0)`, labels 9px uppercase mono
- Valores: 26px mono bold com letter-spacing negativo
- Filter buttons: usa `.ao-tab` do design system (underline style)
- Legenda heatmap: `var(--s2) + border: 1px solid var(--bd)`
- Todos `var(--bg1–4)` → `var(--s0–3)`

#### `frontend/src/pages/Cronograma.tsx`

- Todos `var(--bg1–4)` → `var(--s0–3)`
- Bordas `0.5px` → `1px`
- `borderRadius: 14` → `6` (consistente com design system)

---

## 9. ARQUITETURA DE ARQUIVOS

```
frontend/src/
├── index.css              ← Design system completo (tokens, componentes, utilities)
├── App.tsx
├── main.tsx
├── layouts/
│   └── AppLayout.tsx      ← Sidebar unificada, topbar, command palette
├── pages/
│   ├── Login.tsx          ← Hero dark navy, accent amber, form enterprise
│   ├── Dashboard.tsx      ← KPI metrics, curva S, etapas, atrasos, restrições
│   ├── Cronograma.tsx     ← Gantt, filtros de coluna, modal de edição
│   ├── Medicao.tsx        ← Grid de unidades, modelo 3D SVG, KPI bar
│   ├── ProgramacaoSemanal.tsx  ← Semanas, PPC ring, tarefas, restrições
│   ├── Cadastro.tsx       ← Formulário multi-seção, upload, equipe, AI modal
│   └── Configuracoes.tsx  ← Conta, notificações, tipos, zona de perigo
├── components/
│   └── ui/                ← shadcn/Radix primitives
├── store/                 ← Zustand (auth, project, UI state)
├── services/              ← Axios API client
├── hooks/
├── types/
└── utils/
```

---

## 10. PRÓXIMOS PASSOS RECOMENDADOS

### Alto impacto, baixo risco
- [ ] Command Palette com busca em projetos, atividades e tarefas
- [ ] Filtros avançados com views salvas por módulo
- [ ] Persistência de contexto (última obra/pavimento/atividade visitada) via localStorage
- [ ] Inline editing em tabelas — duplo-clique para editar sem abrir modal
- [ ] Batch actions (seleção múltipla em tabelas + ações em massa)

### Alto impacto, médio esforço
- [ ] Dashboard executivo separado com visão multi-obra
- [ ] Virtualização de tabelas para 500+ linhas (react-virtual)
- [ ] Tela de medição sincronizada: mapa de pavimento ↔ tabela
- [ ] Keyboard shortcuts documentados em `⌘K`

### Qualidade e robustez
- [ ] Skeleton loaders consistentes em todas as telas
- [ ] Toast system com fila (máximo 3 simultâneos)
- [ ] Dark mode completo com todos os tokens (`prefers-color-scheme` + toggle manual)
- [ ] Error boundaries por seção
- [ ] Acessibilidade: foco, ARIA labels em elementos interativos

---

*Documento gerado em Mai/2026 — AvançoObras Pro v2.x*
