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
exports.ActivityTypesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../common/prisma.service");
let ActivityTypesService = class ActivityTypesService {
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
        return this.prisma.activityType.findMany({
            where: { projectId },
            orderBy: { order: 'asc' },
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
        const existing = await this.prisma.activityType.findUnique({
            where: { projectId_name: { projectId, name: dto.name } },
        });
        if (existing) {
            throw new common_1.ConflictException(`Tipo de atividade com nome "${dto.name}" já existe neste projeto`);
        }
        let order = dto.order;
        if (order === undefined) {
            const last = await this.prisma.activityType.findFirst({
                where: { projectId },
                orderBy: { order: 'desc' },
                select: { order: true },
            });
            order = last ? last.order + 1 : 0;
        }
        return this.prisma.activityType.create({
            data: {
                projectId,
                name: dto.name,
                measurementMethod: dto.measurementMethod ?? 'PERCENT',
                unit: dto.unit ?? '%',
                defaultQuantity: dto.defaultQuantity ?? 0,
                weight: dto.weight ?? 1,
                order,
            },
        });
    }
    async update(id, dto) {
        const activityType = await this.prisma.activityType.findUnique({
            where: { id },
        });
        if (!activityType) {
            throw new common_1.NotFoundException(`Tipo de atividade com ID "${id}" não encontrado`);
        }
        if (dto.name && dto.name !== activityType.name) {
            const existing = await this.prisma.activityType.findUnique({
                where: {
                    projectId_name: {
                        projectId: activityType.projectId,
                        name: dto.name,
                    },
                },
            });
            if (existing) {
                throw new common_1.ConflictException(`Tipo de atividade com nome "${dto.name}" já existe neste projeto`);
            }
        }
        return this.prisma.activityType.update({
            where: { id },
            data: {
                ...(dto.name !== undefined && { name: dto.name }),
                ...(dto.measurementMethod !== undefined && { measurementMethod: dto.measurementMethod }),
                ...(dto.unit !== undefined && { unit: dto.unit }),
                ...(dto.defaultQuantity !== undefined && { defaultQuantity: dto.defaultQuantity }),
                ...(dto.weight !== undefined && { weight: dto.weight }),
                ...(dto.order !== undefined && { order: dto.order }),
            },
        });
    }
    async remove(id) {
        const activityType = await this.prisma.activityType.findUnique({
            where: { id },
            select: { id: true },
        });
        if (!activityType) {
            throw new common_1.NotFoundException(`Tipo de atividade com ID "${id}" não encontrado`);
        }
        await this.prisma.activityType.delete({ where: { id } });
        return { message: 'Tipo de atividade excluído com sucesso' };
    }
};
exports.ActivityTypesService = ActivityTypesService;
exports.ActivityTypesService = ActivityTypesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ActivityTypesService);
//# sourceMappingURL=activity-types.service.js.map