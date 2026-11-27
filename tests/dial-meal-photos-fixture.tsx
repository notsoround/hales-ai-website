import { createRoot } from 'react-dom/client';
import { invalidateSession, restoreSession } from '../src/components/cupcake/accountSession';
import { notifyDataChanged } from '../src/components/cupcake/dataChanges';
import { useDialMealPhotos } from '../src/components/cupcake/noir/useDialMealPhotos';
import type { NutritionHistory } from '../src/components/cupcake/nutritionModel';

if (!import.meta.env.DEV) throw Error('Synthetic test only');
type Props = { history: NutritionHistory | null; day: string; enabled: boolean };
function Probe({ history, day, enabled }: Props) {
  const photos = useDialMealPhotos(history, day, enabled);
  return <output>{JSON.stringify(photos)}</output>;
}
const root = createRoot(document.querySelector('main')!);
const fixture = {
  render: (props: Props) => root.render(<Probe {...props} />),
  login: restoreSession,
  changed: notifyDataChanged,
  logout: () => invalidateSession('Synthetic sign-out', false),
};
Object.assign(window, { fixture });
