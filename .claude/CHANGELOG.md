# Changelog — AvançoObras Pro

> Histórico de modificações da branch de desenvolvimento.  
> Baseado nos commits: `32fab2ec` → `6d16bf6e` → `5a79c119` → `851d0e45`

---

## [feature IA] — 2026-05-11 · commit `851d0e45`

### Backend — Módulo de Importação por IA

- **Novo módulo `ai-import`** integrado ao `app.module.ts`:
  - `ai-import.service.ts` — serviço que recebe um buffer de PDF, faz upload para a API Mistral, obtém URL assinada e executa uma análise de conteúdo via chat completion com um prompt especializado em engenharia civil brasileira
  - `ai-import.controller.ts` — endpoint `POST /ai-import/analyze-pdf` (recebe multipart/form-data com o PDF)
  - `ai-import.module.ts` — declara e exporta o serviço
  - `dto/ai-import-result.dto.ts` — DTO tipado de retorno com `projectInfo`, `activityTypes`, `schedule` (estrutura hierárquica EAP em 3 níveis), `rawAnalysis` e `confidence`

- **Prompt de IA especializado** (`CONSTRUCTION_PROMPT`): extrai do PDF:
  - Informações do empreendimento (nome, área, torres, pavimentos, unidades/pavimento, duração estimada, tipo)
  - Tipos de atividades com unidade e peso relativo (6–12 itens)
  - Cronograma hierárquico EAP (nível 0 = raiz, nível 1 = fases, nível 2 = sub-atividades)
  - Retorna fallback padrão com valores típicos para obras residenciais brasileiras quando o documento tem baixa clareza

- **Configuração Mistral** adicionada em `config/configuration.ts`:
  ```
  mistral.apiKey   → MISTRAL_API_KEY
  mistral.model    → MISTRAL_MODEL (padrão: mistral-small-latest)
  ```
  Variáveis adicionadas em `backend/.env`

- **Dependência adicionada** ao `backend/package.json`:
  - `@mistralai/mistralai` — SDK oficial da Mistral AI

### Frontend — Página de Cadastro com upload IA

- **`Cadastro.tsx` atualizado**: botão "Analisar com IA" que envia o PDF selecionado para o endpoint `/ai-import/analyze-pdf` e pré-preenche automaticamente o formulário de cadastro do projeto com os dados retornados

### Frontend — Ajustes de CSS e Layout

- **`index.css`**: expansão da paleta de classes utilitárias `ao-*` e refinamentos de espaçamento e tipografia

- **`AppLayout.tsx`**: ajustes no header e na nav pill horizontal

- **`Cronograma.tsx`** e **`Dashboard.tsx`**: correções visuais e ajustes de dados

- **`Medicao.tsx`**: pequenas correções de comportamento

- **`services/api.ts`**: novo endpoint `aiImport.analyzePdf()` adicionado ao cliente axios

- **`tailwind.config.ts`**: 4 linhas adicionadas para suporte a novas classes

### Outros arquivos

- **`.gitignore`**: atualizado com regras para `node_modules`, arquivos de build e binários
- **`docker-compose.yml`**: ajuste de configuração
- **`redesign_v3.html`**: arquivo HTML estático de referência visual (1823 linhas) para a nova iteração de design
- **`book-de-plantas_oceanico_itten.pdf`**: PDF de plantas adicionado como arquivo de referência/teste

---

## [small fixes and ifc added] — 2026-05-09 · commit `5a79c119`

### Frontend — Redesign visual completo (Sessão 4)

#### `index.css` — Design system substituído
- Paleta quente/neutra: `--bg:#f4f3ef`, `--bg1:#fff`, `--bg2:#f0efe9`, `--bg3:#e6e5df`
- Accent amber: `--amber:#BA7517`, verde `--green:#3B6D11`, vermelho `--red:#A32D2D`
- Dark mode via `.dark {}` + `@media(prefers-color-scheme:dark)` simultâneos
- Fonte `Segoe UI, system-ui, sans-serif`, 13px base, bordas 0.5px
- Variáveis HSL do shadcn remapeadas para a nova paleta
- Classes utilitárias globais `ao-*`: `ao-card`, `ao-card-hdr`, `ao-badge`, `ao-btn`, `ao-fg`, `ao-table`, `ao-kpi`, `ao-g2/g3`, `ao-pbar/pfill`, `ao-sec-title`

#### `AppLayout.tsx` — Reescrito
- Sidebar removida; layout com header + nav pill horizontal
- Header: `AvançoObras Pro` à esquerda, nome do projeto + datas (Atualização / Prazo) à direita
- Nav: pill compacto (`border-radius:12px`), ícone amber no tab ativo
- Container `max-width:1140px` centralizado
- Avatar com dropdown (Meu Perfil / Sair)

#### Páginas redesenhadas
| Página | Mudanças |
|--------|----------|
| **`Dashboard.tsx`** | KPI rings SVG inline (circumference 201.1), barras etapas planejado×real, PPC histórico com cores por faixa (verde/âmbar/vermelho), delay list com barra de criticidade |
| **`Cronograma.tsx`** | Compactado com `ao-card`, rows com estilos por nível (lv0=bg3, lv1=bg2, lv2-4 progressivo), expand/collapse ▶/▼, badges de status |
| **`Medicao.tsx`** | SVG isométrico 3D (sombra elipse, face lateral, telhado, fachada), andares clicáveis com destaque amber, activity rows com toggle, sem componentes shadcn |
| **`ProgramacaoSemanal.tsx`** | Coluna "Cumprida?" com checkbox nativo, PPC recalculado ao vivo, badges de status e restrições sem shadcn |
| **`Configuracoes.tsx`** | 2 colunas `ao-g2`, avatar circular, radio critério de avanço, tabela inline editável de métodos |
| **`Cadastro.tsx`** | Grid 2 colunas compacto, upload PDF com dashed border + botão IA, modelo 3D iframe Sketchfab |

### Documentação
- **`.claude/progress.md`**: atualizado com status 100% e detalhes da Sessão 4
- **`.claude/prompt_claude_code_avanco_obras.md`**: prompt do projeto refatorado e enxugado

### Outros
- **`frontend/src/vite-env.d.ts`**: adicionado `/// <reference types="vite/client" />`
- **`bayview-seniors-ifc-drawing-package-2020-07-20.pdf`**: PDF de referência IFC adicionado

---

## [html file] — 2026-05-09 · commit `6d16bf6e`

- **`avanco_obras_v2.html`** adicionado (1143 linhas): arquivo HTML estático completo com o design de referência visual da versão 2 do AvançoObras Pro — usado como modelo para o redesign das páginas React

---

## [first debug] — commit `3ee2e480`

### Frontend — Dependências e configuração

- **Instalação do Zustand** e todas as suas dependências no `frontend/node_modules`
- **`frontend/package.json`**: dependência Zustand adicionada
- **`frontend/package-lock.json`**: lock file gerado/atualizado (7037 linhas)
- **`frontend/vite.config.ts`**: ajuste de configuração

---

## [second commit] — commit `32fab2ec`

### Backend — Módulos implementados (Sessão 2)

#### Novos módulos backend
| Módulo | Arquivos criados |
|--------|-----------------|
| **Measurements** | `measurements.service.ts`, `measurements.controller.ts`, `measurements.module.ts` — findByUnit, create (auto-calc % por METRIC/COUNT/PERCENT), update, batchCreate, getSummary, getBuildingData |
| **Weekly Planning** | `weekly-planning.service.ts`, `weekly-planning.controller.ts`, `weekly-planning.module.ts` + 5 DTOs — CRUD planos, tarefas, restrições, getPPCHistory, generateFromSchedule |
| **Dashboard** | `dashboard.service.ts`, `dashboard.controller.ts`, `dashboard.module.ts` — getKPIs (SPI ponderado), getDelays, getPendingRestrictions, getSPIHistory mensal |
| **Uploads** | `uploads.service.ts` (MinIO integration, presigned URLs), `uploads.controller.ts`, `uploads.module.ts` |

#### Testes unitários (51 testes)
| Arquivo | Cobertura |
|---------|-----------|
| `auth/auth.service.spec.ts` | register, login, getMe |
| `measurements/measurements.service.spec.ts` | findByUnit, create (PERCENT/METRIC/fallback/cap), update, batchCreate |
| `schedule/schedule.service.spec.ts` | CRUD, getGanttData, getCurvaS |
| `dashboard/dashboard.service.spec.ts` | getKPIs, getDelays, getPendingRestrictions, getSPIHistory |

### Frontend — Páginas novas
| Página | Descrição |
|--------|-----------|
| `Cronograma.tsx` | Gantt side-by-side, 5 níveis, expand/collapse, busca debounced, linha "hoje", export CSV |
| `Medicao.tsx` | SVG fachada, grid de unidades, painel de atividades com toggle % / métrica |
| `ProgramacaoSemanal.tsx` | Tabela PPC real-time, tarefas, restrições, navegação entre semanas |
| `Configuracoes.tsx` | Conta, projeto, critério de avanço, tabela editável de atividades, notificações |

### Outros
- **`Login.tsx`**: tabs "Entrar" / "Criar conta" com formulário completo de registro
- **`docker-compose.yml`**: ajuste de configuração
- **`backend/package-lock.json`**: lock file completo gerado (11099 linhas, todas as dependências NestJS + Prisma + Bull + MinIO)

---

## [first commit] — commit `ce2fde16`

### Scaffolding inicial do projeto

#### Infraestrutura
- `docker-compose.yml` — PostgreSQL, Redis, MinIO, backend, frontend, nginx
- `nginx/nginx.conf` — reverse proxy configurado
- `.env.example` — todas as variáveis de ambiente

#### Backend (NestJS + Prisma)
- `main.ts` — bootstrap com Swagger, CORS, helmet, throttler, validation pipe
- `app.module.ts` — imports completos
- `config/configuration.ts`
- `common/` — PrismaService, HttpExceptionFilter, TransformInterceptor, ValidationPipe, decorators (current-user, roles, public)
- **Auth module** — register, login, JWT, guards
- **Users module** — CRUD, change-password
- **Projects module** — CRUD + membros
- **Towers module** — torres, pavimentos, unidades
- **Activity Types module** — CRUD configurável
- **Schedule module** — EAP/cronograma, Gantt, Curva S
- `prisma/schema.prisma` — schema completo
- `prisma/seed.ts` — seed realista (Residencial Vista Verde, 2 torres, 7 andares, 4 unidades/andar, 385 medições, 3 planos semanais)

#### Frontend (Vite + React 18 + TypeScript + Tailwind)
- React Router v6 com rotas definidas
- Zustand store (auth, project, UI state)
- `services/api.ts` — todos os endpoints mapeados
- `types/index.ts` — tipos TypeScript completos
- Hooks: `useAuth.ts`, `useProject.ts`, `useMeasurement.ts`, `useWebSocket.ts`
- `utils/calculations.ts` — `calcPPC`, `formatDate`, cálculos de avanço

---

## Credenciais de demo

| Perfil | E-mail | Senha |
|--------|--------|-------|
| Admin | `carlos@horizonte.com.br` | `admin123` |
| Viewer | `viewer@horizonte.com.br` | `viewer123` |

## Como rodar localmente (sem Docker)

```bash
# Banco (PostgreSQL deve estar rodando)
psql avanco_obras -c "GRANT ALL ON SCHEMA public TO avanco;"
cd backend && npx prisma db push && npx prisma db seed

# Backend
cd backend && npm install && npm run start:dev

# Frontend (outro terminal)
cd frontend && npm install && npm run dev
```

Acesse: http://localhost:5173
