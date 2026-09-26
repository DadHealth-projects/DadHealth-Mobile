export type ScoreTrend = {
  arrow: '↑' | '↓' | '→';
  change: number | null;
};

export function formatScoreTrend(value: number | null | undefined): ScoreTrend;

export function hasScoreHistory(point: {
  mind_has_data: boolean;
  body_has_data: boolean;
  bond_has_data: boolean;
}): boolean;
