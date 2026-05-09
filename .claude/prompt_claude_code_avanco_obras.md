# PROMPT PARA CLAUDE CODE — Sistema de Controle de Avanço Físico de Obras

> Cole este prompt inteiro como instrução inicial no Claude Code.
> Ele irá gerar o projeto completo com backend, frontend, banco de dados e Docker.

---

## CONTEXTO

Você é um engenheiro de software sênior e deve construir do zero um sistema web completo chamado **AvançoObras Pro** — uma plataforma de controle de avanço físico para obras da construção civil. O sistema permite que engenheiros, mestres de obra e gestores acompanhem o progresso de empreendimentos em tempo real, registrem medições de campo, acompanhem cronogramas e gerenciem programações semanais.

---

## STACK TECNOLÓGICO OBRIGATÓRIO

```
Frontend:    React 18+ com TypeScript, Vite, Tailwind CSS 3, shadcn/ui, Recharts, React Router v6
Backend:     Node.js 20+ com NestJS (TypeScript), class-validator, class-transformer, Passport.js (JWT)
Banco:       PostgreSQL 16 com Prisma ORM (migrations, seeds)
Cache/Fila:  Redis 7 (cache de sessão, bull queue para relatórios)
Storage:     MinIO (S3-compatible para uploads de plantas/modelos 3D)
Infra:       Docker Compose com multi-stage builds, nginx como reverse proxy
Testes:      Jest (backend), Vitest + Testing Library (frontend)
CI:          GitHub Actions (lint, test, build)
Docs:        Swagger/OpenAPI auto-gerado pelo NestJS
```

---

## ESTRUTURA DE PASTAS DO PROJETO

```
avanco-obras/
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
├── .github/
│   └── workflows/
│       └── ci.yml
├── nginx/
│   └── nginx.conf
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── nest-cli.json
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── config/
│   │   │   └── configuration.ts
│   │   ├── auth/
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── jwt.strategy.ts
│   │   │   ├── guards/
│   │   │   │   ├── jwt-auth.guard.ts
│   │   │   │   └── roles.guard.ts
│   │   │   └── dto/
│   │   │       ├── login.dto.ts
│   │   │       └── register.dto.ts
│   │   ├── users/
│   │   │   ├── users.module.ts
│   │   │   ├── users.controller.ts
│   │   │   ├── users.service.ts
│   │   │   └── dto/
│   │   ├── projects/
│   │   │   ├── projects.module.ts
│   │   │   ├── projects.controller.ts
│   │   │   ├── projects.service.ts
│   │   │   └── dto/
│   │   ├── schedule/
│   │   │   ├── schedule.module.ts
│   │   │   ├── schedule.controller.ts
│   │   │   ├── schedule.service.ts
│   │   │   └── dto/
│   │   ├── measurements/
│   │   │   ├── measurements.module.ts
│   │   │   ├── measurements.controller.ts
│   │   │   ├── measurements.service.ts
│   │   │   └── dto/
│   │   ├── weekly-planning/
│   │   │   ├── weekly-planning.module.ts
│   │   │   ├── weekly-planning.controller.ts
│   │   │   ├── weekly-planning.service.ts
│   │   │   └── dto/
│   │   ├── dashboard/
│   │   │   ├── dashboard.module.ts
│   │   │   ├── dashboard.controller.ts
│   │   │   └── dashboard.service.ts
│   │   ├── uploads/
│   │   │   ├── uploads.module.ts
│   │   │   ├── uploads.controller.ts
│   │   │   └── uploads.service.ts
│   │   └── common/
│   │       ├── decorators/
│   │       ├── filters/
│   │       ├── interceptors/
│   │       └── pipes/
│   └── test/
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── index.html
│   ├── public/
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── routes/
│       │   └── index.tsx
│       ├── layouts/
│       │   └── AppLayout.tsx
│       ├── pages/
│       │   ├── Login.tsx
│       │   ├── Cadastro.tsx
│       │   ├── Dashboard.tsx
│       │   ├── Cronograma.tsx
│       │   ├── Medicao.tsx
│       │   ├── ProgramacaoSemanal.tsx
│       │   └── Configuracoes.tsx
│       ├── components/
│       │   ├── ui/              (shadcn/ui)
│       │   ├── CurvaS.tsx
│       │   ├── GanttChart.tsx
│       │   ├── BuildingModel.tsx
│       │   ├── UnitGrid.tsx
│       │   ├── ActivityMetrics.tsx
│       │   ├── PPCChart.tsx
│       │   ├── ProgressRing.tsx
│       │   ├── DelayAnalysis.tsx
│       │   └── RestrictionPanel.tsx
│       ├── hooks/
│       │   ├── useAuth.ts
│       │   ├── useProject.ts
│       │   ├── useMeasurement.ts
│       │   └── useWebSocket.ts
│       ├── services/
│       │   └── api.ts
│       ├── store/
│       │   └── index.ts          (Zustand)
│       ├── types/
│       │   └── index.ts
│       └── utils/
│           └── calculations.ts
└── docs/
    └── api.md
```

---

## MODELAGEM DO BANCO DE DADOS (Prisma Schema)

Implemente o seguinte schema no arquivo `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ═══════════════════ ENUMS ═══════════════════

enum UserRole {
  ADMIN
  ENGINEER
  FOREMAN       // Mestre de obras
  VIEWER
}

enum ProjectStatus {
  PLANNING
  IN_PROGRESS
  ON_HOLD
  COMPLETED
}

enum MeasurementMethod {
  PERCENT       // % manual
  METRIC        // quantidade executada / total
  COUNT         // unidades executadas / total
}

enum TaskStatus {
  COMPLETED
  NOT_COMPLETED
  PARTIALLY
}

enum RestrictionStatus {
  PENDING
  IN_ANALYSIS
  RELEASED
  EXPIRED
}

// ═══════════════════ USERS & AUTH ═══════════════════

model User {
  id           String    @id @default(uuid())
  email        String    @unique
  username     String    @unique
  passwordHash String    @map("password_hash")
  fullName     String    @map("full_name")
  role         UserRole  @default(VIEWER)
  phone        String?
  crea         String?   // Registro profissional
  avatarUrl    String?   @map("avatar_url")
  isActive     Boolean   @default(true) @map("is_active")
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")

  projectMembers ProjectMember[]
  measurements   Measurement[]
  weeklyTasks    WeeklyTask[]

  @@map("users")
}

// ═══════════════════ PROJETOS ═══════════════════

model Project {
  id               String        @id @default(uuid())
  name             String        // "Residencial Vista Verde"
  company          String        // "Construtora Horizonte S.A."
  address          String
  status           ProjectStatus @default(PLANNING)
  startDate        DateTime      @map("start_date")
  endDate          DateTime      @map("end_date")
  estimatedCost    Decimal?      @map("estimated_cost") @db.Decimal(15, 2)
  currency         String        @default("BRL")
  totalArea        Decimal?      @map("total_area") @db.Decimal(12, 2)
  workdaysPerWeek  Int           @default(5) @map("workdays_per_week")
  hoursPerDay      Int           @default(8) @map("hours_per_day")
  timezone         String        @default("America/Sao_Paulo")
  createdAt        DateTime      @default(now()) @map("created_at")
  updatedAt        DateTime      @updatedAt @map("updated_at")

  // Critério de avanço
  progressCriteria String       @default("COST") @map("progress_criteria") // COST | QUANTITY | HYBRID

  members          ProjectMember[]
  towers           Tower[]
  scheduleItems    ScheduleItem[]
  weeklyPlans      WeeklyPlan[]
  uploads          Upload[]
  activityTypes    ActivityType[]

  @@map("projects")
}

model ProjectMember {
  id        String   @id @default(uuid())
  projectId String   @map("project_id")
  userId    String   @map("user_id")
  role      UserRole @default(VIEWER)
  addedAt   DateTime @default(now()) @map("added_at")

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([projectId, userId])
  @@map("project_members")
}

// ═══════════════════ ESTRUTURA FÍSICA ═══════════════════

model Tower {
  id        String @id @default(uuid())
  projectId String @map("project_id")
  name      String // "Torre A", "Bloco 1"
  order     Int    @default(0)

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  floors  Floor[]

  @@map("towers")
}

model Floor {
  id      String @id @default(uuid())
  towerId String @map("tower_id")
  name    String // "Térreo", "1° Pav.", "Cobertura"
  level   Int    // Número do andar (0 = térreo)
  order   Int    @default(0)

  tower Tower  @relation(fields: [towerId], references: [id], onDelete: Cascade)
  units Unit[]

  @@map("floors")
}

model Unit {
  id       String  @id @default(uuid())
  floorId  String  @map("floor_id")
  name     String  // "Apt 101", "Comercial 01", "Hall"
  area     Decimal? @db.Decimal(10, 2)  // m²
  order    Int     @default(0)

  floor        Floor         @relation(fields: [floorId], references: [id], onDelete: Cascade)
  measurements Measurement[]

  @@map("units")
}

// ═══════════════════ TIPOS DE ATIVIDADE (configurável) ═══════════════════

model ActivityType {
  id               String            @id @default(uuid())
  projectId        String            @map("project_id")
  name             String            // "Alvenaria", "Reboco", "Inst. Hidráulica"
  measurementMethod MeasurementMethod @default(PERCENT) @map("measurement_method")
  unit             String            @default("%")  // "m²", "m³", "un", "m", "%"
  defaultQuantity  Decimal           @default(0) @map("default_quantity") @db.Decimal(12, 2)
  weight           Decimal           @default(1) @db.Decimal(8, 4) // Peso para cálculo de avanço
  order            Int               @default(0)

  project      Project       @relation(fields: [projectId], references: [id], onDelete: Cascade)
  measurements Measurement[]
  scheduleItems ScheduleItem[]

  @@unique([projectId, name])
  @@map("activity_types")
}

// ═══════════════════ CRONOGRAMA (EAP) ═══════════════════

model ScheduleItem {
  id              String    @id @default(uuid())
  projectId       String    @map("project_id")
  parentId        String?   @map("parent_id")
  activityTypeId  String?   @map("activity_type_id")
  code            String    // "1", "1.1", "1.1.1" — código EAP
  name            String    // "Fundação", "Estacas"
  level           Int       @default(0)
  startDate       DateTime  @map("start_date")
  endDate         DateTime  @map("end_date")
  durationDays    Int       @map("duration_days")
  plannedProgress Decimal   @default(0) @map("planned_progress") @db.Decimal(5, 2) // 0–100
  actualProgress  Decimal   @default(0) @map("actual_progress") @db.Decimal(5, 2)  // 0–100
  weight          Decimal   @default(1) @db.Decimal(8, 4)
  isCriticalPath  Boolean   @default(false) @map("is_critical_path")
  order           Int       @default(0)
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  project      Project       @relation(fields: [projectId], references: [id], onDelete: Cascade)
  parent       ScheduleItem? @relation("ScheduleHierarchy", fields: [parentId], references: [id])
  children     ScheduleItem[] @relation("ScheduleHierarchy")
  activityType ActivityType? @relation(fields: [activityTypeId], references: [id])

  // Dependências (predecessor/successor)
  predecessors ScheduleDependency[] @relation("SuccessorDep")
  successors   ScheduleDependency[] @relation("PredecessorDep")

  @@index([projectId, code])
  @@index([projectId, parentId])
  @@map("schedule_items")
}

model ScheduleDependency {
  id            String @id @default(uuid())
  predecessorId String @map("predecessor_id")
  successorId   String @map("successor_id")
  lagDays       Int    @default(0) @map("lag_days")
  type          String @default("FS") // FS, FF, SS, SF

  predecessor ScheduleItem @relation("PredecessorDep", fields: [predecessorId], references: [id], onDelete: Cascade)
  successor   ScheduleItem @relation("SuccessorDep", fields: [successorId], references: [id], onDelete: Cascade)

  @@unique([predecessorId, successorId])
  @@map("schedule_dependencies")
}

// ═══════════════════ MEDIÇÕES DE CAMPO ═══════════════════

model Measurement {
  id              String   @id @default(uuid())
  unitId          String   @map("unit_id")
  activityTypeId  String   @map("activity_type_id")
  measuredById    String   @map("measured_by_id")
  date            DateTime @default(now())

  // Medição por % ou por métrica
  percentComplete Decimal  @default(0) @map("percent_complete") @db.Decimal(5, 2) // Resultado final: 0–100

  // Se método = METRIC ou COUNT
  executedQty     Decimal? @map("executed_qty") @db.Decimal(12, 2)
  totalQty        Decimal? @map("total_qty") @db.Decimal(12, 2)

  notes           String?
  photoUrl        String?  @map("photo_url")
  createdAt       DateTime @default(now()) @map("created_at")

  unit         Unit         @relation(fields: [unitId], references: [id], onDelete: Cascade)
  activityType ActivityType @relation(fields: [activityTypeId], references: [id])
  measuredBy   User         @relation(fields: [measuredById], references: [id])

  @@index([unitId, activityTypeId])
  @@index([date])
  @@map("measurements")
}

// ═══════════════════ PROGRAMAÇÃO SEMANAL / PPC ═══════════════════

model WeeklyPlan {
  id          String   @id @default(uuid())
  projectId   String   @map("project_id")
  weekNumber  Int      @map("week_number")
  year        Int
  startDate   DateTime @map("start_date")
  endDate     DateTime @map("end_date")
  ppcTarget   Decimal  @default(80) @map("ppc_target") @db.Decimal(5, 2)
  ppcActual   Decimal? @map("ppc_actual") @db.Decimal(5, 2) // Calculado após avaliação
  ppcForecast Decimal? @map("ppc_forecast") @db.Decimal(5, 2) // Previsão para próxima semana
  notes       String?
  createdAt   DateTime @default(now()) @map("created_at")

  project      Project        @relation(fields: [projectId], references: [id], onDelete: Cascade)
  tasks        WeeklyTask[]
  restrictions Restriction[]

  @@unique([projectId, year, weekNumber])
  @@map("weekly_plans")
}

model WeeklyTask {
  id            String     @id @default(uuid())
  weeklyPlanId  String     @map("weekly_plan_id")
  assignedToId  String?    @map("assigned_to_id")
  description   String
  location      String     // "Torre A / 4° pav. / Apto 401"
  status        TaskStatus @default(NOT_COMPLETED)
  nonCompletionCause String? @map("non_completion_cause")
  createdAt     DateTime   @default(now()) @map("created_at")

  weeklyPlan WeeklyPlan @relation(fields: [weeklyPlanId], references: [id], onDelete: Cascade)
  assignedTo User?      @relation(fields: [assignedToId], references: [id])

  @@map("weekly_tasks")
}

model Restriction {
  id           String            @id @default(uuid())
  weeklyPlanId String            @map("weekly_plan_id")
  description  String
  responsible  String
  dueDate      DateTime          @map("due_date")
  status       RestrictionStatus @default(PENDING)
  resolvedAt   DateTime?         @map("resolved_at")

  weeklyPlan WeeklyPlan @relation(fields: [weeklyPlanId], references: [id], onDelete: Cascade)

  @@map("restrictions")
}

// ═══════════════════ UPLOADS ═══════════════════

model Upload {
  id         String   @id @default(uuid())
  projectId  String   @map("project_id")
  fileName   String   @map("file_name")
  fileType   String   @map("file_type") // "pdf", "ifc", "obj", "png"
  category   String   // "floor_plan", "3d_model", "photo", "document"
  storageKey String   @map("storage_key") // Caminho no MinIO/S3
  fileSize   Int      @map("file_size")
  metadata   Json?    // Metadados extraídos (ex: nº pavimentos, unidades)
  createdAt  DateTime @default(now()) @map("created_at")

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@map("uploads")
}
```

---

## ENDPOINTS DA API (REST)

Implemente os seguintes endpoints no NestJS com Swagger decorators para documentação automática:

### Auth
```
POST   /api/auth/register          — Registro de usuário
POST   /api/auth/login             — Login (retorna JWT)
POST   /api/auth/refresh           — Refresh token
GET    /api/auth/me                — Dados do usuário logado
```

### Users
```
GET    /api/users                  — Listar usuários (admin)
PATCH  /api/users/:id              — Atualizar perfil
PATCH  /api/users/:id/password     — Alterar senha
```

### Projects
```
GET    /api/projects               — Listar projetos do usuário
POST   /api/projects               — Criar projeto
GET    /api/projects/:id           — Detalhes do projeto
PATCH  /api/projects/:id           — Atualizar projeto
DELETE /api/projects/:id           — Excluir projeto
POST   /api/projects/:id/members   — Adicionar membro
```

### Estrutura física (towers/floors/units)
```
GET    /api/projects/:id/towers                    — Listar torres
POST   /api/projects/:id/towers                    — Criar torre
GET    /api/projects/:id/towers/:towerId/floors     — Listar pavimentos
POST   /api/projects/:id/towers/:towerId/floors     — Criar pavimento
GET    /api/floors/:floorId/units                   — Listar unidades
POST   /api/floors/:floorId/units                   — Criar unidade
```

### Activity Types (configuração)
```
GET    /api/projects/:id/activity-types             — Listar tipos
POST   /api/projects/:id/activity-types             — Criar tipo
PATCH  /api/activity-types/:id                      — Editar tipo (método, unidade, qtd)
DELETE /api/activity-types/:id                      — Excluir tipo
```

### Schedule (EAP / Cronograma)
```
GET    /api/projects/:id/schedule                   — Listar toda EAP (hierárquica)
POST   /api/projects/:id/schedule                   — Criar item
PATCH  /api/schedule/:id                            — Atualizar item
DELETE /api/schedule/:id                            — Excluir item
POST   /api/projects/:id/schedule/import-csv        — Importar de CSV/MS Project
GET    /api/projects/:id/schedule/gantt-data         — Dados formatados para Gantt
GET    /api/projects/:id/schedule/curva-s            — Dados da Curva S (planejado × real)
```

### Measurements (Medição de campo)
```
GET    /api/units/:unitId/measurements               — Listar medições da unidade
POST   /api/units/:unitId/measurements               — Registrar medição
PATCH  /api/measurements/:id                         — Atualizar medição
POST   /api/units/:unitId/measurements/batch         — Medição em lote (todas atividades de 1 vez)
GET    /api/projects/:id/measurements/summary        — Resumo por pavimento/torre
GET    /api/projects/:id/measurements/building-data   — Dados para visualização 3D do prédio
```

### Weekly Planning (PPC)
```
GET    /api/projects/:id/weekly-plans                 — Listar semanas
POST   /api/projects/:id/weekly-plans                 — Criar plano semanal
GET    /api/weekly-plans/:id                          — Detalhes (tasks + restrictions)
POST   /api/weekly-plans/:id/tasks                    — Adicionar tarefa
PATCH  /api/weekly-tasks/:id                          — Atualizar status da tarefa
POST   /api/weekly-plans/:id/restrictions              — Adicionar restrição
PATCH  /api/restrictions/:id                          — Atualizar restrição
GET    /api/projects/:id/weekly-plans/ppc-history      — Histórico de PPC
POST   /api/weekly-plans/:id/generate                  — Gerar tarefas a partir do cronograma
```

### Dashboard
```
GET    /api/projects/:id/dashboard                    — KPIs consolidados
GET    /api/projects/:id/dashboard/delays             — Atividades em atraso
GET    /api/projects/:id/dashboard/restrictions        — Restrições pendentes
GET    /api/projects/:id/dashboard/spi                 — SPI histórico
```

### Uploads
```
POST   /api/projects/:id/uploads                      — Upload de arquivo (multipart)
GET    /api/projects/:id/uploads                       — Listar uploads
DELETE /api/uploads/:id                               — Excluir upload
```

---

## REGRAS DE NEGÓCIO CRÍTICAS

### 1. Cálculo de avanço físico
```typescript
// Fórmula ponderada:
// avanco_total = Σ(peso_atividade × % executado) / Σ(pesos)
//
// O peso pode vir do custo (R$) ou da quantidade, configurável por projeto.
// O cálculo se propaga bottom-up:
//   Unidade → Pavimento → Torre → Empreendimento
```

### 2. SPI (Schedule Performance Index)
```typescript
// SPI = avanço_real_acumulado / avanço_planejado_acumulado
// SPI > 1.0  → adiantado
// SPI = 1.0  → no prazo
// SPI < 1.0  → atrasado
```

### 3. PPC (Percentual de Planos Concluídos)
```typescript
// PPC = (tarefas_cumpridas / total_tarefas_semana) × 100
// Tarefas com status PARTIALLY contam como 0.5
// Se PPC < 70% por 3 semanas consecutivas → gerar alerta
```

### 4. Cálculo por métrica
```typescript
// Quando o método de medição é METRIC:
// percent_complete = (executed_qty / total_qty) × 100
//
// Exemplo: Alvenaria com 100m² total, 50m² executados → 50%
// O total_qty vem do default do ActivityType mas pode ser override por unidade
```

### 5. Curva S
```typescript
// Gerar dois arrays: planejado[] e realizado[]
// Cada ponto = avanço acumulado no final do período (semanal ou mensal)
// Planejado: soma ponderada dos pesos das atividades no período
// Realizado: soma ponderada das medições efetivas
```

---

## DOCKER COMPOSE

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: avanco_obras
      POSTGRES_USER: avanco
      POSTGRES_PASSWORD: ${DB_PASSWORD:-avanco_secret}
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U avanco"]
      interval: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: ${MINIO_PASSWORD:-minioadmin}
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - miniodata:/data

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
      target: development
    environment:
      DATABASE_URL: postgresql://avanco:${DB_PASSWORD:-avanco_secret}@postgres:5432/avanco_obras
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET:-super-secret-key-change-in-prod}
      MINIO_ENDPOINT: minio
      MINIO_PORT: 9000
      MINIO_ACCESS_KEY: minioadmin
      MINIO_SECRET_KEY: ${MINIO_PASSWORD:-minioadmin}
      NODE_ENV: development
    ports:
      - "3001:3001"
    volumes:
      - ./backend:/app
      - /app/node_modules
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    command: >
      sh -c "npx prisma migrate deploy && npx prisma db seed && npm run start:dev"

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      target: development
    ports:
      - "5173:5173"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    environment:
      VITE_API_URL: http://localhost:3001/api
    depends_on:
      - backend

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf
    depends_on:
      - frontend
      - backend

volumes:
  pgdata:
  redisdata:
  miniodata:
```

---

## FRONTEND — ESPECIFICAÇÃO DAS PÁGINAS

### Ordem das abas na navegação:
**Cadastro → Dashboard → Cronograma → Medição → Prog. Semanal → Configurações**

### 1. Cadastro (`Cadastro.tsx`)
- Formulário completo do empreendimento (campos do model Project)
- Seção de upload de plantas PDF (drag-and-drop com preview)
- Seção de upload/vinculação de modelo 3D (arquivo IFC/OBJ ou URL Sketchfab via iframe embed)
- Botão "Processar com IA" para extrair dados das plantas (placeholder de integração futura)
- **NÃO** incluir critério de avanço aqui — fica nas Configurações

### 2. Dashboard (`Dashboard.tsx`)
- **3 KPIs visuais com anéis SVG**: Avanço Físico (%), SPI, PPC da semana atual
- PPC mostra semana atual + previsão da próxima semana
- **Curva S** (Recharts LineChart) com rótulos de dados nos pontos-chave (a cada 2 meses)
- **Avanço por etapa** — barras horizontais comparando planejado × realizado
- **Atividades em atraso** — se SPI < 1, lista as top 5 atividades que mais contribuem para o atraso, com barra de criticidade e dias de desvio
- **Restrições pendentes** — cards com descrição, responsável, prazo e badge de status
- **PPC histórico** — gráfico de barras das últimas 8 semanas com codificação de cor (verde ≥80%, âmbar ≥70%, vermelho <70%)

### 3. Cronograma (`Cronograma.tsx`)
- Layout **side-by-side**: lista de atividades (esquerda, ~280px) + barras Gantt (direita, scrollável horizontal)
- **Scroll vertical sincronizado** entre as duas colunas
- **Hierarquia visual com cores** distintas por nível:
  - Nível 0 (Obra Civil): fundo escuro, texto bold grande
  - Nível 1 (Fundação, Estrutura): fundo médio, bold
  - Nível 2 (Pavimento): fundo claro
  - Nível 3 (Unidade): texto secondary
  - Nível 4 (Atividade): texto terciário
- **Expand/Collapse** por grupo (clique no chevron do pai)
- Barra de busca para filtrar atividades pelo nome
- Botões: Expandir tudo, Recolher tudo, Exportar CSV
- Mostrar **projeto completo**: torres → pavimentos → unidades → atividades (~500+ linhas)
- Barras Gantt com camadas sobrepostas: planejado (azul transparente) e realizado (verde/âmbar/vermelho)
- Linha vermelha tracejada indicando "hoje"
- Labels de % ao lado das barras

### 4. Medição (`Medicao.tsx`)
- **Painel esquerdo** — modelo visual do prédio:
  - SVG isométrico/fachada do prédio com pavimentos clicáveis
  - Cada pavimento é uma faixa horizontal com "janelas" representando unidades
  - Cores das janelas mudam pelo avanço: cinza (0%), laranja (parcial), verde (100%)
  - Clique num pavimento → seleciona e abre as unidades
  - Abaixo do SVG: seletores dropdown de Torre e Pavimento (navegação alternativa)
- **Painel central** — grid de unidades:
  - Cards coloridos por status (não iniciado / em andamento / concluído)
  - Mostra nome da unidade + % + mini progress bar
  - Clique na unidade → abre painel de atividades
- **Painel direito** — atividades da unidade:
  - Cada atividade mostra: nome, tipo de método, input de medição, %, badge de status, botão ✓
  - **Toggle por atividade**: [% Manual] ou [Métrica]
    - % Manual: input direto 0–100
    - Métrica: "XX / YY [unidade]" → calcula % automaticamente (ex: 50/100 m² = 50%)
  - O total da métrica vem da configuração do tipo de atividade, mas pode ser override por unidade
  - Botão "Concluído" (✓) por atividade → seta pra 100%
  - Botão "Tudo concluído" para a unidade inteira
  - Botão "Salvar" com feedback visual

### 5. Programação Semanal (`ProgramacaoSemanal.tsx`)
- Header: semana atual, PPC calculado em tempo real, meta
- Tabela de tarefas: atividade, local, responsável, checkbox "cumprida?", causa (se não), status
- PPC recalcula conforme checkboxes são marcadas
- Seção de restrições: descrição, responsável, prazo, status
- Botão "Gerar" → puxa atividades do cronograma que caem naquela semana

### 6. Configurações (`Configuracoes.tsx`)
- **Conta**: avatar, nome, username, email, telefone, perfil (role), CREA/CAU, senha
- **Critério de avanço**: radio (Custo / Quantidade / Híbrido) com fórmula exibida
- **Método de medição por atividade**: tabela editável com tipo, unidade e quantidade padrão
- **Configurações do projeto**: jornada semanal, horas/dia, fuso, moeda
- **Notificações**: toggles para alertas de atraso, lembrete semanal, relatório automático, restrições vencidas

---

## SEED DE DADOS

O arquivo `prisma/seed.ts` deve popular o banco com dados realistas de demonstração:

- 1 projeto "Residencial Vista Verde" com status IN_PROGRESS
- 2 torres (A e B), cada uma com 7 pavimentos (Térreo + 6 andares + Cobertura)
- 4 unidades por andar (ex: Apt 101, 102, 103, 104)
- 8 tipos de atividade configurados com métodos e unidades
- EAP completo hierárquico (~500+ items de cronograma)
- Medições de campo realistas (andares inferiores mais completos, superiores menos)
- 3 planos semanais (S16, S17, S18) com tarefas e PPC
- Restrições de exemplo
- 2 usuários: admin (carlos@horizonte.com.br / admin123) e viewer (viewer@horizonte.com.br / viewer123)

---

## INSTRUÇÕES DE EXECUÇÃO

### Passo a passo para iniciar:
```bash
# 1. Clonar e configurar
cp .env.example .env

# 2. Subir todos os serviços
docker compose up -d

# 3. Verificar logs
docker compose logs -f backend

# 4. Acessar
# Frontend: http://localhost:5173
# API:      http://localhost:3001/api
# Swagger:  http://localhost:3001/api/docs
# MinIO:    http://localhost:9001
```

---

## REQUISITOS NÃO-FUNCIONAIS

1. **Performance**: paginação nos endpoints de listagem, cache Redis para dashboard (TTL 5min)
2. **Segurança**: bcrypt para senhas, JWT com refresh token, CORS configurado, rate limiting
3. **Validação**: class-validator em todos os DTOs, sanitização de inputs
4. **Erros**: global exception filter com mensagens em português, HTTP status codes corretos
5. **Logs**: Logger do NestJS com níveis (debug/info/warn/error)
6. **Mobile**: frontend responsivo (Tailwind breakpoints), touch-friendly para uso em obra
7. **i18n**: preparado para pt-BR (datas dd/MM/yyyy, moeda R$, separador decimal vírgula)

---

## SEQUÊNCIA DE IMPLEMENTAÇÃO RECOMENDADA

Execute nesta ordem para minimizar problemas de dependência:

```
1.  Scaffolding: criar estrutura de pastas, package.json, configs
2.  Docker Compose + .env
3.  Prisma schema + migrations + seed
4.  Auth module (register, login, JWT, guards)
5.  Users module (CRUD básico)
6.  Projects module (CRUD + members)
7.  Towers/Floors/Units modules (estrutura física)
8.  Activity Types module (configuração de atividades)
9.  Schedule module (EAP/cronograma CRUD + Gantt data + Curva S)
10. Measurements module (medição de campo + cálculos)
11. Weekly Planning module (PPC + tarefas + restrições)
12. Dashboard module (KPIs consolidados)
13. Uploads module (MinIO integration)
14. Frontend: setup Vite + React + Tailwind + shadcn/ui
15. Frontend: Auth pages (login, registro)
16. Frontend: Layout com navegação por abas
17. Frontend: Cadastro page
18. Frontend: Dashboard page (gráficos + KPIs)
19. Frontend: Cronograma page (Gantt side-by-side)
20. Frontend: Medição page (building SVG + unit grid + metrics)
21. Frontend: Programação Semanal page
22. Frontend: Configurações page
23. Testes unitários (services)
24. Testes de integração (controllers)
25. CI pipeline (GitHub Actions)
26. nginx config + production Docker builds
```

---

## COMECE AGORA

Inicie pelo passo 1: crie toda a estrutura de pastas, instale as dependências, configure o TypeScript, Prisma, NestJS e Vite. Depois siga a sequência acima.

A cada módulo concluído, rode `docker compose up --build` para validar que tudo compila e os testes passam.

Pergunte se tiver dúvidas sobre algum ponto da especificação.
