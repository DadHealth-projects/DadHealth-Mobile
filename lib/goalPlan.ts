/**
 * Port of the "Today's Plan" builder from
 * `dadHealth/src/components/home/DashboardPreview.tsx` — same keyword rules,
 * same pillar labels, same 4-goal cap, same action wording.
 */

export type DashboardGoalStatus = 'done' | 'start' | 'log' | 'open';

export type DashboardGoal = {
  iconKey: string;
  name: string;
  time: string;
  status: DashboardGoalStatus;
};

const GOAL_ICON_BY_KEYWORD: ReadonlyArray<{ match: RegExp; icon: string; pillar: string }> = [
  { match: /(breath|mood|mind|meditat|calm|mental)/i, icon: 'breathing', pillar: 'MENTAL HEALTH' },
  { match: /(run|walk|workout|train|fitness|gym|body)/i, icon: 'run', pillar: 'FITNESS' },
  { match: /(story|bond|dad date|parent|family|kid|child)/i, icon: 'story', pillar: 'PARENTING' },
  { match: /(journal|reflect|gratitude|write)/i, icon: 'journal', pillar: 'REFLECTION' },
];

export function buildGoalsFromProfile(rawGoals: unknown): DashboardGoal[] {
  if (!Array.isArray(rawGoals)) return [];
  return rawGoals
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter((value) => value.length > 0)
    .slice(0, 4)
    .map((name) => {
      const matched = GOAL_ICON_BY_KEYWORD.find((rule) => rule.match.test(name));
      return {
        iconKey: matched?.icon ?? 'check-circle',
        name: name.replace(/\s*\(check\)\s*/gi, ''),
        time: `TODAY · ${matched?.pillar ?? 'WELLBEING'}`,
        status: 'start' as const,
      };
    });
}

export function goalActionLabel(status: DashboardGoalStatus): string {
  if (status === 'done') return 'Completed';
  if (status === 'start') return 'Start Now';
  if (status === 'log') return 'Mark Done';
  return 'View';
}
