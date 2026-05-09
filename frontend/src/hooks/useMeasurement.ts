import { useState, useCallback } from 'react';
import { measurementsApi } from '../services/api';
import type { Measurement } from '../types';

export function useMeasurement() {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(false);

  const loadMeasurements = useCallback(async (unitId: string) => {
    setLoading(true);
    try {
      const data = await measurementsApi.list(unitId);
      setMeasurements(data);
      return data;
    } finally {
      setLoading(false);
    }
  }, []);

  const saveMeasurement = useCallback(async (unitId: string, data: Partial<Measurement>) => {
    const saved = await measurementsApi.create(unitId, data);
    setMeasurements((prev) => {
      const idx = prev.findIndex((m) => m.activityTypeId === saved.activityTypeId);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = saved;
        return updated;
      }
      return [...prev, saved];
    });
    return saved;
  }, []);

  const saveBatch = useCallback(async (unitId: string, items: unknown[]) => {
    const result = await measurementsApi.batch(unitId, items);
    const fresh = await measurementsApi.list(unitId);
    setMeasurements(fresh);
    return result;
  }, []);

  return { measurements, loading, loadMeasurements, saveMeasurement, saveBatch };
}
