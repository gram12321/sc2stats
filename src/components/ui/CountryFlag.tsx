import { cn } from '../../lib/utils';
import { countryCodeToFlagEmoji, normalizeCountryCode } from '../../lib/country';

interface CountryFlagProps {
  country: string | null | undefined;
  showCode?: boolean;
  className?: string;
}

export function CountryFlag({ country, showCode = false, className }: CountryFlagProps) {
  const code = normalizeCountryCode(country);
  if (!code) return null;

  return (
    <span className={cn('inline-flex items-center gap-1 text-xs', className)} title={code}>
      <span aria-hidden="true" className="text-sm leading-none">{countryCodeToFlagEmoji(code)}</span>
      {showCode && <span className="font-medium text-muted-foreground">{code}</span>}
    </span>
  );
}