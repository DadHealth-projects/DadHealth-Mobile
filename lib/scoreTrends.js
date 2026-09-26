/** @typedef {{ arrow: '↑' | '↓' | '→', change: number | null }} ScoreTrend */

/** Format canonical score-point changes; missing comparison data is neutral, not fabricated. */
exports.formatScoreTrend = function formatScoreTrend(value) {
  if (value == null || !Number.isFinite(value)) return { arrow: '→', change: null };

  const change = Math.round(value);
  return {
    arrow: change > 0 ? '↑' : change < 0 ? '↓' : '→',
    change: Math.abs(change),
  };
};

exports.hasScoreHistory = function hasScoreHistory(point) {
  return point.mind_has_data || point.body_has_data || point.bond_has_data;
};
