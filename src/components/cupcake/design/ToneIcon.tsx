import { CreditCard, Droplet, Dumbbell, Flame, Footprints, Moon, Scale, Sparkles, Trophy, Utensils } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const ICONS: Record<string, LucideIcon> = { food: Utensils, steps: Footprints, exercise: Dumbbell, sleep: Moon, weight: Scale, body: Scale, wins: Trophy, summary: Sparkles, spend: CreditCard, glucose: Droplet, energy: Flame };

/** Category glyph in a tinted rounded chip (design system); colour comes from the surrounding card's category. */
export function ToneIcon({ tone, className = 'ds-ico' }: { tone?: string; className?: string }) {
  const Icon = (tone && ICONS[tone]) || Sparkles;
  return <i className={className} aria-hidden="true"><Icon size={14} strokeWidth={2.2} /></i>;
}
