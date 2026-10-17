import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { NutritionTodayCard, NutritionWorkspace } from '../src/components/cupcake/NutritionWorkspace';
import { SavedMealDialog } from '../src/components/cupcake/SavedMealDialog';
import { SignalDetail, type FoodMeal } from '../src/components/cupcake/DashboardView';
import { nutritionDay, type NutritionSettings, type FoodHistoryMeal } from '../src/components/cupcake/nutritionModel';
import '../src/index.css';
if (!import.meta.env.DEV) throw new Error('Synthetic preview is development only.');
const now = new Date();
const ago = (hours: number) => new Date(now.getTime() - hours * 3600000).toISOString();
const sourceMeals: FoodMeal[] = [1, 2, 3, 25, 27, 30, 300, 1500].map((hours, i) => ({ id: `synthetic_meal_${i}`, status: 'ready', description: `Synthetic meal ${i + 1} · rice and vegetables`, consumedAt: ago(hours), photoTakenAt: ago(hours), createdAt: ago(hours), sheetLoggedAt: ago(hours), total: { calories: i === 4 ? null : 520 + i * 80, protein_g: 23, carbs_g: 68, sugar_g: 8 }, totalIsPartial: i === 4, items: [{ id: 'item', name: 'Synthetic rice bowl', quantity: 1, unit: 'bowl', nutrition: { calories: 520 }, provenance: 'visual_estimate', portionAssumption: 'Visible portion', calculation: 'Synthetic calculation for an isolated preview.' }] }));
const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0ioAAAAASUVORK5CYII=';
window.fetch = async (_url, init) => {
  const body = JSON.parse(String(init?.body || '{}'));
  if (body.action === 'food_get') return Response.json({ ok: true, meal: sourceMeals.find(m => m.id === body.mealId) });
  if (body.action === 'food_photo') return Response.json({ ok: true, photo: { dataUrl: photo } });
  throw Error('External networking is disabled in this synthetic preview.');
};
function Preview() {
  const [selected, setSelected] = useState<string | null>(null), [emptyToday, setEmptyToday] = useState(false), [calendar, setCalendar] = useState(false);
  const [settings, setSettings] = useState<NutritionSettings>({ calorieTarget: null, expenditureEstimate: null, effectiveFrom: null });
  const [saved, setSaved] = useState(''), [fail, setFail] = useState(false);
  const meals = sourceMeals.filter(m => !emptyToday || nutritionDay(m.consumedAt!) !== nutritionDay(now)) as FoodHistoryMeal[];
  const history = { meals, complete: true, pendingCount: 0, undatedLoggedCount: 0, coverageNote: 'Synthetic saved meals. No production data or writes.' };
  return <div className="cc-app"><main className="cc-main" style={{ maxWidth: 1000, margin: 'auto', padding: 20 }}>
    <p style={{ color: '#fbcfe8' }}>Isolated synthetic preview · external requests blocked</p>
    <button className="cc-secondary" onClick={() => setEmptyToday(!emptyToday)}>{emptyToday ? 'Restore today’s meals' : 'No meals today'}</button>
    <NutritionTodayCard history={history} settings={settings} onOpenMeal={setSelected} onOpenCalendar={() => setCalendar(true)}/>
    {calendar && <NutritionWorkspace history={history} settings={settings} onOpenMeal={setSelected} onSaveSettings={async value => setSettings({ ...value, updatedAt: new Date().toISOString() })}/>}
    <SavedMealDialog mealId={selected} meals={meals} onSelect={setSelected} onClose={() => setSelected(null)}/>
    <section style={{ marginTop: 30 }}><h2>Isolated intervention update</h2><label><input type="checkbox" checked={fail} onChange={e => setFail(e.target.checked)}/>Simulate update failure</label><output role="status">{saved}</output>
      <SignalDetail entry={{ id: 'intervention:synthetic', type: 'intervention', date: nutritionDay(now), title: 'Synthetic purchase check-in', body: 'No live intervention is changed.' }} onBack={() => {}} updateIntervention={async (_entry, note, choice) => { if (fail) throw Error('Synthetic failure. Your choice is retained.'); setSaved(`Synthetic saved choice: ${String(choice)}; note length: ${note.length}`); }}/>
    </section>
  </main></div>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
