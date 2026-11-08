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
      const bullet = raw.match(/^(\s*[-+*][ \t]+)(\S.*)$/);
      const indent = raw.match(/^\s*/)?.[0].length || 0;
      items.push({ line, label: (task?.[4] || bullet?.[2] || raw).trim(), checked: !!task && task[2].toLowerCase() === 'x',
        start, end, marker: task ? start + task[1].length : null, insert: start + (bullet ? bullet[1].length : indent), bullet: !!bullet });
    }
    start = end + (lines[at + 1]?.length || 0);
  }
  return items;
}
export function checkGroceryItem(text: string, line: number, checked: boolean): string {
  const item = groceryItems(text).find(item => item.line === line);
  if (!item) return text;
  if (item.marker !== null) return text.slice(0, item.marker) + (checked ? 'x' : ' ') + text.slice(item.marker + 1);
  if (!checked) return text;
  return text.slice(0, item.insert) + (item.bullet ? '[x] ' : '- [x] ') + text.slice(item.insert);
}
