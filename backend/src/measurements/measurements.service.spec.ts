import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MeasurementsService } from './measurements.service';
import { PrismaService } from '../common/prisma.service';

describe('MeasurementsService', () => {
  let service: MeasurementsService;
  let prisma: {
    unit: { findUnique: jest.Mock };
    activityType: { findUnique: jest.Mock; findMany: jest.Mock };
    measurement: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const UNIT_ID = 'unit-uuid';
  const USER_ID = 'user-uuid';
  const ACTIVITY_TYPE_ID = 'activity-type-uuid';
  const MEASUREMENT_ID = 'measurement-uuid';

  beforeEach(async () => {
    prisma = {
      unit: { findUnique: jest.fn() },
      activityType: { findUnique: jest.fn(), findMany: jest.fn() },
      measurement: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeasurementsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<MeasurementsService>(MeasurementsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // findByUnit
  // ---------------------------------------------------------------------------
  describe('findByUnit', () => {
    it('should throw NotFoundException when unit does not exist', async () => {
      prisma.unit.findUnique.mockResolvedValue(null);

      await expect(service.findByUnit(UNIT_ID)).rejects.toThrow(
        new NotFoundException(`Unidade com ID "${UNIT_ID}" não encontrada`),
      );
      expect(prisma.measurement.findMany).not.toHaveBeenCalled();
    });

    it('should return measurements array ordered desc when unit exists', async () => {
      prisma.unit.findUnique.mockResolvedValue({ id: UNIT_ID });
      const measurements = [
        { id: 'm2', date: new Date('2024-02-01'), percentComplete: 80 },
        { id: 'm1', date: new Date('2024-01-01'), percentComplete: 40 },
      ];
      prisma.measurement.findMany.mockResolvedValue(measurements);

      const result = await service.findByUnit(UNIT_ID);

      expect(prisma.measurement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { unitId: UNIT_ID },
          orderBy: { date: 'desc' },
        }),
      );
      expect(result).toEqual(measurements);
    });
  });

  // ---------------------------------------------------------------------------
  // create – PERCENT method
  // ---------------------------------------------------------------------------
  describe('create with PERCENT method', () => {
    const percentActivityType = {
      id: ACTIVITY_TYPE_ID,
      measurementMethod: 'PERCENT',
      defaultQuantity: null,
    };

    it('should throw NotFoundException when unit not found', async () => {
      prisma.unit.findUnique.mockResolvedValue(null);

      await expect(
        service.create(UNIT_ID, USER_ID, {
          activityTypeId: ACTIVITY_TYPE_ID,
          percentComplete: 60,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when activityType not found', async () => {
      prisma.unit.findUnique.mockResolvedValue({ id: UNIT_ID });
      prisma.activityType.findUnique.mockResolvedValue(null);

      await expect(
        service.create(UNIT_ID, USER_ID, {
          activityTypeId: ACTIVITY_TYPE_ID,
          percentComplete: 60,
        }),
      ).rejects.toThrow(
        new NotFoundException(
          `Tipo de atividade com ID "${ACTIVITY_TYPE_ID}" não encontrado`,
        ),
      );
    });

    it('should use dto.percentComplete directly for PERCENT method', async () => {
      prisma.unit.findUnique.mockResolvedValue({ id: UNIT_ID });
      prisma.activityType.findUnique.mockResolvedValue(percentActivityType);
      const createdMeasurement = { id: MEASUREMENT_ID, percentComplete: 75 };
      prisma.measurement.create.mockResolvedValue(createdMeasurement);

      const result = await service.create(UNIT_ID, USER_ID, {
        activityTypeId: ACTIVITY_TYPE_ID,
        percentComplete: 75,
      });

      expect(result).toEqual(createdMeasurement);
    });

    it('should call prisma.measurement.create with correct percentComplete', async () => {
      prisma.unit.findUnique.mockResolvedValue({ id: UNIT_ID });
      prisma.activityType.findUnique.mockResolvedValue(percentActivityType);
      prisma.measurement.create.mockResolvedValue({});

      await service.create(UNIT_ID, USER_ID, {
        activityTypeId: ACTIVITY_TYPE_ID,
        percentComplete: 55,
      });

      expect(prisma.measurement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            percentComplete: 55,
            unitId: UNIT_ID,
            measuredById: USER_ID,
            activityTypeId: ACTIVITY_TYPE_ID,
          }),
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // create – METRIC method
  // ---------------------------------------------------------------------------
  describe('create with METRIC method', () => {
    const metricActivityType = {
      id: ACTIVITY_TYPE_ID,
      measurementMethod: 'METRIC',
      defaultQuantity: null,
    };

    it('should calculate percentComplete = (executedQty / totalQty) * 100', async () => {
      prisma.unit.findUnique.mockResolvedValue({ id: UNIT_ID });
      prisma.activityType.findUnique.mockResolvedValue(metricActivityType);
      prisma.measurement.create.mockResolvedValue({});

      await service.create(UNIT_ID, USER_ID, {
        activityTypeId: ACTIVITY_TYPE_ID,
        executedQty: 50,
        totalQty: 100,
      });

      expect(prisma.measurement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ percentComplete: 50 }),
        }),
      );
    });

    it('should cap percentComplete at 100 when executedQty > totalQty', async () => {
      prisma.unit.findUnique.mockResolvedValue({ id: UNIT_ID });
      prisma.activityType.findUnique.mockResolvedValue(metricActivityType);
      prisma.measurement.create.mockResolvedValue({});

      await service.create(UNIT_ID, USER_ID, {
        activityTypeId: ACTIVITY_TYPE_ID,
        executedQty: 150,
        totalQty: 100,
      });

      expect(prisma.measurement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ percentComplete: 100 }),
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // create – METRIC method with no totalQty in dto (falls back to defaultQuantity)
  // ---------------------------------------------------------------------------
  describe('create with METRIC method and no totalQty in dto', () => {
    it('should fall back to activityType.defaultQuantity', async () => {
      const activityTypeWithDefault = {
        id: ACTIVITY_TYPE_ID,
        measurementMethod: 'METRIC',
        defaultQuantity: 100,
      };
      prisma.unit.findUnique.mockResolvedValue({ id: UNIT_ID });
      prisma.activityType.findUnique.mockResolvedValue(activityTypeWithDefault);
      prisma.measurement.create.mockResolvedValue({});

      await service.create(UNIT_ID, USER_ID, {
        activityTypeId: ACTIVITY_TYPE_ID,
        executedQty: 75,
        // totalQty not provided → falls back to defaultQuantity=100
      });

      // percentComplete = (75 / 100) * 100 = 75
      expect(prisma.measurement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ percentComplete: 75 }),
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------
  describe('update', () => {
    it('should throw NotFoundException when measurement not found', async () => {
      prisma.measurement.findUnique.mockResolvedValue(null);

      await expect(
        service.update(MEASUREMENT_ID, { executedQty: 60 }),
      ).rejects.toThrow(
        new NotFoundException(`Medição com ID "${MEASUREMENT_ID}" não encontrada`),
      );
      expect(prisma.measurement.update).not.toHaveBeenCalled();
    });

    it('should recalculate percentComplete for METRIC method based on new executedQty', async () => {
      const existingMeasurement = {
        id: MEASUREMENT_ID,
        executedQty: 30,
        totalQty: 100,
        activityType: {
          measurementMethod: 'METRIC',
          defaultQuantity: null,
        },
      };
      prisma.measurement.findUnique.mockResolvedValue(existingMeasurement);
      prisma.measurement.update.mockResolvedValue({
        id: MEASUREMENT_ID,
        percentComplete: 60,
      });

      await service.update(MEASUREMENT_ID, { executedQty: 60 });

      // percentComplete = (60 / 100) * 100 = 60
      expect(prisma.measurement.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: MEASUREMENT_ID },
          data: expect.objectContaining({ percentComplete: 60, executedQty: 60 }),
        }),
      );
    });

    it('should not overwrite percentComplete for PERCENT method when no qty provided', async () => {
      const existingMeasurement = {
        id: MEASUREMENT_ID,
        executedQty: null,
        totalQty: null,
        activityType: {
          measurementMethod: 'PERCENT',
          defaultQuantity: null,
        },
      };
      prisma.measurement.findUnique.mockResolvedValue(existingMeasurement);
      prisma.measurement.update.mockResolvedValue({});

      await service.update(MEASUREMENT_ID, { percentComplete: 90 });

      expect(prisma.measurement.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ percentComplete: 90 }),
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // batchCreate
  // ---------------------------------------------------------------------------
  describe('batchCreate', () => {
    it('should throw NotFoundException when unit not found', async () => {
      prisma.unit.findUnique.mockResolvedValue(null);

      await expect(
        service.batchCreate(UNIT_ID, USER_ID, {
          measurements: [{ activityTypeId: ACTIVITY_TYPE_ID, percentComplete: 50 }],
        }),
      ).rejects.toThrow(
        new NotFoundException(`Unidade com ID "${UNIT_ID}" não encontrada`),
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should call prisma.$transaction with array of creates', async () => {
      prisma.unit.findUnique.mockResolvedValue({ id: UNIT_ID });

      const activityTypes = [
        { id: ACTIVITY_TYPE_ID, measurementMethod: 'PERCENT', defaultQuantity: null },
      ];
      prisma.activityType.findMany.mockResolvedValue(activityTypes);

      const batchResults = [{ id: 'm1', percentComplete: 40 }];
      prisma.$transaction.mockResolvedValue(batchResults);

      const result = await service.batchCreate(UNIT_ID, USER_ID, {
        measurements: [{ activityTypeId: ACTIVITY_TYPE_ID, percentComplete: 40 }],
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      // $transaction receives an array of Prisma promises
      const transactionArg = prisma.$transaction.mock.calls[0][0];
      expect(Array.isArray(transactionArg)).toBe(true);
      expect(transactionArg).toHaveLength(1);
      expect(result).toEqual(batchResults);
    });

    it('should calculate percentComplete for METRIC items in batch', async () => {
      prisma.unit.findUnique.mockResolvedValue({ id: UNIT_ID });

      const activityTypes = [
        { id: ACTIVITY_TYPE_ID, measurementMethod: 'METRIC', defaultQuantity: null },
      ];
      prisma.activityType.findMany.mockResolvedValue(activityTypes);
      prisma.$transaction.mockResolvedValue([{ id: 'm1', percentComplete: 50 }]);

      // Spy on measurement.create to verify it was called with computed %
      const createSpy = jest.spyOn(prisma.measurement, 'create');

      await service.batchCreate(UNIT_ID, USER_ID, {
        measurements: [
          { activityTypeId: ACTIVITY_TYPE_ID, executedQty: 50, totalQty: 100 },
        ],
      });

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ percentComplete: 50 }),
        }),
      );
    });
  });
});
