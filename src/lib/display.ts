import { Race } from '../types/tournament';

export type RaceCode = 'T' | 'P' | 'Z' | 'R';

const MONTH_NAMES: Record<number, string> = {
  1: 'January',
  2: 'February',
  3: 'March',
  4: 'April',
  5: 'May',
  6: 'June',
  7: 'July',
  8: 'August',
  9: 'September',
  10: 'October',
  11: 'November',
  12: 'December'
};

const TOURNAMENT_BASE_NAMES: Record<string, string> = {
  uthermal_2v2_circuit: 'Uthermal Main Circuit',
  utermal_2v2_circuit: 'Uthermal Main Circuit',
  uthermal_2v2_circuit_wuc: 'Uthermal WUC',
  utermal_2v2_circuit_wuc: 'Uthermal WUC',
  uthermal_2v2_circuit_bonus_cup: 'Uthermal Bonus Cup',
  utermal_2v2_circuit_bonus_cup: 'Uthermal Bonus Cup',
  uthermal_2v2_circuit_last_chance_qualifiers: 'Uthermal Last Chance Qualifiers',
  utermal_2v2_circuit_last_chance_qualifiers: 'Uthermal Last Chance Qualifiers',
  uthermal_2v2_circuit_main_event: 'Uthermal Main Event',
  utermal_2v2_circuit_main_event: 'Uthermal Main Event',
  ursatv_2v2_open: 'UrsaTV 2v2 Open',
  zerg_cup_2v2: 'Zerg Cup 2v2',
  sel_doubles: 'SEL Doubles',
  warditv_team_liquid_map_contest_tournament_14_2v2: 'WardiTV Team Liquid Map Contest Tournament 14 (2v2)'
};

function titleizeToken(token: string): string {
  if (!token) return token;
  const lower = token.toLowerCase();
  if (/^\d+v\d+$/i.test(token)) return lower;
  if (/^(tv|wuc|sel)$/i.test(token)) return token.toUpperCase();
  if (/^\d+$/.test(token)) return token;
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function titleizeSlugPart(raw: string): string {
  return raw
    .split('_')
    .filter(Boolean)
    .map(titleizeToken)
    .join(' ');
}

function resolveBaseName(base: string): string {
  const normalized = base.toLowerCase();
  return TOURNAMENT_BASE_NAMES[normalized] || titleizeSlugPart(base);
}

function extractYear(segment?: string): number | null {
  if (!segment) return null;
  if (/^\d{4}$/.test(segment)) return Number(segment);
  return null;
}

function extractMonth(segment?: string): number | null {
  if (!segment || !/^\d{1,2}$/.test(segment)) return null;
  const month = Number(segment);
  if (month < 1 || month > 12) return null;
  return month;
}

export function formatTournamentName(rawSlug: string | null | undefined): string {
  if (!rawSlug) return 'Unknown Event';

  const cleaned = rawSlug.trim().replace(/^\/+|\/+$/g, '');
  if (!cleaned) return 'Unknown Event';

  const slashParts = cleaned.split('/').filter(Boolean);
  const [basePartRaw = '', secondPartRaw, thirdPartRaw] = slashParts;

  if (slashParts.length >= 2) {
    const baseName = resolveBaseName(basePartRaw);
    const year = extractYear(secondPartRaw);
    const month = extractMonth(thirdPartRaw);

    if (year && month) {
      return `${baseName} ${MONTH_NAMES[month]} ${year}`;
    }

    if (year && thirdPartRaw) {
      return `${baseName} ${titleizeSlugPart(thirdPartRaw)} ${year}`;
    }

    if (year) {
      return `${baseName} ${year}`;
    }
  }

  const underscoreParts = cleaned.split('_').filter(Boolean);
  if (underscoreParts.length > 2) {
    const maybeYear = underscoreParts[underscoreParts.length - 2];
    const maybeMonth = underscoreParts[underscoreParts.length - 1];
    const year = extractYear(maybeYear);
    const month = extractMonth(maybeMonth);
    if (year && month) {
      const base = underscoreParts.slice(0, -2).join('_');
      return `${resolveBaseName(base)} ${MONTH_NAMES[month]} ${year}`;
    }
  }

  return resolveBaseName(cleaned);
}

export function toRaceCode(race: string | Race | null | undefined): RaceCode | null {
  if (!race) return null;

  const value = String(race).trim();
  if (!value) return null;

  if (/^terran$/i.test(value) || /^t$/i.test(value)) return 'T';
  if (/^protoss$/i.test(value) || /^p$/i.test(value)) return 'P';
  if (/^zerg$/i.test(value) || /^z$/i.test(value)) return 'Z';
  if (/^random$/i.test(value) || /^r$/i.test(value)) return 'R';

  return null;
}

export function getRaceToneClasses(race: string | Race | null | undefined): string {
  const code = toRaceCode(race);
  switch (code) {
    case 'T':
      return 'bg-race-terran/15 text-race-terran border-race-terran/35';
    case 'P':
      return 'bg-race-protoss/15 text-race-protoss border-race-protoss/35';
    case 'Z':
      return 'bg-race-zerg/15 text-race-zerg border-race-zerg/35';
    case 'R':
      return 'bg-muted text-muted-foreground border-border';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

export function getRaceIconUrl(race: string | Race | null | undefined): string | null {
  const code = toRaceCode(race);
  switch (code) {
    case 'T':
      return 'https://cdn.jsdelivr.net/gh/nephest/sc2-icons@master/race/terran.svg';
    case 'P':
      return 'https://cdn.jsdelivr.net/gh/nephest/sc2-icons@master/race/protoss.svg';
    case 'Z':
      return 'https://cdn.jsdelivr.net/gh/nephest/sc2-icons@master/race/zerg.svg';
    case 'R':
      return 'https://cdn.jsdelivr.net/gh/nephest/sc2-icons@master/race/random.svg';
    default:
      return null;
  }
}