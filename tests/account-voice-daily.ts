// Vite aliases Daily to this file only in account-voice.test.mjs. Production has
// no fixture branches, globals or transport injection points.
type Listener = (event?: unknown) => void;
type Fixture = { calls: SyntheticCall[]; joins: string[]; leaves: number; destroys: number; holdJoin: boolean; holdLeave: boolean; releaseJoin: () => void };
const fixture = () => (window as unknown as { voiceFixture: Fixture }).voiceFixture;
class SyntheticCall {
  listeners = new Map<string, Listener[]>();
  destroyed = false;
  constructor(readonly options: Record<string, unknown>) { fixture().calls.push(this); }
  on(name: string, listener: Listener) { this.listeners.set(name, [...this.listeners.get(name) || [], listener]); return this; }
  emit(name: string, value: unknown) { for (const listener of this.listeners.get(name) || []) listener(value); }
  async join({ url }: { url: string }) { fixture().joins.push(url); if (fixture().holdJoin) await new Promise<void>(resolve => { fixture().releaseJoin = resolve; }); }
  async leave() { fixture().leaves++; if (fixture().holdLeave) await new Promise<void>(() => {}); }
  async destroy() { if (!this.destroyed) { this.destroyed = true; fixture().destroys++; } }
  async setLocalAudio() { /* No actual device or provider. */ }
  sendAppMessage() { /* No actual device or provider. */ }
}
export default { createCallObject: (options: Record<string, unknown>) => new SyntheticCall(options) };
