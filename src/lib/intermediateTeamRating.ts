export const DEFAULT_INTERMEDIATE_TEAM_FADE_MATCHES = 20;

export function getIntermediateTeamBlendWeight(
  teamMatchCount: number,
  fadeMatches: number = DEFAULT_INTERMEDIATE_TEAM_FADE_MATCHES
): number {
  if (!Number.isFinite(teamMatchCount)) {
    return 0;
  }

  if (!Number.isFinite(fadeMatches) || fadeMatches <= 0) {
    return 0;
  }

  const raw = (fadeMatches - teamMatchCount) / fadeMatches;
  return Math.max(0, Math.min(1, raw));
}
