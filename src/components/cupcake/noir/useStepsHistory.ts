import { useCallback, useEffect, useRef, useState } from 'react';
import { useDataChanged } from '../dataChanges';
import { libraryRequest } from '../library';
import { addDays } from '../nutritionModel';
import { listStepsDays, StepsUnavailableError, type StepsDay } from '../stepsApi';
import { useVisibleStepsRefresh } from './useVisibleStepsRefresh';

type StepsHistory = { status: 'loading' | 'ready' | 'unavailable' | 'error'; days: StepsDay[] };

export function useStepsHistory(today: string, lookbackDays: number) {
  const [history, setHistory] = useState<StepsHistory>({ status: 'loading', days: [] });
  const sequence = useRef(0);
  const reload = useCallback(async () => {
    const request = ++sequence.current;
    setHistory(prev => ({ ...prev, status: 'loading' }));
    try {
      const days = await listStepsDays(libraryRequest, addDays(today, -lookbackDays), today);
      if (sequence.current === request) setHistory({ status: 'ready', days });
    } catch (error) {
      if (sequence.current !== request) return;
      if (error instanceof StepsUnavailableError) setHistory({ status: 'unavailable', days: [] });
      else setHistory(prev => ({ ...prev, status: 'error' }));
    }
  }, [today, lookbackDays]);
  useEffect(() => {
    void reload();
    return () => { sequence.current++; };
  }, [reload]);
  useVisibleStepsRefresh(reload);
  useDataChanged([], reload);
  return { ...history, reload };
}
