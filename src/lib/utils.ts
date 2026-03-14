/**
 * Utility functions for tournament data
 */

import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { TournamentData } from '../types/tournament';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Download tournament data as JSON file
 */
export function downloadTournamentJSON(data: TournamentData): void {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${data.tournament.liquipedia_slug.replace(/\//g, '_')}_edited.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Format a number to show at most 2 decimal places
 * Used for displaying ranking points in the UI
 * 
 * @param {number} value - The number to format
 * @returns {string} Formatted number string
 */
export function formatRankingPoints(value: number): string {
  // Round to 2 decimal places and remove trailing zeros
  const rounded = Math.round(value * 100) / 100;
  return rounded.toString();
}

/**
 * Round order mapping for sorting matches chronologically.
 */
export const ROUND_ORDER: Record<string, number> = {
  'Round of 16': 1,
  'Round of 8': 2,
  'Quarterfinals': 3,
  'Semifinals': 4,
  'Final': 5,
  'Grand Final': 5
};

export function getRoundSortOrder(round: string | null | undefined): number {
  if (!round || typeof round !== 'string') return 9999;

  const value = round.trim();
  const normalized = value.toLowerCase();

  const earlyRoundMatch = value.match(/^Early Round\s+(\d+)$/i);
  if (earlyRoundMatch) {
    const roundNum = parseInt(earlyRoundMatch[1], 10);
    return Number.isNaN(roundNum) ? 9999 : roundNum;
  }

  const earlyUpperRoundMatch = value.match(/^Early\s+(?:Upper|Winners?)\s*(?:Bracket\s*)?(?:Round|R)\s*(\d+)$/i);
  if (earlyUpperRoundMatch) {
    const roundNum = parseInt(earlyUpperRoundMatch[1], 10);
    if (!Number.isNaN(roundNum)) {
      return 20 + (roundNum * 10);
    }
  }

  const earlyLowerRoundMatch = value.match(/^Early\s+(?:Lower|Losers?)\s*(?:Bracket\s*)?(?:Round|R)\s*(\d+)$/i);
  if (earlyLowerRoundMatch) {
    const roundNum = parseInt(earlyLowerRoundMatch[1], 10);
    if (!Number.isNaN(roundNum)) {
      return 25 + (roundNum * 10);
    }
  }

  if (/^group stage\b/i.test(value) || /^groups?\b/i.test(value)) {
    const groupNumMatch = value.match(/(?:round|r)\s*(\d+)/i);
    const groupNum = groupNumMatch ? parseInt(groupNumMatch[1], 10) : 0;
    return 100 + (Number.isNaN(groupNum) ? 0 : groupNum);
  }

  const upperRoundMatch = value.match(/^(?:upper|winners?)\s*(?:bracket\s*)?(?:round|r)\s*(\d+)$/i);
  if (upperRoundMatch) {
    const roundNum = parseInt(upperRoundMatch[1], 10);
    if (!Number.isNaN(roundNum)) {
      return 200 + (roundNum * 10);
    }
  }

  const lowerRoundMatch = value.match(/^(?:lower|losers?)\s*(?:bracket\s*)?(?:round|r)\s*(\d+)$/i);
  if (lowerRoundMatch) {
    const roundNum = parseInt(lowerRoundMatch[1], 10);
    if (!Number.isNaN(roundNum)) {
      return 205 + (roundNum * 10);
    }
  }

  const roundOfMatch = value.match(/^(?:Round of|Ro)\s*(\d+)$/i);
  if (roundOfMatch) {
    const bracketSize = parseInt(roundOfMatch[1], 10);
    if (!Number.isNaN(bracketSize) && bracketSize > 0) {
      return 1000 - bracketSize;
    }
  }

  if (normalized.includes('lower') || normalized.includes('loser')) {
    if (normalized.includes('quarter')) return 993.5;
    if (normalized.includes('semi')) return 994.5;
    if (normalized.includes('final')) return 995.5;
  }

  const fixedRounds: Record<string, number> = {
    Quarterfinals: 993,
    Semifinals: 994,
    Final: 995,
    'Grand Final': 996
  };

  if (fixedRounds[value] !== undefined) {
    return fixedRounds[value];
  }

  const genericRoundMatch = value.match(/(?:round|r)\s*(\d+)/i);
  if (genericRoundMatch) {
    const roundNum = parseInt(genericRoundMatch[1], 10);
    if (!Number.isNaN(roundNum)) {
      return 300 + (roundNum * 10);
    }
  }

  return 9999;
}

/**
 * Get race abbreviation from full race name
 * @param {string | null | undefined} race - Full race name (Protoss, Terran, Zerg, Random)
 * @returns {string} Single letter abbreviation (P, T, Z, R) or empty string
 */
export function getRaceAbbr(race: string | null | undefined): string {
  if (!race) return '';
  if (race === 'Random') return 'R';
  return race[0];
}
