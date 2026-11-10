/** Turn pasted or uploaded plan text (a routine, a meal plan, notes from a coach) into
 *  planner meals. Display/draft only: nothing is saved until the owner presses Save. */
export type ImportedMeal = { name: string; items: string[]; kcal: string };
const BULLET = /^(?:[-*+•▪◦]|\d+[.)]|\[[ xX]\])\s+(.*)$/;
const KCAL = /(\d{2,5})\s*(?:kcal|cal(?:ories)?)\b/i;
const NAMED = /^(?:day\s*\d+|week\s*\d+|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:rs(?:day)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?|breakfast|brunch|lunch|dinner|supper|snacks?|pre-?workout|post-?workout|meal\s*\d+)\b/i;
export function parsePlanText(text: string, limit = 10): ImportedMeal[] {
  const meals: ImportedMeal[] = [];
  let current: ImportedMeal | null = null;
  const start = (name: string) => { current = { name: name.slice(0, 300), items: [], kcal: '' }; meals.push(current); return current; };
  for (const raw of text.split(/\r\n|\n|\r/)) {
    const line = raw.trim();
    if (!line || /^([-*_=])\1{2,}$/.test(line)) continue;
    const bullet = line.match(BULLET);
    const heading = !bullet && (/^#{1,6}\s+/.test(line) || /:\s*$/.test(line) || NAMED.test(line) && line.length <= 60);
    if (heading) {
      const name = line.replace(/^#{1,6}\s+/, '').replace(/:\s*$/, '').trim();
      const meal = start(name.replace(KCAL, '').replace(/[\s·,(–-]+\)?$/, '').trim() || name);
      const kcal = name.match(KCAL); if (kcal) meal.kcal = kcal[1];
      continue;
    }
    const meal: ImportedMeal = current || start(`Meal ${meals.length + 1}`);
    const item = (bullet ? bullet[1] : line).trim();
    if (item && meal.items.join('\n').length + item.length < 4900) meal.items.push(item);
  }
  return meals.filter(meal => meal.items.length || meal.name).slice(0, limit);
}
