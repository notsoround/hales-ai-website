/* eslint-disable react-refresh/only-export-components -- Isolated development-only fixture. */
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { NutritionTodayCard, NutritionWorkspace } from '../src/components/cupcake/NutritionWorkspace';
import type { FoodHistoryMeal } from '../src/components/cupcake/nutritionModel';
import '../src/index.css';
import '../src/components/cupcake/studio.css';
import '../src/components/cupcake/design/tokens.css';
import '../src/components/cupcake/design/cupcake-theme.css';
import '../src/components/cupcake/assistant-appearance.css';

if (!import.meta.env.DEV) throw Error('Synthetic preview is development only.');
window.fetch = async () => { throw Error('External requests are disabled in this preview.'); };
const now = new Date('2026-11-08T17:00:00Z');
const meal = (id: string, consumedAt: string, total: FoodHistoryMeal['total']): FoodHistoryMeal => ({ id, description: 'Synthetic meal ' + id, consumedAt, sheetLoggedAt: consumedAt, countedInTotals: true, total });
const meals = [
  meal('a', '2026-11-08T13:00:00Z', { calories: 600, protein_g: 20, carbs_g: 30, fat_g: 12 }),
  meal('b', '2026-11-08T14:00:00Z', { calories: 333, protein_g: 20, carbs_g: 30 }),
  meal('c', '2026-11-08T15:00:00Z', { calories: null }),
  meal('d', '2026-11-07T15:00:00Z', { calories: 99999 }),
];
function Preview() {
  const [selected, setSelected] = useState(''), [unknownFat, setUnknownFat] = useState(false);
  const history = { meals: unknownFat ? meals.map(m => ({ ...m, total: { ...m.total, fat_g: null } })) : meals, complete: true, pendingCount: 0, undatedLoggedCount: 0 };
  return <div className="cc-app" data-appearance={new URLSearchParams(location.search).get('theme') || 'caribbean'}><main className="cc-shell"><p>Synthetic preview · no personal data</p><button onClick={() => setUnknownFat(!unknownFat)}>Toggle unknown fat</button><output role="status">{selected}</output><NutritionTodayCard history={history} now={now} onOpenMeal={setSelected} onOpenCalendar={() => {}}/><NutritionWorkspace history={history} now={now} onOpenMeal={setSelected}/></main></div>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
