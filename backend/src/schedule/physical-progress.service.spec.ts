import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PhysicalProgressService } from './physical-progress.service';
import { PrismaService } from '../common/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

type Row = {
  id: string;
  parentId: string | null;
  level: number;
  weight: number;
  physicalProgress: number;
};

const mockPrisma = {
  project: { findUnique: jest.fn() },
  projectBaseline: { findFirst: jest.fn() },
  projectReport: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
  scheduleItem: {
    findMany: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  scheduleDependency: { findMany: jest.fn(), deleteMany: jest.fn(), createMany: jest.fn() },
  measurement: { findMany: jest.fn(), deleteMany: jest.fn(), createMany: jest.fn() },
  $transaction: jest.fn(),
};

const mockRealtime = { emitScheduleChanged: jest.fn() };

describe('PhysicalProgressService', () => {
  let service: PhysicalProgressService;
  /** Atualizações efetivamente persistidas, na ordem em que foram montadas. */
  let persisted: Array<{ id: string; physicalProgress: number }>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PhysicalProgressService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RealtimeGateway, useValue: mockRealtime },
      ],
    }).compile();

    service = module.get(PhysicalProgressService);
    jest.clearAllMocks();

    persisted = [];
    mockPrisma.scheduleItem.update.mockImplementation((args: {
      where: { id: string };
      data: { physicalProgress: number };
    }) => {
      persisted.push({ id: args.where.id, physicalProgress: args.data.physicalProgress });
      return args;
    });
    mockPrisma.$transaction.mockImplementation(async (ops: unknown[]) => ops);
  });

  function given(rows: Row[]) {
    mockPrisma.scheduleItem.findMany.mockResolvedValue(rows);
  }

  function progressOf(id: string): number | undefined {
    return persisted.find((p) => p.id === id)?.physicalProgress;
  }

  describe('recalculateParentTasks', () => {
    it('calcula o pai pela média ponderada dos filhos', async () => {
      given([
        { id: 'pai', parentId: null, level: 0, weight: 1, physicalProgress: 0 },
        { id: 'a', parentId: 'pai', level: 1, weight: 3, physicalProgress: 100 },
        { id: 'b', parentId: 'pai', level: 1, weight: 1, physicalProgress: 0 },
      ]);

      await service.recalculateParentTasks('p1');

      // (100*3 + 0*1) / 4 = 75
      expect(progressOf('pai')).toBe(75);
    });

    /**
     * O bug que este teste trava: calculando de cima para baixo, ou usando um
     * snapshot congelado, o avô enxerga o valor ANTIGO do pai e sai errado.
     */
    it('propaga até a raiz usando os valores já recalculados dos níveis abaixo', async () => {
      given([
        { id: 'avo', parentId: null, level: 0, weight: 1, physicalProgress: 0 },
        { id: 'pai', parentId: 'avo', level: 1, weight: 1, physicalProgress: 0 },
        { id: 'neto1', parentId: 'pai', level: 2, weight: 1, physicalProgress: 100 },
        { id: 'neto2', parentId: 'pai', level: 2, weight: 1, physicalProgress: 50 },
      ]);

      await service.recalculateParentTasks('p1');

      expect(progressOf('pai')).toBe(75);
      // O avô tem um único filho (pai, já em 75), não os 0 do snapshot inicial.
      expect(progressOf('avo')).toBe(75);
    });

    it('processa do nível mais profundo para a raiz', async () => {
      given([
        { id: 'avo', parentId: null, level: 0, weight: 1, physicalProgress: 0 },
        { id: 'pai', parentId: 'avo', level: 1, weight: 1, physicalProgress: 0 },
        { id: 'neto', parentId: 'pai', level: 2, weight: 1, physicalProgress: 40 },
      ]);

      await service.recalculateParentTasks('p1');

      expect(persisted.map((p) => p.id)).toEqual(['pai', 'avo']);
    });

    it('não persiste nada quando nenhum valor mudou', async () => {
      given([
        { id: 'pai', parentId: null, level: 0, weight: 1, physicalProgress: 50 },
        { id: 'a', parentId: 'pai', level: 1, weight: 1, physicalProgress: 50 },
      ]);

      await service.recalculateParentTasks('p1');

      expect(persisted).toHaveLength(0);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('ignora folhas — só quem tem filhos é recalculado', async () => {
      given([
        { id: 'pai', parentId: null, level: 0, weight: 1, physicalProgress: 0 },
        { id: 'folha', parentId: 'pai', level: 1, weight: 1, physicalProgress: 80 },
      ]);

      await service.recalculateParentTasks('p1');

      expect(persisted.map((p) => p.id)).toEqual(['pai']);
      expect(progressOf('folha')).toBeUndefined();
    });

    /**
     * Comportamento pré-existente, fixado aqui de propósito: `child.weight || 1`
     * trata peso 0 como 1, porque zero é falsy. Um peso 0 explícito NÃO zera a
     * contribuição do filho. Nunca há divisão por zero por causa disso.
     */
    it('trata peso zero como peso 1', async () => {
      given([
        { id: 'pai', parentId: null, level: 0, weight: 1, physicalProgress: 10 },
        { id: 'a', parentId: 'pai', level: 1, weight: 0, physicalProgress: 100 },
      ]);

      await service.recalculateParentTasks('p1');

      expect(progressOf('pai')).toBe(100);
    });

    it('não faz nada em projeto sem atividades', async () => {
      given([]);

      await service.recalculateParentTasks('p1');

      expect(persisted).toHaveLength(0);
    });
  });

  describe('calculateParentProgress', () => {
    it('devolve 0 quando não há filhos', () => {
      expect(service.calculateParentProgress({}, [])).toBe(0);
    });

    it('arredonda para duas casas', () => {
      const progress = service.calculateParentProgress({}, [
        { weight: 1, physicalProgress: 100 },
        { weight: 2, physicalProgress: 0 },
      ]);
      expect(progress).toBe(33.33);
    });
  });

  // ---------------------------------------------------------------------------
  // restoreReport
  // ---------------------------------------------------------------------------
  describe('restoreReport', () => {
    const projectId = 'proj-1';
    const userId = 'user-1';

    function item(id: string, level: number, over: Record<string, unknown> = {}) {
      return {
        id, level,
        parentId: null,
        code: id, name: id,
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-01-31T00:00:00.000Z',
        durationDays: 30,
        physicalProgress: 0,
        ...over,
      };
    }

    /** Report gravado + estado atual do banco. */
    function scenario(opts: {
      snapshotVersion?: number;
      scheduleSnapshot?: unknown[];
      dependencySnapshot?: unknown[];
      measurementSnapshot?: unknown[];
      currentItems?: Array<{ id: string; level: number }>;
    }) {
      mockPrisma.projectReport.findUnique.mockResolvedValue({
        id: 'rep-1',
        projectId,
        reportNumber: 7,
        snapshotVersion: opts.snapshotVersion ?? 2,
        scheduleSnapshot: opts.scheduleSnapshot ?? [],
        dependencySnapshot: opts.dependencySnapshot ?? [],
        measurementSnapshot: opts.measurementSnapshot ?? [],
      });

      // createReport (rede de segurança) precisa de projeto e numeração.
      mockPrisma.project.findUnique.mockResolvedValue({ id: projectId });
      mockPrisma.projectBaseline.findFirst.mockResolvedValue(null);
      mockPrisma.projectReport.findFirst.mockResolvedValue({ reportNumber: 9 });
      mockPrisma.projectReport.create.mockResolvedValue({
        id: 'safety', projectId, reportNumber: 10,
        createdAt: new Date(), physicalProgress: 0,
        user: null, baseline: null, description: null,
      });
      mockPrisma.scheduleDependency.findMany.mockResolvedValue([]);
      mockPrisma.measurement.findMany.mockResolvedValue([]);

      // findMany serve tanto ao recalculo quanto ao diff dentro da transação.
      mockPrisma.scheduleItem.findMany.mockResolvedValue(opts.currentItems ?? []);
    }

    beforeEach(() => {
      mockPrisma.$transaction.mockImplementation(async (arg: unknown) =>
        typeof arg === 'function'
          ? (arg as (tx: unknown) => unknown)(mockPrisma)
          : Promise.all(arg as unknown[]),
      );
      mockPrisma.scheduleItem.create.mockResolvedValue({});
      mockPrisma.scheduleItem.delete.mockResolvedValue({});
      mockPrisma.scheduleDependency.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.scheduleDependency.createMany.mockResolvedValue({ count: 0 });
      mockPrisma.measurement.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.measurement.createMany.mockResolvedValue({ count: 0 });
    });

    it('rejeita report de outro projeto', async () => {
      mockPrisma.projectReport.findUnique.mockResolvedValue({
        id: 'rep-1', projectId: 'outro', reportNumber: 1, snapshotVersion: 2,
        scheduleSnapshot: [], dependencySnapshot: [], measurementSnapshot: [],
      });

      await expect(service.restoreReport(projectId, 'rep-1', userId))
        .rejects.toThrow(NotFoundException);
    });

    it('grava um Report de segurança antes de sobrescrever', async () => {
      scenario({ scheduleSnapshot: [item('a', 0)], currentItems: [{ id: 'a', level: 0 }] });

      const result = await service.restoreReport(projectId, 'rep-1', userId);

      expect(mockPrisma.projectReport.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            description: 'Antes da restauração do Report #7',
          }),
        }),
      );
      expect(result.safetyReportNumber).toBe(10);
    });

    /**
     * O ponto central do desenho: itens que existem nos dois lados são
     * ATUALIZADOS, nunca apagados e recriados. É o que mantém intactos os
     * vínculos de weekly_activities (FK ON DELETE SET NULL).
     */
    it('atualiza itens coincidentes em vez de recriá-los', async () => {
      scenario({
        scheduleSnapshot: [item('mantido', 1, { name: 'Nome do snapshot' })],
        currentItems: [{ id: 'mantido', level: 1 }],
      });

      await service.restoreReport(projectId, 'rep-1', userId);

      expect(mockPrisma.scheduleItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'mantido' },
          data: expect.objectContaining({ name: 'Nome do snapshot' }),
        }),
      );
      expect(mockPrisma.scheduleItem.delete).not.toHaveBeenCalled();
      expect(mockPrisma.scheduleItem.create).not.toHaveBeenCalled();
    });

    it('cria os que faltam do nível raso para o fundo', async () => {
      scenario({
        scheduleSnapshot: [item('neto', 2), item('pai', 0), item('filho', 1)],
        currentItems: [],
      });

      await service.restoreReport(projectId, 'rep-1', userId);

      const criados = mockPrisma.scheduleItem.create.mock.calls.map(
        (c: [{ data: { id: string } }]) => c[0].data.id,
      );
      expect(criados).toEqual(['pai', 'filho', 'neto']);
    });

    it('remove os que sobram do nível fundo para o raso', async () => {
      scenario({
        scheduleSnapshot: [],
        currentItems: [
          { id: 'raso', level: 0 },
          { id: 'fundo', level: 3 },
          { id: 'meio', level: 1 },
        ],
      });

      await service.restoreReport(projectId, 'rep-1', userId);

      const apagados = mockPrisma.scheduleItem.delete.mock.calls.map(
        (c: [{ where: { id: string } }]) => c[0].where.id,
      );
      expect(apagados).toEqual(['fundo', 'meio', 'raso']);
    });

    it('repõe dependências e medições em snapshot completo', async () => {
      scenario({
        snapshotVersion: 2,
        scheduleSnapshot: [item('a', 0)],
        currentItems: [{ id: 'a', level: 0 }],
        dependencySnapshot: [
          { id: 'd1', predecessorId: 'a', successorId: 'b', lagDays: 2, type: 'FS' },
        ],
        measurementSnapshot: [
          {
            id: 'm1', unitId: 'u1', activityTypeId: 't1', measuredById: userId,
            date: '2026-01-05T00:00:00.000Z', percentComplete: 50,
            executedQty: null, totalQty: null, notes: null, photoUrl: null,
          },
        ],
      });

      const result = await service.restoreReport(projectId, 'rep-1', userId);

      expect(mockPrisma.scheduleDependency.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [{ id: 'd1', predecessorId: 'a', successorId: 'b', lagDays: 2, type: 'FS' }],
        }),
      );
      expect(mockPrisma.measurement.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.measurement.createMany).toHaveBeenCalled();
      expect(result.partial).toBe(false);
    });

    /**
     * Reports v1 nunca gravaram dependências nem medições. Tocá-las apagaria
     * dados que o snapshot não sabe repor.
     */
    it('não toca em dependências nem medições em report v1', async () => {
      scenario({
        snapshotVersion: 1,
        scheduleSnapshot: [item('a', 0)],
        currentItems: [{ id: 'a', level: 0 }],
      });

      const result = await service.restoreReport(projectId, 'rep-1', userId);

      expect(mockPrisma.scheduleDependency.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.scheduleDependency.createMany).not.toHaveBeenCalled();
      expect(mockPrisma.measurement.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.measurement.createMany).not.toHaveBeenCalled();
      // O cronograma foi restaurado normalmente.
      expect(mockPrisma.scheduleItem.update).toHaveBeenCalled();
      expect(result.partial).toBe(true);
    });

    /**
     * O indicador "% Avanço Físico" do topo sempre mostra o ÚLTIMO Report. O
     * report de segurança é gravado ANTES da sobrescrita, então carrega o
     * avanço de antes da restauração. Sem um Report de fechamento, o indicador
     * ficaria exibindo justamente o percentual que acabou de ser descartado.
     */
    it('fecha a restauração com um Report novo, para o indicador refletir a versão restaurada', async () => {
      scenario({ scheduleSnapshot: [item('a', 0)], currentItems: [{ id: 'a', level: 0 }] });
      mockPrisma.projectReport.create
        .mockResolvedValueOnce({
          id: 'safety', projectId, reportNumber: 10, createdAt: new Date(),
          physicalProgress: 88.5, user: null, baseline: null, description: null,
        })
        .mockResolvedValueOnce({
          id: 'fechamento', projectId, reportNumber: 11, createdAt: new Date(),
          physicalProgress: 42.75, user: null, baseline: null, description: null,
        });

      const result = await service.restoreReport(projectId, 'rep-1', userId);

      expect(mockPrisma.projectReport.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.projectReport.create).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ description: 'Restauração do Report #7' }),
        }),
      );
      // O último Report é o de fechamento, não o de segurança.
      expect(result.restoredReportNumber).toBe(11);
      expect(result.safetyReportNumber).toBe(10);
      expect(result.physicalProgress).toBe(42.75);
    });

    it('avisa as telas que o cronograma foi restaurado', async () => {
      scenario({ scheduleSnapshot: [item('a', 0)], currentItems: [{ id: 'a', level: 0 }] });

      await service.restoreReport(projectId, 'rep-1', userId);

      expect(mockRealtime.emitScheduleChanged).toHaveBeenCalledWith(
        expect.objectContaining({ projectId, action: 'restored' }),
      );
    });

    it('propaga a falha da transação sem emitir evento', async () => {
      scenario({ scheduleSnapshot: [item('a', 0)], currentItems: [{ id: 'a', level: 0 }] });
      mockPrisma.$transaction.mockRejectedValueOnce(new Error('deu ruim'));

      await expect(service.restoreReport(projectId, 'rep-1', userId))
        .rejects.toThrow('deu ruim');
      expect(mockRealtime.emitScheduleChanged).not.toHaveBeenCalled();
    });
  });
});
