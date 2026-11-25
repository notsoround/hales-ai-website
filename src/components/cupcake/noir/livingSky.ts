/** Pure time-of-day + behavioral mood state machine for Tier 6 Living Sky & Mood Carrier.
 *  Never shames on empty mornings or missed check-ins; gives immediate visual relief on the first right move. */

export type DayPhase = 'dawn' | 'morning' | 'afternoon' | 'golden' | 'night';
export type SkyMood = 'rain' | 'mist' | 'sunbreak' | 'clear' | 'radiant';

export type SkyInputs = {
  hour: number;
  mealsToday: number;
  stepsToday: number;
  weighedToday: boolean;
  missedCallsCount: number;
  hasCommitment: boolean;
  commitmentDone: boolean;
  caloriesLeft: number | null;
  persona: 'cupcake' | 'matthieu';
};

export type SkyState = {
  phase: DayPhase;
  mood: SkyMood;
  tier: number;
  label: string;
  prompt: string;
  orbCue: string;
};

export function resolveDayPhase(hour: number): DayPhase {
  const normalized = Number.isFinite(hour) ? ((Math.floor(hour) % 24) + 24) % 24 : 12;
  if (normalized >= 5 && normalized < 8) return 'dawn';
  if (normalized >= 8 && normalized < 12) return 'morning';
  if (normalized >= 12 && normalized < 17) return 'afternoon';
  if (normalized >= 17 && normalized < 20) return 'golden';
  return 'night';
}

function skyLabel(phase: DayPhase, mood: SkyMood): string {
  if (phase === 'night') {
    if (mood === 'rain') return 'Night rain';
    if (mood === 'mist') return 'Quiet night';
    if (mood === 'sunbreak') return 'Moonlight break';
    if (mood === 'clear') return 'Starry clear';
    return 'Calm night glow';
  }
  if (mood === 'rain') return 'Quiet rain';
  if (mood === 'mist') return phase === 'dawn' || phase === 'morning' ? 'Morning mist' : 'Quiet overcast';
  if (mood === 'sunbreak') return 'Clouds parting';
  if (mood === 'clear') return phase === 'golden' ? 'Golden hour' : 'Clear sky';
  return phase === 'golden' ? 'Golden glow' : 'Radiant day';
}

export function resolveLivingSky(inputs: SkyInputs): SkyState {
  const phase = resolveDayPhase(inputs.hour);
  const calm = inputs.persona === 'matthieu';
  const pillars =
    (inputs.mealsToday > 0 ? 1 : 0) +
    (inputs.stepsToday >= 1500 ? 1 : 0) +
    (inputs.weighedToday ? 1 : 0);

  let mood: SkyMood;
  let tier: number;
  if (
    (inputs.commitmentDone && pillars >= 1) ||
    (inputs.mealsToday >= 2 && inputs.stepsToday >= 6000 && (inputs.caloriesLeft === null || inputs.caloriesLeft >= 0))
  ) {
    mood = 'radiant';
    tier = 4;
  } else if (
    (inputs.hasCommitment && pillars >= 1) ||
    (pillars >= 2 && (inputs.caloriesLeft === null || inputs.caloriesLeft >= -150))
  ) {
    mood = 'clear';
    tier = 3;
  } else if (inputs.hasCommitment || inputs.commitmentDone || pillars >= 1) {
    mood = 'sunbreak';
    tier = 2;
  } else if (inputs.missedCallsCount > 0) {
    mood = 'rain';
    tier = 0;
  } else {
    mood = 'mist';
    tier = 1;
  }

  const label = skyLabel(phase, mood);

  let prompt: string;
  let orbCue: string;
  if (mood === 'radiant') {
    prompt = calm ? 'Steady follow-through today.' : 'Right decision landed — sky wide open.';
    orbCue = calm ? 'Proud, grounded glow' : 'Lit up with you';
  } else if (mood === 'clear') {
    prompt = calm ? 'Momentum is holding steady.' : 'Clear skies — keep that rhythm rolling.';
    orbCue = calm ? 'Clear & steady' : 'Sunny momentum';
  } else if (mood === 'sunbreak') {
    prompt = inputs.commitmentDone
      ? calm
        ? 'Commitment checked — log a meal, steps, or weigh-in to open the sky.'
        : 'Checked off — log one real move to open the full sky.'
      : inputs.hasCommitment
        ? calm
          ? 'First light broke through — follow through when ready.'
          : 'Clouds parted. Lock in one win today.'
        : calm
          ? 'First signal is in — name one focus to brighten the day.'
          : 'Light broke through. Add one commitment to build on it.';
    orbCue = calm ? 'First light breaking' : 'Warming up';
  } else if (mood === 'rain') {
    prompt = calm
      ? 'Gentle rain — one quick check-in or decision clears the sky.'
      : 'Rainy stretch — make one move right now to break the clouds.';
    orbCue = calm ? 'Empathetic check-in' : 'Ready to catch up';
  } else {
    prompt = calm
      ? 'Calm horizon — name one small decision to start the day.'
      : 'Still morning mist — pick one move and bring out the sun.';
    orbCue = calm ? 'Waiting in calm mist' : 'Waiting on first light';
  }

  return { phase, mood, tier, label, prompt, orbCue };
}

export function commitmentSuggestions({
  hour,
  mealsToday,
  stepsToday,
  weighedToday,
  missedCallsCount,
  assistantName,
}: {
  hour: number;
  mealsToday: number;
  stepsToday: number;
  weighedToday: boolean;
  missedCallsCount: number;
  assistantName: string;
}): string[] {
  const out: string[] = [];
  const add = (text: string) => {
    if (out.length < 4 && !out.includes(text)) out.push(text);
  };
  if (missedCallsCount > 0) add(`Catch up with ${assistantName}`);
  if (mealsToday === 0) {
    add(hour < 11 ? 'Log breakfast' : hour < 16 ? 'Log lunch' : 'Log dinner');
  } else {
    add('Log next meal cleanly');
  }
  if (stepsToday < 6000) add('Walk 6,000 steps');
  if (!weighedToday) add('Quick weigh-in');
  add('10-minute reset');
  return out.slice(0, 4);
}

export type CommitmentActionKind = 'camera' | 'weigh' | 'fitness' | 'talk';

export function isCommitmentSatisfied(
  text: string,
  state: { mealsToday: number; stepsToday: number; weighedToday: boolean },
): boolean {
  const low = text.trim().toLowerCase();
  if (!low) return false;
  if (/\bweigh(?:-?in)?\b|\bscale\b/.test(low)) return state.weighedToday;
  const stepMatch = low.match(/(\d[\d,]*)\s*steps?\b/);
  if (stepMatch) {
    const goal = Number(stepMatch[1].replace(/,/g, ''));
    if (Number.isFinite(goal) && goal > 0) return state.stepsToday >= goal;
  }
  if (/\b(steps?|walk(?:ing)?)\b/.test(low)) return state.stepsToday >= 6000;
  if (/\bnext\s+meal\b/.test(low)) return state.mealsToday >= 2;
  if (/\b(breakfast|lunch|dinner|meal)\b/.test(low)) return state.mealsToday > 0;
  return false;
}

export function commitmentActionKind(text: string): CommitmentActionKind | null {
  const low = text.trim().toLowerCase();
  if (!low) return null;
  if (/\b(breakfast|lunch|dinner|meal)\b/.test(low)) return 'camera';
  if (/\bweigh(?:-?in)?\b/.test(low)) return 'weigh';
  if (/\b(steps?|walk(?:ing)?|exercise|workout)\b/.test(low)) return 'fitness';
  if (/\b(catch\s*up|talk|call)\b/.test(low)) return 'talk';
  return null;
}
