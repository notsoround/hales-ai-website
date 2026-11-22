type StorageProvider = (kind: 'localStorage' | 'sessionStorage') => Storage;
let pantryStorageProvider: StorageProvider | null = null;

/** Register the account-scoped personalStorage helper in browser contexts without breaking Node SSR tests. */
export function registerPantryStorage(provider: StorageProvider) {
  pantryStorageProvider = provider;
}

function getPantryStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return pantryStorageProvider ? pantryStorageProvider('localStorage') : null;
  } catch {
    return null;
  }
}

/** "Notes: buy ripe fruit" is a note, not something to buy (an explicit "- [ ] Note: …" task stays an item). */
const NOTE_LINE = /^\s*(?:[-+*][ \t]+)?(?:notes?|reminder|tip)\s*:\s*\S/i;
export type GroceryItem = { line: number; label: string; checked: boolean; start: number; end: number; marker: number | null; insert: number; bullet: boolean };
/** Parse a view only. Preserve every original byte until a particular item is toggled. */
export function groceryItems(text: string): GroceryItem[] {
  const lines = text.split(/(\r\n|\n|\r)/), items: GroceryItem[] = [];
  let start = 0, fence = '';
  for (let at = 0; at < lines.length; at += 2) {
    const raw = lines[at], end = start + raw.length, line = at / 2;
    const code = raw.match(/^\s*(`{3,}|~{3,})/);
    if (code) { if (!fence) fence = code[1][0]; else if (code[1][0] === fence) fence = ''; }
    else if (!fence && raw.trim() && !/^\s*(?:#|>|\||\d+[.)]\s|[-*_]{3,}\s*$|[^:]+:\s*$)/.test(raw)) {
      const task = raw.match(/^(\s*(?:[-+*][ \t]+)?\[)([ xX])(\][ \t]+)(\S.*)$/);
      if (!task && NOTE_LINE.test(raw)) { start = end + (lines[at + 1]?.length || 0); continue; }
      const bullet = raw.match(/^(\s*[-+*][ \t]+)(\S.*)$/);
      const indent = raw.match(/^\s*/)?.[0].length || 0;
      items.push({ line, label: (task?.[4] || bullet?.[2] || raw).trim(), checked: !!task && task[2].toLowerCase() === 'x',
        start, end, marker: task ? start + task[1].length : null, insert: start + (bullet ? bullet[1].length : indent), bullet: !!bullet });
    }
    start = end + (lines[at + 1]?.length || 0);
  }
  return items;
}
/** Markdown-style section headings (# Produce) shown as checklist group labels; display only. */
export function groceryHeadings(text: string): { line: number; label: string }[] {
  const lines = text.split(/\r\n|\n|\r/), headings: { line: number; label: string }[] = [];
  let fence = '';
  lines.forEach((raw, line) => {
    const code = raw.match(/^\s*(`{3,}|~{3,})/);
    if (code) { if (!fence) fence = code[1][0]; else if (code[1][0] === fence) fence = ''; return; }
    const heading = !fence && raw.match(/^\s*#{1,6}\s+(\S.*)$/);
    if (heading) headings.push({ line, label: heading[1].replace(/\s*#+\s*$/, '').trim() });
  });
  return headings;
}
/** Lines kept in the text but not on the checklist (notes and > quotes), shown read-only beside it. */
export function groceryNotes(text: string): { line: number; text: string }[] {
  const lines = text.split(/\r\n|\n|\r/), notes: { line: number; text: string }[] = [];
  let fence = '';
  lines.forEach((raw, line) => {
    const code = raw.match(/^\s*(`{3,}|~{3,})/);
    if (code) { if (!fence) fence = code[1][0]; else if (code[1][0] === fence) fence = ''; return; }
    if (fence || /^\s*(?:[-+*][ \t]+)?\[[ xX]\]/.test(raw)) return;
    const quote = raw.match(/^\s*>\s?(\S.*)$/);
    if (quote) notes.push({ line, text: quote[1].trim() });
    else if (NOTE_LINE.test(raw)) notes.push({ line, text: raw.replace(/^\s*[-+*][ \t]+/, '').trim() });
  });
  return notes;
}
export function checkGroceryItem(text: string, line: number, checked: boolean): string {
  const item = groceryItems(text).find(item => item.line === line);
  if (!item) return text;
  if (item.marker !== null) return text.slice(0, item.marker) + (checked ? 'x' : ' ') + text.slice(item.marker + 1);
  if (!checked) return text;
  return text.slice(0, item.insert) + (item.bullet ? '[x] ' : '- [x] ') + text.slice(item.insert);
}

const groceryKey = (label: string) => label.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();

/** Match exact item wording only; different quantities remain distinct. */
export function missingGroceryItems(text: string, plannedItems: readonly string[]): string[] {
  const known = new Set(groceryItems(text).map(item => groceryKey(item.label)));
  return plannedItems.flatMap(item => {
    const label = item.trim(), key = groceryKey(label);
    if (!key || known.has(key)) return [];
    known.add(key);
    return [label];
  });
}

/** Append only: never rewrite notes, quantities, line endings or checked items. */
export function appendGroceryItems(text: string, selected: readonly string[]): string {
  const additions = missingGroceryItems(text, selected);
  if (!additions.length) return text;
  const newline = text.match(/\r\n|\n|\r/)?.[0] || '\n';
  const next = text + (text && !/[\r\n]$/.test(text) ? newline : '') + additions.map(label => `- [ ] ${label}`).join(newline);
  const visible = new Set(groceryItems(next).map(item => groceryKey(item.label)));
  if (additions.some(label => !visible.has(groceryKey(label)))) throw Error('Close any unfinished code block in Grocery notes before adding meal items. Your notes are unchanged.');
  if (next.length > 10000) throw Error('These items would exceed the grocery-note limit. Choose fewer items or shorten your notes.');
  return next;
}

/* ---------- Smart grocery triage (client-side categorization for pasted notes / texts) ---------- */

export const GROCERY_CATEGORIES = ['Produce', 'Protein', 'Dairy', 'Pantry', 'Household', 'Notes'] as const;
export type GroceryCategory = typeof GROCERY_CATEGORIES[number];
export type TriagedGroceryItem = { id: string; label: string; category: GroceryCategory };

const CATEGORY_RULES: ReadonlyArray<[Exclude<GroceryCategory, 'Notes'>, RegExp]> = [
  ['Household', /\b(paper\s*towels?|toilet\s*paper|tp|napkins?|tissues?|trash\s*bags?|garbage\s*bags?|foil|aluminum\s*foil|plastic\s*wrap|parchment|ziploc|zip\s*bags?|sponge|dish\s*soap|dishwasher|detergent|laundry|soap|shampoo|conditioner|toothpaste|deodorant|cleaning|bleach|wipes|batteries|light\s*bulbs?|candles?|cat\s*litter|dog\s*food|pet\s*food)\b/i],
  ['Produce', /\b(apple|apples|banana|bananas|berr(?:y|ies)|strawberr(?:y|ies)|blueberr(?:y|ies)|raspberr(?:y|ies)|blackberr(?:y|ies)|avocado|avocados|spinach|kale|arugula|lettuce|greens?|salad|broccoli|cauliflower|carrot|carrots|celery|cucumber|cucumbers|tomato|tomatoes|onion|onions|garlic|ginger|pepper|peppers|jalapeno|jalapeño|zucchini|squash|mushroom|mushrooms|potato|potatoes|sweet\s*potato(?:es)?|asparagus|green\s*beans?|peas|corn|lemon|lemons|lime|limes|orange|oranges|grapefruit|grape|grapes|melon|watermelon|cantaloupe|mango|pineapple|peach|peaches|pear|pears|plum|cilantro|parsley|basil|mint|scallions?|shallots?|cabbage|beets?|radish|produce|fruit|veg(?:gies|etables)?)\b/i],
  ['Protein', /\b(chicken|turkey|beef|steak|ground\s*(?:beef|turkey|chicken|pork)|pork|bacon|sausage|ham|lamb|bison|salmon|tuna|shrimp|cod|tilapia|halibut|trout|fish|seafood|eggs?|egg\s*whites?|tofu|tempeh|edamame|seitan|deli|rotisserie|protein\s*(?:powder|shake|bars?)|whey|jerky|sardines?|crab|scallops?)\b/i],
  ['Dairy', /\b(milk|almond\s*milk|oat\s*milk|soy\s*milk|yogurt|greek\s*yogurt|skyr|kefir|cheese|cheddar|mozzarella|parmesan|feta|gouda|brie|cottage\s*cheese|cream\s*cheese|sour\s*cream|butter|ghee|heavy\s*cream|half\s*and\s*half|creamer|whipped\s*cream|ricotta)\b/i],
  ['Pantry', /\b(oats?|oatmeal|rice|brown\s*rice|quinoa|pasta|noodles?|bread|sourdough|bagels?|tortillas?|wraps?|pita|crackers?|chips?|cereal|granola|flour|sugar|honey|maple\s*syrup|olive\s*oil|avocado\s*oil|coconut\s*oil|oil|vinegar|soy\s*sauce|tamari|hot\s*sauce|salsa|marinara|tomato\s*sauce|broth|stock|beans?|black\s*beans?|chickpeas?|lentils?|peanut\s*butter|almond\s*butter|tahini|nuts?|almonds?|walnuts?|cashews?|pecans?|pistachios?|chia|flax|hemp|seeds?|coffee|tea|espresso|matcha|spices?|salt|peppercorns?|cinnamon|vanilla|baking|chocolate|cocoa|jam|jelly|hummus|pickles?|olives?|canned|soup|coconut\s*milk|electrolytes?)\b/i],
];

const FLUFF_PREFIX = /^(?:hey(?:\s+there)?|hi|please|pls|can\s+you(?:\s+please)?|could\s+you|grab|pick\s+up|get|buy|we\s+need(?:\s+to\s+get)?|need(?:\s+to\s+buy)?|don'?t\s+forget(?:\s+to\s+get)?|also(?:\s+grab|\s+get|\s+need)?|and\s+also|shopping\s+list|grocery\s+list|groceries)\b[\s:,-]*/i;
const NOTE_SIGNAL = /^(?:notes?|reminder|remind(?:\s+me)?|tip|remember|don'?t\s+forget\s+to\s+(?:check|ask|bring)|make\s+sure|ask\s+the|check\s+if\s+we|if\s+they\s+have|only\s+if|try\s+to\s+find|brand\s*:)\b/i;

const EXPLICIT_HEADING: ReadonlyArray<[GroceryCategory, RegExp]> = [
  ['Produce', /^(?:produce|fruits?\s*(?:&|and)?\s*veg(?:gies|etables)?|fresh)$/i],
  ['Protein', /^(?:protein|meat|meats|seafood|meat\s*(?:&|and)?\s*seafood|poultry|fish)$/i],
  ['Dairy', /^(?:dairy|dairy\s*(?:&|and)?\s*eggs?|refrigerated|cold|fridge)$/i],
  ['Pantry', /^(?:pantry|dry\s*goods?|grains?|snacks?|staples?|frozen|bakery|beverages?|drinks?)$/i],
  ['Household', /^(?:household|home|cleaning|toiletries|personal\s*care|supplies|paper\s*goods?)$/i],
  ['Notes', /^(?:notes?|reminders?|tips?)$/i],
];

function matchExplicitCategory(heading: string): GroceryCategory | null {
  const clean = heading.replace(/^#{1,6}\s*/, '').replace(/:\s*$/, '').trim();
  for (const [cat, pattern] of EXPLICIT_HEADING) if (pattern.test(clean)) return cat;
  return null;
}

export function categorizeGroceryLabel(label: string, fallback: Exclude<GroceryCategory, 'Notes'> = 'Pantry'): GroceryCategory {
  const trimmed = label.trim();
  if (!trimmed) return 'Notes';
  if (NOTE_SIGNAL.test(trimmed)) return 'Notes';
  for (const [category, regex] of CATEGORY_RULES) if (regex.test(trimmed)) return category;
  return fallback;
}

function cleanTriagedPhrase(raw: string): string {
  let out = raw.replace(/^\s*(?:(?:[-*+•▪◦]|\d+[.)])\s*(?:\[[ xX]\]\s*)?|\[[ xX]\]\s*)/, '').trim();
  out = out.replace(/^and\s+/i, '').trim();
  let prev = '';
  while (out && out !== prev) {
    prev = out;
    out = out.replace(FLUFF_PREFIX, '').trim();
  }
  return out.replace(/[.!]+$/, '').trim();
}

/** Parse messy pasted grocery lists, texts, or coach notes into categorized checklist items. */
export function triageGroceryText(rawText: string, limit = 60): TriagedGroceryItem[] {
  const items: TriagedGroceryItem[] = [];
  const seen = new Set<string>();
  let currentCategory: GroceryCategory | null = null;

  for (const rawLine of rawText.split(/\r\n|\n|\r/)) {
    const line = rawLine.trim();
    if (!line || /^([-*_=])\1{2,}$/.test(line)) continue;

    // Recognize explicit section headings like "# Produce" or "Protein:"
    const isHeading = /^#{1,6}\s+/.test(line) || (/^[A-Za-z &/]{2,30}:\s*$/.test(line) && !NOTE_LINE.test(line));
    if (isHeading) {
      const matched = matchExplicitCategory(line);
      if (matched) currentCategory = matched;
      continue;
    }

    // Preserve explicit note/quote lines verbatim as Notes
    if (NOTE_LINE.test(line) || /^>\s*/.test(line)) {
      const noteBody = line.replace(/^>\s*/, '').replace(/^\s*(?:[-+*]\s+)?/, '').trim();
      const key = groceryKey(noteBody);
      if (noteBody && !seen.has(key)) {
        seen.add(key);
        items.push({ id: `triage-${items.length}`, label: noteBody, category: 'Notes' });
      }
      continue;
    }

    // Split natural comma/semicolon lists (e.g. from texts: "chicken, 2 avocados, and remind me to check olive oil")
    const segments = line.includes(',') || line.includes(';')
      ? line.split(/\s*(?:;|,(?:\s+and\b)?)\s*/i)
      : [line];

    for (const seg of segments) {
      if (items.length >= limit) break;
      const cleaned = cleanTriagedPhrase(seg);
      if (!cleaned || cleaned.length > 160) continue;
      // If a single line contains "remind me..." mid-sentence after "and", route it as a Note
      const isNote = currentCategory === 'Notes' || NOTE_SIGNAL.test(cleaned);
      const label = isNote
        ? (/^(?:notes?|reminder|tip)\s*:/i.test(cleaned) ? cleaned : `Notes: ${cleaned}`)
        : cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
      const key = groceryKey(label);
      if (seen.has(key)) continue;
      seen.add(key);
      const category: GroceryCategory = isNote
        ? 'Notes'
        : currentCategory && currentCategory !== 'Notes'
          ? categorizeGroceryLabel(label, currentCategory) === 'Pantry' && !CATEGORY_RULES[4][1].test(label)
            ? currentCategory
            : categorizeGroceryLabel(label, currentCategory)
          : categorizeGroceryLabel(label, 'Pantry');
      items.push({ id: `triage-${items.length}`, label, category });
    }
  }
  return items;
}

/** Append triaged items neatly under Markdown category headings without rewriting existing notes/checked items. */
export function appendCategorizedGroceries(text: string, triaged: readonly Pick<TriagedGroceryItem, 'label' | 'category'>[]): string {
  if (!triaged.length) return text;
  const newline = text.match(/\r\n|\n|\r/)?.[0] || '\n';
  const existingKeys = new Set(groceryItems(text).map(item => groceryKey(item.label)));
  const existingNotes = new Set(groceryNotes(text).map(note => groceryKey(note.text)));
  const grouped = new Map<GroceryCategory, string[]>();

  for (const entry of triaged) {
    const label = entry.label.trim();
    if (!label) continue;
    if (entry.category === 'Notes') {
      const normalizedNote = /^(?:notes?|reminder|tip)\s*:/i.test(label) ? label : `Notes: ${label}`;
      const key = groceryKey(normalizedNote);
      if (existingNotes.has(key)) continue;
      existingNotes.add(key);
      const list = grouped.get('Notes') || [];
      list.push(normalizedNote);
      grouped.set('Notes', list);
      continue;
    }
    const key = groceryKey(label);
    if (existingKeys.has(key)) continue;
    existingKeys.add(key);
    const list = grouped.get(entry.category) || [];
    list.push(label);
    grouped.set(entry.category, list);
  }

  if (!grouped.size) return text;

  const blocks: string[] = [];
  for (const category of GROCERY_CATEGORIES) {
    const list = grouped.get(category);
    if (!list?.length) continue;
    if (category === 'Notes') {
      blocks.push(list.join(newline));
    } else {
      blocks.push(`# ${category}${newline}${list.map(label => `- [ ] ${label}`).join(newline)}`);
    }
  }

  const separator = text ? (text.endsWith('\n') || text.endsWith('\r') ? newline : newline + newline) : '';
  const next = text + separator + blocks.join(newline + newline);
  if (next.length > 10000) throw Error('These items would exceed the grocery-note limit. Choose fewer items or shorten your notes.');
  return next;
}

/* ---------- Household Pantry / Supply Loop (owner-scoped estimated local inventory) ---------- */

export const PANTRY_STORAGE_KEY = 'cupcake-household-pantry-v1';
export const PANTRY_CHANGED_EVENT = 'cupcake-pantry-changed';

export type PantryItem = {
  id: string;
  name: string;
  category: Exclude<GroceryCategory, 'Notes'>;
  servings: number;
  manualUsed: number;
  addedAt: string;
  sourceReceiptId?: string;
  sourceMerchant?: string;
  markedLow?: boolean;
};

export type EstimatedPantryItem = PantryItem & {
  matchedMealsCount: number;
  estimatedRemaining: number;
  status: 'stocked' | 'low';
};

const GROCERY_MERCHANT_RE = /\b(trader\s*joe|whole\s*foods|costco|kroger|aldi|sprouts|h-?e-?b|safeway|publix|wegmans|jewel|mariano|meijer|target|walmart|sam'?s\s*club|food\s*lion|shoprite|ralphs|vons|albertsons|hy-?vee|fresh\s*market|erewhon|market|grocer|grocery|supermarket|co-?op|mart|butcher|produce|farm\s*stand)\b/i;
const RECEIPT_NON_FOOD_LINE_RE = /\b(subtotal|sub\s*total|tax|sales\s*tax|total|balance|change|cash|visa|mastercard|amex|debit|credit|bag\s*fee|bottle\s*deposit|crv|discount|coupon|savings|member|loyalty|points|tip|gratuity)\b/i;
const FOOD_STOPWORDS = new Set(['organic', 'fresh', 'raw', 'large', 'small', 'medium', 'extra', 'whole', 'sliced', 'chopped', 'diced', 'frozen', 'canned', 'dried', 'plain', 'unsweetened', 'sweetened', 'natural', 'pack', 'bag', 'box', 'bottle', 'can', 'jar', 'carton', 'bunch', 'pound', 'pounds', 'ounce', 'ounces', 'liter', 'liters', 'count', 'with', 'and', 'the', 'for', 'from', 'style', 'brand', 'grade', 'free', 'low', 'fat', 'reduced', 'light', 'zero', 'meal', 'bowl', 'plate', 'side']);

function emitPantryChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(PANTRY_CHANGED_EVENT));
}

function defaultServingsFor(category: Exclude<GroceryCategory, 'Notes'>): number {
  if (category === 'Produce') return 4;
  if (category === 'Protein') return 4;
  if (category === 'Dairy') return 5;
  if (category === 'Household') return 8;
  return 6;
}

export function isGroceryReceipt(receipt: { merchant?: string | null; lineItems?: readonly { description: string }[] }): boolean {
  if (receipt.merchant && GROCERY_MERCHANT_RE.test(receipt.merchant)) return true;
  const items = receipt.lineItems || [];
  if (!items.length) return false;
  let foodHits = 0;
  for (const item of items) {
    if (RECEIPT_NON_FOOD_LINE_RE.test(item.description)) continue;
    const cat = categorizeGroceryLabel(item.description);
    if (cat === 'Produce' || cat === 'Protein' || cat === 'Dairy') foodHits++;
  }
  return foodHits >= 2;
}

export function readPantryItems(): PantryItem[] {
  const storage = getPantryStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(PANTRY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is PantryItem =>
      !!item && typeof item === 'object'
      && typeof item.id === 'string'
      && typeof item.name === 'string' && item.name.trim().length > 0
      && typeof item.servings === 'number' && Number.isFinite(item.servings)
      && typeof item.manualUsed === 'number' && Number.isFinite(item.manualUsed)
      && typeof item.addedAt === 'string'
    );
  } catch {
    return [];
  }
}

export function writePantryItems(items: readonly PantryItem[]): boolean {
  const storage = getPantryStorage();
  if (!storage) return false;
  try {
    storage.setItem(PANTRY_STORAGE_KEY, JSON.stringify(items.slice(0, 120)));
    emitPantryChanged();
    return true;
  } catch {
    return false;
  }
}

export function addPantryItem(name: string, options?: { servings?: number; sourceReceiptId?: string; sourceMerchant?: string }): PantryItem[] {
  const clean = name.trim().replace(/\s+/g, ' ').slice(0, 120);
  if (!clean) return readPantryItems();
  const rawCategory = categorizeGroceryLabel(clean);
  const category: Exclude<GroceryCategory, 'Notes'> = rawCategory === 'Notes' ? 'Pantry' : rawCategory;
  const current = readPantryItems();
  const key = groceryKey(clean);
  const now = new Date().toISOString();
  const existingIndex = current.findIndex(item => groceryKey(item.name) === key);
  const servings = options?.servings && options.servings > 0 ? Math.round(options.servings) : defaultServingsFor(category);
  if (existingIndex >= 0) {
    const updated = current.map((item, idx) => idx === existingIndex ? {
      ...item,
      servings: Math.min(30, item.servings + servings),
      manualUsed: 0,
      markedLow: false,
      addedAt: now,
      ...(options?.sourceReceiptId ? { sourceReceiptId: options.sourceReceiptId } : {}),
      ...(options?.sourceMerchant ? { sourceMerchant: options.sourceMerchant } : {}),
    } : item);
    writePantryItems(updated);
    return updated;
  }
  const next: PantryItem[] = [{
    id: `pantry_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    name: clean.charAt(0).toUpperCase() + clean.slice(1),
    category,
    servings,
    manualUsed: 0,
    addedAt: now,
    ...(options?.sourceReceiptId ? { sourceReceiptId: options.sourceReceiptId } : {}),
    ...(options?.sourceMerchant ? { sourceMerchant: options.sourceMerchant } : {}),
  }, ...current];
  writePantryItems(next);
  return next;
}

export function routeReceiptToPantry(receipt: {
  id: string;
  merchant?: string | null;
  date?: string | null;
  lineItems?: readonly { description: string; quantity?: number | null }[];
}): { added: number; items: PantryItem[] } {
  const lines = (receipt.lineItems || []).filter(item => {
    const desc = item.description?.trim();
    return !!desc && desc.length >= 2 && !RECEIPT_NON_FOOD_LINE_RE.test(desc);
  });
  let current = readPantryItems();
  let added = 0;
  for (const line of lines.slice(0, 40)) {
    const clean = line.description.replace(/\s+\$?\d+(?:\.\d{2})?\s*$/, '').trim();
    if (!clean) continue;
    const rawCategory = categorizeGroceryLabel(clean);
    const category: Exclude<GroceryCategory, 'Notes'> = rawCategory === 'Notes' ? 'Pantry' : rawCategory;
    const qty = typeof line.quantity === 'number' && Number.isFinite(line.quantity) && line.quantity > 1 ? Math.min(6, Math.round(line.quantity)) : 1;
    current = addPantryItem(clean, {
      servings: defaultServingsFor(category) * qty,
      sourceReceiptId: receipt.id,
      sourceMerchant: receipt.merchant || undefined,
    });
    added++;
  }
  return { added, items: current };
}

export function markPantryItemUsed(id: string, delta = 1): PantryItem[] {
  const current = readPantryItems();
  const next = current.map(item => item.id === id ? { ...item, manualUsed: Math.max(0, item.manualUsed + delta) } : item);
  writePantryItems(next);
  return next;
}

export function restockPantryItem(id: string): PantryItem[] {
  const current = readPantryItems();
  const now = new Date().toISOString();
  const next = current.map(item => item.id === id ? { ...item, servings: defaultServingsFor(item.category), manualUsed: 0, markedLow: false, addedAt: now } : item);
  writePantryItems(next);
  return next;
}

export function removePantryItem(id: string): PantryItem[] {
  const next = readPantryItems().filter(item => item.id !== id);
  writePantryItems(next);
  return next;
}

function foodTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map(word => word.length > 4 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word)
    .filter(word => word.length >= 3 && !FOOD_STOPWORDS.has(word) && !/^\d+$/.test(word));
}

/** Estimate pantry stock levels by decrementing items matched against meals logged after purchase. */
export function estimatePantryWithMeals(
  items: readonly PantryItem[],
  meals: readonly { description?: string; consumedAt?: string | null; createdAt?: string }[] = [],
): EstimatedPantryItem[] {
  const parsedMeals = meals.map(meal => ({
    at: Date.parse(meal.consumedAt || meal.createdAt || ''),
    tokens: new Set(foodTokens(meal.description || '')),
  })).filter(entry => entry.tokens.size > 0);

  return items.map(item => {
    const tokens = foodTokens(item.name);
    const addedMs = Date.parse(item.addedAt);
    let matchedMealsCount = 0;
    if (tokens.length > 0 && parsedMeals.length > 0) {
      for (const meal of parsedMeals) {
        if (Number.isFinite(addedMs) && Number.isFinite(meal.at) && meal.at < addedMs - 3600000) continue;
        if (tokens.some(token => meal.tokens.has(token))) matchedMealsCount++;
      }
    }
    const estimatedRemaining = Math.max(0, item.servings - item.manualUsed - matchedMealsCount);
    const status: 'stocked' | 'low' = item.markedLow || estimatedRemaining <= 1 ? 'low' : 'stocked';
    return { ...item, matchedMealsCount, estimatedRemaining, status };
  });
}

/* ---------- Shared Assistant Context Helper ---------- */

export type PantryAndGroceryContext = {
  activeShoppingList: {
    needed: string[];
    checked: string[];
    totalCount: number;
    notes: string[];
  };
  pantry: {
    stocked: string[];
    runningLow: string[];
    source: 'estimated_local_inventory';
    note: string;
  };
};

/** Build a compact, bounded prompt asking Cupcake to normalize, dedupe, check pantry stock, and categorize a pasted grocery note. */
export function buildGroceryAiTriagePrompt(
  rawText: string,
  stockedPantry: readonly string[] = [],
  existingGroceries: readonly string[] = [],
): string {
  const cleanRaw = rawText.trim().slice(0, 3500);
  const parts = [
    'Organize this rough grocery text into a clean shopping checklist.',
    'Use ONLY these Markdown headings: # Produce, # Protein, # Dairy, # Pantry, # Household, and Notes: lines for reminders or items already well stocked.',
    'Merge duplicates, standardize messy quantities, omit conversational filler, and reply ONLY with headings, "- [ ] item" lines, and any "Notes:" lines (no intro/outro text).',
  ];
  if (stockedPantry.length) parts.push(`Already in household pantry: ${stockedPantry.slice(0, 25).join(', ')}`);
  if (existingGroceries.length) parts.push(`Already on active shopping list: ${existingGroceries.slice(0, 25).join(', ')}`);
  parts.push(`Raw note:\n${cleanRaw}`);
  return parts.join('\n\n');
}

/** Parse Cupcake's Markdown triage reply into toggleable categorized items and callout notes, stripping conversational preamble. */
export function parseAiTriagedGroceries(
  reply: string,
  limit = 60,
): { items: TriagedGroceryItem[]; pantryNotes: string[] } {
  const cleanedLines: string[] = [];
  let inListSection = false;
  for (const rawLine of reply.split(/\r\n|\n|\r/)) {
    const line = rawLine.trim();
    if (!line || /^```/.test(line)) continue;
    const isHeading = /^#{1,6}\s+\S/.test(line) || (/^[A-Za-z &/]{2,30}:\s*$/.test(line) && !NOTE_LINE.test(line));
    const isTaskOrBullet = /^\s*(?:[-*+•▪◦]|\d+[.)]|\[[ xX]\])\s+\S/.test(line);
    const isNote = NOTE_LINE.test(line) || /^>\s*\S/.test(line);
    if (isHeading || isTaskOrBullet || isNote) {
      inListSection = true;
      cleanedLines.push(line);
    } else if (!inListSection || /^(?:here'?s|sure|of course|i'?ve|note that|let me know|hope this|happy to)/i.test(line)) {
      continue;
    } else {
      cleanedLines.push(line);
    }
  }
  const source = cleanedLines.length ? cleanedLines.join('\n') : reply;
  const items = triageGroceryText(source, limit).map((item, idx) => ({ ...item, id: `ai-triage-${idx}` }));
  const pantryNotes = items.filter(item => item.category === 'Notes').map(item => item.label);
  return { items, pantryNotes };
}

/** Normalize valid PantryItem objects from an account coach_plan pantry document and merge with local storage. */
export function mergeRemotePantry(remoteRaw: unknown): PantryItem[] {
  const local = readPantryItems();
  const candidates = Array.isArray(remoteRaw)
    ? remoteRaw
    : remoteRaw && typeof remoteRaw === 'object' && Array.isArray((remoteRaw as { items?: unknown }).items)
      ? (remoteRaw as { items: unknown[] }).items
      : null;
  if (!candidates) return local;
  const remote = candidates.filter((item): item is PantryItem =>
    !!item && typeof item === 'object'
    && typeof (item as PantryItem).id === 'string'
    && typeof (item as PantryItem).name === 'string' && (item as PantryItem).name.trim().length > 0
    && typeof (item as PantryItem).servings === 'number' && Number.isFinite((item as PantryItem).servings)
    && typeof (item as PantryItem).manualUsed === 'number' && Number.isFinite((item as PantryItem).manualUsed)
    && typeof (item as PantryItem).addedAt === 'string',
  );
  if (!remote.length) return local;
  const merged = new Map<string, PantryItem>();
  for (const item of [...remote, ...local]) {
    const key = groceryKey(item.name);
    const prev = merged.get(key);
    if (!prev || Date.parse(item.addedAt || '') > Date.parse(prev.addedAt || '')) merged.set(key, item);
  }
  const next = [...merged.values()].slice(0, 120);
  writePantryItems(next);
  return next;
}

/** Compact summary of active shopping checklist + estimated local household pantry for the Assistant. */
export function summarizeGroceryAndPantry(
  groceryText: string | undefined | null,
  recentMeals?: readonly { description?: string; consumedAt?: string | null; createdAt?: string }[],
): PantryAndGroceryContext {
  const raw = typeof groceryText === 'string' ? groceryText : '';
  const parsed = groceryItems(raw);
  const needed = parsed.filter(item => !item.checked).map(item => item.label).slice(0, 40);
  const checked = parsed.filter(item => item.checked).map(item => item.label).slice(0, 20);
  const notes = groceryNotes(raw).map(note => note.text).slice(0, 10);

  const estimated = estimatePantryWithMeals(readPantryItems(), recentMeals || []);
  const stocked = estimated.filter(item => item.status === 'stocked').map(item => `${item.name} (~${item.estimatedRemaining} left)`).slice(0, 30);
  const runningLow = estimated.filter(item => item.status === 'low').map(item => item.name).slice(0, 20);

  return {
    activeShoppingList: { needed, checked, totalCount: parsed.length, notes },
    pantry: {
      stocked,
      runningLow,
      source: 'estimated_local_inventory',
      note: 'Estimated local household pantry from routed receipts and logged meals on this device; not a verified live inventory.',
    },
  };
}

