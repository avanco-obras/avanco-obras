"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const common_1 = require("@nestjs/common");
const schedule_service_1 = require("./schedule.service");
const prisma_service_1 = require("../common/prisma.service");
const mockPrismaService = {
    project: {
        findUnique: jest.fn(),
    },
    scheduleItem: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
    },
    activityType: {
        findUnique: jest.fn(),
    },
};
describe('ScheduleService', () => {
    let service;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                schedule_service_1.ScheduleService,
                { provide: prisma_service_1.PrismaService, useValue: mockPrismaService },
            ],
        }).compile();
        service = module.get(schedule_service_1.ScheduleService);
        jest.clearAllMocks();
    });
    describe('findAll', () => {
        it('should throw NotFoundException when project not found', async () => {
            mockPrismaService.project.findUnique.mockResolvedValue(null);
            await expect(service.findAll('non-existent-id')).rejects.toThrow(common_1.NotFoundException);
            expect(mockPrismaService.project.findUnique).toHaveBeenCalledWith({
                where: { id: 'non-existent-id' },
                select: { id: true },
            });
        });
        it('should return schedule items ordered by order when project exists', async () => {
            const projectId = 'project-1';
            const mockItems = [
                { id: 'item-1', name: 'Task A', order: 0, activityType: null },
                { id: 'item-2', name: 'Task B', order: 1, activityType: null },
            ];
            mockPrismaService.project.findUnique.mockResolvedValue({ id: projectId });
            mockPrismaService.scheduleItem.findMany.mockResolvedValue(mockItems);
            const result = await service.findAll(projectId);
            expect(result).toEqual(mockItems);
            expect(mockPrismaService.scheduleItem.findMany).toHaveBeenCalledWith({
                where: { projectId },
                include: { activityType: true },
                orderBy: { order: 'asc' },
            });
        });
    });
    describe('create', () => {
        const projectId = 'project-1';
        const baseDto = {
            code: '1.1',
            name: 'New Task',
            level: 0,
            startDate: '2025-01-01',
            endDate: '2025-03-31',
            durationDays: 89,
        };
        it('should throw NotFoundException when project not found', async () => {
            mockPrismaService.project.findUnique.mockResolvedValue(null);
            await expect(service.create('bad-project', baseDto)).rejects.toThrow(common_1.NotFoundException);
        });
        it('should create item with correct data when project exists and no parent', async () => {
            const createdItem = {
                id: 'new-item-id',
                projectId,
                parentId: null,
                activityTypeId: null,
                code: '1.1',
                name: 'New Task',
                level: 0,
                startDate: new Date('2025-01-01'),
                endDate: new Date('2025-03-31'),
                durationDays: 89,
                plannedProgress: 0,
                actualProgress: 0,
                weight: 1,
                isCriticalPath: false,
                order: 0,
                activityType: null,
            };
            mockPrismaService.project.findUnique.mockResolvedValue({ id: projectId });
            mockPrismaService.scheduleItem.findFirst.mockResolvedValue(null);
            mockPrismaService.scheduleItem.create.mockResolvedValue(createdItem);
            const result = await service.create(projectId, baseDto);
            expect(result).toEqual(createdItem);
            expect(mockPrismaService.scheduleItem.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    projectId,
                    code: '1.1',
                    name: 'New Task',
                    level: 0,
                    parentId: null,
                    activityTypeId: null,
                }),
                include: { activityType: true },
            }));
        });
    });
    describe('update', () => {
        it('should throw NotFoundException when item not found', async () => {
            mockPrismaService.scheduleItem.findUnique.mockResolvedValue(null);
            await expect(service.update('non-existent-id', { name: 'Updated' })).rejects.toThrow(common_1.NotFoundException);
        });
        it('should return updated item on success', async () => {
            const id = 'item-1';
            const updatedItem = {
                id,
                name: 'Updated Task',
                activityType: null,
            };
            mockPrismaService.scheduleItem.findUnique.mockResolvedValue({ id });
            mockPrismaService.scheduleItem.update.mockResolvedValue(updatedItem);
            const result = await service.update(id, { name: 'Updated Task' });
            expect(result).toEqual(updatedItem);
            expect(mockPrismaService.scheduleItem.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id },
                data: expect.objectContaining({ name: 'Updated Task' }),
                include: { activityType: true },
            }));
        });
    });
    describe('delete', () => {
        it('should throw NotFoundException when item not found', async () => {
            mockPrismaService.scheduleItem.findUnique.mockResolvedValue(null);
            await expect(service.remove('non-existent-id')).rejects.toThrow(common_1.NotFoundException);
        });
        it('should delete and return success message on success', async () => {
            const id = 'item-1';
            mockPrismaService.scheduleItem.findUnique.mockResolvedValue({ id });
            mockPrismaService.scheduleItem.delete.mockResolvedValue({ id });
            const result = await service.remove(id);
            expect(result).toEqual({ message: 'Item excluído com sucesso' });
            expect(mockPrismaService.scheduleItem.delete).toHaveBeenCalledWith({
                where: { id },
            });
        });
    });
    describe('getGanttData', () => {
        it('should throw NotFoundException when project not found', async () => {
            mockPrismaService.project.findUnique.mockResolvedValue(null);
            await expect(service.getGanttData('bad-project')).rejects.toThrow(common_1.NotFoundException);
        });
        it('should return GanttRow array with hasChildren correctly set', async () => {
            const projectId = 'project-1';
            const mockItems = [
                {
                    id: 'p1',
                    code: '1',
                    name: 'Parent Task',
                    level: 0,
                    parentId: null,
                    startDate: new Date('2025-01-01'),
                    endDate: new Date('2025-06-30'),
                    durationDays: 180,
                    plannedProgress: 50,
                    actualProgress: 40,
                    isCriticalPath: false,
                    order: 0,
                    _count: { children: 2 },
                },
                {
                    id: 'c1',
                    code: '1.1',
                    name: 'Child Task A',
                    level: 1,
                    parentId: 'p1',
                    startDate: new Date('2025-01-01'),
                    endDate: new Date('2025-03-31'),
                    durationDays: 89,
                    plannedProgress: 60,
                    actualProgress: 50,
                    isCriticalPath: false,
                    order: 1,
                    _count: { children: 0 },
                },
                {
                    id: 'c2',
                    code: '1.2',
                    name: 'Child Task B',
                    level: 1,
                    parentId: 'p1',
                    startDate: new Date('2025-04-01'),
                    endDate: new Date('2025-06-30'),
                    durationDays: 90,
                    plannedProgress: 40,
                    actualProgress: 30,
                    isCriticalPath: true,
                    order: 2,
                    _count: { children: 0 },
                },
            ];
            mockPrismaService.project.findUnique.mockResolvedValue({ id: projectId });
            mockPrismaService.scheduleItem.findMany.mockResolvedValue(mockItems);
            const result = await service.getGanttData(projectId);
            expect(result).toHaveLength(3);
            expect(result[0].id).toBe('p1');
            expect(result[1].id).toBe('c1');
            expect(result[2].id).toBe('c2');
            expect(result[0].hasChildren).toBe(true);
            expect(result[1].hasChildren).toBe(false);
            expect(result[2].hasChildren).toBe(false);
            expect(result[0]).toMatchObject({
                id: 'p1',
                code: '1',
                name: 'Parent Task',
                level: 0,
                hasChildren: true,
                order: 0,
            });
            expect(result[0].parentId).toBeUndefined();
            expect(result[1].parentId).toBe('p1');
            expect(result[2].parentId).toBe('p1');
        });
    });
    describe('getCurvaS', () => {
        it('should throw NotFoundException when project not found', async () => {
            mockPrismaService.project.findUnique.mockResolvedValue(null);
            await expect(service.getCurvaS('bad-project')).rejects.toThrow(common_1.NotFoundException);
        });
        it('should return array of CurvaSPoint objects with label, date, planned, actual fields', async () => {
            const projectId = 'project-1';
            const mockItems = [
                {
                    id: 'leaf-1',
                    startDate: new Date('2025-01-15T12:00:00Z'),
                    endDate: new Date('2025-03-15T12:00:00Z'),
                    plannedProgress: 100,
                    actualProgress: 80,
                    weight: 1,
                    _count: { children: 0 },
                },
                {
                    id: 'leaf-2',
                    startDate: new Date('2025-04-15T12:00:00Z'),
                    endDate: new Date('2025-06-15T12:00:00Z'),
                    plannedProgress: 60,
                    actualProgress: 40,
                    weight: 1,
                    _count: { children: 0 },
                },
            ];
            mockPrismaService.project.findUnique.mockResolvedValue({ id: projectId });
            mockPrismaService.scheduleItem.findMany.mockResolvedValue(mockItems);
            const result = await service.getCurvaS(projectId);
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);
            for (const point of result) {
                expect(point).toHaveProperty('label');
                expect(point).toHaveProperty('date');
                expect(point).toHaveProperty('planned');
                expect(point).toHaveProperty('actual');
                expect(typeof point.label).toBe('string');
                expect(typeof point.date).toBe('string');
                expect(typeof point.planned).toBe('number');
                expect(typeof point.actual).toBe('number');
            }
            expect(result[0].date).toMatch(/^\d{4}-\d{2}-01$/);
            for (const point of result) {
                expect(point.planned).toBeGreaterThanOrEqual(0);
                expect(point.planned).toBeLessThanOrEqual(100);
                expect(point.actual).toBeGreaterThanOrEqual(0);
                expect(point.actual).toBeLessThanOrEqual(100);
            }
            expect(result[0].label).toBe('Jan/25');
        });
        it('should return empty array when project has no schedule items', async () => {
            const projectId = 'project-empty';
            mockPrismaService.project.findUnique.mockResolvedValue({ id: projectId });
            mockPrismaService.scheduleItem.findMany.mockResolvedValue([]);
            const result = await service.getCurvaS(projectId);
            expect(result).toEqual([]);
        });
    });
});
//# sourceMappingURL=schedule.service.spec.js.map