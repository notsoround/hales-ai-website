import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SnapView } from '../src/pages/cupcake/sandbox/cupcakegpt/page';
import type { FoodMeal } from '../src/components/cupcake/DashboardView';
import '../src/index.css';
if (!import.meta.env.DEV) throw new Error('Synthetic preview is development only.');
const initial: FoodMeal = { id: 'synthetic_meal_mobile', status: 'ready', createdAt: '2026-09-29T17:00:00Z', description: 'Synthetic rice bowl and sweet tea', total: { calories: 520, carbs_g: 88, sugar_g: 35, protein_g: 17 }, calorieRange: { low: 420, high: 620 }, items: [
  { id: 'synthetic_rice', name: 'Rice bowl', quantity: 1, unit: 'bowl', nutrition: { calories: 380, carbs_g: 53, sugar_g: 0, protein_g: 17 }, provenance: 'visual_estimate', portionAssumption: 'One visible bowl with rice and vegetables.' },
  { id: 'synthetic_tea', name: 'Sweet tea', quantity: 1, unit: 'glass', nutrition: { calories: 140, carbs_g: 35, sugar_g: 35, protein_g: 0 }, provenance: 'visual_estimate', portionAssumption: 'A 12 oz sweetened tea.' },
] };
let meal = structuredClone(initial);
let failOnce = false;
const calls: Array<Record<string, unknown>> = [];
window.fetch = async (_url, init) => {
  const body = JSON.parse(String(init?.body || '{}'));
  calls.push(body);
  let data: Record<string, unknown>;
  if (body.action === 'food_list') data = { meals: [meal] };
  else if (body.action === 'food_get') data = { meal };
  else if (body.action === 'food_refine') { meal = { ...meal, description: 'Synthetic corrected rice bowl and unsweetened tea', total: { calories: 380, carbs_g: 53, sugar_g: 0, protein_g: 17 }, calorieRange: { low: 300, high: 460 }, items: [initial.items![0], { ...initial.items![1], name: 'Unsweetened tea', nutrition: { calories: 0, carbs_g: 0, sugar_g: 0, protein_g: 0 }, portionAssumption: 'Unsweetened, as corrected in this simulated test.' }] }; data = { meal }; }
  else if (body.action === 'food_log') {
    if (failOnce) { failOnce = false; throw Error('Simulated connection interruption. Retry this same meal.'); }
    if (body.confirmConsumed !== true || !body.consumedAt || Date.parse(String(body.consumedAt)) > Date.now()) throw Error('Simulated log rejected: confirmation and a past time are required.');
    meal = { ...meal, consumedAt: String(body.consumedAt), sheetLoggedAt: new Date().toISOString() }; data = { meal };
  } else throw Error('External networking is disabled in this simulated preview.');
  document.getElementById('synthetic-count')?.replaceChildren(`Simulated save requests: ${calls.filter(call => call.action === 'food_log').length}. No live writes.`);
  return new Response(JSON.stringify({ ok: true, ...data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
function Preview() {
  const [version, setVersion] = useState(0);
  return <div className="cc-app" style={{ width: 390, maxWidth: '100%', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}><main style={{ padding: 16 }}><h1 style={{ fontSize: 20 }}>Food photo · simulated mobile test</h1><p style={{ fontSize: 12, color: '#eabed2' }}>390 px preview. Open the saved meal below. Every response is synthetic; external requests are blocked.</p><button className="cc-secondary" onClick={() => { meal = structuredClone(initial); failOnce = false; setVersion(v => v + 1); }}>Reset simulated meal</button><label className="cc-meal-consent"><input type="checkbox" onChange={e => { failOnce = e.target.checked; }} />Simulate one interrupted save</label><output id="synthetic-count" style={{ fontSize: 12 }}>Simulated save requests: 0. No live writes.</output><SnapView key={version}/></main></div>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
