

// @ts-ignore
import { useRankingSettings } from '../context/RankingSettingsContext';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { HelpCircle } from 'lucide-react';
import { Tooltip } from './ui/tooltip';

interface RankingFiltersProps {
      showSeeded?: boolean;
      showConfidence?: boolean;
      showMainCircuit?: boolean;
      confidenceThreshold?: number;
}

export function RankingFilters({
      showSeeded = false,
      showConfidence = false,
      showMainCircuit = true,
      confidenceThreshold,
}: RankingFiltersProps) {
      const {
            useSeededRankings,
            setUseSeededRankings,
            filterLowConfidence,
            setFilterLowConfidence,
            mainCircuitOnly,
            setMainCircuitOnly,
            seasons,
            setSeasons,
      } = useRankingSettings();

      return (
            <div className="flex flex-wrap items-center gap-6">
                  {showSeeded && (
                        <div className="flex items-center space-x-2">
                              <Checkbox
                                    id="seeded"
                                    checked={useSeededRankings}
                                    onCheckedChange={(checked) => setUseSeededRankings(checked === true)}
                              />
                              <Label htmlFor="seeded" className="text-sm font-medium flex items-center gap-1 cursor-pointer">
                                    Use Initial Seeds
                                    <Tooltip content="When checked, rankings start from a seed value derived from a preliminary analysis of preset set of matches. Without this, everyone starts at 0.">
                                          <HelpCircle className="h-3 w-3 text-muted-foreground" />
                                    </Tooltip>
                              </Label>
                        </div>
                  )}

                  {showConfidence && (
                        <div className="flex items-center space-x-2">
                              <Checkbox
                                    id="confidence"
                                    checked={filterLowConfidence}
                                    onCheckedChange={(checked) => setFilterLowConfidence(checked === true)}
                              />
                              <Label htmlFor="confidence" className="text-sm font-medium cursor-pointer">
                                    Filter Low Confidence
                                    {typeof confidenceThreshold === 'number' && (
                                          <span className="text-muted-foreground ml-1 text-xs">
                                                ({confidenceThreshold.toFixed(1)}%)
                                          </span>
                                    )}
                              </Label>
                        </div>
                  )}

                  {showMainCircuit && (
                        <div className="flex items-center space-x-2">
                              <Checkbox
                                    id="mainCircuit"
                                    checked={mainCircuitOnly}
                                    onCheckedChange={(checked) => setMainCircuitOnly(checked === true)}
                              />
                              <Label htmlFor="mainCircuit" className="text-sm font-medium cursor-pointer">
                                    Main Circuit Only
                              </Label>
                        </div>
                  )}

                  <div className="flex items-center gap-3 border-l pl-4 border-border/50">
                        <span className="text-sm text-muted-foreground font-medium">Seasons:</span>
                        {['2025', '2026'].map((year) => (
                              <div key={year} className="flex items-center space-x-2">
                                    <Checkbox
                                          id={`season-${year}`}
                                          checked={seasons.includes(year)}
                                          onCheckedChange={(checked) => {
                                                const newSeasons = checked
                                                      ? [...seasons, year]
                                                      : seasons.filter(s => s !== year);
                                                setSeasons(newSeasons);
                                          }}
                                    />
                                    <Label htmlFor={`season-${year}`} className="text-sm cursor-pointer">{year}</Label>
                              </div>
                        ))}
                  </div>
            </div>
      );
}
