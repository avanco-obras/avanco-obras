import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { PrismaService } from '../common/prisma.service';

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
  let service: ScheduleService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScheduleService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ScheduleService>(ScheduleService);
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // findAll
  // ---------------------------------------------------------------------------
  describe('findAll', () => {
    it('should throw NotFoundException when project not found', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.findAll('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
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

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------
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

      await expect(service.create('bad-project', baseDto)).rejects.toThrow(
        NotFoundException,
      );
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
      // No findFirst call expected when order is provided explicitly via dto
      mockPrismaService.scheduleItem.findFirst.mockResolvedValue(null);
      mockPrismaService.scheduleItem.create.mockResolvedValue(createdItem);

      const result = await service.create(projectId, baseDto);

      expect(result).toEqual(createdItem);
      expect(mockPrismaService.scheduleItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            projectId,
            code: '1.1',
            name: 'New Task',
            level: 0,
            parentId: null,
            activityTypeId: null,
          }),
          include: { activityType: true },
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------
  describe('update', () => {
    it('should throw NotFoundException when item not found', async () => {
      mockPrismaService.scheduleItem.findUnique.mockResolvedValue(null);

      await expect(
        service.update('non-existent-id', { name: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
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
      expect(mockPrismaService.scheduleItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id },
          data: expect.objectContaining({ name: 'Updated Task' }),
          include: { activityType: true },
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // delete (remove)
  // ---------------------------------------------------------------------------
  describe('delete', () => {
    it('should throw NotFoundException when item not found', async () => {
      mockPrismaService.scheduleItem.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
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

  // ---------------------------------------------------------------------------
  // getGanttData
  // ---------------------------------------------------------------------------
  describe('getGanttData', () => {
    it('should throw NotFoundException when project not found', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.getGanttData('bad-project')).rejects.toThrow(
        NotFoundException,
      );
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

      // Rows should be ordered by the order field (findMany returns them in order)
      expect(result[0].id).toBe('p1');
      expect(result[1].id).toBe('c1');
      expect(result[2].id).toBe('c2');

      // Parent should have hasChildren: true
      expect(result[0].hasChildren).toBe(true);

      // Children should have hasChildren: false
      expect(result[1].hasChildren).toBe(false);
      expect(result[2].hasChildren).toBe(false);

      // Verify GanttRow shape for parent
      expect(result[0]).toMatchObject({
        id: 'p1',
        code: '1',
        name: 'Parent Task',
        level: 0,
        hasChildren: true,
        order: 0,
      });

      // parentId should be undefined for root item (not null)
      expect(result[0].parentId).toBeUndefined();

      // Children should carry parentId
      expect(result[1].parentId).toBe('p1');
      expect(result[2].parentId).toBe('p1');
    });
  });

  // ---------------------------------------------------------------------------
  // getCurvaS
  // ---------------------------------------------------------------------------
  describe('getCurvaS', () => {
    it('should throw NotFoundException when project not found', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.getCurvaS('bad-project')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return array of CurvaSPoint objects with label, date, planned, actual fields', async () => {
      const projectId = 'project-1';

      // Two leaf items spanning Jan–Jun 2025
      // Use noon UTC to avoid local-timezone date shifts
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

      // Should return an array with at least one point
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      // Every point should have the required fields
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

      // The date strings should follow the YYYY-MM-DD format
      expect(result[0].date).toMatch(/^\d{4}-\d{2}-01$/);

      // Values should be cumulative and within 0–100
      for (const point of result) {
        expect(point.planned).toBeGreaterThanOrEqual(0);
        expect(point.planned).toBeLessThanOrEqual(100);
        expect(point.actual).toBeGreaterThanOrEqual(0);
        expect(point.actual).toBeLessThanOrEqual(100);
      }

      // The first month label should be Jan/25
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
