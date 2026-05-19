"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const common_1 = require("@nestjs/common");
const dashboard_service_1 = require("./dashboard.service");
const prisma_service_1 = require("../common/prisma.service");
const mockPrismaService = {
    project: {
        findUnique: jest.fn(),
    },
    scheduleItem: {
        findMany: jest.fn(),
    },
    weeklyPlan: {
        findFirst: jest.fn(),
    },
    restriction: {
        count: jest.fn(),
        findMany: jest.fn(),
    },
};
describe('DashboardService', () => {
    let service;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                dashboard_service_1.DashboardService,
                { provide: prisma_service_1.PrismaService, useValue: mockPrismaService },
            ],
        }).compile();
        service = module.get(dashboard_service_1.DashboardService);
        jest.clearAllMocks();
    });
    describe('getKPIs', () => {
        it('should throw NotFoundException when project not found', async () => {
            mockPrismaService.project.findUnique.mockResolvedValue(null);
            await expect(service.getKPIs('bad-project')).rejects.toThrow(common_1.NotFoundException);
        });
        it('should return spi=1 when plannedProgress is 0 (no leaf items with weight)', async () => {
            const projectId = 'project-1';
            mockPrismaService.project.findUnique.mockResolvedValue({
                id: projectId,
                startDate: new Date('2025-01-01'),
                endDate: new Date('2025-06-30'),
            });
            mockPrismaService.scheduleItem.findMany.mockResolvedValue([
                {
                    plannedProgress: 50,
                    actualProgress: 30,
                    weight: 1,
                    endDate: new Date('2025-06-30'),
                    _count: { children: 2 },
                },
            ]);
            mockPrismaService.restriction.count.mockResolvedValue(0);
            mockPrismaService.weeklyPlan.findFirst.mockResolvedValue(null);
            const result = await service.getKPIs(projectId);
            expect(result.spi).toBe(1);
            expect(result.overallProgress).toBe(0);
            expect(result.plannedProgress).toBe(0);
        });
        it('should correctly calculate overallProgress and spi from leaf items', async () => {
            const projectId = 'project-1';
            mockPrismaService.project.findUnique.mockResolvedValue({
                id: projectId,
                startDate: new Date('2025-01-01'),
                endDate: new Date('2025-06-30'),
            });
            mockPrismaService.scheduleItem.findMany.mockResolvedValue([
                {
                    actualProgress: 60,
                    plannedProgress: 80,
                    weight: 1,
                    endDate: new Date('2024-12-31'),
                    _count: { children: 0 },
                },
                {
                    actualProgress: 40,
                    plannedProgress: 60,
                    weight: 1,
                    endDate: new Date('2025-12-31'),
                    _count: { children: 0 },
                },
            ]);
            mockPrismaService.restriction.count.mockResolvedValue(3);
            mockPrismaService.weeklyPlan.findFirst.mockResolvedValue(null);
            const result = await service.getKPIs(projectId);
            expect(result.overallProgress).toBe(50);
            expect(result.plannedProgress).toBe(70);
            expect(result.spi).toBeCloseTo(0.714, 2);
            expect(result.pendingRestrictions).toBe(3);
            expect(result.totalActivities).toBe(2);
        });
        it('should return ppcCurrent from most recent WeeklyPlan', async () => {
            const projectId = 'project-1';
            mockPrismaService.project.findUnique.mockResolvedValue({
                id: projectId,
                startDate: new Date('2025-01-01'),
                endDate: new Date('2025-06-30'),
            });
            mockPrismaService.scheduleItem.findMany.mockResolvedValue([]);
            mockPrismaService.restriction.count.mockResolvedValue(0);
            mockPrismaService.weeklyPlan.findFirst.mockResolvedValue({
                ppcActual: 85,
                ppcForecast: 90,
            });
            const result = await service.getKPIs(projectId);
            expect(result.ppcCurrent).toBe(85);
            expect(result.ppcForecast).toBe(90);
        });
        it('should return ppcCurrent=null when no WeeklyPlan exists', async () => {
            const projectId = 'project-1';
            mockPrismaService.project.findUnique.mockResolvedValue({
                id: projectId,
                startDate: new Date('2025-01-01'),
                endDate: new Date('2025-06-30'),
            });
            mockPrismaService.scheduleItem.findMany.mockResolvedValue([]);
            mockPrismaService.restriction.count.mockResolvedValue(0);
            mockPrismaService.weeklyPlan.findFirst.mockResolvedValue(null);
            const result = await service.getKPIs(projectId);
            expect(result.ppcCurrent).toBeNull();
            expect(result.ppcForecast).toBeNull();
        });
    });
    describe('getDelays', () => {
        it('should throw NotFoundException when project not found', async () => {
            mockPrismaService.project.findUnique.mockResolvedValue(null);
            await expect(service.getDelays('bad-project')).rejects.toThrow(common_1.NotFoundException);
        });
        it('should return items where actualProgress < plannedProgress, sorted by gap DESC', async () => {
            const projectId = 'project-1';
            const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            mockPrismaService.project.findUnique.mockResolvedValue({ id: projectId });
            mockPrismaService.scheduleItem.findMany.mockResolvedValue([
                {
                    id: 'item-1',
                    code: '1.1',
                    name: 'Delayed Small',
                    plannedProgress: 50,
                    actualProgress: 40,
                    endDate: pastDate,
                },
                {
                    id: 'item-2',
                    code: '1.2',
                    name: 'On Track',
                    plannedProgress: 30,
                    actualProgress: 30,
                    endDate: futureDate,
                },
                {
                    id: 'item-3',
                    code: '1.3',
                    name: 'Delayed Large',
                    plannedProgress: 80,
                    actualProgress: 50,
                    endDate: pastDate,
                },
            ]);
            const result = await service.getDelays(projectId);
            expect(result).toHaveLength(2);
            expect(result[0].id).toBe('item-3');
            expect(result[0].gap).toBe(30);
            expect(result[1].id).toBe('item-1');
            expect(result[1].gap).toBe(10);
            expect(result[0]).toHaveProperty('daysOverdue');
            expect(result[0].daysOverdue).toBeGreaterThan(0);
            expect(result[0].endDate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        });
        it('should limit to top 10 delayed items', async () => {
            const projectId = 'project-1';
            const pastDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const items = Array.from({ length: 15 }, (_, i) => ({
                id: `item-${i}`,
                code: `1.${i}`,
                name: `Task ${i}`,
                plannedProgress: 100,
                actualProgress: i,
                endDate: pastDate,
            }));
            mockPrismaService.project.findUnique.mockResolvedValue({ id: projectId });
            mockPrismaService.scheduleItem.findMany.mockResolvedValue(items);
            const result = await service.getDelays(projectId);
            expect(result.length).toBeLessThanOrEqual(10);
        });
    });
    describe('getPendingRestrictions', () => {
        it('should throw NotFoundException when project not found', async () => {
            mockPrismaService.project.findUnique.mockResolvedValue(null);
            await expect(service.getPendingRestrictions('bad-project')).rejects.toThrow(common_1.NotFoundException);
        });
        it('should return only PENDING and IN_ANALYSIS restrictions', async () => {
            const projectId = 'project-1';
            const mockRestrictions = [
                {
                    id: 'r1',
                    status: 'PENDING',
                    description: 'Missing materials',
                    dueDate: new Date('2025-02-01'),
                    weeklyPlan: { id: 'wp1', projectId },
                },
                {
                    id: 'r2',
                    status: 'IN_ANALYSIS',
                    description: 'Pending approval',
                    dueDate: new Date('2025-02-15'),
                    weeklyPlan: { id: 'wp1', projectId },
                },
            ];
            mockPrismaService.project.findUnique.mockResolvedValue({ id: projectId });
            mockPrismaService.restriction.findMany.mockResolvedValue(mockRestrictions);
            const result = await service.getPendingRestrictions(projectId);
            expect(result).toEqual(mockRestrictions);
            expect(mockPrismaService.restriction.findMany).toHaveBeenCalledWith(expect.objectContaining({
                where: expect.objectContaining({
                    status: { in: ['PENDING', 'IN_ANALYSIS'] },
                }),
            }));
        });
    });
    describe('getSPIHistory', () => {
        it('should throw NotFoundException when project not found', async () => {
            mockPrismaService.project.findUnique.mockResolvedValue(null);
            await expect(service.getSPIHistory('bad-project')).rejects.toThrow(common_1.NotFoundException);
        });
        it('should return empty array when there are no leaf items', async () => {
            const projectId = 'project-1';
            mockPrismaService.project.findUnique.mockResolvedValue({
                id: projectId,
                startDate: new Date('2025-01-01'),
                endDate: new Date('2025-06-30'),
            });
            mockPrismaService.scheduleItem.findMany.mockResolvedValue([
                {
                    startDate: new Date('2025-01-01'),
                    endDate: new Date('2025-06-30'),
                    plannedProgress: 50,
                    actualProgress: 30,
                    weight: 1,
                    _count: { children: 2 },
                },
            ]);
            const result = await service.getSPIHistory(projectId);
            expect(result).toEqual([]);
        });
        it('should return array of SPIPoint objects with { month, planned, actual, spi }', async () => {
            const projectId = 'project-1';
            const startDate = new Date('2025-01-15T12:00:00Z');
            mockPrismaService.project.findUnique.mockResolvedValue({
                id: projectId,
                startDate,
                endDate: new Date('2025-06-15T12:00:00Z'),
            });
            mockPrismaService.scheduleItem.findMany.mockResolvedValue([
                {
                    startDate: new Date('2025-01-15T12:00:00Z'),
                    endDate: new Date('2025-03-15T12:00:00Z'),
                    plannedProgress: 100,
                    actualProgress: 80,
                    weight: 1,
                    _count: { children: 0 },
                },
            ]);
            const result = await service.getSPIHistory(projectId);
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);
            for (const point of result) {
                expect(point).toHaveProperty('month');
                expect(point).toHaveProperty('planned');
                expect(point).toHaveProperty('actual');
                expect(point).toHaveProperty('spi');
                expect(typeof point.month).toBe('string');
                expect(typeof point.planned).toBe('number');
                expect(typeof point.actual).toBe('number');
                expect(typeof point.spi).toBe('number');
            }
            expect(result[0].month).toBe('Jan/25');
            for (const point of result) {
                expect(point.spi).toBeGreaterThanOrEqual(0);
                expect(point.planned).toBeGreaterThanOrEqual(0);
                expect(point.planned).toBeLessThanOrEqual(100);
                expect(point.actual).toBeGreaterThanOrEqual(0);
                expect(point.actual).toBeLessThanOrEqual(100);
            }
        });
        it('should compute spi=1 for months where cumulativePlanned is 0', async () => {
            const projectId = 'project-1';
            mockPrismaService.project.findUnique.mockResolvedValue({
                id: projectId,
                startDate: new Date('2025-01-15T12:00:00Z'),
                endDate: new Date('2025-06-15T12:00:00Z'),
            });
            mockPrismaService.scheduleItem.findMany.mockResolvedValue([
                {
                    startDate: new Date('2025-03-15T12:00:00Z'),
                    endDate: new Date('2025-03-28T12:00:00Z'),
                    plannedProgress: 100,
                    actualProgress: 100,
                    weight: 1,
                    _count: { children: 0 },
                },
            ]);
            const result = await service.getSPIHistory(projectId);
            const jan = result.find((p) => p.month === 'Jan/25');
            const feb = result.find((p) => p.month === 'Fev/25');
            if (jan)
                expect(jan.spi).toBe(1);
            if (feb)
                expect(feb.spi).toBe(1);
        });
    });
});
//# sourceMappingURL=dashboard.service.spec.js.map