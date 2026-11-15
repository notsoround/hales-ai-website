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
    notfood: ['That doesn’t look like food.', 'Point the camera at your meal.'],
  },
};

const fill = (line: string, food = '') => line.replace('{food}', food).replace('{Food}', food.replace(/^(a|an) /, '').replace(/^./, c => c.toUpperCase()));

/** Picks a line for the scene, never the same line twice in a row. `random` is injectable for tests. */
export function pickQuip(voice: 'cupcake' | 'calm', guess: SceneGuess, last: string, random = Math.random): string {
  const pool = guess.food ? QUIPS[voice].named : QUIPS[voice][guess.scene];
  const options = pool.length > 1 ? pool.filter(line => fill(line, guess.food) !== last) : pool;
  return fill(options[Math.floor(random() * options.length) % options.length], guess.food);
}
