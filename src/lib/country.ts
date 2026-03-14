export function normalizeCountryCode(country: string | null | undefined): string | null {
  if (!country) return null;
  const normalized = String(country).trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return null;
  return normalized;
}

export function countryCodeToFlagEmoji(country: string | null | undefined): string {
  const code = normalizeCountryCode(country);
  if (!code) return '🏳️';

  const OFFSET = 0x1f1e6 - 'A'.charCodeAt(0);
  const first = String.fromCodePoint(code.charCodeAt(0) + OFFSET);
  const second = String.fromCodePoint(code.charCodeAt(1) + OFFSET);
  return `${first}${second}`;
}