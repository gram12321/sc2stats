import { normalizeCountryCode } from './country';

export async function getPlayerCountries(): Promise<Record<string, string>> {
  try {
    const response = await fetch('/api/player-countries');
    if (!response.ok) throw new Error('Failed to load player countries');
    return await response.json();
  } catch {
    return {};
  }
}

export async function setPlayerCountry(name: string, country: string | null): Promise<void> {
  const normalized = normalizeCountryCode(country);
  const response = await fetch(`/api/player-countries/${encodeURIComponent(name)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ country: normalized })
  });

  if (!response.ok) {
    throw new Error('Failed to save player country');
  }
}