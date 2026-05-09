"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WeeklyPlanningService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../common/prisma.service");
let WeeklyPlanningService = class WeeklyPlanningService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(projectId) {
        const project = await this.prisma.project.findUnique({
            where: { id: projectId },
            select: { id: true },
        });
        if (!project) {
            throw new common_1.NotFoundException(`Projeto com ID "${projectId}" não encontrado`);
        }
        return this.prisma.weeklyPlan.findMany({
            where: { projectId },
            orderBy: [{ year: 'desc' }, { weekNumber: 'desc' }],
        });
    }
    async create(projectId, dto) {
        const project = await this.prisma.project.findUnique({
            where: { id: projectId },
            select: { id: true },
        });
        if (!project) {
            throw new common_1.NotFoundException(`Projeto com ID "${projectId}" não encontrado`);
        }
        const existing = await this.prisma.weeklyPlan.findUnique({
            where: {
                projectId_year_weekNumber: {
                    projectId,
                    year: dto.year,
                    weekNumber: dto.weekNumber,
                },
            },
            select: { id: true },
        });
        if (existing) {
            throw new common_1.ConflictException(`Já existe um plano semanal para a semana ${dto.weekNumber} de ${dto.year} neste projeto`);
        }
        return this.prisma.weeklyPlan.create({
            data: {
                projectId,
                weekNumber: dto.weekNumber,
                year: dto.year,
                startDate: new Date(dto.startDate),
                endDate: new Date(dto.endDate),
                ppcTarget: dto.ppcTarget ?? 80,
                notes: dto.notes ?? null,
            },
        });
    }
    async findOne(id) {
        const plan = await this.prisma.weeklyPlan.findUnique({
            where: { id },
            include: {
                tasks: {
                    include: {
                        assignedTo: {
                            select: { id: true, fullName: true, email: true },
                        },
                    },
                    orderBy: { createdAt: 'asc' },
                },
                restrictions: {
                    orderBy: { dueDate: 'asc' },
                },
            },
        });
        if (!plan) {
            throw new common_1.NotFoundException(`Plano semanal com ID "${id}" não encontrado`);
        }
        return plan;
    }
    async addTask(planId, dto) {
        const plan = await this.prisma.weeklyPlan.findUnique({
            where: { id: planId },
            select: { id: true },
        });
        if (!plan) {
            throw new common_1.NotFoundException(`Plano semanal com ID "${planId}" não encontrado`);
        }
        return this.prisma.weeklyTask.create({
            data: {
                weeklyPlanId: planId,
                description: dto.description,
                location: dto.location,
                assignedToId: dto.assignedToId ?? null,
                status: dto.status ?? 'NOT_COMPLETED',
                nonCompletionCause: dto.nonCompletionCause ?? null,
            },
            include: {
                assignedTo: {
                    select: { id: true, fullName: true, email: true },
                },
            },
        });
    }
    async updateTask(taskId, dto) {
        const task = await this.prisma.weeklyTask.findUnique({
            where: { id: taskId },
            select: { id: true },
        });
        if (!task) {
            throw new common_1.NotFoundException(`Tarefa com ID "${taskId}" não encontrada`);
        }
        return this.prisma.weeklyTask.update({
            where: { id: taskId },
            data: {
                ...(dto.description !== undefined && { description: dto.description }),
                ...(dto.location !== undefined && { location: dto.location }),
                ...(dto.assignedToId !== undefined && { assignedToId: dto.assignedToId }),
                ...(dto.status !== undefined && { status: dto.status }),
                ...(dto.nonCompletionCause !== undefined && { nonCompletionCause: dto.nonCompletionCause }),
            },
            include: {
                assignedTo: {
                    select: { id: true, fullName: true, email: true },
                },
            },
        });
    }
    async addRestriction(planId, dto) {
        const plan = await this.prisma.weeklyPlan.findUnique({
            where: { id: planId },
            select: { id: true },
        });
        if (!plan) {
            throw new common_1.NotFoundException(`Plano semanal com ID "${planId}" não encontrado`);
        }
        return this.prisma.restriction.create({
            data: {
                weeklyPlanId: planId,
                description: dto.description,
                responsible: dto.responsible,
                dueDate: new Date(dto.dueDate),
                status: dto.status ?? 'PENDING',
            },
        });
    }
    async updateRestriction(restrictionId, dto) {
        const restriction = await this.prisma.restriction.findUnique({
            where: { id: restrictionId },
            select: { id: true, status: true },
        });
        if (!restriction) {
            throw new common_1.NotFoundException(`Restrição com ID "${restrictionId}" não encontrada`);
        }
        const isBeingReleased = dto.status === 'RELEASED' && restriction.status !== 'RELEASED';
        return this.prisma.restriction.update({
            where: { id: restrictionId },
            data: {
                ...(dto.description !== undefined && { description: dto.description }),
                ...(dto.responsible !== undefined && { responsible: dto.responsible }),
                ...(dto.dueDate !== undefined && { dueDate: new Date(dto.dueDate) }),
                ...(dto.status !== undefined && { status: dto.status }),
                ...(dto.resolvedAt !== undefined
                    ? { resolvedAt: dto.resolvedAt }
                    : isBeingReleased
                        ? { resolvedAt: new Date() }
                        : {}),
            },
        });
    }
    async getPPCHistory(projectId) {
        const project = await this.prisma.project.findUnique({
            where: { id: projectId },
            select: { id: true },
        });
        if (!project) {
            throw new common_1.NotFoundException(`Projeto com ID "${projectId}" não encontrado`);
        }
        const plans = await this.prisma.weeklyPlan.findMany({
            where: { projectId },
            orderBy: [{ year: 'desc' }, { weekNumber: 'desc' }],
            take: 12,
            include: {
                tasks: {
                    select: { status: true },
                },
            },
        });
        return plans.map((plan) => {
            const tasks = plan.tasks;
            let ppcActual = 0;
            if (tasks.length > 0) {
                const totalScore = tasks.reduce((sum, task) => {
                    if (task.status === 'COMPLETED')
                        return sum + 1;
                    if (task.status === 'PARTIALLY')
                        return sum + 0.5;
                    return sum;
                }, 0);
                ppcActual = Math.round((totalScore / tasks.length) * 10000) / 100;
            }
            return {
                weekNumber: plan.weekNumber,
                year: plan.year,
                ppcTarget: Number(plan.ppcTarget),
                ppcActual,
            };
        });
    }
    async generateFromSchedule(planId) {
        const plan = await this.prisma.weeklyPlan.findUnique({
            where: { id: planId },
            select: {
                id: true,
                projectId: true,
                startDate: true,
                endDate: true,
            },
        });
        if (!plan) {
            throw new common_1.NotFoundException(`Plano semanal com ID "${planId}" não encontrado`);
        }
        const scheduleItems = await this.prisma.scheduleItem.findMany({
            where: {
                projectId: plan.projectId,
                startDate: { lte: plan.endDate },
                endDate: { gte: plan.startDate },
            },
            select: {
                id: true,
                name: true,
                code: true,
            },
            orderBy: { order: 'asc' },
        });
        if (scheduleItems.length === 0) {
            return [];
        }
        const createdTasks = await this.prisma.$transaction(scheduleItems.map((item) => this.prisma.weeklyTask.create({
            data: {
                weeklyPlanId: planId,
                description: item.name,
                location: item.code,
                status: 'NOT_COMPLETED',
            },
        })));
        return createdTasks;
    }
};
exports.WeeklyPlanningService = WeeklyPlanningService;
exports.WeeklyPlanningService = WeeklyPlanningService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], WeeklyPlanningService);
//# sourceMappingURL=weekly-planning.service.js.map