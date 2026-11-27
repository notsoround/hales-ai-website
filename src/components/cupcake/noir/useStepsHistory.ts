import { useCallback, useEffect, useRef, useState } from 'react';
import { useDataChanged } from '../dataChanges';
import { libraryRequest } from '../library';
import { addDays } from '../nutritionModel';
import { stepsHistory, StepsUnavailableError, type StepsDay } from '../stepsApi';
import { useVisibleStepsRefresh } from './useVisibleStepsRefresh';

type StepsHistory = { status: 'loading' | 'ready' | 'unavailable' | 'error'; days: StepsDay[]; phoneAverage: boolean };

export function useStepsHistory(today: string, lookbackDays: number) {
  const [history, setHistory] = useState<StepsHistory>({ status: 'loading', days: [], phoneAverage: false });
  const sequence = useRef(0);
  const reload = useCallback(async () => {
    const request = ++sequence.current;
    setHistory(prev => ({ ...prev, status: 'loading' }));
    try {
      const result = await stepsHistory(libraryRequest, addDays(today, -lookbackDays), today);
      if (sequence.current === request) setHistory({ status: 'ready', ...result });
    } catch (error) {
      if (sequence.current !== request) return;
      if (error instanceof StepsUnavailableError) setHistory({ status: 'unavailable', days: [], phoneAverage: false });
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
