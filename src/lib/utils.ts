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
 * Get race abbreviation from full race name
 * @param {string | null | undefined} race - Full race name (Protoss, Terran, Zerg, Random)
 * @returns {string} Single letter abbreviation (P, T, Z, R) or empty string
 */
export function getRaceAbbr(race: string | null | undefined): string {
  if (!race) return '';
  if (race === 'Random') return 'R';
  return race[0];
}
