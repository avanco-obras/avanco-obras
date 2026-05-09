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
exports.TowersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../common/prisma.service");
let TowersService = class TowersService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listTowers(projectId) {
        const project = await this.prisma.project.findUnique({
            where: { id: projectId },
            select: { id: true },
        });
        if (!project) {
            throw new common_1.NotFoundException(`Projeto com ID "${projectId}" não encontrado`);
        }
        return this.prisma.tower.findMany({
            where: { projectId },
            include: {
                _count: { select: { floors: true } },
            },
            orderBy: { order: 'asc' },
        });
    }
    async createTower(projectId, dto) {
        const project = await this.prisma.project.findUnique({
            where: { id: projectId },
            select: { id: true },
        });
        if (!project) {
            throw new common_1.NotFoundException(`Projeto com ID "${projectId}" não encontrado`);
        }
        let order = dto.order;
        if (order === undefined) {
            const lastTower = await this.prisma.tower.findFirst({
                where: { projectId },
                orderBy: { order: 'desc' },
                select: { order: true },
            });
            order = lastTower ? lastTower.order + 1 : 0;
        }
        return this.prisma.tower.create({
            data: {
                projectId,
                name: dto.name,
                order,
            },
            include: {
                _count: { select: { floors: true } },
            },
        });
    }
    async listFloors(towerId) {
        const tower = await this.prisma.tower.findUnique({
            where: { id: towerId },
            select: { id: true },
        });
        if (!tower) {
            throw new common_1.NotFoundException(`Torre com ID "${towerId}" não encontrada`);
        }
        return this.prisma.floor.findMany({
            where: { towerId },
            include: {
                _count: { select: { units: true } },
            },
            orderBy: [{ order: 'asc' }, { level: 'asc' }],
        });
    }
    async createFloor(towerId, dto) {
        const tower = await this.prisma.tower.findUnique({
            where: { id: towerId },
            select: { id: true },
        });
        if (!tower) {
            throw new common_1.NotFoundException(`Torre com ID "${towerId}" não encontrada`);
        }
        let order = dto.order;
        if (order === undefined) {
            const lastFloor = await this.prisma.floor.findFirst({
                where: { towerId },
                orderBy: { order: 'desc' },
                select: { order: true },
            });
            order = lastFloor ? lastFloor.order + 1 : 0;
        }
        return this.prisma.floor.create({
            data: {
                towerId,
                name: dto.name,
                level: dto.level,
                order,
            },
            include: {
                _count: { select: { units: true } },
            },
        });
    }
    async listUnits(floorId) {
        const floor = await this.prisma.floor.findUnique({
            where: { id: floorId },
            select: { id: true },
        });
        if (!floor) {
            throw new common_1.NotFoundException(`Pavimento com ID "${floorId}" não encontrado`);
        }
        return this.prisma.unit.findMany({
            where: { floorId },
            orderBy: { order: 'asc' },
        });
    }
    async createUnit(floorId, dto) {
        const floor = await this.prisma.floor.findUnique({
            where: { id: floorId },
            select: { id: true },
        });
        if (!floor) {
            throw new common_1.NotFoundException(`Pavimento com ID "${floorId}" não encontrado`);
        }
        let order = dto.order;
        if (order === undefined) {
            const lastUnit = await this.prisma.unit.findFirst({
                where: { floorId },
                orderBy: { order: 'desc' },
                select: { order: true },
            });
            order = lastUnit ? lastUnit.order + 1 : 0;
        }
        return this.prisma.unit.create({
            data: {
                floorId,
                name: dto.name,
                area: dto.area !== undefined ? dto.area : null,
                order,
            },
        });
    }
};
exports.TowersService = TowersService;
exports.TowersService = TowersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TowersService);
//# sourceMappingURL=towers.service.js.map