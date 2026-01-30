// @ts-ignore
import { useRankingSettings } from '../context/RankingSettingsContext';

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
            <div className="flex items-center gap-4">
                  {showSeeded && (
                        <div className="flex items-center">
                              <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                          type="checkbox"
                                          checked={useSeededRankings}
                                          onChange={(e) => setUseSeededRankings(e.target.checked)}
                                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-gray-700">Use Initial Seeds (Average of Pass 1 & 2)</span>
                              </label>
                              <div className="ml-2 group relative">
                                    <span className="cursor-help text-gray-400 text-xs border border-gray-400 rounded-full w-4 h-4 inline-flex items-center justify-center">?</span>
                                    <div className="invisible group-hover:visible absolute right-0 top-full mt-2 w-64 p-2 bg-gray-800 text-white text-xs rounded shadow-lg z-10">
                                          When checked, rankings start from a seed value derived from a preliminary analysis of preset set of matches. Without this, everyone starts at 0.
                                    </div>
                              </div>
                        </div>
                  )}

                  {showConfidence && (
                        <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                    type="checkbox"
                                    checked={filterLowConfidence}
                                    onChange={(e) => setFilterLowConfidence(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-700">
                                    Filter Low Confidence
                                    {typeof confidenceThreshold === 'number' && ` (${confidenceThreshold.toFixed(1)}% threshold)`}
                              </span>
                        </label>
                  )}

                  {showMainCircuit && (
                        <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                    type="checkbox"
                                    checked={mainCircuitOnly}
                                    onChange={(e) => setMainCircuitOnly(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-700">Main Circuit Only</span>
                        </label>
                  )}

                  <div className="flex items-center gap-4 border-l pl-4 border-gray-300">
                        <span className="text-sm text-gray-500 font-medium">Seasons:</span>
                        {['2025', '2026'].map((year) => (
                              <label key={year} className="flex items-center gap-2 cursor-pointer">
                                    <input
                                          type="checkbox"
                                          checked={seasons.includes(year)}
                                          onChange={(e) => {
                                                const newSeasons = e.target.checked
                                                      ? [...seasons, year]
                                                      : seasons.filter(s => s !== year);
                                                setSeasons(newSeasons);
                                          }}
                                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-gray-700">{year}</span>
                              </label>
                        ))}
                  </div>
            </div>
      );
}
