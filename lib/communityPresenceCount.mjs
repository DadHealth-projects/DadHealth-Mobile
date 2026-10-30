export function countUniquePresenceUsers(presenceState) {
  return Object.keys(presenceState).filter((userId) => userId.length > 0).length;
}
