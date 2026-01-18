-- Migration 002: Add Race and Team Race Rankings Tables
-- Created: 2026-01-18
-- Purpose: Add tables for race matchup rankings and team race composition rankings

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create race_rankings table for individual player race matchup rankings
CREATE TABLE IF NOT EXISTS race_rankings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  race_matchup TEXT NOT NULL,  -- e.g., "PvZ", "TvP", "ZvZ"
  current_rating NUMERIC DEFAULT 0,
  current_confidence NUMERIC DEFAULT 0,
  matches INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(race_matchup)
);

-- Create team_race_rankings table for team race composition matchup rankings
CREATE TABLE IF NOT EXISTS team_race_rankings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_race_matchup TEXT NOT NULL,  -- e.g., "PT vs ZZ", "PP vs TT"
  current_rating NUMERIC DEFAULT 0,
  current_confidence NUMERIC DEFAULT 0,
  matches INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(team_race_matchup)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_race_rankings_matchup ON race_rankings(race_matchup);
CREATE INDEX IF NOT EXISTS idx_race_rankings_rating ON race_rankings(current_rating DESC);
CREATE INDEX IF NOT EXISTS idx_team_race_rankings_matchup ON team_race_rankings(team_race_matchup);
CREATE INDEX IF NOT EXISTS idx_team_race_rankings_rating ON team_race_rankings(current_rating DESC);

-- Comments for documentation
COMMENT ON TABLE race_rankings IS 'Rankings for individual player race matchups (e.g., PvZ, TvT)';
COMMENT ON TABLE team_race_rankings IS 'Rankings for team race composition matchups (e.g., PT vs ZZ)';
COMMENT ON COLUMN race_rankings.race_matchup IS 'Race matchup format: XvY where X,Y are P(rotoss), T(erran), or Z(erg)';
COMMENT ON COLUMN team_race_rankings.team_race_matchup IS 'Team race matchup format: XY vs ZW where each letter is a race';
