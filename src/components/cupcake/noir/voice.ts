/** The one line the assistant says at the top of Today. Cupcake has attitude; Matthieu is calm. Pure and deterministic for a given state. */
export type TodayState = { persona: string; name: string; hour: number; meals: number; left: number | null; pace: number | null; mealHint: string | null };
export type TodayLine = { before: string; accent: string; after: string };
const n = (v: number) => Math.round(Math.abs(v)).toLocaleString('en-US');

export function todayLine(s: TodayState): TodayLine {
  const calm = s.persona === 'matthieu';
  const line = (before: string, accent: string, after = ''): TodayLine => ({ before, accent, after });
  if (!s.meals) {
    const meal = s.mealHint ? s.mealHint.toLowerCase() : s.hour < 11 ? 'breakfast' : s.hour < 16 ? 'lunch' : 'dinner';
    if (calm) return line(`Nothing logged yet, ${s.name}. `, `Start with ${meal}`, ' when you are ready.');
    return s.hour >= 14 ? line(`It is past two and I have nothing, ${s.name}. `, 'Show me a plate', '.') : line(`${s.hour < 12 ? 'Morning' : 'Afternoon'}, ${s.name}. `, `Show me ${meal}`, ' and I will do the math.');
  }
  if (s.left === null) return calm ? line('Logged and saved. ', 'Set a daily target', ' to see what is left.') : line('I am counting, but toward what? ', 'Give me a target', '.');
  if (s.left < 0) return calm ? line(`${n(s.left)} over today. `, 'Keep the evening light', '.') : line(`${n(s.left)} over. I saw that. `, 'Kitchen is closed', ', water is free.');
  if (s.pace !== null && s.pace > 0.12) return calm ? line(`${n(s.left)} left and ahead of pace. `, 'Ease into the evening', '.') : line(`${n(s.left)} left and you are running hot. `, 'Slow your roll', ' until dinner.');
  if (s.pace !== null && s.pace < -0.2) return calm ? line(`${n(s.left)} left, with room to eat. `, 'A proper meal', ' would serve you well.') : line(`${n(s.left)} left and you are under. `, 'Eat something real', ', not a handful of crackers.');
  if (s.hour >= 17) return calm ? line(`${n(s.left)} left for the evening. `, 'On pace', '.') : line(`${n(s.left)} left for tonight. `, 'Make dinner count', '.');
  return calm ? line(`${n(s.left)} left, steady and `, 'on pace', '.') : line(`${n(s.left)} left and right on pace. `, 'Look at you', '.');
}
