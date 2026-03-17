import { useEffect, useMemo, useState } from 'react';
import { Loader2, Map, Database, Layers3, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';

interface MapCountRow {
  map: string;
  count: number;
}

interface MapRecordingSummary {
  totalMatchesScanned: number;
  excludedEarlyRoundMatches: number;
  includedNonEarlyMatches: number;
  matchesWithRecordedMapData: number;
  matchesWithRecordedMapDataNonEarly: number;
  totalRecordedMapEntries: number;
  recordedMapEntriesNonEarly: number;
  maxPossibleMapSlotsNonEarly: number;
  maxPossibleMapSlotsEarly: number;
  playedMapsFromValidScoresNonEarly: number;
  includedNonEarlyMatchesMissingScores: number;
  includedNonEarlyMatchesWithInconsistentScores: number;
  matchLevelCoverageNonEarly: number;
  mapEntryCoverageVsPlayedNonEarly: number;
  uniqueRecordedMapNames: number;
  rows: MapCountRow[];
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatNumber(value: number) {
  return value.toLocaleString();
}

export function MapData() {
  const [summary, setSummary] = useState<MapRecordingSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSummary = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch('/api/map-recording-summary');
        if (!response.ok) {
          throw new Error('Failed to load map recording summary');
        }

        const data = await response.json();
        setSummary(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load map recording summary');
      } finally {
        setIsLoading(false);
      }
    };

    loadSummary();
  }, []);

  const averageRecordedMapsPerMappedMatch = useMemo(() => {
    if (!summary || summary.matchesWithRecordedMapDataNonEarly === 0) return null;
    return summary.recordedMapEntriesNonEarly / summary.matchesWithRecordedMapDataNonEarly;
  }, [summary]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading map recording summary...</p>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <Card className="border-destructive/50 bg-destructive/10">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center space-y-2">
            <p className="text-destructive font-semibold">{error || 'Map recording summary unavailable'}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Map className="h-8 w-8 text-primary" />
          Map Data
        </h1>
        <p className="max-w-3xl text-muted-foreground leading-relaxed">
          This page tracks recorded per-match map entries from the curated tournament output. Early rounds are excluded from
          the primary coverage metrics because map data is generally not expected there.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total tournament matches scanned</CardDescription>
            <CardTitle className="text-3xl">{formatNumber(summary.totalMatchesScanned)}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            All matches found in tournament JSON files.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Non-Early Round matches</CardDescription>
            <CardTitle className="text-3xl">{formatNumber(summary.includedNonEarlyMatches)}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Match pool used for map-data coverage after excluding early rounds.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Matches with recorded map data</CardDescription>
            <CardTitle className="text-3xl">{formatNumber(summary.matchesWithRecordedMapDataNonEarly)}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Included non-early matches with at least one recorded map entry.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Match-level map-data coverage</CardDescription>
            <CardTitle className="text-3xl">{formatPercent(summary.matchLevelCoverageNonEarly)}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Coverage across non-early-round matches.
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Layers3 className="h-5 w-5 text-primary" />
              Recorded Map Counts
            </CardTitle>
            <CardDescription>
              Recorded map entries aggregated across all scanned tournament output.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Rank</TableHead>
                    <TableHead>Map Name</TableHead>
                    <TableHead className="text-right">Recorded Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.rows.map((row, index) => (
                    <TableRow key={row.map}>
                      <TableCell className="font-medium text-muted-foreground">{index + 1}</TableCell>
                      <TableCell className="font-medium">{row.map}</TableCell>
                      <TableCell className="text-right">{formatNumber(row.count)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Database className="h-5 w-5 text-primary" />
                Coverage Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Recorded map entries</span>
                <Badge variant="secondary">{formatNumber(summary.recordedMapEntriesNonEarly)}</Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Played maps from valid scores</span>
                <Badge variant="secondary">{formatNumber(summary.playedMapsFromValidScoresNonEarly)}</Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Map-entry coverage</span>
                <Badge>{formatPercent(summary.mapEntryCoverageVsPlayedNonEarly)}</Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Unique map names</span>
                <Badge variant="outline">{formatNumber(summary.uniqueRecordedMapNames)}</Badge>
              </div>
              {averageRecordedMapsPerMappedMatch !== null && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Average recorded maps per mapped match</span>
                  <Badge variant="outline">{averageRecordedMapsPerMappedMatch.toFixed(2)}</Badge>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Score Quality
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Missing score data</span>
                <Badge variant="outline">{formatNumber(summary.includedNonEarlyMatchesMissingScores)}</Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Score / best-of inconsistencies</span>
                <Badge variant="outline">{formatNumber(summary.includedNonEarlyMatchesWithInconsistentScores)}</Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Max possible map slots</span>
                <Badge variant="secondary">{formatNumber(summary.maxPossibleMapSlotsNonEarly)}</Badge>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Coverage uses played maps from valid scores, not the maximum possible map slots from best-of values.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}