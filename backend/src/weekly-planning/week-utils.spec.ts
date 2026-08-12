import { WeeklyActivityStatus, WeeklyRestrictionStatus } from '@prisma/client';
import {
  addDays,
  CARRYOVER_STATUSES,
  computeIndicators,
  deriveLocationFromPath,
  isoWeek,
  reconcileStatusPercent,
  startOfWeekUtc,
  suggestStatusFromPercent,
  weekWindow,
} from './week-utils';

const A = WeeklyActivityStatus;

describe('week-utils', () => {
  // ── Cálculo de semana ──────────────────────────────────────────────────────
  describe('weekWindow / startOfWeekUtc', () => {
    it('semana iniciando na segunda (default) contém 7 dias e reunião no dia seguinte ao término', () => {
      // 2026-07-16 é quinta-feira
      const win = weekWindow(new Date(Date.UTC(2026, 6, 16)), 1);
      expect(win.startDate.toISOString().slice(0, 10)).toBe('2026-07-13'); // segunda
      expect(win.endDate.toISOString().slice(0, 10)).toBe('2026-07-19'); // domingo
      expect(win.meetingDate.toISOString().slice(0, 10)).toBe('2026-07-20'); // segunda seguinte
    });

    it('exemplo da spec: início Quarta → programação Quarta a Terça, reunião na Quarta seguinte', () => {
      // referência: quinta 2026-07-16; início de semana = quarta (3)
      const win = weekWindow(new Date(Date.UTC(2026, 6, 16)), 3);
      expect(win.startDate.getUTCDay()).toBe(3); // quarta
      expect(win.startDate.toISOString().slice(0, 10)).toBe('2026-07-15');
      expect(win.endDate.toISOString().slice(0, 10)).toBe('2026-07-21'); // terça
      expect(win.endDate.getUTCDay()).toBe(2);
      expect(win.meetingDate.toISOString().slice(0, 10)).toBe('2026-07-22'); // quarta seguinte
      expect(win.meetingDate.getUTCDay()).toBe(3);
    });

    it('referência no próprio dia de início mantém a mesma data', () => {
      // 2026-07-15 é quarta
      const win = weekWindow(new Date(Date.UTC(2026, 6, 15)), 3);
      expect(win.startDate.toISOString().slice(0, 10)).toBe('2026-07-15');
    });

    it('domingo como início de semana', () => {
      const start = startOfWeekUtc(new Date(Date.UTC(2026, 6, 16)), 0);
      expect(start.getUTCDay()).toBe(0);
      expect(start.toISOString().slice(0, 10)).toBe('2026-07-12');
    });

    it('semanas consecutivas encadeiam sem lacuna', () => {
      const win = weekWindow(new Date(Date.UTC(2026, 6, 16)), 1);
      const next = weekWindow(addDays(win.endDate, 1), 1);
      expect(next.startDate.getTime()).toBe(addDays(win.startDate, 7).getTime());
    });

    it('isoWeek calcula semana ISO corretamente', () => {
      expect(isoWeek(new Date(Date.UTC(2026, 0, 1)))).toEqual({ week: 1, year: 2026 });
      expect(isoWeek(new Date(Date.UTC(2026, 6, 16))).week).toBe(29);
    });
  });

  // ── Regras Status ↔ % ─────────────────────────────────────────────────────
  describe('reconcileStatusPercent', () => {
    it('NAO_INICIADA força 0%', () => {
      expect(reconcileStatusPercent(A.NAO_INICIADA, 60)).toEqual({ status: A.NAO_INICIADA, percentExecuted: 0 });
    });

    it('CONCLUIDA força 100%', () => {
      expect(reconcileStatusPercent(A.CONCLUIDA, 10)).toEqual({ status: A.CONCLUIDA, percentExecuted: 100 });
    });

    it('CANCELADA força 0% (fora do PPC)', () => {
      expect(reconcileStatusPercent(A.CANCELADA, 80)).toEqual({ status: A.CANCELADA, percentExecuted: 0 });
    });

    it('EM_ANDAMENTO restringe a 1–99', () => {
      expect(reconcileStatusPercent(A.EM_ANDAMENTO, 0).percentExecuted).toBe(1);
      expect(reconcileStatusPercent(A.EM_ANDAMENTO, 100).percentExecuted).toBe(99);
      expect(reconcileStatusPercent(A.EM_ANDAMENTO, 55).percentExecuted).toBe(55);
    });

    it('PROGRAMADA e REPROGRAMADA mantêm % livre com clamp 0–100', () => {
      expect(reconcileStatusPercent(A.PROGRAMADA, 150).percentExecuted).toBe(100);
      expect(reconcileStatusPercent(A.REPROGRAMADA, -5).percentExecuted).toBe(0);
      expect(reconcileStatusPercent(A.PROGRAMADA, 30).percentExecuted).toBe(30);
    });
  });

  describe('suggestStatusFromPercent', () => {
    it('100% sugere CONCLUIDA e 1–99% sugere EM_ANDAMENTO', () => {
      expect(suggestStatusFromPercent(A.PROGRAMADA, 100)).toBe(A.CONCLUIDA);
      expect(suggestStatusFromPercent(A.REPROGRAMADA, 40)).toBe(A.EM_ANDAMENTO);
    });

    it('0% regride EM_ANDAMENTO/CONCLUIDA para NAO_INICIADA, mas mantém PROGRAMADA/REPROGRAMADA', () => {
      expect(suggestStatusFromPercent(A.EM_ANDAMENTO, 0)).toBe(A.NAO_INICIADA);
      expect(suggestStatusFromPercent(A.CONCLUIDA, 0)).toBe(A.NAO_INICIADA);
      expect(suggestStatusFromPercent(A.PROGRAMADA, 0)).toBe(A.PROGRAMADA);
      expect(suggestStatusFromPercent(A.REPROGRAMADA, 0)).toBe(A.REPROGRAMADA);
    });

    it('CANCELADA nunca muda pelo %', () => {
      expect(suggestStatusFromPercent(A.CANCELADA, 100)).toBe(A.CANCELADA);
    });
  });

  // ── Reprogramação automática ───────────────────────────────────────────────
  describe('CARRYOVER_STATUSES', () => {
    it('leva PROGRAMADA, NAO_INICIADA, EM_ANDAMENTO e REPROGRAMADA; não leva CONCLUIDA nem CANCELADA', () => {
      expect(CARRYOVER_STATUSES).toEqual(
        expect.arrayContaining([A.PROGRAMADA, A.NAO_INICIADA, A.EM_ANDAMENTO, A.REPROGRAMADA]),
      );
      expect(CARRYOVER_STATUSES).not.toContain(A.CONCLUIDA);
      expect(CARRYOVER_STATUSES).not.toContain(A.CANCELADA);
    });
  });

  // ── Indicadores / PPC ──────────────────────────────────────────────────────
  describe('computeIndicators', () => {
    const act = (status: WeeklyActivityStatus, contractorName: string | null = null, responsible: string | null = null) => ({
      status,
      contractorId: contractorName,
      contractorName,
      responsible,
    });

    it('PPC binário: CONCLUIDA ÷ (total − CANCELADA)', () => {
      const result = computeIndicators(
        [act(A.CONCLUIDA), act(A.CONCLUIDA), act(A.EM_ANDAMENTO), act(A.NAO_INICIADA), act(A.CANCELADA)],
        [],
      );
      // 2 concluídas / 4 válidas = 50%
      expect(result.ppc).toBe(50);
      expect(result.validActivities).toBe(4);
      expect(result.cancelled).toBe(1);
      expect(result.completed).toBe(2);
    });

    it('cancelada sai de todos os KPIs (denominador incluso)', () => {
      const result = computeIndicators([act(A.CONCLUIDA), act(A.CANCELADA)], []);
      expect(result.ppc).toBe(100);
      expect(result.reprogrammedPct).toBe(0);
    });

    it('parcial (EM_ANDAMENTO) não pontua', () => {
      const result = computeIndicators([act(A.EM_ANDAMENTO), act(A.EM_ANDAMENTO)], []);
      expect(result.ppc).toBe(0);
      expect(result.carriedOver).toBe(2);
      expect(result.reprogrammedPct).toBe(100);
    });

    it('sem atividades válidas → PPC 0 sem divisão por zero', () => {
      expect(computeIndicators([], []).ppc).toBe(0);
      expect(computeIndicators([act(A.CANCELADA)], []).ppc).toBe(0);
    });

    it('agrupa PPC por empreiteira e por responsável', () => {
      const result = computeIndicators(
        [
          act(A.CONCLUIDA, 'Alfa', 'João'),
          act(A.NAO_INICIADA, 'Alfa', 'João'),
          act(A.CONCLUIDA, 'Beta', 'Maria'),
        ],
        [],
      );
      const alfa = result.byContractor.find((c) => c.name === 'Alfa')!;
      expect(alfa.ppc).toBe(50);
      expect(alfa.reprogrammedPct).toBe(50);
      const beta = result.byContractor.find((c) => c.name === 'Beta')!;
      expect(beta.ppc).toBe(100);

      const joao = result.byResponsible.find((r) => r.responsible === 'João')!;
      expect(joao.planned).toBe(2);
      expect(joao.delivered).toBe(1);
      expect(joao.ppc).toBe(50);
    });

    it('conta restrições e principais causas por tipo', () => {
      const result = computeIndicators(
        [act(A.NAO_INICIADA)],
        [
          { typeName: 'Material', status: WeeklyRestrictionStatus.PENDENTE },
          { typeName: 'Material', status: WeeklyRestrictionStatus.PENDENTE },
          { typeName: 'Projeto', status: WeeklyRestrictionStatus.RESOLVIDA },
        ],
      );
      expect(result.restrictionsCount).toBe(3);
      expect(result.restrictionsPending).toBe(2);
      expect(result.topCauses[0]).toEqual({ type: 'Material', count: 2 });
    });
  });

  // ── Derivação Local/Torre/Pavimento da EAP ────────────────────────────────
  describe('deriveLocationFromPath', () => {
    it('3+ ancestrais: bisavô → Local, avô → Torre, pai → Pavimento', () => {
      expect(
        deriveLocationFromPath(['Residencial Vista Verde', 'Torre A - Estrutura e Acabamentos', 'Torre A - Estrutura']),
      ).toEqual({
        local: 'Residencial Vista Verde',
        torre: 'Torre A - Estrutura e Acabamentos',
        pavimento: 'Torre A - Estrutura',
      });
    });

    it('2 ancestrais preenchem Torre e Pavimento; Local usa a raiz', () => {
      expect(deriveLocationFromPath(['Raiz', 'Fase'])).toEqual({ local: 'Raiz', torre: 'Raiz', pavimento: 'Fase' });
    });

    it('sem ancestrais → campos vazios', () => {
      expect(deriveLocationFromPath([])).toEqual({ local: '', torre: '', pavimento: '' });
    });
  });
});
