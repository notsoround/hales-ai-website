import type { Scene, SceneGuess } from './sceneGuess';

/**
 * What the assistant says about the camera view. Cupcake has attitude (the camera already says
 * "slow down, cowboy"); Matthieu stays calm. Rules for every line: short enough for one glance,
 * playful about things, never about people. A face only ever gets "say cheese", never a word on
 * who it is or how they look.
 */
type Lines = Record<Scene, readonly string[]> & { named: readonly string[] };

export const QUIPS: Record<'cupcake' | 'calm', Lines> = {
  cupcake: {
    named: ['Ooh, {food}. Shoot it.', '{Food}? I’m listening.', '{Food} spotted. Nice.', 'Is that {food}? Yes please.'],
    food: ['Now that looks good.', 'Ooh. Shoot it before I eat it.', 'Yes. That’s food. Go.', 'Okay chef, I see you.'],
    coffee: ['Coffee. The fourth macro.', 'Caffeine detected. Respect.'],
    booze: ['Happy hour, huh? It still counts.', 'Cheers. Those calories count too.'],
    drink: ['Liquid calories count too, cowboy.', 'A drink? Log it. It counts.'],
    kitchen: ['Getting warmer. Where’s the food?', 'Nice. Now show me what’s in it.'],
    paper: ['Paperwork? I eat food, not receipts.', 'Reading material. Not dinner.'],
    screen: ['Screens have zero protein.', 'That’s a screen, cowboy. Not lunch.'],
    dog: ['Hi, pup. You’re not on the menu.', 'Good dog. Still not lunch.'],
    cat: ['Hi, kitty. Not on the menu.', 'The cat is not a snack.'],
    person: ['Say cheese!', 'Say cheese! Now find me a plate.', 'Hi! I count food, not people.'],
    bathroom: ['Absolutely not. Wrong room.', 'Nope. Not in here, cowboy.'],
    gym: ['Look at you go. Protein after.', 'Lift it, then eat something good.'],
    store: ['Shopping? Stick to the list.', 'Snack aisle? I’m watching you.', 'Buy the protein. Skip the regret.'],
    restaurant: ['Eating out? Show me the plate.', 'Fancy. Order like you mean it.'],
    notfood: ['That’s not food.', 'I don’t think you can eat that.', 'Nope. Not food, cowboy.', 'Can’t eat that. Try again.'],
  },
  calm: {
    named: ['Looks like {food}.', '{Food} in view.'],
    food: ['That looks like a meal.', 'Food in view. Ready when you are.'],
    coffee: ['Coffee in view.'],
    booze: ['A drink. Worth logging.'],
    drink: ['A drink. It counts too.'],
    kitchen: ['Kitchen in view. Show the plate.'],
    paper: ['Paper in view. Point at the food.'],
    screen: ['That’s a screen. Point at the meal.'],
    dog: ['A dog. Point at the meal.'],
    cat: ['A cat. Point at the meal.'],
    person: ['Say cheese.', 'Someone’s in frame. Point at the meal.'],
    bathroom: ['Point the camera at your meal.'],
    gym: ['Nice work. Log a meal after.'],
    store: ['A shop. Your grocery list is in Food.'],
    restaurant: ['Eating out. Show the plate when it comes.'],
    notfood: ['That doesn’t look like food.', 'Point the camera at your meal.'],
  },
};

const fill = (line: string, food = '') => line.replace('{food}', food).replace('{Food}', food.replace(/^(a|an) /, '').replace(/^./, c => c.toUpperCase()));

/** What the camera already knows about today. Only whole numbers the camera itself shows; nothing else is read. */
export type QuipContext = { caloriesLeft?: number | null; proteinLeftG?: number | null; hour?: number };
const count = (value: number) => Math.round(Math.abs(value)).toLocaleString('en-US');
/** Lines about today that fit when food is in view. Each is true by construction from the numbers given. */
export function contextLines(voice: 'cupcake' | 'calm', context: QuipContext | undefined): string[] {
  if (!context) return [];
  const calm = voice === 'calm', lines: string[] = [], left = context.caloriesLeft, protein = context.proteinLeftG, hour = context.hour;
  if (typeof left === 'number' && Number.isFinite(left)) {
    if (left >= 100) lines.push(calm ? `${count(left)} kcal left today.` : `You’ve got ${count(left)} left. Spend it well.`);
    else if (left < 0) lines.push(calm ? 'Over target today. Log it anyway.' : `${count(left)} over already. I’m still logging it.`);
    else lines.push(calm ? 'Close to target today.' : 'Almost out for today. Choose wisely.');
  }
  if (typeof protein === 'number' && Number.isFinite(protein) && protein >= 20) lines.push(calm ? `${count(protein)} g of protein to go.` : `${count(protein)}g of protein to go. Just saying.`);
  if (typeof hour === 'number') {
    if (hour >= 21 || hour < 4) lines.push(calm ? 'A late one. It still counts.' : 'Late-night plate? I see everything.');
    else if (hour < 10) lines.push(calm ? 'Good start to the day.' : 'Breakfast. Look at you, functioning.');
  }
  return lines;
}

/** Picks a line for the scene, never the same line twice in a row. `random` is injectable for tests.
 *  With `context`, about every third food line is about today instead of the plate. */
export function pickQuip(voice: 'cupcake' | 'calm', guess: SceneGuess, last: string, random = Math.random, context?: QuipContext): string {
  if (guess.scene === 'food' && context) {
    const today = contextLines(voice, context).filter(line => line !== last);
    if (today.length && random() < 0.34) return today[Math.floor(random() * today.length) % today.length];
  }
  const pool = guess.food ? QUIPS[voice].named : QUIPS[voice][guess.scene];
  const options = pool.length > 1 ? pool.filter(line => fill(line, guess.food) !== last) : pool;
  return fill(options[Math.floor(random() * options.length) % options.length], guess.food);
}
