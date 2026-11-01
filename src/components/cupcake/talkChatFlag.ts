/** Feature flag for the merged Talk + Chat screen. Default OFF. Turn on with ?talkchat=1, off with ?talkchat=0 (remembered on this device). */
const KEY = 'cupcake-flag-talk-chat';
export function readTalkChatFlag(search = location.search): boolean {
  const asked = new URLSearchParams(search).get('talkchat');
  try {
    if (asked === '1') localStorage.setItem(KEY, '1');
    if (asked === '0') localStorage.removeItem(KEY);
    return localStorage.getItem(KEY) === '1';
  } catch { return asked === '1'; }
}
