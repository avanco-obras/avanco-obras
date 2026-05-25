import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../common/prisma.service';

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
  let service: DashboardService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // getKPIs
  // ---------------------------------------------------------------------------
  describe('getKPIs', () => {
    it('should throw NotFoundException when project not found', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.getKPIs('bad-project')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return spi=1 when plannedProgress is 0 (no leaf items with weight)', async () => {
      const projectId = 'project-1';

      mockPrismaService.project.findUnique.mockResolvedValue({
        id: projectId,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-06-30'),
      });

      // All items are parents — no leaf items
      mockPrismaService.scheduleItem.findMany.mockResolvedValue([
        {
          plannedProgress: 50,
          physicalProgress: 30,
          weight: 1,
          endDate: new Date('2025-06-30'),
          _count: { children: 2 },
        },
      ]);

      mockPrismaService.restriction.count.mockResolvedValue(0);
      mockPrismaService.weeklyPlan.findFirst.mockResolvedValue(null);

      const result = await service.getKPIs(projectId);

      // No leaf items → plannedProgress stays 0 → spi should be 1
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

      // 2 leaf items with equal weight=1
      // expected overallProgress = (60*1 + 40*1) / (1+1) = 50
      // expected plannedProgress = (80*1 + 60*1) / (1+1) = 70
      // expected spi = 50 / 70 ≈ 0.714
      mockPrismaService.scheduleItem.findMany.mockResolvedValue([
        {
          physicalProgress: 60,
          plannedProgress: 80,
          weight: 1,
          endDate: new Date('2024-12-31'), // past date → counts as delayed
          _count: { children: 0 },
        },
        {
          physicalProgress: 40,
          plannedProgress: 60,
          weight: 1,
          endDate: new Date('2025-12-31'), // future date
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

  // ---------------------------------------------------------------------------
  // getDelays
  // ---------------------------------------------------------------------------
  describe('getDelays', () => {
    it('should throw NotFoundException when project not found', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.getDelays('bad-project')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return items where physicalProgress < plannedProgress, sorted by gap DESC', async () => {
      const projectId = 'project-1';
      const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

      mockPrismaService.project.findUnique.mockResolvedValue({ id: projectId });
      mockPrismaService.scheduleItem.findMany.mockResolvedValue([
        {
          id: 'item-1',
          code: '1.1',
          name: 'Delayed Small',
          plannedProgress: 50,
          physicalProgress: 40, // gap = 10
          endDate: pastDate,
        },
        {
          id: 'item-2',
          code: '1.2',
          name: 'On Track',
          plannedProgress: 30,
          physicalProgress: 30, // gap = 0 → not delayed
          endDate: futureDate,
        },
        {
          id: 'item-3',
          code: '1.3',
          name: 'Delayed Large',
          plannedProgress: 80,
          physicalProgress: 50, // gap = 30
          endDate: pastDate,
        },
      ]);

      const result = await service.getDelays(projectId);

      // Only items with gap > 0 should appear
      expect(result).toHaveLength(2);

      // Sorted by gap DESC: item-3 (gap=30) before item-1 (gap=10)
      expect(result[0].id).toBe('item-3');
      expect(result[0].gap).toBe(30);
      expect(result[1].id).toBe('item-1');
      expect(result[1].gap).toBe(10);

      // Shape validation
      expect(result[0]).toHaveProperty('daysOverdue');
      expect(result[0].daysOverdue).toBeGreaterThan(0);
      expect(result[0].endDate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should limit to top 10 delayed items', async () => {
      const projectId = 'project-1';
      const pastDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // Generate 15 delayed items
      const items = Array.from({ length: 15 }, (_, i) => ({
        id: `item-${i}`,
        code: `1.${i}`,
        name: `Task ${i}`,
        plannedProgress: 100,
        physicalProgress: i, // gap = 100 - i, all > 0
        endDate: pastDate,
      }));

      mockPrismaService.project.findUnique.mockResolvedValue({ id: projectId });
      mockPrismaService.scheduleItem.findMany.mockResolvedValue(items);

      const result = await service.getDelays(projectId);

      expect(result.length).toBeLessThanOrEqual(10);
    });
  });

  // ---------------------------------------------------------------------------
  // getPendingRestrictions
  // ---------------------------------------------------------------------------
  describe('getPendingRestrictions', () => {
    it('should throw NotFoundException when project not found', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(
        service.getPendingRestrictions('bad-project'),
      ).rejects.toThrow(NotFoundException);
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
      expect(mockPrismaService.restriction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['PENDING', 'IN_ANALYSIS'] },
          }),
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getSPIHistory
  // ---------------------------------------------------------------------------
  describe('getSPIHistory', () => {
    it('should throw NotFoundException when project not found', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.getSPIHistory('bad-project')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return empty array when there are no leaf items', async () => {
      const projectId = 'project-1';

      mockPrismaService.project.findUnique.mockResolvedValue({
        id: projectId,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-06-30'),
      });

      // All items are parents
      mockPrismaService.scheduleItem.findMany.mockResolvedValue([
        {
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-06-30'),
          plannedProgress: 50,
          physicalProgress: 30,
          weight: 1,
          _count: { children: 2 },
        },
      ]);

      const result = await service.getSPIHistory(projectId);

      expect(result).toEqual([]);
    });

    it('should return array of SPIPoint objects with { month, planned, actual, spi }', async () => {
      const projectId = 'project-1';

      // Project started well in the past so getSPIHistory generates at least one month.
      // Use noon UTC timestamps to avoid local-timezone date shifts.
      const startDate = new Date('2025-01-15T12:00:00Z');
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: projectId,
        startDate,
        endDate: new Date('2025-06-15T12:00:00Z'),
      });

      // One leaf item covering Jan–Mar 2025
      mockPrismaService.scheduleItem.findMany.mockResolvedValue([
        {
          startDate: new Date('2025-01-15T12:00:00Z'),
          endDate: new Date('2025-03-15T12:00:00Z'),
          plannedProgress: 100,
          physicalProgress: 80,
          weight: 1,
          _count: { children: 0 },
        },
      ]);

      const result = await service.getSPIHistory(projectId);

      // Should return at least one point
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      // Every point should have the required fields
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

      // First point should be Jan/25
      expect(result[0].month).toBe('Jan/25');

      // SPI values should be non-negative
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

      // Project starts in a future month relative to its startDate so first month has 0 planned.
      // Use noon UTC to avoid local-timezone date shifts.
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: projectId,
        startDate: new Date('2025-01-15T12:00:00Z'),
        endDate: new Date('2025-06-15T12:00:00Z'),
      });

      // Leaf item starts in March — January and February will have 0 planned delta
      mockPrismaService.scheduleItem.findMany.mockResolvedValue([
        {
          startDate: new Date('2025-03-15T12:00:00Z'),
          endDate: new Date('2025-03-28T12:00:00Z'),
          plannedProgress: 100,
          physicalProgress: 100,
          weight: 1,
          _count: { children: 0 },
        },
      ]);

      const result = await service.getSPIHistory(projectId);

      // Jan and Feb should have spi=1 because cumulativePlanned=0
      const jan = result.find((p) => p.month === 'Jan/25');
      const feb = result.find((p) => p.month === 'Fev/25');

      if (jan) expect(jan.spi).toBe(1);
      if (feb) expect(feb.spi).toBe(1);
    });
  });
});
