import { useEffect, useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';

interface TournamentSummary {
  name: string;
  date: string | null;
}

interface FooterSummary {
  appVersion: string;
  rankedPlayersCount: number;
  tournamentsCount: number;
  latestTournament: TournamentSummary | null;
}

interface FooterProps {
  onNavigateManage?: () => void;
}

export function Footer({ onNavigateManage }: FooterProps) {
  const [versionLogOpen, setVersionLogOpen] = useState(false);
  const [versionLogRaw, setVersionLogRaw] = useState<string | null>(null);
  const [isLoadingVersionLog, setIsLoadingVersionLog] = useState(false);
  const [summary, setSummary] = useState<FooterSummary | null>(null);
  const isLocalAdmin = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const host = window.location.hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/footer-summary')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load summary'))))
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch(() => {
        if (!cancelled) {
          setSummary(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!versionLogOpen || versionLogRaw !== null || isLoadingVersionLog) {
      return;
    }

    let cancelled = false;
    setIsLoadingVersionLog(true);

    fetch('/api/versionlog')
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error('Failed to load version log'))))
      .then((text) => {
        if (!cancelled) setVersionLogRaw(text);
      })
      .catch(() => {
        if (!cancelled) {
          setVersionLogRaw('');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingVersionLog(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [versionLogOpen, versionLogRaw, isLoadingVersionLog]);

  const appVersion = useMemo(() => summary?.appVersion || 'v0.0.0', [summary]);
  const latestTournament = useMemo(() => summary?.latestTournament || null, [summary]);

  const rankedPlayersText = summary ? String(summary.rankedPlayersCount) : '--';
  const tournamentsText = summary ? String(summary.tournamentsCount) : '--';

  return (
    <>
      <footer className="border-t border-border/40 bg-background/95">
        <div className="container mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs text-muted-foreground sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <span>SC2 Stats Pro Circuit</span>
            <button
              type="button"
              onClick={() => setVersionLogOpen(true)}
              className="rounded px-1.5 py-0.5 text-foreground hover:bg-accent"
              title="View version log"
            >
              {appVersion}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded border border-border px-2 py-0.5">
              Ranked players: {rankedPlayersText}
            </span>
            <span className="rounded border border-border px-2 py-0.5">
              Tournaments: {tournamentsText}
            </span>
            <span className="rounded border border-border px-2 py-0.5">
              Latest: {latestTournament ? latestTournament.name : '--'}
              {latestTournament?.date ? ` (${latestTournament.date})` : ''}
            </span>
            {isLocalAdmin && onNavigateManage && (
              <button
                type="button"
                onClick={onNavigateManage}
                className="rounded border border-border px-2 py-0.5 text-foreground hover:bg-accent"
                title="Open Manage"
              >
                Manage
              </button>
            )}
          </div>
        </div>
      </footer>

      <Sheet open={versionLogOpen} onOpenChange={setVersionLogOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-hidden flex flex-col p-0">
          <SheetHeader className="border-b px-6 py-4 shrink-0">
            <SheetTitle>Version log</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-auto px-6 py-4">
            {versionLogRaw === null ? (
              <p className="text-muted-foreground text-sm">Loading...</p>
            ) : versionLogRaw === '' ? (
              <p className="text-muted-foreground text-sm">Version log unavailable.</p>
            ) : (
              <pre className="text-xs text-foreground whitespace-pre-wrap font-sans break-words">
                {versionLogRaw}
              </pre>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
