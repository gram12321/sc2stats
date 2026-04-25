export const RACE_ABBR_BY_NAME = Object.freeze({
  Protoss: 'P',
  Terran: 'T',
  Zerg: 'Z',
  Random: 'R'
});

/**
 * Get race abbreviation from full race name.
 * @param {string | null | undefined} race
 * @returns {string}
 */
export function getRaceAbbr(race) {
  if (!race) return '';
  return RACE_ABBR_BY_NAME[race] || String(race)[0];
}
