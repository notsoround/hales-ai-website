import { parsePlanText, type ImportedMeal } from './planImport';

/** Talk-to-build-a-plan (Labs). The request goes through the signed-in account chat, which
 *  has no web search and no tools. Replies are only ever turned into an unsaved draft. */
const ASK = 'Plan builder request. Help me draft a meal plan that I will review before saving. '
  + 'Write the plan as plain text: one heading per meal ending with a colon (for example "Monday breakfast ~450 kcal:"), '
  + 'then one "- " line per food item with its amount. At most 10 meals. Give calories only as rough estimates, and only when you can. '
  + 'You cannot search the web, so do not cite or claim sources. After the plan, ask at most one short question.\n\nWhat I want: ';
const AGAIN = '\n\n(Plan builder: reply with the full updated plan in the same format.)';
export const builderTitle = (request: string) => ('Plan builder: ' + request.trim()).slice(0, 120);
export const builderMessage = (text: string, first: boolean) => first ? ASK + text.trim() : text.trim() + AGAIN;
/** What the person actually typed, without the formatting instructions. */
export function spokenText(sent: string): string {
  if (sent.startsWith(ASK)) return sent.slice(ASK.length);
  return sent.endsWith(AGAIN) ? sent.slice(0, -AGAIN.length) : sent;
}
/** Keep only headings and list items from a reply, so greetings and the closing question
 *  never become planned food. Meals without items are dropped. */
export function planFromReply(reply: string, limit = 10): ImportedMeal[] {
  const lines = reply.replace(/\*\*|__/g, '').split(/\r\n|\n|\r/).map(line => line.trim()).filter(line =>
    /^(?:[-*+•▪◦]|\d+[.)])\s+\S/.test(line) || /^#{1,6}\s+\S/.test(line) || /^[^.?!]{1,80}:$/.test(line));
  return parsePlanText(lines.join('\n'), 20).filter(meal => meal.items.length > 0).slice(0, limit)
    .map(meal => ({ ...meal, name: meal.name.replace(/(?:\s*(?:~|≈|about|approx\.?|est\.?))+$/i, '').trim() || meal.name }));
}
/** Show a reply as plain text: drop Markdown bold and heading marks the chat model adds. */
export const plainReply = (reply: string) => reply.replace(/\*\*|__/g, '').replace(/^#{1,6}\s+/gm, '');
