import { useState } from 'react';
import { Check, Loader2, Sparkles } from 'lucide-react';
import { ACCOUNT_SESSIONS } from './accountMode';
import { accountData } from './accountSession';
import { notifyDataChanged, type DataArea } from './dataChanges';
import { chicagoDate } from './exerciseApi';
import { libraryRequest } from './library';
import './noir/noir-plan.css';

type NutrientKey = 'calories' | 'protein_g' | 'carbs_g' | 'fat_g' | 'fiber_g' | 'sugar_g';
type MealTotal = Partial<Record<NutrientKey, number>>;

export type ExtractedUpdateItem =
  | { kind: 'meal'; id: string; requestId: string; checked: boolean; applied: boolean; error?: string; description: string; consumedAt: string; total: MealTotal }
  | { kind: 'weight'; id: string; requestId: string; checked: boolean; applied: boolean; error?: string; weightLb: number }
  | { kind: 'exercise'; id: string; requestId: string; checked: boolean; applied: boolean; error?: string; description: string; minutes: number; kcal: number }
  | { kind: 'outcome'; id: string; requestId: string; checked: boolean; applied: boolean; error?: string; title: string; outcome: 'win' | 'loss'; note: string; date: string };

type RawExtractResponse = {
  meals?: unknown[];
  weightLb?: unknown;
  exercises?: unknown[];
  outcomes?: unknown[];
};

const asRecord = (v: unknown): Record<string, unknown> | null =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

const finiteIn = (v: unknown, min: number, max: number): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : undefined;

const validIso = (v: unknown): string | undefined =>
  typeof v === 'string' && /(Z|[+-]\d\d:\d\d)$/.test(v) && Number.isFinite(Date.parse(v)) ? v : undefined;

function cleanClause(raw: string): string {
  return raw.replace(/^(?:you|assistant|cupcake|me|i)\s*:\s*/i, '').replace(/\s+/g, ' ').trim();
}

function parseNutrients(text: string): MealTotal {
  const total: MealTotal = {};
  const cal = /\b(\d{1,5})\s*(?:k?cal(?:ories)?)\b/i.exec(text);
  const pro = /\b(\d{1,4}(?:\.\d+)?)\s*g?\s*protein\b/i.exec(text);
  const carb = /\b(\d{1,4}(?:\.\d+)?)\s*g?\s*(?:total\s+)?carbs?\b/i.exec(text);
  const fat = /\b(\d{1,4}(?:\.\d+)?)\s*g?\s*fat\b/i.exec(text);
  const fiber = /\b(\d{1,4}(?:\.\d+)?)\s*g?\s*fiber\b/i.exec(text);
  const sugar = /\b(\d{1,4}(?:\.\d+)?)\s*g?\s*sugar\b/i.exec(text);
  if (cal) total.calories = Number(cal[1]);
  if (pro) total.protein_g = Number(pro[1]);
  if (carb) total.carbs_g = Number(carb[1]);
  if (fat) total.fat_g = Number(fat[1]);
  if (fiber) total.fiber_g = Number(fiber[1]);
  if (sugar) total.sugar_g = Number(sugar[1]);
  return total;
}

/** Client-side fallback extractor when the backend extractor is unavailable. */
function extractUpdatesLocally(transcriptText: string, now = Date.now()): ExtractedUpdateItem[] {
  const items: ExtractedUpdateItem[] = [];
  const nowIso = new Date(now).toISOString();
  const today = chicagoDate(now);
  const lines = transcriptText
    .split(/\n+|(?<=[.!?])\s+/)
    .map(cleanClause)
    .filter(line => line.length >= 4 && !/^(?:okay|ok|got it|sounds good|thanks|thank you|hi|hello|bye)\b/i.test(line));

  let weightFound: number | null = null;
  const seenMeals = new Set<string>();
  const seenExercises = new Set<string>();
  const seenOutcomes = new Set<string>();

  for (const line of lines) {
    // Weight (lb)
    if (weightFound === null) {
      const w = /\b(?:weigh(?:ed|t|ing)?(?:\s+(?:is|was|in\s+at|at))?|(?:down|up)\s+to|scale(?:\s+said)?)\s+(\d{2,3}(?:\.\d+)?)\s*(?:lbs?|pounds?)\b/i.exec(line)
        || /\b(\d{2,3}(?:\.\d+)?)\s*(?:lbs?|pounds?)\s+(?:this morning|today)\b/i.exec(line);
      if (w) {
        const val = Number(w[1]);
        if (Number.isFinite(val) && val >= 60 && val <= 700) {
          weightFound = Math.round(val * 10) / 10;
          items.push({ kind: 'weight', id: `w-${items.length}`, requestId: crypto.randomUUID(), checked: true, applied: false, weightLb: weightFound });
          continue;
        }
      }
    }

    // Exercise
    const ex = /\b(?:went\s+(?:for\s+a\s+)?|did\s+(?:a\s+)?|finished\s+(?:a\s+)?|ran|walked|jogged|cycled|biked|rowed|swam|lifted|worked\s+out|workout|strength\s+training|yoga|pilates|cardio)\b/i.test(line);
    if (ex) {
      const minsMatch = /\b(\d{1,3})\s*(?:min(?:utes?)?)\b/i.exec(line);
      const kcalMatch = /\b(\d{2,4})\s*(?:k?cal(?:ories)?)\b/i.exec(line);
      const minutes = minsMatch ? Math.min(1440, Math.max(1, Number(minsMatch[1]))) : 25;
      const kcal = kcalMatch ? Math.max(1, Number(kcalMatch[1])) : Math.max(40, Math.round(minutes * 6));
      const desc = line.slice(0, 140);
      const key = desc.toLowerCase();
      if (!seenExercises.has(key)) {
        seenExercises.add(key);
        items.push({ kind: 'exercise', id: `ex-${items.length}`, requestId: crypto.randomUUID(), checked: true, applied: false, description: desc, minutes, kcal });
      }
      continue;
    }

    // Wins / Setbacks
    const winMatch = /\b(?:big\s+win|win|proud(?:\s+of|\s+that)?|milestone|stuck\s+to|hit\s+my\s+goal)\b[:\s-]*(.+)?/i.exec(line);
    const lossMatch = /\b(?:setback|binge[d]?|slipped|missed\s+my\s+goal|struggled\s+with|cheated\s+on)\b[:\s-]*(.+)?/i.exec(line);
    if (winMatch || lossMatch) {
      const outcome: 'win' | 'loss' = winMatch ? 'win' : 'loss';
      const title = line.slice(0, 100);
      const key = `${outcome}:${title.toLowerCase()}`;
      if (!seenOutcomes.has(key)) {
        seenOutcomes.add(key);
        items.push({ kind: 'outcome', id: `out-${items.length}`, requestId: crypto.randomUUID(), checked: true, applied: false, title, outcome, note: line.slice(0, 400), date: today });
      }
      continue;
    }

    // Meals
    const mealMatch = /\b(?:had|ate|eating|for\s+(?:breakfast|lunch|dinner|snack)|breakfast\s+(?:was|is)|lunch\s+(?:was|is)|dinner\s+(?:was|is)|drank)\b\s+(.+)/i.exec(line);
    if (mealMatch) {
      const desc = mealMatch[1].replace(/,?\s*(?:about|around)?\s*\d+\s*(?:k?cal(?:ories)?|g\s*(?:protein|carbs?|fat|fiber|sugar)).*$/i, '').trim() || line;
      const cleanDesc = desc.slice(0, 200);
      const key = cleanDesc.toLowerCase();
      if (cleanDesc.length >= 2 && !seenMeals.has(key)) {
        seenMeals.add(key);
        items.push({ kind: 'meal', id: `meal-${items.length}`, requestId: crypto.randomUUID(), checked: true, applied: false, description: cleanDesc, consumedAt: nowIso, total: parseNutrients(line) });
      }
    }
  }

  return items;
}

function normalizeServerExtract(raw: RawExtractResponse, now = Date.now()): ExtractedUpdateItem[] {
  const items: ExtractedUpdateItem[] = [];
  const nowIso = new Date(now).toISOString();
  const today = chicagoDate(now);

  if (Array.isArray(raw.meals)) {
    for (const entry of raw.meals) {
      const rec = asRecord(entry);
      const description = typeof entry === 'string' ? entry.trim()
        : rec && typeof rec.description === 'string' ? rec.description.trim()
        : rec && typeof rec.name === 'string' ? rec.name.trim()
        : rec && typeof rec.title === 'string' ? rec.title.trim() : '';
      if (!description) continue;
      const totalRec = rec ? asRecord(rec.total) : null;
      const total: MealTotal = {};
      const pick = (k: NutrientKey, max: number, ...aliases: string[]) => {
        const candidates = [totalRec?.[k], rec?.[k], ...aliases.map(a => rec?.[a])];
        for (const c of candidates) { const n = finiteIn(c, 0, max); if (n !== undefined) { total[k] = n; return; } }
      };
      pick('calories', 20000, 'kcal');
      pick('protein_g', 2000, 'protein');
      pick('carbs_g', 3000, 'carbs');
      pick('fat_g', 2000, 'fat');
      pick('fiber_g', 2000, 'fiber');
      pick('sugar_g', 2000, 'sugar');
      items.push({
        kind: 'meal', id: `meal-${items.length}`, requestId: crypto.randomUUID(), checked: true, applied: false,
        description: description.slice(0, 300),
        consumedAt: validIso(rec?.consumedAt) || validIso(rec?.at) || nowIso,
        total,
      });
    }
  }

  const weight = finiteIn(raw.weightLb, 60, 700);
  if (weight !== undefined) {
    items.push({ kind: 'weight', id: `w-${items.length}`, requestId: crypto.randomUUID(), checked: true, applied: false, weightLb: Math.round(weight * 10) / 10 });
  }

  if (Array.isArray(raw.exercises)) {
    for (const entry of raw.exercises) {
      const rec = asRecord(entry);
      const description = typeof entry === 'string' ? entry.trim()
        : rec && typeof rec.description === 'string' ? rec.description.trim()
        : rec && typeof rec.activity === 'string' ? rec.activity.trim()
        : rec && typeof rec.name === 'string' ? rec.name.trim() : '';
      if (!description) continue;
      const minutes = finiteIn(rec?.minutes, 1, 1440) ?? 25;
      const kcal = finiteIn(rec?.kcal, 1, 10000) ?? finiteIn(rec?.calories, 1, 10000) ?? Math.max(40, Math.round(minutes * 6));
      items.push({ kind: 'exercise', id: `ex-${items.length}`, requestId: crypto.randomUUID(), checked: true, applied: false, description: description.slice(0, 300), minutes, kcal });
    }
  }

  if (Array.isArray(raw.outcomes)) {
    for (const entry of raw.outcomes) {
      const rec = asRecord(entry);
      if (!rec) continue;
      const title = (typeof rec.title === 'string' ? rec.title : typeof rec.description === 'string' ? rec.description : '').trim();
      if (!title) continue;
      const rawKind = String(rec.outcome || rec.kind || rec.type || 'win').toLowerCase();
      const outcome: 'win' | 'loss' = rawKind === 'loss' || rawKind === 'setback' ? 'loss' : 'win';
      const note = typeof rec.note === 'string' ? rec.note.trim() : '';
      const date = typeof rec.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rec.date) ? rec.date : today;
      items.push({ kind: 'outcome', id: `out-${items.length}`, requestId: crypto.randomUUID(), checked: true, applied: false, title: title.slice(0, 120), outcome, note: note.slice(0, 400), date });
    }
  }

  return items;
}

function itemSummary(item: ExtractedUpdateItem): { badge: string; title: string; detail: string } {
  switch (item.kind) {
    case 'meal': {
      const parts = [
        item.total.calories != null ? `${Math.round(item.total.calories)} kcal` : '',
        item.total.protein_g != null ? `${Math.round(item.total.protein_g)} g protein` : '',
        item.total.carbs_g != null ? `${Math.round(item.total.carbs_g)} g carbs` : '',
        item.total.fat_g != null ? `${Math.round(item.total.fat_g)} g fat` : '',
      ].filter(Boolean);
      return { badge: 'Meal', title: item.description, detail: parts.join(' · ') || 'Manual meal log' };
    }
    case 'weight':
      return { badge: 'Weight', title: `${item.weightLb.toFixed(1)} lb`, detail: 'Owner weigh-in' };
    case 'exercise':
      return { badge: 'Exercise', title: item.description, detail: `${Math.round(item.minutes)} min · ~${Math.round(item.kcal)} kcal` };
    case 'outcome':
      return { badge: item.outcome === 'win' ? 'Win' : 'Setback', title: item.title, detail: item.note && item.note !== item.title ? item.note : item.date };
  }
}

async function applyItem(item: ExtractedUpdateItem): Promise<DataArea> {
  const nowIso = new Date().toISOString();
  switch (item.kind) {
    case 'meal':
      await libraryRequest({
        action: 'food_manual_log',
        dedupeKey: item.requestId,
        confirmConsumed: true,
        description: item.description,
        consumedAt: item.consumedAt,
        source: 'manual-entry',
        total: item.total,
      }, { foodGesture: true });
      return 'food';
    case 'weight':
      await libraryRequest({
        action: 'weight_add',
        requestId: item.requestId,
        value: item.weightLb,
        unit: 'lb',
        observedAt: nowIso,
        source: { type: 'owner-request', reference: `cupcake-web:${item.requestId}`, description: 'Extracted from voice transcript and confirmed by owner.' },
      });
      return 'weight';
    case 'exercise':
      await libraryRequest({
        action: 'exercise_log',
        requestId: item.requestId,
        description: item.description,
        performedAt: nowIso,
        minutes: Math.max(1, Math.round(item.minutes)),
        kcal: Math.max(1, Math.round(item.kcal)),
        basis: 'voice-estimate',
      });
      return 'exercise';
    case 'outcome':
      await libraryRequest({
        action: 'outcome_record',
        id: item.requestId,
        date: item.date,
        title: item.title,
        outcome: item.outcome,
        note: item.note,
        source: { type: 'owner-request', reference: `cupcake-web:${item.requestId}`, description: 'Extracted from voice transcript and confirmed by owner.' },
        metrics: {},
      });
      return 'outcome';
  }
}

/** 1-tap talk-to-update card: extracts meals, weight, exercise, and wins/setbacks from a transcript for confirmation before logging. */
export default function VoiceUpdatesCard({ transcriptText, onApplied }: { transcriptText: string; onApplied?: () => void }) {
  const trimmed = transcriptText.trim();
  const [extracting, setExtracting] = useState(false);
  const [applying, setApplying] = useState(false);
  const [items, setItems] = useState<ExtractedUpdateItem[] | null>(null);
  const [sourceMode, setSourceMode] = useState<'ai' | 'local' | null>(null);
  const [status, setStatus] = useState('');

  if (!trimmed) return null;

  const extract = async () => {
    if (extracting || applying) return;
    setExtracting(true);
    setStatus('');
    let parsed: ExtractedUpdateItem[] = [];
    let mode: 'ai' | 'local' = 'local';
    if (ACCOUNT_SESSIONS) {
      try {
        const res = await accountData<RawExtractResponse>({ action: 'voice_extract_updates', text: trimmed.slice(0, 16000) });
        parsed = normalizeServerExtract(res);
        mode = 'ai';
      } catch {
        parsed = extractUpdatesLocally(trimmed);
        mode = 'local';
      }
    } else {
      parsed = extractUpdatesLocally(trimmed);
    }
    setItems(parsed);
    setSourceMode(mode);
    if (!parsed.length) setStatus('No meal, weight, exercise, or win/setback updates detected in this transcript.');
    setExtracting(false);
  };

  const toggle = (id: string) => {
    setItems(current => current ? current.map(item => item.id === id && !item.applied ? { ...item, checked: !item.checked } : item) : null);
  };

  const pendingChecked = items ? items.filter(item => item.checked && !item.applied) : [];

  const applyChecked = async () => {
    if (!items || applying || !pendingChecked.length) return;
    setApplying(true);
    setStatus('');
    const changedAreas = new Set<DataArea>();
    let okCount = 0;
    const labels: string[] = [];
    const next: ExtractedUpdateItem[] = [];

    for (const item of items) {
      if (!item.checked || item.applied) {
        next.push(item);
        continue;
      }
      try {
        const area = await applyItem(item);
        changedAreas.add(area);
        okCount++;
        labels.push(itemSummary(item).badge);
        next.push({ ...item, applied: true, error: undefined });
      } catch (err) {
        next.push({ ...item, error: err instanceof Error ? err.message : 'Could not save this update.' });
      }
    }

    setItems(next);
    changedAreas.forEach(area => notifyDataChanged(area));
    if (okCount > 0) {
      onApplied?.();
      const uniqueLabels = Array.from(new Set(labels)).join(', ');
      const failedCount = pendingChecked.length - okCount;
      setStatus(failedCount > 0
        ? `Logged ${okCount} ${okCount === 1 ? 'update' : 'updates'} (${uniqueLabels}); ${failedCount} failed — retry above.`
        : `Logged ${okCount} ${okCount === 1 ? 'update' : 'updates'} (${uniqueLabels}).`);
    } else {
      setStatus('Could not save the selected updates. Check your connection and try again.');
    }
    setApplying(false);
  };

  return <section className="nx-voice-updates" aria-label="Extract updates from transcript">
    <div className="nx-voice-updates-head">
      <div>
        <strong>Log updates from this talk</strong>
        <small>{sourceMode === 'ai' ? 'AI-detected suggestions · review before saving' : sourceMode === 'local' ? 'Quick local scan · review before saving' : 'Pull out meals, weight, workouts, or wins in one tap'}</small>
      </div>
      <button type="button" className="nx-voice-updates-scan" disabled={extracting || applying} onClick={() => void extract()}>
        {extracting ? <><Loader2 size={14} className="cc-spin" aria-hidden="true" /> Scanning…</> : <><Sparkles size={14} aria-hidden="true" /> {items ? 'Re-scan' : 'Extract & log updates'}</>}
      </button>
    </div>

    {items && items.length > 0 && <ul className="nx-voice-updates-list">
      {items.map(item => {
        const info = itemSummary(item);
        return <li key={item.id} className={`${item.applied ? 'is-applied' : ''} ${item.error ? 'has-error' : ''}`}>
          <label>
            <input type="checkbox" checked={item.checked} disabled={item.applied || applying} onChange={() => toggle(item.id)} />
            <span className="nx-voice-update-body">
              <span className="nx-voice-update-top">
                <em className={`nx-voice-tag is-${item.kind}`}>{info.badge}</em>
                <strong>{info.title}</strong>
                {item.applied && <span className="nx-voice-done"><Check size={12} aria-hidden="true" /> Logged</span>}
              </span>
              <small>{info.detail}</small>
              {item.error && <small role="alert" className="nx-voice-update-err">{item.error}</small>}
            </span>
          </label>
        </li>;
      })}
    </ul>}

    {items && items.length > 0 && pendingChecked.length > 0 && <div className="nx-voice-updates-foot">
      <button type="button" className="cc-primary" disabled={applying} onClick={() => void applyChecked()}>
        {applying ? 'Applying…' : `Apply checked updates (${pendingChecked.length})`}
      </button>
    </div>}

    {status && <p role="status" className="nx-voice-updates-status">{status}</p>}
  </section>;
}
