import { Test, TestingModule } from '@nestjs/testing';
import { PhysicalProgressService } from './physical-progress.service';
import { PrismaService } from '../common/prisma.service';

type Row = {
  id: string;
  parentId: string | null;
  level: number;
  weight: number;
  physicalProgress: number;
};

const mockPrisma = {
  scheduleItem: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('PhysicalProgressService', () => {
  let service: PhysicalProgressService;
  /** Atualizações efetivamente persistidas, na ordem em que foram montadas. */
  let persisted: Array<{ id: string; physicalProgress: number }>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PhysicalProgressService,
        { provide: PrismaService, useValue: mockPrisma },
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
});
