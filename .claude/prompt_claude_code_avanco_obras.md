# PROMPT — AvançoObras Pro (versão atualizada com decisões reais de implementação)

> Este arquivo descreve o sistema como foi **efetivamente implementado**.
> Divergências em relação ao spec original estão marcadas com ⚠️.
> Referência visual: `avanco_obras_v2.html` na raiz do projeto.

---

## CONTEXTO

Sistema web completo chamado **AvançoObras Pro** — plataforma de controle de avanço físico para obras da construção civil. Permite que engenheiros, mestres de obra e gestores acompanhem o progresso de empreendimentos em tempo real, registrem medições de campo, acompanhem cronogramas e gerenciem programações semanais.

---

## STACK TECNOLÓGICO (conforme implementado)

```
Frontend:    React 18 + TypeScript, Vite, Tailwind CSS 3, Recharts, React Router v6
             ⚠️ shadcn/ui usado apenas em Login.tsx (Input, Button, Label)
             ⚠️ Demais páginas usam classes CSS globais ao-* (ver Design System)
Backend:     Node.js 20 + NestJS (TypeScript), class-validator, class-transformer, Passport.js (JWT)
Banco:       PostgreSQL 16 + Prisma ORM
             ⚠️ Usa prisma db push (não migrate deploy) — sem migration files
Cache:       Redis 7 (configurado no docker-compose, não utilizado ativamente no código)
Storage:     MinIO (S3-compatible) — integrado no UploadsModule, erro não-fatal se indisponível
Infra:       Docker Compose (prisma db push + seed no startup do backend)
Testes:      Jest com ts-jest — 51 testes unitários passando (backend apenas)
Docs:        Swagger em /api/docs (NestJS auto-gerado)
```

---

## DESIGN SYSTEM (implementado em `frontend/src/index.css`)

### Paleta de cores (variáveis CSS globais)
```css
/* Light mode */
--bg:#f4f3ef;   /* app background */
--bg1:#fff;     /* card / surface */
--bg2:#f0efe9;  /* muted / secondary */
--bg3:#e6e5df;  /* progress track, gantt header */
--bg4:#dddcd6;  /* building side face */
--t1:#1a1a18;   /* foreground text */
--t2:#6b6b67;   /* muted text */
--t3:#9a9a96;   /* very muted text */
--bd:rgba(0,0,0,.10);   /* border */
--bd2:rgba(0,0,0,.18);  /* border strong */
--amber:#BA7517; --amb-bg:#FAEEDA; --amb-t:#633806;
--green:#3B6D11; --grn-bg:#EAF3DE; --grn-t:#173404;
--red:#A32D2D;   --red-bg:#FCEBEB; --red-t:#501313;
--blue:#185FA5;  --blu-bg:#E6F1FB; --blu-t:#042C53;
--r-md:8px; --r-lg:12px;
--font:'Segoe UI',system-ui,sans-serif; --mono:'Consolas',monospace;

/* Dark mode: aplicado em .dark {} E @media(prefers-color-scheme:dark) */
```

### Shadcn HSL variables remapeadas (Tailwind)
- `--primary` → amber (#BA7517)
- `--background` → beige (#f4f3ef)
- `--foreground` → dark (#1a1a18)
- `--muted` → #f0efe9
- `--destructive` → red (#A32D2D)

### Classes utilitárias globais `ao-*`
```
ao-app          → max-width:1140px, centered, padding
ao-card         → bg1, 0.5px border bd, border-radius r-lg, padding 1rem
ao-card-hdr     → flex space-between, margin-bottom .875rem
ao-card-title   → font-size 13px, font-weight 500
ao-badge        → inline-flex, padding 2px 8px, border-radius 20px, font-size 10px
ao-bg/ba/br/bb/bk → badge color variants (green/amber/red/blue/gray)
ao-pbar/pfill   → 6px progress bar
ao-fg           → form field (label + input column)
ao-table        → compact table (11px, sticky header, hover)
ao-btn/ao-btn-sm/ao-btn-primary/ao-btn-ok → button variants
ao-kpi          → KPI card with label/value/sub
ao-g2/ao-g3     → 2/3 column grid, responsive collapse at 700px
ao-sec-title    → settings section title
```

---

## LAYOUT DA APLICAÇÃO (`AppLayout.tsx`)

```
┌─────────────────────────────────────────────────────────┐
│ AvançoObras Pro    [Projeto ▼]    Atualização: dd/MM     │
│                                  Prazo: dd/MM/yyyy  [👤] │
├─────────────────────────────────────────────────────────┤
│ [Cadastro] [Dashboard] [Cronograma] [Medição] [Semanal] [Config] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│              <page content — ao-app container>          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

- **Sem sidebar** — nav horizontal compacta (pill, 12px radius, amber no ativo)
- Header não é sticky, faz parte do fluxo normal
- Container: `max-width:1140px; margin:0 auto`
- Projeto selecionado: dropdown inline no header (não nav)

---

## BANCO DE DADOS (`prisma/schema.prisma`)

### Enums
```prisma
UserRole        { ADMIN, ENGINEER, FOREMAN, VIEWER }
ProjectStatus   { PLANNING, IN_PROGRESS, ON_HOLD, COMPLETED }
MeasurementMethod { PERCENT, METRIC, COUNT }
TaskStatus      { COMPLETED, NOT_COMPLETED, PARTIALLY }
RestrictionStatus { PENDING, IN_ANALYSIS, RELEASED, EXPIRED }
```

### Models
```
User → ProjectMember → Project
Project → Tower → Floor → Unit → Measurement
Project → ActivityType → Measurement
Project → ScheduleItem (hierárquico, self-relation) → ScheduleDependency
Project → WeeklyPlan → WeeklyTask / Restriction
Project → Upload
```

---

## BACKEND — ENDPOINTS DA API

> Todos os endpoints retornam `{ statusCode, data }` via TransformInterceptor.
> Autenticação: `Bearer JWT` em todos exceto POST /auth/login e /auth/register.

### Auth
```
POST  /api/auth/register    → { user, accessToken }
POST  /api/auth/login       → { user, accessToken }
GET   /api/auth/me          → User
```

### Users
```
GET   /api/users            → User[]
PATCH /api/users/:id        → User
PATCH /api/users/:id/password
```

### Projects
```
GET    /api/projects           → Project[]
POST   /api/projects           → Project
GET    /api/projects/:id       → Project
PATCH  /api/projects/:id       → Project
DELETE /api/projects/:id
POST   /api/projects/:id/members → ProjectMember
```

### Estrutura física
```
GET  /api/projects/:id/towers
POST /api/projects/:id/towers
GET  /api/projects/:id/towers/:towerId/floors
POST /api/projects/:id/towers/:towerId/floors
GET  /api/floors/:floorId/units
POST /api/floors/:floorId/units
```

### Activity Types
```
GET    /api/projects/:id/activity-types
POST   /api/projects/:id/activity-types
PATCH  /api/activity-types/:id
DELETE /api/activity-types/:id
```

### Schedule (EAP)
```
GET  /api/projects/:id/schedule
POST /api/projects/:id/schedule
PATCH /api/schedule/:id
DELETE /api/schedule/:id
GET  /api/projects/:id/schedule/gantt-data    → GanttRow[]
GET  /api/projects/:id/schedule/curva-s       → CurvaSPoint[]
```

### Measurements
```
GET  /api/units/:unitId/measurements
POST /api/units/:unitId/measurements          ← @CurrentUser('id') como measuredById
PATCH /api/measurements/:id
POST /api/units/:unitId/measurements/batch
GET  /api/projects/:id/measurements/summary
GET  /api/projects/:id/measurements/building-data
```

#### Regra de cálculo automático
```typescript
// Se method = METRIC ou COUNT:
percentComplete = Math.min(100, (executedQty / (totalQty ?? activityType.defaultQuantity)) * 100)
// Se method = PERCENT: usa dto.percentComplete diretamente
```

### Weekly Planning
```
GET  /api/projects/:id/weekly-plans
POST /api/projects/:id/weekly-plans
GET  /api/weekly-plans/:id                    → { plan, tasks, restrictions }
POST /api/weekly-plans/:id/tasks
PATCH /api/weekly-tasks/:id
POST /api/weekly-plans/:id/restrictions
PATCH /api/restrictions/:id                   → auto-set resolvedAt quando RELEASED
GET  /api/projects/:id/weekly-plans/ppc-history
POST /api/weekly-plans/:id/generate           → cria tasks a partir do schedule
```

### Dashboard
```
GET /api/projects/:id/dashboard               → KPIs consolidados
GET /api/projects/:id/dashboard/delays        → top 10 atividades em atraso
GET /api/projects/:id/dashboard/restrictions  → PENDING + IN_ANALYSIS
GET /api/projects/:id/dashboard/spi           → histórico mensal SPI
```

### Uploads
```
POST   /api/projects/:id/uploads   ← multipart/form-data, campo "file", query "category"
GET    /api/projects/:id/uploads
DELETE /api/uploads/:id
```

---

## REGRAS DE NEGÓCIO

### Avanço físico (ponderado)
```typescript
// Usa apenas leaf items (sem filhos) com o campo weight
overallProgress = Σ(actualProgress × weight) / Σ(weight)
plannedProgress = Σ(plannedProgress × weight) / Σ(weight)
SPI = overallProgress / plannedProgress  // default 1 se plannedProgress=0
```

### PPC (Percentual de Planos Concluídos)
```typescript
PPC = (COMPLETED×1 + PARTIALLY×0.5) / total_tasks × 100
// Recalcular ao vivo no frontend a cada mudança de checkbox
```

### Curva S
```typescript
// Gerar pontos mensais de project.startDate até hoje
// Acumular peso ponderado das atividades que terminam em cada mês
// { label: 'Jan/25', date, planned, actual }
```

---

## FRONTEND — ESPECIFICAÇÃO DAS PÁGINAS

> Referência visual: `avanco_obras_v2.html`. O app deve ser visualmente idêntico.
> Todas as páginas usam classes `ao-*` e `var(--token)` em inline styles.
> Shadcn/ui components apenas no Login.tsx.

### Login (`Login.tsx`)
- 2 painéis: esquerda (hero SVG de prédios) + direita (formulário)
- **Tabs**: "Entrar" e "Criar conta" (toggle mode)
- Login: email + password, fill demo button
- Registro: fullName, username, email, phone (opt), CREA (opt), password, confirm
- Credenciais demo: `carlos@horizonte.com.br` / `admin123`

### Cadastro (`Cadastro.tsx`)
- Card "Dados do empreendimento": grid 2-col, campos do Project model
- Cards "Plantas PDF" + "Modelo 3D" em `ao-g2`
- Upload PDF: dashed border, botão "Processar com IA" (placeholder)
- Upload 3D: arquivo ou URL Sketchfab (iframe embed com `window.prompt`)

### Dashboard (`Dashboard.tsx`)
- **Row 1** (ao-g3): KPI rings SVG inline (circumference=201.1, offset=201.1*(1-v/100))
  - Avanço Físico (amber), SPI (verde/âmbar/vermelho por threshold), PPC semana + mini-hist
- **Row 2** (ao-g2): Curva S (Recharts LineChart, azul #378ADD + amber) | Etapas bars (real + planejado)
- **Row 3** (ao-g3): PPC hist (BarChart, verde≥80/âmbar≥70/vermelho<70) | Delays list | Restrições
- Fallback com mock data se API retornar vazio

### Cronograma (`Cronograma.tsx`)
- `ao-card` com toolbar: busca input + Expandir/Recolher/CSV (`ao-btn ao-btn-sm`)
- Legenda de cores (linha de hoje, planejado, no prazo, leve atraso, crítico)
- Gantt: `display:flex; height:520px; border-radius:12px; overflow:hidden`
- Lista esq (260px): rows 28px, levels lv0=bg3/bold, lv1=bg2/medium, lv2-4 progressive indent
- Barras dir: plan bar rgba(55,138,221,.2), actual bar verde/âmbar/vermelho, today line #E24B4A
- Expand/collapse por ▶/▼, busca debounced 250ms filtra + mostra ancestrais

### Medição (`Medicao.tsx`)
- Layout flex: building SVG (230px) | units grid + activities panel
- **SVG isométrico 3D** (`viewBox="0 0 220 340"`):
  - Sombra elipse, face lateral polygon, telhado polygon, fachada principal
  - 7 andares clicáveis (42px cada, térreo 54px), janelas coloridas por progresso
  - Selecionado: `stroke:var(--amber); stroke-width:2.5` no rect do andar
- Unit grid: `repeat(auto-fill,minmax(78px,1fr))`, estados ni/ea/co/sel
- Activity panel: toggle % Manual / Métrica (amber = ativo), badge estado, ✓ button

### Programação Semanal (`ProgramacaoSemanal.tsx`)
- Header: semana + PPC ao vivo + meta 80%
- Tabela `ao-table`: Atividade | Local | Responsável | **Cumprida? (checkbox)** | Causa | Status
- PPC recalcula a cada `onChange` do checkbox (optimistic update)
- Tabela de restrições separada com badges PENDING/IN_ANALYSIS/RELEASED/EXPIRED

### Configurações (`Configuracoes.tsx`)
- Layout `ao-g2` (2 colunas)
- **Esq col**: Card Conta (avatar circular amb-bg + initials, ao-fg fields) + Card Notificações (checkboxes nativos)
- **Dir col**: Card Critério (radio buttons COST/QUANTITY/HYBRID + fórmula) + Card Métodos (ao-table inline editável) + Card Projeto (ao-fg fields)

---

## SEED DE DADOS (`prisma/seed.ts`)

```
Projeto: Residencial Vista Verde (IN_PROGRESS)
Torres:  2 (A e B)
Andares: 7 por torre (Térreo + 1°–6°)
Unidades: 4 por andar (Apt X01–X04)
Activity Types: 8 (Alvenaria, Reboco, Inst. Hidráulica, Inst. Elétrica, Rev. Piso, Rev. Parede, Pintura, Esquadrias)
Schedule: ~58 items hierárquicos (EAP completa)
Medições: 385 (andares inferiores mais completos)
Weekly Plans: 3 (S16, S17, S18) com tarefas e PPC
Restrições: 3 exemplos
Users: admin (carlos@horizonte.com.br / admin123) + viewer (viewer@horizonte.com.br / viewer123)
```

---

## DOCKER COMPOSE

```yaml
services:
  postgres: image postgres:16-alpine, healthcheck pg_isready
  redis:    image redis:7-alpine
  minio:    image minio/minio, console :9001
  backend:  target development, command: "npx prisma db push && npx prisma db seed && npm run start:dev"
  frontend: target development, VITE_API_URL: http://localhost:3001/api
  nginx:    reverse proxy /api → backend:3001, / → frontend:5173
```

⚠️ **`prisma db push`** (não `migrate deploy`) — sem migration files necessários.
⚠️ `VITE_API_TARGET` controla o proxy no vite.config.ts (default: localhost:3001).

---

## COMO RODAR (local sem Docker)

```bash
# 1. Banco PostgreSQL deve estar rodando e o banco criado
psql avanco_obras -c "GRANT ALL ON SCHEMA public TO avanco;"

# 2. Backend
cp .env.example backend/.env   # .env precisa estar em backend/ (não na raiz)
cd backend
npm install
npx prisma db push
npx prisma db seed
npm run start:dev              # porta 3001

# 3. Frontend (outro terminal)
cd frontend
npm install
npm run dev                    # porta 5173
```

---

## TESTES (backend — 51 testes)

```bash
cd backend && npm test
```

Arquivos:
- `src/auth/auth.service.spec.ts` — 9 testes
- `src/measurements/measurements.service.spec.ts` — 15 testes
- `src/schedule/schedule.service.spec.ts` — 16 testes
- `src/dashboard/dashboard.service.spec.ts` — 11 testes

---

## PROBLEMAS CONHECIDOS / NOTAS

| Problema | Status | Solução |
|----------|--------|---------|
| MinIO indisponível localmente | Tolerado | `ensureBucket` captura erro sem crash; uploads desabilitados |
| Redis não utilizado no código | Pendente | Configurado no docker-compose mas sem cache ativo nas rotas |
| Migrations Prisma | Não implementadas | `prisma db push` suficiente para dev; produção precisaria de `migrate dev` |
| Testes frontend | Não implementados | Vitest configurado no package.json mas sem arquivos de teste |
| CI/CD | Configurado mas não testado | `.github/workflows/ci.yml` existe mas pode falhar sem ajustes |
