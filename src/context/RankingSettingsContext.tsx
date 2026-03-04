import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface RankingSettingsContextType {
      useSeededRankings: boolean;
      setUseSeededRankings: (value: boolean) => void;
      filterLowConfidence: boolean;
      setFilterLowConfidence: (value: boolean) => void;
      mainCircuitOnly: boolean;
      setMainCircuitOnly: (value: boolean) => void;
      useIntermediateTeamRating: boolean;
      setUseIntermediateTeamRating: (value: boolean) => void;
      hideRandom: boolean;
      setHideRandom: (value: boolean) => void;
      seasons: string[];
      setSeasons: (value: string[]) => void;
}

const RankingSettingsContext = createContext<RankingSettingsContextType | undefined>(undefined);

const STORAGE_KEYS = {
      USE_SEEDED_RANKINGS: 'sc2stats_use_seeded_rankings',
      FILTER_LOW_CONFIDENCE: 'sc2stats_filter_low_confidence',
      MAIN_CIRCUIT_ONLY: 'sc2stats_main_circuit_only',
      USE_INTERMEDIATE_TEAM_RATING: 'sc2stats_use_intermediate_team_rating',
      HIDE_RANDOM: 'sc2stats_hide_random',
      SEASONS: 'sc2stats_seasons',
};

export function RankingSettingsProvider({ children }: { children: ReactNode }) {
      const [useSeededRankings, setUseSeededRankingsState] = useState(true);
      const [filterLowConfidence, setFilterLowConfidenceState] = useState(true);
      const [mainCircuitOnly, setMainCircuitOnlyState] = useState(true);
      const [useIntermediateTeamRating, setUseIntermediateTeamRatingState] = useState(true);
      const [hideRandom, setHideRandomState] = useState(true);
      const [seasons, setSeasonsState] = useState<string[]>(['2025', '2026']);

      // Load settings from localStorage on mount
      useEffect(() => {
            const savedSeeded = localStorage.getItem(STORAGE_KEYS.USE_SEEDED_RANKINGS);
            if (savedSeeded !== null) setUseSeededRankingsState(savedSeeded === 'true');

            const savedConfidence = localStorage.getItem(STORAGE_KEYS.FILTER_LOW_CONFIDENCE);
            if (savedConfidence !== null) setFilterLowConfidenceState(savedConfidence === 'true');

            const savedMainCircuit = localStorage.getItem(STORAGE_KEYS.MAIN_CIRCUIT_ONLY);
            if (savedMainCircuit !== null) setMainCircuitOnlyState(savedMainCircuit === 'true');

            const savedIntermediateTeamRating = localStorage.getItem(STORAGE_KEYS.USE_INTERMEDIATE_TEAM_RATING);
            if (savedIntermediateTeamRating !== null) setUseIntermediateTeamRatingState(savedIntermediateTeamRating === 'true');

            const savedHideRandom = localStorage.getItem(STORAGE_KEYS.HIDE_RANDOM);
            if (savedHideRandom !== null) setHideRandomState(savedHideRandom === 'true');

            const savedSeasons = localStorage.getItem(STORAGE_KEYS.SEASONS);
            if (savedSeasons !== null) {
                  try {
                        setSeasonsState(JSON.parse(savedSeasons));
                  } catch (e) {
                        console.error('Failed to parse saved seasons', e);
                  }
            }
      }, []);

      const setUseSeededRankings = (value: boolean) => {
            setUseSeededRankingsState(value);
            localStorage.setItem(STORAGE_KEYS.USE_SEEDED_RANKINGS, String(value));
      };

      const setFilterLowConfidence = (value: boolean) => {
            setFilterLowConfidenceState(value);
            localStorage.setItem(STORAGE_KEYS.FILTER_LOW_CONFIDENCE, String(value));
      };

      const setMainCircuitOnly = (value: boolean) => {
            setMainCircuitOnlyState(value);
            localStorage.setItem(STORAGE_KEYS.MAIN_CIRCUIT_ONLY, String(value));
      };

      const setUseIntermediateTeamRating = (value: boolean) => {
            setUseIntermediateTeamRatingState(value);
            localStorage.setItem(STORAGE_KEYS.USE_INTERMEDIATE_TEAM_RATING, String(value));
      };

      const setHideRandom = (value: boolean) => {
            setHideRandomState(value);
            localStorage.setItem(STORAGE_KEYS.HIDE_RANDOM, String(value));
      };

      const setSeasons = (value: string[]) => {
            setSeasonsState(value);
            localStorage.setItem(STORAGE_KEYS.SEASONS, JSON.stringify(value));
      };

      return (
            <RankingSettingsContext.Provider
                  value={{
                        useSeededRankings,
                        setUseSeededRankings,
                        filterLowConfidence,
                        setFilterLowConfidence,
                        mainCircuitOnly,
                        setMainCircuitOnly,
                        useIntermediateTeamRating,
                        setUseIntermediateTeamRating,
                        hideRandom,
                        setHideRandom,
                        seasons,
                        setSeasons,
                  }}
            >
                  {children}
            </RankingSettingsContext.Provider>
      );
}

export function useRankingSettings() {
      const context = useContext(RankingSettingsContext);
      if (context === undefined) {
            throw new Error('useRankingSettings must be used within a RankingSettingsProvider');
      }
      return context;
}
