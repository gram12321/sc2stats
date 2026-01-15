import { Race } from '../types/tournament';

// API-based player defaults (stored in JSON file via API)

export async function getPlayerDefaults(): Promise<Record<string, Race>> {
  try {
    const response = await fetch('/api/player-defaults');
    if (!response.ok) throw new Error('Failed to load player defaults');
    return await response.json();
  } catch {
    return {};
  }
}

export async function setPlayerDefault(name: string, race: Race): Promise<void> {
  try {
    const response = await fetch(`/api/player-defaults/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ race })
    });
    if (!response.ok) throw new Error('Failed to save player default');
  } catch (error) {
    console.error('Error saving player default:', error);
    throw error;
  }
}

export async function setPlayerDefaults(defaults: Record<string, Race>): Promise<void> {
  try {
    const response = await fetch('/api/player-defaults', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(defaults)
    });
    if (!response.ok) throw new Error('Failed to save player defaults');
  } catch (error) {
    console.error('Error saving player defaults:', error);
    throw error;
  }
}

export async function getPlayerDefault(name: string): Promise<Race | null> {
  try {
    const defaults = await getPlayerDefaults();
    return defaults[name] || null;
  } catch {
    return null;
  }
}

export async function clearPlayerDefaults(): Promise<void> {
  await setPlayerDefaults({});
}
