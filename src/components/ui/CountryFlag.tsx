import { cn } from '../../lib/utils';
import { normalizeCountryCode } from '../../lib/country';

interface CountryFlagProps {
  country: string | null | undefined;
  showCode?: boolean;
  className?: string;
}

export function CountryFlag({ country, showCode = false, className }: CountryFlagProps) {
  const code = normalizeCountryCode(country);
  if (!code) return null;

  const flagUrl = `https://flagcdn.com/20x15/${code.toLowerCase()}.png`;

  return (
    <span className={cn('inline-flex items-center gap-1 text-xs', className)} title={code}>
      <img
        src={flagUrl}
        alt={code}
        className="h-[12px] w-[16px] rounded-[2px] object-cover"
        loading="lazy"
      />
      {showCode && <span className="font-medium text-muted-foreground">{code}</span>}
    </span>
  );
}