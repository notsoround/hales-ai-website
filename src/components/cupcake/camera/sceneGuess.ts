/**
 * Turns an on-device guess about the camera view into a scene the assistant can comment on.
 * Input is the ImageNet class index (EfficientNet-Lite0, 1000 classes, no background) with its
 * score, and how many faces the face detector is sure about. Pure, so it is unit tested.
 * People are never identified or described: a face only ever means "someone is in frame".
 */
export type Scene = 'food' | 'drink' | 'coffee' | 'booze' | 'kitchen' | 'paper' | 'screen' | 'dog' | 'cat' | 'person' | 'bathroom' | 'gym' | 'notfood';
export type SceneGuess = { scene: Scene; food?: string };
export type Guess = { index: number; score: number };

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const set = (...groups: (number | number[])[]) => new Set(groups.flat());

/** Friendly names for foods the model knows well. Everything else in FOOD is just "food". */
export const FOOD_NAMES: Record<number, string> = {
  924: 'guacamole', 925: 'soup', 926: 'hot pot', 927: 'dessert', 928: 'ice cream', 929: 'a popsicle', 930: 'bread',
  931: 'a bagel', 932: 'a pretzel', 933: 'a burger', 934: 'a hot dog', 935: 'mashed potatoes', 937: 'broccoli',
  938: 'cauliflower', 939: 'zucchini', 943: 'cucumber', 945: 'peppers', 947: 'mushrooms', 948: 'an apple',
  949: 'strawberries', 950: 'an orange', 951: 'a lemon', 953: 'pineapple', 954: 'a banana', 957: 'pomegranate',
  959: 'pasta', 962: 'meatloaf', 963: 'pizza', 964: 'pot pie', 965: 'a burrito', 987: 'corn',
  118: 'crab', 119: 'crab', 121: 'crab', 122: 'lobster', 123: 'lobster', 124: 'crawfish',
};
const FOOD = set(range(924, 957), range(959, 965), 987, 118, 119, 121, 122, 123, 124, 923, 809, 659, 868);
const COFFEE = set(967, 968, 504, 505, 550);
const BOOZE = set(966, 440, 441, 907, 901, 572);
const DRINK = set(969, 898, 737, 899, 849, 725);
const KITCHEN = set(567, 909, 544, 813, 532, 760, 651, 827, 521, 859, 618, 910, 499, 828, 647, 766, 891, 469, 534);
const PAPER = set(922, 549, 916, 921, 918, 917, 446, 692, 478);
const SCREEN = set(620, 664, 782, 851, 527, 508, 810, 487, 590, 673, 878, 681);
const DOG = set(range(151, 268));
const CAT = set(range(281, 285));
const BATHROOM = set(861, 999, 896, 435, 794, 876);
const GYM = set(422, 543, 747);

/** Below this the model is guessing; say nothing rather than something wrong. */
export const MIN_SCORE = 0.35;
/** Food needs less: plates, bowls and dishes split the vote, and missing a meal is worse than a cheeky line. */
export const FOOD_SCORE = 0.25;
/** A food is named only when the model is this sure of that one dish. */
export const NAME_SCORE = 0.55;
/** "Not food" needs a confident non-food guess, so a blurry plate never gets told off. */
export const NOT_FOOD_SCORE = 0.5;

const GROUPS: [Scene, Set<number>][] = [['coffee', COFFEE], ['booze', BOOZE], ['drink', DRINK], ['kitchen', KITCHEN], ['paper', PAPER], ['screen', SCREEN], ['dog', DOG], ['cat', CAT], ['bathroom', BATHROOM], ['gym', GYM]];
export const groupOf = (index: number): Scene | null => FOOD.has(index) ? 'food' : GROUPS.find(([, members]) => members.has(index))?.[0] ?? null;

/** `top` is the classifier's best few guesses; scores of one kind add up (three cat breeds are one cat). */
export function sceneFor(top: Guess[], faces: number): SceneGuess | null {
  if (faces > 0) return { scene: 'person' };
  const votes = new Map<Scene, number>();
  let other = 0;
  for (const guess of top) { const group = groupOf(guess.index); if (group) votes.set(group, (votes.get(group) ?? 0) + guess.score); else other = Math.max(other, guess.score); }
  if ((votes.get('food') ?? 0) >= FOOD_SCORE) {
    const dish = top.find(guess => FOOD_NAMES[guess.index] && guess.score >= NAME_SCORE);
    return dish ? { scene: 'food', food: FOOD_NAMES[dish.index] } : { scene: 'food' };
  }
  votes.delete('food');
  const [scene, score] = [...votes].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
  if (scene && score >= MIN_SCORE && score >= other) return { scene };
  return other >= NOT_FOOD_SCORE ? { scene: 'notfood' } : null;
}

export const sameScene = (a: SceneGuess | null, b: SceneGuess | null) => !!a && !!b && a.scene === b.scene && a.food === b.food;
