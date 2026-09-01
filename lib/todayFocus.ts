export type TodayPillar = 'checkin' | 'mind' | 'body' | 'bond';

export type TodayScores = {
  mind: number | null;
  body: number | null;
  bond: number | null;
};

const PILLAR_ORDER = ['mind', 'body', 'bond'] as const;

/** Product order: incomplete check-in, then the lowest pillar with Mind winning ties. */
export function selectTodayFocus(checkedInToday: boolean, scores: TodayScores): TodayPillar {
  if (!checkedInToday) return 'checkin';

  const missing = PILLAR_ORDER.find((pillar) => scores[pillar] == null);
  if (missing) return missing;

  return PILLAR_ORDER.reduce((lowest, pillar) =>
    Number(scores[pillar]) < Number(scores[lowest]) ? pillar : lowest,
  );
}

export function strongestPositiveTrend(trends: Record<'Mind' | 'Body' | 'Bond', number | null>) {
  return (Object.entries(trends) as Array<['Mind' | 'Body' | 'Bond', number | null]>)
    .filter((entry): entry is ['Mind' | 'Body' | 'Bond', number] => typeof entry[1] === 'number' && entry[1] > 0)
    .sort((a, b) => b[1] - a[1])[0] ?? null;
}
