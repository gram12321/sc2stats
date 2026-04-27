import { ReactNode, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  HelpCircle,
  Loader2,
  Target,
  TrendingUp,
  XCircle
} from 'lucide-react';
import { RankingFilters } from '../components/RankingFilters';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Tooltip } from '../components/ui/tooltip';
import { MatchPredictorPanel } from '../components/MatchPredictorPanel';
import { useRankingSettings } from '../context/RankingSettingsContext';
import { formatTournamentName } from '../lib/display';
import { cn } from '../lib/utils';

interface PredictionQualitySummary {
  matches: number;
  draws: number;
  exactTossups: number;
  favoriteDecidedMatches: number;
  brierScore: number | null;
  logLoss: number | null;
  avgFavoritePrediction: number | null;
  actualFavoriteWinRate: number | null;
  calibrationError: number | null;
  favoriteAccuracy: number | null;
  upsetRate: number | null;
  broadBucketEce?: number | null;
}

interface PredictionQualityBucket extends PredictionQualitySummary {
  key: string;
}

interface PredictionQualityMiss {
  favoriteProbability: number;
  favoriteScore: string;
  favoriteSide: 'team1' | 'team2';
  team1Label: string;
  team2Label: string;
  tournament: string;
  round: string;
}

interface PredictionQualityReport {
  generatedAt: string;
  model: string;
  options: {
    useSeeds: boolean;
    mainCircuitOnly: boolean;
    seasons: string[] | 'all';
    useIntermediateTeamRating: boolean;
    intermediateFadeMatches: number;
  };
  rankingSummary: {
    matchesProcessed: number;
    teamsRanked: number;
    tournamentsIncluded: number;
    seededTeamsUsed?: number;
  };
  overall: PredictionQualitySummary;
  calibrationBuckets: PredictionQualityBucket[];
  breakdowns: {
    bestOf: PredictionQualityBucket[];
    maturity: PredictionQualityBucket[];
    confidence: PredictionQualityBucket[];
    predictionSource: PredictionQualityBucket[];
  };
  mostConfidentMisses: PredictionQualityMiss[];
}

interface PredictionQualityConfig {
  key: string;
  label: string;
  description: string;
  useSeeds: boolean;
  mainCircuitOnly: boolean;
  useIntermediateTeamRating: boolean;
  seasons: string[];
}

interface SettingsImpactRow {
  config: PredictionQualityConfig;
  report: PredictionQualityReport;
  brierDelta: number | null;
  absGapDelta: number | null;
  matchDelta: number;
}

function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'n/a';
  return `${(value * 100).toFixed(digits)}%`;
}

function formatNumber(value: number | null | undefined, digits = 4): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'n/a';
  return value.toFixed(digits);
}

function formatInteger(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'n/a';
  return value.toLocaleString();
}

function formatSignedPercentagePoints(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'n/a';
  const sign = value > 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(1)} pp`;
}

function formatSignedNumber(value: number | null | undefined, digits = 4): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'n/a';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}`;
}

function formatSignedInteger(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'n/a';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toLocaleString()}`;
}

function HelpLabel({ label, content }: { label: string; content: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span>{label}</span>
      <Tooltip content={<div className="max-w-xs leading-relaxed text-gray-700">{content}</div>} side="top">
        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
      </Tooltip>
    </span>
  );
}

function seasonsLabel(seasons: string[]): string {
  return seasons.length > 0 ? seasons.join(', ') : 'all seasons';
}

function configKey(config: Omit<PredictionQualityConfig, 'key' | 'label' | 'description'>): string {
  return [
    config.useSeeds ? 'seeds' : 'no-seeds',
    config.mainCircuitOnly ? 'main' : 'all-events',
    config.useIntermediateTeamRating ? 'itr' : 'direct',
    config.seasons.length > 0 ? config.seasons.join(',') : 'all-seasons'
  ].join('|');
}

function normalizeReportSeasons(report: PredictionQualityReport): string[] {
  return Array.isArray(report.options.seasons) ? report.options.seasons : [];
}

function makeConfig(
  label: string,
  description: string,
  base: Omit<PredictionQualityConfig, 'key' | 'label' | 'description'>,
  overrides: Partial<Omit<PredictionQualityConfig, 'key' | 'label' | 'description'>> = {}
): PredictionQualityConfig {
  const config = {
    ...base,
    ...overrides,
    seasons: overrides.seasons ?? base.seasons
  };

  return {
    ...config,
    key: configKey(config),
    label,
    description
  };
}

function buildSettingsImpactConfigs(report: PredictionQualityReport): PredictionQualityConfig[] {
  const current = {
    useSeeds: report.options.useSeeds,
    mainCircuitOnly: report.options.mainCircuitOnly,
    useIntermediateTeamRating: report.options.useIntermediateTeamRating,
    seasons: normalizeReportSeasons(report)
  };

  const candidates = [
    makeConfig('Current settings', 'The same filters used by the main report.', current),
    makeConfig(
      current.useSeeds ? 'Without initial seeds' : 'With initial seeds',
      'Only flips the initial seed setting.',
      current,
      { useSeeds: !current.useSeeds }
    ),
    makeConfig(
      current.useIntermediateTeamRating ? 'Without ITR' : 'With ITR',
      'Only flips Intermediate Team Rating.',
      current,
      { useIntermediateTeamRating: !current.useIntermediateTeamRating }
    ),
    makeConfig(
      current.mainCircuitOnly ? 'All tournaments' : 'Main circuit only',
      'Only changes the tournament scope.',
      current,
      { mainCircuitOnly: !current.mainCircuitOnly }
    ),
    makeConfig(
      current.seasons.length > 0 ? 'All seasons' : '2025 + 2026 only',
      'Only changes the season scope.',
      current,
      { seasons: current.seasons.length > 0 ? [] : ['2025', '2026'] }
    ),
    makeConfig(
      'Direct unseeded baseline',
      'No seeds and no ITR, using the current event and season scope.',
      current,
      { useSeeds: false, useIntermediateTeamRating: false }
    )
  ];

  const seen = new Set<string>();
  return candidates.filter((config) => {
    if (seen.has(config.key)) return false;
    seen.add(config.key);
    return true;
  });
}

function buildPredictionQualityUrl(config: PredictionQualityConfig): string {
  const params = new URLSearchParams();
  if (config.useSeeds) params.append('useSeeds', 'true');
  if (config.mainCircuitOnly) params.append('mainCircuitOnly', 'true');
  if (config.useIntermediateTeamRating) params.append('useIntermediateTeamRating', 'true');
  if (config.seasons.length > 0) params.append('seasons', config.seasons.join(','));
  return `/api/prediction-quality?${params.toString()}`;
}

function MetricCard({
  title,
  value,
  description,
  icon,
  tone = 'default',
  help
}: {
  title: string;
  value: string;
  description: string;
  icon: ReactNode;
  tone?: 'default' | 'green' | 'blue' | 'amber';
  help?: ReactNode;
}) {
  const toneClass = {
    default: 'bg-muted text-muted-foreground',
    green: 'bg-emerald-50 text-emerald-700',
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700'
  }[tone];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <CardDescription>
            {help ? <HelpLabel label={title} content={help} /> : title}
          </CardDescription>
          <div className={cn('rounded-md p-2', toneClass)}>{icon}</div>
        </div>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {description}
      </CardContent>
    </Card>
  );
}

function CalibrationTable({ rows }: { rows: PredictionQualityBucket[] }) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Bucket</TableHead>
            <TableHead className="text-right">Matches</TableHead>
            <TableHead className="text-right">Predicted</TableHead>
            <TableHead className="text-right">Actual</TableHead>
            <TableHead className="text-right">
              <HelpLabel
                label="Gap"
                content="Actual favorite win rate minus average favorite prediction. These are percentage points, not ranking points. Positive means favorites won more often than predicted; negative means the model was too confident."
              />
            </TableHead>
            <TableHead className="text-right">Brier</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell className="font-medium">{row.key}</TableCell>
              <TableCell className="text-right">{formatInteger(row.matches)}</TableCell>
              <TableCell className="text-right">{formatPercent(row.avgFavoritePrediction)}</TableCell>
              <TableCell className="text-right">{formatPercent(row.actualFavoriteWinRate)}</TableCell>
              <TableCell
                className={cn(
                  'text-right font-medium',
                  (row.calibrationError || 0) > 0.025 && 'text-amber-700',
                  (row.calibrationError || 0) < -0.025 && 'text-rose-700'
                )}
              >
                {formatSignedPercentagePoints(row.calibrationError)}
              </TableCell>
              <TableCell className="text-right">{formatNumber(row.brierScore)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function BreakdownList({ title, rows }: { title: string; rows: PredictionQualityBucket[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>
          Compares average predicted favorite probability against how often favorites actually won.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.map((row) => (
          <div key={row.key} className="space-y-2 text-sm">
            <div className="min-w-0">
              <div className="truncate font-medium">{row.key}</div>
              <div className="text-xs text-muted-foreground">{formatInteger(row.matches)} matches</div>
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-md bg-muted/40 p-2 text-right">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Predicted</div>
                <div className="font-medium">{formatPercent(row.avgFavoritePrediction)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Actual</div>
                <div className="font-medium">{formatPercent(row.actualFavoriteWinRate)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Gap</div>
                <div className={cn(
                  'font-medium',
                  (row.calibrationError || 0) > 0.025 && 'text-amber-700',
                  (row.calibrationError || 0) < -0.025 && 'text-rose-700'
                )}>
                  {formatSignedPercentagePoints(row.calibrationError)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ConfidenceBadge({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return <Badge variant="outline">n/a</Badge>;
  }

  if (value < 0.2) return <Badge variant="secondary">well calibrated</Badge>;
  if (value < 0.35) return <Badge variant="outline">watch sample</Badge>;
  return <Badge variant="destructive">high error</Badge>;
}

function DeltaCell({
  value,
  type
}: {
  value: number | null;
  type: 'number' | 'gap';
}) {
  const isMeaningful = value !== null && Number.isFinite(value) && Math.abs(value) > 0.00001;
  const isBetter = isMeaningful && value < 0;
  const isWorse = isMeaningful && value > 0;

  return (
    <span
      className={cn(
        'font-medium',
        isBetter && 'text-emerald-700',
        isWorse && 'text-rose-700'
      )}
    >
      {type === 'gap' ? formatSignedPercentagePoints(value) : formatSignedNumber(value)}
    </span>
  );
}

function SettingsImpactTable({
  rows,
  isLoading,
  error
}: {
  rows: SettingsImpactRow[];
  isLoading: boolean;
  error: string | null;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <TrendingUp className="h-5 w-5 text-primary" />
              Settings Impact
            </CardTitle>
            <CardDescription>
              Compares the current model settings with nearby alternatives. Negative deltas are better for Brier and absolute gap.
            </CardDescription>
          </div>
          {isLoading && (
            <Badge variant="outline" className="w-fit gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              comparing
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Scenario</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead className="text-right">Matches</TableHead>
                <TableHead className="text-right">Predicted</TableHead>
                <TableHead className="text-right">Actual</TableHead>
                <TableHead className="text-right">Gap</TableHead>
                <TableHead className="text-right">Brier</TableHead>
                <TableHead className="text-right">
                  <HelpLabel
                    label="dBrier"
                    content="Difference from the current settings. Negative is better because lower Brier score means smaller probability error."
                  />
                </TableHead>
                <TableHead className="text-right">
                  <HelpLabel
                    label="dAbs gap"
                    content="Difference in absolute calibration gap from the current settings. Negative means the variant is closer to calibrated overall."
                  />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={row.config.key}>
                  <TableCell>
                    <div className="font-medium">{row.config.label}</div>
                    <div className="text-xs text-muted-foreground">{row.config.description}</div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <div>{row.config.useSeeds ? 'Seeds on' : 'Seeds off'}</div>
                    <div>{row.config.useIntermediateTeamRating ? 'ITR on' : 'ITR off'}</div>
                    <div>{row.config.mainCircuitOnly ? 'Main circuit' : 'All events'}</div>
                    <div>{seasonsLabel(row.config.seasons)}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div>{formatInteger(row.report.overall.matches)}</div>
                    {index > 0 && row.matchDelta !== 0 && (
                      <div className="text-xs text-muted-foreground">{formatSignedInteger(row.matchDelta)}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{formatPercent(row.report.overall.avgFavoritePrediction)}</TableCell>
                  <TableCell className="text-right">{formatPercent(row.report.overall.actualFavoriteWinRate)}</TableCell>
                  <TableCell className="text-right">{formatSignedPercentagePoints(row.report.overall.calibrationError)}</TableCell>
                  <TableCell className="text-right">{formatNumber(row.report.overall.brierScore)}</TableCell>
                  <TableCell className="text-right">
                    {index === 0 ? <span className="text-muted-foreground">baseline</span> : <DeltaCell value={row.brierDelta} type="number" />}
                  </TableCell>
                  <TableCell className="text-right">
                    {index === 0 ? <span className="text-muted-foreground">baseline</span> : <DeltaCell value={row.absGapDelta} type="gap" />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          These comparisons are diagnostic, not a leaderboard. A setting can improve Brier while worsening calibration gap, or change the match pool enough that the comparison is no longer one-to-one.
        </p>
      </CardContent>
    </Card>
  );
}

export function PredictionQuality() {
  const { seasons, useSeededRankings, mainCircuitOnly, useIntermediateTeamRating } = useRankingSettings();
  const [report, setReport] = useState<PredictionQualityReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settingsImpactRows, setSettingsImpactRows] = useState<SettingsImpactRow[]>([]);
  const [isSettingsImpactLoading, setIsSettingsImpactLoading] = useState(false);
  const [settingsImpactError, setSettingsImpactError] = useState<string | null>(null);

  useEffect(() => {
    const loadReport = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (useSeededRankings) params.append('useSeeds', 'true');
        if (mainCircuitOnly) params.append('mainCircuitOnly', 'true');
        if (useIntermediateTeamRating) params.append('useIntermediateTeamRating', 'true');
        if (seasons.length > 0) params.append('seasons', seasons.join(','));

        const response = await fetch(`/api/prediction-quality?${params.toString()}`);
        if (!response.ok) {
          throw new Error('Failed to load prediction quality report');
        }

        const data = await response.json();
        setReport(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load prediction quality report');
      } finally {
        setIsLoading(false);
      }
    };

    loadReport();
  }, [mainCircuitOnly, seasons, useIntermediateTeamRating, useSeededRankings]);

  useEffect(() => {
    if (!report) return;

    let isCancelled = false;

    const loadSettingsImpact = async () => {
      const configs = buildSettingsImpactConfigs(report);
      const currentConfig = configs[0];
      const currentReport = report;
      const baselineBrier = currentReport.overall.brierScore;
      const baselineAbsGap = currentReport.overall.calibrationError === null
        ? null
        : Math.abs(currentReport.overall.calibrationError);

      setSettingsImpactRows([
        {
          config: currentConfig,
          report: currentReport,
          brierDelta: null,
          absGapDelta: null,
          matchDelta: 0
        }
      ]);
      setIsSettingsImpactLoading(true);
      setSettingsImpactError(null);

      try {
        const variantRows = await Promise.all(
          configs.slice(1).map(async (config) => {
            const response = await fetch(buildPredictionQualityUrl(config));
            if (!response.ok) {
              throw new Error(`Failed to load ${config.label}`);
            }

            const variantReport: PredictionQualityReport = await response.json();
            const variantBrier = variantReport.overall.brierScore;
            const variantAbsGap = variantReport.overall.calibrationError === null
              ? null
              : Math.abs(variantReport.overall.calibrationError);

            return {
              config,
              report: variantReport,
              brierDelta: baselineBrier === null || variantBrier === null
                ? null
                : variantBrier - baselineBrier,
              absGapDelta: baselineAbsGap === null || variantAbsGap === null
                ? null
                : variantAbsGap - baselineAbsGap,
              matchDelta: variantReport.overall.matches - currentReport.overall.matches
            };
          })
        );

        if (!isCancelled) {
          setSettingsImpactRows([
            {
              config: currentConfig,
              report: currentReport,
              brierDelta: null,
              absGapDelta: null,
              matchDelta: 0
            },
            ...variantRows
          ]);
        }
      } catch (err) {
        if (!isCancelled) {
          setSettingsImpactError(err instanceof Error ? err.message : 'Failed to compare prediction settings');
        }
      } finally {
        if (!isCancelled) {
          setIsSettingsImpactLoading(false);
        }
      }
    };

    loadSettingsImpact();

    return () => {
      isCancelled = true;
    };
  }, [report]);

  const mostReliableBucket = useMemo(() => {
    if (!report) return null;
    return report.calibrationBuckets
      .filter((row) => row.key !== 'exact 50%' && row.matches >= 20 && row.calibrationError !== null)
      .sort((a, b) => Math.abs(a.calibrationError || 0) - Math.abs(b.calibrationError || 0))[0] || null;
  }, [report]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 py-24">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading prediction quality...</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <Card className="border-destructive/50 bg-destructive/10">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center space-y-2 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="font-semibold text-destructive">{error || 'Prediction quality report unavailable'}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const latestRunLabel = new Date(report.generatedAt).toLocaleString();
  const confidenceRows = report.breakdowns.confidence.filter((row) => row.matches > 0);
  const sourceRows = report.breakdowns.predictionSource.filter((row) => row.matches > 0);

  return (
    <div className="animate-in space-y-8 fade-in duration-500">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-foreground">
              <Target className="h-8 w-8 text-primary" />
              Prediction Quality
            </h1>
            <p className="mt-2 max-w-3xl leading-relaxed text-muted-foreground">
              This report checks whether pre-match team win probabilities match real outcomes when grouped across the filtered match history.
            </p>
          </div>
          <Badge variant="outline" className="w-fit">
            Updated from API: {latestRunLabel}
          </Badge>
        </div>

        <Card>
          <CardContent className="pt-6">
            <RankingFilters
              showSeeded
              showMainCircuit
              showIntermediateTeamRating
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Matches scored"
          value={formatInteger(report.overall.matches)}
          description={`${formatInteger(report.rankingSummary.tournamentsIncluded)} tournaments, ${formatInteger(report.rankingSummary.teamsRanked)} teams in the current run.`}
          icon={<BarChart3 className="h-5 w-5" />}
          tone="blue"
        />
        <MetricCard
          title="Actual favorite win rate"
          value={formatPercent(report.overall.actualFavoriteWinRate)}
          description={`Average predicted favorite probability: ${formatPercent(report.overall.avgFavoritePrediction)}.`}
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="green"
          help="How often the team with more than 50% predicted win chance actually won. Read this against the average predicted favorite probability, not as a standalone winner-pick score."
        />
        <MetricCard
          title="Brier score"
          value={formatNumber(report.overall.brierScore)}
          description="Lower is better. A constant 50/50 model scores about 0.2500."
          icon={<Target className="h-5 w-5" />}
          help="Brier score is the average squared probability error. A confident wrong prediction is punished more than a cautious wrong prediction."
        />
        <MetricCard
          title="Calibration gap"
          value={formatSignedPercentagePoints(report.overall.calibrationError)}
          description={`Broad-bucket ECE: ${formatSignedPercentagePoints(report.overall.broadBucketEce)}.`}
          icon={<TrendingUp className="h-5 w-5" />}
          tone="amber"
          help="Actual favorite win rate minus average favorite prediction. It is measured in percentage points, not ranking points."
        />
      </div>

      <MatchPredictorPanel
        useSeededRankings={useSeededRankings}
        mainCircuitOnly={mainCircuitOnly}
        useIntermediateTeamRating={useIntermediateTeamRating}
        seasons={seasons}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <BarChart3 className="h-5 w-5 text-primary" />
              Calibration by Favorite Probability
            </CardTitle>
            <CardDescription>
              The core test is whether predicted probability strength matches observed results.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CalibrationTable rows={report.calibrationBuckets} />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Reading The Report</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
              <div>
                <span className="font-medium text-foreground">Prediction strength matters.</span>
                {' '}The model is not just picking a winner; it is saying how strong that favorite is.
              </div>
              <div>
                <span className="font-medium text-foreground">Single matches do not validate probabilities.</span>
                {' '}A 70% favorite can lose. The useful question is whether many 70% favorites win close to 70%.
              </div>
              <div>
                <span className="font-medium text-foreground">Gap uses percentage points.</span>
                {' '}If a bucket predicted 65% and won 70%, the gap is +5 pp. That means percentage points, not ranking points.
              </div>
              <div>
                <span className="font-medium text-foreground">Sample size matters.</span>
                {' '}Small buckets can look extreme even when the model is reasonable.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Read</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Overall status</span>
                <ConfidenceBadge value={report.overall.broadBucketEce} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Average favorite prediction</span>
                <Badge variant="secondary">{formatPercent(report.overall.avgFavoritePrediction)}</Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Actual favorite win rate</span>
                <Badge>{formatPercent(report.overall.actualFavoriteWinRate)}</Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Best aligned bucket</span>
                <Badge variant="outline">{mostReliableBucket ? mostReliableBucket.key : 'n/a'}</Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Exact 50/50 predictions</span>
                <Badge variant="outline">{formatInteger(report.overall.exactTossups)}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <BreakdownList title="Best-of Length" rows={report.breakdowns.bestOf.filter((row) => row.matches > 0)} />
        <BreakdownList title="Team Maturity" rows={report.breakdowns.maturity.filter((row) => row.matches > 0)} />
        <BreakdownList title="Pre-match Confidence" rows={confidenceRows} />
        <BreakdownList title="Prediction Source" rows={sourceRows} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <XCircle className="h-5 w-5 text-rose-600" />
            Most Confident Misses
          </CardTitle>
          <CardDescription>
            These are not proof of bad predictions by themselves, but they are useful examples to inspect.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Prediction</TableHead>
                  <TableHead className="w-24">Fav score</TableHead>
                  <TableHead>Favorite</TableHead>
                  <TableHead>Opponent</TableHead>
                  <TableHead>Tournament</TableHead>
                  <TableHead>Round</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.mostConfidentMisses.slice(0, 10).map((row, index) => {
                  const favorite = row.favoriteSide === 'team1' ? row.team1Label : row.team2Label;
                  const opponent = row.favoriteSide === 'team1' ? row.team2Label : row.team1Label;

                  return (
                    <TableRow key={`${row.tournament}-${row.round}-${favorite}-${index}`}>
                      <TableCell className="font-medium text-rose-700">{formatPercent(row.favoriteProbability)}</TableCell>
                      <TableCell>{row.favoriteScore}</TableCell>
                      <TableCell>{favorite}</TableCell>
                      <TableCell>{opponent}</TableCell>
                      <TableCell>{formatTournamentName(row.tournament)}</TableCell>
                      <TableCell>{row.round}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <SettingsImpactTable
        rows={settingsImpactRows}
        isLoading={isSettingsImpactLoading}
        error={settingsImpactError}
      />
    </div>
  );
}
