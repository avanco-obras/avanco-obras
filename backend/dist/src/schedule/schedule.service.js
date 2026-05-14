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
exports.ScheduleService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../common/prisma.service");
const xlsx = require("xlsx");
const client_1 = require("@prisma/client");
let ScheduleService = class ScheduleService {
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
        return this.prisma.scheduleItem.findMany({
            where: { projectId },
            include: {
                activityType: true,
            },
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
        if (dto.parentId) {
            const parent = await this.prisma.scheduleItem.findUnique({
                where: { id: dto.parentId },
                select: { id: true, projectId: true },
            });
            if (!parent || parent.projectId !== projectId) {
                throw new common_1.NotFoundException(`Item pai com ID "${dto.parentId}" não encontrado neste projeto`);
            }
        }
        if (dto.activityTypeId) {
            const actType = await this.prisma.activityType.findUnique({
                where: { id: dto.activityTypeId },
                select: { id: true, projectId: true },
            });
            if (!actType || actType.projectId !== projectId) {
                throw new common_1.NotFoundException(`Tipo de atividade com ID "${dto.activityTypeId}" não encontrado neste projeto`);
            }
        }
        let order = dto.order;
        if (order === undefined) {
            const last = await this.prisma.scheduleItem.findFirst({
                where: { projectId, parentId: dto.parentId ?? null },
                orderBy: { order: 'desc' },
                select: { order: true },
            });
            order = last ? last.order + 1 : 0;
        }
        return this.prisma.scheduleItem.create({
            data: {
                projectId,
                parentId: dto.parentId ?? null,
                activityTypeId: dto.activityTypeId ?? null,
                code: dto.code,
                name: dto.name,
                level: dto.level,
                startDate: new Date(dto.startDate),
                endDate: new Date(dto.endDate),
                durationDays: dto.durationDays,
                plannedProgress: dto.plannedProgress ?? 0,
                actualProgress: dto.actualProgress ?? 0,
                weight: dto.weight ?? 1,
                isCriticalPath: dto.isCriticalPath ?? false,
                order,
            },
            include: {
                activityType: true,
            },
        });
    }
    async update(id, dto) {
        const item = await this.prisma.scheduleItem.findUnique({
            where: { id },
            select: { id: true },
        });
        if (!item) {
            throw new common_1.NotFoundException(`Item de cronograma com ID "${id}" não encontrado`);
        }
        return this.prisma.scheduleItem.update({
            where: { id },
            data: {
                ...(dto.parentId !== undefined && { parentId: dto.parentId }),
                ...(dto.activityTypeId !== undefined && { activityTypeId: dto.activityTypeId }),
                ...(dto.code !== undefined && { code: dto.code }),
                ...(dto.name !== undefined && { name: dto.name }),
                ...(dto.level !== undefined && { level: dto.level }),
                ...(dto.startDate !== undefined && { startDate: new Date(dto.startDate) }),
                ...(dto.endDate !== undefined && { endDate: new Date(dto.endDate) }),
                ...(dto.durationDays !== undefined && { durationDays: dto.durationDays }),
                ...(dto.plannedProgress !== undefined && { plannedProgress: dto.plannedProgress }),
                ...(dto.actualProgress !== undefined && { actualProgress: dto.actualProgress }),
                ...(dto.weight !== undefined && { weight: dto.weight }),
                ...(dto.isCriticalPath !== undefined && { isCriticalPath: dto.isCriticalPath }),
                ...(dto.order !== undefined && { order: dto.order }),
            },
            include: {
                activityType: true,
            },
        });
    }
    async remove(id) {
        const item = await this.prisma.scheduleItem.findUnique({
            where: { id },
            select: { id: true },
        });
        if (!item) {
            throw new common_1.NotFoundException(`Item de cronograma com ID "${id}" não encontrado`);
        }
        await this.prisma.scheduleItem.delete({ where: { id } });
        return { message: 'Item excluído com sucesso' };
    }
    async getGanttData(projectId) {
        const project = await this.prisma.project.findUnique({
            where: { id: projectId },
            select: { id: true },
        });
        if (!project) {
            throw new common_1.NotFoundException(`Projeto com ID "${projectId}" não encontrado`);
        }
        const items = await this.prisma.scheduleItem.findMany({
            where: { projectId },
            select: {
                id: true,
                code: true,
                name: true,
                level: true,
                parentId: true,
                startDate: true,
                endDate: true,
                durationDays: true,
                plannedProgress: true,
                actualProgress: true,
                isCriticalPath: true,
                order: true,
                weight: true,
                _count: {
                    select: { children: true },
                },
            },
            orderBy: { order: 'asc' },
        });
        return items.map((item) => ({
            id: item.id,
            code: item.code,
            name: item.name,
            level: item.level,
            parentId: item.parentId ?? undefined,
            startDate: item.startDate.toISOString(),
            endDate: item.endDate.toISOString(),
            durationDays: item.durationDays,
            plannedProgress: Number(item.plannedProgress),
            actualProgress: Number(item.actualProgress),
            isCriticalPath: item.isCriticalPath,
            hasChildren: item._count.children > 0,
            order: item.order,
            weight: Number(item.weight),
        }));
    }
    async getCurvaS(projectId) {
        const project = await this.prisma.project.findUnique({
            where: { id: projectId },
            select: { id: true },
        });
        if (!project) {
            throw new common_1.NotFoundException(`Projeto com ID "${projectId}" não encontrado`);
        }
        const items = await this.prisma.scheduleItem.findMany({
            where: { projectId },
            select: {
                id: true,
                startDate: true,
                endDate: true,
                plannedProgress: true,
                actualProgress: true,
                weight: true,
                _count: { select: { children: true } },
            },
        });
        if (items.length === 0) {
            return [];
        }
        const leafItems = items.filter((i) => i._count.children === 0);
        if (leafItems.length === 0) {
            return [];
        }
        const allDates = items.flatMap((i) => [i.startDate, i.endDate]);
        const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())));
        const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())));
        const totalWeight = leafItems.reduce((sum, i) => sum + Number(i.weight), 0);
        if (totalWeight === 0) {
            return [];
        }
        const points = [];
        const cursor = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
        const endMonth = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
        const monthLabels = [
            'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
            'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
        ];
        let cumulativePlanned = 0;
        let cumulativeActual = 0;
        while (cursor <= endMonth) {
            const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);
            const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
            let plannedDelta = 0;
            let actualDelta = 0;
            for (const item of leafItems) {
                const itemStart = item.startDate;
                const itemEnd = item.endDate;
                const itemWeightFraction = Number(item.weight) / totalWeight;
                const overlapStart = new Date(Math.max(itemStart.getTime(), monthStart.getTime()));
                const overlapEnd = new Date(Math.min(itemEnd.getTime(), monthEnd.getTime()));
                if (overlapStart > overlapEnd) {
                    continue;
                }
                const totalDuration = itemEnd.getTime() - itemStart.getTime();
                if (totalDuration <= 0) {
                    if (itemStart >= monthStart && itemStart <= monthEnd) {
                        plannedDelta += itemWeightFraction * Number(item.plannedProgress);
                        actualDelta += itemWeightFraction * Number(item.actualProgress);
                    }
                    continue;
                }
                const overlapDuration = overlapEnd.getTime() - overlapStart.getTime();
                const fraction = overlapDuration / totalDuration;
                plannedDelta += itemWeightFraction * Number(item.plannedProgress) * fraction;
                actualDelta += itemWeightFraction * Number(item.actualProgress) * fraction;
            }
            cumulativePlanned = Math.min(100, cumulativePlanned + plannedDelta);
            cumulativeActual = Math.min(100, cumulativeActual + actualDelta);
            const year2d = String(cursor.getFullYear()).slice(-2);
            const label = `${monthLabels[cursor.getMonth()]}/${year2d}`;
            const dateStr = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-01`;
            points.push({
                label,
                date: dateStr,
                planned: Math.round(cumulativePlanned * 100) / 100,
                actual: Math.round(cumulativeActual * 100) / 100,
            });
            cursor.setMonth(cursor.getMonth() + 1);
        }
        return points;
    }
    async addDependency(successorId, predecessorId, lagDays = 0, type = 'FS') {
        if (successorId === predecessorId) {
            throw new common_1.ConflictException('Um item não pode depender de si mesmo');
        }
        const [successor, predecessor] = await Promise.all([
            this.prisma.scheduleItem.findUnique({ where: { id: successorId }, select: { id: true } }),
            this.prisma.scheduleItem.findUnique({ where: { id: predecessorId }, select: { id: true } }),
        ]);
        if (!successor)
            throw new common_1.NotFoundException(`Item ${successorId} não encontrado`);
        if (!predecessor)
            throw new common_1.NotFoundException(`Predecessora ${predecessorId} não encontrada`);
        return this.prisma.scheduleDependency.create({
            data: { predecessorId, successorId, lagDays, type },
            include: {
                predecessor: { select: { id: true, code: true, name: true } },
                successor: { select: { id: true, code: true, name: true } },
            },
        });
    }
    async removeDependency(depId) {
        const dep = await this.prisma.scheduleDependency.findUnique({ where: { id: depId } });
        if (!dep)
            throw new common_1.NotFoundException(`Dependência ${depId} não encontrada`);
        await this.prisma.scheduleDependency.delete({ where: { id: depId } });
        return { message: 'Dependência removida com sucesso' };
    }
    async getItemDependencies(itemId) {
        const item = await this.prisma.scheduleItem.findUnique({ where: { id: itemId }, select: { id: true } });
        if (!item)
            throw new common_1.NotFoundException(`Item ${itemId} não encontrado`);
        return this.prisma.scheduleDependency.findMany({
            where: { OR: [{ predecessorId: itemId }, { successorId: itemId }] },
            include: {
                predecessor: { select: { id: true, code: true, name: true } },
                successor: { select: { id: true, code: true, name: true } },
            },
        });
    }
    normalizeColumnName(name) {
        return name.toLowerCase().trim();
    }
    mapColumnName(normalized) {
        const columnMap = {
            'código': 'code',
            'wbs': 'code',
            'code': 'code',
            'nome': 'name',
            'name': 'name',
            'tarefa': 'name',
            'task name': 'name',
            'nível': 'level',
            'level': 'level',
            'outline level': 'level',
            'início': 'startDate',
            'start': 'startDate',
            'data início': 'startDate',
            'término': 'endDate',
            'fim': 'endDate',
            'finish': 'endDate',
            'end': 'endDate',
            'data término': 'endDate',
            'duração': 'durationDays',
            'duration': 'durationDays',
            'dur.': 'durationDays',
            '% plan': 'plannedProgress',
            'prog. plan': 'plannedProgress',
            'planned progress': 'plannedProgress',
            '% real': 'actualProgress',
            'prog. real': 'actualProgress',
            'actual progress': 'actualProgress',
            '% concluído': 'actualProgress',
            'caminho crítico': 'isCriticalPath',
            'critical': 'isCriticalPath',
            'peso': 'weight',
            'weight': 'weight',
        };
        return columnMap[normalized] || null;
    }
    deriveLevelFromCode(code) {
        const parts = code.split('.').filter((p) => p.length > 0);
        return Math.max(0, parts.length - 1);
    }
    deriveParentCode(code) {
        const parts = code.split('.').filter((p) => p.length > 0);
        if (parts.length <= 1)
            return null;
        return parts.slice(0, -1).join('.');
    }
    async importBatch(projectId, buffer, mimetype) {
        const project = await this.prisma.project.findUnique({
            where: { id: projectId },
            select: { id: true },
        });
        if (!project) {
            throw new common_1.NotFoundException(`Projeto com ID "${projectId}" não encontrado`);
        }
        let workbook;
        try {
            workbook = xlsx.read(buffer, { type: 'buffer', cellDates: true });
        }
        catch (err) {
            throw new common_1.BadRequestException('Arquivo inválido ou corrompido');
        }
        if (workbook.SheetNames.length === 0) {
            throw new common_1.BadRequestException('Arquivo vazio');
        }
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
        if (rows.length === 0) {
            throw new common_1.BadRequestException('Planilha vazia');
        }
        const sampleRow = rows[0];
        const columnMap = new Map();
        for (const colName of Object.keys(sampleRow)) {
            const normalized = this.normalizeColumnName(colName);
            const mapped = this.mapColumnName(normalized);
            if (mapped) {
                columnMap.set(colName, mapped);
            }
        }
        const mappedFields = new Set(columnMap.values());
        const requiredFields = ['code', 'name', 'startDate', 'endDate'];
        const missingFields = requiredFields.filter((f) => !mappedFields.has(f));
        if (missingFields.length > 0) {
            throw new common_1.BadRequestException(`Colunas obrigatórias não encontradas: ${missingFields.join(', ')}`);
        }
        const errors = [];
        const importedItems = [];
        for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
            const row = rows[rowIdx];
            const mappedRow = {};
            for (const [colName, fieldName] of columnMap.entries()) {
                mappedRow[fieldName] = row[colName];
            }
            const code = String(mappedRow['code'] || '').trim();
            const name = String(mappedRow['name'] || '').trim();
            const startDateRaw = mappedRow['startDate'];
            const endDateRaw = mappedRow['endDate'];
            if (!code || !name) {
                errors.push(`Linha ${rowIdx + 2}: código ou nome vazio`);
                continue;
            }
            let startDate;
            let endDate;
            try {
                if (startDateRaw instanceof Date) {
                    startDate = startDateRaw;
                }
                else if (typeof startDateRaw === 'string' || typeof startDateRaw === 'number') {
                    startDate = new Date(startDateRaw);
                }
                else {
                    throw new Error('Data inválida');
                }
                if (isNaN(startDate.getTime())) {
                    throw new Error('Data inválida');
                }
                if (endDateRaw instanceof Date) {
                    endDate = endDateRaw;
                }
                else if (typeof endDateRaw === 'string' || typeof endDateRaw === 'number') {
                    endDate = new Date(endDateRaw);
                }
                else {
                    throw new Error('Data inválida');
                }
                if (isNaN(endDate.getTime())) {
                    throw new Error('Data inválida');
                }
            }
            catch (err) {
                errors.push(`Linha ${rowIdx + 2}: data inválida`);
                continue;
            }
            let durationDays = 0;
            if (mappedRow['durationDays']) {
                const dur = Number(mappedRow['durationDays']);
                if (!isNaN(dur)) {
                    durationDays = Math.max(0, Math.floor(dur));
                }
            }
            if (durationDays === 0) {
                const diffMs = endDate.getTime() - startDate.getTime();
                durationDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
            }
            const level = mappedRow['level']
                ? Number(mappedRow['level'])
                : this.deriveLevelFromCode(code);
            const plannedProgress = Math.max(0, Math.min(100, Number(mappedRow['plannedProgress'] || 0)));
            const actualProgress = Math.max(0, Math.min(100, Number(mappedRow['actualProgress'] || 0)));
            const weight = Math.max(0.01, Number(mappedRow['weight'] || 1));
            const isCriticalPath = Boolean(mappedRow['isCriticalPath']);
            const parentCode = this.deriveParentCode(code);
            importedItems.push({
                code,
                name,
                level: Math.max(0, level),
                parentCode,
                startDate,
                endDate,
                durationDays,
                plannedProgress,
                actualProgress,
                isCriticalPath,
                weight,
            });
        }
        await this.prisma.scheduleItem.deleteMany({ where: { projectId } });
        importedItems.sort((a, b) => a.level - b.level);
        const codeToIdMap = new Map();
        let createdCount = 0;
        for (const item of importedItems) {
            try {
                let parentId = null;
                if (item.parentCode) {
                    parentId = codeToIdMap.get(item.parentCode) || null;
                }
                const created = await this.prisma.scheduleItem.create({
                    data: {
                        projectId,
                        code: item.code,
                        name: item.name,
                        level: item.level,
                        parentId,
                        startDate: item.startDate,
                        endDate: item.endDate,
                        durationDays: item.durationDays,
                        plannedProgress: new client_1.Prisma.Decimal(item.plannedProgress),
                        actualProgress: new client_1.Prisma.Decimal(item.actualProgress),
                        isCriticalPath: item.isCriticalPath,
                        weight: new client_1.Prisma.Decimal(item.weight),
                        order: createdCount,
                    },
                });
                codeToIdMap.set(item.code, created.id);
                createdCount++;
            }
            catch (err) {
                errors.push(`Linha com código "${item.code}": falha ao criar (${String(err).slice(0, 50)})`);
            }
        }
        return {
            imported: createdCount,
            skipped: importedItems.length - createdCount,
            errors,
        };
    }
};
exports.ScheduleService = ScheduleService;
exports.ScheduleService = ScheduleService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ScheduleService);
//# sourceMappingURL=schedule.service.js.map