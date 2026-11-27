// This entry point is used only by the loopback design preview.
import { addDays, nutritionDay, nutritionDayStart } from '../src/components/cupcake/nutritionModel';
if (!import.meta.env.DEV) throw Error('Synthetic preview only.');

await import('./account-receipt-navigation-preview');
type MockRead = (owner: string, body: Record<string, unknown>) => object | undefined;
const host = window as unknown as { syntheticReceiptNavigation: MockRead };
const receipts = host.syntheticReceiptNavigation;
const today = nutritionDay();
host.syntheticReceiptNavigation = (owner, body) => {
  if (owner !== 'acc_synthetic_a') return;
  if (body.action === 'steps_list') {
    const entries = Array.from({ length: 31 }, (_, i) => {
      const date = addDays(today, -i);
      return { date, count: i === 0 ? 4350 : i === 8 ? 0 : 3200 + (i * 1463) % 7200,
        source: 'galaxy_a55', winningSource: 'galaxy_a55', sourcesCount: 1, windowBasis: 'calendar_day',
        windowStart: new Date(nutritionDayStart(date)).toISOString(),
        windowEnd: i ? new Date(nutritionDayStart(addDays(date,1))).toISOString() : new Date().toISOString() };
    }).filter((e,i) => i !== 3 && i !== 19 && e.date >= String(body.start) && e.date <= String(body.end));
    return {entries,averageSource:'galaxy_a55'};
  }
  return receipts(owner,body);
};
