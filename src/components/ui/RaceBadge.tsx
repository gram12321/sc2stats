import { Race } from '../../types/tournament';
import { cn, getRaceAbbr } from '../../lib/utils';
import { getRaceIconUrl, getRaceToneClasses } from '../../lib/display';

interface RaceBadgeProps {
  race: string | Race | null | undefined;
  showName?: boolean;
  showAbbr?: boolean;
  className?: string;
}

export function RaceBadge({ race, showName = false, showAbbr = false, className }: RaceBadgeProps) {
  if (!race) return null;

  const raceAbbr = getRaceAbbr(String(race));
  const tone = getRaceToneClasses(race);
  const iconUrl = getRaceIconUrl(race);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium',
        tone,
        className
      )}
    >
      {iconUrl ? (
        <img src={iconUrl} alt={String(race)} className="h-3.5 w-3.5 shrink-0" loading="lazy" />
      ) : (
        <span className="h-3.5 w-3.5 shrink-0 rounded-sm bg-muted text-[10px] leading-3 text-center">{raceAbbr}</span>
      )}
      {showName && <span>{String(race)}</span>}
      {!showName && showAbbr && <span>{raceAbbr}</span>}
    </span>
  );
}
