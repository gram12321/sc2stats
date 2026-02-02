import { useMemo, useState } from 'react';
import {
      ComposedChart,
      Area,
      Line,
      XAxis,
      YAxis,
      CartesianGrid,
      Tooltip,
      ResponsiveContainer,
      ReferenceLine
} from 'recharts';

interface RatingPoint {
      date: string;
      dateLabel: string;
      rating: number;
      rank?: number;
      matchId: string;
      matchNum: number;
      tournamentName?: string;
      opponent?: string;
      confidenceRange?: [number, number];
      confidence?: number;
}

interface RatingChartProps {
      data: RatingPoint[];
      showRank?: boolean;
}

export function RatingChart({ data, showRank = false }: RatingChartProps) {
      const [xAxisMode, setXAxisMode] = useState<'match' | 'date'>('date');

      const formattedData = useMemo(() => {
            return data.map((d, i) => ({
                  ...d,
                  matchNum: i + 1
            }));
      }, [data]);

      if (formattedData.length === 0) {
            return (
                  <div className="h-64 flex items-center justify-center text-gray-400 bg-white border border-gray-200 rounded-lg">
                        {showRank ? 'No rank history available' : 'No rating history available'}
                  </div>
            );
      }

      // Calculate domain
      // Filter out 0 or undefined values for min/max calculation
      const values = data
            .map(d => showRank ? (d.rank || 0) : d.rating)
            .filter(v => v !== 0);

      const minVal = values.length ? Math.min(...values) : 0;
      const maxVal = values.length ? Math.max(...values) : 1000;

      // Calculate min/max including confidence range if available for rating mode
      let absMin = minVal;
      let absMax = maxVal;

      if (!showRank) {
            data.forEach(d => {
                  if (d.confidenceRange) {
                        absMin = Math.min(absMin, d.confidenceRange[0]);
                        absMax = Math.max(absMax, d.confidenceRange[1]);
                  }
            });
      }

      let yDomain: [number | string, number | string] = [0, 'auto'];

      if (showRank) {
            // For rank, we want 1 at the top. Domain usually [1, maxRank]
            // Add some padding at the bottom (higher number).
            // If we have ranks 1...10, maxVal is 10. we might want domain [1, 12]
            yDomain = [1, Math.ceil(maxVal * 1.1)];
      } else {
            // Rating logic
            const range = absMax - absMin;
            const padding = Math.max(range * 0.1, 50);
            yDomain = [
                  Math.floor((absMin - padding) / 10) * 10,
                  Math.ceil((absMax + padding) / 10) * 10
            ];
      }

      const CustomTooltip = ({ active, payload }: any) => {
            if (active && payload && payload.length) {
                  const dataPoint = payload[0].payload as RatingPoint;
                  return (
                        <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-md text-sm z-50">
                              <p className="font-semibold text-gray-900 mb-1">{dataPoint.dateLabel}</p>
                              {dataPoint.tournamentName && (
                                    <p className="text-gray-600 text-xs mb-1 truncate max-w-[200px] capitalize">{dataPoint.tournamentName}</p>
                              )}
                              {dataPoint.opponent && (
                                    <p className="text-gray-600 text-xs mb-2">vs {dataPoint.opponent}</p>
                              )}
                              {dataPoint.confidence !== undefined && (
                                    <p className="text-gray-500 text-xs mb-2">Confidence: {Math.round(dataPoint.confidence)}%</p>
                              )}
                              <p className="text-blue-600 font-bold text-base">
                                    {showRank && dataPoint.rank
                                          ? `#${dataPoint.rank}`
                                          : !showRank
                                                ? `${Math.round(dataPoint.rating)} pts`
                                                : 'N/A'
                                    }
                              </p>
                        </div>
                  );
            }
            return null;
      };

      const xAxisFormatter = (val: number) => {
            if (xAxisMode === 'match') return val.toString();
            // Look up date from data. matchNum is 1-based, array is 0-based.
            // val should be the matchNum.
            const index = val - 1;
            if (index >= 0 && index < formattedData.length) {
                  return formattedData[index].dateLabel;
            }
            return '';
      };

      return (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
                  <div className="flex items-center justify-between mb-4 px-2">
                        <div className="flex items-center gap-2">
                              <h2 className="text-lg font-semibold text-gray-900">
                                    {showRank ? 'Rank History' : 'Rating History'}
                              </h2>
                              <div className="relative group">
                                    <svg className="w-4 h-4 text-gray-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <div className="invisible group-hover:visible absolute left-full top-1/2 -translate-y-1/2 ml-2 w-72 p-3 bg-gray-800 text-white text-xs rounded shadow-lg z-50">
                                          <div className="space-y-2">
                                                <p>
                                                      <span className="font-bold text-blue-200">Rating vs Rank:</span> Rating represents skill points (higher is better). Rank shows global standing (lower # is better).
                                                </p>
                                                {!showRank && (
                                                      <p>
                                                            <span className="font-bold text-blue-200">Confidence Band:</span> The light blue shaded area represents the rating uncertainty.
                                                            <br />
                                                            <span className="text-gray-400 mt-1 block">
                                                                  Calculated as ±1 Standard Deviation * (1 - Confidence). A wide band means low confidence (e.g. new players), while a narrow band indicates a stable, high-confidence rating.
                                                            </span>
                                                      </p>
                                                )}
                                          </div>
                                    </div>
                              </div>
                        </div>

                        <div className="flex bg-gray-100 rounded-lg p-1 border border-gray-200">
                              <button
                                    onClick={() => setXAxisMode('date')}
                                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${xAxisMode === 'date' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                          }`}
                              >
                                    Date
                              </button>
                              <button
                                    onClick={() => setXAxisMode('match')}
                                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${xAxisMode === 'match' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                          }`}
                              >
                                    Match #
                              </button>
                        </div>
                  </div>
                  <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                              <ComposedChart
                                    data={formattedData}
                                    margin={{
                                          top: 5,
                                          right: 10,
                                          left: 0,
                                          bottom: 20,
                                    }}
                              >
                                    <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={true} stroke="#E5E7EB" />

                                    {/* Confidence Band (Only for Rating) */}
                                    {!showRank && (
                                          <Area
                                                type="monotone"
                                                dataKey="confidenceRange"
                                                stroke="none"
                                                fill="#BFDBFE"
                                                fillOpacity={0.4}
                                          />
                                    )}

                                    <XAxis
                                          dataKey="matchNum"
                                          hide={false}
                                          type="number"
                                          domain={['dataMin', 'dataMax']}
                                          tick={{ fontSize: 10, fill: '#9CA3AF' }}
                                          tickCount={10}
                                          tickMargin={10}
                                          allowDecimals={false}
                                          tickFormatter={xAxisFormatter}
                                    />
                                    <YAxis
                                          domain={yDomain}
                                          reversed={showRank} // Rank 1 is higher than Rank 100
                                          tick={{ fontSize: 11, fill: '#9CA3AF' }}
                                          tickLine={false}
                                          axisLine={false}
                                          tickFormatter={(val) => Math.round(val).toString()}
                                          width={40}
                                          allowDecimals={false}
                                    />
                                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#9CA3AF', strokeWidth: 1, strokeDasharray: '4 4' }} />
                                    {!showRank && <ReferenceLine y={0} stroke="#D1D5DB" strokeDasharray="3 3" />}
                                    <Line
                                          type="monotone"
                                          dataKey={showRank ? "rank" : "rating"}
                                          stroke="#2563EB"
                                          strokeWidth={2}
                                          dot={false}
                                          activeDot={{ r: 6, fill: '#2563EB', stroke: '#fff', strokeWidth: 2 }}
                                          animationDuration={1000}
                                          connectNulls={true}
                                    />
                              </ComposedChart>
                        </ResponsiveContainer>
                  </div>
            </div>
      );
}
