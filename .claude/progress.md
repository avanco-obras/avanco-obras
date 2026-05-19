# AvançoObras Pro — Checkpoint de Progresso

> Atualizado em: 2026-05-09 (Sessão 4 — redesign visual completo)

---

## STATUS GERAL: 100% Completo ✅

---

## SESSÃO 1 — Scaffolding e módulos base

### Infraestrutura
- [x] Estrutura de pastas do projeto
- [x] `docker-compose.yml` (PostgreSQL, Redis, MinIO, backend, frontend, nginx)
- [x] `.env.example` com todas as variáveis
- [x] `nginx/nginx.conf` configurado como reverse proxy

### Backend — módulos base
- [x] `main.ts` — bootstrap com Swagger, CORS, helmet, throttler, validation pipe, `import 'dotenv/config'` na 1ª linha
- [x] `app.module.ts` — imports completos
- [x] `config/configuration.ts`
- [x] `common/prisma.service.ts`
- [x] `common/filters/http-exception.filter.ts` — cast `exception as unknown as Record<string,unknown>` para TS strict
- [x] `common/interceptors/transform.interceptor.ts`
- [x] `common/pipes/validation.pipe.ts`
- [x] `common/decorators/` (current-user, roles, public)
- [x] **Auth module** — register, login, JWT, guards, decorators
- [x] **Users module** — CRUD, change-password
- [x] **Projects module** — CRUD + membros
- [x] **Towers module** — torres, pavimentos, unidades (hierarquia completa)
- [x] **Activity Types module** — CRUD configurável
- [x] **Schedule module** — EAP/cronograma, Gantt data, Curva S
- [x] `prisma/schema.prisma` — schema completo (todos os models e enums)
- [x] `prisma/seed.ts` — seed realista (Residencial Vista Verde, 2 torres, 7 andares, 4 unidades/andar, 385 medições, 3 planos semanais)
- [x] `package.json` — `"prisma": { "seed": "ts-node prisma/seed.ts" }` adicionado

### Frontend — base
- [x] Vite + React 18 + TypeScript + Tailwind + shadcn/ui configurados
- [x] `src/vite-env.d.ts` adicionado (`/// <reference types="vite/client" />`)
- [x] React Router v6 com rotas definidas
- [x] Zustand store (auth, project, UI state)
- [x] `services/api.ts` — todos os endpoints mapeados
- [x] `types/index.ts` — tipos TypeScript completos
- [x] `hooks/useAuth.ts`, `useProject.ts`, `useMeasurement.ts`, `useWebSocket.ts`
- [x] `utils/calculations.ts` — `calcPPC`, `formatDate`, cálculos de avanço

---

## SESSÃO 2 — Módulos faltantes e páginas

### Backend — módulos implementados
| Módulo | Arquivos |
|--------|---------|
| Measurements | service, controller, module — findByUnit, create (auto-calc % por METRIC/COUNT), update, batchCreate, getSummary, getBuildingData |
| Weekly Planning | service, controller, module + 5 DTOs — CRUD planos, tarefas, restrições, getPPCHistory, generateFromSchedule |
| Dashboard | service, controller, module — getKPIs (SPI ponderado), getDelays, getPendingRestrictions, getSPIHistory mensal |
| Uploads | service (MinIO integration, ensureBucket onModuleInit, presigned URLs), controller, module |

### Frontend — páginas implementadas
| Página | Descrição |
|--------|-----------|
| `Cronograma.tsx` | Gantt side-by-side, 5 níveis, expand/collapse, busca debounced, linha "hoje", export CSV |
| `Medicao.tsx` | SVG fachada, grid de unidades, painel de atividades com toggle % / métrica |
| `ProgramacaoSemanal.tsx` | Tabela PPC real-time, tarefas, restrições, navegação entre semanas |
| `Configuracoes.tsx` | Conta, projeto, critério de avanço, tabela editável de atividades, notificações |

---

## SESSÃO 3 — Correções e testes

### Correções
| Item | Detalhe |
|------|---------|
| `docker-compose.yml` | `prisma migrate deploy` → `prisma db push` (funciona sem migration files) |
| `backend/.env` | Copiado da raiz — Prisma lê `process.env` antes do ConfigModule |
| `main.ts` | `import 'dotenv/config'` adicionado na 1ª linha |
| `vite.config.ts` | Proxy `http://backend:3001` → `process.env.VITE_API_TARGET \|\| 'http://localhost:3001'` |
| `package.json` frontend | `@radix-ui/react-badge` removido (pacote inexistente no npm) |
| `http-exception.filter.ts` | Cast via `unknown` para corrigir erro TS2352 |
| `Login.tsx` | Tabs "Entrar" / "Criar conta" com form completo de registro |

### Testes unitários (51 testes, todos passando)
| Arquivo | Cobertura |
|---------|-----------|
| `auth/auth.service.spec.ts` | register (conflitos + sucesso), login (not found, inativo, senha errada, sucesso), getMe |
| `measurements/measurements.service.spec.ts` | findByUnit, create PERCENT/METRIC/fallback/cap, update, batchCreate |
| `schedule/schedule.service.spec.ts` | CRUD, getGanttData (hasChildren), getCurvaS (pontos mensais) |
| `dashboard/dashboard.service.spec.ts` | getKPIs (SPI ponderado), getDelays, getPendingRestrictions, getSPIHistory |

---

## SESSÃO 4 — Redesign visual completo (referência: `avanco_obras_v2.html`)

### Design system substituído (`index.css`)
- Paleta quente/neutra idêntica ao HTML: `--bg:#f4f3ef`, `--bg1:#fff`, `--bg2:#f0efe9`, `--bg3:#e6e5df`
- Accent amber: `--amber:#BA7517`, verde: `--green:#3B6D11`, vermelho: `--red:#A32D2D`
- Dark mode via `.dark {}` + `@media(prefers-color-scheme:dark)` simultâneos
- Fonte `Segoe UI, system-ui, sans-serif`, 13px base, 0.5px borders
- Shadcn HSL variables remapeadas para a nova paleta (amber como `--primary`)
- Classes utilitárias `ao-*` globais: `ao-card`, `ao-card-hdr`, `ao-badge`, `ao-btn`, `ao-fg`, `ao-table`, `ao-kpi`, `ao-g2/g3`, `ao-pbar/pfill`, `ao-sec-title`

### AppLayout reescrito
- Removida sidebar; layout agora idêntico ao HTML: header texto + nav pill horizontal
- Header: `AvançoObras Pro` à esquerda, nome do projeto + datas (Atualização / Prazo) à direita
- Nav: pill compacto (`border-radius:12px; padding:4px; background:var(--bg1)`), ícone amber no tab ativo
- Container `max-width:1140px` centralizado sem sticky
- Avatar do usuário com menu dropdown (Meu Perfil / Sair) no canto superior direito

### Páginas redesenhadas
| Página | Mudanças visuais |
|--------|------------------|
| **Dashboard** | KPI rings SVG inline (circumference 201.1), barras etapas planejado×real, PPC histórico com bar colors (verde/âmbar/vermelho), delay list com barra de criticidade, cards em ao-g2/ao-g3 |
| **Cronograma** | ao-card compacto, legenda de cores, rows com estilos de nível exatos (lv0=bg3, lv1=bg2, lv2-4 progressivo), expand ▶/▼, badges ao-bg/ao-ba/ao-br |
| **Medição** | SVG isométrico 3D (sombra elipse, face lateral, telhado, fachada), andares clicáveis com destaque amber, unit grid 78px minmax, activity rows com toggle amber/inativo, sem shadcn components |
| **Prog. Semanal** | Coluna "Cumprida?" com checkbox nativo, PPC recalculado ao vivo a cada check, tabela ao-table, badges de status e restrições sem shadcn |
| **Configurações** | 2 colunas ao-g2, avatar circular amb-bg, radio critério de avanço, tabela inline editável de métodos, ao-fg forms |
| **Cadastro** | Grid 2 colunas compacto com ao-fg, upload PDF dashed border + IA button, modelo 3D com iframe Sketchfab |

---

## 📌 CREDENCIAIS DE DEMO

- **Admin:** `carlos@horizonte.com.br` / `admin123`
- **Viewer:** `viewer@horizonte.com.br` / `viewer123`

---

## 🚀 COMO RODAR (local sem Docker)

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

---

## 🗂 ARQUITETURA TÉCNICA

| Camada | Detalhe |
|--------|---------|
| API responses | Envelope `{ statusCode, data }` via `TransformInterceptor`; frontend faz unwrap no interceptor axios |
| Auth | JWT `Bearer` token; `@CurrentUser('id')` decorator extrai userId do payload |
| Prisma | `prisma db push` em dev; sem migration files necessários |
| MinIO | Inicializado via `onModuleInit`; erro não-fatal se indisponível (uploads desabilitados) |
| Frontend CSS | Tailwind + classes `ao-*` globais; componentes shadcn/ui usados apenas onde ainda necessário |
| Dark mode | CSS vars trocadas via `.dark` (Tailwind) + `prefers-color-scheme` (sistema) |

---

## 📁 ARQUIVO DE REFERÊNCIA VISUAL

`avanco_obras_v2.html` — HTML estático com o design final de referência. O React deve ser idêntico a ele visualmente.
