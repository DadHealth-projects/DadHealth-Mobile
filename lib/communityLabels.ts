/** Map legacy Community tag values to current display copy without changing stored values. */
export function communityTagLabel(tag: string): string {
  const prefix = tag.startsWith('#') ? '#' : '';
  const value = prefix ? tag.slice(1) : tag;
  return `${prefix}${value.toUpperCase() === 'FITNESS' ? 'BODY' : value}`;
}
