import { describe, expect, it } from 'vitest';
import type { WeeklyActivity } from '../../types';
import {
  applyColumnFilters,
  calcPPC,
  distinctColumnValues,
  percentForStatus,
  suggestStatusFromPercent,
} from './weekly-logic';

const act = (over: Partial<WeeklyActivity>): WeeklyActivity => ({
  id: Math.random().toString(36).slice(2),
  programId: 'p1',
  origin: 'CRONOGRAMA',
  local: 'Obra',
  torre: 'Torre A',
  pavimento: '5º Andar',
  activityName: 'Alvenaria',
  status: 'PROGRAMADA',
  percentExecuted: 0,
  order: 0,
  createdAt: '',
  updatedAt: '',
  ...over,
});

describe('percentForStatus (status manda no %)', () => {
  it('NAO_INICIADA e CANCELADA forçam 0', () => {
    expect(percentForStatus('NAO_INICIADA', 60)).toBe(0);
    expect(percentForStatus('CANCELADA', 80)).toBe(0);
  });

  it('CONCLUIDA força 100', () => {
    expect(percentForStatus('CONCLUIDA', 10)).toBe(100);
  });

  it('EM_ANDAMENTO exige 1–99, sugerindo 50 quando vinha de 0/100', () => {
    expect(percentForStatus('EM_ANDAMENTO', 0)).toBe(50);
    expect(percentForStatus('EM_ANDAMENTO', 100)).toBe(50);
    expect(percentForStatus('EM_ANDAMENTO', 40)).toBe(40);
  });

  it('PROGRAMADA/REPROGRAMADA mantêm % com clamp', () => {
    expect(percentForStatus('PROGRAMADA', 130)).toBe(100);
    expect(percentForStatus('REPROGRAMADA', -3)).toBe(0);
  });
});

describe('suggestStatusFromPercent', () => {
  it('100 → CONCLUIDA · 1–99 → EM_ANDAMENTO', () => {
    expect(suggestStatusFromPercent('PROGRAMADA', 100)).toBe('CONCLUIDA');
    expect(suggestStatusFromPercent('REPROGRAMADA', 25)).toBe('EM_ANDAMENTO');
  });

  it('0 regride EM_ANDAMENTO/CONCLUIDA para NAO_INICIADA e preserva os demais', () => {
    expect(suggestStatusFromPercent('EM_ANDAMENTO', 0)).toBe('NAO_INICIADA');
    expect(suggestStatusFromPercent('PROGRAMADA', 0)).toBe('PROGRAMADA');
    expect(suggestStatusFromPercent('REPROGRAMADA', 0)).toBe('REPROGRAMADA');
  });

  it('CANCELADA nunca muda pelo %', () => {
    expect(suggestStatusFromPercent('CANCELADA', 100)).toBe('CANCELADA');
  });
});

describe('calcPPC (binário, canceladas fora)', () => {
  it('conta só concluídas sobre válidas', () => {
    expect(
      calcPPC([
        { status: 'CONCLUIDA' },
        { status: 'CONCLUIDA' },
        { status: 'EM_ANDAMENTO' },
        { status: 'CANCELADA' },
      ]),
    ).toBe(67);
  });

  it('vazio ou só canceladas → 0', () => {
    expect(calcPPC([])).toBe(0);
    expect(calcPPC([{ status: 'CANCELADA' }])).toBe(0);
  });
});

describe('filtros estilo Excel', () => {
  const rows = [
    act({ pavimento: '5º Andar', status: 'EM_ANDAMENTO', contractor: { id: 'a', name: 'Alfa', isActive: true } }),
    act({ pavimento: '4º Andar', status: 'CONCLUIDA', contractor: { id: 'b', name: 'Beta', isActive: true } }),
    act({ pavimento: '4º Andar', status: 'PROGRAMADA', contractor: null }),
  ];

  it('distinctColumnValues ordena e usa — para vazios', () => {
    expect(distinctColumnValues(rows, 'pavimento')).toEqual(['4º Andar', '5º Andar']);
    expect(distinctColumnValues(rows, 'contractor')).toEqual(['Alfa', 'Beta', '—']);
  });

  it('multi-seleção na mesma coluna (OR) e colunas combinadas (AND)', () => {
    expect(applyColumnFilters(rows, { pavimento: ['4º Andar', '5º Andar'] })).toHaveLength(3);
    expect(
      applyColumnFilters(rows, { pavimento: ['4º Andar'], status: ['Concluída'] }),
    ).toHaveLength(1);
  });

  it('sem filtros retorna tudo', () => {
    expect(applyColumnFilters(rows, {})).toHaveLength(3);
  });
});
