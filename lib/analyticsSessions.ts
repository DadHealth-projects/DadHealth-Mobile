/** A process launch is a session; account resolution/rerenders are not launches. */
export function createAnalyticsSessions() {
  let launched = false, away: number | null = null;
  return {
    ready() { if (launched) return false; launched = true; return true; },
    change(state: string, now: number) {
      if (state === 'background') { away ??= now; return false; }
      if (state !== 'active') return false;
      const qualifies = away !== null && now - away >= 30 * 60000;
      away = null;
      return qualifies;
    },
  };
}
/** Layout plus focused screen, once until a genuine blur or account change. */
export function createPresentation() {
  let owner: string | null = null, shown = false, laidOut = false;
  return {
    layout() { laidOut = true; },
    update(next: string | null, focused: boolean, eligible: boolean) {
      if (next !== owner || !focused) { owner = next; shown = false; }
      if (!next || !focused || !eligible || !laidOut || shown) return false;
      shown = true; return true;
    },
  };
}
