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
exports.ProjectsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../common/prisma.service");
let ProjectsService = class ProjectsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { role: true },
        });
        const where = user?.role === client_1.UserRole.ADMIN
            ? {}
            : { members: { some: { userId } } };
        return this.prisma.project.findMany({
            where,
            include: {
                _count: { select: { towers: true, members: true } },
                members: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                fullName: true,
                                email: true,
                                role: true,
                                avatarUrl: true,
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async create(dto, userId) {
        const project = await this.prisma.project.create({
            data: {
                name: dto.name,
                company: dto.company,
                address: dto.address,
                status: dto.status ?? 'PLANNING',
                startDate: new Date(dto.startDate),
                endDate: new Date(dto.endDate),
                estimatedCost: dto.estimatedCost !== undefined ? dto.estimatedCost : null,
                currency: dto.currency ?? 'BRL',
                totalArea: dto.totalArea !== undefined ? dto.totalArea : null,
                workdaysPerWeek: dto.workdaysPerWeek ?? 5,
                hoursPerDay: dto.hoursPerDay ?? 8,
                timezone: dto.timezone ?? 'America/Sao_Paulo',
                progressCriteria: dto.progressCriteria ?? 'COST',
                members: {
                    create: {
                        userId,
                        role: client_1.UserRole.ADMIN,
                    },
                },
            },
            include: {
                _count: { select: { towers: true, members: true } },
                members: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                fullName: true,
                                email: true,
                                role: true,
                                avatarUrl: true,
                            },
                        },
                    },
                },
            },
        });
        return project;
    }
    async findOne(id, userId) {
        const project = await this.prisma.project.findUnique({
            where: { id },
            include: {
                _count: { select: { towers: true, scheduleItems: true, members: true } },
                members: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                fullName: true,
                                email: true,
                                role: true,
                                avatarUrl: true,
                                phone: true,
                                crea: true,
                            },
                        },
                    },
                },
                towers: {
                    include: {
                        _count: { select: { floors: true } },
                    },
                    orderBy: { order: 'asc' },
                },
                scheduleItems: {
                    where: { parentId: null },
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        plannedProgress: true,
                        actualProgress: true,
                        startDate: true,
                        endDate: true,
                        isCriticalPath: true,
                    },
                    orderBy: { order: 'asc' },
                    take: 10,
                },
            },
        });
        if (!project) {
            throw new common_1.NotFoundException(`Projeto com ID "${id}" não encontrado`);
        }
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { role: true },
        });
        const isMember = project.members.some((m) => m.userId === userId);
        if (!isMember && user?.role !== client_1.UserRole.ADMIN) {
            throw new common_1.ForbiddenException('Você não tem acesso a este projeto');
        }
        return project;
    }
    async update(id, dto, userId) {
        const project = await this.prisma.project.findUnique({
            where: { id },
            include: { members: true },
        });
        if (!project) {
            throw new common_1.NotFoundException(`Projeto com ID "${id}" não encontrado`);
        }
        const member = project.members.find((m) => m.userId === userId);
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { role: true },
        });
        const isGlobalAdmin = user?.role === client_1.UserRole.ADMIN;
        const isProjectAdmin = member?.role === client_1.UserRole.ADMIN;
        const isProjectEngineer = member?.role === client_1.UserRole.ENGINEER;
        if (!isGlobalAdmin && !isProjectAdmin && !isProjectEngineer) {
            throw new common_1.ForbiddenException('Você precisa ser ADMIN ou ENGINEER no projeto para editá-lo');
        }
        return this.prisma.project.update({
            where: { id },
            data: {
                ...(dto.name !== undefined && { name: dto.name }),
                ...(dto.company !== undefined && { company: dto.company }),
                ...(dto.address !== undefined && { address: dto.address }),
                ...(dto.status !== undefined && { status: dto.status }),
                ...(dto.startDate !== undefined && { startDate: new Date(dto.startDate) }),
                ...(dto.endDate !== undefined && { endDate: new Date(dto.endDate) }),
                ...(dto.estimatedCost !== undefined && { estimatedCost: dto.estimatedCost }),
                ...(dto.currency !== undefined && { currency: dto.currency }),
                ...(dto.totalArea !== undefined && { totalArea: dto.totalArea }),
                ...(dto.workdaysPerWeek !== undefined && { workdaysPerWeek: dto.workdaysPerWeek }),
                ...(dto.hoursPerDay !== undefined && { hoursPerDay: dto.hoursPerDay }),
                ...(dto.timezone !== undefined && { timezone: dto.timezone }),
                ...(dto.progressCriteria !== undefined && { progressCriteria: dto.progressCriteria }),
            },
            include: {
                _count: { select: { towers: true, members: true } },
                members: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                fullName: true,
                                email: true,
                                role: true,
                                avatarUrl: true,
                            },
                        },
                    },
                },
            },
        });
    }
    async remove(id, userId) {
        const project = await this.prisma.project.findUnique({
            where: { id },
            include: { members: true },
        });
        if (!project) {
            throw new common_1.NotFoundException(`Projeto com ID "${id}" não encontrado`);
        }
        const member = project.members.find((m) => m.userId === userId);
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { role: true },
        });
        const isGlobalAdmin = user?.role === client_1.UserRole.ADMIN;
        const isProjectAdmin = member?.role === client_1.UserRole.ADMIN;
        if (!isGlobalAdmin && !isProjectAdmin) {
            throw new common_1.ForbiddenException('Somente um ADMIN pode excluir este projeto');
        }
        await this.prisma.project.delete({ where: { id } });
        return { message: 'Projeto excluído com sucesso' };
    }
    async addMember(id, dto, userId) {
        const project = await this.prisma.project.findUnique({
            where: { id },
            include: { members: true },
        });
        if (!project) {
            throw new common_1.NotFoundException(`Projeto com ID "${id}" não encontrado`);
        }
        const requestingMember = project.members.find((m) => m.userId === userId);
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { role: true },
        });
        const isGlobalAdmin = user?.role === client_1.UserRole.ADMIN;
        const isProjectAdmin = requestingMember?.role === client_1.UserRole.ADMIN;
        if (!isGlobalAdmin && !isProjectAdmin) {
            throw new common_1.ForbiddenException('Somente um ADMIN pode adicionar membros ao projeto');
        }
        const targetUser = await this.prisma.user.findUnique({
            where: { id: dto.userId },
            select: { id: true },
        });
        if (!targetUser) {
            throw new common_1.NotFoundException(`Usuário com ID "${dto.userId}" não encontrado`);
        }
        const existingMember = project.members.find((m) => m.userId === dto.userId);
        if (existingMember) {
            return this.prisma.projectMember.update({
                where: { id: existingMember.id },
                data: { role: dto.role },
                include: {
                    user: {
                        select: {
                            id: true,
                            fullName: true,
                            email: true,
                            role: true,
                            avatarUrl: true,
                        },
                    },
                },
            });
        }
        return this.prisma.projectMember.create({
            data: {
                projectId: id,
                userId: dto.userId,
                role: dto.role,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        role: true,
                        avatarUrl: true,
                    },
                },
            },
        });
    }
};
exports.ProjectsService = ProjectsService;
exports.ProjectsService = ProjectsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ProjectsService);
//# sourceMappingURL=projects.service.js.map