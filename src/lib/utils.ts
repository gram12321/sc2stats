/**
 * Utility functions for tournament data
 */

import { TournamentData } from '../types/tournament';

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
