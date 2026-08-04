import { Feather } from '@expo/vector-icons';

export type FeatherIcon = keyof typeof Feather.glyphMap;

/**
 * Mirror of the web icon map (`dadHealth/src/components/DashboardIcon.tsx`),
 * translated from lucide to Feather — the set already used by the tab bar and
 * account sheet, so icon weight stays consistent across the app.
 *
 * Web falls back to `check-circle` for unknown keys and never renders the raw
 * key as text; this keeps that behaviour.
 */
const ICON_MAP: Record<string, FeatherIcon> = {
  home: 'home',
  fitness: 'activity',
  mind: 'wind',
  bond: 'heart',
  community: 'users',
  progress: 'bar-chart-2',
  pro: 'award',
  breathing: 'wind',
  run: 'activity',
  story: 'book-open',
  journal: 'edit-3',
  gaming: 'tv',
  camping: 'triangle',
  kickabout: 'circle',
  flame: 'zap',
  sunrise: 'sunrise',
  baby: 'users',
  grad: 'book-open',
  'check-circle': 'check-circle',
  bell: 'bell',
};

export function dashboardIcon(icon: string | null | undefined): FeatherIcon {
  if (!icon) return 'check-circle';
  return ICON_MAP[icon] ?? 'check-circle';
}
